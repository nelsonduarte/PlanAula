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
    [''],
    ['ORDEM DE IMPORTAÇÃO (os nomes devem corresponder EXACTAMENTE):'],
    ['  Instituições  →  Cursos  →  Disciplinas  →  Turmas  →  Horários'],
    [''],
    ['  • Cursos      referenciam "instituicao_nome" de Instituições'],
    ['  • Disciplinas referenciam "curso_nome" de Cursos'],
    ['  • Turmas      referenciam "disciplina_nome" de Disciplinas'],
    ['  • Horários    referenciam "turma_nome" de Turmas'],
    [''],
    ['Registos já existentes com o mesmo nome serão ignorados (sem duplicados).'],
  ]
  const wsInst = XLSX.utils.aoa_to_sheet(instrucoes)
  wsInst['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instruções')

  // ── Instituições ──
  const wsI = XLSX.utils.aoa_to_sheet([
    ['nome *'],
    ['Universidade do Porto'],
    ['Instituto Politécnico de Coimbra'],
  ])
  wsI['!cols'] = [{ wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsI, 'Instituições')

  // ── Cursos ──
  const wsC = XLSX.utils.aoa_to_sheet([
    ['nome *', 'instituicao_nome *', 'ano_letivo', 'valor_hora'],
    ['Engenharia Informática', 'Universidade do Porto', '2025/2026', 25],
    ['Gestão e Administração', 'Instituto Politécnico de Coimbra', '2025/2026', 20],
  ])
  wsC['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsC, 'Cursos')

  // ── Disciplinas ──
  const wsD = XLSX.utils.aoa_to_sheet([
    ['nome *', 'codigo', 'tipo', 'ects', 'descricao', 'curso_nome *', 'instituicao_nome *'],
    ['Programação Web', 'PW101', 'Teórica', 6, '', 'Engenharia Informática', 'Universidade do Porto'],
    ['Bases de Dados', 'BD102', 'Teórico-Prática', 4, '', 'Engenharia Informática', 'Universidade do Porto'],
    ['Gestão de Projetos', 'GP201', 'Seminário', 3, '', 'Gestão e Administração', 'Instituto Politécnico de Coimbra'],
  ])
  wsD['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 6 }, { wch: 20 }, { wch: 28 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsD, 'Disciplinas')

  // ── Turmas ──
  const wsT = XLSX.utils.aoa_to_sheet([
    ['designacao *', 'disciplina_nome *', 'ano_letivo *', 'carga_horaria', 'data_inicio', 'data_fim', 'semestre'],
    ['Turma A', 'Programação Web', '2025/2026', 60, '2025-09-15', '2026-01-31', 1],
    ['Turma B', 'Programação Web', '2025/2026', 60, '2025-09-15', '2026-01-31', 2],
    ['Turma A', 'Bases de Dados', '2025/2026', 45, '2025-09-15', '2026-01-31', 1],
  ])
  wsT['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsT, 'Turmas')

  // ── Horários ──
  const wsH = XLSX.utils.aoa_to_sheet([
    ['turma_designacao *', 'disciplina_nome *', 'dia_semana *', 'hora_inicio *', 'hora_fim *', 'sala'],
    ['Turma A', 'Programação Web', 2, '09:00', '11:00', 'Sala 101'],
    ['Turma A', 'Programação Web', 4, '14:00', '16:00', 'Sala 101'],
    ['Turma B', 'Programação Web', 3, '10:00', '12:00', 'Sala 203'],
    ['Turma A', 'Bases de Dados', 5, '09:00', '11:00', 'Sala 205'],
  ])
  wsH['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 13 }, { wch: 13 }]
  XLSX.utils.book_append_sheet(wb, wsH, 'Horários')

  XLSX.writeFile(wb, 'PlanAula_Template.xlsx')
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
      await ipc(() => window.api.instituicoes.criar({ nome, tipo: 'universitária', contacto: null, notas: null }))
      ok(`Instituição criada: ${nome}`)
    } catch (e) { err(`Instituição "${nome}": ${e.message}`) }
  }
  instituicoes = await ipc(() => window.api.instituicoes.listar())

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
        tipo: 'semestral',
        ano_letivo: norm(row, 'ano_letivo') || null,
        valor_hora: normNum(row, 'valor_hora') || null,
        descricao: null,
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
        area_cientifica: '',
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

  // ── Turmas ──
  info('A importar Turmas…')
  const rowsT = parseSheet(wb, 'Turmas')
  let turmas = await ipc(() => window.api.turmas.listar())
  for (const row of rowsT) {
    const designacao = norm(row, 'designacao')
    const discNome = norm(row, 'disciplina_nome')
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
      await ipc(() => window.api.turmas.criar({
        designacao,
        disciplina_id: disc.id,
        ano_letivo: anoLetivo,
        semestre: normNum(row, 'semestre', 1),
        sala: null,
        data_inicio: normDate(row, 'data_inicio') || null,
        data_fim: normDate(row, 'data_fim') || null,
        carga_horaria: normNum(row, 'carga_horaria', 0),
        cor: '#2E86C1',
      }))
      ok(`Turma criada: ${designacao} (${discNome})`)
    } catch (e) { err(`Turma "${designacao}": ${e.message}`) }
  }
  turmas = await ipc(() => window.api.turmas.listar())

  // ── Horários ──
  info('A importar Horários…')
  const rowsH = parseSheet(wb, 'Horários')
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
            Descarregar .xlsx
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
            { sheet: 'Instituições', campos: 'nome' },
            { sheet: 'Cursos', campos: 'nome, instituicao_nome, ano_letivo, valor_hora' },
            { sheet: 'Disciplinas', campos: 'nome, codigo, tipo, ects, descricao, curso_nome, instituicao_nome' },
            { sheet: 'Turmas', campos: 'designacao, disciplina_nome, ano_letivo, carga_horaria, data_inicio, data_fim, semestre' },
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
