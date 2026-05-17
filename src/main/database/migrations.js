import { getDb } from './db.js'

// ─── Sistema de Migrações com Versões ─────────────────────────────────────────
// Cada migração é uma função que recebe o `db` e faz as alterações necessárias.
// A versão actual é guardada na tabela `schema_version` (linha única, id=1).
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
    const info = db.prepare(`PRAGMA table_info(turmas)`).all()
    const semestreCol = info.find(c => c.name === 'semestre')
    const anoLetivoCol = info.find(c => c.name === 'ano_letivo')
    // Já nullable: nada a fazer
    if ((!semestreCol || semestreCol.notnull === 0) && (!anoLetivoCol || anoLetivoCol.notnull === 0)) return

    // Recriar a tabela com o esquema correcto, copiando dados pela intersecção de colunas
    db.exec('PRAGMA foreign_keys=OFF;')
    db.exec(`
      CREATE TABLE turmas_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
        designacao TEXT NOT NULL,
        ano_letivo TEXT,
        semestre INTEGER DEFAULT NULL,
        sala TEXT,
        cor TEXT DEFAULT '#2E86C1',
        data_inicio DATE,
        data_fim DATE,
        carga_horaria INTEGER NOT NULL DEFAULT 0
      )
    `)
    const colsAntigas = info.map(c => c.name)
    const colsNovas = ['id','disciplina_id','designacao','ano_letivo','semestre','sala','cor','data_inicio','data_fim','carga_horaria']
    const colsComuns = colsNovas.filter(c => colsAntigas.includes(c))
    db.exec(`INSERT INTO turmas_new (${colsComuns.join(',')}) SELECT ${colsComuns.join(',')} FROM turmas;`)
    db.exec('DROP TABLE turmas;')
    db.exec('ALTER TABLE turmas_new RENAME TO turmas;')
    db.exec('PRAGMA foreign_keys=ON;')
  },

  // v4 — Componente variável do valor/hora (Aprendizagem+ e similares)
  function v4_componente_variavel(db) {
    const addCol = (table, col, def) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
      if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
    }
    addCol('cursos', 'tem_componente_variavel', 'INTEGER NOT NULL DEFAULT 0')
    addCol('cursos', 'valor_hora_variavel', 'REAL')
    addCol('cursos', 'taxa_padrao', 'REAL DEFAULT 82')
  },

  // v5 — Pós-aula: sumário real e observações pós-aula
  function v5_pos_aula(db) {
    const addCol = (table, col, def) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
      if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
    }
    addCol('aulas', 'sumario', 'TEXT')
    addCol('aulas', 'observacoes_pos', 'TEXT')
  },
]

// ─── Runner ───────────────────────────────────────────────────────────────────

function garantirSchemaVersion(db) {
  // Cria a tabela schema_version com chave primária (linha única id=1).
  // Se já existir sem PK (versão antiga), faz upgrade preservando a versão máxima.
  const existe = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").get()
  if (!existe) {
    db.exec('CREATE TABLE schema_version (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL DEFAULT 0)')
    return
  }
  const info = db.prepare(`PRAGMA table_info(schema_version)`).all()
  const temPk = info.some(c => c.pk > 0)
  if (temPk) return

  const maxV = db.prepare('SELECT MAX(version) as v FROM schema_version').get()?.v
  db.exec('DROP TABLE schema_version;')
  db.exec('CREATE TABLE schema_version (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL DEFAULT 0)')
  if (maxV != null) db.prepare('INSERT INTO schema_version (id, version) VALUES (1, ?)').run(maxV)
}

export function runMigrations() {
  const db = getDb()

  garantirSchemaVersion(db)
  const row = db.prepare('SELECT version FROM schema_version WHERE id = 1').get()
  let currentVersion = row?.version ?? -1

  if (!row) {
    // Primeira execução — verificar se as tabelas já existem (BD legada)
    const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    if (tabelas.includes('disciplinas')) {
      // BD existente sem schema_version — correr todas as migrações e marcar como actualizada
      for (let i = 0; i < MIGRATIONS.length; i++) {
        try { MIGRATIONS[i](db) } catch (e) { /* migração já aplicada, ignorar */ }
      }
      db.prepare('INSERT INTO schema_version (id, version) VALUES (1, ?)').run(MIGRATIONS.length - 1)
      return
    }
    // BD nova — inserir versão -1
    db.prepare('INSERT INTO schema_version (id, version) VALUES (1, ?)').run(-1)
    currentVersion = -1
  }

  // Correr migrações pendentes
  for (let i = currentVersion + 1; i < MIGRATIONS.length; i++) {
    try {
      MIGRATIONS[i](db)
      db.prepare('UPDATE schema_version SET version = ? WHERE id = 1').run(i)
    } catch (e) {
      console.error(`Migração v${i} falhou:`, e.message)
      // NÃO marcar como aplicada — deixar pendente para nova tentativa no próximo arranque
      throw e
    }
  }
}
