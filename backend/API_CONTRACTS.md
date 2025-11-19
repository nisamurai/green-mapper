# API Контракты — Green Mapper

## Общая информация

- **Base URL**: `http://localhost:3000` (или другой адрес вашего сервера)
- **Аутентификация**: Bearer Token (в заголовке `Authorization`) или Cookie-сессия
- **Формат**: JSON
- **Auth Provider**: `better-auth`

---

## Authentication (better-auth)

### POST /auth/sign-up
**Описание**: Регистрация нового пользователя

**Входные данные (body)**:
```json
{
  "email": "ivan@example.com",
  "password": "Str0ngP@ssw0rd",
  "name": "Иван"
}
```

**Выходные данные (201)**:
```json
{
  "user": {
    "id": "user_123",
    "email": "ivan@example.com",
    "name": "Иван",
    "createdAt": "2025-11-01T12:00:00Z"
  }
}
```

**Возможные коды ответов**:
- `201` — Пользователь создан
- `400` — Некорректные данные (email уже существует, пароль слабый)
- `500` — Внутренняя ошибка сервера

---

### POST /auth/sign-in
**Описание**: Вход пользователя в систему

**Входные данные (body)**:
```json
{
  "email": "ivan@example.com",
  "password": "Str0ngP@ssw0rd"
}
```

**Выходные данные (200)**:
```json
{
  "session": {
    "token": "<SESSION_TOKEN>",
    "expiresAt": "2025-12-17T12:00:00Z"
  },
  "user": {
    "id": "user_123",
    "email": "ivan@example.com",
    "name": "Иван"
  }
}
```

**Возможные коды ответов**:
- `200` — Успешный вход
- `400` — Некорректный email или пароль
- `401` — Неверные учетные данные
- `500` — Внутренняя ошибка сервера

---

### POST /auth/sign-out
**Описание**: Выход пользователя из системы

**Входные данные**: нет (требуется Auth header)

**Выходные данные (200)**:
```json
{ "success": true }
```

**Возможные коды ответов**:
- `200` — Успешный выход
- `401` — Неавторизован
- `500` — Внутренняя ошибка сервера

---

### GET /auth/session
**Описание**: Получить текущую сессию пользователя

**Входные данные**: нет

**Выходные данные (200)**:
```json
{
  "session": {
    "id": "session_123",
    "userId": "user_123",
    "expiresAt": "2025-12-17T12:00:00Z"
  },
  "user": {
    "id": "user_123",
    "email": "ivan@example.com",
    "name": "Иван",
    "points": 5,
    "role": "user"
  }
}
```

**Возможные коды ответов**:
- `200` — Сессия активна
- `401` — Нет активной сессии
- `500` — Внутренняя ошибка сервера

---

## Users

### GET /users/me
**Описание**: Получить информацию о текущем авторизованном пользователе

**Требуется Auth**: Да

**Входные данные**: нет

**Выходные данные (200)**:
```json
{
  "id": "user_123",
  "name": "Иван",
  "email": "ivan@example.com",
  "emailVerified": true,
  "image": null,
  "createdAt": "2025-11-01T12:00:00Z",
  "updatedAt": "2025-11-02T12:00:00Z",
  "points": 5,
  "role": "user"
}
```

**Возможные коды ответов**:
- `200` — Успешно получено
- `401` — Неавторизован
- `404` — Пользователь не найден
- `500` — Внутренняя ошибка сервера

---

## Reports (Заявки)

### GET /reports
**Описание**: Получить список всех заявок с информацией о типе, статусе и авторе

**Требуется Auth**: Да

**Входные данные**: нет (опционально query параметры для фильтрации)

**Выходные данные (200)**:
```json
[
  {
    "issueId": 12,
    "shortDescription": "Разбитый тротуар",
    "detailedDescription": "Дыра около дома 5",
    "address": "ул. Примерная, 5",
    "latitude": "55.755825",
    "longitude": "37.617298",
    "createdAt": "2025-11-10T10:00:00Z",
    "expectedResolutionDate": null,
    "statusName": "В обработке",
    "statusId": 1,
    "typeName": "Инфраструктура",
    "userName": "Иван",
    "userPoints": 10
  }
]
```

**Возможные коды ответов**:
- `200` — Список получен
- `401` — Неавторизован
- `500` — Внутренняя ошибка сервера

---

### GET /reports/:id
**Описание**: Получить одну конкретную заявку по ID

**Требуется Auth**: Да

**Входные данные**:
- `id` (path parameter, number) — ID заявки

**Выходные данные (200)**:
```json
{
  "issueId": 12,
  "userId": "user_123",
  "typeId": 1,
  "statusId": 1,
  "shortDescription": "Разбитый тротуар",
  "detailedDescription": "Дыра около дома 5",
  "address": "ул. Примерная, 5",
  "latitude": "55.755825",
  "longitude": "37.617298",
  "createdAt": "2025-11-10T10:00:00Z",
  "expectedResolutionDate": null
}
```

**Возможные коды ответов**:
- `200` — Заявка получена
- `401` — Неавторизован
- `404` — Заявка не найдена
- `500` — Внутренняя ошибка сервера

---

### GET /reports/issue-types
**Описание**: Получить список доступных типов заявок

**Требуется Auth**: Да

**Входные данные**: нет

**Выходные данные (200)**:
```json
[
  { "typeId": 1, "name": "Инфраструктура" },
  { "typeId": 2, "name": "Экология" },
  { "typeId": 3, "name": "Дорожная" }
]
```

**Возможные коды ответов**:
- `200` — Список типов получен
- `401` — Неавторизован
- `500` — Внутренняя ошибка сервера

---

### POST /reports
**Описание**: Создать новую заявку

**Требуется Auth**: Да

**Входные данные (body)**:
```json
{
  "latitude": "55.755825",
  "longitude": "37.617298",
  "typeId": 2,
  "shortDescription": "Колодец открыт",
  "detailedDescription": "Рядом со школой",
  "address": "ул. Примерная, 10"
}
```

**Валидация**:
- `latitude` (string) — обязательно
- `longitude` (string) — обязательно
- `typeId` (number) — обязательно, должен существовать в `issue_types`
- `shortDescription` (string) — обязательно, макс 200 символов
- `detailedDescription` (string) — опционально, макс 1000 символов
- `address` (string) — обязательно, макс 255 символов

**Выходные данные (201)**:
```json
{
  "issueId": 101,
  "userId": "user_123",
  "typeId": 2,
  "statusId": 1,
  "shortDescription": "Колодец открыт",
  "detailedDescription": "Рядом со школой",
  "address": "ул. Примерная, 10",
  "latitude": "55.755825",
  "longitude": "37.617298",
  "createdAt": "2025-11-16T12:00:00Z",
  "expectedResolutionDate": null
}
```

**Возможные коды ответов**:
- `201` — Заявка создана успешно
- `400` — Некорректные входные данные (typeId не найден, некорректное тело)
- `401` — Неавторизован
- `500` — Внутренняя ошибка сервера

---

### DELETE /reports/:id
**Описание**: Удалить заявку (только для администраторов)

**Требуется Auth**: Да (роль `admin`)

**Входные данные**:
- `id` (path parameter, number) — ID заявки

**Выходные данные (200)**:
```json
{
  "success": true,
  "issueId": 101
}
```

**Возможные коды ответов**:
- `200` — Заявка удалена
- `401` — Неавторизован
- `403` — Недостаточно прав (не администратор)
- `404` — Заявка не найдена
- `500` — Внутренняя ошибка сервера

---

### PUT /reports/:id/status
**Описание**: Изменить статус заявки (только для администраторов)

**Требуется Auth**: Да (роль `admin`)

**Входные данные**:
- `id` (path parameter, number) — ID заявки
- Body:
```json
{
  "statusId": 2
}
```

**Валидация**:
- `statusId` (number) — обязательно, должен существовать в `issue_statuses`

**Выходные данные (200)**:
```json
{
  "success": true,
  "issue": {
    "issueId": 101,
    "statusId": 2
  }
}
```

**Возможные коды ответов**:
- `200` — Статус обновлен
- `400` — Некорректные входные данные
- `401` — Неавторизован
- `403` — Недостаточно прав (не администратор)
- `404` — Заявка не найдена
- `500` — Внутренняя ошибка сервера

---

## Таблицы и схемы

### Пользователи (user)
```json
{
  "id": "string (primary key)",
  "name": "string",
  "email": "string (unique)",
  "emailVerified": "boolean",
  "image": "string | null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "points": "integer (default: 0)",
  "role": "user | admin (default: user)"
}
```

### Заявки (issues)
```json
{
  "issueId": "integer (primary key)",
  "userId": "string (foreign key -> user.id)",
  "typeId": "integer (foreign key -> issue_types.typeId)",
  "statusId": "integer (foreign key -> issue_statuses.statusId)",
  "shortDescription": "string (max 200)",
  "detailedDescription": "string (max 1000) | null",
  "address": "string (max 255)",
  "latitude": "decimal",
  "longitude": "decimal",
  "createdAt": "timestamp (default: now)",
  "expectedResolutionDate": "date | null"
}
```

### Типы заявок (issue_types)
```json
{
  "typeId": "integer (primary key)",
  "name": "string (unique, max 250)"
}
```

### Статусы заявок (issue_statuses)
```json
{
  "statusId": "integer (primary key)",
  "name": "string (unique, max 20)"
}
```

---

## Примеры использования (curl)

### Регистрация
```bash
curl -X POST http://localhost:3000/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ivan@example.com",
    "password": "Str0ngP@ssw0rd",
    "name": "Иван"
  }'
```

### Вход
```bash
curl -X POST http://localhost:3000/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ivan@example.com",
    "password": "Str0ngP@ssw0rd"
  }'
```

### Получить текущего пользователя
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/users/me
```

### Получить список заявок
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/reports
```

### Создать заявку
```bash
curl -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "latitude": "55.755825",
    "longitude": "37.617298",
    "typeId": 2,
    "shortDescription": "Колодец открыт",
    "detailedDescription": "Рядом со школой",
    "address": "ул. Примерная, 10"
  }'
```

### Изменить статус заявки (админ)
```bash
curl -X PUT http://localhost:3000/reports/101/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{ "statusId": 2 }'
```

### Удалить заявку (админ)
```bash
curl -X DELETE http://localhost:3000/reports/101 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## Ошибки

### Стандартная структура ошибок

**4xx Ошибки**:
```json
{
  "error": "Error message"
}
```

**Примеры**:
```json
{ "error": "Unauthorized" }
{ "error": "Forbidden" }
{ "error": "Issue with ID 999 not found." }
{ "error": "Issue type with ID 999 not found." }
{ "error": "Invalid request body. 'statusId' (number) is required." }
```

---

## Примечания

- Все временные метки в формате ISO 8601 (UTC)
- Координаты (latitude, longitude) в формате строк для точности
- Bearer token получается при login (`sign-in`)
- Для admin-операций требуется `role: "admin"` в профиле пользователя
- Максимальное значение баллов пользователя увеличивается на 1 при создании заявки
