import { getDb } from './db.js'

export function runMigrations() {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS disciplinas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      codigo TEXT UNIQUE,
      area_cientifica TEXT,
      carga_horaria INTEGER NOT NULL DEFAULT 0,
      ects REAL,
      tipo TEXT NOT NULL DEFAULT 'mista',
      descricao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS modulos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0,
      horas REAL,
      objetivos TEXT
    );

    CREATE TABLE IF NOT EXISTS turmas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
      designacao TEXT NOT NULL,
      ano_letivo TEXT NOT NULL,
      semestre INTEGER NOT NULL DEFAULT 1,
      sala TEXT,
      cor TEXT DEFAULT '#2E86C1'
    );

    CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
      dia_semana INTEGER NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS aulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
      modulo_id INTEGER REFERENCES modulos(id),
      data DATE NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT NOT NULL,
      topico TEXT NOT NULL DEFAULT '',
      objetivos TEXT,
      conteudos TEXT,
      atividades TEXT,
      recursos TEXT,
      avaliacao TEXT,
      notas TEXT,
      estado TEXT DEFAULT 'Planeada',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS valores_hora (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
      turma_id INTEGER REFERENCES turmas(id),
      valor_hora REAL NOT NULL,
      ano_letivo TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config_fiscal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ano INTEGER NOT NULL UNIQUE,
      taxa_iva REAL DEFAULT 0.0,
      isento_iva BOOLEAN DEFAULT 0,
      taxa_retencao_irs REAL DEFAULT 0.25,
      sem_retencao BOOLEAN DEFAULT 0,
      notas TEXT
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entidade TEXT NOT NULL,
      entidade_id INTEGER,
      acao TEXT NOT NULL,
      descricao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dias_nao_letivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data DATE NOT NULL UNIQUE,
      descricao TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL DEFAULT 'feriado'
    );

    CREATE TABLE IF NOT EXISTS instituicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      tipo TEXT DEFAULT 'universitária',
      contacto TEXT,
      notas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE SET NULL,
      nome TEXT NOT NULL,
      tipo TEXT DEFAULT 'semestral',
      ano_letivo TEXT,
      valor_hora REAL,
      descricao TEXT,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Migrações incrementais (colunas adicionadas após a versão inicial)
  const colunas = db.prepare(`PRAGMA table_info(aulas)`).all().map(c => c.name)
  if (!colunas.includes('numero')) {
    db.exec(`ALTER TABLE aulas ADD COLUMN numero INTEGER`)
  }
  if (!colunas.includes('data_avaliacao')) {
    db.exec(`ALTER TABLE aulas ADD COLUMN data_avaliacao DATE`)
  }

  const colunasDisciplinas = db.prepare(`PRAGMA table_info(disciplinas)`).all().map(c => c.name)
  if (!colunasDisciplinas.includes('curso_id')) {
    db.exec(`ALTER TABLE disciplinas ADD COLUMN curso_id INTEGER REFERENCES cursos(id) ON DELETE SET NULL`)
  }

  const colunasHorarios = db.prepare(`PRAGMA table_info(horarios)`).all().map(c => c.name)
  if (!colunasHorarios.includes('sala')) {
    db.exec(`ALTER TABLE horarios ADD COLUMN sala TEXT`)
  }

  const colunasAulas = db.prepare(`PRAGMA table_info(aulas)`).all().map(c => c.name)
  if (!colunasAulas.includes('sala')) {
    db.exec(`ALTER TABLE aulas ADD COLUMN sala TEXT`)
  }

  const colunasTurmas = db.prepare(`PRAGMA table_info(turmas)`).all().map(c => c.name)
  if (!colunasTurmas.includes('data_inicio')) {
    db.exec(`ALTER TABLE turmas ADD COLUMN data_inicio DATE`)
  }
  if (!colunasTurmas.includes('data_fim')) {
    db.exec(`ALTER TABLE turmas ADD COLUMN data_fim DATE`)
  }
  if (!colunasTurmas.includes('carga_horaria')) {
    db.exec(`ALTER TABLE turmas ADD COLUMN carga_horaria INTEGER NOT NULL DEFAULT 0`)
  }

  // Insert default configurations if not present
  const stmt = db.prepare(`INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)`)
  stmt.run('tema', 'light')
  stmt.run('nome_professor', '')
  stmt.run('instituicao', '')
  stmt.run('departamento', '')
  stmt.run('ano_letivo_atual', new Date().getFullYear() + '/' + (new Date().getFullYear() + 1))

  // Nova tabela: outros_rendimentos
  const tabelasExistentes = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
  if (!tabelasExistentes.includes('outros_rendimentos')) {
    db.exec(`
      CREATE TABLE outros_rendimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        data DATE NOT NULL,
        tipo TEXT DEFAULT 'Outro',
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  // Nova tabela: periodos_nao_letivos (intervalos de datas por instituição)
  if (!tabelasExistentes.includes('periodos_nao_letivos')) {
    db.exec(`
      CREATE TABLE periodos_nao_letivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE CASCADE,
        descricao TEXT NOT NULL,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'férias',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  // Nova tabela: professor_cargos (múltiplas instituições e cargos do professor)
  if (!tabelasExistentes.includes('professor_cargos')) {
    db.exec(`
      CREATE TABLE professor_cargos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE SET NULL,
        instituicao_nome TEXT NOT NULL,
        departamento TEXT,
        cargo TEXT,
        ativo INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }
}
