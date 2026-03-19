import React, { useState, useEffect } from 'react'
import Modal from '../components/Modal.jsx'
import DialogModal from '../components/DialogModal.jsx'
import { useDatabase } from '../hooks/useDatabase.js'
import { useDialog } from '../hooks/useDialog.js'

const TIPOS = ['teórica', 'prática', 'mista', 'laboratorial', 'seminarial']

const emptyForm = {
  nome: '', codigo: '', area_cientifica: '', carga_horaria: 0,
  ects: '', tipo: 'mista', descricao: '', curso_id: null
}

const emptyModulo = { nome: '', ordem: 0, horas: '', objetivos: '' }

export default function Disciplinas() {
  const db = useDatabase()
  const { confirm, alert, dialog, handleOk, handleCancel } = useDialog()
  const [disciplinas, setDisciplinas] = useState([])
  const [cursos, setCursos] = useState([])
  const [modulos, setModulos] = useState({})
  const [modalAberto, setModalAberto] = useState(false)
  const [modalModulos, setModalModulos] = useState(false)
  const [editando, setEditando] = useState(null)
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formModulo, setFormModulo] = useState(emptyModulo)
  const [editandoModulo, setEditandoModulo] = useState(null)
  const [busca, setBusca] = useState('')
  const [aulas, setAulas] = useState([])

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const [d, a, c] = await Promise.all([db.listarDisciplinas(), db.listarAulas(), db.listarCursos()])
    setDisciplinas(d || [])
    setAulas(a || [])
    setCursos(c || [])
  }

  async function carregarModulos(disciplina_id) {
    const m = await db.listarModulos(disciplina_id)
    setModulos(prev => ({ ...prev, [disciplina_id]: m || [] }))
    return m || []
  }

  function abrirCriar() {
    setEditando(null)
    setForm(emptyForm)
    setModalAberto(true)
  }

  function abrirEditar(disc) {
    setEditando(disc)
    setForm({ ...disc })
    setModalAberto(true)
  }

  async function abrirModulos(disc) {
    setDisciplinaSelecionada(disc)
    await carregarModulos(disc.id)
    setFormModulo({ ...emptyModulo, disciplina_id: disc.id })
    setModalModulos(true)
  }

  async function salvar() {
    const dados = {
      ...form,
      carga_horaria: parseInt(form.carga_horaria) || 0,
      ects: form.ects !== '' ? parseFloat(form.ects) : null,
      curso_id: form.curso_id || null
    }
    if (editando) {
      await db.editarDisciplina(editando.id, dados)
    } else {
      await db.criarDisciplina(dados)
    }
    await carregarDados()
    setModalAberto(false)
  }

  async function eliminar(id) {
    if (!await confirm('Eliminar esta disciplina? Todos os dados associados serão eliminados.', { danger: true })) return
    await db.eliminarDisciplina(id)
    await carregarDados()
  }

  async function eliminarTodasAulasDisciplina(disc) {
    const aulasDisc = aulas.filter(a => a.disciplina_id === disc.id)
    if (aulasDisc.length === 0) {
      await alert(`A disciplina "${disc.nome}" não tem aulas registadas.`)
      return
    }
    if (!await confirm(`Eliminar todas as ${aulasDisc.length} aula(s) da disciplina "${disc.nome}"? Esta ação não pode ser revertida.`, { danger: true })) return
    await db.eliminarAulasDaDisciplina(disc.id)
    await carregarDados()
  }

  async function salvarModulo() {
    const dados = {
      ...formModulo,
      disciplina_id: disciplinaSelecionada.id,
      ordem: parseInt(formModulo.ordem) || 0,
      horas: formModulo.horas !== '' ? parseFloat(formModulo.horas) : null
    }
    if (editandoModulo) {
      await db.editarModulo(editandoModulo.id, dados)
    } else {
      await db.criarModulo(dados)
    }
    setFormModulo({ ...emptyModulo, disciplina_id: disciplinaSelecionada.id })
    setEditandoModulo(null)
    await carregarModulos(disciplinaSelecionada.id)
  }

  async function eliminarModulo(id) {
    if (!await confirm('Eliminar este módulo?', { danger: true })) return
    await db.eliminarModulo(id)
    await carregarModulos(disciplinaSelecionada.id)
  }

  const filtradas = disciplinas.filter(d =>
    d.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (d.codigo || '').toLowerCase().includes(busca.toLowerCase()) ||
    (d.area_cientifica || '').toLowerCase().includes(busca.toLowerCase())
  )

  function calcularProgresso(disc) {
    const aulasDisc = aulas.filter(a => a.disciplina_id === disc.id && a.estado === 'Realizada')
    const horas = aulasDisc.reduce((sum, a) => {
      const [hi, mi] = (a.hora_inicio || '00:00').split(':').map(Number)
      const [hf, mf] = (a.hora_fim || '00:00').split(':').map(Number)
      return sum + (hf * 60 + mf - hi * 60 - mi) / 60
    }, 0)
    if (!disc.carga_horaria) return 0
    return Math.min(100, (horas / disc.carga_horaria) * 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Disciplinas</h1>
        <button onClick={abrirCriar} className="btn-primary">+ Nova Disciplina</button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Pesquisar disciplinas..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {/* List */}
      {filtradas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Sem disciplinas</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Clique em "Nova Disciplina" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtradas.map(disc => {
            const progresso = calcularProgresso(disc)
            return (
              <div key={disc.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{disc.nome}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {disc.codigo && <span className="font-mono">{disc.codigo} · </span>}
                      {disc.area_cientifica || 'Sem área'}
                    </p>
                  </div>
                  <span className={`badge ${disc.tipo === 'teórica' ? 'badge-blue' : disc.tipo === 'prática' ? 'badge-green' : 'badge-yellow'} ml-2 flex-shrink-0`}>
                    {disc.tipo}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>⏱️ {disc.carga_horaria}h</span>
                  {disc.ects && <span>📖 {disc.ects} ECTS</span>}
                </div>
                {disc.curso_nome && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 truncate">
                    🎓 {disc.curso_nome}{disc.instituicao_nome ? ` · ${disc.instituicao_nome}` : ''}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Programa concluído</span>
                    <span>{progresso.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirModulos(disc)}
                    className="flex-1 btn-secondary text-xs py-1.5"
                  >
                    📋 Módulos
                  </button>
                  <button
                    onClick={() => abrirEditar(disc)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => eliminarTodasAulasDisciplina(disc)}
                    className="btn-secondary text-xs py-1.5 px-3"
                    title="Eliminar todas as aulas desta disciplina"
                  >
                    🗑️ Aulas
                  </button>
                  <button
                    onClick={() => eliminar(disc.id)}
                    className="btn-danger text-xs py-1.5 px-3"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar/editar disciplina */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Disciplina' : 'Nova Disciplina'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalAberto(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} className="btn-primary">
              {editando ? 'Guardar' : 'Criar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-field">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Matemática Aplicada"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Código</label>
              <input
                type="text"
                value={form.codigo || ''}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                placeholder="Ex: MAT101"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Área Científica</label>
              <input
                type="text"
                value={form.area_cientifica || ''}
                onChange={e => setForm(f => ({ ...f, area_cientifica: e.target.value }))}
                placeholder="Ex: Ciências Exatas"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Carga Horária (h) *</label>
              <input
                type="number"
                min="0"
                value={form.carga_horaria}
                onChange={e => setForm(f => ({ ...f, carga_horaria: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">ECTS</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.ects || ''}
                onChange={e => setForm(f => ({ ...f, ects: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="input-field"
              >
                {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-field">Curso</label>
              <select
                value={form.curso_id || ''}
                onChange={e => setForm(f => ({ ...f, curso_id: e.target.value ? Number(e.target.value) : null }))}
                className="input-field"
              >
                <option value="">— Sem curso associado —</option>
                {cursos.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.instituicao_nome ? ` (${c.instituicao_nome})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-field">Descrição</label>
              <textarea
                value={form.descricao || ''}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={3}
                placeholder="Descrição da disciplina..."
                className="input-field resize-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal módulos */}
      <Modal
        isOpen={modalModulos}
        onClose={() => { setModalModulos(false); setEditandoModulo(null) }}
        title={`Módulos — ${disciplinaSelecionada?.nome}`}
        size="lg"
      >
        {disciplinaSelecionada && (
          <div className="space-y-4">
            {/* Form módulo */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {editandoModulo ? 'Editar Módulo' : 'Novo Módulo'}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="label-field">Nome *</label>
                  <input
                    type="text"
                    value={formModulo.nome}
                    onChange={e => setFormModulo(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Nome do módulo"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Ordem</label>
                  <input
                    type="number"
                    min="0"
                    value={formModulo.ordem}
                    onChange={e => setFormModulo(f => ({ ...f, ordem: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Horas</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formModulo.horas || ''}
                    onChange={e => setFormModulo(f => ({ ...f, horas: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label-field">Objetivos</label>
                  <input
                    type="text"
                    value={formModulo.objetivos || ''}
                    onChange={e => setFormModulo(f => ({ ...f, objetivos: e.target.value }))}
                    placeholder="Objetivos do módulo"
                    className="input-field"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={salvarModulo} className="btn-primary text-sm">
                  {editandoModulo ? 'Guardar' : 'Adicionar'}
                </button>
                {editandoModulo && (
                  <button
                    onClick={() => { setEditandoModulo(null); setFormModulo({ ...emptyModulo, disciplina_id: disciplinaSelecionada.id }) }}
                    className="btn-secondary text-sm"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Modules list */}
            <div className="space-y-2">
              {(modulos[disciplinaSelecionada?.id] || []).length === 0 ? (
                <p className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">Sem módulos definidos</p>
              ) : (
                (modulos[disciplinaSelecionada?.id] || []).map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {m.ordem}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.nome}</p>
                      {m.objetivos && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.objetivos}</p>}
                    </div>
                    {m.horas && <span className="text-xs text-gray-500 dark:text-gray-400">{m.horas}h</span>}
                    <button
                      onClick={() => { setEditandoModulo(m); setFormModulo({ ...m }) }}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >✏️</button>
                    <button
                      onClick={() => eliminarModulo(m.id)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >🗑️</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
      <DialogModal dialog={dialog} onOk={handleOk} onCancel={handleCancel} />
    </div>
  )
}
