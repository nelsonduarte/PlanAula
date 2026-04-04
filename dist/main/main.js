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
const MIGRATIONS = [
  // v0 — Baseline: criação de todas as tabelas
  function v0_baseline(db2) {
    db2.exec(`
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
    `);
    const stmt = db2.prepare("INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)");
    stmt.run("tema", "light");
    stmt.run("nome_professor", "");
    stmt.run("instituicao", "");
    stmt.run("departamento", "");
    stmt.run("ano_letivo_atual", (/* @__PURE__ */ new Date()).getFullYear() + "/" + ((/* @__PURE__ */ new Date()).getFullYear() + 1));
  },
  // v1 — Colunas adicionais em aulas, disciplinas, horarios, turmas
  function v1_colunas_extra(db2) {
    const addCol = (table, col, def) => {
      const cols = db2.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
      if (!cols.includes(col)) db2.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    };
    addCol("aulas", "numero", "INTEGER");
    addCol("aulas", "data_avaliacao", "DATE");
    addCol("aulas", "sala", "TEXT");
    addCol("disciplinas", "curso_id", "INTEGER REFERENCES cursos(id) ON DELETE SET NULL");
    addCol("horarios", "sala", "TEXT");
    addCol("turmas", "data_inicio", "DATE");
    addCol("turmas", "data_fim", "DATE");
    addCol("turmas", "carga_horaria", "INTEGER NOT NULL DEFAULT 0");
  },
  // v2 — Tabelas extra: outros_rendimentos, periodos_nao_letivos, professor_cargos
  function v2_tabelas_extra(db2) {
    const tabelas = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    if (!tabelas.includes("outros_rendimentos")) {
      db2.exec(`CREATE TABLE outros_rendimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL,
        data DATE NOT NULL, tipo TEXT DEFAULT 'Outro', notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    }
    if (!tabelas.includes("periodos_nao_letivos")) {
      db2.exec(`CREATE TABLE periodos_nao_letivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE CASCADE,
        descricao TEXT NOT NULL, data_inicio DATE NOT NULL, data_fim DATE NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'férias', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    }
    if (!tabelas.includes("professor_cargos")) {
      db2.exec(`CREATE TABLE professor_cargos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instituicao_id INTEGER REFERENCES instituicoes(id) ON DELETE SET NULL,
        instituicao_nome TEXT NOT NULL, departamento TEXT, cargo TEXT,
        ativo INTEGER NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    }
  },
  // v3 — Semestre nullable + ano_letivo nullable (formação profissional)
  function v3_semestre_nullable(db2) {
    const info = db2.prepare(`PRAGMA table_info(turmas)`).all().find((c) => c.name === "semestre");
    if (info && info.notnull === 1) {
      const sql = db2.prepare("SELECT sql FROM sqlite_master WHERE name='turmas'").get()?.sql;
      if (sql) {
        const newSql = sql.replace("semestre INTEGER NOT NULL DEFAULT 1", "semestre INTEGER DEFAULT NULL").replace("ano_letivo TEXT NOT NULL", "ano_letivo TEXT").replace("CREATE TABLE turmas", "CREATE TABLE turmas_new");
        db2.exec("PRAGMA foreign_keys=OFF;");
        db2.exec(newSql);
        db2.exec("INSERT INTO turmas_new SELECT * FROM turmas;");
        db2.exec("DROP TABLE turmas;");
        db2.exec("ALTER TABLE turmas_new RENAME TO turmas;");
        db2.exec("PRAGMA foreign_keys=ON;");
      }
    }
  }
];
function runMigrations() {
  const db2 = getDb();
  db2.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0)");
  const row = db2.prepare("SELECT version FROM schema_version").get();
  let currentVersion = row?.version ?? -1;
  if (!row) {
    const tabelas = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    if (tabelas.includes("disciplinas")) {
      for (let i = 0; i < MIGRATIONS.length; i++) {
        try {
          MIGRATIONS[i](db2);
        } catch (e) {
        }
      }
      db2.prepare("INSERT INTO schema_version (version) VALUES (?)").run(MIGRATIONS.length - 1);
      return;
    }
    db2.prepare("INSERT INTO schema_version (version) VALUES (?)").run(-1);
    currentVersion = -1;
  }
  for (let i = currentVersion + 1; i < MIGRATIONS.length; i++) {
    try {
      MIGRATIONS[i](db2);
      db2.prepare("UPDATE schema_version SET version = ?").run(i);
    } catch (e) {
      console.error(`Migração v${i} falhou:`, e.message);
      db2.prepare("UPDATE schema_version SET version = ?").run(i);
    }
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
function sincronizarModulosUFCD(disciplina_id) {
  const db2 = getDb();
  const disc = db2.prepare("SELECT * FROM disciplinas WHERE id = ?").get(disciplina_id);
  if (!disc || disc.tipo !== "UFCD") return { sincronizadas: 0 };
  const irmãs = db2.prepare("SELECT id FROM disciplinas WHERE nome = ? AND tipo = ? AND id != ?").all(disc.nome, "UFCD", disciplina_id);
  if (irmãs.length === 0) return { sincronizadas: 0 };
  const modulosOrigem = db2.prepare("SELECT * FROM modulos WHERE disciplina_id = ? ORDER BY ordem").all(disciplina_id);
  let sincronizadas = 0;
  for (const irma of irmãs) {
    db2.prepare("DELETE FROM modulos WHERE disciplina_id = ?").run(irma.id);
    for (const mod of modulosOrigem) {
      db2.prepare("INSERT INTO modulos (disciplina_id, nome, ordem, horas, objetivos) VALUES (?, ?, ?, ?, ?)").run(irma.id, mod.nome, mod.ordem, mod.horas, mod.objetivos);
    }
    sincronizadas++;
  }
  return { sincronizadas };
}
function criarTurma(dados) {
  const db2 = getDb();
  const stmt = db2.prepare(`
    INSERT INTO turmas (disciplina_id, designacao, ano_letivo, semestre, sala, cor, data_inicio, data_fim, carga_horaria)
    VALUES (@disciplina_id, @designacao, @ano_letivo, @semestre, @sala, @cor, @data_inicio, @data_fim, @carga_horaria)
  `);
  const result = stmt.run({ semestre: null, ...dados });
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
    SELECT t.*, d.nome as disciplina_nome, d.tipo as disciplina_tipo FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    ORDER BY d.nome, t.ano_letivo DESC, t.designacao
  `).all();
}
function buscarTurma(id) {
  const db2 = getDb();
  return db2.prepare(`
    SELECT t.*, d.nome as disciplina_nome, d.tipo as disciplina_tipo FROM turmas t
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
  db2.prepare("DELETE FROM aulas WHERE turma_id = ?").run(id);
  db2.prepare("DELETE FROM horarios WHERE turma_id = ?").run(id);
  db2.prepare("DELETE FROM valores_hora WHERE turma_id = ?").run(id);
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
      objetivos, conteudos, atividades, recursos, avaliacao, notas, estado, numero, data_avaliacao, sala)
    VALUES (@turma_id, @modulo_id, @data, @hora_inicio, @hora_fim, @topico,
      @objetivos, @conteudos, @atividades, @recursos, @avaliacao, @notas, @estado, @numero, @data_avaliacao, @sala)
  `);
  const result = stmt.run({ sala: null, ...dados, numero });
  return { id: result.lastInsertRowid, ...dados, numero };
}
function listarAulas(filtros = {}) {
  const db2 = getDb();
  let query = `
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.id as disciplina_id,
           m.nome as modulo_nome, COALESCE(a.sala, h.sala) as sala
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN modulos m ON m.id = a.modulo_id
    LEFT JOIN (
      SELECT turma_id, dia_semana, hora_inicio, MIN(sala) as sala
      FROM horarios GROUP BY turma_id, dia_semana, hora_inicio
    ) h ON h.turma_id = a.turma_id
          AND h.hora_inicio = a.hora_inicio
          AND CAST(strftime('%w', a.data) AS INTEGER) = h.dia_semana
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
    if (filtros.estado === "Realizada") {
      query += " AND a.estado NOT IN ('Adiada','Cancelada') AND a.data <= date('now')";
    } else if (filtros.estado === "Planeada") {
      query += " AND a.estado NOT IN ('Adiada','Cancelada') AND a.data > date('now')";
    } else {
      query += " AND a.estado = ?";
      params.push(filtros.estado);
    }
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
      numero=COALESCE(@numero, numero), data_avaliacao=@data_avaliacao,
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
function eliminarAulasDaTurma(turma_id) {
  const db2 = getDb();
  const info = db2.prepare("DELETE FROM aulas WHERE turma_id = ?").run(turma_id);
  return { success: true, eliminadas: info.changes };
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
        const existente = db2.prepare(
          "SELECT id FROM aulas WHERE turma_id=? AND data=? AND hora_inicio=?"
        ).get(turma_id, dataStr, h.hora_inicio);
        if (existente) continue;
        let horaFim = h.hora_fim;
        let duracaoReal = duracaoSlot;
        if (carga_horaria > 0) {
          const horasRestantes = carga_horaria - horas_existentes - horas_geradas;
          if (horasRestantes <= 0) {
            parar = true;
            break;
          }
          if (duracaoSlot > horasRestantes) {
            const [hi, mi] = h.hora_inicio.split(":").map(Number);
            const totalMin = hi * 60 + mi + Math.round(horasRestantes * 60);
            horaFim = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
            duracaoReal = horasRestantes;
          }
        }
        const a = criarAula({
          turma_id,
          modulo_id: null,
          data: dataStr,
          hora_inicio: h.hora_inicio,
          hora_fim: horaFim,
          topico: "",
          objetivos: null,
          conteudos: null,
          atividades: null,
          recursos: null,
          avaliacao: null,
          notas: null,
          estado: "Planeada",
          data_avaliacao: null
        });
        aulas.push(a);
        horas_geradas += duracaoReal;
        if (carga_horaria > 0 && horas_existentes + horas_geradas >= carga_horaria) {
          parar = true;
          break;
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
function listarProfessorCargos() {
  const db2 = getDb();
  return db2.prepare(`
    SELECT pc.*, i.nome as instituicao_nome_ref
    FROM professor_cargos pc
    LEFT JOIN instituicoes i ON i.id = pc.instituicao_id
    ORDER BY pc.ativo DESC, pc.instituicao_nome
  `).all();
}
function criarProfessorCargo(dados) {
  const db2 = getDb();
  const result = db2.prepare(`
    INSERT INTO professor_cargos (instituicao_id, instituicao_nome, departamento, cargo, ativo)
    VALUES (@instituicao_id, @instituicao_nome, @departamento, @cargo, @ativo)
  `).run({ ...dados, instituicao_id: dados.instituicao_id || null, ativo: dados.ativo ?? 1 });
  return { id: result.lastInsertRowid, ...dados };
}
function editarProfessorCargo(id, dados) {
  const db2 = getDb();
  db2.prepare(`
    UPDATE professor_cargos
    SET instituicao_id=@instituicao_id, instituicao_nome=@instituicao_nome,
        departamento=@departamento, cargo=@cargo, ativo=@ativo
    WHERE id=@id
  `).run({ ...dados, instituicao_id: dados.instituicao_id || null, id });
  return db2.prepare("SELECT * FROM professor_cargos WHERE id = ?").get(id);
}
function eliminarProfessorCargo(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM professor_cargos WHERE id = ?").run(id);
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
    const d = m.data;
    const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
function buscarAvaliacoesAmanha() {
  const db2 = getDb();
  const amanha = /* @__PURE__ */ new Date();
  amanha.setDate(amanha.getDate() + 1);
  const data = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, "0")}-${String(amanha.getDate()).padStart(2, "0")}`;
  return db2.prepare(`
    SELECT a.data_avaliacao, a.topico, a.hora_inicio, a.hora_fim,
           t.designacao as turma_nome, d.nome as disciplina_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE a.data_avaliacao = ?
    ORDER BY a.hora_inicio
  `).all(data);
}
function pesquisarGlobal(query) {
  const db2 = getDb();
  if (!query || query.trim().length < 2) return { aulas: [], turmas: [], disciplinas: [] };
  const q = `%${query.trim()}%`;
  const aulas = db2.prepare(`
    SELECT a.id, a.data, a.hora_inicio, a.hora_fim, a.topico, a.estado,
           t.designacao as turma_nome, t.cor as turma_cor, d.nome as disciplina_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE a.topico LIKE ? OR t.designacao LIKE ? OR d.nome LIKE ? OR a.data LIKE ?
    ORDER BY a.data DESC LIMIT 8
  `).all(q, q, q, q);
  const turmas = db2.prepare(`
    SELECT t.id, t.designacao, t.cor, t.ano_letivo, d.nome as disciplina_nome
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE t.designacao LIKE ? OR d.nome LIKE ?
    LIMIT 5
  `).all(q, q);
  const disciplinas = db2.prepare(`
    SELECT id, nome, codigo, carga_horaria
    FROM disciplinas
    WHERE nome LIKE ? OR codigo LIKE ?
    LIMIT 5
  `).all(q, q);
  return { aulas, turmas, disciplinas };
}
function obterEstatisticas(ano_letivo) {
  const db2 = getDb();
  const anoAtual = ano_letivo || (/* @__PURE__ */ new Date()).getFullYear();
  const [anoInicio] = String(anoAtual).split("/");
  const ano = String(anoInicio);
  const estadoVirtual = `
    CASE
      WHEN estado IN ('Adiada','Cancelada') THEN estado
      WHEN data <= date('now') THEN 'Realizada'
      ELSE 'Planeada'
    END
  `;
  const duracaoMin = `(
    CAST(substr(hora_fim,1,2) AS INTEGER)*60 + CAST(substr(hora_fim,4,2) AS INTEGER) -
    CAST(substr(hora_inicio,1,2) AS INTEGER)*60 - CAST(substr(hora_inicio,4,2) AS INTEGER)
  )`;
  const porEstado = db2.prepare(`
    SELECT ${estadoVirtual} as estado, COUNT(*) as total
    FROM aulas
    WHERE strftime('%Y', data) = ?
    GROUP BY 1
  `).all(ano);
  const porDisciplina = db2.prepare(`
    SELECT d.nome as disciplina_nome,
           COUNT(a.id) as total_aulas,
           SUM(${duracaoMin} / 60.0) as total_horas
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y', a.data) = ? AND a.estado != 'Cancelada'
    GROUP BY d.id
    ORDER BY total_horas DESC
  `).all(ano);
  const evolucaoMensal = db2.prepare(`
    SELECT strftime('%Y-%m', data) as mes,
           COUNT(*) as total_aulas,
           SUM(${duracaoMin} / 60.0) as total_horas
    FROM aulas
    WHERE strftime('%Y', data) = ? AND estado != 'Cancelada'
    GROUP BY mes ORDER BY mes
  `).all(ano);
  const porTurma = db2.prepare(`
    SELECT t.designacao as turma_nome,
           d.nome as disciplina_nome,
           COALESCE(i.nome, 'Sem instituição') as instituicao_nome,
           t.carga_horaria,
           COUNT(a.id) as total_aulas,
           COALESCE(SUM(CASE WHEN a.estado != 'Cancelada' AND a.data <= date('now')
             THEN ${duracaoMin} / 60.0 ELSE 0 END), 0) as horas_dadas,
           COALESCE(SUM(CASE WHEN a.estado != 'Cancelada'
             THEN ${duracaoMin} / 60.0 ELSE 0 END), 0) as horas_total
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    LEFT JOIN aulas a ON a.turma_id = t.id AND strftime('%Y', a.data) = ?
    GROUP BY t.id
    HAVING horas_total > 0
    ORDER BY horas_dadas DESC
  `).all(ano);
  const porDiaSemana = db2.prepare(`
    SELECT CAST(strftime('%w', data) AS INTEGER) as dia,
           COUNT(*) as total_aulas,
           SUM(${duracaoMin} / 60.0) as total_horas
    FROM aulas
    WHERE strftime('%Y', data) = ?
      AND estado NOT IN ('Cancelada','Adiada')
      AND data <= date('now')
    GROUP BY dia ORDER BY dia
  `).all(ano);
  const totalAulas = porEstado.reduce((s, r) => s + r.total, 0);
  const realizadas = porEstado.find((r) => r.estado === "Realizada")?.total || 0;
  const adiadas = porEstado.find((r) => r.estado === "Adiada")?.total || 0;
  const canceladas = porEstado.find((r) => r.estado === "Cancelada")?.total || 0;
  const totalHoras = porDisciplina.reduce((s, d) => s + (d.total_horas || 0), 0);
  const taxaConclusao = realizadas + adiadas + canceladas > 0 ? (realizadas / totalAulas * 100).toFixed(1) : 0;
  const rendimentoMensal = [];
  for (let m = 1; m <= 12; m++) {
    const fin = calcularFinanceiroMensal(parseInt(ano), m);
    if (fin.total_bruto === 0 && fin.total_outros_bruto === 0) continue;
    const porInstituicao = {};
    for (const item of fin.itens) {
      const disc = db2.prepare("SELECT curso_id FROM disciplinas WHERE id = ?").get(item.disciplina_id);
      let instNome = "Sem instituição";
      if (disc?.curso_id) {
        const curso = db2.prepare("SELECT i.nome FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id WHERE c.id = ?").get(disc.curso_id);
        if (curso?.nome) instNome = curso.nome;
      }
      porInstituicao[instNome] = (porInstituicao[instNome] || 0) + item.valor_bruto - item.valor_bruto * fin.taxa_irs;
    }
    rendimentoMensal.push({ mes: fin.mes, porInstituicao, total_liquido: fin.total_liquido });
  }
  return {
    porEstado,
    porDisciplina,
    evolucaoMensal,
    porTurma,
    porDiaSemana,
    totalAulas,
    realizadas,
    adiadas,
    canceladas,
    totalHoras,
    taxaConclusao,
    rendimentoMensal
  };
}
function obterContextoExportTurma(turma_id) {
  const db2 = getDb();
  const turma = db2.prepare(`
    SELECT t.*, d.nome as disciplina_nome, d.codigo as disciplina_codigo, d.tipo as disciplina_tipo,
           d.carga_horaria as disciplina_carga, c.nome as curso_nome,
           COALESCE(i.nome, '') as instituicao_nome, COALESCE(i.tipo, '') as instituicao_tipo
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    WHERE t.id = ?
  `).get(turma_id);
  if (!turma) return null;
  const aulas = db2.prepare(`
    SELECT a.*, COALESCE(a.sala, h.sala) as sala, m.nome as modulo_nome
    FROM aulas a
    LEFT JOIN modulos m ON m.id = a.modulo_id
    LEFT JOIN (
      SELECT turma_id, dia_semana, hora_inicio, MIN(sala) as sala
      FROM horarios GROUP BY turma_id, dia_semana, hora_inicio
    ) h ON h.turma_id = a.turma_id AND h.hora_inicio = a.hora_inicio
         AND CAST(strftime('%w', a.data) AS INTEGER) = h.dia_semana
    WHERE a.turma_id = ? AND a.estado != 'Cancelada'
    ORDER BY a.data, a.hora_inicio
  `).all(turma_id);
  let horasAcumuladas = 0;
  const aulasComContexto = aulas.map((a, idx) => {
    const hi = a.hora_inicio.split(":").map(Number);
    const hf = a.hora_fim.split(":").map(Number);
    const duracao = (hf[0] * 60 + hf[1] - hi[0] * 60 - hi[1]) / 60;
    horasAcumuladas += duracao;
    return { ...a, duracao, horasAcumuladas: parseFloat(horasAcumuladas.toFixed(1)), sequencia: idx + 1, totalAulas: aulas.length };
  });
  return {
    turma,
    aulas: aulasComContexto,
    isFormacao: turma.disciplina_tipo === "UFCD",
    totalHoras: parseFloat(horasAcumuladas.toFixed(1))
  };
}
function obterDashboardStats() {
  const db2 = getDb();
  const duracaoMin = `(
    CAST(substr(a.hora_fim,1,2) AS INTEGER)*60 + CAST(substr(a.hora_fim,4,2) AS INTEGER) -
    CAST(substr(a.hora_inicio,1,2) AS INTEGER)*60 - CAST(substr(a.hora_inicio,4,2) AS INTEGER)
  )`;
  const aulasHoje = db2.prepare(`
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, COALESCE(a.sala, h.sala) as sala,
           COALESCE(i.nome, 'Sem instituição') as instituicao_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    LEFT JOIN (
      SELECT turma_id, dia_semana, hora_inicio, MIN(sala) as sala
      FROM horarios GROUP BY turma_id, dia_semana, hora_inicio
    ) h ON h.turma_id = a.turma_id AND h.hora_inicio = a.hora_inicio
         AND CAST(strftime('%w', a.data) AS INTEGER) = h.dia_semana
    WHERE a.data = date('now') AND a.estado != 'Cancelada'
    ORDER BY a.hora_inicio
  `).all();
  const aulasAmanha = db2.prepare(`
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, COALESCE(a.sala, h.sala) as sala,
           COALESCE(i.nome, 'Sem instituição') as instituicao_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    LEFT JOIN (
      SELECT turma_id, dia_semana, hora_inicio, MIN(sala) as sala
      FROM horarios GROUP BY turma_id, dia_semana, hora_inicio
    ) h ON h.turma_id = a.turma_id AND h.hora_inicio = a.hora_inicio
         AND CAST(strftime('%w', a.data) AS INTEGER) = h.dia_semana
    WHERE a.data = date('now', '+1 day') AND a.estado != 'Cancelada'
    ORDER BY a.hora_inicio
  `).all();
  const avaliacoes = db2.prepare(`
    SELECT a.data_avaliacao, a.data, a.hora_inicio, a.topico,
           t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE a.data_avaliacao IS NOT NULL
      AND a.data_avaliacao BETWEEN date('now') AND date('now', '+7 days')
      AND a.estado != 'Cancelada'
    ORDER BY a.data_avaliacao
  `).all();
  const horasSemana = db2.prepare(`
    SELECT COALESCE(SUM(${duracaoMin} / 60.0), 0) as total
    FROM aulas a
    WHERE a.data BETWEEN date('now', 'weekday 1', '-7 days') AND date('now', 'weekday 0')
      AND a.estado NOT IN ('Cancelada')
  `).get()?.total || 0;
  const horasMesInst = db2.prepare(`
    SELECT COALESCE(i.nome, 'Sem instituição') as instituicao,
           COALESCE(SUM(${duracaoMin} / 60.0), 0) as horas
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    WHERE strftime('%Y-%m', a.data) = strftime('%Y-%m', 'now')
      AND a.estado != 'Cancelada'
    GROUP BY i.nome
    ORDER BY horas DESC
  `).all();
  const turmasTerminar = db2.prepare(`
    SELECT t.designacao as turma_nome, d.nome as disciplina_nome, t.cor,
           t.carga_horaria,
           COALESCE(SUM(CASE WHEN a.estado != 'Cancelada' AND a.data <= date('now')
             THEN ${duracaoMin} / 60.0 ELSE 0 END), 0) as horas_dadas
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN aulas a ON a.turma_id = t.id
    WHERE t.carga_horaria > 0
    GROUP BY t.id
    HAVING horas_dadas > 0
      AND (t.carga_horaria - horas_dadas) <= t.carga_horaria * 0.15
      AND horas_dadas < t.carga_horaria
    ORDER BY (t.carga_horaria - horas_dadas) ASC
  `).all();
  const semPreparar = db2.prepare(`
    SELECT COUNT(*) as total FROM aulas
    WHERE data BETWEEN date('now') AND date('now', '+14 days')
      AND estado NOT IN ('Cancelada', 'Adiada')
      AND (topico IS NULL OR topico = '')
  `).get()?.total || 0;
  return { aulasHoje, aulasAmanha, avaliacoes, horasSemana, horasMesInst, turmasTerminar, semPreparar };
}
function fmtData(ds) {
  if (!ds) return "";
  const d = /* @__PURE__ */ new Date(ds + "T12:00:00");
  return d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtDataCurta(ds) {
  if (!ds) return "";
  const [y, m, d] = ds.split("-");
  return `${d}/${m}/${y}`;
}
function secao(titulo, conteudo) {
  if (!conteudo) return "";
  return `<div class="secao"><div class="secao-titulo">${titulo}</div><div class="secao-corpo">${conteudo.replace(/\n/g, "<br>")}</div></div>`;
}
const CSS_BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1f2937; background: white; }
  .page { padding: 24px 32px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .cabecalho { border-bottom: 3px solid var(--cor-turma, #2563eb); padding-bottom: 12px; margin-bottom: 16px; }
  .cabecalho .inst { font-size: 11pt; font-weight: 700; color: #111827; }
  .cabecalho .curso { font-size: 9pt; color: #6b7280; margin-top: 2px; }
  .cabecalho .titulo { font-size: 14pt; font-weight: 700; color: #111827; margin-top: 8px; }
  .cabecalho .subtitulo { font-size: 11pt; color: #4b5563; margin-top: 2px; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px 16px; margin-bottom: 16px; background: #f9fafb; border-radius: 6px; padding: 10px 12px; }
  .meta-item label { font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; display: block; }
  .meta-item span { font-weight: 600; color: #111827; font-size: 10pt; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 8pt; font-weight: 600; color: white; }
  .secao { margin-bottom: 12px; }
  .secao-titulo { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 6px; }
  .secao-corpo { font-size: 10pt; line-height: 1.5; color: #374151; }
  .rodape { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 8pt; color: #9ca3af; display: flex; justify-content: space-between; }
  .assinaturas { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .assinatura { text-align: center; }
  .assinatura .linha { border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 4px; font-size: 9pt; color: #6b7280; }
  .progresso { margin-bottom: 16px; }
  .progresso-bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-top: 4px; }
  .progresso-fill { height: 100%; border-radius: 3px; }
  .progresso-text { display: flex; justify-content: space-between; font-size: 8pt; color: #6b7280; margin-top: 2px; }
`;
function estadoCor(estado) {
  const map = { Realizada: "#16a34a", Planeada: "#2563eb", Adiada: "#ca8a04", Cancelada: "#dc2626" };
  return map[estado] || "#2563eb";
}
function templateIEFP(aula, turma, config) {
  const pct = turma.carga_horaria > 0 ? Math.min(100, aula.horasAcumuladas / turma.carga_horaria * 100) : 0;
  return `<div class="page" style="--cor-turma: ${turma.cor || "#2563eb"}">
  <div class="cabecalho">
    <div class="inst">${turma.instituicao_nome || config.instituicao || "IEFP"}</div>
    <div class="curso">${turma.curso_nome || ""} — Ação: ${turma.designacao}</div>
    <div class="titulo">Plano de Sessão</div>
    <div class="subtitulo">UFCD ${turma.disciplina_codigo || ""} — ${turma.disciplina_nome || ""}</div>
  </div>

  <div class="meta">
    <div class="meta-item"><label>Sessão</label><span>${aula.sequencia} / ${aula.totalAulas}</span></div>
    <div class="meta-item"><label>Data</label><span>${fmtDataCurta(aula.data)}</span></div>
    <div class="meta-item"><label>Horário</label><span>${aula.hora_inicio || ""} – ${aula.hora_fim || ""}</span></div>
    <div class="meta-item"><label>Duração</label><span>${aula.duracao}h</span></div>
    <div class="meta-item"><label>Sala</label><span>${aula.sala || "—"}</span></div>
    <div class="meta-item"><label>Horas Acumuladas</label><span>${aula.horasAcumuladas}h / ${turma.carga_horaria || "?"}h</span></div>
  </div>

  <div class="progresso">
    <div class="progresso-bar"><div class="progresso-fill" style="width:${pct}%;background:${turma.cor || "#2563eb"}"></div></div>
    <div class="progresso-text"><span>Progresso da UFCD</span><span>${pct.toFixed(0)}%</span></div>
  </div>

  ${aula.topico ? `<div class="secao"><div class="secao-titulo">Tema / Sumário</div><div class="secao-corpo" style="font-weight:600">${aula.topico}</div></div>` : `<div class="secao"><div class="secao-titulo">Tema / Sumário</div><div class="secao-corpo" style="color:#9ca3af;font-style:italic">A preencher</div></div>`}
  ${secao("Objetivos", aula.objetivos)}
  ${secao("Conteúdos", aula.conteudos)}
  ${secao("Atividades / Estratégias", aula.atividades)}
  ${secao("Recursos", aula.recursos)}
  ${secao("Avaliação", aula.avaliacao)}
  ${secao("Observações", aula.notas)}

  <div class="assinaturas">
    <div class="assinatura"><div class="linha">O/A Formador/a<br>${config.nome_professor || ""}</div></div>
    <div class="assinatura"><div class="linha">O/A Coordenador/a</div></div>
  </div>

  <div class="rodape">
    <span>${turma.instituicao_nome || ""}</span>
    <span>PlanAula · ${(/* @__PURE__ */ new Date()).toLocaleDateString("pt-PT")}</span>
  </div>
</div>`;
}
function templateISLA(aula, turma, config) {
  return `<div class="page" style="--cor-turma: ${turma.cor || "#2563eb"}">
  <div class="cabecalho">
    <div class="inst">${turma.instituicao_nome || config.instituicao || ""}</div>
    ${config.departamento ? `<div class="curso">${config.departamento}</div>` : ""}
    <div class="titulo">Plano de Aula</div>
    <div class="subtitulo">${turma.disciplina_nome || ""} — ${turma.designacao}${turma.semestre ? ` · ${turma.semestre}º Semestre` : ""}</div>
  </div>

  <div class="meta">
    ${aula.numero != null ? `<div class="meta-item"><label>Aula nº</label><span>${aula.numero}</span></div>` : ""}
    <div class="meta-item"><label>Data</label><span>${fmtData(aula.data)}</span></div>
    <div class="meta-item"><label>Horário</label><span>${aula.hora_inicio || ""} – ${aula.hora_fim || ""}</span></div>
    ${aula.sala ? `<div class="meta-item"><label>Sala</label><span>${aula.sala}</span></div>` : ""}
    ${aula.modulo_nome ? `<div class="meta-item"><label>Módulo</label><span>${aula.modulo_nome}</span></div>` : ""}
    <div class="meta-item"><label>Estado</label><span class="badge" style="background:${estadoCor(aula.estado)}">${aula.estado || ""}</span></div>
  </div>

  ${aula.topico ? `<div class="secao"><div class="secao-titulo">Tópico</div><div class="secao-corpo" style="font-size:11pt;font-weight:600">${aula.topico}</div></div>` : ""}
  ${secao("Objetivos", aula.objetivos)}
  ${secao("Conteúdos", aula.conteudos)}
  ${secao("Atividades", aula.atividades)}
  ${secao("Recursos", aula.recursos)}
  ${secao("Avaliação", aula.avaliacao)}
  ${secao("Notas", aula.notas)}

  <div class="rodape">
    <span>${config.nome_professor || ""}</span>
    <span>${turma.disciplina_nome} · ${fmtDataCurta(aula.data)}</span>
  </div>
</div>`;
}
function gerarHTMLPlanos(contexto, config) {
  const { turma, aulas, isFormacao } = contexto;
  const templateFn = isFormacao ? templateIEFP : templateISLA;
  const paginas = aulas.map((a) => templateFn(a, turma, config)).join("\n");
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>${CSS_BASE}</style></head><body>
${paginas}
</body></html>`;
}
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function formatCur(v) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v || 0);
}
const DIAS_SEMANA_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function gerarHTMLRelatorioTurma(turma, horarios, aulas, config = {}) {
  const cor = turma.cor || "#2563eb";
  const hoje = (/* @__PURE__ */ new Date()).toLocaleDateString("pt-PT");
  const fmtData2 = (d) => d ? (/* @__PURE__ */ new Date(d + "T12:00:00")).toLocaleDateString("pt-PT") : "—";
  const fmtDiaSemana = (d) => d ? (/* @__PURE__ */ new Date(d + "T12:00:00")).toLocaleDateString("pt-PT", { weekday: "short" }) : "";
  const hojeISO = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const estadoVis = (a) => a.estado === "Adiada" || a.estado === "Cancelada" ? a.estado : a.data <= hojeISO ? "Realizada" : "Planeada";
  const realizadas = aulas.filter((a) => estadoVis(a) === "Realizada").length;
  const planeadas = aulas.filter((a) => estadoVis(a) === "Planeada").length;
  const adiadas = aulas.filter((a) => estadoVis(a) === "Adiada").length;
  const canceladas = aulas.filter((a) => estadoVis(a) === "Cancelada").length;
  const horasDadas = aulas.filter((a) => estadoVis(a) === "Realizada").reduce((s, a) => {
    const [hi, mi] = (a.hora_inicio || "0:0").split(":").map(Number);
    const [hf, mf] = (a.hora_fim || "0:0").split(":").map(Number);
    return s + (hf * 60 + mf - hi * 60 - mi) / 60;
  }, 0);
  const horasTotal = aulas.filter((a) => estadoVis(a) !== "Cancelada").reduce((s, a) => {
    const [hi, mi] = (a.hora_inicio || "0:0").split(":").map(Number);
    const [hf, mf] = (a.hora_fim || "0:0").split(":").map(Number);
    return s + (hf * 60 + mf - hi * 60 - mi) / 60;
  }, 0);
  const carga = turma.carga_horaria || 0;
  const progresso = carga > 0 ? Math.min(100, horasDadas / carga * 100) : null;
  const corEstado = (e) => e === "Realizada" ? "#16a34a" : e === "Planeada" ? "#2563eb" : e === "Adiada" ? "#ca8a04" : "#dc2626";
  const linhasAulas = aulas.map((a) => {
    const ev = estadoVis(a);
    return `<tr>
      <td>${a.numero != null ? a.numero : "—"}</td>
      <td>${fmtData2(a.data)}</td>
      <td style="color:#6b7280;font-size:9pt">${fmtDiaSemana(a.data)}</td>
      <td>${a.hora_inicio || ""}–${a.hora_fim || ""}</td>
      <td>${a.sala || "—"}</td>
      <td><span class="badge" style="background:${corEstado(ev)}">${ev}</span></td>
      <td style="color:#374151">${a.topico || ""}</td>
    </tr>`;
  }).join("");
  const linhasHorarios = (horarios || []).map(
    (h) => `<tr><td>${DIAS_SEMANA_PT[h.dia_semana] || h.dia_semana}</td><td>${h.hora_inicio}</td><td>${h.hora_fim}</td><td>${h.sala || "—"}</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10pt; color:#1f2937; background:white; padding:28px 32px; }
  .topo { border-left:5px solid ${cor}; padding-left:14px; margin-bottom:18px; }
  .topo h1 { font-size:18pt; font-weight:700; color:#111827; }
  .topo h2 { font-size:12pt; color:#4b5563; margin-top:3px; }
  .inst { font-size:9pt; color:#9ca3af; margin-bottom:6px; }
  .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; background:#f9fafb; border-radius:8px; padding:12px; margin-bottom:18px; }
  .meta-item label { font-size:8pt; text-transform:uppercase; letter-spacing:.05em; color:#9ca3af; display:block; }
  .meta-item span { font-weight:600; color:#111827; font-size:10pt; }
  h3 { font-size:10pt; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin:16px 0 10px; }
  table { width:100%; border-collapse:collapse; font-size:9.5pt; }
  th { text-align:left; padding:6px 8px; background:#f3f4f6; font-size:8.5pt; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:#6b7280; border-bottom:2px solid #e5e7eb; }
  td { padding:5px 8px; border-bottom:1px solid #f3f4f6; color:#374151; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  .badge { display:inline-block; padding:1px 7px; border-radius:999px; font-size:8pt; font-weight:600; color:white; }
  .kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:14px; }
  .kpi { background:#f9fafb; border-radius:8px; padding:10px 12px; text-align:center; }
  .kpi .val { font-size:16pt; font-weight:700; }
  .kpi .lbl { font-size:8pt; color:#9ca3af; margin-top:2px; }
  .prog-bar { height:10px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-top:8px; }
  .prog-fill { height:100%; border-radius:999px; background:${progresso !== null && progresso >= 100 ? "#16a34a" : cor}; width:${progresso !== null ? progresso : 0}%; }
  .rodape { margin-top:28px; border-top:1px solid #e5e7eb; padding-top:8px; font-size:8pt; color:#9ca3af; display:flex; justify-content:space-between; }
</style></head><body>
  <div class="topo">
    ${config.instituicao ? `<div class="inst">${config.instituicao}${config.departamento ? " · " + config.departamento : ""}</div>` : ""}
    <h1>${turma.designacao || ""}</h1>
    <h2>${turma.disciplina_nome || ""}${turma.curso_nome ? " · " + turma.curso_nome : ""}</h2>
  </div>

  <div class="meta">
    <div class="meta-item"><label>Ano Letivo</label><span>${turma.ano_letivo || "—"}</span></div>
    <div class="meta-item"><label>Semestre</label><span>${turma.semestre ? turma.semestre + "º" : "—"}</span></div>
    <div class="meta-item"><label>Período</label><span>${fmtData2(turma.data_inicio)} → ${fmtData2(turma.data_fim)}</span></div>
    <div class="meta-item"><label>Carga Horária</label><span>${carga > 0 ? carga + "h" : "—"}</span></div>
  </div>

  <h3>Resumo</h3>
  <div class="kpis">
    <div class="kpi"><div class="val" style="color:#111827">${aulas.length}</div><div class="lbl">Total Aulas</div></div>
    <div class="kpi"><div class="val" style="color:#16a34a">${realizadas}</div><div class="lbl">Realizadas</div></div>
    <div class="kpi"><div class="val" style="color:#2563eb">${planeadas}</div><div class="lbl">Planeadas</div></div>
    <div class="kpi"><div class="val" style="color:#ca8a04">${adiadas}</div><div class="lbl">Adiadas</div></div>
    <div class="kpi"><div class="val" style="color:#dc2626">${canceladas}</div><div class="lbl">Canceladas</div></div>
  </div>
  ${carga > 0 ? `
  <div style="display:flex;align-items:center;gap:12px;background:#f9fafb;border-radius:8px;padding:10px 14px;margin-bottom:4px">
    <span style="font-size:9pt;color:#6b7280;white-space:nowrap">Horas dadas: <strong style="color:#111827">${horasDadas.toFixed(1)}h</strong> / ${carga}h</span>
    <div class="prog-bar" style="flex:1"><div class="prog-fill"></div></div>
    <span style="font-size:10pt;font-weight:700;color:${progresso >= 100 ? "#16a34a" : cor};white-space:nowrap">${progresso.toFixed(0)}%</span>
  </div>` : `<p style="font-size:9pt;color:#6b7280;margin-bottom:8px">Horas dadas: <strong>${horasDadas.toFixed(1)}h</strong> · Total planeado: <strong>${horasTotal.toFixed(1)}h</strong></p>`}

  ${horarios && horarios.length > 0 ? `
  <h3>Horários</h3>
  <table><thead><tr><th>Dia</th><th>Início</th><th>Fim</th><th>Sala</th></tr></thead>
  <tbody>${linhasHorarios}</tbody></table>` : ""}

  <h3>Registo de Aulas</h3>
  <table>
    <thead><tr><th>Nº</th><th>Data</th><th></th><th>Horário</th><th>Sala</th><th>Estado</th><th>Tópico</th></tr></thead>
    <tbody>${linhasAulas}</tbody>
  </table>

  <div class="rodape">
    <span>${config.nome_professor || ""}</span>
    <span>PlanAula · ${hoje}</span>
  </div>
</body></html>`;
}
function gerarHTMLPlanoAula(aula, config = {}) {
  const dataFmt = aula.data ? (/* @__PURE__ */ new Date(aula.data + "T12:00:00")).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const secao2 = (titulo, conteudo) => conteudo ? `<div class="secao"><div class="secao-titulo">${titulo}</div><div class="secao-corpo">${conteudo.replace(/\n/g, "<br>")}</div></div>` : "";
  const estadoCor2 = { Realizada: "#16a34a", Planeada: "#2563eb", Adiada: "#ca8a04", Cancelada: "#dc2626" };
  const cor = estadoCor2[aula.estado] || "#2563eb";
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
  ${secao2("Objetivos", aula.objetivos)}
  ${secao2("Conteúdos", aula.conteudos)}
  ${secao2("Atividades", aula.atividades)}
  ${secao2("Recursos", aula.recursos)}
  ${secao2("Avaliação", aula.avaliacao)}
  ${secao2("Notas", aula.notas)}
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
function gerarHTMLMobile(dadosJSON, config) {
  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>PlanAula — ${config.nome_professor || "Horário"}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--accent:#3b82f6}
body{font-family:-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--text);padding:0;min-height:100vh}
.header{background:var(--card);padding:16px;text-align:center;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.header h1{font-size:18px;font-weight:700}.header p{font-size:12px;color:var(--muted);margin-top:2px}
.nav{display:flex;gap:0;background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:56px;z-index:9}
.nav button{flex:1;padding:10px;border:none;background:none;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer}
.nav button.active{color:var(--accent);border-bottom:2px solid var(--accent)}
.month-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--card);border-bottom:1px solid var(--border)}
.month-nav button{background:none;border:none;color:var(--accent);font-size:24px;padding:8px 16px;cursor:pointer}
.month-nav span{font-size:16px;font-weight:600}
.vista-toggle{display:flex;gap:0;padding:0 16px 8px;background:var(--card)}
.vista-toggle button{flex:1;padding:6px;border:1px solid var(--border);background:none;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer}
.vista-toggle button:first-child{border-radius:6px 0 0 6px}.vista-toggle button:last-child{border-radius:0 6px 6px 0}
.vista-toggle button.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.week-day{background:var(--card);border-radius:8px;margin-bottom:8px;overflow:hidden}
.week-day-header{padding:10px 12px;font-weight:600;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}
.week-day-header.today{background:var(--accent);color:#fff}
.week-day-header.holiday{background:#7f1d1d;color:#fca5a5}
.week-ev{padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:8px}
.week-ev:last-child{border-bottom:none}
.week-ev .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.week-ev .info{flex:1;min-width:0}.week-ev .info .time{font-size:12px;font-weight:600}.week-ev .info .name{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.week-empty{padding:12px;text-align:center;color:var(--muted);font-size:12px;font-style:italic}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;padding:4px;background:var(--bg)}
.cal-head{text-align:center;font-size:11px;color:var(--muted);padding:8px 0;font-weight:600}
.cal-day{background:var(--card);min-height:70px;padding:4px;border-radius:4px;position:relative}
.cal-day.empty{background:transparent;min-height:0}.cal-day.today{outline:2px solid var(--accent);outline-offset:-1px}
.cal-day.holiday{background:#3b1a1a}.cal-num{font-size:11px;font-weight:600;margin-bottom:2px}
.cal-ev{font-size:9px;padding:2px 4px;margin-bottom:1px;border-radius:3px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.cal-holiday{font-size:9px;color:#f87171;font-style:italic}
.tab{display:none;padding:8px}.tab.active{display:block}
.aula-card{background:var(--card);border-radius:8px;padding:12px;margin-bottom:8px;border-left:4px solid var(--accent)}
.aula-card .data{font-size:12px;color:var(--muted)}.aula-card .disc{font-size:15px;font-weight:600;margin:4px 0}
.aula-card .turma{font-size:12px;color:var(--muted)}.aula-card .hora{font-size:13px;font-weight:500}
.aula-card .topico{font-size:12px;color:var(--muted);margin-top:4px;font-style:italic}
.badge{display:inline-block;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600}
.badge-r{background:#166534;color:#86efac}.badge-p{background:#1e3a5f;color:#93c5fd}
.badge-a{background:#713f12;color:#fde047}.badge-c{background:#7f1d1d;color:#fca5a5}
.turma-sec{margin-bottom:16px}.turma-title{font-size:14px;font-weight:700;padding:12px 8px;display:flex;justify-content:space-between;align-items:center}
.turma-title .hours{font-size:12px;color:var(--muted);font-weight:400}
.filter-bar{padding:8px;display:flex;gap:8px;flex-wrap:wrap}
.filter-bar select{background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-size:13px;flex:1}
.detail-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:100;display:none;align-items:flex-end}
.detail-overlay.show{display:flex}.detail-sheet{background:var(--card);width:100%;max-height:80vh;border-radius:16px 16px 0 0;padding:20px;overflow-y:auto}
.detail-sheet h3{font-size:16px;margin-bottom:12px}.detail-row{margin-bottom:10px}
.detail-row label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.detail-row p{font-size:14px;margin-top:2px}
.generated{text-align:center;font-size:11px;color:var(--muted);padding:20px}
</style></head><body>
<div class="header">
  <h1>PlanAula</h1>
  <p>${config.nome_professor || ""}${config.instituicao ? " · " + config.instituicao : ""}</p>
</div>
<div class="nav">
  <button class="active" onclick="showTab('calendario')">Calendário</button>
  <button onclick="showTab('lista')">Aulas</button>
  <button onclick="showTab('resumo')">Resumo</button>
</div>
<div id="calendario" class="tab active"></div>
<div id="lista" class="tab"></div>
<div id="resumo" class="tab"></div>
<div class="detail-overlay" id="overlay" onclick="if(event.target===this)fecharDetalhe()">
  <div class="detail-sheet" id="detail"></div>
</div>
<p class="generated">PlanAula · Gerado em ${(/* @__PURE__ */ new Date()).toLocaleDateString("pt-PT")}</p>
<script>
const DADOS=${dadosJSON};
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_S=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
let mesAtual,anoAtual,vistaCal='mensal';
let semanaAtual;
const hoje=new Date();const hojeStr=hoje.toISOString().slice(0,10);
const datas=DADOS.aulas.map(a=>a.data).filter(Boolean).sort();
if(datas.length){const d=new Date(datas[0]);mesAtual=d.getUTCMonth();anoAtual=d.getUTCFullYear()}
else{mesAtual=hoje.getMonth();anoAtual=hoje.getFullYear()}
// Iniciar semana na segunda-feira da semana actual
function getSegunda(d){const dt=new Date(d);const day=dt.getDay();const diff=dt.getDate()-day+(day===0?-6:1);dt.setDate(diff);return dt}
semanaAtual=getSegunda(hoje);

const feriadosSet=new Set(DADOS.diasNaoLetivos.map(d=>d.data));
const feriadosMap={};DADOS.diasNaoLetivos.forEach(d=>{feriadosMap[d.data]=d.descricao});
function isDiaNaoLetivo(ds){
  if(feriadosSet.has(ds))return true;
  return DADOS.periodos.some(p=>ds>=p.data_inicio&&ds<=p.data_fim);
}
function getPeriodoDesc(ds){
  const p=DADOS.periodos.find(p=>ds>=p.data_inicio&&ds<=p.data_fim);
  return p?p.descricao:null;
}

function showTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>{if(b.textContent.toLowerCase().includes(id==='calendario'?'calendário':id==='lista'?'aulas':'resumo'))b.classList.add('active')});
}

function renderCalendario(){
  if(vistaCal==='semanal')return renderSemanal();
  const el=document.getElementById('calendario');
  const first=new Date(anoAtual,mesAtual,1);const dow=first.getDay();
  const days=new Date(anoAtual,mesAtual+1,0).getDate();
  const aulasDoMes=DADOS.aulas.filter(a=>{if(!a.data)return false;const d=new Date(a.data);return d.getUTCMonth()===mesAtual&&d.getUTCFullYear()===anoAtual});
  let h='<div class="month-nav"><button onclick="mudarMes(-1)">‹</button><span>'+MESES[mesAtual]+' '+anoAtual+'</span><button onclick="mudarMes(1)">›</button></div>';
  h+=vistaToggle();
  h+='<div class="cal-grid">';
  DIAS_S.forEach(d=>{h+='<div class="cal-head">'+d+'</div>'});
  for(let i=0;i<dow;i++)h+='<div class="cal-day empty"></div>';
  for(let d=1;d<=days;d++){
    const ds=anoAtual+'-'+String(mesAtual+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isToday=ds===hojeStr;const isHoliday=isDiaNaoLetivo(ds);
    const cls='cal-day'+(isToday?' today':'')+(isHoliday?' holiday':'');
    h+='<div class="'+cls+'"><div class="cal-num">'+d+'</div>';
    if(feriadosMap[ds])h+='<div class="cal-holiday">'+feriadosMap[ds]+'</div>';
    else if(isHoliday){const pd=getPeriodoDesc(ds);if(pd)h+='<div class="cal-holiday">'+pd+'</div>'}
    const aulasHoje=aulasDoMes.filter(a=>a.data===ds).sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));
    aulasHoje.forEach(a=>{h+='<div class="cal-ev" style="background:'+(a.turma_cor||'#3b82f6')+'" onclick="verDetalhe('+a.id+')">'+a.hora_inicio+' '+(a.disciplina_nome||'').substring(0,12)+'</div>'});
    h+='</div>';
  }
  h+='</div>';el.innerHTML=h;
}
function renderSemanal(){
  const el=document.getElementById('calendario');
  const seg=new Date(semanaAtual);
  const dom=new Date(seg);dom.setDate(dom.getDate()+6);
  const segStr=toDS(seg);const domStr=toDS(dom);
  let h='<div class="month-nav"><button onclick="mudarSemana(-1)">‹</button><span>'+segStr.split('-')[2]+'/'+segStr.split('-')[1]+' — '+domStr.split('-')[2]+'/'+domStr.split('-')[1]+' '+dom.getFullYear()+'</span><button onclick="mudarSemana(1)">›</button></div>';
  h+=vistaToggle();
  for(let i=0;i<7;i++){
    const dia=new Date(seg);dia.setDate(dia.getDate()+i);
    const ds=toDS(dia);const isToday=ds===hojeStr;const isHoliday=isDiaNaoLetivo(ds);
    const hdrCls='week-day-header'+(isToday?' today':'')+(isHoliday?' holiday':'');
    const aulasHoje=DADOS.aulas.filter(a=>a.data===ds).sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));
    h+='<div class="week-day"><div class="'+hdrCls+'"><span>'+DIAS_S[dia.getDay()]+', '+dia.getDate()+' '+MESES[dia.getMonth()]+'</span>';
    if(feriadosMap[ds])h+='<span style="font-size:11px;font-weight:400">'+feriadosMap[ds]+'</span>';
    else if(isHoliday){const pd=getPeriodoDesc(ds);if(pd)h+='<span style="font-size:11px;font-weight:400">'+pd+'</span>'}
    h+='</div>';
    if(aulasHoje.length===0){h+='<div class="week-empty">Sem aulas</div>'}
    else{aulasHoje.forEach(a=>{
      h+='<div class="week-ev" onclick="verDetalhe('+a.id+')"><div class="dot" style="background:'+(a.turma_cor||'#3b82f6')+'"></div><div class="info"><div class="time">'+a.hora_inicio+'–'+a.hora_fim+(a.sala?' · '+a.sala:'')+'</div><div class="name">'+(a.disciplina_nome||'')+' · '+(a.turma_nome||'')+'</div></div></div>';
    })}
    h+='</div>';
  }
  el.innerHTML=h;
}
function vistaToggle(){return '<div class="vista-toggle"><button class="'+(vistaCal==='mensal'?'active':'')+'" onclick="setVista(\\'mensal\\')">Mensal</button><button class="'+(vistaCal==='semanal'?'active':'')+'" onclick="setVista(\\'semanal\\')">Semanal</button></div>'}
function setVista(v){vistaCal=v;renderCalendario()}
function toDS(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function mudarMes(d){mesAtual+=d;if(mesAtual>11){mesAtual=0;anoAtual++}if(mesAtual<0){mesAtual=11;anoAtual--}renderCalendario()}
function mudarSemana(d){semanaAtual.setDate(semanaAtual.getDate()+d*7);renderCalendario()}

function renderLista(){
  const el=document.getElementById('lista');
  let h='<div class="filter-bar"><select id="fTurma" onchange="renderLista()"><option value="">Todas as turmas</option>';
  const turmasComAulas=[...new Set(DADOS.aulas.map(a=>a.turma_id))];
  turmasComAulas.forEach(tid=>{const t=DADOS.turmas.find(t=>t.id===tid);if(t)h+='<option value="'+tid+'">'+t.designacao+'</option>'});
  h+='</select><select id="fEstado" onchange="renderLista()"><option value="">Todos</option><option value="r">Realizadas</option><option value="p">Planeadas</option></select></div>';
  const fT=document.getElementById('fTurma')?.value||'';
  const fE=document.getElementById('fEstado')?.value||'';
  let aulas=DADOS.aulas.slice().sort((a,b)=>a.data.localeCompare(b.data)||a.hora_inicio.localeCompare(b.hora_inicio));
  if(fT)aulas=aulas.filter(a=>String(a.turma_id)===fT);
  if(fE==='r')aulas=aulas.filter(a=>a.estado!=='Adiada'&&a.estado!=='Cancelada'&&a.data<=hojeStr);
  if(fE==='p')aulas=aulas.filter(a=>a.estado!=='Adiada'&&a.estado!=='Cancelada'&&a.data>hojeStr);
  aulas.forEach(a=>{
    const passou=a.data<=hojeStr;const override=a.estado==='Adiada'||a.estado==='Cancelada';
    const estado=override?a.estado:passou?'Realizada':'Planeada';
    const bc=estado==='Realizada'?'badge-r':estado==='Planeada'?'badge-p':estado==='Adiada'?'badge-a':'badge-c';
    h+='<div class="aula-card" style="border-left-color:'+(a.turma_cor||'#3b82f6')+'" onclick="verDetalhe('+a.id+')">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center"><span class="data">'+formatData(a.data)+'</span><span class="badge '+bc+'">'+estado+'</span></div>';
    h+='<div class="disc">'+(a.disciplina_nome||'')+'</div>';
    h+='<div class="turma">'+(a.turma_nome||'')+' · <span class="hora">'+a.hora_inicio+'–'+a.hora_fim+'</span></div>';
    if(a.topico)h+='<div class="topico">'+a.topico+'</div>';
    h+='</div>'});
  el.innerHTML=h;
}

function renderResumo(){
  const el=document.getElementById('resumo');let h='';
  const turmasComAulas=[...new Set(DADOS.aulas.map(a=>a.turma_id))];
  turmasComAulas.forEach(tid=>{
    const t=DADOS.turmas.find(t=>t.id===tid);if(!t)return;
    const aulasT=DADOS.aulas.filter(a=>a.turma_id===tid);
    const totalH=aulasT.reduce((s,a)=>{const[hi,mi]=a.hora_inicio.split(':').map(Number);const[hf,mf]=a.hora_fim.split(':').map(Number);return s+(hf*60+mf-hi*60-mi)/60},0);
    const realizadas=aulasT.filter(a=>a.data<=hojeStr&&a.estado!=='Adiada'&&a.estado!=='Cancelada').length;
    const pct=t.carga_horaria?Math.round(totalH/t.carga_horaria*100):0;
    h+='<div class="turma-sec"><div class="turma-title" style="border-left:4px solid '+(t.cor||'#3b82f6')+';padding-left:12px">';
    h+='<span>'+(t.designacao||'')+'<br><span style="font-size:12px;font-weight:400;color:var(--muted)">'+(aulasT[0]?.disciplina_nome||'')+'</span></span>';
    h+='<span class="hours">'+totalH.toFixed(0)+'h / '+(t.carga_horaria||'?')+'h</span></div>';
    h+='<div style="padding:0 12px 8px"><div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div style="background:'+(t.cor||'#3b82f6')+';height:100%;width:'+Math.min(pct,100)+'%"></div></div>';
    h+='<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px"><span>'+realizadas+' realizadas / '+aulasT.length+' total</span><span>'+pct+'%</span></div></div></div>'});
  el.innerHTML=h;
}

function verDetalhe(id){
  const a=DADOS.aulas.find(x=>x.id===id);if(!a)return;
  const passou=a.data<=hojeStr;const override=a.estado==='Adiada'||a.estado==='Cancelada';
  const estado=override?a.estado:passou?'Realizada':'Planeada';
  let h='<h3>'+(a.disciplina_nome||'Aula')+'</h3>';
  h+=r('Data',formatData(a.data));h+=r('Horário',a.hora_inicio+'–'+a.hora_fim+(a.sala?' · Sala '+a.sala:''));
  h+=r('Turma',a.turma_nome||'');h+=r('Estado',estado);
  if(a.numero)h+=r('Aula nº',''+a.numero);if(a.modulo_nome)h+=r('Módulo',a.modulo_nome);
  if(a.topico)h+=r('Tópico',a.topico);if(a.objetivos)h+=r('Objetivos',a.objetivos);
  if(a.conteudos)h+=r('Conteúdos',a.conteudos);if(a.atividades)h+=r('Atividades',a.atividades);
  if(a.recursos)h+=r('Recursos',a.recursos);if(a.avaliacao)h+=r('Avaliação',a.avaliacao);
  if(a.notas)h+=r('Notas',a.notas);
  h+='<button onclick="fecharDetalhe()" style="width:100%;padding:12px;margin-top:16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Fechar</button>';
  document.getElementById('detail').innerHTML=h;document.getElementById('overlay').classList.add('show');
}
function fecharDetalhe(){document.getElementById('overlay').classList.remove('show')}
function r(l,v){return '<div class="detail-row"><label>'+l+'</label><p>'+v+'</p></div>'}
function formatData(ds){if(!ds)return'';const[y,m,d]=ds.split('-');return d+'/'+m+'/'+y+' ('+DIAS_S[new Date(ds).getUTCDay()]+')'}

renderCalendario();renderLista();renderResumo();
<\/script></body></html>`;
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
  electron.ipcMain.handle("dashboard:stats", async () => {
    try {
      return { success: true, data: obterDashboardStats() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
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
  electron.ipcMain.handle("modulos:sincronizarUFCD", async (_, disciplina_id) => {
    try {
      return { success: true, data: sincronizarModulosUFCD(disciplina_id) };
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
  electron.ipcMain.handle("pesquisa:global", async (_, query) => {
    try {
      return { success: true, data: pesquisarGlobal(query) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("aulas:eliminarDaTurma", async (_, turma_id) => {
    try {
      return { success: true, data: eliminarAulasDaTurma(turma_id) };
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
  electron.ipcMain.handle("export:relatorioTurma", async (_, { turma, horarios, aulas, config }) => {
    try {
      const html = gerarHTMLRelatorioTurma(turma, horarios, aulas, config || {});
      const nome = `relatorio-${(turma.designacao || "turma").replace(/\s+/g, "-")}-${(turma.disciplina_nome || "").replace(/\s+/g, "-")}.pdf`;
      return await imprimirPDF(html, nome);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:aulaPlano", async (_, { aula, config }) => {
    try {
      const contexto = obterContextoExportTurma(aula.turma_id);
      if (contexto) {
        const aulaCtx = contexto.aulas.find((a) => a.id === aula.id);
        if (aulaCtx) {
          const html2 = gerarHTMLPlanos({ ...contexto, aulas: [aulaCtx] }, config || {});
          const nomeFicheiro2 = `plano-${(aula.disciplina_nome || "aula").replace(/\s+/g, "-")}-${aula.data || "sem-data"}.pdf`;
          return await imprimirPDF(html2, nomeFicheiro2);
        }
      }
      const html = gerarHTMLPlanoAula(aula, config || {});
      const nomeFicheiro = `plano-${(aula.disciplina_nome || "aula").replace(/\s+/g, "-")}-${aula.data || "sem-data"}.pdf`;
      return await imprimirPDF(html, nomeFicheiro);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:turmaPlanos", async (_, { turma_id }) => {
    try {
      const contexto = obterContextoExportTurma(turma_id);
      if (!contexto || contexto.aulas.length === 0) return { success: false, error: "Sem aulas para exportar" };
      const config = obterTodasConfiguracoes();
      const html = gerarHTMLPlanos(contexto, config);
      const nomeFicheiro = `planos-${contexto.turma.designacao}-${(contexto.turma.disciplina_nome || "").replace(/\s+/g, "-")}.pdf`;
      return await imprimirPDF(html, nomeFicheiro);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:folhaHoras", async (_, { ano, mes }) => {
    try {
      const config = obterTodasConfiguracoes();
      const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;
      const db2 = getDb();
      const aulas = db2.prepare(`
        SELECT a.data, a.hora_inicio, a.hora_fim, d.nome as disciplina, d.tipo as disc_tipo,
               t.designacao as turma, COALESCE(a.sala, h.sala) as sala,
               COALESCE(i.nome, 'Sem instituição') as instituicao,
               (CAST(substr(a.hora_fim,1,2) AS INTEGER)*60 + CAST(substr(a.hora_fim,4,2) AS INTEGER)
               - CAST(substr(a.hora_inicio,1,2) AS INTEGER)*60 - CAST(substr(a.hora_inicio,4,2) AS INTEGER)) / 60.0 as horas
        FROM aulas a
        JOIN turmas t ON t.id = a.turma_id
        JOIN disciplinas d ON d.id = t.disciplina_id
        LEFT JOIN cursos c ON c.id = d.curso_id
        LEFT JOIN instituicoes i ON i.id = c.instituicao_id
        LEFT JOIN (SELECT turma_id, dia_semana, hora_inicio, MIN(sala) as sala FROM horarios GROUP BY turma_id, dia_semana, hora_inicio
        ) h ON h.turma_id = a.turma_id AND h.hora_inicio = a.hora_inicio AND CAST(strftime('%w', a.data) AS INTEGER) = h.dia_semana
        WHERE strftime('%Y-%m', a.data) = ? AND a.estado != 'Cancelada'
        ORDER BY a.data, a.hora_inicio
      `).all(mesStr);
      if (aulas.length === 0) return { success: false, error: "Sem aulas neste mês" };
      const porInst = {};
      aulas.forEach((a) => {
        if (!porInst[a.instituicao]) porInst[a.instituicao] = [];
        porInst[a.instituicao].push(a);
      });
      const fmtData2 = (ds) => {
        const [y, m, d] = ds.split("-");
        return `${d}/${m}/${y}`;
      };
      const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const fmtDia = (ds) => diasSemana[(/* @__PURE__ */ new Date(ds + "T12:00:00")).getDay()];
      let tabelas = "";
      let totalGeral = 0;
      Object.entries(porInst).forEach(([inst, sessoes]) => {
        const totalInst = sessoes.reduce((s, a) => s + a.horas, 0);
        totalGeral += totalInst;
        const porTurma = {};
        sessoes.forEach((a) => {
          const key = `${a.turma}|${a.disciplina}`;
          if (!porTurma[key]) porTurma[key] = { turma: a.turma, disciplina: a.disciplina, disc_tipo: a.disc_tipo, sessoes: [], horas: 0 };
          porTurma[key].sessoes.push(a);
          porTurma[key].horas += a.horas;
        });
        let rows = "";
        Object.values(porTurma).forEach((grupo) => {
          grupo.sessoes.forEach((a) => {
            rows += `<tr><td>${fmtData2(a.data)}</td><td>${fmtDia(a.data)}</td><td>${a.disciplina}</td><td>${a.turma}</td><td>${a.hora_inicio}–${a.hora_fim}</td><td>${a.sala || "—"}</td><td class="num">${a.horas.toFixed(1)}</td></tr>`;
          });
          rows += `<tr class="subtotal"><td colspan="6">${grupo.turma} — ${grupo.disciplina}</td><td class="num"><strong>${grupo.horas.toFixed(1)}h</strong></td></tr>`;
        });
        tabelas += `
        <div class="inst-section">
          <h2>${inst}</h2>
          <table>
            <thead><tr><th>Data</th><th>Dia</th><th>${sessoes[0]?.disc_tipo === "UFCD" ? "UFCD" : "Disciplina"}</th><th>Turma</th><th>Horário</th><th>Sala</th><th>Horas</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="6"><strong>Total ${inst}</strong></td><td class="num"><strong>${totalInst.toFixed(1)}h</strong></td></tr></tfoot>
          </table>
        </div>`;
      });
      const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1f2937;padding:24px 32px}
h1{font-size:14pt;margin-bottom:4px}
.sub{font-size:10pt;color:#6b7280;margin-bottom:20px}
.inst-section{margin-bottom:24px}
.inst-section h2{font-size:11pt;font-weight:700;color:#111827;border-bottom:2px solid #3b82f6;padding-bottom:4px;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8px}
th{background:#f3f4f6;padding:6px 8px;text-align:left;font-weight:600;border:1px solid #e5e7eb}
td{padding:5px 8px;border:1px solid #e5e7eb}
td.num,th:last-child{text-align:right}
tr.subtotal td{background:#f0f9ff;font-weight:500;border-top:1px solid #bfdbfe}
tfoot td{background:#f9fafb;border-top:2px solid #d1d5db}
.total{margin-top:16px;text-align:right;font-size:12pt;font-weight:700}
.rodape{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:8pt;color:#9ca3af;display:flex;justify-content:space-between}
.assinatura{margin-top:40px;text-align:center;border-top:1px solid #9ca3af;padding-top:4px;font-size:9pt;color:#6b7280;width:200px}
</style></head><body>
<h1>Folha de Horas — ${MESES_PT[mes - 1]} ${ano}</h1>
<div class="sub">${config.nome_professor || ""}${config.instituicao ? " · " + config.instituicao : ""}</div>
${tabelas}
<div class="total">Total Geral: ${totalGeral.toFixed(1)}h</div>
<div class="assinatura">O/A Professor/a Formador/a<br>${config.nome_professor || ""}</div>
<div class="rodape"><span>Folha de Horas</span><span>PlanAula · ${(/* @__PURE__ */ new Date()).toLocaleDateString("pt-PT")}</span></div>
</body></html>`;
      return await imprimirPDF(html, `folha-horas-${MESES_PT[mes - 1].toLowerCase()}-${ano}.pdf`);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:calendarioHTML", async (_, { html, nome }) => {
    try {
      return await imprimirPDF(html, nome);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:ics", async () => {
    try {
      const aulas = listarAulas({});
      if (!aulas || aulas.length === 0) return { success: false, error: "Sem aulas para exportar" };
      const { filePath } = await electron.dialog.showSaveDialog({
        title: "Exportar Calendário",
        defaultPath: "PlanAula.ics",
        filters: [{ name: "iCalendar", extensions: ["ics"] }]
      });
      if (!filePath) return { success: false, cancelled: true };
      const pad = (n) => String(n).padStart(2, "0");
      const toICS = (ds, time) => {
        const [y, m, d] = ds.split("-");
        const [h, mi] = time.split(":");
        return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(mi)}00`;
      };
      let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PlanAula//PT\r\nCALSCALE:GREGORIAN\r\n";
      for (const a of aulas) {
        if (!a.data || !a.hora_inicio || !a.hora_fim || a.estado === "Cancelada") continue;
        const summary = `${a.disciplina_nome || ""} — ${a.turma_nome || ""}`;
        const desc = a.topico ? a.topico.replace(/\n/g, "\\n") : "";
        ics += "BEGIN:VEVENT\r\n";
        ics += `DTSTART:${toICS(a.data, a.hora_inicio)}\r
`;
        ics += `DTEND:${toICS(a.data, a.hora_fim)}\r
`;
        ics += `SUMMARY:${summary}\r
`;
        if (a.sala) ics += `LOCATION:${a.sala}\r
`;
        if (desc) ics += `DESCRIPTION:${desc}\r
`;
        ics += `UID:planaula-${a.id}@local\r
`;
        ics += "END:VEVENT\r\n";
      }
      ics += "END:VCALENDAR\r\n";
      fs.writeFileSync(filePath, ics, "utf-8");
      electron.shell.showItemInFolder(filePath);
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:mobileHTML", async () => {
    try {
      const aulas = listarAulas({});
      const turmas = listarTurmas();
      const config = obterTodasConfiguracoes();
      const diasNaoLetivos = listarDiasNaoLetivos();
      const periodos = getDb().prepare("SELECT * FROM periodos_nao_letivos").all();
      const { filePath } = await electron.dialog.showSaveDialog({
        title: "Exportar HTML Mobile",
        defaultPath: `PlanAula-mobile.html`,
        filters: [{ name: "HTML", extensions: ["html"] }]
      });
      if (!filePath) return { success: false, cancelled: true };
      const dados = JSON.stringify({ aulas, turmas, config, diasNaoLetivos, periodos });
      const html = gerarHTMLMobile(dados, config);
      fs.writeFileSync(filePath, html, "utf-8");
      electron.shell.showItemInFolder(filePath);
      return { success: true, path: filePath };
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
  electron.ipcMain.handle("professorCargos:listar", async () => {
    try {
      return { success: true, data: listarProfessorCargos() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("professorCargos:criar", async (_, dados) => {
    try {
      return { success: true, data: criarProfessorCargo(dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("professorCargos:editar", async (_, { id, dados }) => {
    try {
      return { success: true, data: editarProfessorCargo(id, dados) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("professorCargos:eliminar", async (_, id) => {
    try {
      return { success: true, data: eliminarProfessorCargo(id) };
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
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("backup:reiniciar", () => {
    electron.app.relaunch();
    electron.app.exit(0);
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
    if (electron.Notification.isSupported()) {
      try {
        const avaliacoes = buscarAvaliacoesAmanha();
        for (const a of avaliacoes) {
          const titulo = `Avaliação amanhã — ${a.disciplina_nome}`;
          const corpo = `${a.turma_nome}${a.topico ? ` · ${a.topico}` : ""}${a.hora_inicio ? ` · ${a.hora_inicio}` : ""}`;
          new electron.Notification({ title: titulo, body: corpo }).show();
        }
      } catch (e) {
        console.error("Erro ao verificar avaliações:", e);
      }
    }
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
