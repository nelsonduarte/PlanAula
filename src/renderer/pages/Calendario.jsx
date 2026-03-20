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
    else d.setDate(d.getDate() - 7)
    setDataAtual(d)
  }

  function navSeguinte() {
    const d = new Date(dataAtual)
    if (vista === 'mensal') d.setMonth(d.getMonth() + 1)
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
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setVista('mensal')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                vista === 'mensal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setVista('semanal')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                vista === 'semanal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Semanal
            </button>
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
            : (() => {
                const dias = getDiasSemana()
                return `${dias[0].getDate()} – ${dias[6].getDate()} ${MESES[dias[6].getMonth()]} ${dias[6].getFullYear()}`
              })()
          }
        </h2>
      </div>

      {/* Calendar */}
      <div className="card overflow-hidden p-0">
        {vista === 'mensal' ? (
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
