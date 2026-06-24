import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Dev default matches docker-compose.dev.yml (host port 5440). Override with DATABASE_URL.
const connectionString =
  process.env.DATABASE_URL ?? 'postgres://kvellman:kvellman@localhost:5440/kvellman'

const client = postgres(connectionString)

export const db = drizzle(client, { schema })
