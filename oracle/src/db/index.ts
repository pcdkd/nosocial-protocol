import Database from "better-sqlite3";
import { createTables } from "./schema.js";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || "nosocial.db";
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    createTables(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
