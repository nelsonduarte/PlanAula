import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

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

function AulaRow({ aula, showDate }) {
  // Para UFCD a designacao da turma costuma duplicar o nome da disciplina — omitir nesses casos
  const turmaDistinta = aula.turma_nome && aula.turma_nome !== aula.disciplina_nome
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: aula.turma_cor || '#2E86C1' }} />
      <div className="flex-1 min-w-0">
        {aula.curso_nome && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{aula.curso_nome}</p>}
        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
          {aula.disciplina_nome}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {showDate && <span>{new Date(aula.data + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · </span>}
          {aula.hora_inicio}–{aula.hora_fim}
          {aula.sala && <span className="ml-1">· {aula.sala}</span>}
          {turmaDistinta && <span className="ml-1 text-gray-400">· {aula.turma_nome}</span>}
        </p>
      </div>
      {aula.topico && <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-32 hidden md:block">{aula.topico}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [financeiro, setFinanceiro] = useState(null)
  const [loading, setLoading] = useState(true)

  const hoje = new Date()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [statsRes, finRes] = await Promise.all([
        window.api.dashboard.stats(),
        window.api.financeiro.calcularMensal(hoje.getFullYear(), hoje.getMonth() + 1)
      ])
      if (statsRes?.success) setStats(statsRes.data)
      if (finRes?.success) setFinanceiro(finRes.data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const totalHorasMes = stats.horasMesInst.reduce((s, i) => s + i.horas, 0)
  const formatCur = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📝" label="Aulas hoje" value={stats.aulasHoje.length} sub={stats.aulasAmanha.length > 0 ? `${stats.aulasAmanha.length} amanhã` : 'sem aulas amanhã'} color="green" />
        <StatCard icon="⏱️" label="Horas esta semana" value={stats.horasSemana.toFixed(1) + 'h'} color="blue" />
        <StatCard icon="📊" label="Horas este mês" value={totalHorasMes.toFixed(1) + 'h'} sub={`${stats.horasMesInst.length} instituição(ões)`} color="purple" />
        <StatCard icon="💶" label="Rendimento mensal" value={financeiro ? formatCur(financeiro.total_liquido) : '—'} sub="líquido" color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Aulas */}
        <div className="lg:col-span-2 space-y-4">

          {/* Aulas de hoje */}
          <div className="card">
            <h2 className="section-title mb-4">Aulas de Hoje</h2>
            {stats.aulasHoje.length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                <p className="text-3xl mb-2">☀️</p>
                <p>Sem aulas para hoje</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.aulasHoje.map(a => <AulaRow key={a.id} aula={a} />)}
              </div>
            )}
          </div>

          {/* Aulas de amanhã */}
          {stats.aulasAmanha.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-4">Amanhã</h2>
              <div className="space-y-2">
                {stats.aulasAmanha.map(a => <AulaRow key={a.id} aula={a} />)}
              </div>
            </div>
          )}

          {/* Alertas */}
          {stats.avaliacoes.length > 0 && (
            <div className="card border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/10">
              <div className="flex items-start gap-3">
                <span className="text-blue-500 text-xl">📋</span>
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-400">Avaliações próximas</p>
                  <div className="mt-2 space-y-1">
                    {stats.avaliacoes.map((av, i) => (
                      <p key={i} className="text-sm text-blue-700 dark:text-blue-300">
                        {new Date(av.data_avaliacao + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' — '}{av.disciplina_nome} ({av.turma_nome})
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {stats.semPreparar > 0 && (
            <div className="card border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10">
              <div className="flex items-start gap-3">
                <span className="text-yellow-500 text-xl">⚠️</span>
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-400">Aulas sem preparação</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {stats.semPreparar} aula(s) nas próximas 2 semanas sem tópico definido.
                  </p>
                  <Link to="/aulas" className="text-sm text-yellow-700 dark:text-yellow-400 underline mt-1 inline-block">Ver aulas →</Link>
                </div>
              </div>
            </div>
          )}

          {stats.semSumario > 0 && (
            <div className="card border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-900/10">
              <div className="flex items-start gap-3">
                <span className="text-orange-500 text-xl">📝</span>
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-400">Aulas dadas sem sumário</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    {stats.semSumario} aula(s) realizada(s) nas últimas 4 semanas ainda sem sumário registado.
                  </p>
                  <Link to="/aulas" className="text-sm text-orange-700 dark:text-orange-400 underline mt-1 inline-block">Ver aulas →</Link>
                </div>
              </div>
            </div>
          )}

          {stats.turmasTerminar.length > 0 && (
            <div className="card border-l-4 border-green-400 bg-green-50 dark:bg-green-900/10">
              <div className="flex items-start gap-3">
                <span className="text-green-500 text-xl">🏁</span>
                <div>
                  <p className="font-medium text-green-800 dark:text-green-400">Turmas a terminar</p>
                  <div className="mt-2 space-y-1">
                    {stats.turmasTerminar.map((t, i) => (
                      <p key={i} className="text-sm text-green-700 dark:text-green-300">
                        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: t.cor }} />
                        {t.turma_nome} — {t.disciplina_nome} ({t.horas_dadas.toFixed(0)}h / {t.carga_horaria}h)
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — Resumos */}
        <div className="space-y-4">

          {/* Horas por instituição */}
          <div className="card">
            <h2 className="section-title mb-4">Horas do Mês por Instituição</h2>
            {stats.horasMesInst.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">Sem aulas este mês</p>
            ) : (
              <div className="space-y-3">
                {stats.horasMesInst.map((inst, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{inst.instituicao}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{inst.horas.toFixed(1)}h</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${totalHorasMes > 0 ? (inst.horas / totalHorasMes * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between text-sm font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Total</span>
                  <span className="text-blue-600 dark:text-blue-400">{totalHorasMes.toFixed(1)}h</span>
                </div>
              </div>
            )}
          </div>

          {/* Resumo financeiro */}
          {financeiro && financeiro.total_bruto > 0 && (
            <div className="card">
              <h2 className="section-title mb-4">Resumo Financeiro</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Valor bruto</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCur(financeiro.total_bruto)}</span>
                </div>
                {financeiro.taxa_iva > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">IVA ({(financeiro.taxa_iva * 100).toFixed(0)}%)</span>
                    <span className="font-medium text-green-600 dark:text-green-400">+{formatCur(financeiro.total_iva)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Retenção IRS ({(financeiro.taxa_irs * 100).toFixed(0)}%)</span>
                  <span className="font-medium text-red-600 dark:text-red-400">-{formatCur(financeiro.total_irs)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between text-sm font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Valor líquido</span>
                  <span className="text-blue-600 dark:text-blue-400">{formatCur(financeiro.total_liquido)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
