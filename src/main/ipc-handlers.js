import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import fs from 'fs'
import * as models from './database/models.js'
import { getDb, closeDb } from './database/db.js'

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function formatCur(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

function gerarHTMLPlanoAula(aula, config = {}) {
  const dataFmt = aula.data
    ? new Date(aula.data + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const secao = (titulo, conteudo) => conteudo
    ? `<div class="secao"><div class="secao-titulo">${titulo}</div><div class="secao-corpo">${conteudo.replace(/\n/g, '<br>')}</div></div>`
    : ''

  const estadoCor = { Realizada: '#16a34a', Planeada: '#2563eb', Adiada: '#ca8a04', Cancelada: '#dc2626' }
  const cor = estadoCor[aula.estado] || '#2563eb'

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1f2937; background: white; padding: 32px; }
  .cabecalho { border-bottom: 3px solid ${aula.turma_cor || '#2563eb'}; padding-bottom: 16px; margin-bottom: 20px; }
  .cabecalho h1 { font-size: 18pt; font-weight: 700; color: #111827; }
  .cabecalho h2 { font-size: 13pt; color: #4b5563; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; background: #f9fafb; border-radius: 8px; padding: 14px; }
  .meta-item label { font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; display: block; }
  .meta-item span { font-weight: 600; color: #111827; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 9pt; font-weight: 600; color: white; background: ${cor}; }
  .secao { margin-bottom: 16px; }
  .secao-titulo { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
  .secao-corpo { font-size: 11pt; line-height: 1.6; color: #374151; }
  .rodape { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9pt; color: #9ca3af; display: flex; justify-content: space-between; }
  ${config.instituicao ? '.inst { font-size: 10pt; color: #6b7280; margin-bottom: 4px; }' : ''}
</style></head><body>
  <div class="cabecalho">
    ${config.instituicao ? `<div class="inst">${config.instituicao}${config.departamento ? ' · ' + config.departamento : ''}</div>` : ''}
    <h1>Plano de Aula</h1>
    <h2>${aula.disciplina_nome || ''} ${aula.turma_nome ? '— ' + aula.turma_nome : ''}</h2>
  </div>
  <div class="meta">
    ${aula.numero != null ? `<div class="meta-item"><label>Nº Aula</label><span>${aula.numero}</span></div>` : ""}
    <div class="meta-item"><label>Data</label><span>${dataFmt}</span></div>
    <div class="meta-item"><label>Horário</label><span>${aula.hora_inicio || ''} – ${aula.hora_fim || ''}</span></div>
    ${aula.modulo_nome ? `<div class="meta-item"><label>Módulo</label><span>${aula.modulo_nome}</span></div>` : ''}
    <div class="meta-item"><label>Estado</label><span class="badge">${aula.estado || ''}</span></div>
  </div>
  ${aula.topico ? `<div class="secao"><div class="secao-titulo">Tópico</div><div class="secao-corpo" style="font-size:13pt;font-weight:600;color:#111827">${aula.topico}</div></div>` : ''}
  ${secao('Objetivos', aula.objetivos)}
  ${secao('Conteúdos', aula.conteudos)}
  ${secao('Atividades', aula.atividades)}
  ${secao('Recursos', aula.recursos)}
  ${secao('Avaliação', aula.avaliacao)}
  ${secao('Notas', aula.notas)}
  <div class="rodape">
    <span>${config.nome_professor || ''}</span>
    <span>PlanAula · ${new Date().toLocaleDateString('pt-PT')}</span>
  </div>
</body></html>`
}

function gerarHTMLRelatorioFinanceiro(dados, tipo, ano, mes, config = {}) {
  const titulo = tipo === 'mensal'
    ? `Relatório Financeiro — ${MESES_PT[mes - 1]} ${ano}`
    : `Relatório Financeiro Anual — ${ano}`

  const linhasItens = (dados.itens || []).map(item => `
    <tr>
      <td>${item.disciplina_nome}</td>
      <td class="num">${item.total_horas.toFixed(1)}h</td>
      <td class="num">${formatCur(item.valor_hora)}</td>
      <td class="num">${formatCur(item.valor_bruto)}</td>
    </tr>`).join('')

  const linhasMensais = Array.isArray(dados) ? dados.map((m, i) => `
    <tr>
      <td>${MESES_PT[i]}</td>
      <td class="num">${m.total_horas.toFixed(1)}h</td>
      <td class="num">${formatCur(m.total_bruto)}</td>
      <td class="num red">-${formatCur(m.total_irs)}</td>
      <td class="num green">${formatCur(m.total_liquido)}</td>
    </tr>`).join('') : ''

  const totAnual = Array.isArray(dados) ? {
    horas: dados.reduce((s, m) => s + (m.total_horas || 0), 0),
    bruto: dados.reduce((s, m) => s + (m.total_bruto || 0), 0),
    irs: dados.reduce((s, m) => s + (m.total_irs || 0), 0),
    liquido: dados.reduce((s, m) => s + (m.total_liquido || 0), 0),
  } : null

  const mensal = !Array.isArray(dados) ? dados : null

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11pt; color:#1f2937; background:white; padding:32px; }
  .cab { border-bottom:3px solid #2563eb; padding-bottom:14px; margin-bottom:20px; }
  .cab h1 { font-size:17pt; font-weight:700; color:#111827; }
  .cab p { color:#6b7280; margin-top:4px; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .card { background:#f9fafb; border-radius:8px; padding:14px; text-align:center; }
  .card .v { font-size:16pt; font-weight:700; }
  .card .l { font-size:9pt; color:#6b7280; margin-top:4px; }
  .blue { color:#2563eb; } .green { color:#16a34a; } .red { color:#dc2626; } .gray { color:#374151; }
  table { width:100%; border-collapse:collapse; font-size:10pt; }
  th { text-align:left; padding:8px; border-bottom:2px solid #e5e7eb; color:#6b7280; font-weight:600; text-transform:uppercase; font-size:9pt; letter-spacing:.04em; }
  th.num, td.num { text-align:right; }
  td { padding:8px; border-bottom:1px solid #f3f4f6; }
  tr:hover td { background:#f9fafb; }
  .totais td { font-weight:700; border-top:2px solid #d1d5db; border-bottom:none; }
  .rodape { margin-top:28px; border-top:1px solid #e5e7eb; padding-top:10px; font-size:9pt; color:#9ca3af; display:flex; justify-content:space-between; }
  h2 { font-size:12pt; margin-bottom:12px; color:#374151; }
</style></head><body>
  <div class="cab">
    ${config.instituicao ? `<p>${config.instituicao}${config.departamento ? ' · ' + config.departamento : ''}</p>` : ''}
    <h1>${titulo}</h1>
    ${config.nome_professor ? `<p>${config.nome_professor}</p>` : ''}
  </div>
  ${mensal ? `
  <div class="cards">
    <div class="card"><div class="v blue">${mensal.total_horas.toFixed(1)}h</div><div class="l">Total Horas</div></div>
    <div class="card"><div class="v gray">${formatCur(mensal.total_bruto)}</div><div class="l">Valor Bruto</div></div>
    <div class="card"><div class="v red">-${formatCur(mensal.total_irs)}</div><div class="l">Retenção IRS (${((mensal.taxa_irs||0)*100).toFixed(0)}%)</div></div>
    <div class="card"><div class="v green">${formatCur(mensal.total_liquido)}</div><div class="l">Valor Líquido</div></div>
  </div>
  <h2>Detalhe por Disciplina</h2>
  <table>
    <thead><tr><th>Disciplina</th><th class="num">Horas</th><th class="num">€/Hora</th><th class="num">Valor Bruto</th></tr></thead>
    <tbody>${linhasItens}</tbody>
    <tfoot>
      <tr class="totais"><td colspan="3">Total Bruto</td><td class="num">${formatCur(mensal.total_bruto)}</td></tr>
      ${mensal.taxa_iva > 0 ? `<tr><td colspan="3">IVA (${((mensal.taxa_iva||0)*100).toFixed(0)}%)</td><td class="num green">+${formatCur(mensal.total_iva)}</td></tr>` : ''}
      <tr><td colspan="3">Retenção IRS (${((mensal.taxa_irs||0)*100).toFixed(0)}%)</td><td class="num red">-${formatCur(mensal.total_irs)}</td></tr>
      <tr class="totais"><td colspan="3" class="blue">Valor Líquido</td><td class="num blue">${formatCur(mensal.total_liquido)}</td></tr>
    </tfoot>
  </table>` : ''}
  ${totAnual ? `
  <div class="cards">
    <div class="card"><div class="v blue">${totAnual.horas.toFixed(1)}h</div><div class="l">Total Horas</div></div>
    <div class="card"><div class="v gray">${formatCur(totAnual.bruto)}</div><div class="l">Valor Bruto</div></div>
    <div class="card"><div class="v red">-${formatCur(totAnual.irs)}</div><div class="l">Total IRS</div></div>
    <div class="card"><div class="v green">${formatCur(totAnual.liquido)}</div><div class="l">Valor Líquido</div></div>
  </div>
  <h2>Resumo Mensal ${ano}</h2>
  <table>
    <thead><tr><th>Mês</th><th class="num">Horas</th><th class="num">Bruto</th><th class="num">IRS</th><th class="num">Líquido</th></tr></thead>
    <tbody>${linhasMensais}</tbody>
    <tfoot>
      <tr class="totais"><td>Total</td><td class="num">${totAnual.horas.toFixed(1)}h</td><td class="num">${formatCur(totAnual.bruto)}</td><td class="num red">-${formatCur(totAnual.irs)}</td><td class="num green">${formatCur(totAnual.liquido)}</td></tr>
    </tfoot>
  </table>` : ''}
  <div class="rodape">
    <span>${config.nome_professor || ''}</span>
    <span>PlanAula · Gerado em ${new Date().toLocaleDateString('pt-PT')}</span>
  </div>
</body></html>`
}

async function imprimirPDF(html, defaultFileName) {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Guardar PDF',
    defaultPath: defaultFileName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (!filePath) return { success: false, cancelled: true }

  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: false, contextIsolation: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const pdfData = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
  })
  win.destroy()
  fs.writeFileSync(filePath, pdfData)
  shell.showItemInFolder(filePath)
  return { success: true, path: filePath }
}

export function registerHandlers() {

  // ─── Disciplinas ─────────────────────────────────────────────────────────
  ipcMain.handle('disciplinas:listar', async () => {
    try { return { success: true, data: models.listarDisciplinas() } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('disciplinas:buscar', async (_, id) => {
    try { return { success: true, data: models.buscarDisciplina(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('disciplinas:criar', async (_, dados) => {
    try { return { success: true, data: models.criarDisciplina(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('disciplinas:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarDisciplina(id, dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('disciplinas:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarDisciplina(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Módulos ──────────────────────────────────────────────────────────────
  ipcMain.handle('modulos:listar', async (_, disciplina_id) => {
    try { return { success: true, data: models.listarModulos(disciplina_id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('modulos:criar', async (_, dados) => {
    try { return { success: true, data: models.criarModulo(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('modulos:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarModulo(id, dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('modulos:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarModulo(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Turmas ───────────────────────────────────────────────────────────────
  ipcMain.handle('turmas:listar', async (_, disciplina_id) => {
    try { return { success: true, data: models.listarTurmas(disciplina_id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('turmas:criar', async (_, dados) => {
    try { return { success: true, data: models.criarTurma(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('turmas:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarTurma(id, dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('turmas:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarTurma(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Horários ─────────────────────────────────────────────────────────────
  ipcMain.handle('horarios:listar', async (_, turma_id) => {
    try { return { success: true, data: models.listarHorarios(turma_id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('horarios:criar', async (_, dados) => {
    try { return { success: true, data: models.criarHorario(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('horarios:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarHorario(id, dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('horarios:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarHorario(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('horarios:eliminarDaTurma', async (_, turma_id) => {
    try { return { success: true, data: models.eliminarHorariosDaTurma(turma_id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Aulas ────────────────────────────────────────────────────────────────
  ipcMain.handle('aulas:listar', async (_, filtros) => {
    try { return { success: true, data: models.listarAulas(filtros) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:buscar', async (_, id) => {
    try { return { success: true, data: models.buscarAula(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:criar', async (_, dados) => {
    try { return { success: true, data: models.criarAula(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarAula(id, dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarAula(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:gerarAutomatico', async (_, { turma_id, data_inicio, data_fim }) => {
    try { return { success: true, data: models.gerarAulasAutomatico(turma_id, data_inicio, data_fim) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:eliminarDaDisciplina', async (_, disciplina_id) => {
    try { return { success: true, data: models.eliminarAulasDaDisciplina(disciplina_id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Financeiro ───────────────────────────────────────────────────────────
  ipcMain.handle('financeiro:calcularMensal', async (_, { ano, mes }) => {
    try { return { success: true, data: models.calcularFinanceiroMensal(ano, mes) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('financeiro:calcularAnual', async (_, ano) => {
    try { return { success: true, data: models.calcularFinanceiroAnual(ano) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('financeiro:obterConfig', async (_, ano) => {
    try { return { success: true, data: models.obterConfigFiscal(ano) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('financeiro:salvarConfig', async (_, dados) => {
    try { return { success: true, data: models.salvarConfigFiscal(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('financeiro:listarValoresHora', async (_, ano_letivo) => {
    try { return { success: true, data: models.listarValoresHora(ano_letivo) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('financeiro:salvarValorHora', async (_, dados) => {
    try { return { success: true, data: models.criarValorHora(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Configurações ────────────────────────────────────────────────────────
  ipcMain.handle('configuracoes:obter', async (_, chave) => {
    try {
      if (chave) return { success: true, data: models.obterConfiguracao(chave) }
      return { success: true, data: models.obterTodasConfiguracoes() }
    }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('configuracoes:salvar', async (_, dados) => {
    try {
      if (typeof dados === 'object' && !Array.isArray(dados)) {
        return { success: true, data: models.salvarConfiguracoes(dados) }
      }
      const { chave, valor } = dados
      return { success: true, data: models.salvarConfiguracao(chave, valor) }
    }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Estatísticas ─────────────────────────────────────────────────────────
  ipcMain.handle('estatisticas:obter', async (_, ano_letivo) => {
    try { return { success: true, data: models.obterEstatisticas(ano_letivo) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Dias Não Lectivos ────────────────────────────────────────────────────
  ipcMain.handle('diasNaoLetivos:listar', async (_, ano) => {
    try { return { success: true, data: models.listarDiasNaoLetivos(ano) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('diasNaoLetivos:criar', async (_, dados) => {
    try { return { success: true, data: models.criarDiaNaoLetivo(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('diasNaoLetivos:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarDiaNaoLetivo(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('diasNaoLetivos:importarFeriados', async (_, ano) => {
    try { return { success: true, data: models.importarFeriadosNacionais(ano) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Períodos Não Letivos ─────────────────────────────────────────────────
  ipcMain.handle('periodosNaoLetivos:listar', async (_, instituicao_id) => {
    try { return { success: true, data: models.listarPeriodosNaoLetivos(instituicao_id) } }
    catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('periodosNaoLetivos:criar', async (_, dados) => {
    try { return { success: true, data: models.criarPeriodoNaoLetivo(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('periodosNaoLetivos:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarPeriodoNaoLetivo(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:proximoNumero', async (_, turma_id) => {
    try { return { success: true, data: models.proximoNumeroAula(turma_id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Exportação PDF ───────────────────────────────────────────────────────
  ipcMain.handle('export:aulaPlano', async (_, { aula, config }) => {
    try {
      const html = gerarHTMLPlanoAula(aula, config || {})
      const nomeFicheiro = `plano-${(aula.disciplina_nome || 'aula').replace(/\s+/g, '-')}-${aula.data || 'sem-data'}.pdf`
      return await imprimirPDF(html, nomeFicheiro)
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('export:relatorioFinanceiro', async (_, { dados, tipo, ano, mes, config }) => {
    try {
      const html = gerarHTMLRelatorioFinanceiro(dados, tipo, ano, mes, config || {})
      const nomeFicheiro = tipo === 'mensal'
        ? `financeiro-${MESES_PT[mes - 1]}-${ano}.pdf`
        : `financeiro-anual-${ano}.pdf`
      return await imprimirPDF(html, nomeFicheiro)
    } catch (e) { return { success: false, error: e.message } }
  })

  // ─── Instituições ─────────────────────────────────────────────────────────
  ipcMain.handle('instituicoes:listar', async () => {
    try { return { success: true, data: models.listarInstituicoes() } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('instituicoes:criar', async (_, dados) => {
    try { return { success: true, data: models.criarInstituicao(dados) } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('instituicoes:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarInstituicao(id, dados) } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('instituicoes:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarInstituicao(id) } } catch (e) { return { success: false, error: e.message } }
  })

  // ─── Cursos ───────────────────────────────────────────────────────────────
  ipcMain.handle('cursos:listar', async (_, instituicao_id) => {
    try { return { success: true, data: models.listarCursos(instituicao_id) } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('cursos:criar', async (_, dados) => {
    try { return { success: true, data: models.criarCurso(dados) } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('cursos:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarCurso(id, dados) } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('cursos:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarCurso(id) } } catch (e) { return { success: false, error: e.message } }
  })

  // ─── Outros Rendimentos ──────────────────────────────────────────────────
  ipcMain.handle('outrosRendimentos:listar', async (_, filtros) => {
    try { return { success: true, data: models.listarOutrosRendimentos(filtros) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('outrosRendimentos:criar', async (_, dados) => {
    try { return { success: true, data: models.criarOutroRendimento(dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('outrosRendimentos:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarOutroRendimento(id, dados) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('outrosRendimentos:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarOutroRendimento(id) } }
    catch (e) { return { success: false, error: e.message } }
  })

  // ─── Backup ───────────────────────────────────────────────────────────────
  ipcMain.handle('backup:exportar', async () => {
    try {
      const db = getDb()
      const dbPath = db.name

      const { filePath } = await dialog.showSaveDialog({
        title: 'Guardar Cópia de Segurança',
        defaultPath: `planaula-backup-${new Date().toISOString().slice(0,10)}.db`,
        filters: [{ name: 'Base de dados', extensions: ['db'] }]
      })
      if (!filePath) return { success: false, cancelled: true }

      fs.copyFileSync(dbPath, filePath)
      shell.showItemInFolder(filePath)
      return { success: true, path: filePath }
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('backup:importar', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Restaurar Cópia de Segurança',
        filters: [{ name: 'Base de dados', extensions: ['db'] }],
        properties: ['openFile']
      })
      if (!filePaths || filePaths.length === 0) return { success: false, cancelled: true }

      const db = getDb()
      const dbPath = db.name

      // Backup do ficheiro atual antes de restaurar
      const backupAuto = dbPath + '.bak'
      fs.copyFileSync(dbPath, backupAuto)

      closeDb()
      fs.copyFileSync(filePaths[0], dbPath)

      return { success: true, message: 'Restauro concluído. Reinicie a aplicação para aplicar as alterações.' }
    } catch (e) { return { success: false, error: e.message } }
  })
}
