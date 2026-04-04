import { getDb } from './db.js'

// ─── Sistema de Migrações com Versões ─────────────────────────────────────────
// Cada migração é uma função que recebe o `db` e faz as alterações necessárias.
// A versão actual é guardada na tabela `schema_version`.
// Novas migrações devem ser adicionadas ao array MIGRATIONS com o índice sequencial.

const MIGRATIONS = [
  // v0 — Baseline: criação de todas as tabelas
  function v0_baseline(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS disciplinas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL, codigo TEXT UNIQUE, area_cientifica TEXT,
        carga_horaria INTEGER NOT NULL DEFAULT 0, ects REAL,
        tipo TEXT NOT NULL DEFAULT 'mista', descricao TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS modulos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
        nome TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0, horas REAL, objetivos TEXT
      );
      CREATE TABLE IF NOT EXISTS turmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
        designacao TEXT NOT NULL, ano_letivo TEXT NOT NULL,
        semestre INTEGER NOT NULL DEFAULT 1, sala TEXT, cor TEXT DEFAULT '#2E86C1'
      );
      CREATE TABLE IF NOT EXISTS horarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
        dia_semana INTEGER NOT NULL, hora_inicio TEXT NOT NULL, hora_fim TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS aulas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
        modulo_id INTEGER REFERENCES modulos(id),
        data DATE NOT NULL, hora_inicio TEXT NOT NULL, hora_fim TEXT NOT NULL,
        topico TEXT NOT NULL DEFAULT '', objetivos TEXT, conteudos TEXT,
        atividades TEXT, recursos TEXT, avaliacao TEXT, notas TEXT,
        estado TEXT DEFAULT 'Planeada',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS valores_hora (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
        turma_id INTEGER REFERENCES turmas(id),
        valor_hora REAL NOT NULL, ano_letivo TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS config_fiscal (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ano INTEGER NOT NULL UNIQUE,
        taxa_iva REAL DEFAULT 0.0, isento_iva BOOLEAN DEFAULT 0,
        taxa_retencao_irs REAL DEFAULT 0.25, sem_retencao BOOLEAN DEFAULT 0, notas TEXT
      );
      CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT);
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, entidade TEXT NOT NULL, entidade_id INTEGER,
        acao TEXT NOT NULL, descricao TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS dias_nao_letivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, data DATE NOT NULL UNIQUE,
        descricao TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT 'feriado'
      );
      CREATE TABLE IF NOT EXISTS instituicoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL,
        tipo TEXT DEFAULT 'universitária', contacto TEXT, notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cursos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE SET NULL,
        nome TEXT NOT NULL, tipo TEXT DEFAULT 'semestral', ano_letivo TEXT,
        valor_hora REAL, descricao TEXT, ativo INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
    // Configurações default
    const stmt = db.prepare('INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)')
    stmt.run('tema', 'light')
    stmt.run('nome_professor', '')
    stmt.run('instituicao', '')
    stmt.run('departamento', '')
    stmt.run('ano_letivo_atual', new Date().getFullYear() + '/' + (new Date().getFullYear() + 1))
  },

  // v1 — Colunas adicionais em aulas, disciplinas, horarios, turmas
  function v1_colunas_extra(db) {
    const addCol = (table, col, def) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
      if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
    }
    addCol('aulas', 'numero', 'INTEGER')
    addCol('aulas', 'data_avaliacao', 'DATE')
    addCol('aulas', 'sala', 'TEXT')
    addCol('disciplinas', 'curso_id', 'INTEGER REFERENCES cursos(id) ON DELETE SET NULL')
    addCol('horarios', 'sala', 'TEXT')
    addCol('turmas', 'data_inicio', 'DATE')
    addCol('turmas', 'data_fim', 'DATE')
    addCol('turmas', 'carga_horaria', 'INTEGER NOT NULL DEFAULT 0')
  },

  // v2 — Tabelas extra: outros_rendimentos, periodos_nao_letivos, professor_cargos
  function v2_tabelas_extra(db) {
    const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    if (!tabelas.includes('outros_rendimentos')) {
      db.exec(`CREATE TABLE outros_rendimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL,
        data DATE NOT NULL, tipo TEXT DEFAULT 'Outro', notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)
    }
    if (!tabelas.includes('periodos_nao_letivos')) {
      db.exec(`CREATE TABLE periodos_nao_letivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE CASCADE,
        descricao TEXT NOT NULL, data_inicio DATE NOT NULL, data_fim DATE NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'férias', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)
    }
    if (!tabelas.includes('professor_cargos')) {
      db.exec(`CREATE TABLE professor_cargos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE SET NULL,
        instituicao_nome TEXT NOT NULL, departamento TEXT, cargo TEXT,
        ativo INTEGER NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)
    }
  },

  // v3 — Semestre nullable + ano_letivo nullable (formação profissional)
  function v3_semestre_nullable(db) {
    const info = db.prepare(`PRAGMA table_info(turmas)`).all().find(c => c.name === 'semestre')
    if (info && info.notnull === 1) {
      const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name='turmas'").get()?.sql
      if (sql) {
        const newSql = sql
          .replace('semestre INTEGER NOT NULL DEFAULT 1', 'semestre INTEGER DEFAULT NULL')
          .replace('ano_letivo TEXT NOT NULL', 'ano_letivo TEXT')
          .replace('CREATE TABLE turmas', 'CREATE TABLE turmas_new')
        db.exec('PRAGMA foreign_keys=OFF;')
        db.exec(newSql)
        db.exec('INSERT INTO turmas_new SELECT * FROM turmas;')
        db.exec('DROP TABLE turmas;')
        db.exec('ALTER TABLE turmas_new RENAME TO turmas;')
        db.exec('PRAGMA foreign_keys=ON;')
      }
    }
  },
]

// ─── Runner ───────────────────────────────────────────────────────────────────

export function runMigrations() {
  const db = getDb()

  // Criar tabela de versão se não existir
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0)')
  const row = db.prepare('SELECT version FROM schema_version').get()
  let currentVersion = row?.version ?? -1

  if (!row) {
    // Primeira execução — verificar se as tabelas já existem (BD legada)
    const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    if (tabelas.includes('disciplinas')) {
      // BD existente sem schema_version — correr todas as migrações e marcar como actualizada
      for (let i = 0; i < MIGRATIONS.length; i++) {
        try { MIGRATIONS[i](db) } catch (e) { /* migração já aplicada, ignorar */ }
      }
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(MIGRATIONS.length - 1)
      return
    }
    // BD nova — inserir versão -1
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(-1)
    currentVersion = -1
  }

  // Correr migrações pendentes
  for (let i = currentVersion + 1; i < MIGRATIONS.length; i++) {
    try {
      MIGRATIONS[i](db)
      db.prepare('UPDATE schema_version SET version = ?').run(i)
    } catch (e) {
      console.error(`Migração v${i} falhou:`, e.message)
      // Tentar continuar — a migração pode já ter sido parcialmente aplicada
      db.prepare('UPDATE schema_version SET version = ?').run(i)
    }
  }
}
