import React, { useState, useEffect } from 'react'
import Modal from '../components/Modal.jsx'
import { useDatabase } from '../hooks/useDatabase.js'

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val || 0)
}

function formatPct(val) {
  return ((val || 0) * 100).toFixed(1) + '%'
}

export default function Financeiro() {
  const db = useDatabase()
  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() + 1

  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual)
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)
  const [dadosMensais, setDadosMensais] = useState(null)
  const [dadosAnuais, setDadosAnuais] = useState([])
  const [configFiscal, setConfigFiscal] = useState(null)
  const [valoresHora, setValoresHora] = useState([])
  const [disciplinas, setDisciplinas] = useState([])
  const [turmas, setTurmas] = useState([])
  const [modalConfig, setModalConfig] = useState(false)
  const [modalValor, setModalValor] = useState(false)
  const [formConfig, setFormConfig] = useState({})
  const [formValor, setFormValor] = useState({ disciplina_id: '', turma_id: '', valor_hora: '', ano_letivo: '' })
  const [vista, setVista] = useState('mensal')

  useEffect(() => { carregarTudo() }, [anoSelecionado, mesSelecionado])

  async function carregarTudo() {
    const [mensal, anual, config, vh, discs, ts] = await Promise.all([
      db.calcularFinanceiroMensal(anoSelecionado, mesSelecionado),
      db.calcularFinanceiroAnual(anoSelecionado),
      db.obterConfigFiscal(anoSelecionado),
      db.listarValoresHora(),
      db.listarDisciplinas(),
      db.listarTurmas(),
    ])
    setDadosMensais(mensal)
    setDadosAnuais(anual || [])
    setConfigFiscal(config)
    setFormConfig(config || {})
    setValoresHora(vh || [])
    setDisciplinas(discs || [])
    setTurmas(ts || [])
  }

  async function salvarConfig() {
    await db.salvarConfigFiscal({
      ...formConfig,
      ano: parseInt(anoSelecionado),
      taxa_iva: parseFloat(formConfig.taxa_iva) || 0,
      isento_iva: formConfig.isento_iva ? 1 : 0,
      taxa_retencao_irs: parseFloat(formConfig.taxa_retencao_irs) || 0,
      sem_retencao: formConfig.sem_retencao ? 1 : 0
    })
    await carregarTudo()
    setModalConfig(false)
  }

  async function salvarValorHora() {
    const ano_letivo = formValor.ano_letivo || `${anoAtual}/${anoAtual + 1}`
    await db.salvarValorHora({
      disciplina_id: parseInt(formValor.disciplina_id),
      turma_id: formValor.turma_id ? parseInt(formValor.turma_id) : null,
      valor_hora: parseFloat(formValor.valor_hora),
      ano_letivo
    })
    await carregarTudo()
    setModalValor(false)
    setFormValor({ disciplina_id: '', turma_id: '', valor_hora: '', ano_letivo: '' })
  }

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => anoAtual - 2 + i)

  async function exportarPDF() {
    const cfg = await db.obterConfiguracoes()
    if (vista === 'mensal' && dadosMensais) {
      if (!dadosMensais.total_bruto && dadosMensais.itens?.length === 0) {
        alert('Sem dados para exportar neste mês.')
        return
      }
      await db.exportarRelatorioFinanceiro(dadosMensais, 'mensal', anoSelecionado, mesSelecionado, cfg || {})
    } else if (vista === 'anual') {
      const temDados = dadosAnuais.some(m => m.total_bruto > 0)
      if (!temDados) {
        alert('Sem dados financeiros para exportar neste ano.')
        return
      }
      await db.exportarRelatorioFinanceiro(dadosAnuais, 'anual', anoSelecionado, null, cfg || {})
    }
  }

  // Annual totals
  const totalAnual = {
    horas: dadosAnuais.reduce((s, m) => s + (m.total_horas || 0), 0),
    bruto: dadosAnuais.reduce((s, m) => s + (m.total_bruto || 0), 0),
    iva: dadosAnuais.reduce((s, m) => s + (m.total_iva || 0), 0),
    irs: dadosAnuais.reduce((s, m) => s + (m.total_irs || 0), 0),
    liquido: dadosAnuais.reduce((s, m) => s + (m.total_liquido || 0), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Financeiro</h1>
        <div className="flex gap-2">
          <button onClick={exportarPDF} className="btn-secondary">📄 Exportar PDF</button>
          <button onClick={() => setModalValor(true)} className="btn-secondary">💶 Valor/Hora</button>
          <button
            onClick={() => { setFormConfig(configFiscal || {}); setModalConfig(true) }}
            className="btn-secondary"
          >
            ⚙️ Config. Fiscal
          </button>
        </div>
      </div>

      {/* Year/month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setVista('mensal')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              vista === 'mensal' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >Mensal</button>
          <button
            onClick={() => setVista('anual')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              vista === 'anual' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >Anual</button>
        </div>

        <select
          value={anoSelecionado}
          onChange={e => setAnoSelecionado(parseInt(e.target.value))}
          className="input-field w-auto"
        >
          {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {vista === 'mensal' && (
          <select
            value={mesSelecionado}
            onChange={e => setMesSelecionado(parseInt(e.target.value))}
            className="input-field w-auto"
          >
            {MESES_NOMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
      </div>

      {vista === 'mensal' && dadosMensais && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dadosMensais.total_horas.toFixed(1)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Horas</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(dadosMensais.total_bruto)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Valor Bruto</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">-{formatCurrency(dadosMensais.total_irs)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Retenção IRS ({formatPct(dadosMensais.taxa_irs)})</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(dadosMensais.total_liquido)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Valor Líquido</p>
            </div>
          </div>

          {/* Detail by discipline */}
          <div className="card">
            <h2 className="section-title mb-4">Detalhe por Disciplina</h2>
            {dadosMensais.itens.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
                Sem dados para este mês. Verifique se existem aulas e valores/hora configurados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Disciplina</th>
                      <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Horas</th>
                      <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">€/Hora</th>
                      <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Valor Bruto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {dadosMensais.itens.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2.5 font-medium text-gray-900 dark:text-white">{item.disciplina_nome}</td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">{item.total_horas.toFixed(1)}h</td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.valor_hora)}</td>
                        <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(item.valor_bruto)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td colSpan={3} className="py-2.5 font-bold text-gray-900 dark:text-white">Total</td>
                      <td className="py-2.5 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(dadosMensais.total_bruto)}</td>
                    </tr>
                    {dadosMensais.taxa_iva > 0 && (
                      <tr>
                        <td colSpan={3} className="py-1.5 text-gray-500 dark:text-gray-400">IVA ({formatPct(dadosMensais.taxa_iva)})</td>
                        <td className="py-1.5 text-right text-green-600 dark:text-green-400">+{formatCurrency(dadosMensais.total_iva)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="py-1.5 text-gray-500 dark:text-gray-400">Retenção IRS ({formatPct(dadosMensais.taxa_irs)})</td>
                      <td className="py-1.5 text-right text-red-600 dark:text-red-400">-{formatCurrency(dadosMensais.total_irs)}</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td colSpan={3} className="py-2.5 font-bold text-lg text-blue-600 dark:text-blue-400">Valor Líquido</td>
                      <td className="py-2.5 text-right font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(dadosMensais.total_liquido)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {vista === 'anual' && (
        <div className="space-y-6">
          {/* Annual summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalAnual.horas.toFixed(1)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Horas</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(totalAnual.bruto)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Valor Bruto</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">-{formatCurrency(totalAnual.irs)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total IRS</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalAnual.liquido)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Valor Líquido</p>
            </div>
          </div>

          {/* Monthly table */}
          <div className="card overflow-x-auto">
            <h2 className="section-title mb-4">Resumo Mensal {anoSelecionado}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Mês</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Horas</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Bruto</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">IRS</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {dadosAnuais.map((m, i) => (
                  <tr
                    key={i}
                    onClick={() => { setMesSelecionado(i + 1); setVista('mensal') }}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer ${
                      i + 1 === mesAtual && anoSelecionado === anoAtual ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <td className="py-2.5 font-medium text-gray-900 dark:text-white">{MESES_NOMES[i]}</td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">{m.total_horas.toFixed(1)}h</td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.total_bruto)}</td>
                    <td className="py-2.5 text-right text-red-600 dark:text-red-400">-{formatCurrency(m.total_irs)}</td>
                    <td className="py-2.5 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(m.total_liquido)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                  <td className="py-2.5 text-gray-900 dark:text-white">Total</td>
                  <td className="py-2.5 text-right text-gray-900 dark:text-white">{totalAnual.horas.toFixed(1)}h</td>
                  <td className="py-2.5 text-right text-gray-900 dark:text-white">{formatCurrency(totalAnual.bruto)}</td>
                  <td className="py-2.5 text-right text-red-600 dark:text-red-400">-{formatCurrency(totalAnual.irs)}</td>
                  <td className="py-2.5 text-right text-blue-600 dark:text-blue-400">{formatCurrency(totalAnual.liquido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Values per hour table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Valores por Hora</h2>
          <button onClick={() => setModalValor(true)} className="btn-primary text-sm">+ Adicionar</button>
        </div>
        {valoresHora.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">
            Sem valores/hora configurados. Adicione para ver cálculos financeiros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Disciplina</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Turma</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">€/Hora</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Ano Lectivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {valoresHora.map((vh, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2.5 text-gray-900 dark:text-white">{vh.disciplina_nome}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{vh.turma_nome || '—'}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(vh.valor_hora)}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{vh.ano_letivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config fiscal modal */}
      <Modal
        isOpen={modalConfig}
        onClose={() => setModalConfig(false)}
        title="Configuração Fiscal"
        size="md"
        footer={
          <>
            <button onClick={() => setModalConfig(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvarConfig} className="btn-primary">Guardar</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Configuração para o ano {anoSelecionado}.</p>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!formConfig.isento_iva}
                onChange={e => setFormConfig(f => ({ ...f, isento_iva: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Isento de IVA</span>
            </label>

            {!formConfig.isento_iva && (
              <div>
                <label className="label-field">Taxa IVA (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={(parseFloat(formConfig.taxa_iva) * 100 || 0).toFixed(1)}
                  onChange={e => setFormConfig(f => ({ ...f, taxa_iva: parseFloat(e.target.value) / 100 || 0 }))}
                  className="input-field"
                />
              </div>
            )}

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!formConfig.sem_retencao}
                onChange={e => setFormConfig(f => ({ ...f, sem_retencao: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sem retenção na fonte (IRS)</span>
            </label>

            {!formConfig.sem_retencao && (
              <div>
                <label className="label-field">Taxa Retenção IRS (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={(parseFloat(formConfig.taxa_retencao_irs) * 100 || 25).toFixed(1)}
                  onChange={e => setFormConfig(f => ({ ...f, taxa_retencao_irs: parseFloat(e.target.value) / 100 || 0 }))}
                  className="input-field"
                />
              </div>
            )}

            <div>
              <label className="label-field">Notas</label>
              <textarea
                rows={3}
                value={formConfig.notas || ''}
                onChange={e => setFormConfig(f => ({ ...f, notas: e.target.value }))}
                className="input-field resize-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Valor/hora modal */}
      <Modal
        isOpen={modalValor}
        onClose={() => setModalValor(false)}
        title="Valor por Hora"
        size="md"
        footer={
          <>
            <button onClick={() => setModalValor(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvarValorHora} className="btn-primary">Guardar</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-field">Disciplina *</label>
            <select
              value={formValor.disciplina_id}
              onChange={e => setFormValor(f => ({ ...f, disciplina_id: e.target.value, turma_id: '' }))}
              className="input-field"
            >
              <option value="">Seleccionar...</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Turma (opcional)</label>
            <select
              value={formValor.turma_id}
              onChange={e => setFormValor(f => ({ ...f, turma_id: e.target.value }))}
              className="input-field"
              disabled={!formValor.disciplina_id}
            >
              <option value="">Todas as turmas</option>
              {turmas
                .filter(t => String(t.disciplina_id) === String(formValor.disciplina_id))
                .map(t => <option key={t.id} value={t.id}>{t.designacao}</option>)
              }
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Valor/Hora (€) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formValor.valor_hora}
                onChange={e => setFormValor(f => ({ ...f, valor_hora: e.target.value }))}
                placeholder="0.00"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Ano Lectivo</label>
              <input
                type="text"
                value={formValor.ano_letivo || `${anoAtual}/${anoAtual + 1}`}
                onChange={e => setFormValor(f => ({ ...f, ano_letivo: e.target.value }))}
                placeholder={`${anoAtual}/${anoAtual + 1}`}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
