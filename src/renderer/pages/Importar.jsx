import React, { useState } from 'react'
import * as XLSX from 'xlsx'

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
    ['3. Datas no formato AAAA-MM-DD (ex: 2025-09-01).'],
    ['4. Dia da semana: 1=Segunda  2=Terça  3=Quarta  4=Quinta  5=Sexta  6=Sábado  7=Domingo.'],
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
    ['nome *', 'instituicao_nome *'],
    ['Engenharia Informática', 'Universidade do Porto'],
    ['Gestão e Administração', 'Instituto Politécnico de Coimbra'],
  ])
  wsC['!cols'] = [{ wch: 35 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsC, 'Cursos')

  // ── Disciplinas ──
  const wsD = XLSX.utils.aoa_to_sheet([
    ['nome *', 'codigo', 'carga_horaria *', 'tipo', 'ects', 'descricao', 'curso_nome *', 'instituicao_nome *'],
    ['Programação Web', 'PW101', 60, 'Teórica', 6, '', 'Engenharia Informática', 'Universidade do Porto'],
    ['Bases de Dados', 'BD102', 45, 'Teórico-Prática', 4, '', 'Engenharia Informática', 'Universidade do Porto'],
    ['Gestão de Projetos', 'GP201', 30, 'Seminário', 3, '', 'Gestão e Administração', 'Instituto Politécnico de Coimbra'],
  ])
  wsD['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 6 }, { wch: 20 }, { wch: 28 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsD, 'Disciplinas')

  // ── Turmas ──
  const wsT = XLSX.utils.aoa_to_sheet([
    ['designacao *', 'disciplina_nome *', 'ano_letivo *', 'semestre', 'sala'],
    ['Turma A', 'Programação Web', '2025/2026', 1, 'Sala 101'],
    ['Turma B', 'Programação Web', '2025/2026', 2, ''],
    ['Turma A', 'Bases de Dados', '2025/2026', 1, 'Sala 203'],
  ])
  wsT['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsT, 'Turmas')

  // ── Horários ──
  const wsH = XLSX.utils.aoa_to_sheet([
    ['turma_designacao *', 'disciplina_nome *', 'dia_semana *', 'hora_inicio *', 'hora_fim *'],
    ['Turma A', 'Programação Web', 2, '09:00', '11:00'],
    ['Turma A', 'Programação Web', 4, '14:00', '16:00'],
    ['Turma B', 'Programação Web', 3, '10:00', '12:00'],
    ['Turma A', 'Bases de Dados', 5, '09:00', '11:00'],
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
  let instituicoes = await window.api.instituicoes.listar()
  for (const row of rowsI) {
    const nome = norm(row, 'nome')
    if (!nome) continue
    if (instituicoes.find(i => i.nome === nome)) {
      ok(`Instituição já existe: ${nome}`)
      continue
    }
    try {
      await window.api.instituicoes.criar({ nome })
      ok(`Instituição criada: ${nome}`)
    } catch (e) { err(`Instituição "${nome}": ${e.message}`) }
  }
  instituicoes = await window.api.instituicoes.listar()

  // ── Cursos ──
  info('A importar Cursos…')
  const rowsC = parseSheet(wb, 'Cursos')
  let cursos = await window.api.cursos.listar()
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
      await window.api.cursos.criar({ nome, instituicao_id: inst?.id || null })
      ok(`Curso criado: ${nome}`)
    } catch (e) { err(`Curso "${nome}": ${e.message}`) }
  }
  cursos = await window.api.cursos.listar()

  // ── Disciplinas ──
  info('A importar Disciplinas…')
  const rowsD = parseSheet(wb, 'Disciplinas')
  let disciplinas = await window.api.disciplinas.listar()
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
      await window.api.disciplinas.criar({
        nome,
        codigo: norm(row, 'codigo'),
        area_cientifica: '',
        carga_horaria: normNum(row, 'carga_horaria'),
        ects: normNum(row, 'ects'),
        tipo: norm(row, 'tipo') || 'Teórica',
        descricao: norm(row, 'descricao'),
        curso_id: curso?.id || null,
      })
      ok(`Disciplina criada: ${nome}`)
    } catch (e) { err(`Disciplina "${nome}": ${e.message}`) }
  }
  disciplinas = await window.api.disciplinas.listar()

  // ── Turmas ──
  info('A importar Turmas…')
  const rowsT = parseSheet(wb, 'Turmas')
  let turmas = await window.api.turmas.listar()
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
    if (turmas.find(t => t.designacao === designacao && t.disciplina_id === disc.id)) {
      ok(`Turma já existe: ${designacao} (${discNome})`)
      continue
    }
    try {
      await window.api.turmas.criar({
        designacao,
        disciplina_id: disc.id,
        ano_letivo: anoLetivo,
        semestre: normNum(row, 'semestre', 1),
        sala: norm(row, 'sala') || null,
        cor: '#2E86C1',
      })
      ok(`Turma criada: ${designacao} (${discNome})`)
    } catch (e) { err(`Turma "${designacao}": ${e.message}`) }
  }
  turmas = await window.api.turmas.listar()

  // ── Horários ──
  info('A importar Horários…')
  const rowsH = parseSheet(wb, 'Horários')
  for (const row of rowsH) {
    const turmaDesig = norm(row, 'turma_designacao') || norm(row, 'turma_nome')
    const discNome = norm(row, 'disciplina_nome')
    const diaSemana = normNum(row, 'dia_semana', 1)
    const horaInicio = norm(row, 'hora_inicio') || '09:00'
    const horaFim = norm(row, 'hora_fim') || '11:00'
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
      await window.api.horarios.criar({
        turma_id: turma.id,
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
      })
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

      {/* Step 1 — Download template */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
          <div className="flex-1">
            <h2 className="font-semibold text-blue-800 dark:text-blue-300 mb-0.5">Descarregar Template</h2>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
              Descarregue o ficheiro Excel, preencha-o com os seus dados e volte aqui para importar.
              O ficheiro inclui exemplos e instruções em cada folha.
            </p>
            <button
              onClick={gerarTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descarregar PlanAula_Template.xlsx
            </button>
          </div>
        </div>
      </div>

      {/* Template structure info */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Estrutura do Template</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { sheet: 'Instituições', campos: 'nome' },
            { sheet: 'Cursos', campos: 'nome, instituicao_nome' },
            { sheet: 'Disciplinas', campos: 'nome, codigo, carga_horaria, tipo, ects, descricao, curso_nome, instituicao_nome' },
            { sheet: 'Turmas', campos: 'designacao, disciplina_nome, ano_letivo, semestre, sala' },
            { sheet: 'Horários', campos: 'turma_designacao, disciplina_nome, dia_semana (1–7), hora_inicio, hora_fim' },
          ].map(({ sheet, campos }) => (
            <div key={sheet} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{sheet}</p>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{campos}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Dias da semana: 1=Segunda · 2=Terça · 3=Quarta · 4=Quinta · 5=Sexta · 6=Sábado · 7=Domingo
        </p>
      </div>

      {/* Step 2 — Upload */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-0.5">Importar Ficheiro</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Selecione o ficheiro Excel preenchido. Registos já existentes são ignorados automaticamente.
            </p>
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              importing
                ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {importing ? 'A importar…' : 'Selecionar ficheiro .xlsx'}
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
