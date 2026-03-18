import React, { useState, useEffect } from 'react'
import { useDatabase } from '../hooks/useDatabase.js'

const TIPOS_DIA = ['feriado', 'interrupção letiva', 'outro']

function DiasNaoLetivos({ db }) {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [dias, setDias] = useState([])
  const [form, setForm] = useState({ data: '', descricao: '', tipo: 'feriado' })
  const [importMsg, setImportMsg] = useState('')

  useEffect(() => { carregar() }, [ano])

  async function carregar() {
    const d = await db.listarDiasNaoLetivos(ano)
    setDias(d || [])
  }

  async function adicionar() {
    if (!form.data || !form.descricao) return
    await db.criarDiaNaoLetivo(form)
    setForm({ data: '', descricao: '', tipo: 'feriado' })
    await carregar()
  }

  async function eliminar(id) {
    await db.eliminarDiaNaoLetivo(id)
    await carregar()
  }

  async function importarFeriados() {
    setImportMsg('')
    const criados = await db.importarFeriadosNacionais(ano)
    await carregar()
    setImportMsg(`✓ ${(criados || []).length} feriados importados para ${ano}`)
    setTimeout(() => setImportMsg(''), 3000)
  }

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => anoAtual - 1 + i)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="section-title">Dias Não Lectivos</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Feriados e interrupções excluídos da geração automática de aulas.</p>
        </div>
        <select
          value={ano}
          onChange={e => setAno(parseInt(e.target.value))}
          className="input-field w-auto"
        >
          {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Importar feriados */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={importarFeriados} className="btn-secondary text-sm">
          🇵🇹 Importar Feriados Nacionais {ano}
        </button>
        {importMsg && <span className="text-sm text-green-600 dark:text-green-400">{importMsg}</span>}
      </div>

      {/* Adicionar dia */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <input
          type="date"
          value={form.data}
          onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
          className="input-field sm:col-span-1"
        />
        <input
          type="text"
          value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          placeholder="Descrição (ex: Carnaval)"
          className="input-field sm:col-span-2"
        />
        <div className="flex gap-2">
          <select
            value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
            className="input-field flex-1"
          >
            {TIPOS_DIA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={adicionar} className="btn-primary px-3" title="Adicionar">+</button>
        </div>
      </div>

      {/* Lista */}
      {dias.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Sem dias não lectivos para {ano}</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {dias.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 flex-shrink-0">
                {new Date(d.data + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{d.descricao}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                d.tipo === 'feriado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
              }`}>{d.tipo}</span>
              <button onClick={() => eliminar(d.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors ml-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Definicoes() {
  const db = useDatabase()
  const anoAtual = new Date().getFullYear()

  const [config, setConfig] = useState({
    tema: 'light',
    nome_professor: '',
    instituicao: '',
    departamento: '',
    ano_letivo_atual: `${anoAtual}/${anoAtual + 1}`
  })

  const [configFiscal, setConfigFiscal] = useState({
    taxa_iva: '0',
    isento_iva: false,
    taxa_retencao_irs: '25',
    sem_retencao: false,
    notas: ''
  })

  const [saved, setSaved] = useState(false)
  const [savedFiscal, setSavedFiscal] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarConfig() }, [])

  async function carregarConfig() {
    setLoading(true)
    const cfg = await db.obterConfiguracoes()
    if (cfg) {
      setConfig(prev => ({
        ...prev,
        tema: cfg.tema || 'light',
        nome_professor: cfg.nome_professor || '',
        instituicao: cfg.instituicao || '',
        departamento: cfg.departamento || '',
        ano_letivo_atual: cfg.ano_letivo_atual || `${anoAtual}/${anoAtual + 1}`
      }))
    }

    const fiscal = await db.obterConfigFiscal(anoAtual)
    if (fiscal) {
      setConfigFiscal({
        taxa_iva: String((parseFloat(fiscal.taxa_iva) * 100 || 0).toFixed(1)),
        isento_iva: !!fiscal.isento_iva,
        taxa_retencao_irs: String((parseFloat(fiscal.taxa_retencao_irs) * 100 || 25).toFixed(1)),
        sem_retencao: !!fiscal.sem_retencao,
        notas: fiscal.notas || ''
      })
    }

    setLoading(false)
  }

  function aplicarTema(tema) {
    if (tema === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('tema', tema)
  }

  async function salvarPerfil() {
    await db.salvarConfiguracoes({
      tema: config.tema,
      nome_professor: config.nome_professor,
      instituicao: config.instituicao,
      departamento: config.departamento,
      ano_letivo_atual: config.ano_letivo_atual
    })
    aplicarTema(config.tema)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function salvarFiscal() {
    await db.salvarConfigFiscal({
      ano: anoAtual,
      taxa_iva: (parseFloat(configFiscal.taxa_iva) || 0) / 100,
      isento_iva: configFiscal.isento_iva ? 1 : 0,
      taxa_retencao_irs: (parseFloat(configFiscal.taxa_retencao_irs) || 25) / 100,
      sem_retencao: configFiscal.sem_retencao ? 1 : 0,
      notas: configFiscal.notas
    })
    setSavedFiscal(true)
    setTimeout(() => setSavedFiscal(false), 2000)
  }

  async function fazerBackup() {
    setBackupMsg('')
    const result = await db.exportarBackup()
    if (result?.success) setBackupMsg('✓ Cópia de segurança guardada!')
    else if (!result?.cancelled) setBackupMsg('Erro ao fazer backup.')
    setTimeout(() => setBackupMsg(''), 4000)
  }

  async function restaurarBackup() {
    if (!confirm('Isto irá substituir todos os dados actuais pelo ficheiro de backup. Continuar?')) return
    setBackupMsg('')
    const result = await db.importarBackup()
    if (result?.success) setBackupMsg('✓ ' + result.message)
    else if (!result?.cancelled) setBackupMsg('Erro ao restaurar backup.')
    setTimeout(() => setBackupMsg(''), 8000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="page-title">Definições</h1>

      {/* Theme */}
      <div className="card">
        <h2 className="section-title mb-4">Aparência</h2>
        <div>
          <label className="label-field">Tema</label>
          <div className="flex gap-3">
            <button
              onClick={() => setConfig(c => ({ ...c, tema: 'light' }))}
              className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                config.tema === 'light'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">☀️</span>
              <span className="font-medium">Claro</span>
            </button>
            <button
              onClick={() => setConfig(c => ({ ...c, tema: 'dark' }))}
              className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                config.tema === 'dark'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">🌙</span>
              <span className="font-medium">Escuro</span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="card">
        <h2 className="section-title mb-4">Perfil do Professor</h2>
        <div className="space-y-4">
          <div>
            <label className="label-field">Nome</label>
            <input
              type="text"
              value={config.nome_professor}
              onChange={e => setConfig(c => ({ ...c, nome_professor: e.target.value }))}
              placeholder="O seu nome"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Instituição</label>
            <input
              type="text"
              value={config.instituicao}
              onChange={e => setConfig(c => ({ ...c, instituicao: e.target.value }))}
              placeholder="Nome da instituição"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Departamento</label>
            <input
              type="text"
              value={config.departamento}
              onChange={e => setConfig(c => ({ ...c, departamento: e.target.value }))}
              placeholder="Departamento ou escola"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Ano Lectivo Actual</label>
            <input
              type="text"
              value={config.ano_letivo_atual}
              onChange={e => setConfig(c => ({ ...c, ano_letivo_atual: e.target.value }))}
              placeholder={`${anoAtual}/${anoAtual + 1}`}
              className="input-field"
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={salvarPerfil} className="btn-primary">
              Guardar Definições
            </button>
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-pulse">
                ✓ Guardado!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tax configuration */}
      <div className="card">
        <h2 className="section-title mb-1">Configuração Fiscal</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ano {anoAtual}</p>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <input
              type="checkbox"
              id="isento_iva"
              checked={configFiscal.isento_iva}
              onChange={e => setConfigFiscal(c => ({ ...c, isento_iva: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600"
            />
            <label htmlFor="isento_iva" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Isento de IVA (artigo 9.º do CIVA)
            </label>
          </div>

          {!configFiscal.isento_iva && (
            <div>
              <label className="label-field">Taxa IVA (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={configFiscal.taxa_iva}
                onChange={e => setConfigFiscal(c => ({ ...c, taxa_iva: e.target.value }))}
                className="input-field"
              />
            </div>
          )}

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <input
              type="checkbox"
              id="sem_retencao"
              checked={configFiscal.sem_retencao}
              onChange={e => setConfigFiscal(c => ({ ...c, sem_retencao: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600"
            />
            <label htmlFor="sem_retencao" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Sem retenção na fonte (IRS)
            </label>
          </div>

          {!configFiscal.sem_retencao && (
            <div>
              <label className="label-field">Taxa Retenção IRS (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={configFiscal.taxa_retencao_irs}
                onChange={e => setConfigFiscal(c => ({ ...c, taxa_retencao_irs: e.target.value }))}
                className="input-field"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Taxa padrão para prestadores independentes (categoria B): 25%
              </p>
            </div>
          )}

          <div>
            <label className="label-field">Notas</label>
            <textarea
              rows={3}
              value={configFiscal.notas}
              onChange={e => setConfigFiscal(c => ({ ...c, notas: e.target.value }))}
              placeholder="Notas sobre a situação fiscal..."
              className="input-field resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={salvarFiscal} className="btn-primary">
              Guardar Config. Fiscal
            </button>
            {savedFiscal && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-pulse">
                ✓ Guardado!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dias Não Lectivos */}
      <DiasNaoLetivos db={db} />

      {/* Backup */}
      <div className="card">
        <h2 className="section-title mb-1">Cópia de Segurança</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Exportar ou restaurar todos os dados da aplicação.</p>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={fazerBackup} className="btn-primary">
            ⬇️ Exportar Backup
          </button>
          <button onClick={restaurarBackup} className="btn-secondary">
            ⬆️ Restaurar Backup
          </button>
          {backupMsg && (
            <span className={`text-sm font-medium ${backupMsg.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {backupMsg}
            </span>
          )}
        </div>
      </div>

      {/* About */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-4">
          <span className="text-4xl">🎓</span>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">PlanAula</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Versão 1.0.0</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Planeador de aulas para professores. Gerir disciplinas, turmas, planos de aula e análise financeira.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
