import React, { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, Area, AreaChart
} from 'recharts'
import { useDatabase } from '../hooks/useDatabase.js'

const CORES_GRAFICO = [
  '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#14B8A6'
]

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

function KpiCard({ value, label, color, sub }) {
  return (
    <div className="card text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
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

  const totalHoras = stats.totalHoras || 0
  const mesesComDados = stats.evolucaoMensal.length || 1
  const mediaHorasMes = (totalHoras / mesesComDados).toFixed(1)

  // Rendimento total e mensal
  const rendimentoMensal = stats.rendimentoMensal || []
  const rendimentoTotal = rendimentoMensal.reduce((s, m) => s + (m.total_liquido || 0), 0)
  const mediaRendMes = mesesComDados > 0 ? (rendimentoTotal / mesesComDados).toFixed(2) : '0.00'

  // Evolução mensal com rendimento
  const dadosEvolucao = stats.evolucaoMensal.map(m => {
    const [, mesStr] = m.mes.split('-')
    const mesIdx = parseInt(mesStr) - 1
    const rend = rendimentoMensal.find(r => r.mes === m.mes)
    return {
      mes: MESES_ABREV[mesIdx] || m.mes,
      horas: parseFloat((m.total_horas || 0).toFixed(1)),
      rendimento: parseFloat((rend?.total_liquido || 0).toFixed(2))
    }
  })

  // Rendimento por instituição (barras empilhadas)
  const dadosRendimento = rendimentoMensal.map(m => {
    const [, mesStr] = m.mes.split('-')
    const entry = { mes: MESES_ABREV[parseInt(mesStr) - 1] || m.mes }
    Object.entries(m.porInstituicao || {}).forEach(([inst, val]) => { entry[inst] = parseFloat(val.toFixed(2)) })
    entry.total = parseFloat((m.total_liquido || 0).toFixed(2))
    return entry
  })
  const instituicoesRendimento = [...new Set(rendimentoMensal.flatMap(m => Object.keys(m.porInstituicao || {})))]

  // Horas por instituição (pie)
  const horasPorInst = {}
  rendimentoMensal.forEach(m => {
    Object.entries(m.porInstituicao || {}).forEach(([inst]) => {
      if (!horasPorInst[inst]) horasPorInst[inst] = 0
    })
  })
  // Calcular horas por instituição a partir das turmas
  if (stats.porTurma) {
    stats.porTurma.forEach(t => {
      const inst = t.instituicao_nome || 'Sem instituição'
      horasPorInst[inst] = (horasPorInst[inst] || 0) + (t.horas_total || 0)
    })
  }
  const dadosHorasInst = Object.entries(horasPorInst)
    .filter(([, h]) => h > 0)
    .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(1)), fill: CORES_GRAFICO[i % CORES_GRAFICO.length] }))

  const formatCurrency = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

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
        <KpiCard value={`${totalHoras.toFixed(0)}h`} label="Total de Horas" color="text-blue-600 dark:text-blue-400" sub={`${stats.totalAulas} aulas`} />
        <KpiCard value={formatCurrency(rendimentoTotal)} label="Rendimento Líquido" color="text-green-600 dark:text-green-400" sub={`${stats.taxaConclusao}% realizado`} />
        <KpiCard value={`${mediaHorasMes}h`} label="Média Mensal" color="text-indigo-600 dark:text-indigo-400" sub={`${formatCurrency(parseFloat(mediaRendMes))}/mês`} />
        <KpiCard value={stats.porTurma.length} label="Turmas Activas" color="text-purple-600 dark:text-purple-400" sub={`${instituicoesRendimento.length} instituições`} />
      </div>

      {/* Evolução mensal — horas + rendimento */}
      <div className="card">
        <h2 className="section-title mb-4">Evolução Mensal {anoSelecionado}</h2>
        {dadosEvolucao.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dadosEvolucao} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradHoras" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="horas" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="rend" orientation="right" tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area yAxisId="horas" type="monotone" dataKey="horas" name="Horas" stroke="#3B82F6" strokeWidth={2} fill="url(#gradHoras)" dot={{ r: 4 }} />
              <Area yAxisId="rend" type="monotone" dataKey="rendimento" name="Rendimento (€)" stroke="#22C55E" strokeWidth={2} fill="url(#gradRend)" dot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rendimento por instituição */}
        <div className="card">
          <h2 className="section-title mb-4">Rendimento por Instituição</h2>
          {dadosRendimento.length === 0 || dadosRendimento.every(d => d.total === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
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

        {/* Horas por instituição */}
        <div className="card">
          <h2 className="section-title mb-4">Horas por Instituição</h2>
          {dadosHorasInst.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500"><p className="text-sm">Sem dados</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dadosHorasInst} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                  paddingAngle={3} dataKey="value" label={false}>
                  {dadosHorasInst.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} formatter={v => `${v}h`} />
                <Legend formatter={(value, entry) => {
                  const item = dadosHorasInst.find(d => d.name === value)
                  return `${value} · ${item?.value || 0}h`
                }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  )
}
