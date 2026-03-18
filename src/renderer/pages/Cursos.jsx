import React, { useState, useEffect } from 'react'
import Modal from '../components/Modal.jsx'
import { useDatabase } from '../hooks/useDatabase.js'

const TIPOS_INSTITUICAO = ['universitária', 'politécnica', 'profissional', 'empresa', 'outra']
const TIPOS_CURSO = ['semestral', 'anual', 'formação', 'livre']

const TIPO_CURSO_BADGE = {
  semestral: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  anual: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  formação: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  livre: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

const emptyInstForm = { nome: '', tipo: 'universitária', contacto: '', notas: '' }
const emptyCursoForm = { nome: '', tipo: 'semestral', ano_letivo: '', valor_hora: '', descricao: '', ativo: 1, instituicao_id: null }

export default function Cursos() {
  const db = useDatabase()
  const [instituicoes, setInstituicoes] = useState([])
  const [cursos, setCursos] = useState([])
  const [instSelecionada, setInstSelecionada] = useState(null)

  const [modalInst, setModalInst] = useState(false)
  const [modalCurso, setModalCurso] = useState(false)
  const [editandoInst, setEditandoInst] = useState(null)
  const [editandoCurso, setEditandoCurso] = useState(null)
  const [formInst, setFormInst] = useState(emptyInstForm)
  const [formCurso, setFormCurso] = useState(emptyCursoForm)

  useEffect(() => { carregarTudo() }, [])

  async function carregarTudo() {
    const [inst, c] = await Promise.all([db.listarInstituicoes(), db.listarCursos()])
    setInstituicoes(inst || [])
    setCursos(c || [])
  }

  // ── Instituições ──────────────────────────────────────────────────────────
  function abrirCriarInst() {
    setEditandoInst(null)
    setFormInst(emptyInstForm)
    setModalInst(true)
  }

  function abrirEditarInst(inst) {
    setEditandoInst(inst)
    setFormInst({ ...inst })
    setModalInst(true)
  }

  async function salvarInst() {
    if (!formInst.nome.trim()) return
    if (editandoInst) {
      await db.editarInstituicao(editandoInst.id, formInst)
    } else {
      await db.criarInstituicao(formInst)
    }
    await carregarTudo()
    setModalInst(false)
  }

  async function eliminarInst(inst) {
    const cursosInst = cursos.filter(c => c.instituicao_id === inst.id)
    const aviso = cursosInst.length
      ? `Esta instituição tem ${cursosInst.length} curso(s) associado(s) que ficarão sem instituição. Continuar?`
      : `Eliminar "${inst.nome}"?`
    if (!confirm(aviso)) return
    await db.eliminarInstituicao(inst.id)
    if (instSelecionada?.id === inst.id) setInstSelecionada(null)
    await carregarTudo()
  }

  // ── Cursos ────────────────────────────────────────────────────────────────
  function abrirCriarCurso(inst) {
    setEditandoCurso(null)
    setFormCurso({ ...emptyCursoForm, instituicao_id: inst?.id || null })
    setModalCurso(true)
  }

  function abrirEditarCurso(curso) {
    setEditandoCurso(curso)
    setFormCurso({
      nome: curso.nome || '',
      tipo: curso.tipo || 'semestral',
      ano_letivo: curso.ano_letivo || '',
      valor_hora: curso.valor_hora != null ? String(curso.valor_hora) : '',
      descricao: curso.descricao || '',
      ativo: curso.ativo ?? 1,
      instituicao_id: curso.instituicao_id || null,
    })
    setModalCurso(true)
  }

  async function salvarCurso() {
    if (!formCurso.nome.trim()) return
    const dados = {
      ...formCurso,
      valor_hora: formCurso.valor_hora !== '' ? parseFloat(formCurso.valor_hora) : null,
      instituicao_id: formCurso.instituicao_id || null,
    }
    if (editandoCurso) {
      await db.editarCurso(editandoCurso.id, dados)
    } else {
      await db.criarCurso(dados)
    }
    await carregarTudo()
    setModalCurso(false)
  }

  async function eliminarCurso(curso) {
    if (!confirm(`Eliminar o curso "${curso.nome}"? As disciplinas associadas perderão a ligação.`)) return
    await db.eliminarCurso(curso.id)
    await carregarTudo()
  }

  // ── Renderização ──────────────────────────────────────────────────────────
  const cursosVisiveis = instSelecionada
    ? cursos.filter(c => c.instituicao_id === instSelecionada.id)
    : cursos

  const cursosSemInstituicao = cursos.filter(c => !c.instituicao_id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Cursos & Instituições</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {instituicoes.length} instituição(ões) · {cursos.length} curso(s)
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={abrirCriarInst} className="btn-secondary text-sm">
            + Instituição
          </button>
          <button onClick={() => abrirCriarCurso(instSelecionada)} className="btn-primary text-sm">
            + Novo Curso
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Painel esquerdo: Instituições */}
        <div className="xl:col-span-1 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-3">
            Instituições
          </h2>

          {/* Opção "Todos" */}
          <button
            onClick={() => setInstSelecionada(null)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
              !instSelecionada
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-sm font-medium">Todos os cursos</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${!instSelecionada ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}`}>
              {cursos.length}
            </span>
          </button>

          {instituicoes.map(inst => {
            const n = cursos.filter(c => c.instituicao_id === inst.id).length
            const ativa = instSelecionada?.id === inst.id
            return (
              <div key={inst.id} className="group relative">
                <button
                  onClick={() => setInstSelecionada(ativa ? null : inst)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                    ativa
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inst.nome}</p>
                    <p className={`text-xs truncate ${ativa ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                      {inst.tipo}
                    </p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${ativa ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}`}>
                    {n}
                  </span>
                </button>
                <div className={`absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5 ${ativa ? '' : 'bg-gray-100 dark:bg-gray-700 rounded-md p-0.5'}`}>
                  <button
                    onClick={e => { e.stopPropagation(); abrirEditarInst(inst) }}
                    className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs"
                    title="Editar"
                  >✏️</button>
                  <button
                    onClick={e => { e.stopPropagation(); eliminarInst(inst) }}
                    className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400 text-xs"
                    title="Eliminar"
                  >🗑️</button>
                </div>
              </div>
            )
          })}

          {instituicoes.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 px-2">
              Sem instituições.<br />Clique em "+ Instituição" para criar.
            </p>
          )}
        </div>

        {/* Painel direito: Cursos */}
        <div className="xl:col-span-3 space-y-4">
          {/* Cursos com instituição (agrupados se "todos") */}
          {!instSelecionada ? (
            <>
              {instituicoes.map(inst => {
                const cursosInst = cursos.filter(c => c.instituicao_id === inst.id)
                if (!cursosInst.length) return null
                return (
                  <div key={inst.id}>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <span>🏫</span> {inst.nome}
                      <span className="text-xs text-gray-400 font-normal">({inst.tipo})</span>
                    </h3>
                    <CursosGrid
                      cursos={cursosInst}
                      onEditar={abrirEditarCurso}
                      onEliminar={eliminarCurso}
                    />
                  </div>
                )
              })}
              {cursosSemInstituicao.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <span>📋</span> Sem instituição
                  </h3>
                  <CursosGrid
                    cursos={cursosSemInstituicao}
                    onEditar={abrirEditarCurso}
                    onEliminar={eliminarCurso}
                  />
                </div>
              )}
              {cursos.length === 0 && (
                <EmptyState onCriar={() => abrirCriarCurso(null)} />
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  🏫 {instSelecionada.nome}
                </h2>
                <button
                  onClick={() => abrirCriarCurso(instSelecionada)}
                  className="btn-primary text-sm"
                >
                  + Curso nesta Instituição
                </button>
              </div>
              {cursosVisiveis.length === 0 ? (
                <EmptyState onCriar={() => abrirCriarCurso(instSelecionada)} />
              ) : (
                <CursosGrid
                  cursos={cursosVisiveis}
                  onEditar={abrirEditarCurso}
                  onEliminar={eliminarCurso}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Instituição */}
      <Modal
        isOpen={modalInst}
        onClose={() => setModalInst(false)}
        title={editandoInst ? 'Editar Instituição' : 'Nova Instituição'}
        size="md"
        footer={
          <>
            <button onClick={() => setModalInst(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvarInst} className="btn-primary">{editandoInst ? 'Guardar' : 'Criar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-field">Nome *</label>
            <input
              type="text"
              value={formInst.nome}
              onChange={e => setFormInst(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Instituto Politécnico do Porto"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Tipo</label>
            <select
              value={formInst.tipo}
              onChange={e => setFormInst(f => ({ ...f, tipo: e.target.value }))}
              className="input-field"
            >
              {TIPOS_INSTITUICAO.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Contacto / Website</label>
            <input
              type="text"
              value={formInst.contacto || ''}
              onChange={e => setFormInst(f => ({ ...f, contacto: e.target.value }))}
              placeholder="email, telefone ou website"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Notas</label>
            <textarea
              value={formInst.notas || ''}
              onChange={e => setFormInst(f => ({ ...f, notas: e.target.value }))}
              rows={2}
              className="input-field resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Curso */}
      <Modal
        isOpen={modalCurso}
        onClose={() => setModalCurso(false)}
        title={editandoCurso ? 'Editar Curso' : 'Novo Curso'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalCurso(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvarCurso} className="btn-primary">{editandoCurso ? 'Guardar' : 'Criar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-field">Nome do Curso *</label>
            <input
              type="text"
              value={formCurso.nome}
              onChange={e => setFormCurso(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Licenciatura em Engenharia Informática"
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Tipo</label>
              <select
                value={formCurso.tipo}
                onChange={e => setFormCurso(f => ({ ...f, tipo: e.target.value }))}
                className="input-field"
              >
                {TIPOS_CURSO.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Ano Letivo / Período</label>
              <input
                type="text"
                value={formCurso.ano_letivo || ''}
                onChange={e => setFormCurso(f => ({ ...f, ano_letivo: e.target.value }))}
                placeholder="Ex: 2025/2026 ou Jan 2026"
                className="input-field"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Instituição</label>
              <select
                value={formCurso.instituicao_id || ''}
                onChange={e => setFormCurso(f => ({ ...f, instituicao_id: e.target.value ? Number(e.target.value) : null }))}
                className="input-field"
              >
                <option value="">— Sem instituição —</option>
                {instituicoes.map(i => (
                  <option key={i.id} value={i.id}>{i.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Valor/Hora (€) padrão</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formCurso.valor_hora}
                onChange={e => setFormCurso(f => ({ ...f, valor_hora: e.target.value }))}
                placeholder="Ex: 35.00"
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="label-field">Descrição</label>
            <textarea
              value={formCurso.descricao || ''}
              onChange={e => setFormCurso(f => ({ ...f, descricao: e.target.value }))}
              rows={2}
              placeholder="Descrição ou observações sobre o curso..."
              className="input-field resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={!!formCurso.ativo}
              onChange={e => setFormCurso(f => ({ ...f, ativo: e.target.checked ? 1 : 0 }))}
              className="rounded"
            />
            <label htmlFor="ativo" className="text-sm text-gray-700 dark:text-gray-300">Curso ativo</label>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CursosGrid({ cursos, onEditar, onEliminar }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {cursos.map(curso => (
        <CursoCard key={curso.id} curso={curso} onEditar={onEditar} onEliminar={onEliminar} />
      ))}
    </div>
  )
}

function CursoCard({ curso, onEditar, onEliminar }) {
  const badgeClass = TIPO_CURSO_BADGE[curso.tipo] || TIPO_CURSO_BADGE.livre

  return (
    <div className={`card hover:shadow-md transition-shadow ${!curso.ativo ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
            {curso.nome}
            {!curso.ativo && <span className="ml-1 text-xs text-gray-400">(inativo)</span>}
          </h3>
          {curso.instituicao_nome && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              🏫 {curso.instituicao_nome}
            </p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badgeClass}`}>
          {curso.tipo}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-3">
        {curso.ano_letivo && <span>📅 {curso.ano_letivo}</span>}
        {curso.valor_hora != null ? (
          <span className="font-semibold text-green-600 dark:text-green-400">
            💶 {Number(curso.valor_hora).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}/h
          </span>
        ) : (
          <span className="text-gray-400 italic">sem valor/hora</span>
        )}
      </div>

      {curso.descricao && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{curso.descricao}</p>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => onEditar(curso)}
          className="flex-1 btn-secondary text-xs py-1.5"
        >
          ✏️ Editar
        </button>
        <button
          onClick={() => onEliminar(curso)}
          className="btn-danger text-xs py-1.5 px-3"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

function EmptyState({ onCriar }) {
  return (
    <div className="card text-center py-12">
      <p className="text-4xl mb-3">🎓</p>
      <p className="text-gray-500 dark:text-gray-400 font-medium">Sem cursos</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">
        Cria um curso para agrupar disciplinas e definir o valor/hora padrão
      </p>
      <button onClick={onCriar} className="btn-primary text-sm">
        + Novo Curso
      </button>
    </div>
  )
}
