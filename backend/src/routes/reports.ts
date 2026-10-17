import { db } from "@/db/db";
import { authMiddleware } from "@/middleware/auth";
import Elysia, { t } from "elysia";
import * as schema from "@/db/schema";
import { and, gte, lte, sql, eq, or, ne, desc } from "drizzle-orm";
import { putIntoBucketMultiple, removeFromBucketMultiple } from "@/utils/minio";
import { rabbitMQ } from "@/utils/rabbitmq";

const createReportBody = t.Object({
  latitude: t.String(),
  longitude: t.String(),
  typeId: t.Numeric(),
  shortDescription: t.String(),
  detailedDescription: t.Optional(t.String()),
  address: t.String(),
  files: t.Optional(t.Files()),
});

const MAX_FILES_COUNT = 3;
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export const reportsRouter = new Elysia({ prefix: "/reports" })
  .use(authMiddleware)
  .get(
    "/",
    async ({ query, user }) => {
      const {
        latitude,
        longitude,
        distance,
        limit,
        skip,
        userId,
        showMyOnly,
        showMatureOnly,
      } = query;

      const filters = [];

      // фильтр на 18+
      const matureFilter = user?.hasAccessToMatureContent
        ? // если есть доступ - учитываем фильтр или выводим все
          showMatureOnly
          ? eq(schema.issues.matureContent, true)
          : undefined
        : // если нет доступа - скрываем 18+
          eq(schema.issues.matureContent, false);

      // если смотрии свои заявки, то возращаем все
      if (showMyOnly && user) {
        filters.push(eq(schema.issues.userId, user.id));
      } else {
        // иначе - отфильтровываем те что на валидации нейронкой //TODO: нормальные статусы через enum
        const baseFilter = and(ne(schema.issues.statusId, 5), matureFilter);
        if (userId) {
          // если смотрим чьи-то заявки - фильтр на их id
          filters.push(and(baseFilter, eq(schema.issues.userId, userId)));
        } else {
          //если же смотрим все заявки
          if (user && !showMatureOnly) {
            //если мы залогинены - свои заявки любые
            filters.push(or(eq(schema.issues.userId, user.id), baseFilter));
          } else {
            // если без входа - фильтр на проверку нейронкой + 18+
            filters.push(baseFilter);
          }
        }
      }

      if (distance && distance > 0) {
        // Convert distance from kilometers to degrees (approximate)
        // 1 degree of latitude ≈ 111 km
        const latRange = distance / 111;

        if (latitude && !isNaN(latitude)) {
          filters.push(
            and(
              gte(schema.issues.latitude, (latitude - latRange).toString()),
              lte(schema.issues.latitude, (latitude + latRange).toString()),
            ),
          );
        }

        if (longitude && !isNaN(longitude)) {
          let lngRange = latRange;

          if (latitude && !isNaN(longitude)) {
            // Adjust longitude range based on latitude
            // cos(latitude in radians) * 111 km per degree at equator
            lngRange = distance / (111 * Math.cos((latitude * Math.PI) / 180));
          }
          const leftCond =
            longitude - lngRange < -180
              ? or(
                  gte(
                    schema.issues.longitude,
                    (longitude - lngRange).toString(),
                  ),
                  gte(
                    schema.issues.longitude,
                    (longitude - lngRange + 360).toString(),
                  ),
                )
              : gte(schema.issues.longitude, (longitude - lngRange).toString());

          const rightCond =
            longitude + lngRange > 180
              ? or(
                  lte(
                    schema.issues.longitude,
                    (longitude + lngRange).toString(),
                  ),
                  lte(
                    schema.issues.longitude,
                    (longitude + lngRange - 360).toString(),
                  ),
                )
              : lte(schema.issues.longitude, (longitude + lngRange).toString());
          filters.push(and(leftCond, rightCond));
        }
      }

      const queryBuilder = db
        .select({
          issueId: schema.issues.issueId,
          shortDescription: schema.issues.shortDescription,
          detailedDescription: schema.issues.detailedDescription,
          address: schema.issues.address,
          latitude: schema.issues.latitude,
          longitude: schema.issues.longitude,
          createdAt: schema.issues.createdAt,
          expectedResolutionDate: schema.issues.expectedResolutionDate,
          statusName: schema.issueStatuses.name,
          typeName: schema.issueTypes.name,
          userName: schema.user.name,
          userPoints: schema.user.points,
          statusId: schema.issues.statusId,
          matureContent: schema.issues.matureContent,
          userId: schema.issues.userId,
          links: sql<string[]>`(
                SELECT COALESCE(
                  json_agg(${schema.photos.filePath}),
                  '[]'::json
                )
                FROM ${schema.photos} 
                WHERE ${schema.photos.issueId} = ${schema.issues.issueId}
              )`,
        })
        .from(schema.issues)
        .leftJoin(schema.user, eq(schema.issues.userId, schema.user.id))
        .leftJoin(
          schema.issueStatuses,
          eq(schema.issues.statusId, schema.issueStatuses.statusId),
        )
        .leftJoin(
          schema.issueTypes,
          eq(schema.issues.typeId, schema.issueTypes.typeId),
        )
        .orderBy(desc(schema.issues.createdAt))
        .where(filters.length > 0 ? and(...filters) : undefined);

      // Apply pagination
      const paginatedQuery =
        limit !== undefined && limit !== null
          ? queryBuilder.limit(limit).offset(skip || 0)
          : queryBuilder;

      const reports = await paginatedQuery;

      return reports;
    },
    {
      auth: false,
      partialAuth: true,
      query: t.Object({
        latitude: t.Optional(t.Numeric()),
        longitude: t.Optional(t.Numeric()),
        distance: t.Optional(
          t.Numeric({
            description: "Distance in kilometers for bounding box",
          }),
        ),

        limit: t.Optional(
          t.Numeric({
            minimum: 0,
            description: "Number of items to return (if omitted, returns all)",
          }),
        ),
        skip: t.Optional(
          t.Numeric({
            minimum: 0,
            description: "Number of items to skip (only used with limit)",
          }),
        ),
        userId: t.Optional(
          t.String({
            description: "Filter by user ID",
          }),
        ),
        showMyOnly: t.Optional(
          t.Boolean({
            description: "Include my reports only. Ignored if unathenticated",
          }),
        ),
        showMatureOnly: t.Optional(
          t.Boolean({
            description:
              "Show only tasks with mature tag. Ignored if unathenticated or have no acceess to it",
          }),
        ),
      }),
    },
  )
  .get(
    "/:id",
    async ({ params: { id }, status, user, serviceRequest }) => {
      // Запрос для получения одной заявки по ID (может быть расширен при необходимости)
      const report = await db
        .select({
          issueId: schema.issues.issueId,
          shortDescription: schema.issues.shortDescription,
          detailedDescription: schema.issues.detailedDescription,
          address: schema.issues.address,
          latitude: schema.issues.latitude,
          longitude: schema.issues.longitude,
          createdAt: schema.issues.createdAt,
          expectedResolutionDate: schema.issues.expectedResolutionDate,
          statusName: schema.issueStatuses.name,
          typeName: schema.issueTypes.name,
          userName: schema.user.name,
          userPoints: schema.user.points,
          statusId: schema.issues.statusId,
          userId: schema.issues.userId,
          matureContent: schema.issues.matureContent,
          links: sql<string[]>`(
                SELECT COALESCE(
                  json_agg(${schema.photos.filePath}),
                  '[]'::json
                )
                FROM ${schema.photos} 
                WHERE ${schema.photos.issueId} = ${schema.issues.issueId}
              )`,
        })
        .from(schema.issues)
        .leftJoin(schema.user, eq(schema.issues.userId, schema.user.id))
        .leftJoin(
          schema.issueStatuses,
          eq(schema.issues.statusId, schema.issueStatuses.statusId),
        )
        .leftJoin(
          schema.issueTypes,
          eq(schema.issues.typeId, schema.issueTypes.typeId),
        )
        .where(eq(schema.issues.issueId, id))
        .limit(1);

      if (!report || report.length === 0) return status("Not Found");

      //!!! костыль, чтобы фильтровать не валидированные нейронкой !!!
      if (
        !serviceRequest &&
        report[0].statusId === 5 &&
        report[0].userId !== user?.id
      ) {
        return status("Not Found");
      }

      // проверка на 18+
      if (
        !serviceRequest &&
        report[0].matureContent &&
        !user?.hasAccessToMatureContent &&
        report[0].userId !== user?.id
      ) {
        return status("Not Found");
      }

      return report[0];
    },
    { params: t.Object({ id: t.Number() }), auth: false, partialAuth: true },
  )
  .get(
    "/issue-types",
    async () => {
      // Запрос для получения списка типов заявок
      return db.select().from(schema.issueTypes);
    },
    { auth: true },
  )
  .post(
    "/",
    async ({ body, user, set }) => {
      // Обработчик создания новой заявки
      const {
        latitude,
        longitude,
        typeId,
        shortDescription,
        detailedDescription,
        address,
        files,
      } = body;

      // Проверяем, авторизован ли пользователь
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (files) {
        if (files.length > MAX_FILES_COUNT) {
          set.status = 422;
          return { error: "To much files" };
        }
        let name = "";
        if (
          files.some((file) => {
            if (ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
              return false;
            } else {
              name = file.name;
              return true;
            }
          })
        ) {
          set.status = 422;
          return { error: `file '${name}' should be jpg or png` };
        }
        if (
          files.some((file) => {
            if (file.size <= MAX_FILE_SIZE_BYTES) {
              return false;
            }
            name = file.name;
            return true;
          })
        ) {
          set.status = 422;
          return { error: `file '${name}' exceeds 3 MB` };
        }
      }

      // Начинаем транзакцию базы данных
      try {
        const result = await db.transaction(async (tx) => {
          const defaultStatusId = 5; // ID статуса по умолчанию ('На валидации')

          // Проверяем существование типа заявки
          const issueType = await tx.query.issueTypes.findFirst({
            where: eq(schema.issueTypes.typeId, typeId),
          });

          if (!issueType) {
            set.status = 400;
            tx.rollback();
            return { error: `Issue type with ID ${typeId} not found.` };
          }

          // Вставляем новую заявку
          const newIssue = await tx
            .insert(schema.issues)
            .values({
              userId: user.id,
              typeId: typeId,
              statusId: defaultStatusId,
              shortDescription: shortDescription,
              detailedDescription: detailedDescription,
              address: address,
              latitude: latitude,
              longitude: longitude,
              createdAt: new Date(),
              // expectedResolutionDate не устанавливаем при создании
            })
            .returning();

          // Проверяем, успешно ли создана заявка
          if (newIssue.length === 0) {
            set.status = 500;
            tx.rollback();
            return { error: "Failed to create report." };
          }

          let paths: string[] = [];
          if (files) {
            paths = await putIntoBucketMultiple(files, newIssue[0].issueId);
            const newPhotos = await tx
              .insert(schema.photos)
              .values(
                paths.map((path) => ({
                  issueId: newIssue[0].issueId,
                  filePath: path,
                  uploadedAt: new Date(),
                })),
              )
              .returning();

            // Проверяем, успешно ли добавлены фото
            if (newPhotos.length !== paths.length) {
              console.error("failed to add photos");
              await removeFromBucketMultiple(
                newPhotos.map((el) => el.filePath),
              );
              set.status = 500;
              tx.rollback();
              return { error: "Failed to create report." };
            }
          }

          // Добавляем 1 балл к рейтингу пользователя
          await tx
            .update(schema.user)
            .set({ points: sql`${schema.user.points} + 1` })
            .where(eq(schema.user.id, user.id));

          // посылаем запрос на валидацию в worker
          try {
            await rabbitMQ.notifyIssueCreated({
              issueId: newIssue[0].issueId,
              createdAt: newIssue[0].createdAt || new Date(),
            });
          } catch (queueError) {
            console.error("Failed to send message to queue:", queueError);
          }

          // Если все успешно, возвращаем созданную заявку
          return newIssue[0];
        });

        if ("issueId" in result) {
          set.status = 201;
          return result;
        } else {
          set.status = 500;
          return result;
        }
      } catch (error) {
        console.error("Error creating report and updating user points:", error);
        set.status = 500;
        return { error: "Internal server error." };
      }
    },
    {
      body: createReportBody,
      auth: true,
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, user, set, serviceRequest }) => {
      // Проверяем, авторизован ли пользователь и является ли он админом
      if (
        !serviceRequest &&
        user?.role !== "admin" &&
        user?.role !== "operator" &&
        user?.role !== "superAdmin"
      ) {
        set.status = 403; // Forbidden
        return { error: "Forbidden" };
      }

      try {
        let deletedIssueId: number | null = null;

        await db.transaction(async (tx) => {
          const pictures = await tx
            .delete(schema.photos)
            .where(eq(schema.photos.issueId, id))
            .returning({ link: schema.photos.filePath });

          await removeFromBucketMultiple(pictures.map((p) => p.link));

          const deletedIssues = await tx
            .delete(schema.issues)
            .where(eq(schema.issues.issueId, id))
            .returning({
              issueId: schema.issues.issueId,
              userId: schema.issues.userId,
            });

          if (deletedIssues.length === 0) {
            throw new Error(`Issue with ID ${id} not found.`);
          }

          if (serviceRequest) {
            await tx
              .update(schema.user)
              .set({ points: sql`GREATEST(${schema.user.points} - 1, 0)` })
              .where(eq(schema.user.id, deletedIssues[0].userId));
          }

          deletedIssueId = deletedIssues[0].issueId;
        });

        set.status = 200;
        return { success: true, issueId: deletedIssueId };
      } catch (error) {
        console.error(`Error deleting issue with ID ${id}:`, error);

        if (
          error instanceof Error &&
          error.message.includes(`Issue with ID ${id} not found`)
        ) {
          set.status = 404;
          return { error: `Issue with ID ${id} not found.` };
        }

        set.status = 500;
        return { error: "Internal server error." };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      auth: true, // Требуется аутентификация
    },
  )
  .put(
    "/:id/status",
    async ({ params: { id }, body, user, set, serviceRequest }) => {
      // Проверяем, авторизован ли пользователь и является ли он админом
      if (
        !serviceRequest &&
        user?.role !== "admin" &&
        user?.role !== "operator" &&
        user?.role !== "superAdmin"
      ) {
        set.status = 403; // Forbidden
        return { error: "Forbidden" };
      }

      const { statusId } = body;

      if (!id) {
        return {
          error: "Invalid request body. 'statusId' (number) is required.",
        };
      }

      // Опционально: Проверить, существует ли статус с таким ID в таблице issueStatuses
      const statusExists = await db.query.issueStatuses.findFirst({
        where: eq(schema.issueStatuses.statusId, statusId),
      });
      console.log("t", statusExists);
      if (!statusExists) {
        set.status = 400;
        return { error: `Status with ID ${statusId} not found.` };
      }

      try {
        const updatedIssue = await db.transaction(async (tx) => {
          const existingIssue = await tx.query.issues.findFirst({
            where: eq(schema.issues.issueId, id),
            columns: {
              issueId: true,
              statusId: true,
              userId: true,
            },
          });

          if (!existingIssue) {
            return null;
          }
          // Обновляем статус заявки по ID
          const updatedIssues = await tx
            .update(schema.issues)
            .set({ statusId: statusId })
            .where(eq(schema.issues.issueId, id))
            .returning({
              issueId: schema.issues.issueId,
              statusId: schema.issues.statusId,
            }); //Возвращаем ID заявки и статус

          if (
            !serviceRequest &&
            statusId === 4 &&
            existingIssue.statusId !== 4
          ) {
            await tx
              .update(schema.user)
              .set({ points: sql`GREATEST(${schema.user.points} - 1, 0)` })
              .where(eq(schema.user.id, existingIssue.userId));
          }

          return updatedIssues[0];
        });

        if (!updatedIssue) {
          set.status = 404; // Not Found
          return { error: `Issue with ID ${id} not found.` };
        }

        set.status = 200; // OK
        return { success: true, issue: updatedIssue };
      } catch (error) {
        console.error(`Error updating status for issue with ID ${id}:`, error);
        set.status = 500;
        return { error: "Internal server error." };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      body: t.Object({ statusId: t.Number() }),
      auth: true, // Требуется аутентификация
    },
  )
  .put(
    "/:id/expectedResolutionDate",
    async ({ params: { id }, body, user, set, serviceRequest }) => {
      // Проверяем, авторизован ли пользователь и является ли он админом
      if (
        !serviceRequest &&
        user?.role !== "admin" &&
        user?.role !== "operator" &&
        user?.role !== "superAdmin"
      ) {
        set.status = 403; // Forbidden
        return { error: "Forbidden" };
      }

      if (!id) {
        return {
          error: "Invalid request body. 'statusId' (number) is required.",
        };
      }

      try {
        const updatedIssue = await db.transaction(async (tx) => {
          const existingIssue = await tx.query.issues.findFirst({
            where: eq(schema.issues.issueId, id),
            columns: {
              issueId: true,
              statusId: true,
              userId: true,
            },
          });

          if (!existingIssue) {
            return null;
          }
          // Обновляем предполагаемую дату решения заявки по ID
          const updatedIssues = await tx
            .update(schema.issues)
            .set({
              expectedResolutionDate: body.expectedResolutionDate.toISOString(),
            })
            .where(eq(schema.issues.issueId, id))
            .returning();

          return updatedIssues[0];
        });

        if (!updatedIssue) {
          set.status = 404; // Not Found
          return { error: `Issue with ID ${id} not found.` };
        }

        set.status = 200; // OK
        return { success: true, issue: updatedIssue };
      } catch (error) {
        console.error(
          `Error updating resolution Date for issue with ID ${id}:`,
          error,
        );
        set.status = 500;
        return { error: "Internal server error." };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      body: t.Object({ expectedResolutionDate: t.Date() }),
      auth: true, // Требуется аутентификация
    },
  )
  .put(
    "/:id/matureContnent",
    async ({ params: { id }, body, user, set, serviceRequest }) => {
      // Проверяем, авторизован ли пользователь и является ли он админом
      if (
        !serviceRequest &&
        user?.role !== "admin" &&
        user?.role !== "operator" &&
        user?.role !== "superAdmin"
      ) {
        set.status = 403; // Forbidden
        return { error: "Forbidden" };
      }

      if (!id) {
        return {
          error: "Invalid request body. 'statusId' (number) is required.",
        };
      }

      try {
        const updatedIssue = await db.transaction(async (tx) => {
          const existingIssue = await tx.query.issues.findFirst({
            where: eq(schema.issues.issueId, id),
            columns: {
              issueId: true,
              statusId: true,
              userId: true,
            },
          });

          if (!existingIssue) {
            return null;
          }
          // Обновляем тег заявки по ID
          const updatedIssues = await tx
            .update(schema.issues)
            .set({ matureContent: body.matureContent })
            .where(eq(schema.issues.issueId, id))
            .returning();

          return updatedIssues[0];
        });

        if (!updatedIssue) {
          set.status = 404; // Not Found
          return { error: `Issue with ID ${id} not found.` };
        }

        set.status = 200; // OK
        return { success: true, issue: updatedIssue };
      } catch (error) {
        console.error(
          `Error updating matureContent tag for issue with ID ${id}:`,
          error,
        );
        set.status = 500;
        return { error: "Internal server error." };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      body: t.Object({ matureContent: t.Boolean() }),
      auth: true, // Требуется аутентификация
    },
  )
  .put(
    "/:id/llm_answer",
    async ({ params: { id }, set, body, serviceRequest }) => {
      // Проверяем что запрос  от сервера
      if (!serviceRequest) {
        set.status = 403; // Forbidden
        return { error: "Forbidden" };
      }

      if (!id) {
        return {
          error: "Invalid request body. 'statusId' (number) is required.",
        };
      }

      try {
        const updatedIssue = await db.transaction(async (tx) => {
          const existingIssue = await tx.query.issues.findFirst({
            where: eq(schema.issues.issueId, id),
            columns: {
              issueId: true,
              statusId: true,
              userId: true,
            },
          });

          if (!existingIssue) {
            return null;
          }
          // Обновляем тег и статус заявки по ID
          const updatedIssues = await tx
            .update(schema.issues)
            .set({ matureContent: body.matureContent, statusId: 1 })
            .where(eq(schema.issues.issueId, id))
            .returning();

          return updatedIssues[0];
        });

        if (!updatedIssue) {
          set.status = 404; // Not Found
          return { error: `Issue with ID ${id} not found.` };
        }

        set.status = 200; // OK
        return { success: true, issue: updatedIssue };
      } catch (error) {
        console.error(
          `Error handling llm answer for issue with ID ${id}:`,
          error,
        );

        set.status = 500;
        return { error: "Internal server error." };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      body: t.Object({ matureContent: t.Boolean() }),
      auth: true, // Требуется аутентификация
    },
  );
