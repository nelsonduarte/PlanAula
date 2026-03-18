import React, { useState, useEffect } from 'react'
import Modal from '../components/Modal.jsx'
import { useDatabase } from '../hooks/useDatabase.js'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const DIAS_SEMANA_CURTO_MON = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']

const estadoColors = {
  'Planeada':  '#3B82F6',
  'Realizada': '#22C55E',
  'Adiada':    '#EAB308',
  'Cancelada': '#EF4444',
}

export default function Calendario() {
  const db = useDatabase()
  const [aulas, setAulas] = useState([])
  const [vista, setVista] = useState('mensal')
  const [dataAtual, setDataAtual] = useState(new Date())
  const [aulaSelecionada, setAulaSelecionada] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)

  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]

  useEffect(() => { carregarAulas() }, [dataAtual, vista])

  async function carregarAulas() {
    let data_inicio, data_fim
    if (vista === 'mensal') {
      const ano = dataAtual.getFullYear()
      const mes = dataAtual.getMonth()
      data_inicio = new Date(ano, mes, 1).toISOString().split('T')[0]
      data_fim = new Date(ano, mes + 1, 0).toISOString().split('T')[0]
    } else {
      // weekly
      const start = new Date(dataAtual)
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      data_inicio = start.toISOString().split('T')[0]
      data_fim = end.toISOString().split('T')[0]
    }
    const data = await db.listarAulas({ data_inicio, data_fim })
    setAulas(data || [])
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

  const diasMes = getDiasMes()
  const diasSemana = getDiasSemana()

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Calendário</h1>
        <div className="flex items-center gap-2">
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
      <div className="card flex-1 overflow-hidden p-0">
        {vista === 'mensal' ? (
          <div className="h-full flex flex-col">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {DIAS_SEMANA_CURTO_MON.map(d => (
                <div key={d} className="px-2 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center uppercase">
                  {d}
                </div>
              ))}
            </div>
            {/* Days grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
              {diasMes.map((item, idx) => {
                const dateStr = item.date.toISOString().split('T')[0]
                const aulasNoDia = getAulasDoDia(dateStr)
                const isHoje = dateStr === hojeStr
                const isCurrentMonth = item.currentMonth

                return (
                  <div
                    key={idx}
                    className={`border-b border-r border-gray-100 dark:border-gray-700/50 p-1 min-h-0 overflow-hidden ${
                      isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'
                    } ${idx % 7 === 0 ? 'border-l' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                      isHoje
                        ? 'bg-blue-600 text-white'
                        : isCurrentMonth
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {item.date.getDate()}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {aulasNoDia.slice(0, 3).map(aula => (
                        <button
                          key={aula.id}
                          onClick={() => abrirAula(aula)}
                          className="w-full text-left text-xs px-1 py-0.5 rounded truncate text-white font-medium hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: aula.turma_cor || estadoColors[aula.estado] || '#3B82F6' }}
                          title={`${aula.disciplina_nome} – ${aula.hora_inicio}`}
                        >
                          {aula.hora_inicio} {aula.disciplina_nome}
                        </button>
                      ))}
                      {aulasNoDia.length > 3 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 px-1">+{aulasNoDia.length - 3}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Weekly view */
          <div className="h-full flex flex-col">
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {diasSemana.map((dia, i) => {
                const diaStr = dia.toISOString().split('T')[0]
                const isHoje = diaStr === hojeStr
                return (
                  <div key={i} className={`px-2 py-3 text-center border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 ${isHoje ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{DIAS_SEMANA_CURTO_MON[i]}</p>
                    <p className={`text-lg font-bold mt-0.5 ${isHoje ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {dia.getDate()}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="flex-1 grid grid-cols-7 overflow-y-auto">
              {diasSemana.map((dia, i) => {
                const diaStr = dia.toISOString().split('T')[0]
                const aulasNoDia = getAulasDoDia(diaStr)
                const isHoje = diaStr === hojeStr
                return (
                  <div key={i} className={`border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 p-2 space-y-2 ${isHoje ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                    {aulasNoDia.length === 0 ? (
                      <p className="text-xs text-gray-300 dark:text-gray-600 text-center mt-4">—</p>
                    ) : (
                      aulasNoDia.map(aula => (
                        <button
                          key={aula.id}
                          onClick={() => abrirAula(aula)}
                          className="w-full text-left p-2 rounded-lg text-white text-xs hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: aula.turma_cor || estadoColors[aula.estado] || '#3B82F6' }}
                        >
                          <p className="font-medium truncate">{aula.disciplina_nome}</p>
                          <p className="opacity-90">{aula.hora_inicio}–{aula.hora_fim}</p>
                          {aula.topico && <p className="opacity-80 truncate mt-0.5">{aula.topico}</p>}
                        </button>
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
    </div>
  )
}
