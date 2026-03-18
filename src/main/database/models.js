import { getDb } from './db.js'

// ─── Disciplinas ────────────────────────────────────────────────────────────

export function criarDisciplina(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO disciplinas (nome, codigo, area_cientifica, carga_horaria, ects, tipo, descricao, curso_id)
    VALUES (@nome, @codigo, @area_cientifica, @carga_horaria, @ects, @tipo, @descricao, @curso_id)
  `)
  const result = stmt.run({ ...dados, curso_id: dados.curso_id || null })
  return { id: result.lastInsertRowid, ...dados }
}

export function listarDisciplinas() {
  const db = getDb()
  return db.prepare(`
    SELECT d.*, c.nome as curso_nome, i.nome as instituicao_nome
    FROM disciplinas d
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    ORDER BY d.nome
  `).all()
}

export function buscarDisciplina(id) {
  const db = getDb()
  return db.prepare('SELECT * FROM disciplinas WHERE id = ?').get(id)
}

export function editarDisciplina(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE disciplinas
    SET nome=@nome, codigo=@codigo, area_cientifica=@area_cientifica,
        carga_horaria=@carga_horaria, ects=@ects, tipo=@tipo, descricao=@descricao,
        curso_id=@curso_id, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...dados, curso_id: dados.curso_id || null, id })
  return buscarDisciplina(id)
}

export function eliminarDisciplina(id) {
  const db = getDb()
  db.prepare('DELETE FROM disciplinas WHERE id = ?').run(id)
  return { success: true }
}

// ─── Módulos ─────────────────────────────────────────────────────────────────

export function criarModulo(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO modulos (disciplina_id, nome, ordem, horas, objetivos)
    VALUES (@disciplina_id, @nome, @ordem, @horas, @objetivos)
  `)
  const result = stmt.run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function listarModulos(disciplina_id) {
  const db = getDb()
  if (disciplina_id) {
    return db.prepare('SELECT * FROM modulos WHERE disciplina_id = ? ORDER BY ordem').all(disciplina_id)
  }
  return db.prepare('SELECT * FROM modulos ORDER BY disciplina_id, ordem').all()
}

export function editarModulo(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE modulos SET nome=@nome, ordem=@ordem, horas=@horas, objetivos=@objetivos WHERE id=@id
  `).run({ ...dados, id })
  return db.prepare('SELECT * FROM modulos WHERE id = ?').get(id)
}

export function eliminarModulo(id) {
  const db = getDb()
  db.prepare('DELETE FROM modulos WHERE id = ?').run(id)
  return { success: true }
}

// ─── Turmas ──────────────────────────────────────────────────────────────────

export function criarTurma(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO turmas (disciplina_id, designacao, ano_letivo, semestre, sala, cor)
    VALUES (@disciplina_id, @designacao, @ano_letivo, @semestre, @sala, @cor)
  `)
  const result = stmt.run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function listarTurmas(disciplina_id) {
  const db = getDb()
  if (disciplina_id) {
    return db.prepare(`
      SELECT t.*, d.nome as disciplina_nome FROM turmas t
      JOIN disciplinas d ON d.id = t.disciplina_id
      WHERE t.disciplina_id = ?
      ORDER BY t.ano_letivo DESC, t.designacao
    `).all(disciplina_id)
  }
  return db.prepare(`
    SELECT t.*, d.nome as disciplina_nome FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    ORDER BY d.nome, t.ano_letivo DESC, t.designacao
  `).all()
}

export function buscarTurma(id) {
  const db = getDb()
  return db.prepare(`
    SELECT t.*, d.nome as disciplina_nome FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE t.id = ?
  `).get(id)
}

export function editarTurma(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE turmas SET disciplina_id=@disciplina_id, designacao=@designacao,
      ano_letivo=@ano_letivo, semestre=@semestre, sala=@sala, cor=@cor
    WHERE id=@id
  `).run({ ...dados, id })
  return buscarTurma(id)
}

export function eliminarTurma(id) {
  const db = getDb()
  db.prepare('DELETE FROM turmas WHERE id = ?').run(id)
  return { success: true }
}

// ─── Horários ─────────────────────────────────────────────────────────────────

export function criarHorario(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO horarios (turma_id, dia_semana, hora_inicio, hora_fim)
    VALUES (@turma_id, @dia_semana, @hora_inicio, @hora_fim)
  `)
  const result = stmt.run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function listarHorarios(turma_id) {
  const db = getDb()
  if (turma_id) {
    return db.prepare('SELECT * FROM horarios WHERE turma_id = ? ORDER BY dia_semana, hora_inicio').all(turma_id)
  }
  return db.prepare('SELECT * FROM horarios ORDER BY turma_id, dia_semana, hora_inicio').all()
}

export function editarHorario(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE horarios SET dia_semana=@dia_semana, hora_inicio=@hora_inicio, hora_fim=@hora_fim WHERE id=@id
  `).run({ ...dados, id })
  return db.prepare('SELECT * FROM horarios WHERE id = ?').get(id)
}

export function eliminarHorario(id) {
  const db = getDb()
  db.prepare('DELETE FROM horarios WHERE id = ?').run(id)
  return { success: true }
}

export function eliminarHorariosDaTurma(turma_id) {
  const db = getDb()
  db.prepare('DELETE FROM horarios WHERE turma_id = ?').run(turma_id)
  return { success: true }
}

// ─── Aulas ───────────────────────────────────────────────────────────────────

export function proximoNumeroAula(turma_id) {
  const db = getDb()
  const row = db.prepare('SELECT MAX(numero) as max FROM aulas WHERE turma_id = ?').get(turma_id)
  return (row?.max || 0) + 1
}

export function criarAula(dados) {
  const db = getDb()
  const numero = dados.numero != null ? dados.numero : proximoNumeroAula(dados.turma_id)
  const stmt = db.prepare(`
    INSERT INTO aulas (turma_id, modulo_id, data, hora_inicio, hora_fim, topico,
      objetivos, conteudos, atividades, recursos, avaliacao, notas, estado, numero)
    VALUES (@turma_id, @modulo_id, @data, @hora_inicio, @hora_fim, @topico,
      @objetivos, @conteudos, @atividades, @recursos, @avaliacao, @notas, @estado, @numero)
  `)
  const result = stmt.run({ ...dados, numero })
  return { id: result.lastInsertRowid, ...dados, numero }
}

export function listarAulas(filtros = {}) {
  const db = getDb()
  let query = `
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.id as disciplina_id,
           m.nome as modulo_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN modulos m ON m.id = a.modulo_id
    WHERE 1=1
  `
  const params = []

  if (filtros.turma_id) {
    query += ' AND a.turma_id = ?'
    params.push(filtros.turma_id)
  }
  if (filtros.disciplina_id) {
    query += ' AND d.id = ?'
    params.push(filtros.disciplina_id)
  }
  if (filtros.data_inicio) {
    query += ' AND a.data >= ?'
    params.push(filtros.data_inicio)
  }
  if (filtros.data_fim) {
    query += ' AND a.data <= ?'
    params.push(filtros.data_fim)
  }
  if (filtros.estado) {
    query += ' AND a.estado = ?'
    params.push(filtros.estado)
  }
  if (filtros.mes) {
    query += " AND strftime('%Y-%m', a.data) = ?"
    params.push(filtros.mes)
  }

  query += ' ORDER BY a.data, a.hora_inicio'
  return db.prepare(query).all(...params)
}

export function buscarAula(id) {
  const db = getDb()
  return db.prepare(`
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.id as disciplina_id,
           m.nome as modulo_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN modulos m ON m.id = a.modulo_id
    WHERE a.id = ?
  `).get(id)
}

export function editarAula(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE aulas SET turma_id=@turma_id, modulo_id=@modulo_id, data=@data,
      hora_inicio=@hora_inicio, hora_fim=@hora_fim, topico=@topico,
      objetivos=@objetivos, conteudos=@conteudos, atividades=@atividades,
      recursos=@recursos, avaliacao=@avaliacao, notas=@notas, estado=@estado,
      numero=COALESCE(@numero, numero),
      updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...dados, numero: dados.numero ?? null, id })
  return buscarAula(id)
}

export function eliminarAula(id) {
  const db = getDb()
  db.prepare('DELETE FROM aulas WHERE id = ?').run(id)
  return { success: true }
}

export function gerarAulasAutomatico(turma_id, data_inicio, data_fim) {
  const db = getDb()
  const turma = buscarTurma(turma_id)
  if (!turma) throw new Error('Turma não encontrada')

  const horarios = listarHorarios(turma_id)
  if (!horarios.length) throw new Error('Sem horários definidos para esta turma')

  // Carregar dias não lectivos no intervalo
  const diasNaoLetivos = new Set(
    db.prepare('SELECT data FROM dias_nao_letivos WHERE data >= ? AND data <= ?')
      .all(data_inicio, data_fim)
      .map(r => r.data)
  )

  const start = new Date(data_inicio)
  const end = new Date(data_fim)
  const aulas = []

  const current = new Date(start)
  while (current <= end) {
    const dataStr = current.toISOString().split('T')[0]

    if (!diasNaoLetivos.has(dataStr)) {
      const diaSemana = current.getDay() // 0=Sun, 1=Mon...
      const horariosHoje = horarios.filter(h => h.dia_semana === diaSemana)

      for (const h of horariosHoje) {
        const existente = db.prepare(
          'SELECT id FROM aulas WHERE turma_id=? AND data=? AND hora_inicio=?'
        ).get(turma_id, dataStr, h.hora_inicio)

        if (!existente) {
          const a = criarAula({
            turma_id, modulo_id: null, data: dataStr,
            hora_inicio: h.hora_inicio, hora_fim: h.hora_fim,
            topico: '', objetivos: null, conteudos: null,
            atividades: null, recursos: null, avaliacao: null,
            notas: null, estado: 'Planeada'
          })
          aulas.push(a)
        }
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return aulas
}

// ─── Instituições ─────────────────────────────────────────────────────────────

export function criarInstituicao(dados) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO instituicoes (nome, tipo, contacto, notas)
    VALUES (@nome, @tipo, @contacto, @notas)
  `).run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function listarInstituicoes() {
  const db = getDb()
  return db.prepare('SELECT * FROM instituicoes ORDER BY nome').all()
}

export function editarInstituicao(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE instituicoes SET nome=@nome, tipo=@tipo, contacto=@contacto, notas=@notas WHERE id=@id
  `).run({ ...dados, id })
  return db.prepare('SELECT * FROM instituicoes WHERE id = ?').get(id)
}

export function eliminarInstituicao(id) {
  const db = getDb()
  db.prepare('DELETE FROM instituicoes WHERE id = ?').run(id)
  return { success: true }
}

// ─── Cursos ───────────────────────────────────────────────────────────────────

export function criarCurso(dados) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO cursos (instituicao_id, nome, tipo, ano_letivo, valor_hora, descricao, ativo)
    VALUES (@instituicao_id, @nome, @tipo, @ano_letivo, @valor_hora, @descricao, @ativo)
  `).run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function listarCursos(instituicao_id) {
  const db = getDb()
  if (instituicao_id) {
    return db.prepare(`
      SELECT c.*, i.nome as instituicao_nome
      FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id
      WHERE c.instituicao_id = ? ORDER BY c.nome
    `).all(instituicao_id)
  }
  return db.prepare(`
    SELECT c.*, i.nome as instituicao_nome
    FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    ORDER BY i.nome, c.nome
  `).all()
}

export function editarCurso(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE cursos SET instituicao_id=@instituicao_id, nome=@nome, tipo=@tipo,
      ano_letivo=@ano_letivo, valor_hora=@valor_hora, descricao=@descricao, ativo=@ativo
    WHERE id=@id
  `).run({ ...dados, id })
  return db.prepare(`
    SELECT c.*, i.nome as instituicao_nome
    FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id WHERE c.id = ?
  `).get(id)
}

export function eliminarCurso(id) {
  const db = getDb()
  db.prepare('DELETE FROM cursos WHERE id = ?').run(id)
  return { success: true }
}

// ─── Dias Não Lectivos ────────────────────────────────────────────────────────

export function listarDiasNaoLetivos(ano) {
  const db = getDb()
  if (ano) {
    return db.prepare("SELECT * FROM dias_nao_letivos WHERE strftime('%Y', data) = ? ORDER BY data")
      .all(String(ano))
  }
  return db.prepare('SELECT * FROM dias_nao_letivos ORDER BY data').all()
}

export function criarDiaNaoLetivo(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO dias_nao_letivos (data, descricao, tipo)
    VALUES (@data, @descricao, @tipo)
    ON CONFLICT(data) DO UPDATE SET descricao=@descricao, tipo=@tipo
  `)
  const result = stmt.run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function eliminarDiaNaoLetivo(id) {
  const db = getDb()
  db.prepare('DELETE FROM dias_nao_letivos WHERE id = ?').run(id)
  return { success: true }
}

export function importarFeriadosNacionais(ano) {
  // Feriados fixos portugueses
  const fixos = [
    { mes: 1, dia: 1, desc: 'Ano Novo' },
    { mes: 4, dia: 25, desc: 'Dia da Liberdade' },
    { mes: 5, dia: 1, desc: 'Dia do Trabalhador' },
    { mes: 6, dia: 10, desc: 'Dia de Portugal' },
    { mes: 8, dia: 15, desc: 'Assunção de Nossa Senhora' },
    { mes: 10, dia: 5, desc: 'Implantação da República' },
    { mes: 11, dia: 1, desc: 'Dia de Todos os Santos' },
    { mes: 12, dia: 1, desc: 'Restauração da Independência' },
    { mes: 12, dia: 8, desc: 'Imaculada Conceição' },
    { mes: 12, dia: 25, desc: 'Natal' },
  ]

  // Páscoa (algoritmo de Meeus/Jones/Butcher)
  function calcularPascoa(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100
    const d = Math.floor(b / 4), e = b % 4
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4), k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(y, month - 1, day)
  }

  const pascoa = calcularPascoa(ano)
  const sextaFeira = new Date(pascoa); sextaFeira.setDate(pascoa.getDate() - 2)
  const corpusChristi = new Date(pascoa); corpusChristi.setDate(pascoa.getDate() + 60)

  const moveis = [
    { data: sextaFeira, desc: 'Sexta-feira Santa' },
    { data: pascoa, desc: 'Páscoa' },
    { data: corpusChristi, desc: 'Corpo de Deus' },
  ]

  const criados = []
  for (const f of fixos) {
    const data = `${ano}-${String(f.mes).padStart(2,'0')}-${String(f.dia).padStart(2,'0')}`
    criados.push(criarDiaNaoLetivo({ data, descricao: f.desc, tipo: 'feriado' }))
  }
  for (const m of moveis) {
    const data = m.data.toISOString().split('T')[0]
    criados.push(criarDiaNaoLetivo({ data, descricao: m.desc, tipo: 'feriado' }))
  }
  return criados
}

// ─── Valores/Hora ─────────────────────────────────────────────────────────────

export function criarValorHora(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO valores_hora (disciplina_id, turma_id, valor_hora, ano_letivo)
    VALUES (@disciplina_id, @turma_id, @valor_hora, @ano_letivo)
  `)
  const result = stmt.run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function listarValoresHora(ano_letivo) {
  const db = getDb()
  if (ano_letivo) {
    return db.prepare(`
      SELECT vh.*, d.nome as disciplina_nome, t.designacao as turma_nome
      FROM valores_hora vh
      JOIN disciplinas d ON d.id = vh.disciplina_id
      LEFT JOIN turmas t ON t.id = vh.turma_id
      WHERE vh.ano_letivo = ?
    `).all(ano_letivo)
  }
  return db.prepare(`
    SELECT vh.*, d.nome as disciplina_nome, t.designacao as turma_nome
    FROM valores_hora vh
    JOIN disciplinas d ON d.id = vh.disciplina_id
    LEFT JOIN turmas t ON t.id = vh.turma_id
  `).all()
}

// ─── Financeiro ───────────────────────────────────────────────────────────────

export function calcularFinanceiroMensal(ano, mes) {
  const db = getDb()
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`

  const aulas = db.prepare(`
    SELECT a.*, t.disciplina_id, t.designacao as turma_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    WHERE strftime('%Y-%m', a.data) = ? AND a.estado != 'Cancelada'
  `).all(mesStr)

  const configFiscal = db.prepare('SELECT * FROM config_fiscal WHERE ano = ?').get(ano)
  const taxa_iva = configFiscal?.isento_iva ? 0 : (configFiscal?.taxa_iva || 0)
  const taxa_irs = configFiscal?.sem_retencao ? 0 : (configFiscal?.taxa_retencao_irs || 0.25)

  const porDisciplina = {}

  for (const aula of aulas) {
    // 1. Taxa específica da turma ou disciplina
    let valorHora = db.prepare(`
      SELECT valor_hora FROM valores_hora
      WHERE disciplina_id = ? AND (turma_id = ? OR turma_id IS NULL)
      ORDER BY turma_id DESC NULLS LAST
      LIMIT 1
    `).get(aula.disciplina_id, aula.turma_id)?.valor_hora

    // 2. Fallback: taxa do curso a que a disciplina pertence
    if (valorHora == null) {
      const disc = db.prepare('SELECT curso_id FROM disciplinas WHERE id = ?').get(aula.disciplina_id)
      if (disc?.curso_id) {
        const curso = db.prepare('SELECT valor_hora FROM cursos WHERE id = ?').get(disc.curso_id)
        valorHora = curso?.valor_hora
      }
    }

    if (valorHora == null) continue

    const inicio = aula.hora_inicio.split(':')
    const fim = aula.hora_fim.split(':')
    const horas = (parseInt(fim[0]) * 60 + parseInt(fim[1]) - parseInt(inicio[0]) * 60 - parseInt(inicio[1])) / 60

    if (!porDisciplina[aula.disciplina_id]) {
      const disc = db.prepare(`
        SELECT d.nome, d.curso_id, c.nome as curso_nome
        FROM disciplinas d LEFT JOIN cursos c ON c.id = d.curso_id WHERE d.id = ?
      `).get(aula.disciplina_id)
      porDisciplina[aula.disciplina_id] = {
        disciplina_id: aula.disciplina_id,
        disciplina_nome: disc?.nome || 'Desconhecida',
        curso_nome: disc?.curso_nome || null,
        total_horas: 0,
        valor_hora: valorHora,
        valor_bruto: 0
      }
    }

    porDisciplina[aula.disciplina_id].total_horas += horas
    porDisciplina[aula.disciplina_id].valor_bruto += horas * valorHora
  }

  const itens = Object.values(porDisciplina)
  const total_bruto = itens.reduce((s, i) => s + i.valor_bruto, 0)
  const total_iva = total_bruto * taxa_iva
  const total_com_iva = total_bruto + total_iva
  const total_irs = total_bruto * taxa_irs
  const total_liquido = total_com_iva - total_irs
  const total_horas = itens.reduce((s, i) => s + i.total_horas, 0)

  return {
    mes: mesStr,
    itens,
    total_horas,
    total_bruto,
    taxa_iva,
    total_iva,
    total_com_iva,
    taxa_irs,
    total_irs,
    total_liquido
  }
}

export function calcularFinanceiroAnual(ano) {
  const meses = []
  for (let m = 1; m <= 12; m++) {
    meses.push(calcularFinanceiroMensal(ano, m))
  }
  return meses
}

// ─── Config Fiscal ────────────────────────────────────────────────────────────

export function obterConfigFiscal(ano) {
  const db = getDb()
  return db.prepare('SELECT * FROM config_fiscal WHERE ano = ?').get(ano) || {
    ano,
    taxa_iva: 0,
    isento_iva: 0,
    taxa_retencao_irs: 0.25,
    sem_retencao: 0,
    notas: ''
  }
}

export function salvarConfigFiscal(dados) {
  const db = getDb()
  db.prepare(`
    INSERT INTO config_fiscal (ano, taxa_iva, isento_iva, taxa_retencao_irs, sem_retencao, notas)
    VALUES (@ano, @taxa_iva, @isento_iva, @taxa_retencao_irs, @sem_retencao, @notas)
    ON CONFLICT(ano) DO UPDATE SET
      taxa_iva=@taxa_iva, isento_iva=@isento_iva,
      taxa_retencao_irs=@taxa_retencao_irs, sem_retencao=@sem_retencao, notas=@notas
  `).run(dados)
  return obterConfigFiscal(dados.ano)
}

// ─── Configurações ────────────────────────────────────────────────────────────

export function obterConfiguracao(chave) {
  const db = getDb()
  const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave)
  return row ? row.valor : null
}

export function obterTodasConfiguracoes() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM configuracoes').all()
  const config = {}
  for (const row of rows) config[row.chave] = row.valor
  return config
}

export function salvarConfiguracao(chave, valor) {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run(chave, valor)
  return { chave, valor }
}

export function salvarConfiguracoes(pares) {
  const db = getDb()
  const stmt = db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)')
  const transaction = db.transaction(() => {
    for (const [chave, valor] of Object.entries(pares)) {
      stmt.run(chave, valor)
    }
  })
  transaction()
  return { success: true }
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────

export function obterEstatisticas(ano_letivo) {
  const db = getDb()

  const anoAtual = ano_letivo || new Date().getFullYear()
  const [anoInicio] = String(anoAtual).split('/')

  // Aulas por estado
  const porEstado = db.prepare(`
    SELECT estado, COUNT(*) as total FROM aulas
    WHERE strftime('%Y', data) = ?
    GROUP BY estado
  `).all(String(anoInicio))

  // Horas por disciplina
  const porDisciplina = db.prepare(`
    SELECT d.nome as disciplina_nome, d.cor,
           COUNT(a.id) as total_aulas,
           SUM((strftime('%H', a.hora_fim) * 60 + strftime('%M', a.hora_fim) -
                strftime('%H', a.hora_inicio) * 60 - strftime('%M', a.hora_inicio)) / 60.0) as total_horas
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y', a.data) = ? AND a.estado != 'Cancelada'
    GROUP BY d.id
    ORDER BY total_horas DESC
  `).all(String(anoInicio))

  // Evolução mensal
  const evolucaoMensal = db.prepare(`
    SELECT strftime('%Y-%m', data) as mes, COUNT(*) as total_aulas,
           SUM((strftime('%H', hora_fim) * 60 + strftime('%M', hora_fim) -
                strftime('%H', hora_inicio) * 60 - strftime('%M', hora_inicio)) / 60.0) as total_horas
    FROM aulas
    WHERE strftime('%Y', data) = ? AND estado != 'Cancelada'
    GROUP BY mes
    ORDER BY mes
  `).all(String(anoInicio))

  const totalAulas = porEstado.reduce((s, r) => s + r.total, 0)
  const realizadas = porEstado.find(r => r.estado === 'Realizada')?.total || 0
  const taxaConclusao = totalAulas > 0 ? (realizadas / totalAulas * 100).toFixed(1) : 0

  return { porEstado, porDisciplina, evolucaoMensal, totalAulas, realizadas, taxaConclusao }
}
