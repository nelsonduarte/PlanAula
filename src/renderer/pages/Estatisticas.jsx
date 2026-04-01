import React, { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer
} from 'recharts'
import { useDatabase } from '../hooks/useDatabase.js'

const CORES_GRAFICO = [
  '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#14B8A6'
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value % 1 === 0 ? p.value : p.value.toFixed(1) : p.value}</p>
        ))}
      </div>
    )
  }
  return null
}

function KpiCard({ value, label, color }) {
  return (
    <div className="card text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function Estatisticas() {
  const db = useDatabase()
  const anoAtual = new Date().getFullYear()
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarStats() }, [anoSelecionado])

  async function carregarStats() {
    setLoading(true)
    const data = await db.obterEstatisticas(anoSelecionado)
    setStats(data)
    setLoading(false)
  }

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => anoAtual - 2 + i)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!stats) return null

  // Dados para gráficos
  const dadosPorEstado = stats.porEstado.map(e => ({ name: e.estado, value: e.total }))

  const dadosPorDisciplina = stats.porDisciplina.map((d, i) => ({
    name: d.disciplina_nome.length > 18 ? d.disciplina_nome.substring(0, 18) + '…' : d.disciplina_nome,
    horas: parseFloat((d.total_horas || 0).toFixed(1)),
    aulas: d.total_aulas,
    fill: CORES_GRAFICO[i % CORES_GRAFICO.length]
  }))

  const dadosEvolucao = stats.evolucaoMensal.map(m => {
    const [, mesStr] = m.mes.split('-')
    return {
      mes: MESES_ABREV[parseInt(mesStr) - 1] || m.mes,
      aulas: m.total_aulas,
      horas: parseFloat((m.total_horas || 0).toFixed(1))
    }
  })

  const dadosDiaSemana = DIAS_SEMANA.map((nome, i) => {
    const found = stats.porDiaSemana.find(d => d.dia === i)
    return { dia: nome, aulas: found?.total_aulas || 0, horas: parseFloat((found?.total_horas || 0).toFixed(1)) }
  }).filter((_, i) => i >= 1 && i <= 5) // apenas Seg-Sex

  const totalHoras = stats.totalHoras || 0
  const mesesComDados = stats.evolucaoMensal.length || 1
  const mediaHorasMes = (totalHoras / mesesComDados).toFixed(1)

  // Dados de rendimento mensal por instituição
  const dadosRendimento = (stats.rendimentoMensal || []).map(m => {
    const [, mesStr] = m.mes.split('-')
    const entry = { mes: MESES_ABREV[parseInt(mesStr) - 1] || m.mes }
    Object.entries(m.porInstituicao || {}).forEach(([inst, val]) => { entry[inst] = parseFloat(val.toFixed(2)) })
    entry.total = parseFloat((m.total_liquido || 0).toFixed(2))
    return entry
  })
  const instituicoesRendimento = [...new Set((stats.rendimentoMensal || []).flatMap(m => Object.keys(m.porInstituicao || {})))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Estatísticas</h1>
        <select
          value={anoSelecionado}
          onChange={e => setAnoSelecionado(parseInt(e.target.value))}
          className="input-field w-auto"
        >
          {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard value={stats.totalAulas} label="Total de Aulas" color="text-blue-600 dark:text-blue-400" />
        <KpiCard value={`${totalHoras.toFixed(1)}h`} label="Total de Horas" color="text-indigo-600 dark:text-indigo-400" />
        <KpiCard value={stats.realizadas} label="Realizadas" color="text-green-600 dark:text-green-400" />
        <KpiCard value={`${stats.taxaConclusao}%`} label="Taxa de Realização" color="text-purple-600 dark:text-purple-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard value={stats.adiadas} label="Adiadas" color="text-yellow-600 dark:text-yellow-400" />
        <KpiCard value={stats.canceladas} label="Canceladas" color="text-red-600 dark:text-red-400" />
        <KpiCard value={`${mediaHorasMes}h`} label="Média Mensal" color="text-cyan-600 dark:text-cyan-400" />
        <KpiCard value={stats.porTurma.length} label="Turmas com Aulas" color="text-teal-600 dark:text-teal-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie — estado */}
        <div className="card">
          <h2 className="section-title mb-4">Aulas por Estado</h2>
          {dadosPorEstado.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dadosPorEstado} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {dadosPorEstado.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.name === 'Realizada' ? '#22C55E' :
                      entry.name === 'Planeada'  ? '#3B82F6' :
                      entry.name === 'Adiada'    ? '#F59E0B' : '#EF4444'
                    } />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar — horas por disciplina */}
        <div className="card">
          <h2 className="section-title mb-4">Horas por Disciplina</h2>
          {dadosPorDisciplina.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosPorDisciplina} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="horas" name="Horas" radius={[0, 4, 4, 0]}>
                  {dadosPorDisciplina.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Evolução mensal */}
      <div className="card">
        <h2 className="section-title mb-4">Evolução Mensal {anoSelecionado}</h2>
        {dadosEvolucao.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados de evolução mensal</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dadosEvolucao} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="horas" name="Horas" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="aulas" name="Aulas" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por dia da semana */}
        <div className="card">
          <h2 className="section-title mb-4">Aulas Realizadas por Dia da Semana</h2>
          {dadosDiaSemana.every(d => d.aulas === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dadosDiaSemana} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="aulas" name="Aulas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="horas" name="Horas" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Rendimento por instituição */}
        <div className="card">
          <h2 className="section-title mb-4">Rendimento por Instituição</h2>
          {dadosRendimento.length === 0 || dadosRendimento.every(d => d.total === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados de rendimento</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dadosRendimento} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
                <Tooltip content={<CustomTooltip />} formatter={v => `${v.toFixed(2)}€`} />
                <Legend />
                {instituicoesRendimento.map((inst, i) => (
                  <Bar key={inst} dataKey={inst} name={inst} stackId="a" fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} radius={i === instituicoesRendimento.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Progresso por turma */}
      {stats.porTurma.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">Progresso por Turma</h2>
          <div className="space-y-3">
            {stats.porTurma.map((t, i) => {
              const progresso = t.carga_horaria > 0 ? Math.min(100, (t.horas_dadas / t.carga_horaria) * 100) : null
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{t.turma_nome}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{t.disciplina_nome}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-3">
                      <span>{t.horas_dadas.toFixed(1)}h dadas{t.carga_horaria > 0 ? ` / ${t.carga_horaria}h` : ''}</span>
                      <span className="text-gray-400">·</span>
                      <span>{t.total_aulas} aulas</span>
                    </div>
                  </div>
                  {progresso !== null ? (
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progresso}%`,
                          backgroundColor: progresso >= 100 ? '#22C55E' : progresso >= 50 ? '#3B82F6' : '#F59E0B'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: '100%', opacity: 0.3 }} />
                    </div>
                  )}
                  {progresso !== null && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 text-right">{progresso.toFixed(0)}%</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
