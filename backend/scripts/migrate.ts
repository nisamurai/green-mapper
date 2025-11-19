import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

console.log("Migrating...");

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) throw new Error("DATABASE_URL is missing");

const db = drizzle(dbUrl);

await migrate(db, { migrationsFolder: "drizzle" });

console.log("Migrations applied, seeding lookup tables...");

// Добавляем базовые типы и статусы заявок
await db.execute(
	sql`insert into issue_types (name) values ('Проблема') on conflict (name) do nothing`,
);

await db.execute(
	sql`insert into issue_statuses (name) values ('В обработке') on conflict (name) do nothing`,
);

console.log("Seeding completed");
process.exit(0);
