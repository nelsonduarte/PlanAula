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

export function sincronizarModulosUFCD(disciplina_id) {
  const db = getDb()
  const disc = db.prepare('SELECT * FROM disciplinas WHERE id = ?').get(disciplina_id)
  if (!disc || disc.tipo !== 'UFCD') return { sincronizadas: 0 }

  // Encontrar todas as disciplinas UFCD com o mesmo nome
  const irmãs = db.prepare('SELECT id FROM disciplinas WHERE nome = ? AND tipo = ? AND id != ?')
    .all(disc.nome, 'UFCD', disciplina_id)

  if (irmãs.length === 0) return { sincronizadas: 0 }

  const modulosOrigem = db.prepare('SELECT * FROM modulos WHERE disciplina_id = ? ORDER BY ordem').all(disciplina_id)
  // Não sincronizar se a origem está vazia — evita apagar módulos das irmãs sem ter como repor
  if (!modulosOrigem.length) return { sincronizadas: 0, motivo: 'origem_vazia' }

  let sincronizadas = 0
  const tx = db.transaction(() => {
    for (const irma of irmãs) {
      db.prepare('DELETE FROM modulos WHERE disciplina_id = ?').run(irma.id)
      for (const mod of modulosOrigem) {
        db.prepare('INSERT INTO modulos (disciplina_id, nome, ordem, horas, objetivos) VALUES (?, ?, ?, ?, ?)')
          .run(irma.id, mod.nome, mod.ordem, mod.horas, mod.objetivos)
      }
      sincronizadas++
    }
  })
  tx()
  return { sincronizadas }
}

// ─── Turmas ──────────────────────────────────────────────────────────────────

const TURMA_DEFAULTS = {
  ano_letivo: null, semestre: null, sala: null, cor: '#2E86C1',
  data_inicio: null, data_fim: null, carga_horaria: 0
}

export function criarTurma(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO turmas (disciplina_id, designacao, ano_letivo, semestre, sala, cor, data_inicio, data_fim, carga_horaria)
    VALUES (@disciplina_id, @designacao, @ano_letivo, @semestre, @sala, @cor, @data_inicio, @data_fim, @carga_horaria)
  `)
  const result = stmt.run({ ...TURMA_DEFAULTS, ...dados })
  return { id: result.lastInsertRowid, ...dados }
}

export function listarTurmas(disciplina_id) {
  const db = getDb()
  if (disciplina_id) {
    return db.prepare(`
      SELECT t.*, d.nome as disciplina_nome, d.tipo as disciplina_tipo,
             c.nome as curso_nome, i.nome as instituicao_nome
      FROM turmas t
      JOIN disciplinas d ON d.id = t.disciplina_id
      LEFT JOIN cursos c ON c.id = d.curso_id
      LEFT JOIN instituicoes i ON i.id = c.instituicao_id
      WHERE t.disciplina_id = ?
      ORDER BY t.ano_letivo DESC, t.designacao
    `).all(disciplina_id)
  }
  return db.prepare(`
    SELECT t.*, d.nome as disciplina_nome, d.tipo as disciplina_tipo,
           c.nome as curso_nome, i.nome as instituicao_nome
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    ORDER BY d.nome, t.ano_letivo DESC, t.designacao
  `).all()
}

export function buscarTurma(id) {
  const db = getDb()
  return db.prepare(`
    SELECT t.*, d.nome as disciplina_nome, d.tipo as disciplina_tipo,
           c.nome as curso_nome, i.nome as instituicao_nome
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    WHERE t.id = ?
  `).get(id)
}

export function editarTurma(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE turmas SET disciplina_id=@disciplina_id, designacao=@designacao,
      ano_letivo=@ano_letivo, semestre=@semestre, sala=@sala, cor=@cor,
      data_inicio=@data_inicio, data_fim=@data_fim, carga_horaria=@carga_horaria
    WHERE id=@id
  `).run({ ...TURMA_DEFAULTS, ...dados, id })
  return buscarTurma(id)
}

export function eliminarTurma(id) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM aulas WHERE turma_id = ?').run(id)
    db.prepare('DELETE FROM horarios WHERE turma_id = ?').run(id)
    db.prepare('DELETE FROM valores_hora WHERE turma_id = ?').run(id)
    db.prepare('DELETE FROM turmas WHERE id = ?').run(id)
  })
  tx()
  return { success: true }
}

// ─── Horários ─────────────────────────────────────────────────────────────────

export function criarHorario(dados) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO horarios (turma_id, dia_semana, hora_inicio, hora_fim, sala)
    VALUES (@turma_id, @dia_semana, @hora_inicio, @hora_fim, @sala)
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
    UPDATE horarios SET dia_semana=@dia_semana, hora_inicio=@hora_inicio, hora_fim=@hora_fim, sala=@sala WHERE id=@id
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

const AULA_DEFAULTS = {
  sala: null, sumario: null, observacoes_pos: null,
  objetivos: null, conteudos: null, atividades: null, recursos: null,
  avaliacao: null, notas: null, data_avaliacao: null
}

export function criarAula(dados) {
  const db = getDb()
  const numero = dados.numero != null ? dados.numero : proximoNumeroAula(dados.turma_id)
  const stmt = db.prepare(`
    INSERT INTO aulas (turma_id, modulo_id, data, hora_inicio, hora_fim, topico,
      objetivos, conteudos, atividades, recursos, avaliacao, notas, estado, numero, data_avaliacao, sala,
      sumario, observacoes_pos)
    VALUES (@turma_id, @modulo_id, @data, @hora_inicio, @hora_fim, @topico,
      @objetivos, @conteudos, @atividades, @recursos, @avaliacao, @notas, @estado, @numero, @data_avaliacao, @sala,
      @sumario, @observacoes_pos)
  `)
  const result = stmt.run({ ...AULA_DEFAULTS, ...dados, numero })
  return { id: result.lastInsertRowid, ...dados, numero }
}

export function listarAulas(filtros = {}) {
  const db = getDb()
  let query = `
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.id as disciplina_id, d.tipo as disciplina_tipo,
           c.nome as curso_nome, i.nome as instituicao_nome,
           m.nome as modulo_nome, COALESCE(a.sala, h.sala) as sala
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    LEFT JOIN modulos m ON m.id = a.modulo_id
    LEFT JOIN (
      SELECT turma_id, dia_semana, hora_inicio, MIN(sala) as sala
      FROM horarios GROUP BY turma_id, dia_semana, hora_inicio
    ) h ON h.turma_id = a.turma_id
          AND h.hora_inicio = a.hora_inicio
          AND CAST(strftime('%w', a.data) AS INTEGER) = h.dia_semana
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
    if (filtros.estado === 'Realizada') {
      // Aula passou: ou é dia anterior, ou é hoje e já terminou
      query += " AND a.estado NOT IN ('Adiada','Cancelada') AND (a.data < date('now') OR (a.data = date('now') AND a.hora_fim <= time('now')))"
    } else if (filtros.estado === 'Planeada') {
      // Aula ainda por dar: dia futuro, ou hoje mas ainda não terminou
      query += " AND a.estado NOT IN ('Adiada','Cancelada') AND (a.data > date('now') OR (a.data = date('now') AND a.hora_fim > time('now')))"
    } else {
      query += ' AND a.estado = ?'
      params.push(filtros.estado)
    }
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
           d.nome as disciplina_nome, d.id as disciplina_id, d.tipo as disciplina_tipo,
           c.nome as curso_nome, i.nome as instituicao_nome,
           m.nome as modulo_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
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
      numero=COALESCE(@numero, numero), data_avaliacao=@data_avaliacao,
      sumario=@sumario, observacoes_pos=@observacoes_pos,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...AULA_DEFAULTS, ...dados, numero: dados.numero ?? null, id })
  return buscarAula(id)
}

export function eliminarAula(id) {
  const db = getDb()
  db.prepare('DELETE FROM aulas WHERE id = ?').run(id)
  return { success: true }
}

export function eliminarAulasDaTurma(turma_id) {
  const db = getDb()
  const info = db.prepare('DELETE FROM aulas WHERE turma_id = ?').run(turma_id)
  return { success: true, eliminadas: info.changes }
}

export function eliminarAulasDaDisciplina(disciplina_id) {
  const db = getDb()
  const info = db.prepare(`
    DELETE FROM aulas WHERE turma_id IN (
      SELECT id FROM turmas WHERE disciplina_id = ?
    )
  `).run(disciplina_id)
  return { success: true, eliminadas: info.changes }
}

export function gerarAulasAutomatico(turma_id, data_inicio, data_fim) {
  const db = getDb()
  const turma = buscarTurma(turma_id)
  if (!turma) throw new Error('Turma não encontrada')

  const horarios = listarHorarios(turma_id)
  if (!horarios.length) throw new Error('Sem horários definidos para esta turma')

  // Carga horária da turma (com fallback para a disciplina)
  const carga_horaria = turma.carga_horaria || 0

  // Horas já planeadas para esta turma (excluindo canceladas)
  const rowExistentes = db.prepare(`
    SELECT COALESCE(SUM(
      (CAST(substr(hora_fim,1,2) AS INTEGER)*60 + CAST(substr(hora_fim,4,2) AS INTEGER)) -
      (CAST(substr(hora_inicio,1,2) AS INTEGER)*60 + CAST(substr(hora_inicio,4,2) AS INTEGER))
    ), 0) as total_min
    FROM aulas WHERE turma_id = ? AND estado != 'Cancelada'
  `).get(turma_id)
  const horas_existentes = (rowExistentes?.total_min || 0) / 60

  // Horas disponíveis (Infinity se carga_horaria não definida)
  const horas_disponiveis = carga_horaria > 0 ? Math.max(0, carga_horaria - horas_existentes) : Infinity

  // Duração em horas de cada slot de horário
  function slotHoras(h) {
    const [hi, mi] = h.hora_inicio.split(':').map(Number)
    const [hf, mf] = h.hora_fim.split(':').map(Number)
    return (hf * 60 + mf - hi * 60 - mi) / 60
  }

  // Carregar dias não lectivos individuais no intervalo
  const diasNaoLetivos = new Set(
    db.prepare('SELECT data FROM dias_nao_letivos WHERE data >= ? AND data <= ?')
      .all(data_inicio, data_fim)
      .map(r => r.data)
  )

  // Expandir períodos não letivos que se sobreponham ao intervalo
  // (períodos globais ou da instituição a que a turma pertence)
  const disc = db.prepare('SELECT curso_id FROM disciplinas WHERE id = ?').get(turma.disciplina_id)
  const instId = disc?.curso_id
    ? db.prepare('SELECT instituicao_id FROM cursos WHERE id = ?').get(disc.curso_id)?.instituicao_id
    : null

  const periodos = db.prepare(`
    SELECT data_inicio, data_fim FROM periodos_nao_letivos
    WHERE (data_fim >= ? AND data_inicio <= ?)
      AND (instituicao_id IS NULL ${instId ? 'OR instituicao_id = ?' : ''})
  `).all(...(instId ? [data_inicio, data_fim, instId] : [data_inicio, data_fim]))

  for (const p of periodos) {
    const cur = new Date(Math.max(new Date(p.data_inicio), new Date(data_inicio)))
    const fim = new Date(Math.min(new Date(p.data_fim), new Date(data_fim)))
    while (cur <= fim) {
      const y = cur.getUTCFullYear(), m = String(cur.getUTCMonth()+1).padStart(2,'0'), d = String(cur.getUTCDate()).padStart(2,'0')
      diasNaoLetivos.add(`${y}-${m}-${d}`)
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  const start = new Date(data_inicio)
  const end = new Date(data_fim)
  const aulas = []
  const conflitos = []
  let horas_geradas = 0
  let parar = false

  // Detecta conflito com outras turmas no mesmo dia/hora
  const stmtConflito = db.prepare(`
    SELECT a.id, t.designacao FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    WHERE a.data = ? AND a.turma_id != ? AND a.estado != 'Cancelada'
      AND a.hora_inicio < ? AND a.hora_fim > ?
    LIMIT 1
  `)

  const current = new Date(start)
  while (current <= end && !parar) {
    const y = current.getUTCFullYear(), mo = String(current.getUTCMonth()+1).padStart(2,'0'), d = String(current.getUTCDate()).padStart(2,'0')
    const dataStr = `${y}-${mo}-${d}`

    if (!diasNaoLetivos.has(dataStr)) {
      const diaSemana = current.getUTCDay()
      const horariosHoje = horarios.filter(h => parseInt(h.dia_semana) === diaSemana)

      for (const h of horariosHoje) {
        const duracaoSlot = slotHoras(h)

        const existente = db.prepare(
          'SELECT id FROM aulas WHERE turma_id=? AND data=? AND hora_inicio=?'
        ).get(turma_id, dataStr, h.hora_inicio)

        if (existente) continue

        let horaFim = h.hora_fim
        let duracaoReal = duracaoSlot

        if (carga_horaria > 0) {
          const horasRestantes = carga_horaria - horas_existentes - horas_geradas
          if (horasRestantes <= 0) { parar = true; break }

          if (duracaoSlot > horasRestantes) {
            // Ajustar hora_fim para completar exatamente a carga horária
            const [hi, mi] = h.hora_inicio.split(':').map(Number)
            const totalMin = hi * 60 + mi + Math.round(horasRestantes * 60)
            horaFim = `${String(Math.floor(totalMin / 60)).padStart(2,'0')}:${String(totalMin % 60).padStart(2,'0')}`
            duracaoReal = horasRestantes
          }
        }

        // Verificar conflito com outras turmas (mesmo dia, sobreposição de horário)
        const conf = stmtConflito.get(dataStr, turma_id, horaFim, h.hora_inicio)
        if (conf) {
          conflitos.push({ data: dataStr, hora_inicio: h.hora_inicio, hora_fim: horaFim, turma: conf.designacao })
          continue
        }

        const a = criarAula({
          turma_id, modulo_id: null, data: dataStr,
          hora_inicio: h.hora_inicio, hora_fim: horaFim,
          topico: '', objetivos: null, conteudos: null,
          atividades: null, recursos: null, avaliacao: null,
          notas: null, estado: 'Planeada', data_avaliacao: null
        })
        aulas.push(a)
        horas_geradas += duracaoReal
        if (carga_horaria > 0 && horas_existentes + horas_geradas >= carga_horaria) {
          parar = true
          break
        }
      }
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  const limite_atingido = carga_horaria > 0 && (horas_existentes + horas_geradas) >= carga_horaria
  return { aulas, horas_geradas, horas_existentes, carga_horaria, limite_atingido, conflitos }
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

const CURSO_DEFAULTS = {
  tem_componente_variavel: 0, valor_hora_variavel: null, taxa_padrao: 82
}

export function criarCurso(dados) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO cursos (instituicao_id, nome, tipo, ano_letivo, valor_hora, descricao, ativo,
                        tem_componente_variavel, valor_hora_variavel, taxa_padrao)
    VALUES (@instituicao_id, @nome, @tipo, @ano_letivo, @valor_hora, @descricao, @ativo,
            @tem_componente_variavel, @valor_hora_variavel, @taxa_padrao)
  `).run({ ...CURSO_DEFAULTS, ...dados })
  return { id: result.lastInsertRowid, ...dados }
}

export function listarCursos(instituicao_id) {
  const db = getDb()
  // valor_hora_efetivo: usa valor do curso; se não tiver, usa o valor_hora mais frequente nas turmas associadas
  const valorHoraEfetivo = `
    COALESCE(c.valor_hora, (
      SELECT vh.valor_hora FROM valores_hora vh
      JOIN turmas t ON t.id = vh.turma_id
      JOIN disciplinas d ON d.id = t.disciplina_id
      WHERE d.curso_id = c.id AND vh.valor_hora IS NOT NULL
      GROUP BY vh.valor_hora
      ORDER BY COUNT(*) DESC, vh.id DESC
      LIMIT 1
    )) as valor_hora_efetivo
  `
  if (instituicao_id) {
    return db.prepare(`
      SELECT c.*, i.nome as instituicao_nome, ${valorHoraEfetivo}
      FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id
      WHERE c.instituicao_id = ? ORDER BY c.nome
    `).all(instituicao_id)
  }
  return db.prepare(`
    SELECT c.*, i.nome as instituicao_nome, ${valorHoraEfetivo}
    FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    ORDER BY i.nome, c.nome
  `).all()
}

export function editarCurso(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE cursos SET instituicao_id=@instituicao_id, nome=@nome, tipo=@tipo,
      ano_letivo=@ano_letivo, valor_hora=@valor_hora, descricao=@descricao, ativo=@ativo,
      tem_componente_variavel=@tem_componente_variavel, valor_hora_variavel=@valor_hora_variavel,
      taxa_padrao=@taxa_padrao
    WHERE id=@id
  `).run({ ...CURSO_DEFAULTS, ...dados, id })
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

// ─── Professor Cargos ─────────────────────────────────────────────────────────

export function listarProfessorCargos() {
  const db = getDb()
  return db.prepare(`
    SELECT pc.*, i.nome as instituicao_nome_ref
    FROM professor_cargos pc
    LEFT JOIN instituicoes i ON i.id = pc.instituicao_id
    ORDER BY pc.ativo DESC, pc.instituicao_nome
  `).all()
}

export function criarProfessorCargo(dados) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO professor_cargos (instituicao_id, instituicao_nome, departamento, cargo, ativo)
    VALUES (@instituicao_id, @instituicao_nome, @departamento, @cargo, @ativo)
  `).run({ ...dados, instituicao_id: dados.instituicao_id || null, ativo: dados.ativo ?? 1 })
  return { id: result.lastInsertRowid, ...dados }
}

export function editarProfessorCargo(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE professor_cargos
    SET instituicao_id=@instituicao_id, instituicao_nome=@instituicao_nome,
        departamento=@departamento, cargo=@cargo, ativo=@ativo
    WHERE id=@id
  `).run({ ...dados, instituicao_id: dados.instituicao_id || null, id })
  return db.prepare('SELECT * FROM professor_cargos WHERE id = ?').get(id)
}

export function eliminarProfessorCargo(id) {
  const db = getDb()
  db.prepare('DELETE FROM professor_cargos WHERE id = ?').run(id)
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
    const d = m.data
    const data = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
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

// Constrói filtro SQL para limitar disciplinas por modo (UFCD vs UC).
// Devolve um fragmento SQL pronto para ser appended ou string vazia se 'todos'.
function filtroDisciplinaPorModo(modo, prefixoTabela = 'd') {
  if (modo === 'formacao') return ` AND ${prefixoTabela}.tipo = 'UFCD'`
  if (modo === 'ensino') return ` AND (${prefixoTabela}.tipo IS NULL OR ${prefixoTabela}.tipo != 'UFCD')`
  return ''
}

export function calcularFinanceiroMensal(ano, mes, modo = 'todos', incluirComponenteVariavel = false) {
  const db = getDb()
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`

  const filtroAulas = filtroDisciplinaPorModo(modo)
  const aulas = db.prepare(`
    SELECT a.*, t.disciplina_id, t.designacao as turma_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y-%m', a.data) = ? AND a.estado != 'Cancelada'${filtroAulas}
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

    // 2. Fallback: taxa do curso + dados da componente variável
    const disc = db.prepare('SELECT curso_id FROM disciplinas WHERE id = ?').get(aula.disciplina_id)
    const curso = disc?.curso_id
      ? db.prepare('SELECT valor_hora, tem_componente_variavel, valor_hora_variavel, taxa_padrao, nome FROM cursos WHERE id = ?').get(disc.curso_id)
      : null
    if (valorHora == null) valorHora = curso?.valor_hora

    if (valorHora == null) continue

    const inicio = aula.hora_inicio.split(':')
    const fim = aula.hora_fim.split(':')
    const horas = (parseInt(fim[0]) * 60 + parseInt(fim[1]) - parseInt(inicio[0]) * 60 - parseInt(inicio[1])) / 60

    if (!porDisciplina[aula.disciplina_id]) {
      const discInfo = db.prepare(`
        SELECT d.nome, d.curso_id, c.nome as curso_nome
        FROM disciplinas d LEFT JOIN cursos c ON c.id = d.curso_id WHERE d.id = ?
      `).get(aula.disciplina_id)
      porDisciplina[aula.disciplina_id] = {
        disciplina_id: aula.disciplina_id,
        disciplina_nome: discInfo?.nome || 'Desconhecida',
        curso_nome: discInfo?.curso_nome || null,
        total_horas: 0,
        valor_hora: valorHora,
        valor_bruto: 0,
        // Componente variável (Aprendizagem+): só somada se `incluirComponenteVariavel` e o curso a tem
        tem_componente_variavel: !!curso?.tem_componente_variavel,
        valor_hora_variavel: curso?.valor_hora_variavel || 0,
        taxa_padrao: curso?.taxa_padrao || 82,
        valor_variavel_potencial: 0,
      }
    }

    const linha = porDisciplina[aula.disciplina_id]
    linha.total_horas += horas
    linha.valor_bruto += horas * valorHora
    if (linha.tem_componente_variavel && linha.valor_hora_variavel > 0) {
      linha.valor_variavel_potencial += horas * linha.valor_hora_variavel
    }
  }

  // Aplicar componente variável ao valor_bruto consoante o toggle
  let total_variavel = 0
  for (const linha of Object.values(porDisciplina)) {
    if (incluirComponenteVariavel && linha.tem_componente_variavel) {
      linha.valor_bruto += linha.valor_variavel_potencial
      total_variavel += linha.valor_variavel_potencial
    }
  }

  // Outros rendimentos do mês
  const outrosRendimentos = db.prepare(
    "SELECT * FROM outros_rendimentos WHERE strftime('%Y-%m', data) = ? ORDER BY data"
  ).all(mesStr)
  const total_outros_bruto = outrosRendimentos.reduce((s, r) => s + r.valor, 0)

  const itens = Object.values(porDisciplina)
  const total_bruto_aulas = itens.reduce((s, i) => s + i.valor_bruto, 0)
  const total_bruto = total_bruto_aulas + total_outros_bruto
  const total_iva = total_bruto * taxa_iva
  const total_com_iva = total_bruto + total_iva
  const total_irs = total_bruto * taxa_irs
  const total_liquido = total_com_iva - total_irs
  const total_horas = itens.reduce((s, i) => s + i.total_horas, 0)

  // Soma do potencial da componente variável (esteja ou não incluída no total)
  const total_variavel_potencial = itens.reduce((s, i) => s + (i.valor_variavel_potencial || 0), 0)

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
    total_liquido,
    componente_variavel_incluida: !!incluirComponenteVariavel,
    total_variavel_potencial,
    total_variavel_aplicado: total_variavel,
  }
}

export function calcularFinanceiroAnual(ano, modo = 'todos', incluirComponenteVariavel = false) {
  const meses = []
  for (let m = 1; m <= 12; m++) {
    meses.push(calcularFinanceiroMensal(ano, m, modo, incluirComponenteVariavel))
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

// ─── Outros Rendimentos ──────────────────────────────────────────────────────

export function criarOutroRendimento(dados) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO outros_rendimentos (descricao, valor, data, tipo, notas)
    VALUES (@descricao, @valor, @data, @tipo, @notas)
  `).run(dados)
  return { id: result.lastInsertRowid, ...dados }
}

export function listarOutrosRendimentos(filtros = {}) {
  const db = getDb()
  let query = 'SELECT * FROM outros_rendimentos WHERE 1=1'
  const params = []
  if (filtros.ano) {
    query += " AND strftime('%Y', data) = ?"
    params.push(String(filtros.ano))
  }
  if (filtros.mes) {
    query += " AND strftime('%Y-%m', data) = ?"
    params.push(filtros.mes)
  }
  query += ' ORDER BY data DESC'
  return db.prepare(query).all(...params)
}

export function editarOutroRendimento(id, dados) {
  const db = getDb()
  db.prepare(`
    UPDATE outros_rendimentos SET descricao=@descricao, valor=@valor, data=@data, tipo=@tipo, notas=@notas WHERE id=@id
  `).run({ ...dados, id })
  return db.prepare('SELECT * FROM outros_rendimentos WHERE id = ?').get(id)
}

export function eliminarOutroRendimento(id) {
  const db = getDb()
  db.prepare('DELETE FROM outros_rendimentos WHERE id = ?').run(id)
  return { success: true }
}

// ─── Períodos Não Letivos ─────────────────────────────────────────────────────

export function listarPeriodosNaoLetivos(instituicao_id) {
  const db = getDb()
  if (instituicao_id) {
    return db.prepare(`
      SELECT p.*, i.nome as instituicao_nome
      FROM periodos_nao_letivos p
      LEFT JOIN instituicoes i ON i.id = p.instituicao_id
      WHERE p.instituicao_id = ? OR p.instituicao_id IS NULL
      ORDER BY p.data_inicio
    `).all(instituicao_id)
  }
  return db.prepare(`
    SELECT p.*, i.nome as instituicao_nome
    FROM periodos_nao_letivos p
    LEFT JOIN instituicoes i ON i.id = p.instituicao_id
    ORDER BY p.data_inicio
  `).all()
}

export function criarPeriodoNaoLetivo(dados) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO periodos_nao_letivos (instituicao_id, descricao, data_inicio, data_fim, tipo)
    VALUES (@instituicao_id, @descricao, @data_inicio, @data_fim, @tipo)
  `).run({ ...dados, instituicao_id: dados.instituicao_id || null })
  return db.prepare(`
    SELECT p.*, i.nome as instituicao_nome
    FROM periodos_nao_letivos p LEFT JOIN instituicoes i ON i.id = p.instituicao_id
    WHERE p.id = ?
  `).get(result.lastInsertRowid)
}

export function eliminarPeriodoNaoLetivo(id) {
  const db = getDb()
  db.prepare('DELETE FROM periodos_nao_letivos WHERE id = ?').run(id)
  return { success: true }
}

// ─── Notificações ─────────────────────────────────────────────────────────────

export function buscarAvaliacoesAmanha() {
  const db = getDb()
  return db.prepare(`
    SELECT a.data_avaliacao, a.topico, a.hora_inicio, a.hora_fim,
           t.designacao as turma_nome, d.nome as disciplina_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE a.data_avaliacao = date('now', '+1 day')
      AND a.estado != 'Cancelada'
    ORDER BY a.hora_inicio
  `).all()
}

// ─── Pesquisa Global ──────────────────────────────────────────────────────────

export function pesquisarGlobal(query) {
  const db = getDb()
  if (!query || query.trim().length < 2) return { aulas: [], turmas: [], disciplinas: [] }
  // Normaliza a query (lowercase + sem acentos) e usa a função SQL `normalizar` registada em db.js
  const q = `%${(query || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()}%`

  const aulas = db.prepare(`
    SELECT a.id, a.data, a.hora_inicio, a.hora_fim, a.topico, a.estado,
           t.designacao as turma_nome, t.cor as turma_cor, d.nome as disciplina_nome
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE normalizar(a.topico) LIKE ? OR normalizar(t.designacao) LIKE ?
       OR normalizar(d.nome) LIKE ? OR a.data LIKE ?
    ORDER BY a.data DESC LIMIT 8
  `).all(q, q, q, q)

  const turmas = db.prepare(`
    SELECT t.id, t.designacao, t.cor, t.ano_letivo, d.nome as disciplina_nome
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE normalizar(t.designacao) LIKE ? OR normalizar(d.nome) LIKE ?
    LIMIT 5
  `).all(q, q)

  const disciplinas = db.prepare(`
    SELECT id, nome, codigo, carga_horaria
    FROM disciplinas
    WHERE normalizar(nome) LIKE ? OR normalizar(codigo) LIKE ?
    LIMIT 5
  `).all(q, q)

  return { aulas, turmas, disciplinas }
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────

export function obterEstatisticas(ano_letivo, modo = 'todos') {
  const db = getDb()

  const anoAtual = ano_letivo || new Date().getFullYear()
  const [anoInicio] = String(anoAtual).split('/')
  const ano = String(anoInicio)

  const filtro = filtroDisciplinaPorModo(modo)
  // Para a query porEstado/evolucaoMensal/porDiaSemana (sem alias) usamos o JOIN explícito
  const filtroComJoin = filtroDisciplinaPorModo(modo)

  // Estado virtual: Adiada/Cancelada têm precedência; senão data passada=Realizada, futura=Planeada
  const estadoVirtual = `
    CASE
      WHEN a.estado IN ('Adiada','Cancelada') THEN a.estado
      WHEN a.data <= date('now') THEN 'Realizada'
      ELSE 'Planeada'
    END
  `
  const duracaoMinA = `(
    CAST(substr(a.hora_fim,1,2) AS INTEGER)*60 + CAST(substr(a.hora_fim,4,2) AS INTEGER) -
    CAST(substr(a.hora_inicio,1,2) AS INTEGER)*60 - CAST(substr(a.hora_inicio,4,2) AS INTEGER)
  )`

  // Aulas por estado (com lógica automática)
  const porEstado = db.prepare(`
    SELECT ${estadoVirtual} as estado, COUNT(*) as total
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y', a.data) = ?${filtroComJoin}
    GROUP BY 1
  `).all(ano)

  // Horas por disciplina (apenas aulas não canceladas)
  const porDisciplina = db.prepare(`
    SELECT d.nome as disciplina_nome,
           COUNT(a.id) as total_aulas,
           SUM(${duracaoMinA} / 60.0) as total_horas
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y', a.data) = ? AND a.estado != 'Cancelada'${filtro}
    GROUP BY d.id
    ORDER BY total_horas DESC
  `).all(ano)

  // Evolução mensal
  const evolucaoMensal = db.prepare(`
    SELECT strftime('%Y-%m', a.data) as mes,
           COUNT(*) as total_aulas,
           SUM(${duracaoMinA} / 60.0) as total_horas
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y', a.data) = ? AND a.estado != 'Cancelada'${filtro}
    GROUP BY mes ORDER BY mes
  `).all(ano)

  // Progresso por turma: horas dadas vs carga horária
  const porTurma = db.prepare(`
    SELECT t.designacao as turma_nome,
           d.nome as disciplina_nome,
           COALESCE(i.nome, 'Sem instituição') as instituicao_nome,
           t.carga_horaria,
           COUNT(a.id) as total_aulas,
           COALESCE(SUM(CASE WHEN a.estado != 'Cancelada' AND a.data <= date('now')
             THEN ${duracaoMinA} / 60.0 ELSE 0 END), 0) as horas_dadas,
           COALESCE(SUM(CASE WHEN a.estado != 'Cancelada'
             THEN ${duracaoMinA} / 60.0 ELSE 0 END), 0) as horas_total
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    LEFT JOIN aulas a ON a.turma_id = t.id AND strftime('%Y', a.data) = ?
    WHERE 1=1${filtro}
    GROUP BY t.id
    HAVING horas_total > 0
    ORDER BY horas_dadas DESC
  `).all(ano)

  // Distribuição por dia da semana (aulas já realizadas)
  const porDiaSemana = db.prepare(`
    SELECT CAST(strftime('%w', a.data) AS INTEGER) as dia,
           COUNT(*) as total_aulas,
           SUM(${duracaoMinA} / 60.0) as total_horas
    FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    JOIN disciplinas d ON d.id = t.disciplina_id
    WHERE strftime('%Y', a.data) = ?
      AND a.estado NOT IN ('Cancelada','Adiada')
      AND a.data <= date('now')${filtro}
    GROUP BY dia ORDER BY dia
  `).all(ano)

  const totalAulas = porEstado.reduce((s, r) => s + r.total, 0)
  const realizadas = porEstado.find(r => r.estado === 'Realizada')?.total || 0
  const adiadas = porEstado.find(r => r.estado === 'Adiada')?.total || 0
  const canceladas = porEstado.find(r => r.estado === 'Cancelada')?.total || 0
  const totalHoras = porDisciplina.reduce((s, d) => s + (d.total_horas || 0), 0)
  // Taxa de conclusão: % de aulas que efectivamente decorreram, entre as que já passaram
  const aulasPassadas = realizadas + adiadas + canceladas
  const taxaConclusao = aulasPassadas > 0
    ? (realizadas / aulasPassadas * 100).toFixed(1) : 0

  // Rendimento mensal por instituição (inclui "Outros" para outros_rendimentos)
  const rendimentoMensal = []
  for (let m = 1; m <= 12; m++) {
    const fin = calcularFinanceiroMensal(parseInt(ano), m, modo)
    if (fin.total_bruto === 0 && fin.total_outros_bruto === 0) continue
    const porInstituicao = {}
    for (const item of fin.itens) {
      // Buscar instituição via disciplina → curso → instituição
      const disc = db.prepare('SELECT curso_id FROM disciplinas WHERE id = ?').get(item.disciplina_id)
      let instNome = 'Sem instituição'
      if (disc?.curso_id) {
        const curso = db.prepare('SELECT i.nome FROM cursos c LEFT JOIN instituicoes i ON i.id = c.instituicao_id WHERE c.id = ?').get(disc.curso_id)
        if (curso?.nome) instNome = curso.nome
      }
      // Valor líquido = bruto - IRS (IVA é entregue ao Estado, não é rendimento próprio)
      porInstituicao[instNome] = (porInstituicao[instNome] || 0) + item.valor_bruto * (1 - fin.taxa_irs)
    }
    // Incluir "outros rendimentos" como bucket separado para o total bater certo com total_liquido
    if (fin.total_outros_bruto > 0) {
      porInstituicao['Outros'] = fin.total_outros_bruto * (1 - fin.taxa_irs)
    }
    rendimentoMensal.push({ mes: fin.mes, porInstituicao, total_liquido: fin.total_liquido })
  }

  return {
    porEstado, porDisciplina, evolucaoMensal, porTurma, porDiaSemana,
    totalAulas, realizadas, adiadas, canceladas, totalHoras, taxaConclusao,
    rendimentoMensal
  }
}

// ─── Exportação ───────────────────────────────────────────────────────────────

export function obterContextoExportTurma(turma_id) {
  const db = getDb()
  const duracaoMin = `(
    CAST(substr(a.hora_fim,1,2) AS INTEGER)*60 + CAST(substr(a.hora_fim,4,2) AS INTEGER) -
    CAST(substr(a.hora_inicio,1,2) AS INTEGER)*60 - CAST(substr(a.hora_inicio,4,2) AS INTEGER)
  )`

  const turma = db.prepare(`
    SELECT t.*, d.nome as disciplina_nome, d.codigo as disciplina_codigo, d.tipo as disciplina_tipo,
           d.carga_horaria as disciplina_carga, c.nome as curso_nome,
           COALESCE(i.nome, '') as instituicao_nome, COALESCE(i.tipo, '') as instituicao_tipo
    FROM turmas t
    JOIN disciplinas d ON d.id = t.disciplina_id
    LEFT JOIN cursos c ON c.id = d.curso_id
    LEFT JOIN instituicoes i ON i.id = c.instituicao_id
    WHERE t.id = ?
  `).get(turma_id)
  if (!turma) return null

  const aulas = db.prepare(`
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
  `).all(turma_id)

  // Calcular horas acumuladas por aula
  let horasAcumuladas = 0
  const aulasComContexto = aulas.map((a, idx) => {
    const hi = a.hora_inicio.split(':').map(Number)
    const hf = a.hora_fim.split(':').map(Number)
    const duracao = (hf[0] * 60 + hf[1] - hi[0] * 60 - hi[1]) / 60
    horasAcumuladas += duracao
    return { ...a, duracao, horasAcumuladas: parseFloat(horasAcumuladas.toFixed(1)), sequencia: idx + 1, totalAulas: aulas.length }
  })

  return {
    turma,
    aulas: aulasComContexto,
    isFormacao: turma.disciplina_tipo === 'UFCD',
    totalHoras: parseFloat(horasAcumuladas.toFixed(1))
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function obterDashboardStats() {
  const db = getDb()

  const duracaoMin = `(
    CAST(substr(a.hora_fim,1,2) AS INTEGER)*60 + CAST(substr(a.hora_fim,4,2) AS INTEGER) -
    CAST(substr(a.hora_inicio,1,2) AS INTEGER)*60 - CAST(substr(a.hora_inicio,4,2) AS INTEGER)
  )`

  // Aulas de hoje
  const aulasHoje = db.prepare(`
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.tipo as disciplina_tipo,
           c.nome as curso_nome, COALESCE(a.sala, h.sala) as sala,
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
  `).all()

  // Aulas de amanhã
  const aulasAmanha = db.prepare(`
    SELECT a.*, t.designacao as turma_nome, t.cor as turma_cor,
           d.nome as disciplina_nome, d.tipo as disciplina_tipo,
           c.nome as curso_nome, COALESCE(a.sala, h.sala) as sala,
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
  `).all()

  // Avaliações nos próximos 7 dias
  const avaliacoes = db.prepare(`
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
  `).all()

  // Horas esta semana (Seg–Dom da semana corrente)
  // `weekday 0` → próximo domingo (ou hoje se for domingo). `-6 days` → segunda dessa mesma semana.
  const horasSemana = db.prepare(`
    SELECT COALESCE(SUM(${duracaoMin} / 60.0), 0) as total
    FROM aulas a
    WHERE a.data BETWEEN date('now', 'weekday 0', '-6 days') AND date('now', 'weekday 0')
      AND a.estado NOT IN ('Cancelada')
  `).get()?.total || 0

  // Horas do mês por instituição
  const horasMesInst = db.prepare(`
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
  `).all()

  // Turmas a terminar (< 10% horas restantes)
  const turmasTerminar = db.prepare(`
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
  `).all()

  // Aulas sem preparação (próximas 2 semanas)
  const semPreparar = db.prepare(`
    SELECT COUNT(*) as total FROM aulas
    WHERE data BETWEEN date('now') AND date('now', '+14 days')
      AND estado NOT IN ('Cancelada', 'Adiada')
      AND (topico IS NULL OR topico = '')
  `).get()?.total || 0

  // Aulas realizadas sem sumário registado (últimas 4 semanas)
  const semSumario = db.prepare(`
    SELECT COUNT(*) as total FROM aulas
    WHERE data BETWEEN date('now', '-28 days') AND date('now')
      AND estado = 'Realizada'
      AND (sumario IS NULL OR sumario = '')
  `).get()?.total || 0

  return { aulasHoje, aulasAmanha, avaliacoes, horasSemana, horasMesInst, turmasTerminar, semPreparar, semSumario }
}
