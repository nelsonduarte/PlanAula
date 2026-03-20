import React, { useState, useEffect, useCallback } from 'react'
import Modal from '../components/Modal.jsx'
import DialogModal from '../components/DialogModal.jsx'
import { useDatabase } from '../hooks/useDatabase.js'
import { useDialog } from '../hooks/useDialog.js'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const ESTADOS = ['Planeada', 'Realizada', 'Adiada', 'Cancelada']

const estadoColors = {
  'Planeada':  'badge-blue',
  'Realizada': 'badge-green',
  'Adiada':    'badge-yellow',
  'Cancelada': 'badge-red',
}

const emptyForm = {
  turma_id: '', modulo_id: '', data: '', hora_inicio: '09:00', hora_fim: '11:00',
  topico: '', objetivos: '', conteudos: '', atividades: '', recursos: '', avaliacao: '', notas: '',
  estado: 'Planeada', numero: ''
}

export default function Aulas() {
  const db = useDatabase()
  const { confirm, alert, dialog, handleOk, handleCancel } = useDialog()
  const [aulas, setAulas] = useState([])
  const [turmas, setTurmas] = useState([])
  const [disciplinas, setDisciplinas] = useState([])
  const [modulos, setModulos] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [modalGerar, setModalGerar] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filtros, setFiltros] = useState({ turma_id: '', estado: '', data_inicio: '', data_fim: '' })
  const [gerarForm, setGerarForm] = useState({ turma_id: '', data_inicio: '', data_fim: '' })
  const [infoTurma, setInfoTurma] = useState(null) // { carga_horaria, horas_existentes }
  const [resultadoGerar, setResultadoGerar] = useState(null) // { titulo, linhas, tipo }
  const [horariosGerar, setHorariosGerar] = useState([])
  const [activeTab, setActiveTab] = useState('geral')
  const [configPerfil, setConfigPerfil] = useState({})
  const [exportando, setExportando] = useState(null)
  const [diasNaoLetivos, setDiasNaoLetivos] = useState(new Set())

  useEffect(() => { carregarDados() }, [])
  useEffect(() => { if (form.turma_id) carregarModulosDaTurma(form.turma_id) }, [form.turma_id])

  async function carregarDados() {
    const [a, t, d, cfg, feriados] = await Promise.all([
      db.listarAulas(filtros), db.listarTurmas(), db.listarDisciplinas(),
      db.obterConfiguracoes(), db.listarDiasNaoLetivos()
    ])
    setConfigPerfil(cfg || {})
    setAulas(a || [])
    setTurmas(t || [])
    setDisciplinas(d || [])
    setDiasNaoLetivos(new Set((feriados || []).map(f => f.data)))
  }

  async function carregarComFiltros() {
    const a = await db.listarAulas(filtros)
    setAulas(a || [])
  }

  async function carregarModulosDaTurma(turma_id) {
    const turma = turmas.find(t => String(t.id) === String(turma_id))
    if (!turma) return
    const m = await db.listarModulos(turma.disciplina_id)
    setModulos(m || [])
  }

  useEffect(() => {
    if (turmas.length > 0) carregarComFiltros()
  }, [filtros])

  function abrirCriar() {
    setEditando(null)
    setForm({ ...emptyForm, data: new Date().toISOString().split('T')[0] })
    setActiveTab('geral')
    setModalAberto(true)
  }

  function abrirEditar(aula) {
    setEditando(aula)
    setForm({
      turma_id: aula.turma_id,
      modulo_id: aula.modulo_id || '',
      data: aula.data,
      hora_inicio: aula.hora_inicio,
      hora_fim: aula.hora_fim,
      topico: aula.topico || '',
      objetivos: aula.objetivos || '',
      conteudos: aula.conteudos || '',
      atividades: aula.atividades || '',
      recursos: aula.recursos || '',
      avaliacao: aula.avaliacao || '',
      notas: aula.notas || '',
      estado: aula.estado || 'Planeada',
      numero: aula.numero || ''
    })
    setActiveTab('geral')
    setModalAberto(true)
  }

  // Quando a turma muda num novo modal, pré-preenche o próximo número
  useEffect(() => {
    if (!editando && form.turma_id) {
      db.proximoNumeroAula(parseInt(form.turma_id)).then(n => {
        setForm(f => ({ ...f, numero: n }))
      })
    }
  }, [form.turma_id, editando])

  async function salvar() {
    if (!form.turma_id || !form.data) {
      await alert('Seleccione a turma e a data')
      return
    }
    if (diasNaoLetivos.has(form.data)) {
      await alert('Não é possível criar uma aula nesta data — é um dia não letivo ou feriado.', { type: 'warning' })
      return
    }
    const dados = {
      ...form,
      turma_id: parseInt(form.turma_id),
      modulo_id: form.modulo_id ? parseInt(form.modulo_id) : null,
      numero: form.numero !== '' ? parseInt(form.numero) : null
    }
    if (editando) {
      await db.editarAula(editando.id, dados)
    } else {
      await db.criarAula(dados)
    }
    await carregarComFiltros()
    setModalAberto(false)
  }

  async function eliminar(id) {
    if (!await confirm('Eliminar esta aula?', { danger: true })) return
    await db.eliminarAula(id)
    await carregarComFiltros()
  }

  async function eliminarTodasFiltradas() {
    if (aulas.length === 0) return
    const confirmMsg = aulas.length === 1
      ? 'Eliminar 1 aula?'
      : `Eliminar ${aulas.length} aulas? Esta ação não pode ser desfeita.`
    if (!await confirm(confirmMsg, { danger: true })) return
    await Promise.all(aulas.map(a => db.eliminarAula(a.id)))
    await carregarComFiltros()
  }

  async function mudarEstado(aula, estado) {
    await db.editarAula(aula.id, { ...aula, estado })
    await carregarComFiltros()
  }

  async function exportarPlano(aula) {
    setExportando(aula.id)
    await db.exportarAulaPlano(aula, configPerfil)
    setExportando(null)
  }

  async function carregarInfoTurma(turma_id) {
    if (!turma_id) { setInfoTurma(null); setHorariosGerar([]); return }
    const turma = turmas.find(t => String(t.id) === String(turma_id))
    if (!turma) { setInfoTurma(null); return }
    const carga_horaria = turma.carga_horaria || 0
    const disc = disciplinas.find(d => d.id === turma.disciplina_id)
    const aulasExistentes = await db.listarAulas({ turma_id: parseInt(turma_id) })
    const horas_existentes = (aulasExistentes || []).reduce((sum, a) => {
      if (a.estado === 'Cancelada') return sum
      const [hi, mi] = a.hora_inicio.split(':').map(Number)
      const [hf, mf] = a.hora_fim.split(':').map(Number)
      return sum + (hf * 60 + mf - hi * 60 - mi) / 60
    }, 0)
    setInfoTurma({ carga_horaria, horas_existentes, disciplina_nome: disc?.nome })
    const hs = await db.listarHorarios(parseInt(turma_id))
    setHorariosGerar(hs || [])
  }

  async function gerar() {
    if (!gerarForm.turma_id || !gerarForm.data_inicio || !gerarForm.data_fim) {
      await alert('Preencha todos os campos')
      return
    }
    const resultado = await db.gerarAulasAutomatico(
      parseInt(gerarForm.turma_id),
      gerarForm.data_inicio,
      gerarForm.data_fim
    )
    if (!resultado) {
      await alert('Erro ao gerar aulas. Verifique se a turma tem horários definidos.', { type: 'error' })
      return
    }
    const { aulas, horas_geradas, horas_existentes, carga_horaria, limite_atingido } = resultado
    const linhas = []
    let tipo = 'success'
    if (aulas.length === 0) {
      linhas.push('Nenhuma nova aula criada.')
      linhas.push('Todas as aulas para os horários definidos já existem neste período.')
      tipo = 'info'
    } else {
      linhas.push(`${aulas.length} aula(s) gerada(s) — ${horas_geradas.toFixed(1)}h`)
      if (carga_horaria > 0) {
        const totalAgora = horas_existentes + horas_geradas
        const faltam = carga_horaria - totalAgora
        if (limite_atingido) {
          linhas.push(`Carga horária atingida: ${totalAgora.toFixed(1)}h / ${carga_horaria}h`)
          tipo = 'success'
        } else if (faltam > 0.05) {
          linhas.push(`Total planeado: ${totalAgora.toFixed(1)}h / ${carga_horaria}h`)
          linhas.push(`Faltam ${faltam.toFixed(1)}h — amplie o intervalo ou adicione mais slots ao horário.`)
          tipo = 'warning'
        } else {
          linhas.push(`Carga horária cumprida: ${totalAgora.toFixed(1)}h / ${carga_horaria}h`)
        }
      }
    }
    setModalGerar(false)
    setResultadoGerar({ linhas, tipo })
    await carregarComFiltros()
  }

  const tabs = [
    { id: 'geral', label: 'Geral' },
    { id: 'conteudos', label: 'Conteúdos' },
    { id: 'atividades', label: 'Atividades' },
    { id: 'avaliacao', label: 'Avaliação' },
  ]

  const aulasPorData = aulas.reduce((acc, a) => {
    const key = a.data
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const datasOrdenadas = Object.keys(aulasPorData).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Aulas</h1>
        <div className="flex gap-2">
          <button onClick={() => setModalGerar(true)} className="btn-secondary">⚡ Gerar Automaticamente</button>
          <button onClick={abrirCriar} className="btn-primary">+ Nova Aula</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label-field">Turma</label>
            <select
              value={filtros.turma_id}
              onChange={e => setFiltros(f => ({ ...f, turma_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Todas</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.disciplina_nome} – {t.designacao}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Estado</label>
            <select
              value={filtros.estado}
              onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}
              className="input-field"
            >
              <option value="">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Data início</label>
            <input
              type="date"
              value={filtros.data_inicio}
              onChange={e => setFiltros(f => ({ ...f, data_inicio: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Data fim</label>
            <input
              type="date"
              value={filtros.data_fim}
              onChange={e => setFiltros(f => ({ ...f, data_fim: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setFiltros({ turma_id: '', estado: '', data_inicio: '', data_fim: '' })}
            className="btn-secondary text-xs"
          >
            Limpar filtros
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
            {aulas.length} aula(s) encontrada(s)
          </span>
          {aulas.length > 0 && (
            <button
              onClick={eliminarTodasFiltradas}
              className="btn-danger text-xs ml-auto"
            >
              Eliminar {aulas.length} aula(s)
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {datasOrdenadas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Sem aulas</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Crie aulas manualmente ou use a geração automática</p>
        </div>
      ) : (
        <div className="space-y-4">
          {datasOrdenadas.map(data => (
            <div key={data}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {new Date(data + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <div className="space-y-2">
                {aulasPorData[data].map(aula => (
                  <div key={aula.id} className="card hover:shadow-md transition-shadow flex items-center gap-4">
                    <div
                      className="w-1.5 h-14 rounded-full flex-shrink-0"
                      style={{ backgroundColor: aula.turma_cor || '#2E86C1' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {aula.disciplina_nome}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs">·</span>
                        <span className="text-gray-600 dark:text-gray-400 text-xs">{aula.turma_nome}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {aula.numero != null && <span className="mr-2 font-semibold text-gray-400 dark:text-gray-500">Aula {aula.numero}</span>}
                        {aula.hora_inicio} – {aula.hora_fim}
                        {aula.sala && <span className="ml-2">· 📍 {aula.sala}</span>}
                        {aula.topico && <span className="ml-2">· {aula.topico}</span>}
                      </p>
                      {aula.modulo_nome && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{aula.modulo_nome}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => {
                        const override = aula.estado === 'Adiada' || aula.estado === 'Cancelada'
                        const hoje = new Date(); hoje.setHours(0,0,0,0)
                        const passou = new Date(aula.data + 'T00:00:00') <= hoje
                        const estadoVis = override ? aula.estado : passou ? 'Realizada' : 'Planeada'
                        const cls = estadoVis === 'Realizada' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                                    estadoVis === 'Adiada'    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                    estadoVis === 'Cancelada' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                                                                'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        return <span className={`text-xs font-medium px-2 py-1 rounded-full ${cls}`}>{estadoVis}</span>
                      })()}
                      <button
                        onClick={() => exportarPlano(aula)}
                        disabled={exportando === aula.id}
                        title="Exportar plano como PDF"
                        className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {exportando === aula.id
                          ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        }
                      </button>
                      <button
                        onClick={() => abrirEditar(aula)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => eliminar(aula.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar aula */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Plano de Aula' : 'Nova Aula'}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalAberto(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} className="btn-primary">{editando ? 'Guardar' : 'Criar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label-field">Turma *</label>
              <select
                value={form.turma_id}
                onChange={e => setForm(f => ({ ...f, turma_id: e.target.value, modulo_id: '' }))}
                className="input-field"
              >
                <option value="">Seleccionar turma...</option>
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>{t.disciplina_nome} – {t.designacao}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-field">Módulo</label>
              <select
                value={form.modulo_id}
                onChange={e => setForm(f => ({ ...f, modulo_id: e.target.value }))}
                className="input-field"
                disabled={!form.turma_id}
              >
                <option value="">Sem módulo</option>
                {modulos.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Data *</label>
              <input
                type="date"
                value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Hora início</label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Hora fim</label>
              <input
                type="time"
                value={form.hora_fim}
                onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Nº Aula</label>
              <input
                type="number"
                min="1"
                value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                className="input-field"
                placeholder="Auto"
              />
            </div>
            <div>
              <label className="label-field">Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className="input-field"
              >
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label-field">Tópico</label>
            <input
              type="text"
              value={form.topico}
              onChange={e => setForm(f => ({ ...f, topico: e.target.value }))}
              placeholder="Tópico da aula"
              className="input-field"
            />
          </div>

          {/* Tabs */}
          <div>
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'geral' && (
              <div className="space-y-3">
                <div>
                  <label className="label-field">Objetivos</label>
                  <textarea
                    rows={3}
                    value={form.objetivos}
                    onChange={e => setForm(f => ({ ...f, objetivos: e.target.value }))}
                    placeholder="Objetivos de aprendizagem..."
                    className="input-field resize-none"
                  />
                </div>
                <div>
                  <label className="label-field">Notas</label>
                  <textarea
                    rows={2}
                    value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    placeholder="Notas adicionais..."
                    className="input-field resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'conteudos' && (
              <div>
                <label className="label-field">Conteúdos</label>
                <textarea
                  rows={8}
                  value={form.conteudos}
                  onChange={e => setForm(f => ({ ...f, conteudos: e.target.value }))}
                  placeholder="Conteúdos a abordar nesta aula..."
                  className="input-field resize-none"
                />
              </div>
            )}

            {activeTab === 'atividades' && (
              <div className="space-y-3">
                <div>
                  <label className="label-field">Atividades</label>
                  <textarea
                    rows={5}
                    value={form.atividades}
                    onChange={e => setForm(f => ({ ...f, atividades: e.target.value }))}
                    placeholder="Actividades planeadas..."
                    className="input-field resize-none"
                  />
                </div>
                <div>
                  <label className="label-field">Recursos</label>
                  <textarea
                    rows={3}
                    value={form.recursos}
                    onChange={e => setForm(f => ({ ...f, recursos: e.target.value }))}
                    placeholder="Materiais e recursos necessários..."
                    className="input-field resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'avaliacao' && (
              <div>
                <label className="label-field">Avaliação</label>
                <textarea
                  rows={6}
                  value={form.avaliacao}
                  onChange={e => setForm(f => ({ ...f, avaliacao: e.target.value }))}
                  placeholder="Instrumentos e critérios de avaliação..."
                  className="input-field resize-none"
                />
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal geração automática */}
      <Modal
        isOpen={modalGerar}
        onClose={() => { setModalGerar(false); setInfoTurma(null); setHorariosGerar([]) }}
        title="Gerar Aulas Automaticamente"
        size="md"
        footer={
          <>
            <button onClick={() => { setModalGerar(false); setInfoTurma(null); setHorariosGerar([]) }} className="btn-secondary">Cancelar</button>
            <button onClick={gerar} className="btn-primary">Gerar</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gera automaticamente aulas com base nos horários definidos para a turma seleccionada.
          </p>
          <div>
            <label className="label-field">Turma *</label>
            <select
              value={gerarForm.turma_id}
              onChange={e => {
                const turma = turmas.find(t => String(t.id) === e.target.value)
                setGerarForm(f => ({
                  ...f,
                  turma_id: e.target.value,
                  data_inicio: turma?.data_inicio || f.data_inicio,
                  data_fim: turma?.data_fim || f.data_fim,
                }))
                carregarInfoTurma(e.target.value)
              }}
              className="input-field"
            >
              <option value="">Seleccionar turma...</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.disciplina_nome} – {t.designacao}</option>
              ))}
            </select>
          </div>
          {infoTurma && infoTurma.carga_horaria > 0 && (
            <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${
              infoTurma.horas_existentes >= infoTurma.carga_horaria
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : infoTurma.horas_existentes / infoTurma.carga_horaria >= 0.8
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            }`}>
              <div>
                <p className="font-medium">Carga horária: {infoTurma.carga_horaria}h</p>
                <p>Já planeadas: {infoTurma.horas_existentes.toFixed(1)}h · Disponíveis: {Math.max(0, infoTurma.carga_horaria - infoTurma.horas_existentes).toFixed(1)}h</p>
              </div>
              <span className="text-lg font-bold">
                {Math.round(infoTurma.horas_existentes / infoTurma.carga_horaria * 100)}%
              </span>
            </div>
          )}
          {infoTurma && infoTurma.carga_horaria === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Sem carga horária definida — será gerado sem limite de horas.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Data início *</label>
              <input
                type="date"
                value={gerarForm.data_inicio}
                onChange={e => setGerarForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Data fim *</label>
              <input
                type="date"
                value={gerarForm.data_fim}
                onChange={e => setGerarForm(f => ({ ...f, data_fim: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>
          {horariosGerar.length > 0 ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Horários desta turma:</p>
              <ul className="space-y-0.5">
                {horariosGerar.map(h => (
                  <li key={h.id}>
                    {DIAS_SEMANA[parseInt(h.dia_semana)]} — {h.hora_inicio}–{h.hora_fim}{h.sala ? ` (${h.sala})` : ''}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs opacity-75">Aulas já existentes não serão duplicadas.</p>
            </div>
          ) : gerarForm.turma_id ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ Esta turma não tem horários definidos. Configure os horários na página de Turmas.
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
              ℹ️ Apenas serão criadas aulas em datas com horário definido. Aulas já existentes não serão duplicadas.
            </div>
          )}
        </div>
      </Modal>

      {/* Modal resultado da geração */}
      <Modal
        isOpen={!!resultadoGerar}
        onClose={() => setResultadoGerar(null)}
        title="Geração Concluída"
        size="sm"
        footer={
          <button onClick={() => setResultadoGerar(null)} className="btn-primary w-full">OK</button>
        }
      >
        {resultadoGerar && (
          <div className={`rounded-xl p-4 flex gap-3 ${
            resultadoGerar.tipo === 'warning'
              ? 'bg-yellow-50 dark:bg-yellow-900/20'
              : resultadoGerar.tipo === 'info'
              ? 'bg-blue-50 dark:bg-blue-900/20'
              : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <span className="text-xl flex-shrink-0 mt-0.5">
              {resultadoGerar.tipo === 'warning' ? '⚠️' : resultadoGerar.tipo === 'info' ? 'ℹ️' : '✅'}
            </span>
            <div className="space-y-1">
              {resultadoGerar.linhas.map((l, i) => (
                <p key={i} className={`text-sm ${
                  i === 0
                    ? 'font-semibold text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>{l}</p>
              ))}
            </div>
          </div>
        )}
      </Modal>
      <DialogModal dialog={dialog} onOk={handleOk} onCancel={handleCancel} />
    </div>
  )
}
