import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

console.log('Migrating...')

const dbUrl = process.env.DATABASE_URL

if (!dbUrl)
  throw new Error('DATABASE_URL is missing')

const db = drizzle(process.env.DATABASE_URL as string);

await migrate(db, { migrationsFolder: 'drizzle' })

console.log('Migrations applied')
process.exit(0)
