import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase.js'

function StatCard({ icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  }
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

function EstadoBadge({ estado }) {
  const map = {
    'Planeada':  'badge-blue',
    'Realizada': 'badge-green',
    'Adiada':    'badge-yellow',
    'Cancelada': 'badge-red',
  }
  return <span className={map[estado] || 'badge-gray'}>{estado}</span>
}

export default function Dashboard() {
  const db = useDatabase()
  const [aulas, setAulas] = useState([])
  const [disciplinas, setDisciplinas] = useState([])
  const [financeiro, setFinanceiro] = useState(null)
  const [loading, setLoading] = useState(true)

  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [aulasData, discData, finData] = await Promise.all([
        db.listarAulas(),
        db.listarDisciplinas(),
        db.calcularFinanceiroMensal(hoje.getFullYear(), hoje.getMonth() + 1)
      ])
      setAulas(aulasData || [])
      setDisciplinas(discData || [])
      setFinanceiro(finData)
      setLoading(false)
    }
    load()
  }, [])

  const aulasHoje = aulas.filter(a => a.data === hojeStr)
  const proximasAulas = aulas
    .filter(a => a.data > hojeStr)
    .slice(0, 5)
  const aulasSemPreparar = aulas.filter(a => a.data >= hojeStr && a.estado === 'Planeada' && !a.topico)
  const aulasDoMes = aulas.filter(a => a.data && a.data.startsWith(mesAtual.slice(0, 7)))
  const totalHorasMes = aulasDoMes.reduce((sum, a) => {
    if (!a.hora_inicio || !a.hora_fim) return sum
    const [hi, mi] = a.hora_inicio.split(':').map(Number)
    const [hf, mf] = a.hora_fim.split(':').map(Number)
    return sum + (hf * 60 + mf - hi * 60 - mi) / 60
  }, 0)

  // Mini weekly calendar
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - hoje.getDay() + 1)
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana)
    d.setDate(inicioSemana.getDate() + i)
    return d
  })
  const diasSemanaLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Painel</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {hoje.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link to="/aulas" className="btn-primary">+ Nova Aula</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📚" label="Disciplinas" value={disciplinas.length} color="blue" />
        <StatCard icon="📝" label="Aulas hoje" value={aulasHoje.length} color="green" />
        <StatCard icon="⏱️" label="Horas este mês" value={totalHorasMes.toFixed(1) + 'h'} color="purple" />
        <StatCard
          icon="💶"
          label="Rendimento mensal"
          value={financeiro ? `€${financeiro.total_liquido.toFixed(2)}` : '—'}
          sub="líquido"
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's classes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="section-title mb-4">Aulas de Hoje</h2>
            {aulasHoje.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <p className="text-3xl mb-2">☀️</p>
                <p>Sem aulas para hoje</p>
              </div>
            ) : (
              <div className="space-y-3">
                {aulasHoje.map(aula => (
                  <div key={aula.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div
                      className="w-1 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: aula.turma_cor || '#2E86C1' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {aula.disciplina_nome} — {aula.turma_nome}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {aula.hora_inicio} – {aula.hora_fim}
                        {aula.topico && ` · ${aula.topico}`}
                      </p>
                    </div>
                    <EstadoBadge estado={aula.estado} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming classes */}
          <div className="card">
            <h2 className="section-title mb-4">Próximas Aulas</h2>
            {proximasAulas.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">Sem aulas agendadas</p>
            ) : (
              <div className="space-y-2">
                {proximasAulas.map(aula => (
                  <div key={aula.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: aula.turma_cor || '#2E86C1' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {aula.disciplina_nome}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(aula.data + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · {aula.hora_inicio}
                      </p>
                    </div>
                    <EstadoBadge estado={aula.estado} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          {aulasSemPreparar.length > 0 && (
            <div className="card border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10">
              <div className="flex items-start gap-3">
                <span className="text-yellow-500 text-xl">⚠️</span>
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-400">Aulas sem preparação</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Tem {aulasSemPreparar.length} aula(s) sem tópico definido.
                  </p>
                  <Link to="/aulas" className="text-sm text-yellow-700 dark:text-yellow-400 underline mt-1 inline-block">
                    Ver aulas →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Weekly calendar */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-title mb-4">Esta Semana</h2>
            <div className="grid grid-cols-7 gap-1 mb-3">
              {diasSemanaLabels.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {diasSemana.map((dia, i) => {
                const diaStr = dia.toISOString().split('T')[0]
                const aulasNoDia = aulas.filter(a => a.data === diaStr)
                const isHoje = diaStr === hojeStr
                return (
                  <div
                    key={i}
                    className={`relative flex flex-col items-center py-2 rounded-lg text-sm ${
                      isHoje
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="font-medium">{dia.getDate()}</span>
                    {aulasNoDia.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isHoje ? 'bg-white' : 'bg-blue-500'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick financial */}
          {financeiro && (
            <div className="card">
              <h2 className="section-title mb-4">Resumo Financeiro</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Valor bruto</span>
                  <span className="font-medium text-gray-900 dark:text-white">€{financeiro.total_bruto.toFixed(2)}</span>
                </div>
                {financeiro.taxa_iva > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">IVA ({(financeiro.taxa_iva * 100).toFixed(0)}%)</span>
                    <span className="font-medium text-green-600 dark:text-green-400">+€{financeiro.total_iva.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Retenção IRS ({(financeiro.taxa_irs * 100).toFixed(0)}%)</span>
                  <span className="font-medium text-red-600 dark:text-red-400">-€{financeiro.total_irs.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between text-sm font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Valor líquido</span>
                  <span className="text-blue-600 dark:text-blue-400">€{financeiro.total_liquido.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Disciplines quick list */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Disciplinas</h2>
              <Link to="/disciplinas" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Ver todas</Link>
            </div>
            {disciplinas.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">Sem disciplinas</p>
            ) : (
              <div className="space-y-2">
                {disciplinas.slice(0, 5).map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{d.nome}</span>
                    <span className="ml-auto text-xs text-gray-400">{d.carga_horaria}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
