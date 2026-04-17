import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { postgresString } from "@/db/db";

console.log("Migrating...");

const db = drizzle(postgresString);

await db.execute(sql`CREATE SCHEMA IF NOT EXISTS auth;`);

await migrate(db, { migrationsFolder: "drizzle" });

console.log("Migrations applied, seeding lookup tables...");

// Добавляем базовые типы и статусы заявок
await db.execute(
	sql`insert into issue_types (name) values ('Проблема') on conflict (name) do nothing`,
);

await db.execute(
	sql`insert into issue_statuses (name) values ('В обработке') on conflict (name) do nothing`,
);
await db.execute(
	sql`insert into issue_statuses (name) values ('В работе') on conflict (name) do nothing`,
);
await db.execute(
	sql`insert into issue_statuses (name) values ('Выполнена') on conflict (name) do nothing`,
);
await db.execute(
	sql`insert into issue_statuses (name) values ('Отклонена') on conflict (name) do nothing`,
);
await db.execute(
	sql`insert into issue_statuses (name) values ('На валидации') on conflict (name) do nothing`,
);

console.log("Seeding completed");
process.exit(0);
