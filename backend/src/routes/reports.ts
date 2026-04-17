import { db } from "@/db/db";
import { authMiddleware } from "@/middleware/auth";
import Elysia, { t } from "elysia";
import * as schema from "@/db/schema";
import { and, gte, lte, sql, eq, or, ne } from "drizzle-orm";
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
        showMyOnly
      } = query;

      const filters = [];

      if (showMyOnly && user) {
        filters.push(eq(schema.issues.userId, user.id));
      } else {
        filters.push(ne(schema.issues.statusId, 5)); //!!! костыль, чтобы фильтровать не валидированные нейронкой !!!
        if (userId) {
          filters.push(eq(schema.issues.userId, userId));
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
                  lte(schema.issues.latitude, (latitude + latRange).toString())
                )
              );
            }
          
          if (longitude && !isNaN(longitude)) {
              let lngRange = latRange;
              
              if (latitude && !isNaN(longitude)) {
                  // Adjust longitude range based on latitude
                  // cos(latitude in radians) * 111 km per degree at equator
                  lngRange = distance / (111 * Math.cos(latitude * Math.PI / 180));
              }
              const leftCond = (
                longitude - lngRange < -180
                 ?
                  or(
                   gte(schema.issues.longitude, (longitude - lngRange).toString())
                   ,
                   gte(schema.issues.longitude, (longitude - lngRange+360).toString())
                  )
                 :
                  gte(schema.issues.longitude, (longitude - lngRange).toString()));

              const rightCond = (
                longitude + lngRange > 180
                 ?
                  or(
                   lte(schema.issues.longitude, (longitude + lngRange).toString())
                   ,
                   lte(schema.issues.longitude, (longitude + lngRange-360).toString())
                  )
                 :
                  lte(schema.issues.longitude, (longitude + lngRange).toString()));
              filters.push(
                and(
                  leftCond,
                  rightCond
                )
              );
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
          userId: schema.issues.userId,
          links: sql<string[]>`(
                SELECT COALESCE(
                  json_agg(${schema.photos.filePath}),
                  '[]'::json
                )
                FROM ${schema.photos} 
                WHERE ${schema.photos.issueId} = ${schema.issues.issueId}
              )`
        })
        .from(schema.issues)
        .leftJoin(schema.user, eq(schema.issues.userId, schema.user.id))
        .leftJoin(schema.issueStatuses, eq(schema.issues.statusId, schema.issueStatuses.statusId))
        .leftJoin(schema.issueTypes, eq(schema.issues.typeId, schema.issueTypes.typeId))
        .where(filters.length > 0 ? and(...filters) : undefined);

      // Apply pagination
      const paginatedQuery = (limit !== undefined && limit !== null)
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
        distance: t.Optional(t.Numeric({
          description: "Distance in kilometers for bounding box"
        })),
        
        limit: t.Optional(t.Numeric({
          minimum: 0,
          description: "Number of items to return (if omitted, returns all)"
        })),
        skip: t.Optional(t.Numeric({
          minimum: 0,
          description: "Number of items to skip (only used with limit)"
        })),
        userId: t.Optional(t.String({
          description: "Filter by user ID"
        })),
        showMyOnly: t.Optional(t.Boolean({
          description: "Include my reports only. Ignored if unathenticated"
        })),
      })
    }
  ).get(
		"/:id",
		async ({ params: { id }, status, user, serviceRequest }) => {
			// Запрос для получения одной заявки по ID (может быть расширен при необходимости)
			const report = await db.select({
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
          links: sql<string[]>`(
                SELECT COALESCE(
                  json_agg(${schema.photos.filePath}),
                  '[]'::json
                )
                FROM ${schema.photos} 
                WHERE ${schema.photos.issueId} = ${schema.issues.issueId}
              )`
        })
        .from(schema.issues)
        .leftJoin(schema.user, eq(schema.issues.userId, schema.user.id))
        .leftJoin(schema.issueStatuses, eq(schema.issues.statusId, schema.issueStatuses.statusId))
        .leftJoin(schema.issueTypes, eq(schema.issues.typeId, schema.issueTypes.typeId))
        .where(eq(schema.issues.issueId, id))
        .limit(1);

			if (!report || report.length === 0)
				return status('Not Found')
      
      //!!! костыль, чтобы фильтровать не валидированные нейронкой !!!
      if(!serviceRequest && report[0].statusId === 5 && report[0].userId !== user?.id) {
        return status('Not Found')
      }

			return report[0]
		},
		{ params: t.Object({ id: t.Number() }), auth: false, partialAuth: true },
	)
	.get("/issue-types", async () => {
		// Запрос для получения списка типов заявок
		return db.select().from(schema.issueTypes);
	}, { auth: true })
	.post("/", async ({ body, user, set }) => {
		// Обработчик создания новой заявки
		const { latitude, longitude, typeId, shortDescription, detailedDescription, address, files } = body;

		// Проверяем, авторизован ли пользователь
		if (!user) {
			set.status = 401;
			return { error: "Unauthorized" };
		}

		// Начинаем транзакцию базы данных
		try {
			const result = await db.transaction(async (tx) => {
				const defaultStatusId = 5; // ID статуса по умолчанию ('На валидации')

				// Проверяем существование типа заявки
				const issueType = await tx.query.issueTypes.findFirst({
					where: eq(schema.issueTypes.typeId, typeId)
				});

				if (!issueType) {
					set.status = 400;
					tx.rollback();
					return { error: `Issue type with ID ${typeId} not found.` };
				}

				// Вставляем новую заявку
				const newIssue = await tx.insert(schema.issues).values({
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
				}).returning();

				// Проверяем, успешно ли создана заявка
				if (newIssue.length === 0) {
					set.status = 500;
					tx.rollback();
					return { error: "Failed to create report." };
				}

        let paths: string[] = []
        if (files) {
          paths = await putIntoBucketMultiple(files, newIssue[0].issueId)
          const newPhotos = await tx.insert(schema.photos).values(
            paths.map(path => ({
            issueId: newIssue[0].issueId,
            filePath: path,
            uploadedAt: new Date()
          }))).returning()
          
          // Проверяем, успешно ли добавлены фото
          if (newPhotos.length !== paths.length) {
            console.error("failed to add photos")
            await removeFromBucketMultiple(newPhotos.map(el => el.filePath))
            set.status = 500;
            tx.rollback();
            return { error: "Failed to create report." };
          }
        }
        
        
				// Добавляем 1 балл к рейтингу пользователя
				await tx.update(schema.user)
					.set({ points: sql`${schema.user.points} + 1` })
					.where(eq(schema.user.id, user.id));

				// Если все успешно, возвращаем созданную заявку
				return newIssue[0];
			});

			if ('issueId' in result) {
        try {
          await rabbitMQ.notifyIssueCreated({
            issueId: result.issueId,
            createdAt: result.createdAt || new Date()
          });
        } catch (queueError) {
          console.error('Failed to send message to queue:', queueError);
        }
        set.status = 201;
        return result;
      } else {
        return result;
      }

    } catch (error) {
      console.error("Error creating report and updating user points:", error);
      set.status = 500;
      return { error: "Internal server error." };
    }
	}, {
		body: createReportBody,
		auth: true
	})
    // !!! НОВЫЙ ЭНДПОИНТ ДЛЯ УДАЛЕНИЯ ЗАЯВКИ (ТОЛЬКО ДЛЯ АДМИНА) !!!
    .delete("/:id", async ({ params: { id }, user, set, serviceRequest }) => {
        // Проверяем, авторизован ли пользователь и является ли он админом
        if (!serviceRequest && (user?.role !== 'admin' && user?.role !== "operator")) {
			      set.status = 403; // Forbidden
            return { error: "Forbidden" };
        }

       try {
        let deletedIssueId: number | null = null;
        
        await db.transaction(async (tx) => {
            
            const pictures = await tx.delete(schema.photos).where(eq(schema.photos.issueId, id)).returning({link: schema.photos.filePath});
            
            await removeFromBucketMultiple(pictures.map(p => p.link))

            const deletedIssues = await tx.delete(schema.issues)
                .where(eq(schema.issues.issueId, id))
                .returning({ issueId: schema.issues.issueId });
            
            if (deletedIssues.length === 0) {
                throw new Error(`Issue with ID ${id} not found.`);
            }
            
            deletedIssueId = deletedIssues[0].issueId;
        });
        
        set.status = 200;
        return { success: true, issueId: deletedIssueId };
        
    } catch (error) {
        console.error(`Error deleting issue with ID ${id}:`, error);
        
        if (error instanceof Error && error.message.includes(`Issue with ID ${id} not found`)) {
            set.status = 404;
            return { error: `Issue with ID ${id} not found.` };
        }
        
        set.status = 500;
        return { error: "Internal server error." };
    }
    }, {
        params: t.Object({ id: t.Number() }),
        auth: true // Требуется аутентификация
    })
    // !!! НОВЫЙ ЭНДПОИНТ ДЛЯ ИЗМЕНЕНИЯ СТАТУСА ЗАЯВКИ (ТОЛЬКО ДЛЯ АДМИНА) !!!
    .put("/:id/status", async ({ params: { id }, body, user, set, serviceRequest }) => {
        // Проверяем, авторизован ли пользователь и является ли он админом
        if (!serviceRequest && (user?.role !== 'admin' && user?.role !== "operator")) {
			set.status = 403; // Forbidden
            return { error: "Forbidden" };
        }

		const { statusId } = body

        // Проверяем, что в теле запроса пришел корректный statusId
        // const updateStatusBody = t.Object({
		// 	statusId: t.Number()
        // });

		// console.log(body)
		// let validationResult
		// try {
		// 	validationResult = updateStatusBody.safeParse(body);

		// }
		// catch (e) {
		// 	console.log(e)
		// }
		
        // if (!validationResult.success) {
		// 	set.status = 400; // Bad Request
        //     return { error: "Invalid request body. 'statusId' (number) is required." };
        // }
		
        // const { statusId } = validationResult.data;
		if(!id) {
			    return { error: "Invalid request body. 'statusId' (number) is required." };
		}

        // Опционально: Проверить, существует ли статус с таким ID в таблице issueStatuses
        const statusExists = await db.query.issueStatuses.findFirst({
            where: eq(schema.issueStatuses.statusId, statusId)
        });
		console.log("t", statusExists)
        if (!statusExists) {
            set.status = 400;
            return { error: `Status with ID ${statusId} not found.` };
        }


        try {
            // Обновляем статус заявки по ID
            const updatedIssues = await db.update(schema.issues)
                .set({ statusId: statusId })
                .where(eq(schema.issues.issueId, id))
                .returning({ issueId: schema.issues.issueId, statusId: schema.issues.statusId }); // Возвращаем ID и новый статус

            if (updatedIssues.length === 0) {
                set.status = 404; // Not Found
                return { error: `Issue with ID ${id} not found.` };
            }

            set.status = 200; // OK
            return { success: true, issue: updatedIssues[0] };

        } catch (error) {
            console.error(`Error updating status for issue with ID ${id}:`, error);
            set.status = 500;
            return { error: "Internal server error." };
        }
    }, {
        params: t.Object({ id: t.Number() }),
        body: t.Object({ statusId: t.Number() }),
        auth: true // Требуется аутентификация
    });

