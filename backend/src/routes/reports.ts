import { db } from "@/db/db";
import { authMiddleware } from "@/middleware/auth";
import Elysia, { t } from "elysia";
import * as schema from "@/db/schema";
import { eq, sql, and } from "drizzle-orm"; // Импортируем and для комбинирования условий

const createReportBody = t.Object({
	latitude: t.String(),
	longitude: t.String(),
	typeId: t.Number(),
	shortDescription: t.String(),
	detailedDescription: t.Optional(t.String()),
	address: t.String(),
	// file: t.Optional(t.File()), // Закомментировано, так как пока не обрабатывается
});

export const reportsRouter = new Elysia({ prefix: "/reports" })
	.use(authMiddleware)
	.get("/", async ({ user }) => {
		// Запрос для получения списка заявок с данными пользователя
		return db.select({
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
            statusId: schema.issues.statusId // Добавляем statusId для удобства на фронтенде
		})
			.from(schema.issues)
			.leftJoin(schema.user, eq(schema.issues.userId, schema.user.id))
			.leftJoin(schema.issueStatuses, eq(schema.issues.statusId, schema.issueStatuses.statusId))
			.leftJoin(schema.issueTypes, eq(schema.issues.typeId, schema.issueTypes.typeId));
	}, { auth: true })
	.get(
		"/:id",
		async ({ params: { id }, status }) => {
			// Запрос для получения одной заявки по ID (может быть расширен при необходимости)
			const report = await db.query.issues.findFirst({ where: eq(schema.issues.issueId, id) })

			if (!report)
				return status('Not Found')

			return report
		},
		{ params: t.Object({ id: t.Number() }), auth: true },
	)
	.get("/issue-types", async () => {
		// Запрос для получения списка типов заявок
		return db.select().from(schema.issueTypes);
	}, { auth: true })
	.post("/", async ({ body, user, set }) => {
		// Обработчик создания новой заявки
		const { latitude, longitude, typeId, shortDescription, detailedDescription, address } = body;

		// Проверяем, авторизован ли пользователь
		if (!user) {
			set.status = 401;
			return { error: "Unauthorized" };
		}

		// Начинаем транзакцию базы данных
		try {
			const result = await db.transaction(async (tx) => {
				const defaultStatusId = 1; // ID статуса по умолчанию ('В обработке')

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

				// Добавляем 1 балл к рейтингу пользователя
				await tx.update(schema.user)
					.set({ points: sql`${schema.user.points} + 1` })
					.where(eq(schema.user.id, user.id));

				// Если все успешно, возвращаем созданную заявку
				return newIssue[0];
			});

			if ('issueId' in result) {
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
    .delete("/:id", async ({ params: { id }, user, set }) => {
        // Проверяем, авторизован ли пользователь и является ли он админом
        if (!user || user.role !== 'admin') {
            set.status = 403; // Forbidden
            return { error: "Forbidden" };
        }

        try {
            // Удаляем заявку по ID
            const deletedIssues = await db.delete(schema.issues)
                .where(eq(schema.issues.issueId, id))
                .returning({ issueId: schema.issues.issueId }); // Возвращаем ID удаленной заявки

            if (deletedIssues.length === 0) {
                set.status = 404; // Not Found
                return { error: `Issue with ID ${id} not found.` };
            }

            set.status = 200; // OK
            return { success: true, issueId: deletedIssues[0].issueId };

        } catch (error) {
            console.error(`Error deleting issue with ID ${id}:`, error);
            set.status = 500;
            return { error: "Internal server error." };
        }
    }, {
        params: t.Object({ id: t.Number() }),
        auth: true // Требуется аутентификация
    })
    // !!! НОВЫЙ ЭНДПОИНТ ДЛЯ ИЗМЕНЕНИЯ СТАТУСА ЗАЯВКИ (ТОЛЬКО ДЛЯ АДМИНА) !!!
    .put("/:id/status", async ({ params: { id }, body, user, set }) => {
        // Проверяем, авторизован ли пользователь и является ли он админом
        if (!user || user.role !== 'admin') {
            set.status = 403; // Forbidden
            return { error: "Forbidden" };
        }

        // Проверяем, что в теле запроса пришел корректный statusId
        const updateStatusBody = t.Object({
            statusId: t.Number()
        });

        const validationResult = updateStatusBody.safeParse(body);

        if (!validationResult.success) {
            set.status = 400; // Bad Request
            return { error: "Invalid request body. 'statusId' (number) is required." };
        }

        const { statusId } = validationResult.data;

        // Опционально: Проверить, существует ли статус с таким ID в таблице issueStatuses
        // const statusExists = await db.query.issueStatuses.findFirst({
        //     where: eq(schema.issueStatuses.statusId, statusId)
        // });
        // if (!statusExists) {
        //     set.status = 400;
        //     return { error: `Status with ID ${statusId} not found.` };
        // }


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
        body: t.Any(), // Используем t.Any() здесь, так как валидация тела происходит внутри
        auth: true // Требуется аутентификация
    });

