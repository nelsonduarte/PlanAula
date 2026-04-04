import React, { useState, useEffect } from 'react'
import Modal from '../components/Modal.jsx'
import DialogModal from '../components/DialogModal.jsx'
import { useDatabase } from '../hooks/useDatabase.js'
import { useDialog } from '../hooks/useDialog.js'

const COR_PALETTE = [
  '#2E86C1', '#27AE60', '#E74C3C', '#F39C12', '#8E44AD',
  '#16A085', '#D35400', '#2C3E50', '#C0392B', '#1ABC9C'
]

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const emptyForm = {
  disciplina_id: '',
  designacao: '',
  ano_letivo: '',
  semestre: 1,
  sala: '',
  cor: '#2E86C1',
  data_inicio: '',
  data_fim: '',
  carga_horaria: 0,
}

export default function Turmas() {
  const db = useDatabase()
  const { confirm, alert, dialog, handleOk, handleCancel } = useDialog()
  const [turmas, setTurmas] = useState([])
  const [disciplinas, setDisciplinas] = useState([])
  const [horarios, setHorarios] = useState({})
  const [modalAberto, setModalAberto] = useState(false)
  const [modalHorarios, setModalHorarios] = useState(false)
  const [editando, setEditando] = useState(null)
  const [turmaSelecionada, setTurmaSelecionada] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [novosHorarios, setNovosHorarios] = useState([{ dia_semana: 1, hora_inicio: '09:00', hora_fim: '11:00', sala: '' }])
  const [filtroDisc, setFiltroDisc] = useState('')

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const [t, d] = await Promise.all([db.listarTurmas(), db.listarDisciplinas()])
    setTurmas(t || [])
    setDisciplinas(d || [])
    // Set default year
    if (!form.ano_letivo) {
      const ano = new Date().getFullYear()
      setForm(f => ({ ...f, ano_letivo: `${ano}/${ano + 1}` }))
    }
  }

  async function carregarHorarios(turma_id) {
    const h = await db.listarHorarios(turma_id)
    setHorarios(prev => ({ ...prev, [turma_id]: h || [] }))
    return h || []
  }

  async function exportarRelatorio(turma) {
    const [h, aulasData, config] = await Promise.all([
      carregarHorarios(turma.id),
      db.listarAulas({ turma_id: turma.id }),
      db.obterConfiguracoes()
    ])
    const disc = disciplinas.find(d => d.id === turma.disciplina_id)
    const turmaComInfo = { ...turma, curso_nome: disc?.curso_nome || '' }
    const aulas = (aulasData || []).sort((a, b) => a.data.localeCompare(b.data))
    await db.exportarRelatorioTurma(turmaComInfo, h, aulas, config || {})
  }

  function abrirCriar() {
    setEditando(null)
    const ano = new Date().getFullYear()
    setForm({ ...emptyForm, ano_letivo: `${ano}/${ano + 1}` })
    setNovosHorarios([{ dia_semana: 1, hora_inicio: '09:00', hora_fim: '11:00' }])
    setModalAberto(true)
  }

  function abrirEditar(turma) {
    setEditando(turma)
    setForm({ ...turma })
    setModalAberto(true)
  }

  async function abrirHorarios(turma) {
    setTurmaSelecionada(turma)
    const h = await carregarHorarios(turma.id)
    setNovosHorarios(h && h.length > 0 ? h : [{ dia_semana: 1, hora_inicio: '09:00', hora_fim: '11:00' }])
    setModalHorarios(true)
  }

  async function salvar() {
    if (!form.disciplina_id || !form.designacao) {
      await alert('Preencha os campos obrigatórios')
      return
    }
    const dados = {
      ...form,
      disciplina_id: parseInt(form.disciplina_id),
      semestre: parseInt(form.semestre) || 1
    }
    if (editando) {
      await db.editarTurma(editando.id, dados)
    } else {
      const nova = await db.criarTurma(dados)
      if (nova && nova.id && novosHorarios.length) {
        for (const h of novosHorarios) {
          await db.criarHorario({ ...h, turma_id: nova.id })
        }
      }
    }
    await carregarDados()
    setModalAberto(false)
  }

  async function eliminar(id) {
    if (!await confirm('Eliminar esta turma? Todas as aulas associadas serão eliminadas.', { danger: true })) return
    await db.eliminarTurma(id)
    await carregarDados()
  }

  async function eliminarTodas() {
    if (turmas.length === 0) return
    if (!await confirm(`Eliminar todas as ${turmas.length} turma(s)? Todas as aulas associadas serão eliminadas. Esta ação não pode ser revertida.`, { danger: true })) return
    for (const t of turmas) {
      await db.eliminarTurma(t.id)
    }
    await carregarDados()
  }

  async function salvarHorarios() {
    const existentes = horarios[turmaSelecionada.id] || []
    for (const h of existentes) {
      await db.eliminarHorario(h.id)
    }
    for (const h of novosHorarios) {
      await db.criarHorario({ ...h, turma_id: turmaSelecionada.id })
    }
    await carregarHorarios(turmaSelecionada.id)
    setModalHorarios(false)
  }

  function adicionarHorario() {
    setNovosHorarios(h => [...h, { dia_semana: 1, hora_inicio: '09:00', hora_fim: '11:00', sala: '' }])
  }

  function removerHorario(idx) {
    setNovosHorarios(h => h.filter((_, i) => i !== idx))
  }

  function atualizarHorario(idx, campo, valor) {
    setNovosHorarios(h => h.map((item, i) => i === idx ? { ...item, [campo]: valor } : item))
  }

  // Group by discipline
  const turmasFiltradas = turmas.filter(t =>
    !filtroDisc || t.designacao === filtroDisc
  )

  const porDisciplina = turmasFiltradas.reduce((acc, t) => {
    const key = t.designacao
    if (!acc[key]) acc[key] = { nome: t.designacao, turmas: [] }
    acc[key].turmas.push(t)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Turmas</h1>
        <div className="flex gap-2">
          {turmas.length > 0 && (
            <button onClick={eliminarTodas} className="btn-danger">Eliminar Todas</button>
          )}
          <button onClick={abrirCriar} className="btn-primary">+ Nova Turma</button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={filtroDisc}
          onChange={e => setFiltroDisc(e.target.value)}
          className="input-field max-w-xs"
        >
          <option value="">Todas as turmas</option>
          {[...new Set(turmas.map(t => t.designacao))].sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {Object.keys(porDisciplina).length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Sem turmas</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Crie uma disciplina primeiro, depois adicione turmas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Turmas agrupadas (formação com várias UFCDs) */}
          {Object.entries(porDisciplina).filter(([, g]) => g.turmas.length > 1).map(([key, grupo]) => (
            <div key={key}>
              <h2 className="section-title mb-3">{grupo.nome}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grupo.turmas.map(turma => (
                  <div key={turma.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: turma.cor }}>
                        {turma.designacao.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{turma.disciplina_nome}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {turma.ano_letivo}{turma.semestre ? ` · ${turma.semestre}º Sem` : ''}
                        </p>
                      </div>
                    </div>
                    {(turma.data_inicio || turma.data_fim) && (() => {
                      const fmt = v => { if (!v) return '?'; const d = new Date(v + 'T12:00:00'); return isNaN(d) ? v : d.toLocaleDateString('pt-PT') }
                      return <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{fmt(turma.data_inicio)} → {fmt(turma.data_fim)}</p>
                    })()}
                    {turma.carga_horaria > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">⏱ {turma.carga_horaria}h</p>}
                    {horarios[turma.id] && horarios[turma.id].length > 0 && (
                      <div className="mb-3 space-y-1">
                        {horarios[turma.id].map(h => <p key={h.id} className="text-xs text-gray-500 dark:text-gray-400">📅 {DIAS_SEMANA[h.dia_semana]} {h.hora_inicio}–{h.hora_fim}{h.sala ? ` · ${h.sala}` : ''}</p>)}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirHorarios(turma)} className="flex-1 btn-secondary text-xs py-1.5" onMouseEnter={() => carregarHorarios(turma.id)}>🕐 Horários</button>
                      <button onClick={() => exportarRelatorio(turma)} className="btn-secondary text-xs py-1.5 px-3" title="Exportar relatório PDF">📄</button>
                      <button onClick={() => abrirEditar(turma)} className="btn-secondary text-xs py-1.5 px-3">✏️</button>
                      <button onClick={() => eliminar(turma.id)} className="btn-danger text-xs py-1.5 px-3">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Turmas individuais (1 UFCD/disciplina) lado a lado */}
          {Object.values(porDisciplina).some(g => g.turmas.length === 1) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(porDisciplina).filter(g => g.turmas.length === 1).flatMap(g => g.turmas).map(turma => (
                <div key={turma.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: turma.cor }}>
                      {turma.designacao.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{turma.disciplina_nome}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {turma.designacao} · {turma.ano_letivo}{turma.semestre ? ` · ${turma.semestre}º Sem` : ''}
                      </p>
                    </div>
                  </div>
                  {(turma.data_inicio || turma.data_fim) && (() => {
                    const fmt = v => { if (!v) return '?'; const d = new Date(v + 'T12:00:00'); return isNaN(d) ? v : d.toLocaleDateString('pt-PT') }
                    return <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{fmt(turma.data_inicio)} → {fmt(turma.data_fim)}</p>
                  })()}
                  {turma.carga_horaria > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">⏱ {turma.carga_horaria}h</p>}
                  {horarios[turma.id] && horarios[turma.id].length > 0 && (
                    <div className="mb-3 space-y-1">
                      {horarios[turma.id].map(h => <p key={h.id} className="text-xs text-gray-500 dark:text-gray-400">📅 {DIAS_SEMANA[h.dia_semana]} {h.hora_inicio}–{h.hora_fim}{h.sala ? ` · ${h.sala}` : ''}</p>)}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => abrirHorarios(turma)} className="flex-1 btn-secondary text-xs py-1.5" onMouseEnter={() => carregarHorarios(turma.id)}>🕐 Horários</button>
                    <button onClick={() => exportarRelatorio(turma)} className="btn-secondary text-xs py-1.5 px-3" title="Exportar relatório PDF">📄</button>
                    <button onClick={() => abrirEditar(turma)} className="btn-secondary text-xs py-1.5 px-3">✏️</button>
                    <button onClick={() => eliminar(turma.id)} className="btn-danger text-xs py-1.5 px-3">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal criar/editar turma */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Turma' : 'Nova Turma'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalAberto(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} className="btn-primary">{editando ? 'Guardar' : 'Criar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-field">Disciplina *</label>
            <select
              value={form.disciplina_id}
              onChange={e => setForm(f => ({ ...f, disciplina_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Seleccionar disciplina...</option>
              {disciplinas.map(d => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Designação *</label>
              <input
                type="text"
                value={form.designacao}
                onChange={e => setForm(f => ({ ...f, designacao: e.target.value }))}
                placeholder="Ex: Turma A"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Ano Lectivo *</label>
              <input
                type="text"
                value={form.ano_letivo}
                onChange={e => setForm(f => ({ ...f, ano_letivo: e.target.value }))}
                placeholder="Ex: 2025/2026"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Semestre</label>
              <select
                value={form.semestre}
                onChange={e => setForm(f => ({ ...f, semestre: e.target.value }))}
                className="input-field"
              >
                <option value={1}>1º Semestre</option>
                <option value={2}>2º Semestre</option>
              </select>
            </div>
            <div>
              <label className="label-field">Carga Horária (h)</label>
              <input
                type="number"
                min="0"
                value={form.carga_horaria || 0}
                onChange={e => setForm(f => ({ ...f, carga_horaria: parseInt(e.target.value) || 0 }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Data início</label>
              <input
                type="date"
                value={form.data_inicio || ''}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Data fim</label>
              <input
                type="date"
                value={form.data_fim || ''}
                onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="label-field">Cor de identificação</label>
            <div className="flex gap-2 flex-wrap items-center">
              {COR_PALETTE.map(cor => (
                <button
                  key={cor}
                  onClick={() => setForm(f => ({ ...f, cor }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    form.cor === cor ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: cor }}
                  title={cor}
                />
              ))}
              <label className="w-8 h-8 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 cursor-pointer flex items-center justify-center overflow-hidden" title="Cor personalizada">
                <input
                  type="color"
                  value={form.cor}
                  onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                  className="w-12 h-12 cursor-pointer border-0 p-0 -m-2"
                />
              </label>
            </div>
          </div>

          {/* Schedules (only when creating) */}
          {!editando && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-field mb-0">Horários</label>
                <button onClick={adicionarHorario} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Adicionar</button>
              </div>
              <div className="space-y-2">
                {novosHorarios.map((h, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={h.dia_semana}
                      onChange={e => atualizarHorario(idx, 'dia_semana', parseInt(e.target.value))}
                      className="input-field flex-1"
                    >
                      {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input
                      type="time"
                      value={h.hora_inicio}
                      onChange={e => atualizarHorario(idx, 'hora_inicio', e.target.value)}
                      className="input-field w-24"
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="time"
                      value={h.hora_fim}
                      onChange={e => atualizarHorario(idx, 'hora_fim', e.target.value)}
                      className="input-field w-24"
                    />
                    <input
                      type="text"
                      value={h.sala || ''}
                      onChange={e => atualizarHorario(idx, 'sala', e.target.value)}
                      placeholder="Sala"
                      className="input-field w-20"
                    />
                    {novosHorarios.length > 1 && (
                      <button onClick={() => removerHorario(idx)} className="text-red-500 hover:text-red-700 px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal horários */}
      <Modal
        isOpen={modalHorarios}
        onClose={() => setModalHorarios(false)}
        title={`Horários — ${turmaSelecionada?.designacao}`}
        size="md"
        footer={
          <>
            <button onClick={() => setModalHorarios(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvarHorarios} className="btn-primary">Guardar</button>
          </>
        }
      >
        <div className="space-y-3">
          {novosHorarios.map((h, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={h.dia_semana}
                onChange={e => atualizarHorario(idx, 'dia_semana', parseInt(e.target.value))}
                className="input-field flex-1"
              >
                {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input
                type="time"
                value={h.hora_inicio}
                onChange={e => atualizarHorario(idx, 'hora_inicio', e.target.value)}
                className="input-field w-24"
              />
              <span className="text-gray-400">–</span>
              <input
                type="time"
                value={h.hora_fim}
                onChange={e => atualizarHorario(idx, 'hora_fim', e.target.value)}
                className="input-field w-24"
              />
              <input
                type="text"
                value={h.sala || ''}
                onChange={e => atualizarHorario(idx, 'sala', e.target.value)}
                placeholder="Sala"
                className="input-field w-20"
              />
              <button onClick={() => removerHorario(idx)} className="text-red-500 hover:text-red-700 px-1">✕</button>
            </div>
          ))}
          <button onClick={adicionarHorario} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            + Adicionar horário
          </button>
        </div>
      </Modal>
      <DialogModal dialog={dialog} onOk={handleOk} onCancel={handleCancel} />
    </div>
  )
}
