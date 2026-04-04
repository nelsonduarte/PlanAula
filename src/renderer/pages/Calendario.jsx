import React, { useState, useEffect } from 'react'
import Modal from '../components/Modal.jsx'
import DialogModal from '../components/DialogModal.jsx'
import { useDatabase } from '../hooks/useDatabase.js'
import { useDialog } from '../hooks/useDialog.js'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const DIAS_SEMANA_CURTO_MON = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']

const estadoColors = {
  'Planeada':  '#3B82F6',
  'Realizada': '#22C55E',
  'Adiada':    '#EAB308',
  'Cancelada': '#EF4444',
}

const TIPOS_PERIODO = ['férias', 'interrupção letiva', 'feriado escolar', 'outro']

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Calendario() {
  const db = useDatabase()
  const { confirm, alert, dialog, handleOk, handleCancel } = useDialog()
  const [aulas, setAulas] = useState([])
  const [diasNaoLetivos, setDiasNaoLetivos] = useState({})
  const [vista, setVista] = useState('mensal')
  const [dataAtual, setDataAtual] = useState(new Date())
  const [aulaSelecionada, setAulaSelecionada] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [dragOverDate, setDragOverDate] = useState(null)
  // Períodos não letivos
  const [periodos, setPeriodos] = useState([])
  const [instituicoes, setInstituicoes] = useState([])
  const [modalPeriodos, setModalPeriodos] = useState(false)
  const [periodoForm, setPeriodoForm] = useState({ instituicao_id: '', descricao: '', data_inicio: '', data_fim: '', tipo: 'férias' })

  const hoje = new Date()
  const hojeStr = toDateStr(hoje)

  useEffect(() => { carregarDados() }, [dataAtual, vista])

  async function carregarDados() {
    let data_inicio, data_fim
    if (vista === 'mensal') {
      const ano = dataAtual.getFullYear()
      const mes = dataAtual.getMonth()
      data_inicio = toDateStr(new Date(ano, mes, 1))
      data_fim = toDateStr(new Date(ano, mes + 1, 0))
    } else if (vista === 'anual') {
      const ano = dataAtual.getFullYear()
      data_inicio = `${ano}-01-01`
      data_fim = `${ano}-12-31`
    } else {
      const start = new Date(dataAtual)
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      data_inicio = toDateStr(start)
      data_fim = toDateStr(end)
    }

    const [aulasData, feriadosData, periodosData, instData] = await Promise.all([
      db.listarAulas({ data_inicio, data_fim }),
      db.listarDiasNaoLetivos(),
      db.listarPeriodosNaoLetivos(),
      db.listarInstituicoes()
    ])
    setAulas(aulasData || [])
    setPeriodos(periodosData || [])
    setInstituicoes(instData || [])

    // Construir mapa de dias não letivos: feriados individuais + períodos expandidos
    const map = {}
    for (const f of (feriadosData || [])) map[f.data] = { ...f, tipoCor: 'feriado' }

    // Expandir períodos no intervalo visível
    for (const p of (periodosData || [])) {
      const cur = new Date(p.data_inicio + 'T12:00:00')
      const fim = new Date(p.data_fim + 'T12:00:00')
      while (cur <= fim) {
        const ds = cur.toISOString().split('T')[0]
        if (ds >= data_inicio && ds <= data_fim && !map[ds]) {
          map[ds] = {
            data: ds,
            descricao: p.descricao + (p.instituicao_nome ? ` — ${p.instituicao_nome}` : ' — Todas'),
            tipo: p.tipo,
            tipoCor: 'periodo',
            instituicao_nome: p.instituicao_nome
          }
        }
        cur.setDate(cur.getDate() + 1)
      }
    }
    setDiasNaoLetivos(map)
  }

  async function carregarPeriodos() {
    const [p, inst] = await Promise.all([db.listarPeriodosNaoLetivos(), db.listarInstituicoes()])
    setPeriodos(p || [])
    setInstituicoes(inst || [])
  }

  async function criarPeriodo() {
    if (!periodoForm.descricao || !periodoForm.data_inicio || !periodoForm.data_fim) {
      await alert('Preencha a descrição e as datas')
      return
    }
    if (periodoForm.data_fim < periodoForm.data_inicio) {
      await alert('A data de fim não pode ser anterior à data de início')
      return
    }
    await db.criarPeriodoNaoLetivo({
      ...periodoForm,
      instituicao_id: periodoForm.instituicao_id ? parseInt(periodoForm.instituicao_id) : null
    })
    setPeriodoForm({ instituicao_id: '', descricao: '', data_inicio: '', data_fim: '', tipo: 'férias' })
    await carregarDados()
  }

  async function eliminarPeriodo(id) {
    if (!await confirm('Eliminar este período?', { danger: true })) return
    await db.eliminarPeriodoNaoLetivo(id)
    await carregarDados()
  }

  function navAnterior() {
    const d = new Date(dataAtual)
    if (vista === 'mensal') d.setMonth(d.getMonth() - 1)
    else if (vista === 'anual') d.setFullYear(d.getFullYear() - 1)
    else d.setDate(d.getDate() - 7)
    setDataAtual(d)
  }

  function navSeguinte() {
    const d = new Date(dataAtual)
    if (vista === 'mensal') d.setMonth(d.getMonth() + 1)
    else if (vista === 'anual') d.setFullYear(d.getFullYear() + 1)
    else d.setDate(d.getDate() + 7)
    setDataAtual(d)
  }

  function navHoje() { setDataAtual(new Date()) }

  function abrirAula(aula) {
    setAulaSelecionada(aula)
    setModalAberto(true)
  }

  async function moverAula(aulaId, novaData) {
    if (diasNaoLetivos[novaData]) {
      await alert('Não é possível mover a aula para um dia não letivo.', { type: 'warning' })
      return
    }
    const aula = aulas.find(a => a.id === aulaId)
    if (!aula || aula.data === novaData) return
    await db.editarAula(aulaId, { ...aula, data: novaData })
    await carregarDados()
  }

  async function eliminarAulaNoCalendario(aulaId) {
    if (!await confirm('Eliminar esta aula?', { danger: true })) return
    await db.eliminarAula(aulaId)
    await carregarDados()
  }

  // Monthly view helpers
  function getDiasMes() {
    const ano = dataAtual.getFullYear()
    const mes = dataAtual.getMonth()
    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)

    // Start from Monday
    let startDay = primeiroDia.getDay()
    if (startDay === 0) startDay = 7
    startDay -= 1

    const dias = []
    for (let i = 0; i < startDay; i++) {
      const d = new Date(primeiroDia)
      d.setDate(d.getDate() - (startDay - i))
      dias.push({ date: d, currentMonth: false })
    }
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      dias.push({ date: new Date(ano, mes, d), currentMonth: true })
    }
    while (dias.length % 7 !== 0) {
      const last = dias[dias.length - 1].date
      const next = new Date(last)
      next.setDate(last.getDate() + 1)
      dias.push({ date: next, currentMonth: false })
    }
    return dias
  }

  // Weekly view helpers
  function getDiasSemana() {
    const start = new Date(dataAtual)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }

  function getAulasDoDia(dateStr) {
    return aulas.filter(a => a.data === dateStr)
  }

  function getFeriado(dateStr) {
    return diasNaoLetivos[dateStr] || null
  }

  const diasMes = getDiasMes()
  const diasSemana = getDiasSemana()

  // Mini-calendar helper for annual view
  function getDiasMiniMes(ano, mes) {
    const firstDay = new Date(ano, mes, 1)
    const lastDay = new Date(ano, mes + 1, 0)
    let startDay = firstDay.getDay()
    if (startDay === 0) startDay = 7
    startDay -= 1
    const dias = []
    for (let i = 0; i < startDay; i++) dias.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) dias.push(new Date(ano, mes, d))
    while (dias.length % 7 !== 0) dias.push(null)
    return dias
  }

  function gerarHTMLCalendario() {
    const ano = dataAtual.getFullYear()
    const mes = dataAtual.getMonth()
    const rodape = `<div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:6px;font-size:7pt;color:#9ca3af;display:flex;justify-content:space-between"><span>PlanAula</span><span>Gerado em ${new Date().toLocaleDateString('pt-PT')}</span></div>`
    const baseStyle = `* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Segoe UI',Arial,sans-serif; font-size:9pt; padding:20px; }`

    if (vista === 'mensal') {
      const titulo = `${MESES[mes]} ${ano}`
      const headers = DIAS_SEMANA_CURTO_MON.map(d => `<th style="background:#f3f4f6;padding:5px;text-align:center;font-size:8pt;font-weight:600;border:1px solid #e5e7eb;color:#6b7280;text-transform:uppercase">${d}</th>`).join('')
      const rows = []
      for (let i = 0; i < diasMes.length; i += 7) {
        const cells = diasMes.slice(i, i + 7).map(item => {
          const dateStr = toDateStr(item.date)
          const aulasNoDia = getAulasDoDia(dateStr)
          const feriado = diasNaoLetivos[dateStr]
          const bg = feriado ? (feriado.tipoCor === 'periodo' ? '#fffbeb' : '#fef2f2') : (item.currentMonth ? 'white' : '#f9fafb')
          const numColor = item.currentMonth ? (dateStr === hojeStr ? '#2563eb' : '#111827') : '#d1d5db'
          return `<td style="background:${bg};border:1px solid #e5e7eb;padding:4px;vertical-align:top;min-height:75px;width:14.2%">
            <div style="font-weight:700;font-size:10pt;color:${numColor};margin-bottom:3px">${item.date.getDate()}</div>
            ${feriado ? `<div style="font-size:6.5pt;color:${feriado.tipoCor === 'periodo' ? '#d97706' : '#dc2626'};margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${feriado.descricao}</div>` : ''}
            ${aulasNoDia.map(a => `<div style="background:${a.turma_cor || '#3B82F6'};color:white;padding:1px 3px;border-radius:2px;font-size:6.5pt;margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.hora_inicio} ${a.disciplina_nome}${a.topico ? ' · ' + a.topico : ''}</div>`).join('')}
          </td>`
        }).join('')
        rows.push(`<tr>${cells}</tr>`)
      }
      return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><style>${baseStyle} h1{text-align:center;font-size:14pt;margin-bottom:12px;color:#111827;} table{width:100%;border-collapse:collapse;}</style></head><body>
        <h1>Calendário — ${titulo}</h1>
        <table><thead><tr>${headers}</tr></thead><tbody>${rows.join('')}</tbody></table>
        ${rodape}</body></html>`
    }

    if (vista === 'semanal') {
      const dias = getDiasSemana()
      const titulo = `Semana ${dias[0].getDate()}–${dias[6].getDate()} ${MESES[dias[6].getMonth()]} ${dias[6].getFullYear()}`
      const cols = dias.map((dia, i) => {
        const diaStr = toDateStr(dia)
        const aulasNoDia = getAulasDoDia(diaStr)
        const feriado = diasNaoLetivos[diaStr]
        const isHoje = diaStr === hojeStr
        return `<td style="border:1px solid #e5e7eb;padding:6px;vertical-align:top;width:14.2%;background:${isHoje ? '#eff6ff' : 'white'}">
          <div style="font-weight:700;font-size:9.5pt;color:${isHoje ? '#2563eb' : '#374151'};margin-bottom:5px">${DIAS_SEMANA_CURTO_MON[i]} ${dia.getDate()}</div>
          ${feriado ? `<div style="font-size:7pt;color:${feriado.tipoCor === 'periodo' ? '#d97706' : '#dc2626'};margin-bottom:4px">${feriado.descricao}</div>` : ''}
          ${aulasNoDia.map(a => `<div style="background:${a.turma_cor || '#3B82F6'};color:white;padding:4px 6px;border-radius:4px;font-size:8pt;margin-bottom:4px">
            <div style="font-weight:600">${a.disciplina_nome}</div>
            <div style="opacity:0.9;font-size:7pt">${a.hora_inicio}–${a.hora_fim}${a.sala ? ' · ' + a.sala : ''}</div>
            ${a.topico ? `<div style="opacity:0.85;font-size:7pt;margin-top:1px">${a.topico}</div>` : ''}
          </div>`).join('')}
          ${aulasNoDia.length === 0 ? '<div style="color:#d1d5db;font-size:8pt;text-align:center;margin-top:8px">—</div>' : ''}
        </td>`
      }).join('')
      return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><style>${baseStyle} h1{text-align:center;font-size:13pt;margin-bottom:14px;color:#111827;} table{width:100%;border-collapse:collapse;}</style></head><body>
        <h1>Calendário — ${titulo}</h1>
        <table><tbody><tr>${cols}</tr></tbody></table>
        ${rodape}</body></html>`
    }

    // Anual
    const mesesHTML = Array.from({ length: 12 }, (_, m) => {
      const dias = getDiasMiniMes(ano, m)
      const rows = []
      for (let i = 0; i < dias.length; i += 7) {
        const cells = dias.slice(i, i + 7).map(date => {
          if (!date) return '<td></td>'
          const dateStr = toDateStr(date)
          const aulasNoDia = aulas.filter(a => a.data === dateStr)
          const feriado = diasNaoLetivos[dateStr]
          const isHoje = dateStr === hojeStr
          const bg = isHoje ? '#2563eb' : feriado ? '#fef2f2' : 'transparent'
          const color = isHoje ? 'white' : feriado ? '#dc2626' : '#374151'
          const dots = aulasNoDia.slice(0, 3).map(a => `<span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:${a.turma_cor || '#3B82F6'};margin:0 0.5px"></span>`).join('')
          return `<td style="text-align:center;padding:1px"><div style="background:${bg};color:${color};border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:6.5pt;font-weight:${isHoje ? 'bold' : 'normal'};margin:0 auto">${date.getDate()}</div>${aulasNoDia.length > 0 ? `<div style="line-height:0;margin-top:1px">${dots}</div>` : ''}</td>`
        }).join('')
        rows.push(`<tr>${cells}</tr>`)
      }
      return `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;background:white">
        <div style="text-align:center;font-size:9pt;font-weight:700;color:#111827;margin-bottom:5px">${MESES[m]}</div>
        <table style="width:100%;border-collapse:collapse"><thead><tr>${['S','T','Q','Q','S','S','D'].map(d => `<th style="text-align:center;font-size:6pt;color:#9ca3af;padding:2px;font-weight:600">${d}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
      </div>`
    }).join('')
    return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><style>${baseStyle} h1{text-align:center;font-size:14pt;margin-bottom:16px;color:#111827;} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}</style></head><body>
      <h1>Calendário ${ano}</h1>
      <div class="grid">${mesesHTML}</div>
      ${rodape}</body></html>`
  }

  async function imprimirCalendarioFn() {
    const html = gerarHTMLCalendario()
    const ano = dataAtual.getFullYear()
    const mes = dataAtual.getMonth()
    const nome = vista === 'mensal' ? `calendario-${MESES[mes].toLowerCase()}-${ano}.pdf`
      : vista === 'anual' ? `calendario-${ano}.pdf`
      : `calendario-semana-${toDateStr(getDiasSemana()[0])}.pdf`
    await db.imprimirCalendario(html, nome)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Calendário</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { carregarPeriodos(); setModalPeriodos(true) }}
            className="btn-secondary text-sm"
          >
            Períodos
          </button>
          <button
            onClick={imprimirCalendarioFn}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Imprimir calendário como PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir
          </button>
          <button
            onClick={async () => {
              const res = await window.api.exports.mobileHTML()
              if (res?.success) alert('HTML mobile exportado com sucesso!')
            }}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Exportar HTML para consulta no telemóvel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Mobile
          </button>
          <button
            onClick={async () => {
              const res = await window.api.exports.ics()
              if (res?.success) alert('Calendário exportado! Importe o ficheiro .ics no Google Calendar ou Outlook.')
            }}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Exportar para Google Calendar / Outlook"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            .ics
          </button>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {['mensal', 'semanal', 'agenda', 'anual'].map(v => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                  vista === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <button onClick={navAnterior} className="btn-secondary px-3 py-1.5">←</button>
        <button onClick={navHoje} className="btn-secondary text-sm py-1.5">Hoje</button>
        <button onClick={navSeguinte} className="btn-secondary px-3 py-1.5">→</button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
          {vista === 'mensal'
            ? `${MESES[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`
            : vista === 'anual'
            ? `${dataAtual.getFullYear()}`
            : (() => {
                const dias = getDiasSemana()
                return `${dias[0].getDate()} – ${dias[6].getDate()} ${MESES[dias[6].getMonth()]} ${dias[6].getFullYear()}`
              })()
          }
        </h2>
      </div>

      {/* Calendar */}
      <div className="card overflow-hidden p-0">
        {vista === 'anual' ? (
          <div className="grid grid-cols-3 gap-4 p-4">
            {Array.from({ length: 12 }, (_, m) => {
              const ano = dataAtual.getFullYear()
              const dias = getDiasMiniMes(ano, m)
              return (
                <div
                  key={m}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  onClick={() => { setDataAtual(new Date(ano, m, 1)); setVista('mensal') }}
                >
                  <p className="text-sm font-bold text-center text-gray-800 dark:text-gray-200 mb-2">{MESES[m]}</p>
                  <div className="grid grid-cols-7 text-center">
                    {['S','T','Q','Q','S','S','D'].map((d, i) => (
                      <div key={i} className="text-xs font-semibold text-gray-400 dark:text-gray-500 pb-1">{d}</div>
                    ))}
                    {dias.map((date, idx) => {
                      if (!date) return <div key={idx} />
                      const dateStr = toDateStr(date)
                      const aulasNoDia = aulas.filter(a => a.data === dateStr)
                      const feriado = diasNaoLetivos[dateStr]
                      const isHoje = dateStr === hojeStr
                      return (
                        <div key={idx} className="flex flex-col items-center py-0.5">
                          <span className={`text-xs w-5 h-5 flex items-center justify-center rounded-full leading-none ${
                            isHoje ? 'bg-blue-600 text-white font-bold' :
                            feriado ? 'text-red-500 dark:text-red-400' :
                            'text-gray-700 dark:text-gray-300'
                          }`}>{date.getDate()}</span>
                          {aulasNoDia.length > 0 && (
                            <div className="flex gap-0.5 mt-0.5">
                              {aulasNoDia.slice(0, 3).map(a => (
                                <div key={a.id} className="w-1 h-1 rounded-full" style={{ backgroundColor: a.turma_cor || '#3B82F6' }} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : vista === 'mensal' ? (
          <div className="flex flex-col">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {DIAS_SEMANA_CURTO_MON.map(d => (
                <div key={d} className="px-2 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center uppercase">
                  {d}
                </div>
              ))}
            </div>
            {/* Days grid */}
            <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(9rem, auto)' }}>
              {diasMes.map((item, idx) => {
                const dateStr = toDateStr(item.date)
                const aulasNoDia = getAulasDoDia(dateStr)
                const isHoje = dateStr === hojeStr
                const isCurrentMonth = item.currentMonth
                const feriado = getFeriado(dateStr)

                const isPeriodo = feriado?.tipoCor === 'periodo'
                return (
                  <div
                    key={idx}
                    className={`border-b border-r border-gray-100 dark:border-gray-700/50 p-1 ${
                      feriado
                        ? isPeriodo
                          ? 'bg-amber-50 dark:bg-amber-900/10'
                          : 'bg-red-50 dark:bg-red-900/10'
                        : isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'
                    } ${idx % 7 === 0 ? 'border-l' : ''} ${dragOverDate === dateStr && !feriado ? 'ring-2 ring-blue-400 ring-inset bg-blue-50 dark:bg-blue-900/10' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDragEnter={(e) => { e.preventDefault(); setDragOverDate(dateStr) }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDate(null) }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverDate(null)
                      const aulaId = parseInt(e.dataTransfer.getData('aulaId'))
                      if (!isNaN(aulaId)) moverAula(aulaId, dateStr)
                    }}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                      isHoje
                        ? 'bg-blue-600 text-white'
                        : feriado
                          ? isPeriodo ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                          : isCurrentMonth
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {item.date.getDate()}
                    </div>
                    {feriado && (
                      <p className={`text-xs font-medium truncate px-0.5 mb-0.5 ${isPeriodo ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`} title={feriado.descricao}>
                        {feriado.descricao}
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {aulasNoDia.map(aula => (
                        <div key={aula.id} className="relative group">
                          <button
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('aulaId', String(aula.id))
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onClick={() => abrirAula(aula)}
                            className="w-full text-left text-xs px-1 py-0.5 rounded truncate text-white font-medium hover:opacity-80 transition-opacity pr-4"
                            style={{ backgroundColor: aula.turma_cor || estadoColors[aula.estado] || '#3B82F6' }}
                            title={`${aula.disciplina_nome} – ${aula.hora_inicio}. Arrasta para mover.`}
                          >
                            {aula.hora_inicio} {aula.disciplina_nome}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); eliminarAulaNoCalendario(aula.id) }}
                            className="absolute top-0 right-0 hidden group-hover:flex items-center justify-center w-4 h-full text-white/80 hover:text-white hover:bg-black/20 rounded-r text-xs"
                            title="Eliminar aula"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : vista === 'agenda' ? (
          /* Agenda view — timeline */
          <div className="p-4 space-y-3">
            {diasSemana.map((dia, i) => {
              const diaStr = toDateStr(dia)
              const isHoje = diaStr === hojeStr
              const aulasNoDia = aulas.filter(a => a.data === diaStr).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
              const feriadoObj = diasNaoLetivos[diaStr] || null
              const feriado = feriadoObj ? (feriadoObj.descricao || '') : null
              const totalHorasDia = aulasNoDia.reduce((s, a) => {
                if (!a.hora_inicio || !a.hora_fim) return s
                const [hi,mi] = a.hora_inicio.split(':').map(Number)
                const [hf,mf] = a.hora_fim.split(':').map(Number)
                return s + (hf*60+mf-hi*60-mi)/60
              }, 0)
              return (
                <div key={i} className={`rounded-lg overflow-hidden border ${isHoje ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className={`px-4 py-2 font-semibold text-sm flex justify-between items-center ${
                    isHoje ? 'bg-blue-600 text-white' :
                    feriado ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                    'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  }`}>
                    <span>{DIAS_SEMANA_CURTO[dia.getDay()]}, {dia.getDate()} {MESES[dia.getMonth()]}</span>
                    <span className="text-xs font-normal">
                      {feriado ? String(feriado) : ''}
                      {!feriado && aulasNoDia.length > 0 ? `${aulasNoDia.length} aula(s) · ${totalHorasDia.toFixed(1)}h` : ''}
                    </span>
                  </div>
                  {aulasNoDia.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic">Sem aulas</div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {aulasNoDia.map(aula => (
                        <div key={aula.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: aula.turma_cor || '#3B82F6' }} />
                          <div className="w-28 flex-shrink-0">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{aula.hora_inicio || ''}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500"> – {aula.hora_fim || ''}</span>
                            {aula.sala && <p className="text-xs text-gray-400 dark:text-gray-500">{aula.sala}</p>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{aula.disciplina_nome || ''}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{aula.turma_nome || ''}</p>
                            {aula.topico && <p className="text-xs text-blue-500 dark:text-blue-400 truncate mt-0.5">{aula.topico}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* Weekly view */
          <div className="flex flex-col">
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {diasSemana.map((dia, i) => {
                const diaStr = toDateStr(dia)
                const isHoje = diaStr === hojeStr
                const feriado = getFeriado(diaStr)
                const isPeriodo = feriado?.tipoCor === 'periodo'
                return (
                  <div key={i} className={`px-2 py-3 text-center border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 ${
                    feriado
                      ? isPeriodo ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-red-50 dark:bg-red-900/10'
                      : isHoje ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}>
                    <p className={`text-xs font-medium uppercase ${
                      feriado ? (isPeriodo ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400') : 'text-gray-500 dark:text-gray-400'
                    }`}>{DIAS_SEMANA_CURTO_MON[i]}</p>
                    <p className={`text-lg font-bold mt-0.5 ${
                      isHoje ? 'text-blue-600 dark:text-blue-400' :
                      feriado ? (isPeriodo ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400') :
                      'text-gray-800 dark:text-gray-200'
                    }`}>
                      {dia.getDate()}
                    </p>
                    {feriado && (
                      <p className={`text-xs truncate mt-0.5 leading-tight ${isPeriodo ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`} title={feriado.descricao}>
                        {feriado.descricao}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-7 overflow-y-auto" style={{ minHeight: '24rem' }}>
              {diasSemana.map((dia, i) => {
                const diaStr = toDateStr(dia)
                const aulasNoDia = getAulasDoDia(diaStr)
                const isHoje = diaStr === hojeStr
                const feriado = getFeriado(diaStr)
                return (
                  <div
                    key={i}
                    className={`border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 p-2 space-y-2 ${
                      feriado ? 'bg-red-50 dark:bg-red-900/10' : isHoje ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    } ${dragOverDate === diaStr && !feriado ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDragEnter={(e) => { e.preventDefault(); setDragOverDate(diaStr) }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDate(null) }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverDate(null)
                      const aulaId = parseInt(e.dataTransfer.getData('aulaId'))
                      if (!isNaN(aulaId)) moverAula(aulaId, diaStr)
                    }}
                  >
                    {aulasNoDia.length === 0 ? (
                      <p className="text-xs text-gray-300 dark:text-gray-600 text-center mt-4">—</p>
                    ) : (
                      aulasNoDia.map(aula => (
                        <div key={aula.id} className="relative group">
                          <button
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('aulaId', String(aula.id))
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onClick={() => abrirAula(aula)}
                            className="w-full text-left p-2 rounded-lg text-white text-xs hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: aula.turma_cor || estadoColors[aula.estado] || '#3B82F6' }}
                          >
                            <p className="font-medium truncate">{aula.disciplina_nome}</p>
                            <p className="opacity-90">{aula.hora_inicio}–{aula.hora_fim}{aula.sala ? ` · ${aula.sala}` : ''}</p>
                            {aula.topico && <p className="opacity-80 truncate mt-0.5">{aula.topico}</p>}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); eliminarAulaNoCalendario(aula.id) }}
                            className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-5 h-5 bg-black/30 hover:bg-black/50 text-white rounded text-xs"
                            title="Eliminar aula"
                          >×</button>
                        </div>
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 dark:text-gray-400">
        {Object.entries(estadoColors).map(([estado, cor]) => (
          <div key={estado} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
            <span>{estado}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Feriado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Período não letivo</span>
        </div>
      </div>

      {/* Lesson detail modal */}
      <Modal
        isOpen={modalAberto}
        onClose={() => { setModalAberto(false); setAulaSelecionada(null) }}
        title="Detalhes da Aula"
        size="md"
      >
        {aulaSelecionada && (
          <div className="space-y-4">
            <div
              className="h-2 rounded-full w-full"
              style={{ backgroundColor: aulaSelecionada.turma_cor || '#3B82F6' }}
            />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Disciplina</p>
                <p className="font-medium text-gray-900 dark:text-white">{aulaSelecionada.disciplina_nome}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Turma</p>
                <p className="font-medium text-gray-900 dark:text-white">{aulaSelecionada.turma_nome}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Data</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(aulaSelecionada.data + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Horário</p>
                <p className="font-medium text-gray-900 dark:text-white">{aulaSelecionada.hora_inicio} – {aulaSelecionada.hora_fim}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 dark:text-gray-400">Estado</p>
                <span className={`badge ${
                  aulaSelecionada.estado === 'Realizada' ? 'badge-green' :
                  aulaSelecionada.estado === 'Adiada' ? 'badge-yellow' :
                  aulaSelecionada.estado === 'Cancelada' ? 'badge-red' : 'badge-blue'
                }`}>{aulaSelecionada.estado}</span>
              </div>
            </div>
            {aulaSelecionada.topico && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tópico</p>
                <p className="text-sm text-gray-900 dark:text-white">{aulaSelecionada.topico}</p>
              </div>
            )}
            {aulaSelecionada.objetivos && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Objetivos</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{aulaSelecionada.objetivos}</p>
              </div>
            )}
            {aulaSelecionada.conteudos && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Conteúdos</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{aulaSelecionada.conteudos}</p>
              </div>
            )}
            {aulaSelecionada.notas && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{aulaSelecionada.notas}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
      {/* Modal gestão de períodos */}
      <Modal
        isOpen={modalPeriodos}
        onClose={() => setModalPeriodos(false)}
        title="Períodos Não Letivos"
        size="lg"
        footer={<button onClick={() => setModalPeriodos(false)} className="btn-secondary">Fechar</button>}
      >
        <div className="space-y-5">
          {/* Formulário de criação */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Novo Período</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label-field">Instituição</label>
                <select
                  value={periodoForm.instituicao_id}
                  onChange={e => setPeriodoForm(f => ({ ...f, instituicao_id: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Todas as instituições</option>
                  {instituicoes.map(i => (
                    <option key={i.id} value={i.id}>{i.nome}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label-field">Descrição *</label>
                <input
                  type="text"
                  value={periodoForm.descricao}
                  onChange={e => setPeriodoForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Férias de Natal, Interrupção do Carnaval..."
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Data início *</label>
                <input
                  type="date"
                  value={periodoForm.data_inicio}
                  onChange={e => setPeriodoForm(f => ({ ...f, data_inicio: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Data fim *</label>
                <input
                  type="date"
                  value={periodoForm.data_fim}
                  onChange={e => setPeriodoForm(f => ({ ...f, data_fim: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Tipo</label>
                <select
                  value={periodoForm.tipo}
                  onChange={e => setPeriodoForm(f => ({ ...f, tipo: e.target.value }))}
                  className="input-field"
                >
                  {TIPOS_PERIODO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={criarPeriodo} className="btn-primary w-full">Adicionar</button>
              </div>
            </div>
          </div>

          {/* Lista de períodos existentes */}
          {periodos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Sem períodos definidos</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {periodos.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-2 h-10 rounded-full bg-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.descricao}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(p.data_inicio + 'T12:00:00').toLocaleDateString('pt-PT')} – {new Date(p.data_fim + 'T12:00:00').toLocaleDateString('pt-PT')}
                      {' · '}{p.tipo}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {p.instituicao_nome || 'Todas as instituições'}
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarPeriodo(p.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
      <DialogModal dialog={dialog} onOk={handleOk} onCancel={handleCancel} />
    </div>
  )
}
