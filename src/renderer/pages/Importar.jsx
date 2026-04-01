import React, { useState } from 'react'
import * as XLSX from 'xlsx'

// IPC handlers retornam { success, data } — este helper extrai data ou lança erro
async function ipc(fn) {
  const res = await fn()
  if (res && res.success !== undefined) {
    if (!res.success) throw new Error(res.error || 'Erro desconhecido')
    return res.data
  }
  return res // alguns handlers retornam directamente o valor
}

// ─── Template Download ────────────────────────────────────────────────────────

function gerarTemplate() {
  const wb = XLSX.utils.book_new()

  // ── Instruções ──
  const instrucoes = [
    ['PlanAula — Template de Importação'],
    [''],
    ['INSTRUÇÕES:'],
    ['1. Preencha cada folha com os seus dados (não altere os cabeçalhos).'],
    ['2. Campos marcados com * são obrigatórios.'],
    ['3. Datas: aceita AAAA-MM-DD (2025-09-01), DD-MM-AAAA (01-09-2025) ou o formato de data do Excel.'],
    ['4. Dia da semana: 0=Domingo  1=Segunda  2=Terça  3=Quarta  4=Quinta  5=Sexta  6=Sábado.'],
    ['5. Horas no formato HH:MM (ex: 09:00).'],
    ['6. Cor das turmas em formato hexadecimal (ex: #2E86C1). Deixe em branco para usar a cor padrão.'],
    [''],
    ['ORDEM DE IMPORTAÇÃO:'],
    ['  Configurações  →  Instituições  →  Períodos Não Letivos  →  Cursos'],
    ['  →  Disciplinas  →  Módulos  →  Turmas  →  Horários'],
    ['  →  Aulas (geradas automaticamente)'],
    [''],
    ['  • Períodos Não Letivos referenciam "instituicao_nome" de Instituições (opcional)'],
    ['  • Cursos      referenciam "instituicao_nome" de Instituições'],
    ['  • Disciplinas referenciam "curso_nome" de Cursos'],
    ['  • Módulos     referenciam "disciplina_nome" de Disciplinas'],
    ['  • Turmas      referenciam "disciplina_nome" de Disciplinas; campo "valor_hora" define a taxa horária'],
    ['  • Horários    referenciam "turma_designacao" + "disciplina_nome" de Turmas'],
    [''],
    ['  GERAÇÃO AUTOMÁTICA DE AULAS:'],
    ['  Após importar os Horários, as aulas são geradas automaticamente para todas as turmas'],
    ['  que tenham data_inicio, data_fim e carga_horaria definidas.'],
    ['  Aulas já existentes são ignoradas (sem duplicados).'],
    [''],
    ['Registos já existentes com o mesmo nome serão ignorados (sem duplicados).'],
  ]
  const wsInst = XLSX.utils.aoa_to_sheet(instrucoes)
  wsInst['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instruções')

  // ── Configurações ──
  const wsCfg = XLSX.utils.aoa_to_sheet([
    ['nome_professor', 'instituicao', 'departamento', 'ano_letivo_atual'],
    ['Prof. João Silva', 'Universidade do Porto', 'Departamento de Informática', '2025/2026'],
  ])
  wsCfg['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 35 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsCfg, 'Configurações')

  // ── Instituições ──
  const wsI = XLSX.utils.aoa_to_sheet([
    ['nome *', 'tipo', 'contacto', 'notas'],
    ['Universidade do Porto', 'universitária', 'geral@up.pt', ''],
    ['Instituto Politécnico de Coimbra', 'politécnica', 'geral@ipc.pt', ''],
  ])
  wsI['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 25 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsI, 'Instituições')

  // ── Períodos Não Letivos ──
  const wsPNL = XLSX.utils.aoa_to_sheet([
    ['descricao *', 'data_inicio *', 'data_fim *', 'tipo', 'instituicao_nome'],
    ['Natal', '2025-12-22', '2026-01-05', 'férias', ''],
    ['Carnaval', '2026-02-16', '2026-02-18', 'férias', ''],
    ['Páscoa', '2026-04-02', '2026-04-13', 'férias', ''],
    ['Verão', '2026-07-01', '2026-09-14', 'férias', 'Universidade do Porto'],
  ])
  wsPNL['!cols'] = [{ wch: 25 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsPNL, 'Períodos Não Letivos')

  // ── Cursos ──
  const wsC = XLSX.utils.aoa_to_sheet([
    ['nome *', 'instituicao_nome *', 'tipo', 'ano_letivo', 'descricao'],
    ['Engenharia Informática', 'Universidade do Porto', 'semestral', '2025/2026', ''],
    ['Gestão e Administração', 'Instituto Politécnico de Coimbra', 'semestral', '2025/2026', ''],
  ])
  wsC['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsC, 'Cursos')

  // ── Disciplinas ──
  const wsD = XLSX.utils.aoa_to_sheet([
    ['nome *', 'codigo', 'tipo', 'area_cientifica', 'ects', 'descricao', 'curso_nome *'],
    ['Programação Web', 'PW101', 'Teórica', 'Informática', 6, '', 'Engenharia Informática'],
    ['Bases de Dados', 'BD102', 'Teórico-Prática', 'Informática', 4, '', 'Engenharia Informática'],
    ['Gestão de Projetos', 'GP201', 'Seminário', 'Gestão', 3, '', 'Gestão e Administração'],
  ])
  wsD['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 6 }, { wch: 20 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, wsD, 'Disciplinas')

  // ── Módulos ──
  const wsMod = XLSX.utils.aoa_to_sheet([
    ['disciplina_nome *', 'nome *', 'ordem', 'horas', 'objetivos'],
    ['Programação Web', 'HTML e CSS', 1, 10, 'Construir páginas web estáticas'],
    ['Programação Web', 'JavaScript', 2, 20, 'Programação client-side'],
    ['Programação Web', 'Frameworks', 3, 30, 'React e Vue.js'],
    ['Bases de Dados', 'Modelo Relacional', 1, 15, 'Modelação de dados'],
    ['Bases de Dados', 'SQL', 2, 20, 'Consultas e manipulação de dados'],
  ])
  wsMod['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsMod, 'Módulos')

  // ── Turmas ──
  const wsT = XLSX.utils.aoa_to_sheet([
    ['designacao *', 'disciplina_nome *', 'ano_letivo *', 'carga_horaria', 'data_inicio', 'data_fim', 'semestre', 'cor', 'valor_hora'],
    ['Turma A', 'Programação Web', '2025/2026', 60, '2025-09-15', '2026-01-31', 1, '#2E86C1', 30],
    ['Turma B', 'Programação Web', '2025/2026', 60, '2025-09-15', '2026-01-31', 2, '#27AE60', 30],
    ['Turma A', 'Bases de Dados', '2025/2026', 45, '2025-09-15', '2026-01-31', 1, '#8E44AD', 25],
  ])
  wsT['!cols'] = [{ wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsT, 'Turmas')

  // ── Horários ──
  const wsH = XLSX.utils.aoa_to_sheet([
    ['turma_designacao *', 'disciplina_nome *', 'dia_semana *', 'hora_inicio *', 'hora_fim *', 'sala'],
    ['Turma A', 'Programação Web', 2, '09:00', '11:00', 'Sala 101'],
    ['Turma A', 'Programação Web', 4, '14:00', '16:00', 'Sala 101'],
    ['Turma B', 'Programação Web', 3, '10:00', '12:00', 'Sala 203'],
    ['Turma A', 'Bases de Dados', 5, '09:00', '11:00', 'Sala 205'],
  ])
  wsH['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsH, 'Horários')

  XLSX.writeFile(wb, 'PlanAula_Template.xlsx')
}

function gerarTemplateFormacao() {
  const wb = XLSX.utils.book_new()

  // ── Instruções ──
  const instrucoes = [
    ['PlanAula — Template de Formação Profissional'],
    [''],
    ['INSTRUÇÕES:'],
    ['1. Preencha cada folha com os seus dados (não altere os cabeçalhos).'],
    ['2. Campos marcados com * são obrigatórios.'],
    ['3. Datas: aceita AAAA-MM-DD (2025-09-01), DD-MM-AAAA (01-09-2025) ou o formato de data do Excel.'],
    ['4. Horas no formato HH:MM (ex: 09:00).'],
    [''],
    ['ORDEM DE IMPORTAÇÃO:'],
    ['  Instituições  →  Cursos  →  UFCDs  →  Turmas  →  Sessões'],
    [''],
    ['  • Cursos  referenciam "instituicao_nome" de Instituições'],
    ['  • UFCDs   referenciam "curso_nome" de Cursos'],
    ['  • Turmas  referenciam "ufcd_nome" de UFCDs; campo "valor_hora" define a taxa horária'],
    ['  • Sessões referenciam "turma_designacao" + "ufcd_nome" de Turmas'],
    [''],
    ['  SESSÕES (em vez de Horários):'],
    ['  Cada linha da folha Sessões é uma aula concreta com data e hora.'],
    ['  Preencha com base no cronograma recebido.'],
    ['  Não há geração automática — as aulas são criadas exactamente como definidas.'],
    [''],
    ['Registos já existentes com o mesmo nome serão ignorados (sem duplicados).'],
  ]
  const wsInst = XLSX.utils.aoa_to_sheet(instrucoes)
  wsInst['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instruções')

  // ── Instituições ──
  const wsI = XLSX.utils.aoa_to_sheet([
    ['nome *', 'tipo', 'contacto', 'notas'],
    ['IEFP - Centro de Formação de Santarém', 'formação', 'santarem@iefp.pt', ''],
  ])
  wsI['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 25 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsI, 'Instituições')

  // ── Cursos ──
  const wsC = XLSX.utils.aoa_to_sheet([
    ['nome *', 'instituicao_nome *', 'tipo', 'ano_letivo', 'descricao'],
    ['EFA - Técnico de Informática', 'IEFP - Centro de Formação de Santarém', 'formação', '2025/2026', ''],
  ])
  wsC['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsC, 'Cursos')

  // ── UFCDs ──
  const wsU = XLSX.utils.aoa_to_sheet([
    ['nome *', 'codigo', 'carga_horaria', 'descricao', 'curso_nome *'],
    ['Estrutura de um programa', '0649', 25, '', 'EFA - Técnico de Informática'],
    ['Introdução às bases de dados', '0650', 25, '', 'EFA - Técnico de Informática'],
    ['Programação em C/C++', '0651', 50, '', 'EFA - Técnico de Informática'],
  ])
  wsU['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsU, 'UFCDs')

  // ── Turmas ──
  const wsT = XLSX.utils.aoa_to_sheet([
    ['designacao *', 'ufcd_nome *', 'ano_letivo *', 'carga_horaria', 'data_inicio', 'data_fim', 'cor', 'valor_hora'],
    ['Turma EFA-T1', 'Estrutura de um programa', '2025/2026', 25, '2026-04-15', '2026-05-15', '#E74C3C', 18],
    ['Turma EFA-T1', 'Introdução às bases de dados', '2025/2026', 25, '2026-05-16', '2026-06-15', '#3498DB', 18],
    ['Turma EFA-T1', 'Programação em C/C++', '2025/2026', 50, '2026-06-16', '2026-08-15', '#2ECC71', 18],
  ])
  wsT['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsT, 'Turmas')

  // ── Sessões ──
  const wsS = XLSX.utils.aoa_to_sheet([
    ['turma_designacao *', 'ufcd_nome *', 'data *', 'hora_inicio *', 'hora_fim *', 'sala'],
    ['Turma EFA-T1', 'Estrutura de um programa', '15-04-2026', '09:00', '13:00', 'Sala 3'],
    ['Turma EFA-T1', 'Estrutura de um programa', '16-04-2026', '14:00', '17:00', 'Sala 3'],
    ['Turma EFA-T1', 'Estrutura de um programa', '22-04-2026', '09:00', '13:00', 'Sala 3'],
    ['Turma EFA-T1', 'Estrutura de um programa', '23-04-2026', '14:00', '17:00', 'Sala 3'],
    ['Turma EFA-T1', 'Estrutura de um programa', '29-04-2026', '09:00', '13:00', 'Sala 3'],
    ['Turma EFA-T1', 'Estrutura de um programa', '30-04-2026', '14:00', '18:00', 'Sala 3'],
  ])
  wsS['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsS, 'Sessões')

  XLSX.writeFile(wb, 'PlanAula_Template_Formacao.xlsx')
}

// ─── Helper: sheet → JSON ─────────────────────────────────────────────────────

function parseSheet(wb, name) {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

// Normalise header keys: remove " *" suffix, trim
function norm(row, key) {
  for (const k of Object.keys(row)) {
    if (k.replace(' *', '').trim() === key) return String(row[k]).trim()
  }
  return ''
}
function normNum(row, key, def = 0) {
  const v = norm(row, key)
  return v === '' ? def : Number(v)
}

// Excel guarda datas como número serial (dias desde 1899-12-30)
// Também aceita strings dd-mm-yyyy, dd/mm/yyyy e yyyy-mm-dd
function normDate(row, key) {
  const raw = row[key] ?? row[key + ' *']
  if (typeof raw === 'number' && raw > 0) {
    const d = new Date((raw - 25569) * 86400 * 1000)
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const v = (norm(row, key) || '').trim()
  if (!v) return ''
  // dd-mm-yyyy ou dd/mm/yyyy → yyyy-mm-dd
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return v // assume já está em yyyy-mm-dd
}

// Excel guarda horas como fracção decimal do dia (ex: 09:30 → 0.395833...)
function normTime(row, key, def = '09:00') {
  const raw = row[key] ?? row[key + ' *']
  if (typeof raw === 'number') {
    const totalMin = Math.round(raw * 24 * 60)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const v = norm(row, key)
  return v || def
}

// ─── Import Logic ─────────────────────────────────────────────────────────────

async function importarWorkbook(wb, setProgresso) {
  const log = []
  const erros = []

  function ok(msg) { log.push(msg); setProgresso(p => [...p, { tipo: 'ok', msg }]) }
  function err(msg) { erros.push(msg); setProgresso(p => [...p, { tipo: 'err', msg }]) }
  function info(msg) { setProgresso(p => [...p, { tipo: 'info', msg }]) }

  // ── Configurações ──
  info('A importar Configurações…')
  const rowsCfg = parseSheet(wb, 'Configurações')
  if (rowsCfg.length > 0) {
    const row = rowsCfg[0]
    const campos = ['nome_professor', 'instituicao', 'departamento', 'ano_letivo_atual']
    for (const chave of campos) {
      const valor = norm(row, chave)
      if (valor) {
        try {
          await ipc(() => window.api.configuracoes.salvar({ [chave]: valor }))
          ok(`Configuração guardada: ${chave} = ${valor}`)
        } catch (e) { err(`Configuração "${chave}": ${e.message}`) }
      }
    }
  }

  // ── Instituições ──
  info('A importar Instituições…')
  const rowsI = parseSheet(wb, 'Instituições')
  let instituicoes = await ipc(() => window.api.instituicoes.listar())
  for (const row of rowsI) {
    const nome = norm(row, 'nome')
    if (!nome) continue
    if (instituicoes.find(i => i.nome === nome)) {
      ok(`Instituição já existe: ${nome}`)
      continue
    }
    try {
      await ipc(() => window.api.instituicoes.criar({
        nome,
        tipo: norm(row, 'tipo') || 'universitária',
        contacto: norm(row, 'contacto') || null,
        notas: norm(row, 'notas') || null,
      }))
      ok(`Instituição criada: ${nome}`)
    } catch (e) { err(`Instituição "${nome}": ${e.message}`) }
  }
  instituicoes = await ipc(() => window.api.instituicoes.listar())

  // ── Períodos Não Letivos ──
  info('A importar Períodos Não Letivos…')
  const rowsPNL = parseSheet(wb, 'Períodos Não Letivos')
  const periodosExist = await ipc(() => window.api.periodosNaoLetivos.listar())
  for (const row of rowsPNL) {
    const descricao = norm(row, 'descricao')
    const dataInicio = normDate(row, 'data_inicio')
    const dataFim = normDate(row, 'data_fim')
    if (!descricao || !dataInicio || !dataFim) continue
    if (periodosExist.find(p => p.descricao === descricao && p.data_inicio === dataInicio)) {
      ok(`Período já existe: ${descricao} (${dataInicio})`)
      continue
    }
    const instNome = norm(row, 'instituicao_nome')
    const inst = instNome ? instituicoes.find(i => i.nome === instNome) : null
    try {
      await ipc(() => window.api.periodosNaoLetivos.criar({
        descricao,
        data_inicio: dataInicio,
        data_fim: dataFim,
        tipo: norm(row, 'tipo') || 'férias',
        instituicao_id: inst?.id || null,
      }))
      ok(`Período criado: ${descricao} (${dataInicio} → ${dataFim})`)
    } catch (e) { err(`Período "${descricao}": ${e.message}`) }
  }

  // ── Cursos ──
  info('A importar Cursos…')
  const rowsC = parseSheet(wb, 'Cursos')
  let cursos = await ipc(() => window.api.cursos.listar())
  for (const row of rowsC) {
    const nome = norm(row, 'nome')
    const instNome = norm(row, 'instituicao_nome')
    if (!nome) continue
    if (cursos.find(c => c.nome === nome)) {
      ok(`Curso já existe: ${nome}`)
      continue
    }
    const inst = instituicoes.find(i => i.nome === instNome)
    if (instNome && !inst) {
      err(`Curso "${nome}": instituição "${instNome}" não encontrada`)
      continue
    }
    try {
      await ipc(() => window.api.cursos.criar({
        nome,
        instituicao_id: inst?.id || null,
        tipo: norm(row, 'tipo') || 'semestral',
        ano_letivo: norm(row, 'ano_letivo') || null,
        valor_hora: null,
        descricao: norm(row, 'descricao') || null,
        ativo: 1,
      }))
      ok(`Curso criado: ${nome}`)
    } catch (e) { err(`Curso "${nome}": ${e.message}`) }
  }
  cursos = await ipc(() => window.api.cursos.listar())

  // ── Disciplinas ──
  info('A importar Disciplinas…')
  const rowsD = parseSheet(wb, 'Disciplinas')
  let disciplinas = await ipc(() => window.api.disciplinas.listar())
  for (const row of rowsD) {
    const nome = norm(row, 'nome')
    const cursoNome = norm(row, 'curso_nome')
    if (!nome) continue
    if (disciplinas.find(d => d.nome === nome && d.curso_nome === cursoNome)) {
      ok(`Disciplina já existe: ${nome}`)
      continue
    }
    const curso = cursos.find(c => c.nome === cursoNome)
    if (cursoNome && !curso) {
      err(`Disciplina "${nome}": curso "${cursoNome}" não encontrado`)
      continue
    }
    try {
      // leitura directa como fallback ao norm (headers sem asterisco)
      const tipo = norm(row, 'tipo') || row['tipo'] || 'Teórica'
      await ipc(() => window.api.disciplinas.criar({
        nome,
        codigo: norm(row, 'codigo') || null,
        area_cientifica: norm(row, 'area_cientifica') || '',
        carga_horaria: 0,
        ects: normNum(row, 'ects'),
        tipo,
        descricao: norm(row, 'descricao') || null,
        curso_id: curso?.id || null,
      }))
      ok(`Disciplina criada: ${nome}`)
    } catch (e) { err(`Disciplina "${nome}": ${e.message}`) }
  }
  disciplinas = await ipc(() => window.api.disciplinas.listar())

  // ── UFCDs (template formação — importadas como disciplinas) ──
  const rowsUFCD = parseSheet(wb, 'UFCDs')
  if (rowsUFCD.length > 0) {
    info('A importar UFCDs…')
    for (const row of rowsUFCD) {
      const nome = norm(row, 'nome')
      const cursoNome = norm(row, 'curso_nome')
      if (!nome) continue
      if (disciplinas.find(d => d.nome === nome && d.curso_nome === cursoNome)) {
        ok(`UFCD já existe: ${nome}`)
        continue
      }
      const curso = cursos.find(c => c.nome === cursoNome)
      if (cursoNome && !curso) {
        err(`UFCD "${nome}": curso "${cursoNome}" não encontrado`)
        continue
      }
      try {
        await ipc(() => window.api.disciplinas.criar({
          nome,
          codigo: norm(row, 'codigo') || null,
          area_cientifica: null,
          carga_horaria: normNum(row, 'carga_horaria') || normNum(row, 'horas', 0),
          ects: null,
          tipo: 'UFCD',
          descricao: norm(row, 'descricao') || null,
          curso_id: curso?.id || null,
        }))
        ok(`UFCD criada: ${nome}`)
      } catch (e) { err(`UFCD "${nome}": ${e.message}`) }
    }
    disciplinas = await ipc(() => window.api.disciplinas.listar())
  }

  // ── Módulos ──
  info('A importar Módulos…')
  const rowsMod = parseSheet(wb, 'Módulos')
  for (const row of rowsMod) {
    const discNome = norm(row, 'disciplina_nome')
    const nome = norm(row, 'nome')
    if (!discNome || !nome) continue
    const disc = disciplinas.find(d => d.nome === discNome)
    if (!disc) {
      err(`Módulo "${nome}": disciplina "${discNome}" não encontrada`)
      continue
    }
    try {
      const modulosExist = await ipc(() => window.api.modulos.listar(disc.id))
      if (modulosExist.find(m => m.nome === nome)) {
        ok(`Módulo já existe: ${nome} (${discNome})`)
        continue
      }
      await ipc(() => window.api.modulos.criar({
        disciplina_id: disc.id,
        nome,
        ordem: normNum(row, 'ordem', 0),
        horas: normNum(row, 'horas', 0) || null,
        objetivos: norm(row, 'objetivos') || null,
      }))
      ok(`Módulo criado: ${nome} (${discNome})`)
    } catch (e) { err(`Módulo "${nome}": ${e.message}`) }
  }

  // ── Turmas ──
  info('A importar Turmas…')
  const rowsT = parseSheet(wb, 'Turmas')
  let turmas = await ipc(() => window.api.turmas.listar())
  for (const row of rowsT) {
    const designacao = norm(row, 'designacao')
    const discNome = norm(row, 'disciplina_nome') || norm(row, 'ufcd_nome')
    const anoLetivo = norm(row, 'ano_letivo') || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
    if (!designacao) continue
    const disc = disciplinas.find(d => d.nome === discNome)
    if (!disc) {
      err(`Turma "${designacao}": disciplina "${discNome}" não encontrada`)
      continue
    }
    const turmaExistente = turmas.find(t => t.designacao === designacao && t.disciplina_id === disc.id)
    if (turmaExistente) {
      // actualizar datas se estiverem em falta
      const dataInicio = normDate(row, 'data_inicio') || null
      const dataFim = normDate(row, 'data_fim') || null
      const dataValida = v => v && /^\d{4}-\d{2}-\d{2}$/.test(v)
      if ((dataInicio && !dataValida(turmaExistente.data_inicio)) || (dataFim && !dataValida(turmaExistente.data_fim))) {
        try {
          await ipc(() => window.api.turmas.editar(turmaExistente.id, {
            ...turmaExistente,
            data_inicio: dataInicio || turmaExistente.data_inicio,
            data_fim: dataFim || turmaExistente.data_fim,
          }))
          ok(`Turma actualizada (datas): ${designacao} (${discNome})`)
        } catch (e) { ok(`Turma já existe: ${designacao} (${discNome})`) }
      } else {
        ok(`Turma já existe: ${designacao} (${discNome})`)
      }
      continue
    }
    try {
      const turmaCreated = await ipc(() => window.api.turmas.criar({
        designacao,
        disciplina_id: disc.id,
        ano_letivo: anoLetivo,
        semestre: normNum(row, 'semestre', 1),
        sala: null,
        data_inicio: normDate(row, 'data_inicio') || null,
        data_fim: normDate(row, 'data_fim') || null,
        carga_horaria: normNum(row, 'carga_horaria', 0),
        cor: norm(row, 'cor') || '#2E86C1',
      }))
      const valorHora = normNum(row, 'valor_hora', 0)
      if (valorHora && turmaCreated?.id) {
        await ipc(() => window.api.financeiro.salvarValorHora({
          disciplina_id: disc.id,
          turma_id: turmaCreated.id,
          valor_hora: valorHora,
          ano_letivo: anoLetivo,
        }))
      }
      ok(`Turma criada: ${designacao} (${discNome})${valorHora ? ` — ${valorHora}€/h` : ''}`)
    } catch (e) { err(`Turma "${designacao}": ${e.message}`) }
  }
  turmas = await ipc(() => window.api.turmas.listar())

  // ── Detectar tipo de template: Sessões (formação) ou Horários (ensino) ──
  const isFormacao = wb.Sheets['Sessões'] != null
  const rowsH = isFormacao ? [] : parseSheet(wb, 'Horários')

  if (isFormacao) {
    // ── Sessões (formação profissional) ──
    info('A importar Sessões…')
    const rowsSessoes = parseSheet(wb, 'Sessões')

    // Limpar aulas existentes das turmas que vão ser importadas
    const turmasLimpas = new Set()
    for (const row of rowsSessoes) {
      const turmaDesig = norm(row, 'turma_designacao') || norm(row, 'turma_nome')
      const discNome = norm(row, 'ufcd_nome') || norm(row, 'disciplina_nome')
      if (!turmaDesig) continue
      const disc = discNome ? disciplinas.find(d => d.nome === discNome) : null
      const turma = disc
        ? turmas.find(t => t.designacao === turmaDesig && t.disciplina_id === disc.id)
        : turmas.find(t => t.designacao === turmaDesig)
      if (turma && !turmasLimpas.has(turma.id)) {
        turmasLimpas.add(turma.id)
        const res = await ipc(() => window.api.aulas.eliminarDaTurma(turma.id))
        if (res?.eliminadas > 0) info(`  Aulas anteriores eliminadas: ${turma.designacao} — ${res.eliminadas} aulas`)
      }
    }

    let totalSessoes = 0
    let totalHoras = 0
    for (const row of rowsSessoes) {
      const turmaDesig = norm(row, 'turma_designacao') || norm(row, 'turma_nome')
      const discNome = norm(row, 'ufcd_nome') || norm(row, 'disciplina_nome')
      const data = normDate(row, 'data')
      const horaInicio = normTime(row, 'hora_inicio')
      const horaFim = normTime(row, 'hora_fim', '13:00')
      const sala = norm(row, 'sala') || null
      if (!turmaDesig || !data) continue

      const disc = discNome ? disciplinas.find(d => d.nome === discNome) : null
      const turma = disc
        ? turmas.find(t => t.designacao === turmaDesig && t.disciplina_id === disc.id)
        : turmas.find(t => t.designacao === turmaDesig)

      if (!turma) {
        err(`Sessão: turma "${turmaDesig}"${discNome ? ` (${discNome})` : ''} não encontrada`)
        continue
      }
      try {
        await ipc(() => window.api.aulas.criar({
          turma_id: turma.id, modulo_id: null, data, hora_inicio: horaInicio, hora_fim: horaFim,
          topico: '', objetivos: null, conteudos: null, atividades: null, recursos: null,
          avaliacao: null, notas: null, estado: 'Planeada', data_avaliacao: null, sala,
        }))
        totalSessoes++
        const [hi, mi] = horaInicio.split(':').map(Number)
        const [hf, mf] = horaFim.split(':').map(Number)
        totalHoras += (hf * 60 + mf - hi * 60 - mi) / 60
      } catch (e) { err(`Sessão "${turmaDesig}" ${data}: ${e.message}`) }
    }
    if (totalSessoes > 0) ok(`${totalSessoes} sessões criadas — ${totalHoras.toFixed(1)}h total`)

    return { log, erros }
  }

  // ── Horários (ensino superior) ──
  info('A importar Horários…')

  // Limpar horários existentes das turmas que vão ser importadas
  const turmasComHorario = new Set()
  for (const row of rowsH) {
    const turmaDesig = norm(row, 'turma_designacao') || norm(row, 'turma_nome')
    const discNome = norm(row, 'disciplina_nome')
    if (!turmaDesig) continue
    let turma
    if (discNome) {
      const disc = disciplinas.find(d => d.nome === discNome)
      turma = turmas.find(t => t.designacao === turmaDesig && t.disciplina_id === disc?.id)
    } else {
      turma = turmas.find(t => t.designacao === turmaDesig)
    }
    if (turma && !turmasComHorario.has(turma.id)) {
      turmasComHorario.add(turma.id)
      await ipc(() => window.api.horarios.eliminarDaTurma(turma.id))
    }
  }

  for (const row of rowsH) {
    const turmaDesig = norm(row, 'turma_designacao') || norm(row, 'turma_nome')
    const discNome = norm(row, 'disciplina_nome')
    const diaSemana = normNum(row, 'dia_semana', 1)
    const horaInicio = normTime(row, 'hora_inicio')
    const horaFim = normTime(row, 'hora_fim', '11:00')
    if (!turmaDesig) continue

    let turma
    if (discNome) {
      const disc = disciplinas.find(d => d.nome === discNome)
      turma = turmas.find(t => t.designacao === turmaDesig && t.disciplina_id === disc?.id)
    } else {
      turma = turmas.find(t => t.designacao === turmaDesig)
    }

    if (!turma) {
      err(`Horário: turma "${turmaDesig}"${discNome ? ` (${discNome})` : ''} não encontrada`)
      continue
    }
    try {
      // verificar conflitos com outras turmas no mesmo slot (apenas turmas com períodos sobrepostos)
      const turmaInicio = turma.data_inicio || ''
      const turmaFim = turma.data_fim || ''
      const todasTurmas = turmas.filter(t => {
        if (t.id === turma.id) return false
        // Ignorar turmas sem período ou com período que não se sobrepõe
        if (!t.data_inicio || !t.data_fim || !turmaInicio || !turmaFim) return true
        return t.data_inicio <= turmaFim && t.data_fim >= turmaInicio
      })
      let conflito = false
      for (const outraTurma of todasTurmas) {
        const outrosHorarios = await ipc(() => window.api.horarios.listar(outraTurma.id))
        const overlap = outrosHorarios.find(h =>
          h.dia_semana === diaSemana &&
          h.hora_inicio < horaFim && h.hora_fim > horaInicio
        )
        if (overlap) {
          err(`Horário "${turmaDesig}" dia ${diaSemana} ${horaInicio}-${horaFim} conflita com "${outraTurma.designacao}" ${overlap.hora_inicio}-${overlap.hora_fim}`)
          conflito = true
          break
        }
      }
      if (conflito) continue

      // verificar se já existe horário com mesmo dia e hora de início
      const horariosExistentes = await ipc(() => window.api.horarios.listar(turma.id))
      const salaImport = norm(row, 'sala') || null
      const jaExiste = horariosExistentes.find(h => h.dia_semana === diaSemana && h.hora_inicio === horaInicio)
      if (jaExiste) {
        // Atualizar sala e hora_fim se forem diferentes
        if (jaExiste.sala !== salaImport || jaExiste.hora_fim !== horaFim) {
          await ipc(() => window.api.horarios.editar(jaExiste.id, {
            dia_semana: diaSemana,
            hora_inicio: horaInicio,
            hora_fim: horaFim,
            sala: salaImport,
          }))
          ok(`Horário atualizado: ${turmaDesig} — dia ${diaSemana} ${horaInicio}-${horaFim}`)
        } else {
          ok(`Horário já existe: ${turmaDesig} — dia ${diaSemana} ${horaInicio}-${horaFim}`)
        }
        continue
      }
      await ipc(() => window.api.horarios.criar({
        turma_id: turma.id,
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        sala: salaImport,
      }))
      ok(`Horário criado: ${turmaDesig} — dia ${diaSemana} ${horaInicio}-${horaFim}`)
    } catch (e) { err(`Horário "${turmaDesig}": ${e.message}`) }
  }

  // ── Gerar Aulas Automaticamente ──
  info('A gerar aulas automaticamente…')
  // Recarregar turmas actualizadas (com datas)
  turmas = await ipc(() => window.api.turmas.listar())

  // Limpar aulas existentes antes de regenerar
  for (const row of rowsT) {
    const designacao = norm(row, 'designacao')
    const discNome = norm(row, 'disciplina_nome') || norm(row, 'ufcd_nome')
    if (!designacao) continue
    const disc = disciplinas.find(d => d.nome === discNome)
    const turma = turmas.find(t => t.designacao === designacao && (!disc || t.disciplina_id === disc.id))
    if (!turma) continue
    try {
      const res = await ipc(() => window.api.aulas.eliminarDaTurma(turma.id))
      if (res?.eliminadas > 0) info(`  Aulas anteriores eliminadas: ${designacao} — ${res.eliminadas} aulas`)
    } catch (e) { err(`Limpar aulas "${designacao}": ${e.message}`) }
  }

  let totalAulasGeradas = 0
  for (const row of rowsT) {
    const designacao = norm(row, 'designacao')
    const discNome = norm(row, 'disciplina_nome') || norm(row, 'ufcd_nome')
    if (!designacao) continue
    const disc = disciplinas.find(d => d.nome === discNome)
    const turma = turmas.find(t => t.designacao === designacao && (!disc || t.disciplina_id === disc.id))
    if (!turma) continue
    const dataInicio = turma.data_inicio || normDate(row, 'data_inicio')
    const dataFim = turma.data_fim || normDate(row, 'data_fim')
    if (!dataInicio || !dataFim) {
      info(`  Turma "${designacao}": sem data_inicio/data_fim — aulas não geradas`)
      continue
    }
    try {
      const aulasGeradas = await ipc(() => window.api.aulas.gerarAutomatico(turma.id, dataInicio, dataFim))
      const n = aulasGeradas?.aulas?.length ?? (Array.isArray(aulasGeradas) ? aulasGeradas.length : 0)
      totalAulasGeradas += n
      if (n > 0) ok(`Aulas geradas: ${designacao} (${discNome}) — ${n} aulas`)
      else ok(`Aulas já existentes: ${designacao} (${discNome}) — sem novas aulas`)
    } catch (e) {
      if (e.message?.includes('Sem horários')) {
        info(`  Turma "${designacao}": sem horários — aulas não geradas`)
      } else {
        err(`Gerar aulas "${designacao}": ${e.message}`)
      }
    }
  }
  if (totalAulasGeradas > 0) ok(`Total de aulas geradas: ${totalAulasGeradas}`)

  return { log, erros }
}

// ─── Component ────────────────────────────────────────────────────────────────

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

export default function Importar() {
  const [progresso, setProgresso] = useState([])
  const [resultado, setResultado] = useState(null) // { log, erros }
  const [importing, setImporting] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setProgresso([])
    setResultado(null)

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const res = await importarWorkbook(wb, setProgresso)
      setResultado(res)
    } catch (err) {
      const msg = `Erro: ${err.message}`
      setProgresso(p => [...p, { tipo: 'err', msg }])
      setResultado({ log: [], erros: [msg] })
    }

    setImporting(false)
    e.target.value = ''
  }

  const totalOk = resultado?.log.length ?? 0
  const totalErr = resultado?.erros.length ?? 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Importar Dados</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Importe disciplinas, turmas e horários em massa a partir de um ficheiro Excel.
      </p>

      {/* Export + Import actions */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-5">
        {/* Export */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600 dark:text-blue-400">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Exportar Template</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Descarregue o ficheiro Excel com exemplos e instruções</p>
            </div>
          </div>
          <button
            onClick={gerarTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ensino Superior
          </button>
          <button
            onClick={gerarTemplateFormacao}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Formação
          </button>
        </div>

        {/* Import */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-600 dark:text-green-400">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Importar Ficheiro</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Selecione o Excel preenchido — registos existentes são ignorados</p>
            </div>
          </div>
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex-shrink-0 ${
            importing
              ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'A importar…' : 'Selecionar .xlsx'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Template structure info */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Estrutura do Template</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { sheet: 'Configurações', campos: 'nome_professor, instituicao, departamento, ano_letivo_atual' },
            { sheet: 'Instituições', campos: 'nome, tipo, contacto, notas' },
            { sheet: 'Períodos Não Letivos', campos: 'descricao, data_inicio, data_fim, tipo, instituicao_nome' },
            { sheet: 'Cursos', campos: 'nome, instituicao_nome, tipo, ano_letivo, descricao' },
            { sheet: 'Disciplinas', campos: 'nome, codigo, tipo, area_cientifica, ects, descricao, curso_nome' },
            { sheet: 'Módulos', campos: 'disciplina_nome, nome, ordem, horas, objetivos' },
            { sheet: 'Turmas', campos: 'designacao, disciplina_nome, ano_letivo, carga_horaria, data_inicio, data_fim, semestre, cor, valor_hora' },
            { sheet: 'Horários', campos: 'turma_designacao, disciplina_nome, dia_semana, hora_inicio, hora_fim, sala' },
          ].map(({ sheet, campos }) => (
            <div key={sheet} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{sheet}</p>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{campos}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Dias da semana: 0=Domingo · 1=Segunda · 2=Terça · 3=Quarta · 4=Quinta · 5=Sexta · 6=Sábado
        </p>
        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
          As aulas são geradas automaticamente após importar os horários, para turmas com data_inicio e data_fim definidas.
        </p>
      </div>

      {/* Progress / Results */}
      {(progresso.length > 0 || resultado) && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {/* Summary bar */}
          {resultado && (
            <div className={`px-4 py-3 flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 ${
              totalErr > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'
            }`}>
              <span className={`font-semibold text-sm ${totalErr > 0 ? 'text-yellow-800 dark:text-yellow-300' : 'text-green-800 dark:text-green-300'}`}>
                {totalErr === 0 ? '✓ Importação concluída' : '⚠ Importação com avisos'}
              </span>
              <span className="text-xs text-green-700 dark:text-green-400">{totalOk} registos processados</span>
              {totalErr > 0 && <span className="text-xs text-red-600 dark:text-red-400">{totalErr} erros</span>}
            </div>
          )}

          {/* Log */}
          <div className="p-4 max-h-80 overflow-y-auto space-y-0.5 font-mono text-xs bg-white dark:bg-gray-900">
            {progresso.map((entry, i) => (
              <div key={i} className={
                entry.tipo === 'ok' ? 'text-green-700 dark:text-green-400' :
                entry.tipo === 'err' ? 'text-red-600 dark:text-red-400' :
                'text-gray-400 dark:text-gray-500 font-sans font-medium mt-2'
              }>
                {entry.tipo === 'ok' && '✓ '}
                {entry.tipo === 'err' && '✗ '}
                {entry.msg}
              </div>
            ))}
            {importing && (
              <div className="text-blue-500 dark:text-blue-400 animate-pulse">…</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
