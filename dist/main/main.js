"use strict";
const electron = require("electron");
const path = require("path");
const url = require("url");
const Database = require("better-sqlite3");
const fs = require("fs");
let db = null;
function getDb() {
  if (!db) {
    const userDataPath = electron.app.getPath("userData");
    const dbPath = path.join(userDataPath, "planaula.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
function runMigrations() {
  const db2 = getDb();
  db2.exec(`
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
  `);
  const colunas = db2.prepare(`PRAGMA table_info(aulas)`).all().map((c) => c.name);
  if (!colunas.includes("numero")) {
    db2.exec(`ALTER TABLE aulas ADD COLUMN numero INTEGER`);
  }
  const colunasDisciplinas = db2.prepare(`PRAGMA table_info(disciplinas)`).all().map((c) => c.name);
  if (!colunasDisciplinas.includes("curso_id")) {
    db2.exec(`ALTER TABLE disciplinas ADD COLUMN curso_id INTEGER REFERENCES cursos(id) ON DELETE SET NULL`);
  }
  const colunasHorarios = db2.prepare(`PRAGMA table_info(horarios)`).all().map((c) => c.name);
  if (!colunasHorarios.includes("sala")) {
    db2.exec(`ALTER TABLE horarios ADD COLUMN sala TEXT`);
  }
  const colunasTurmas = db2.prepare(`PRAGMA table_info(turmas)`).all().map((c) => c.name);
  if (!colunasTurmas.includes("data_inicio")) {
    db2.exec(`ALTER TABLE turmas ADD COLUMN data_inicio DATE`);
  }
  if (!colunasTurmas.includes("data_fim")) {
    db2.exec(`ALTER TABLE turmas ADD COLUMN data_fim DATE`);
  }
  if (!colunasTurmas.includes("carga_horaria")) {
    db2.exec(`ALTER TABLE turmas ADD COLUMN carga_horaria INTEGER NOT NULL DEFAULT 0`);
  }
  const stmt = db2.prepare(`INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)`);
  stmt.run("tema", "light");
  stmt.run("nome_professor", "");
  stmt.run("instituicao", "");
  stmt.run("departamento", "");
  stmt.run("ano_letivo_atual", (/* @__PURE__ */ new Date()).getFullYear() + "/" + ((/* @__PURE__ */ new Date()).getFullYear() + 1));
  const tabelasExistentes = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  if (!tabelasExistentes.includes("outros_rendimentos")) {
    db2.exec(`
      CREATE TABLE outros_rendimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        data DATE NOT NULL,
        tipo TEXT DEFAULT 'Outro',
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  if (!tabelasExistentes.includes("periodos_nao_letivos")) {
    db2.exec(`
      CREATE TABLE periodos_nao_letivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE CASCADE,
        descricao TEXT NOT NULL,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'férias',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}
function criarDisciplina(dados) {
  const db2 = getDb();
  const stmt = db2.prepare(`
    INSERT INTO disciplinas (nome, codigo, area_cientifica, carga_horaria, ects, tipo, descricao, curso_id)
    VALUES (@nome, @codigo, @area_cientifica, @carga_horaria, @ects, @tipo, @descricao, @curso_id)
  `);
  const result = stmt.run({ ...dados, curso_id: dados.curso_id || null });
  return { id: result.lastInsertRowid, ...dados };
}
function listarDisciplinas() {
  const db2 = getDb();
  return db2.prepare(`
    SELECT d.*, c.nome as curso_nome, i.nome as instituicao_nome
    FROM disciplinas d
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    ORDER BY d.nome
  `).all();
}
function buscarDisciplina(id) {
  const db2 = getDb();
  return db2.prepare("SELECT * FROM disciplinas WHERE id = ?").get(id);
}
function editarDisciplina(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE disciplinas
    SET nome=@nome, codigo=@codigo, area_cientifica=@area_cientifica,
        carga_horaria=@carga_horaria, ects=@ects, tipo=@tipo, descricao=@descricao,
        curso_id=@curso_id, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...dados, curso_id: dados.curso_id || null, id });
  return buscarDisciplina(id);
}
function eliminarDisciplina(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM disciplinas WHERE id = ?").run(id);
  return { success: true };
}
function criarModulo(dados) {
  const db2 = getDb();
  const stmt = db2.prepare(`
    INSERT INTO modulos (disciplina_id, nome, ordem, horas, objetivos)
    VALUES (@disciplina_id, @nome, @ordem, @horas, @objetivos)
  `);
  const result = stmt.run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function listarModulos(disciplina_id) {
  const db2 = getDb();
  if (disciplina_id) {
    return db2.prepare("SELECT * FROM modulos WHERE disciplina_id = ? ORDER BY ordem").all(disciplina_id);
  }
  return db2.prepare("SELECT * FROM modulos ORDER BY disciplina_id, ordem").all();
}
function editarModulo(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE modulos SET nome=@nome, ordem=@ordem, horas=@horas, objetivos=@objetivos WHERE id=@id
  `).run({ ...dados, id });
  return db2.prepare("SELECT * FROM modulos WHERE id = ?").get(id);
}
function eliminarModulo(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM modulos WHERE id = ?").run(id);
  return { success: true };
}
function criarTurma(dados) {
  const db2 = getDb();
  const stmt = db2.prepare(`
    INSERT INTO turmas (disciplina_id, designacao, ano_letivo, semestre, sala, cor, data_inicio, data_fim, carga_horaria)
    VALUES (@disciplina_id, @designacao, @ano_letivo, @semestre, @sala, @cor, @data_inicio, @data_fim, @carga_horaria)
  `);
  const result = stmt.run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function listarTurmas(disciplina_id) {
  const db2 = getDb();
  if (disciplina_id) {
    return db2.prepare(`
      SELECT t.*, d.nome as disciplina_nome FROM turmas t
      JOIN disciplinas d ON d.id = t.disciplina_id
      WHERE t.disciplina_id = ?
      ORDER BY t.ano_letivo DESC, t.designacao
    `).all(disciplina_id);
  }
  return db2.prepare(`
    SELECT t.*, d.nome as disciplina_nome FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    ORDER BY d.nome, t.ano_letivo DESC, t.designacao
  `).all();
}
function buscarTurma(id) {
  const db2 = getDb();
  return db2.prepare(`
    SELECT t.*, d.nome as disciplina_nome FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE t.id = ?
  `).get(id);
}
function editarTurma(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE turmas SET disciplina_id=@disciplina_id, designacao=@designacao,
      ano_letivo=@ano_letivo, semestre=@semestre, sala=@sala, cor=@cor,
      data_inicio=@data_inicio, data_fim=@data_fim, carga_horaria=@carga_horaria
    WHERE id=@id
  `).run({ ...dados, id });
  return buscarTurma(id);
}
function eliminarTurma(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM turmas WHERE id = ?").run(id);
  return { success: true };
}
function criarHorario(dados) {
  const db2 = getDb();
  const stmt = db2.prepare(`
    INSERT INTO horarios (turma_id, dia_semana, hora_inicio, hora_fim, sala)
    VALUES (@turma_id, @dia_semana, @hora_inicio, @hora_fim, @sala)
  `);
  const result = stmt.run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function listarHorarios(turma_id) {
  const db2 = getDb();
  if (turma_id) {
    return db2.prepare("SELECT * FROM horarios WHERE turma_id = ? ORDER BY dia_semana, hora_inicio").all(turma_id);
  }
  return db2.prepare("SELECT * FROM horarios ORDER BY turma_id, dia_semana, hora_inicio").all();
}
function editarHorario(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE horarios SET dia_semana=@dia_semana, hora_inicio=@hora_inicio, hora_fim=@hora_fim, sala=@sala WHERE id=@id
  `).run({ ...dados, id });
  return db2.prepare("SELECT * FROM horarios WHERE id = ?").get(id);
}
function eliminarHorario(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM horarios WHERE id = ?").run(id);
  return { success: true };
}
function eliminarHorariosDaTurma(turma_id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM horarios WHERE turma_id = ?").run(turma_id);
  return { success: true };
}
function proximoNumeroAula(turma_id) {
  const db2 = getDb();
  const row = db2.prepare("SELECT MAX(numero) as max FROM aulas WHERE turma_id = ?").get(turma_id);
  return (row?.max || 0) + 1;
}
function criarAula(dados) {
  const db2 = getDb();
  const numero = dados.numero != null ? dados.numero : proximoNumeroAula(dados.turma_id);
  const stmt = db2.prepare(`
    INSERT INTO aulas (turma_id, modulo_id, data, hora_inicio, hora_fim, topico,
      objetivos, conteudos, atividades, recursos, avaliacao, notas, estado, numero)
    VALUES (@turma_id, @modulo_id, @data, @hora_inicio, @hora_fim, @topico,
      @objetivos, @conteudos, @atividades, @recursos, @avaliacao, @notas, @estado, @numero)
  `);
  const result = stmt.run({ ...dados, numero });
  return { id: result.lastInsertRowid, ...dados, numero };
}
function listarAulas(filtros = {}) {
  const db2 = getDb();
  let query = `
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.id as disciplina_id,
           m.nome as modulo_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN modulos m ON m.id = a.modulo_id
    WHERE 1=1
  `;
  const params = [];
  if (filtros.turma_id) {
    query += " AND a.turma_id = ?";
    params.push(filtros.turma_id);
  }
  if (filtros.disciplina_id) {
    query += " AND d.id = ?";
    params.push(filtros.disciplina_id);
  }
  if (filtros.data_inicio) {
    query += " AND a.data >= ?";
    params.push(filtros.data_inicio);
  }
  if (filtros.data_fim) {
    query += " AND a.data <= ?";
    params.push(filtros.data_fim);
  }
  if (filtros.estado) {
    query += " AND a.estado = ?";
    params.push(filtros.estado);
  }
  if (filtros.mes) {
    query += " AND strftime('%Y-%m', a.data) = ?";
    params.push(filtros.mes);
  }
  query += " ORDER BY a.data, a.hora_inicio";
  return db2.prepare(query).all(...params);
}
function buscarAula(id) {
  const db2 = getDb();
  return db2.prepare(`
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.id as disciplina_id,
           m.nome as modulo_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN modulos m ON m.id = a.modulo_id
    WHERE a.id = ?
  `).get(id);
}
function editarAula(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE aulas SET turma_id=@turma_id, modulo_id=@modulo_id, data=@data,
      hora_inicio=@hora_inicio, hora_fim=@hora_fim, topico=@topico,
      objetivos=@objetivos, conteudos=@conteudos, atividades=@atividades,
      recursos=@recursos, avaliacao=@avaliacao, notas=@notas, estado=@estado,
      numero=COALESCE(@numero, numero),
      updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...dados, numero: dados.numero ?? null, id });
  return buscarAula(id);
}
function eliminarAula(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM aulas WHERE id = ?").run(id);
  return { success: true };
}
function eliminarAulasDaDisciplina(disciplina_id) {
  const db2 = getDb();
  const info = db2.prepare(`
    DELETE FROM aulas WHERE turma_id IN (
      SELECT id FROM turmas WHERE disciplina_id = ?
    )
  `).run(disciplina_id);
  return { success: true, eliminadas: info.changes };
}
function gerarAulasAutomatico(turma_id, data_inicio, data_fim) {
  const db2 = getDb();
  const turma = buscarTurma(turma_id);
  if (!turma) throw new Error("Turma não encontrada");
  const horarios = listarHorarios(turma_id);
  if (!horarios.length) throw new Error("Sem horários definidos para esta turma");
  const carga_horaria = turma.carga_horaria || 0;
  const rowExistentes = db2.prepare(`
    SELECT COALESCE(SUM(
      (CAST(substr(hora_fim,1,2) AS INTEGER)*60 + CAST(substr(hora_fim,4,2) AS INTEGER)) -
      (CAST(substr(hora_inicio,1,2) AS INTEGER)*60 + CAST(substr(hora_inicio,4,2) AS INTEGER))
    ), 0) as total_min
    FROM aulas WHERE turma_id = ? AND estado != 'Cancelada'
  `).get(turma_id);
  const horas_existentes = (rowExistentes?.total_min || 0) / 60;
  function slotHoras(h) {
    const [hi, mi] = h.hora_inicio.split(":").map(Number);
    const [hf, mf] = h.hora_fim.split(":").map(Number);
    return (hf * 60 + mf - hi * 60 - mi) / 60;
  }
  const diasNaoLetivos = new Set(
    db2.prepare("SELECT data FROM dias_nao_letivos WHERE data >= ? AND data <= ?").all(data_inicio, data_fim).map((r) => r.data)
  );
  const disc = db2.prepare("SELECT curso_id FROM disciplinas WHERE id = ?").get(turma.disciplina_id);
  const instId = disc?.curso_id ? db2.prepare("SELECT instituicao_id FROM cursos WHERE id = ?").get(disc.curso_id)?.instituicao_id : null;
  const periodos = db2.prepare(`
    SELECT data_inicio, data_fim FROM periodos_nao_letivos
    WHERE (data_fim >= ? AND data_inicio <= ?)
      AND (instituicao_id IS NULL ${instId ? "OR instituicao_id = ?" : ""})
  `).all(...instId ? [data_inicio, data_fim, instId] : [data_inicio, data_fim]);
  for (const p of periodos) {
    const cur = new Date(Math.max(new Date(p.data_inicio), new Date(data_inicio)));
    const fim = new Date(Math.min(new Date(p.data_fim), new Date(data_fim)));
    while (cur <= fim) {
      const y = cur.getUTCFullYear(), m = String(cur.getUTCMonth() + 1).padStart(2, "0"), d = String(cur.getUTCDate()).padStart(2, "0");
      diasNaoLetivos.add(`${y}-${m}-${d}`);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  const start = new Date(data_inicio);
  const end = new Date(data_fim);
  const aulas = [];
  let horas_geradas = 0;
  let parar = false;
  const current = new Date(start);
  while (current <= end && !parar) {
    const y = current.getUTCFullYear(), mo = String(current.getUTCMonth() + 1).padStart(2, "0"), d = String(current.getUTCDate()).padStart(2, "0");
    const dataStr = `${y}-${mo}-${d}`;
    if (!diasNaoLetivos.has(dataStr)) {
      const diaSemana = current.getUTCDay();
      const horariosHoje = horarios.filter((h) => parseInt(h.dia_semana) === diaSemana);
      for (const h of horariosHoje) {
        const duracaoSlot = slotHoras(h);
        if (carga_horaria > 0 && horas_existentes + horas_geradas + duracaoSlot > carga_horaria) {
          parar = true;
          break;
        }
        const existente = db2.prepare(
          "SELECT id FROM aulas WHERE turma_id=? AND data=? AND hora_inicio=?"
        ).get(turma_id, dataStr, h.hora_inicio);
        if (!existente) {
          const a = criarAula({
            turma_id,
            modulo_id: null,
            data: dataStr,
            hora_inicio: h.hora_inicio,
            hora_fim: h.hora_fim,
            topico: "",
            objetivos: null,
            conteudos: null,
            atividades: null,
            recursos: null,
            avaliacao: null,
            notas: null,
            estado: "Planeada"
          });
          aulas.push(a);
          horas_geradas += duracaoSlot;
          if (carga_horaria > 0 && horas_existentes + horas_geradas >= carga_horaria) {
            parar = true;
            break;
          }
        }
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  const limite_atingido = carga_horaria > 0 && horas_existentes + horas_geradas >= carga_horaria;
  return { aulas, horas_geradas, horas_existentes, carga_horaria, limite_atingido };
}
function criarInstituicao(dados) {
  const db2 = getDb();
  const result = db2.prepare(`
    INSERT INTO instituicoes (nome, tipo, contacto, notas)
    VALUES (@nome, @tipo, @contacto, @notas)
  `).run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function listarInstituicoes() {
  const db2 = getDb();
  return db2.prepare("SELECT * FROM instituicoes ORDER BY nome").all();
}
function editarInstituicao(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE instituicoes SET nome=@nome, tipo=@tipo, contacto=@contacto, notas=@notas WHERE id=@id
  `).run({ ...dados, id });
  return db2.prepare("SELECT * FROM instituicoes WHERE id = ?").get(id);
}
function eliminarInstituicao(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM instituicoes WHERE id = ?").run(id);
  return { success: true };
}
function criarCurso(dados) {
  const db2 = getDb();
  const result = db2.prepare(`
    INSERT INTO cursos (instituicao_id, nome, tipo, ano_letivo, valor_hora, descricao, ativo)
    VALUES (@instituicao_id, @nome, @tipo, @ano_letivo, @valor_hora, @descricao, @ativo)
  `).run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function listarCursos(instituicao_id) {
  const db2 = getDb();
  if (instituicao_id) {
    return db2.prepare(`
      SELECT c.*, i.nome as instituicao_nome
      FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id
      WHERE c.instituicao_id = ? ORDER BY c.nome
    `).all(instituicao_id);
  }
  return db2.prepare(`
    SELECT c.*, i.nome as instituicao_nome
    FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    ORDER BY i.nome, c.nome
  `).all();
}
function editarCurso(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE cursos SET instituicao_id=@instituicao_id, nome=@nome, tipo=@tipo,
      ano_letivo=@ano_letivo, valor_hora=@valor_hora, descricao=@descricao, ativo=@ativo
    WHERE id=@id
  `).run({ ...dados, id });
  return db2.prepare(`
    SELECT c.*, i.nome as instituicao_nome
    FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id WHERE c.id = ?
  `).get(id);
}
function eliminarCurso(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM cursos WHERE id = ?").run(id);
  return { success: true };
}
function listarDiasNaoLetivos(ano) {
  const db2 = getDb();
  if (ano) {
    return db2.prepare("SELECT * FROM dias_nao_letivos WHERE strftime('%Y', data) = ? ORDER BY data").all(String(ano));
  }
  return db2.prepare("SELECT * FROM dias_nao_letivos ORDER BY data").all();
}
function criarDiaNaoLetivo(dados) {
  const db2 = getDb();
  const stmt = db2.prepare(`
    INSERT INTO dias_nao_letivos (data, descricao, tipo)
    VALUES (@data, @descricao, @tipo)
    ON CONFLICT(data) DO UPDATE SET descricao=@descricao, tipo=@tipo
  `);
  const result = stmt.run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function eliminarDiaNaoLetivo(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM dias_nao_letivos WHERE id = ?").run(id);
  return { success: true };
}
function importarFeriadosNacionais(ano) {
  const fixos = [
    { mes: 1, dia: 1, desc: "Ano Novo" },
    { mes: 4, dia: 25, desc: "Dia da Liberdade" },
    { mes: 5, dia: 1, desc: "Dia do Trabalhador" },
    { mes: 6, dia: 10, desc: "Dia de Portugal" },
    { mes: 8, dia: 15, desc: "Assunção de Nossa Senhora" },
    { mes: 10, dia: 5, desc: "Implantação da República" },
    { mes: 11, dia: 1, desc: "Dia de Todos os Santos" },
    { mes: 12, dia: 1, desc: "Restauração da Independência" },
    { mes: 12, dia: 8, desc: "Imaculada Conceição" },
    { mes: 12, dia: 25, desc: "Natal" }
  ];
  function calcularPascoa(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = (h + l - 7 * m + 114) % 31 + 1;
    return new Date(y, month - 1, day);
  }
  const pascoa = calcularPascoa(ano);
  const sextaFeira = new Date(pascoa);
  sextaFeira.setDate(pascoa.getDate() - 2);
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(pascoa.getDate() + 60);
  const moveis = [
    { data: sextaFeira, desc: "Sexta-feira Santa" },
    { data: pascoa, desc: "Páscoa" },
    { data: corpusChristi, desc: "Corpo de Deus" }
  ];
  const criados = [];
  for (const f of fixos) {
    const data = `${ano}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`;
    criados.push(criarDiaNaoLetivo({ data, descricao: f.desc, tipo: "feriado" }));
  }
  for (const m of moveis) {
    const data = m.data.toISOString().split("T")[0];
    criados.push(criarDiaNaoLetivo({ data, descricao: m.desc, tipo: "feriado" }));
  }
  return criados;
}
function criarValorHora(dados) {
  const db2 = getDb();
  const stmt = db2.prepare(`
    INSERT OR REPLACE INTO valores_hora (disciplina_id, turma_id, valor_hora, ano_letivo)
    VALUES (@disciplina_id, @turma_id, @valor_hora, @ano_letivo)
  `);
  const result = stmt.run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function listarValoresHora(ano_letivo) {
  const db2 = getDb();
  if (ano_letivo) {
    return db2.prepare(`
      SELECT vh.*, d.nome as disciplina_nome, t.designacao as turma_nome
      FROM valores_hora vh
      JOIN disciplinas d ON d.id = vh.disciplina_id
      LEFT JOIN turmas t ON t.id = vh.turma_id
      WHERE vh.ano_letivo = ?
    `).all(ano_letivo);
  }
  return db2.prepare(`
    SELECT vh.*, d.nome as disciplina_nome, t.designacao as turma_nome
    FROM valores_hora vh
    JOIN disciplinas d ON d.id = vh.disciplina_id
    LEFT JOIN turmas t ON t.id = vh.turma_id
  `).all();
}
function calcularFinanceiroMensal(ano, mes) {
  const db2 = getDb();
  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;
  const aulas = db2.prepare(`
    SELECT a.*, t.disciplina_id, t.designacao as turma_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    WHERE strftime('%Y-%m', a.data) = ? AND a.estado != 'Cancelada'
  `).all(mesStr);
  const configFiscal = db2.prepare("SELECT * FROM config_fiscal WHERE ano = ?").get(ano);
  const taxa_iva = configFiscal?.isento_iva ? 0 : configFiscal?.taxa_iva || 0;
  const taxa_irs = configFiscal?.sem_retencao ? 0 : configFiscal?.taxa_retencao_irs || 0.25;
  const porDisciplina = {};
  for (const aula of aulas) {
    let valorHora = db2.prepare(`
      SELECT valor_hora FROM valores_hora
      WHERE disciplina_id = ? AND (turma_id = ? OR turma_id IS NULL)
      ORDER BY turma_id DESC NULLS LAST
      LIMIT 1
    `).get(aula.disciplina_id, aula.turma_id)?.valor_hora;
    if (valorHora == null) {
      const disc = db2.prepare("SELECT curso_id FROM disciplinas WHERE id = ?").get(aula.disciplina_id);
      if (disc?.curso_id) {
        const curso = db2.prepare("SELECT valor_hora FROM cursos WHERE id = ?").get(disc.curso_id);
        valorHora = curso?.valor_hora;
      }
    }
    if (valorHora == null) continue;
    const inicio = aula.hora_inicio.split(":");
    const fim = aula.hora_fim.split(":");
    const horas = (parseInt(fim[0]) * 60 + parseInt(fim[1]) - parseInt(inicio[0]) * 60 - parseInt(inicio[1])) / 60;
    if (!porDisciplina[aula.disciplina_id]) {
      const disc = db2.prepare(`
        SELECT d.nome, d.curso_id, c.nome as curso_nome
        FROM disciplinas d LEFT JOIN cursos c ON c.id = d.curso_id WHERE d.id = ?
      `).get(aula.disciplina_id);
      porDisciplina[aula.disciplina_id] = {
        disciplina_id: aula.disciplina_id,
        disciplina_nome: disc?.nome || "Desconhecida",
        curso_nome: disc?.curso_nome || null,
        total_horas: 0,
        valor_hora: valorHora,
        valor_bruto: 0
      };
    }
    porDisciplina[aula.disciplina_id].total_horas += horas;
    porDisciplina[aula.disciplina_id].valor_bruto += horas * valorHora;
  }
  const outrosRendimentos = db2.prepare(
    "SELECT * FROM outros_rendimentos WHERE strftime('%Y-%m', data) = ? ORDER BY data"
  ).all(mesStr);
  const total_outros_bruto = outrosRendimentos.reduce((s, r) => s + r.valor, 0);
  const itens = Object.values(porDisciplina);
  const total_bruto_aulas = itens.reduce((s, i) => s + i.valor_bruto, 0);
  const total_bruto = total_bruto_aulas + total_outros_bruto;
  const total_iva = total_bruto * taxa_iva;
  const total_com_iva = total_bruto + total_iva;
  const total_irs = total_bruto * taxa_irs;
  const total_liquido = total_com_iva - total_irs;
  const total_horas = itens.reduce((s, i) => s + i.total_horas, 0);
  return {
    mes: mesStr,
    itens,
    outros: outrosRendimentos,
    total_horas,
    total_bruto,
    total_outros_bruto,
    taxa_iva,
    total_iva,
    total_com_iva,
    taxa_irs,
    total_irs,
    total_liquido
  };
}
function calcularFinanceiroAnual(ano) {
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    meses.push(calcularFinanceiroMensal(ano, m));
  }
  return meses;
}
function obterConfigFiscal(ano) {
  const db2 = getDb();
  return db2.prepare("SELECT * FROM config_fiscal WHERE ano = ?").get(ano) || {
    ano,
    taxa_iva: 0,
    isento_iva: 0,
    taxa_retencao_irs: 0.25,
    sem_retencao: 0,
    notas: ""
  };
}
function salvarConfigFiscal(dados) {
  const db2 = getDb();
  db2.prepare(`
    INSERT INTO config_fiscal (ano, taxa_iva, isento_iva, taxa_retencao_irs, sem_retencao, notas)
    VALUES (@ano, @taxa_iva, @isento_iva, @taxa_retencao_irs, @sem_retencao, @notas)
    ON CONFLICT(ano) DO UPDATE SET
      taxa_iva=@taxa_iva, isento_iva=@isento_iva,
      taxa_retencao_irs=@taxa_retencao_irs, sem_retencao=@sem_retencao, notas=@notas
  `).run(dados);
  return obterConfigFiscal(dados.ano);
}
function obterConfiguracao(chave) {
  const db2 = getDb();
  const row = db2.prepare("SELECT valor FROM configuracoes WHERE chave = ?").get(chave);
  return row ? row.valor : null;
}
function obterTodasConfiguracoes() {
  const db2 = getDb();
  const rows = db2.prepare("SELECT * FROM configuracoes").all();
  const config = {};
  for (const row of rows) config[row.chave] = row.valor;
  return config;
}
function salvarConfiguracao(chave, valor) {
  const db2 = getDb();
  db2.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)").run(chave, valor);
  return { chave, valor };
}
function salvarConfiguracoes(pares) {
  const db2 = getDb();
  const stmt = db2.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)");
  const transaction = db2.transaction(() => {
    for (const [chave, valor] of Object.entries(pares)) {
      stmt.run(chave, valor);
    }
  });
  transaction();
  return { success: true };
}
function criarOutroRendimento(dados) {
  const db2 = getDb();
  const result = db2.prepare(`
    INSERT INTO outros_rendimentos (descricao, valor, data, tipo, notas)
    VALUES (@descricao, @valor, @data, @tipo, @notas)
  `).run(dados);
  return { id: result.lastInsertRowid, ...dados };
}
function listarOutrosRendimentos(filtros = {}) {
  const db2 = getDb();
  let query = "SELECT * FROM outros_rendimentos WHERE 1=1";
  const params = [];
  if (filtros.ano) {
    query += " AND strftime('%Y', data) = ?";
    params.push(String(filtros.ano));
  }
  if (filtros.mes) {
    query += " AND strftime('%Y-%m', data) = ?";
    params.push(filtros.mes);
  }
  query += " ORDER BY data DESC";
  return db2.prepare(query).all(...params);
}
function editarOutroRendimento(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE outros_rendimentos SET descricao=@descricao, valor=@valor, data=@data, tipo=@tipo, notas=@notas WHERE id=@id
  `).run({ ...dados, id });
  return db2.prepare("SELECT * FROM outros_rendimentos WHERE id = ?").get(id);
}
function eliminarOutroRendimento(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM outros_rendimentos WHERE id = ?").run(id);
  return { success: true };
}
function listarPeriodosNaoLetivos(instituicao_id) {
  const db2 = getDb();
  if (instituicao_id) {
    return db2.prepare(`
      SELECT p.*, i.nome as instituicao_nome
      FROM periodos_nao_letivos p
      LEFT JOIN instituicoes i ON i.id = p.instituicao_id
      WHERE p.instituicao_id = ? OR p.instituicao_id IS NULL
      ORDER BY p.data_inicio
    `).all(instituicao_id);
  }
  return db2.prepare(`
    SELECT p.*, i.nome as instituicao_nome
    FROM periodos_nao_letivos p
    LEFT JOIN instituicoes i ON i.id = p.instituicao_id
    ORDER BY p.data_inicio
  `).all();
}
function criarPeriodoNaoLetivo(dados) {
  const db2 = getDb();
  const result = db2.prepare(`
    INSERT INTO periodos_nao_letivos (instituicao_id, descricao, data_inicio, data_fim, tipo)
    VALUES (@instituicao_id, @descricao, @data_inicio, @data_fim, @tipo)
  `).run({ ...dados, instituicao_id: dados.instituicao_id || null });
  return db2.prepare(`
    SELECT p.*, i.nome as instituicao_nome
    FROM periodos_nao_letivos p LEFT JOIN instituicoes i ON i.id = p.instituicao_id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);
}
function eliminarPeriodoNaoLetivo(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM periodos_nao_letivos WHERE id = ?").run(id);
  return { success: true };
}
function obterEstatisticas(ano_letivo) {
  const db2 = getDb();
  const anoAtual = ano_letivo || (/* @__PURE__ */ new Date()).getFullYear();
  const [anoInicio] = String(anoAtual).split("/");
  const porEstado = db2.prepare(`
    SELECT estado, COUNT(*) as total FROM aulas
    WHERE strftime('%Y', data) = ?
    GROUP BY estado
  `).all(String(anoInicio));
  const porDisciplina = db2.prepare(`
    SELECT d.nome as disciplina_nome,
           COUNT(a.id) as total_aulas,
           SUM((strftime('%H', a.hora_fim) * 60 + strftime('%M', a.hora_fim) -
                strftime('%H', a.hora_inicio) * 60 - strftime('%M', a.hora_inicio)) / 60.0) as total_horas
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y', a.data) = ? AND a.estado != 'Cancelada'
    GROUP BY d.id
    ORDER BY total_horas DESC
  `).all(String(anoInicio));
  const evolucaoMensal = db2.prepare(`
    SELECT strftime('%Y-%m', data) as mes, COUNT(*) as total_aulas,
           SUM((strftime('%H', hora_fim) * 60 + strftime('%M', hora_fim) -
                strftime('%H', hora_inicio) * 60 - strftime('%M', hora_inicio)) / 60.0) as total_horas
    FROM aulas
    WHERE strftime('%Y', data) = ? AND estado != 'Cancelada'
    GROUP BY mes
    ORDER BY mes
  `).all(String(anoInicio));
  const totalAulas = porEstado.reduce((s, r) => s + r.total, 0);
  const realizadas = porEstado.find((r) => r.estado === "Realizada")?.total || 0;
  const taxaConclusao = totalAulas > 0 ? (realizadas / totalAulas * 100).toFixed(1) : 0;
  return { porEstado, porDisciplina, evolucaoMensal, totalAulas, realizadas, taxaConclusao };
}
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function formatCur(v) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v || 0);
}
function gerarHTMLPlanoAula(aula, config = {}) {
  const dataFmt = aula.data ? (/* @__PURE__ */ new Date(aula.data + "T12:00:00")).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const secao = (titulo, conteudo) => conteudo ? `<div class="secao"><div class="secao-titulo">${titulo}</div><div class="secao-corpo">${conteudo.replace(/\n/g, "<br>")}</div></div>` : "";
  const estadoCor = { Realizada: "#16a34a", Planeada: "#2563eb", Adiada: "#ca8a04", Cancelada: "#dc2626" };
  const cor = estadoCor[aula.estado] || "#2563eb";
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1f2937; background: white; padding: 32px; }
  .cabecalho { border-bottom: 3px solid ${aula.turma_cor || "#2563eb"}; padding-bottom: 16px; margin-bottom: 20px; }
  .cabecalho h1 { font-size: 18pt; font-weight: 700; color: #111827; }
  .cabecalho h2 { font-size: 13pt; color: #4b5563; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; background: #f9fafb; border-radius: 8px; padding: 14px; }
  .meta-item label { font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; display: block; }
  .meta-item span { font-weight: 600; color: #111827; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 9pt; font-weight: 600; color: white; background: ${cor}; }
  .secao { margin-bottom: 16px; }
  .secao-titulo { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
  .secao-corpo { font-size: 11pt; line-height: 1.6; color: #374151; }
  .rodape { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9pt; color: #9ca3af; display: flex; justify-content: space-between; }
  ${config.instituicao ? ".inst { font-size: 10pt; color: #6b7280; margin-bottom: 4px; }" : ""}
</style></head><body>
  <div class="cabecalho">
    ${config.instituicao ? `<div class="inst">${config.instituicao}${config.departamento ? " · " + config.departamento : ""}</div>` : ""}
    <h1>Plano de Aula</h1>
    <h2>${aula.disciplina_nome || ""} ${aula.turma_nome ? "— " + aula.turma_nome : ""}</h2>
  </div>
  <div class="meta">
    ${aula.numero != null ? `<div class="meta-item"><label>Nº Aula</label><span>${aula.numero}</span></div>` : ""}
    <div class="meta-item"><label>Data</label><span>${dataFmt}</span></div>
    <div class="meta-item"><label>Horário</label><span>${aula.hora_inicio || ""} – ${aula.hora_fim || ""}</span></div>
    ${aula.modulo_nome ? `<div class="meta-item"><label>Módulo</label><span>${aula.modulo_nome}</span></div>` : ""}
    <div class="meta-item"><label>Estado</label><span class="badge">${aula.estado || ""}</span></div>
  </div>
  ${aula.topico ? `<div class="secao"><div class="secao-titulo">Tópico</div><div class="secao-corpo" style="font-size:13pt;font-weight:600;color:#111827">${aula.topico}</div></div>` : ""}
  ${secao("Objetivos", aula.objetivos)}
  ${secao("Conteúdos", aula.conteudos)}
  ${secao("Atividades", aula.atividades)}
  ${secao("Recursos", aula.recursos)}
  ${secao("Avaliação", aula.avaliacao)}
  ${secao("Notas", aula.notas)}
  <div class="rodape">
    <span>${config.nome_professor || ""}</span>
    <span>PlanAula · ${(/* @__PURE__ */ new Date()).toLocaleDateString("pt-PT")}</span>
  </div>
</body></html>`;
}
function gerarHTMLRelatorioFinanceiro(dados, tipo, ano, mes, config = {}) {
  const titulo = tipo === "mensal" ? `Relatório Financeiro — ${MESES_PT[mes - 1]} ${ano}` : `Relatório Financeiro Anual — ${ano}`;
  const linhasItens = (dados.itens || []).map((item) => `
    <tr>
      <td>${item.disciplina_nome}</td>
      <td class="num">${item.total_horas.toFixed(1)}h</td>
      <td class="num">${formatCur(item.valor_hora)}</td>
      <td class="num">${formatCur(item.valor_bruto)}</td>
    </tr>`).join("");
  const linhasMensais = Array.isArray(dados) ? dados.map((m, i) => `
    <tr>
      <td>${MESES_PT[i]}</td>
      <td class="num">${m.total_horas.toFixed(1)}h</td>
      <td class="num">${formatCur(m.total_bruto)}</td>
      <td class="num red">-${formatCur(m.total_irs)}</td>
      <td class="num green">${formatCur(m.total_liquido)}</td>
    </tr>`).join("") : "";
  const totAnual = Array.isArray(dados) ? {
    horas: dados.reduce((s, m) => s + (m.total_horas || 0), 0),
    bruto: dados.reduce((s, m) => s + (m.total_bruto || 0), 0),
    irs: dados.reduce((s, m) => s + (m.total_irs || 0), 0),
    liquido: dados.reduce((s, m) => s + (m.total_liquido || 0), 0)
  } : null;
  const mensal = !Array.isArray(dados) ? dados : null;
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11pt; color:#1f2937; background:white; padding:32px; }
  .cab { border-bottom:3px solid #2563eb; padding-bottom:14px; margin-bottom:20px; }
  .cab h1 { font-size:17pt; font-weight:700; color:#111827; }
  .cab p { color:#6b7280; margin-top:4px; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .card { background:#f9fafb; border-radius:8px; padding:14px; text-align:center; }
  .card .v { font-size:16pt; font-weight:700; }
  .card .l { font-size:9pt; color:#6b7280; margin-top:4px; }
  .blue { color:#2563eb; } .green { color:#16a34a; } .red { color:#dc2626; } .gray { color:#374151; }
  table { width:100%; border-collapse:collapse; font-size:10pt; }
  th { text-align:left; padding:8px; border-bottom:2px solid #e5e7eb; color:#6b7280; font-weight:600; text-transform:uppercase; font-size:9pt; letter-spacing:.04em; }
  th.num, td.num { text-align:right; }
  td { padding:8px; border-bottom:1px solid #f3f4f6; }
  tr:hover td { background:#f9fafb; }
  .totais td { font-weight:700; border-top:2px solid #d1d5db; border-bottom:none; }
  .rodape { margin-top:28px; border-top:1px solid #e5e7eb; padding-top:10px; font-size:9pt; color:#9ca3af; display:flex; justify-content:space-between; }
  h2 { font-size:12pt; margin-bottom:12px; color:#374151; }
</style></head><body>
  <div class="cab">
    ${config.instituicao ? `<p>${config.instituicao}${config.departamento ? " · " + config.departamento : ""}</p>` : ""}
    <h1>${titulo}</h1>
    ${config.nome_professor ? `<p>${config.nome_professor}</p>` : ""}
  </div>
  ${mensal ? `
  <div class="cards">
    <div class="card"><div class="v blue">${mensal.total_horas.toFixed(1)}h</div><div class="l">Total Horas</div></div>
    <div class="card"><div class="v gray">${formatCur(mensal.total_bruto)}</div><div class="l">Valor Bruto</div></div>
    <div class="card"><div class="v red">-${formatCur(mensal.total_irs)}</div><div class="l">Retenção IRS (${((mensal.taxa_irs || 0) * 100).toFixed(0)}%)</div></div>
    <div class="card"><div class="v green">${formatCur(mensal.total_liquido)}</div><div class="l">Valor Líquido</div></div>
  </div>
  <h2>Detalhe por Disciplina</h2>
  <table>
    <thead><tr><th>Disciplina</th><th class="num">Horas</th><th class="num">€/Hora</th><th class="num">Valor Bruto</th></tr></thead>
    <tbody>${linhasItens}</tbody>
    <tfoot>
      <tr class="totais"><td colspan="3">Total Bruto</td><td class="num">${formatCur(mensal.total_bruto)}</td></tr>
      ${mensal.taxa_iva > 0 ? `<tr><td colspan="3">IVA (${((mensal.taxa_iva || 0) * 100).toFixed(0)}%)</td><td class="num green">+${formatCur(mensal.total_iva)}</td></tr>` : ""}
      <tr><td colspan="3">Retenção IRS (${((mensal.taxa_irs || 0) * 100).toFixed(0)}%)</td><td class="num red">-${formatCur(mensal.total_irs)}</td></tr>
      <tr class="totais"><td colspan="3" class="blue">Valor Líquido</td><td class="num blue">${formatCur(mensal.total_liquido)}</td></tr>
    </tfoot>
  </table>` : ""}
  ${totAnual ? `
  <div class="cards">
    <div class="card"><div class="v blue">${totAnual.horas.toFixed(1)}h</div><div class="l">Total Horas</div></div>
    <div class="card"><div class="v gray">${formatCur(totAnual.bruto)}</div><div class="l">Valor Bruto</div></div>
    <div class="card"><div class="v red">-${formatCur(totAnual.irs)}</div><div class="l">Total IRS</div></div>
    <div class="card"><div class="v green">${formatCur(totAnual.liquido)}</div><div class="l">Valor Líquido</div></div>
  </div>
  <h2>Resumo Mensal ${ano}</h2>
  <table>
    <thead><tr><th>Mês</th><th class="num">Horas</th><th class="num">Bruto</th><th class="num">IRS</th><th class="num">Líquido</th></tr></thead>
    <tbody>${linhasMensais}</tbody>
    <tfoot>
      <tr class="totais"><td>Total</td><td class="num">${totAnual.horas.toFixed(1)}h</td><td class="num">${formatCur(totAnual.bruto)}</td><td class="num red">-${formatCur(totAnual.irs)}</td><td class="num green">${formatCur(totAnual.liquido)}</td></tr>
    </tfoot>
  </table>` : ""}
  <div class="rodape">
    <span>${config.nome_professor || ""}</span>
    <span>PlanAula · Gerado em ${(/* @__PURE__ */ new Date()).toLocaleDateString("pt-PT")}</span>
  </div>
</body></html>`;
}
async function imprimirPDF(html, defaultFileName) {
  const { filePath } = await electron.dialog.showSaveDialog({
    title: "Guardar PDF",
    defaultPath: defaultFileName,
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (!filePath) return { success: false, cancelled: true };
  const win = new electron.BrowserWindow({
    show: false,
    webPreferences: { sandbox: false, contextIsolation: true }
  });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  const pdfData = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 }
  });
  win.destroy();
  fs.writeFileSync(filePath, pdfData);
  electron.shell.showItemInFolder(filePath);
  return { success: true, path: filePath };
}
function registerHandlers() {
  electron.ipcMain.handle("disciplinas:listar", async () => {
    try {
      return { success: true, data: listarDisciplinas() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("disciplinas:buscar", async (_, id) => {
    try {
      return { success: true, data: buscarDisciplina(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("disciplinas:criar", async (_, dados) => {
    try {
      return { success: true, data: criarDisciplina(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("disciplinas:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarDisciplina(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("disciplinas:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarDisciplina(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("modulos:listar", async (_, disciplina_id) => {
    try {
      return { success: true, data: listarModulos(disciplina_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("modulos:criar", async (_, dados) => {
    try {
      return { success: true, data: criarModulo(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("modulos:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarModulo(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("modulos:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarModulo(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("turmas:listar", async (_, disciplina_id) => {
    try {
      return { success: true, data: listarTurmas(disciplina_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("turmas:criar", async (_, dados) => {
    try {
      return { success: true, data: criarTurma(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("turmas:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarTurma(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("turmas:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarTurma(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("horarios:listar", async (_, turma_id) => {
    try {
      return { success: true, data: listarHorarios(turma_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("horarios:criar", async (_, dados) => {
    try {
      return { success: true, data: criarHorario(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("horarios:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarHorario(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("horarios:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarHorario(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("horarios:eliminarDaTurma", async (_, turma_id) => {
    try {
      return { success: true, data: eliminarHorariosDaTurma(turma_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:listar", async (_, filtros) => {
    try {
      return { success: true, data: listarAulas(filtros) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:buscar", async (_, id) => {
    try {
      return { success: true, data: buscarAula(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:criar", async (_, dados) => {
    try {
      return { success: true, data: criarAula(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarAula(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarAula(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:gerarAutomatico", async (_, { turma_id, data_inicio, data_fim }) => {
    try {
      return { success: true, data: gerarAulasAutomatico(turma_id, data_inicio, data_fim) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:eliminarDaDisciplina", async (_, disciplina_id) => {
    try {
      return { success: true, data: eliminarAulasDaDisciplina(disciplina_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("financeiro:calcularMensal", async (_, { ano, mes }) => {
    try {
      return { success: true, data: calcularFinanceiroMensal(ano, mes) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("financeiro:calcularAnual", async (_, ano) => {
    try {
      return { success: true, data: calcularFinanceiroAnual(ano) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("financeiro:obterConfig", async (_, ano) => {
    try {
      return { success: true, data: obterConfigFiscal(ano) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("financeiro:salvarConfig", async (_, dados) => {
    try {
      return { success: true, data: salvarConfigFiscal(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("financeiro:listarValoresHora", async (_, ano_letivo) => {
    try {
      return { success: true, data: listarValoresHora(ano_letivo) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("financeiro:salvarValorHora", async (_, dados) => {
    try {
      return { success: true, data: criarValorHora(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("configuracoes:obter", async (_, chave) => {
    try {
      if (chave) return { success: true, data: obterConfiguracao(chave) };
      return { success: true, data: obterTodasConfiguracoes() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("configuracoes:salvar", async (_, dados) => {
    try {
      if (typeof dados === "object" && !Array.isArray(dados)) {
        return { success: true, data: salvarConfiguracoes(dados) };
      }
      const { chave, valor } = dados;
      return { success: true, data: salvarConfiguracao(chave, valor) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("estatisticas:obter", async (_, ano_letivo) => {
    try {
      return { success: true, data: obterEstatisticas(ano_letivo) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("diasNaoLetivos:listar", async (_, ano) => {
    try {
      return { success: true, data: listarDiasNaoLetivos(ano) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("diasNaoLetivos:criar", async (_, dados) => {
    try {
      return { success: true, data: criarDiaNaoLetivo(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("diasNaoLetivos:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarDiaNaoLetivo(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("diasNaoLetivos:importarFeriados", async (_, ano) => {
    try {
      return { success: true, data: importarFeriadosNacionais(ano) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("periodosNaoLetivos:listar", async (_, instituicao_id) => {
    try {
      return { success: true, data: listarPeriodosNaoLetivos(instituicao_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("periodosNaoLetivos:criar", async (_, dados) => {
    try {
      return { success: true, data: criarPeriodoNaoLetivo(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("periodosNaoLetivos:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarPeriodoNaoLetivo(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:proximoNumero", async (_, turma_id) => {
    try {
      return { success: true, data: proximoNumeroAula(turma_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:aulaPlano", async (_, { aula, config }) => {
    try {
      const html = gerarHTMLPlanoAula(aula, config || {});
      const nomeFicheiro = `plano-${(aula.disciplina_nome || "aula").replace(/\s+/g, "-")}-${aula.data || "sem-data"}.pdf`;
      return await imprimirPDF(html, nomeFicheiro);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:relatorioFinanceiro", async (_, { dados, tipo, ano, mes, config }) => {
    try {
      const html = gerarHTMLRelatorioFinanceiro(dados, tipo, ano, mes, config || {});
      const nomeFicheiro = tipo === "mensal" ? `financeiro-${MESES_PT[mes - 1]}-${ano}.pdf` : `financeiro-anual-${ano}.pdf`;
      return await imprimirPDF(html, nomeFicheiro);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("instituicoes:listar", async () => {
    try {
      return { success: true, data: listarInstituicoes() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("instituicoes:criar", async (_, dados) => {
    try {
      return { success: true, data: criarInstituicao(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("instituicoes:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarInstituicao(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("instituicoes:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarInstituicao(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("cursos:listar", async (_, instituicao_id) => {
    try {
      return { success: true, data: listarCursos(instituicao_id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("cursos:criar", async (_, dados) => {
    try {
      return { success: true, data: criarCurso(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("cursos:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarCurso(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("cursos:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarCurso(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("outrosRendimentos:listar", async (_, filtros) => {
    try {
      return { success: true, data: listarOutrosRendimentos(filtros) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("outrosRendimentos:criar", async (_, dados) => {
    try {
      return { success: true, data: criarOutroRendimento(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("outrosRendimentos:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarOutroRendimento(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("outrosRendimentos:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarOutroRendimento(id) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("backup:exportar", async () => {
    try {
      const db2 = getDb();
      const dbPath = db2.name;
      const { filePath } = await electron.dialog.showSaveDialog({
        title: "Guardar Cópia de Segurança",
        defaultPath: `planaula-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.db`,
        filters: [{ name: "Base de dados", extensions: ["db"] }]
      });
      if (!filePath) return { success: false, cancelled: true };
      fs.copyFileSync(dbPath, filePath);
      electron.shell.showItemInFolder(filePath);
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("backup:importar", async () => {
    try {
      const { filePaths } = await electron.dialog.showOpenDialog({
        title: "Restaurar Cópia de Segurança",
        filters: [{ name: "Base de dados", extensions: ["db"] }],
        properties: ["openFile"]
      });
      if (!filePaths || filePaths.length === 0) return { success: false, cancelled: true };
      const db2 = getDb();
      const dbPath = db2.name;
      const backupAuto = dbPath + ".bak";
      fs.copyFileSync(dbPath, backupAuto);
      closeDb();
      fs.copyFileSync(filePaths[0], dbPath);
      return { success: true, message: "Restauro concluído. Reinicie a aplicação para aplicar as alterações." };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}
const __dirname$1 = path.dirname(url.fileURLToPath(require("url").pathToFileURL(__filename).href));
let mainWindow;
function createWindow() {
  const isDev = !electron.app.isPackaged;
  const iconPath = isDev ? path.join(__dirname$1, "../../build/icon.ico") : path.join(process.resourcesPath, "icon.ico");
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname$1, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: "default",
    show: false,
    backgroundColor: "#f8fafc",
    icon: iconPath
  });
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../renderer/index.html"));
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(() => {
  try {
    runMigrations();
    registerHandlers();
  } catch (err) {
    console.error("Erro na inicialização:", err);
  }
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  closeDb();
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  closeDb();
});
