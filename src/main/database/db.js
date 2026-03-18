import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db = null

export function getDb() {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'planaula.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
