import { neon } from "@neondatabase/serverless";
import { env, normalizePostgresConnectionString } from "@skintext/shared";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) {
    _db = drizzle(neon(normalizePostgresConnectionString(env.DATABASE_URL)), { schema });
  }
  return _db;
}
