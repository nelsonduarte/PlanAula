import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db = null

// Normaliza texto para pesquisa insensível a acentos e maiúsculas.
// Range ̀–ͯ = "Combining Diacritical Marks" — removidos após normalize('NFD').
const COMBINING_MARKS = /[̀-ͯ]/g
export function normalizarTexto(s) {
  return (s == null ? '' : String(s)).toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

export function getDb() {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'planaula.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.function('normalizar', { deterministic: true }, normalizarTexto)
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
