/**
 * Teste da funcionalidade de importação Excel
 * Executa: node scripts/test-importar.js
 */
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

let passed = 0
let failed = 0

function ok(label) { console.log(`  ✓ ${label}`); passed++ }
function fail(label, detail) { console.log(`  ✗ ${label}${detail ? ': ' + detail : ''}`); failed++ }
function section(title) { console.log(`\n── ${title} ──`) }

// ─── Reproduce gerarTemplate ──────────────────────────────────────────────────

function gerarTemplate() {
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['PlanAula — Template de Importação'],
    [''],
    ['INSTRUÇÕES:'],
    ['Registos já existentes com o mesmo nome serão ignorados (sem duplicados).'],
  ]), 'Instruções')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['nome *'],
    ['Universidade do Porto'],
    ['Instituto Politécnico de Coimbra'],
  ]), 'Instituições')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['nome *', 'instituicao_nome *'],
    ['Engenharia Informática', 'Universidade do Porto'],
    ['Gestão e Administração', 'Instituto Politécnico de Coimbra'],
  ]), 'Cursos')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['nome *', 'codigo', 'carga_horaria *', 'tipo', 'ects', 'descricao', 'curso_nome *', 'instituicao_nome *'],
    ['Programação Web', 'PW101', 60, 'Teórica', 6, '', 'Engenharia Informática', 'Universidade do Porto'],
    ['Bases de Dados', 'BD102', 45, 'Teórico-Prática', 4, '', 'Engenharia Informática', 'Universidade do Porto'],
    ['Gestão de Projetos', 'GP201', 30, 'Seminário', 3, '', 'Gestão e Administração', 'Instituto Politécnico de Coimbra'],
  ]), 'Disciplinas')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['nome *', 'disciplina_nome *', 'data_inicio *', 'data_fim *'],
    ['Turma A', 'Programação Web', '2025-09-15', '2026-01-31'],
    ['Turma B', 'Programação Web', '2025-09-15', '2026-01-31'],
    ['Turma A', 'Bases de Dados', '2025-09-15', '2026-01-31'],
  ]), 'Turmas')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['turma_nome *', 'disciplina_nome *', 'dia_semana *', 'hora_inicio *', 'hora_fim *'],
    ['Turma A', 'Programação Web', 2, '09:00', '11:00'],
    ['Turma A', 'Programação Web', 4, '14:00', '16:00'],
    ['Turma B', 'Programação Web', 3, '10:00', '12:00'],
    ['Turma A', 'Bases de Dados', 5, '09:00', '11:00'],
  ]), 'Horários')

  return wb
}

// ─── Reproduce norm/normNum helpers ──────────────────────────────────────────

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

// ─── Simulate import with mock API ───────────────────────────────────────────

function buildMockApi() {
  const db = { instituicoes: [], cursos: [], disciplinas: [], turmas: [], horarios: [] }
  let nextId = 1

  return {
    db,
    api: {
      instituicoes: {
        listar: async () => db.instituicoes,
        criar: async ({ nome }) => {
          if (!nome) throw new Error('nome obrigatório')
          const record = { id: nextId++, nome }
          db.instituicoes.push(record)
          return record
        },
      },
      cursos: {
        listar: async () => db.cursos,
        criar: async ({ nome, instituicao_id }) => {
          if (!nome) throw new Error('nome obrigatório')
          const record = { id: nextId++, nome, instituicao_id }
          db.cursos.push(record)
          return record
        },
      },
      disciplinas: {
        listar: async () => db.disciplinas,
        criar: async (dados) => {
          if (!dados.nome) throw new Error('nome obrigatório')
          if (!dados.carga_horaria) throw new Error('carga_horaria obrigatória')
          const record = { id: nextId++, ...dados }
          db.disciplinas.push(record)
          return record
        },
      },
      turmas: {
        listar: async () => db.turmas,
        criar: async (dados) => {
          if (!dados.nome) throw new Error('nome obrigatório')
          const record = { id: nextId++, ...dados }
          db.turmas.push(record)
          return record
        },
      },
      horarios: {
        criar: async (dados) => {
          if (!dados.turma_id) throw new Error('turma_id obrigatório')
          const record = { id: nextId++, ...dados }
          db.horarios.push(record)
          return record
        },
      },
    }
  }
}

async function runImport(wb, api) {
  const log = []
  const erros = []
  const prog = []
  const setProgresso = fn => { prog.push(...(fn(prog).slice(prog.length))) }
  // simplified: collect log/erros directly

  function parseSheet(name) {
    const ws = wb.Sheets[name]
    if (!ws) return []
    return XLSX.utils.sheet_to_json(ws, { defval: '' })
  }

  // Instituições
  const rowsI = parseSheet('Instituições')
  let instituicoes = await api.instituicoes.listar()
  for (const row of rowsI) {
    const nome = norm(row, 'nome')
    if (!nome) continue
    if (instituicoes.find(i => i.nome === nome)) { log.push(`SKIP inst:${nome}`); continue }
    try { await api.instituicoes.criar({ nome }); log.push(`OK inst:${nome}`) }
    catch (e) { erros.push(`ERR inst:${nome}: ${e.message}`) }
  }
  instituicoes = await api.instituicoes.listar()

  // Cursos
  const rowsC = parseSheet('Cursos')
  let cursos = await api.cursos.listar()
  for (const row of rowsC) {
    const nome = norm(row, 'nome')
    const instNome = norm(row, 'instituicao_nome')
    if (!nome) continue
    if (cursos.find(c => c.nome === nome)) { log.push(`SKIP curso:${nome}`); continue }
    const inst = instituicoes.find(i => i.nome === instNome)
    if (instNome && !inst) { erros.push(`ERR curso:${nome}: inst not found`); continue }
    try { await api.cursos.criar({ nome, instituicao_id: inst?.id || null }); log.push(`OK curso:${nome}`) }
    catch (e) { erros.push(`ERR curso:${nome}: ${e.message}`) }
  }
  cursos = await api.cursos.listar()

  // Disciplinas
  const rowsD = parseSheet('Disciplinas')
  let disciplinas = await api.disciplinas.listar()
  for (const row of rowsD) {
    const nome = norm(row, 'nome')
    const cursoNome = norm(row, 'curso_nome')
    if (!nome) continue
    if (disciplinas.find(d => d.nome === nome && d.curso_nome === cursoNome)) { log.push(`SKIP disc:${nome}`); continue }
    const curso = cursos.find(c => c.nome === cursoNome)
    if (cursoNome && !curso) { erros.push(`ERR disc:${nome}: curso not found`); continue }
    try {
      await api.disciplinas.criar({
        nome, codigo: norm(row, 'codigo'), area_cientifica: '',
        carga_horaria: normNum(row, 'carga_horaria'),
        ects: normNum(row, 'ects'), tipo: norm(row, 'tipo') || 'Teórica',
        descricao: norm(row, 'descricao'), curso_id: curso?.id || null,
        curso_nome: cursoNome,
      })
      log.push(`OK disc:${nome}`)
    } catch (e) { erros.push(`ERR disc:${nome}: ${e.message}`) }
  }
  disciplinas = await api.disciplinas.listar()

  // Turmas
  const rowsT = parseSheet('Turmas')
  let turmas = await api.turmas.listar()
  for (const row of rowsT) {
    const nome = norm(row, 'nome')
    const discNome = norm(row, 'disciplina_nome')
    if (!nome) continue
    const disc = disciplinas.find(d => d.nome === discNome)
    if (!disc) { erros.push(`ERR turma:${nome}: disc not found`); continue }
    if (turmas.find(t => t.nome === nome && t.disciplina_id === disc.id)) { log.push(`SKIP turma:${nome}`); continue }
    try {
      await api.turmas.criar({ nome, disciplina_id: disc.id, data_inicio: norm(row, 'data_inicio'), data_fim: norm(row, 'data_fim') })
      log.push(`OK turma:${nome}(${discNome})`)
    } catch (e) { erros.push(`ERR turma:${nome}: ${e.message}`) }
  }
  turmas = await api.turmas.listar()

  // Horários
  const rowsH = parseSheet('Horários')
  for (const row of rowsH) {
    const turmaNome = norm(row, 'turma_nome')
    const discNome = norm(row, 'disciplina_nome')
    if (!turmaNome) continue
    const disc = disciplinas.find(d => d.nome === discNome)
    const turma = turmas.find(t => t.nome === turmaNome && t.disciplina_id === disc?.id)
    if (!turma) { erros.push(`ERR horario: turma "${turmaNome}" não encontrada`); continue }
    try {
      await api.horarios.criar({ turma_id: turma.id, dia_semana: normNum(row, 'dia_semana', 1), hora_inicio: norm(row, 'hora_inicio') || '09:00', hora_fim: norm(row, 'hora_fim') || '11:00' })
      log.push(`OK horario:${turmaNome} dia${norm(row, 'dia_semana')}`)
    } catch (e) { erros.push(`ERR horario: ${e.message}`) }
  }

  return { log, erros }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('PlanAula — Teste de Importação Excel\n')

  // 1. Template generation
  section('1. Geração do template')
  let wb
  try {
    wb = gerarTemplate()
    ok('Template gerado sem erro')
  } catch (e) { fail('Erro ao gerar template', e.message); process.exit(1) }

  const expectedSheets = ['Instruções', 'Instituições', 'Cursos', 'Disciplinas', 'Turmas', 'Horários']
  for (const s of expectedSheets) {
    wb.SheetNames.includes(s) ? ok(`Folha "${s}" existe`) : fail(`Folha "${s}" em falta`)
  }

  // 2. Sheet row counts
  section('2. Conteúdo das folhas')
  const checks = [
    ['Instituições', 2],
    ['Cursos', 2],
    ['Disciplinas', 3],
    ['Turmas', 3],
    ['Horários', 4],
  ]
  for (const [sheet, expectedRows] of checks) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })
    rows.length === expectedRows
      ? ok(`"${sheet}": ${rows.length} linhas de dados`)
      : fail(`"${sheet}": esperado ${expectedRows}, obtido ${rows.length}`)
  }

  // 3. Write/read round-trip
  section('3. Round-trip: escrever e reler ficheiro')
  const tmpPath = path.join(require('os').tmpdir(), 'planaula_test.xlsx')
  try {
    XLSX.writeFile(wb, tmpPath)
    ok(`Ficheiro escrito: ${tmpPath}`)
    const wb2 = XLSX.readFile(tmpPath)
    ok('Ficheiro relido com sucesso')
    wb2.SheetNames.length === expectedSheets.length
      ? ok(`${wb2.SheetNames.length} folhas preservadas`)
      : fail('Número de folhas diferente após round-trip')
    fs.unlinkSync(tmpPath)
  } catch (e) { fail('Round-trip falhou', e.message) }

  // 4. norm/normNum helpers
  section('4. Helpers norm/normNum')
  const mockRow = { 'nome *': '  Teste  ', 'carga_horaria *': '60', 'ects': '' }
  norm(mockRow, 'nome') === 'Teste' ? ok('norm() remove espaços e sufixo *') : fail('norm() retornou valor errado')
  normNum(mockRow, 'carga_horaria') === 60 ? ok('normNum() converte para número') : fail('normNum() falhou')
  normNum(mockRow, 'ects', 3) === 3 ? ok('normNum() usa default quando vazio') : fail('normNum() default falhou')
  norm(mockRow, 'inexistente') === '' ? ok('norm() retorna "" para chave inexistente') : fail('norm() não retornou ""')

  // 5. Import simulation — happy path
  section('5. Importação completa (mock DB)')
  const { db, api } = buildMockApi()
  const { log, erros } = await runImport(wb, api)

  erros.length === 0 ? ok('Sem erros de importação') : fail(`${erros.length} erros`, erros.join('; '))

  db.instituicoes.length === 2 ? ok(`${db.instituicoes.length} instituições criadas`) : fail('Instituições incorretas', db.instituicoes.length)
  db.cursos.length === 2 ? ok(`${db.cursos.length} cursos criados`) : fail('Cursos incorretos', db.cursos.length)
  db.disciplinas.length === 3 ? ok(`${db.disciplinas.length} disciplinas criadas`) : fail('Disciplinas incorretas', db.disciplinas.length)
  db.turmas.length === 3 ? ok(`${db.turmas.length} turmas criadas`) : fail('Turmas incorretas', db.turmas.length)
  db.horarios.length === 4 ? ok(`${db.horarios.length} horários criados`) : fail('Horários incorretos', db.horarios.length)

  // check referential integrity
  const allTurmaIdsValid = db.horarios.every(h => db.turmas.find(t => t.id === h.turma_id))
  allTurmaIdsValid ? ok('Horários têm turma_id válido') : fail('Horários com turma_id inválido')

  const allDiscIdsValid = db.turmas.every(t => db.disciplinas.find(d => d.id === t.disciplina_id))
  allDiscIdsValid ? ok('Turmas têm disciplina_id válido') : fail('Turmas com disciplina_id inválido')

  // 6. Import idempotency (reimport same file)
  section('6. Idempotência (reimportar o mesmo ficheiro)')
  const { db: db2, api: api2 } = buildMockApi()
  // Pre-seed with existing Universidade
  db2.instituicoes.push({ id: 99, nome: 'Universidade do Porto' })
  const { log: log2, erros: erros2 } = await runImport(wb, api2)
  erros2.length === 0 ? ok('Sem erros na 2ª importação') : fail('Erros inesperados', erros2.join('; '))
  db2.instituicoes.length === 2 ? ok('Sem duplicação de instituições') : fail('Duplicados encontrados', db2.instituicoes.length)
  log2.filter(l => l.startsWith('SKIP inst')).length >= 1 ? ok('Registo duplicado ignorado corretamente') : fail('SKIP não acionado')

  // 7. Error handling — missing reference
  section('7. Tratamento de erros — referência inexistente')
  const wbBad = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wbBad, XLSX.utils.aoa_to_sheet([
    ['nome *', 'disciplina_nome *', 'data_inicio *', 'data_fim *'],
    ['Turma X', 'Disciplina Inexistente', '2025-09-01', '2026-01-31'],
  ]), 'Turmas')
  const { db: dbBad, api: apiBad } = buildMockApi()
  const { erros: errosBad } = await runImport(wbBad, apiBad)
  errosBad.some(e => e.includes('Turma X')) ? ok('Erro correto quando disciplina não existe') : fail('Erro de referência não reportado')

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Resultado: ${passed} passou  |  ${failed} falhou`)
  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error('Erro inesperado:', e); process.exit(1) })
