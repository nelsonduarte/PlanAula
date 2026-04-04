import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import fs from 'fs'
import * as models from './database/models.js'
import { getDb, closeDb } from './database/db.js'
import { gerarHTMLPlanos } from './exporters/plano-aula-template.js'

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function formatCur(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

const DIAS_SEMANA_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

function gerarHTMLRelatorioTurma(turma, horarios, aulas, config = {}) {
  const cor = turma.cor || '#2563eb'
  const hoje = new Date().toLocaleDateString('pt-PT')

  const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-PT') : '—'
  const fmtDiaSemana = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short' }) : ''

  // Calcular estatísticas com lógica automática de estado
  const hojeISO = new Date().toISOString().split('T')[0]
  const estadoVis = a => (a.estado === 'Adiada' || a.estado === 'Cancelada') ? a.estado : a.data <= hojeISO ? 'Realizada' : 'Planeada'

  const realizadas = aulas.filter(a => estadoVis(a) === 'Realizada').length
  const planeadas  = aulas.filter(a => estadoVis(a) === 'Planeada').length
  const adiadas    = aulas.filter(a => estadoVis(a) === 'Adiada').length
  const canceladas = aulas.filter(a => estadoVis(a) === 'Cancelada').length

  const horasDadas = aulas.filter(a => estadoVis(a) === 'Realizada').reduce((s, a) => {
    const [hi, mi] = (a.hora_inicio || '0:0').split(':').map(Number)
    const [hf, mf] = (a.hora_fim    || '0:0').split(':').map(Number)
    return s + (hf * 60 + mf - hi * 60 - mi) / 60
  }, 0)

  const horasTotal = aulas.filter(a => estadoVis(a) !== 'Cancelada').reduce((s, a) => {
    const [hi, mi] = (a.hora_inicio || '0:0').split(':').map(Number)
    const [hf, mf] = (a.hora_fim    || '0:0').split(':').map(Number)
    return s + (hf * 60 + mf - hi * 60 - mi) / 60
  }, 0)

  const carga = turma.carga_horaria || 0
  const progresso = carga > 0 ? Math.min(100, (horasDadas / carga) * 100) : null

  const corEstado = e => e === 'Realizada' ? '#16a34a' : e === 'Planeada' ? '#2563eb' : e === 'Adiada' ? '#ca8a04' : '#dc2626'

  const linhasAulas = aulas.map(a => {
    const ev = estadoVis(a)
    return `<tr>
      <td>${a.numero != null ? a.numero : '—'}</td>
      <td>${fmtData(a.data)}</td>
      <td style="color:#6b7280;font-size:9pt">${fmtDiaSemana(a.data)}</td>
      <td>${a.hora_inicio || ''}–${a.hora_fim || ''}</td>
      <td>${a.sala || '—'}</td>
      <td><span class="badge" style="background:${corEstado(ev)}">${ev}</span></td>
      <td style="color:#374151">${a.topico || ''}</td>
    </tr>`
  }).join('')

  const linhasHorarios = (horarios || []).map(h =>
    `<tr><td>${DIAS_SEMANA_PT[h.dia_semana] || h.dia_semana}</td><td>${h.hora_inicio}</td><td>${h.hora_fim}</td><td>${h.sala || '—'}</td></tr>`
  ).join('')

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10pt; color:#1f2937; background:white; padding:28px 32px; }
  .topo { border-left:5px solid ${cor}; padding-left:14px; margin-bottom:18px; }
  .topo h1 { font-size:18pt; font-weight:700; color:#111827; }
  .topo h2 { font-size:12pt; color:#4b5563; margin-top:3px; }
  .inst { font-size:9pt; color:#9ca3af; margin-bottom:6px; }
  .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; background:#f9fafb; border-radius:8px; padding:12px; margin-bottom:18px; }
  .meta-item label { font-size:8pt; text-transform:uppercase; letter-spacing:.05em; color:#9ca3af; display:block; }
  .meta-item span { font-weight:600; color:#111827; font-size:10pt; }
  h3 { font-size:10pt; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin:16px 0 10px; }
  table { width:100%; border-collapse:collapse; font-size:9.5pt; }
  th { text-align:left; padding:6px 8px; background:#f3f4f6; font-size:8.5pt; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:#6b7280; border-bottom:2px solid #e5e7eb; }
  td { padding:5px 8px; border-bottom:1px solid #f3f4f6; color:#374151; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  .badge { display:inline-block; padding:1px 7px; border-radius:999px; font-size:8pt; font-weight:600; color:white; }
  .kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:14px; }
  .kpi { background:#f9fafb; border-radius:8px; padding:10px 12px; text-align:center; }
  .kpi .val { font-size:16pt; font-weight:700; }
  .kpi .lbl { font-size:8pt; color:#9ca3af; margin-top:2px; }
  .prog-bar { height:10px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-top:8px; }
  .prog-fill { height:100%; border-radius:999px; background:${progresso !== null && progresso >= 100 ? '#16a34a' : cor}; width:${progresso !== null ? progresso : 0}%; }
  .rodape { margin-top:28px; border-top:1px solid #e5e7eb; padding-top:8px; font-size:8pt; color:#9ca3af; display:flex; justify-content:space-between; }
</style></head><body>
  <div class="topo">
    ${config.instituicao ? `<div class="inst">${config.instituicao}${config.departamento ? ' · '+config.departamento : ''}</div>` : ''}
    <h1>${turma.designacao || ''}</h1>
    <h2>${turma.disciplina_nome || ''}${turma.curso_nome ? ' · ' + turma.curso_nome : ''}</h2>
  </div>

  <div class="meta">
    <div class="meta-item"><label>Ano Letivo</label><span>${turma.ano_letivo || '—'}</span></div>
    <div class="meta-item"><label>Semestre</label><span>${turma.semestre ? turma.semestre + 'º' : '—'}</span></div>
    <div class="meta-item"><label>Período</label><span>${fmtData(turma.data_inicio)} → ${fmtData(turma.data_fim)}</span></div>
    <div class="meta-item"><label>Carga Horária</label><span>${carga > 0 ? carga + 'h' : '—'}</span></div>
  </div>

  <h3>Resumo</h3>
  <div class="kpis">
    <div class="kpi"><div class="val" style="color:#111827">${aulas.length}</div><div class="lbl">Total Aulas</div></div>
    <div class="kpi"><div class="val" style="color:#16a34a">${realizadas}</div><div class="lbl">Realizadas</div></div>
    <div class="kpi"><div class="val" style="color:#2563eb">${planeadas}</div><div class="lbl">Planeadas</div></div>
    <div class="kpi"><div class="val" style="color:#ca8a04">${adiadas}</div><div class="lbl">Adiadas</div></div>
    <div class="kpi"><div class="val" style="color:#dc2626">${canceladas}</div><div class="lbl">Canceladas</div></div>
  </div>
  ${carga > 0 ? `
  <div style="display:flex;align-items:center;gap:12px;background:#f9fafb;border-radius:8px;padding:10px 14px;margin-bottom:4px">
    <span style="font-size:9pt;color:#6b7280;white-space:nowrap">Horas dadas: <strong style="color:#111827">${horasDadas.toFixed(1)}h</strong> / ${carga}h</span>
    <div class="prog-bar" style="flex:1"><div class="prog-fill"></div></div>
    <span style="font-size:10pt;font-weight:700;color:${progresso >= 100 ? '#16a34a' : cor};white-space:nowrap">${progresso.toFixed(0)}%</span>
  </div>` : `<p style="font-size:9pt;color:#6b7280;margin-bottom:8px">Horas dadas: <strong>${horasDadas.toFixed(1)}h</strong> · Total planeado: <strong>${horasTotal.toFixed(1)}h</strong></p>`}

  ${horarios && horarios.length > 0 ? `
  <h3>Horários</h3>
  <table><thead><tr><th>Dia</th><th>Início</th><th>Fim</th><th>Sala</th></tr></thead>
  <tbody>${linhasHorarios}</tbody></table>` : ''}

  <h3>Registo de Aulas</h3>
  <table>
    <thead><tr><th>Nº</th><th>Data</th><th></th><th>Horário</th><th>Sala</th><th>Estado</th><th>Tópico</th></tr></thead>
    <tbody>${linhasAulas}</tbody>
  </table>

  <div class="rodape">
    <span>${config.nome_professor || ''}</span>
    <span>PlanAula · ${hoje}</span>
  </div>
</body></html>`
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

function gerarHTMLMobile(dadosJSON, config) {
  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>PlanAula — ${config.nome_professor || 'Horário'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--accent:#3b82f6}
body{font-family:-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--text);padding:0;min-height:100vh}
.header{background:var(--card);padding:16px;text-align:center;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.header h1{font-size:18px;font-weight:700}.header p{font-size:12px;color:var(--muted);margin-top:2px}
.nav{display:flex;gap:0;background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:56px;z-index:9}
.nav button{flex:1;padding:10px;border:none;background:none;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer}
.nav button.active{color:var(--accent);border-bottom:2px solid var(--accent)}
.month-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--card);border-bottom:1px solid var(--border)}
.month-nav button{background:none;border:none;color:var(--accent);font-size:24px;padding:8px 16px;cursor:pointer}
.month-nav span{font-size:16px;font-weight:600}
.vista-toggle{display:flex;gap:0;padding:0 16px 8px;background:var(--card)}
.vista-toggle button{flex:1;padding:6px;border:1px solid var(--border);background:none;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer}
.vista-toggle button:first-child{border-radius:6px 0 0 6px}.vista-toggle button:last-child{border-radius:0 6px 6px 0}
.vista-toggle button.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.week-day{background:var(--card);border-radius:8px;margin-bottom:8px;overflow:hidden}
.week-day-header{padding:10px 12px;font-weight:600;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}
.week-day-header.today{background:var(--accent);color:#fff}
.week-day-header.holiday{background:#7f1d1d;color:#fca5a5}
.week-ev{padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:8px}
.week-ev:last-child{border-bottom:none}
.week-ev .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.week-ev .info{flex:1;min-width:0}.week-ev .info .time{font-size:12px;font-weight:600}.week-ev .info .name{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.week-empty{padding:12px;text-align:center;color:var(--muted);font-size:12px;font-style:italic}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;padding:4px;background:var(--bg)}
.cal-head{text-align:center;font-size:11px;color:var(--muted);padding:8px 0;font-weight:600}
.cal-day{background:var(--card);min-height:70px;padding:4px;border-radius:4px;position:relative}
.cal-day.empty{background:transparent;min-height:0}.cal-day.today{outline:2px solid var(--accent);outline-offset:-1px}
.cal-day.holiday{background:#3b1a1a}.cal-num{font-size:11px;font-weight:600;margin-bottom:2px}
.cal-ev{font-size:9px;padding:2px 4px;margin-bottom:1px;border-radius:3px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.cal-holiday{font-size:9px;color:#f87171;font-style:italic}
.tab{display:none;padding:8px}.tab.active{display:block}
.aula-card{background:var(--card);border-radius:8px;padding:12px;margin-bottom:8px;border-left:4px solid var(--accent)}
.aula-card .data{font-size:12px;color:var(--muted)}.aula-card .disc{font-size:15px;font-weight:600;margin:4px 0}
.aula-card .turma{font-size:12px;color:var(--muted)}.aula-card .hora{font-size:13px;font-weight:500}
.aula-card .topico{font-size:12px;color:var(--muted);margin-top:4px;font-style:italic}
.badge{display:inline-block;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600}
.badge-r{background:#166534;color:#86efac}.badge-p{background:#1e3a5f;color:#93c5fd}
.badge-a{background:#713f12;color:#fde047}.badge-c{background:#7f1d1d;color:#fca5a5}
.turma-sec{margin-bottom:16px}.turma-title{font-size:14px;font-weight:700;padding:12px 8px;display:flex;justify-content:space-between;align-items:center}
.turma-title .hours{font-size:12px;color:var(--muted);font-weight:400}
.filter-bar{padding:8px;display:flex;gap:8px;flex-wrap:wrap}
.filter-bar select{background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-size:13px;flex:1}
.detail-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:100;display:none;align-items:flex-end}
.detail-overlay.show{display:flex}.detail-sheet{background:var(--card);width:100%;max-height:80vh;border-radius:16px 16px 0 0;padding:20px;overflow-y:auto}
.detail-sheet h3{font-size:16px;margin-bottom:12px}.detail-row{margin-bottom:10px}
.detail-row label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.detail-row p{font-size:14px;margin-top:2px}
.generated{text-align:center;font-size:11px;color:var(--muted);padding:20px}
</style></head><body>
<div class="header">
  <h1>PlanAula</h1>
  <p>${config.nome_professor || ''}${config.instituicao ? ' · ' + config.instituicao : ''}</p>
</div>
<div class="nav">
  <button class="active" onclick="showTab('calendario')">Calendário</button>
  <button onclick="showTab('lista')">Aulas</button>
  <button onclick="showTab('resumo')">Resumo</button>
</div>
<div id="calendario" class="tab active"></div>
<div id="lista" class="tab"></div>
<div id="resumo" class="tab"></div>
<div class="detail-overlay" id="overlay" onclick="if(event.target===this)fecharDetalhe()">
  <div class="detail-sheet" id="detail"></div>
</div>
<p class="generated">PlanAula · Gerado em ${new Date().toLocaleDateString('pt-PT')}</p>
<script>
const DADOS=${dadosJSON};
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_S=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
let mesAtual,anoAtual,vistaCal='mensal';
let semanaAtual;
const hoje=new Date();const hojeStr=hoje.toISOString().slice(0,10);
const datas=DADOS.aulas.map(a=>a.data).filter(Boolean).sort();
if(datas.length){const d=new Date(datas[0]);mesAtual=d.getUTCMonth();anoAtual=d.getUTCFullYear()}
else{mesAtual=hoje.getMonth();anoAtual=hoje.getFullYear()}
// Iniciar semana na segunda-feira da semana actual
function getSegunda(d){const dt=new Date(d);const day=dt.getDay();const diff=dt.getDate()-day+(day===0?-6:1);dt.setDate(diff);return dt}
semanaAtual=getSegunda(hoje);

const feriadosSet=new Set(DADOS.diasNaoLetivos.map(d=>d.data));
const feriadosMap={};DADOS.diasNaoLetivos.forEach(d=>{feriadosMap[d.data]=d.descricao});
function isDiaNaoLetivo(ds){
  if(feriadosSet.has(ds))return true;
  return DADOS.periodos.some(p=>ds>=p.data_inicio&&ds<=p.data_fim);
}
function getPeriodoDesc(ds){
  const p=DADOS.periodos.find(p=>ds>=p.data_inicio&&ds<=p.data_fim);
  return p?p.descricao:null;
}

function showTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>{if(b.textContent.toLowerCase().includes(id==='calendario'?'calendário':id==='lista'?'aulas':'resumo'))b.classList.add('active')});
}

function renderCalendario(){
  if(vistaCal==='semanal')return renderSemanal();
  const el=document.getElementById('calendario');
  const first=new Date(anoAtual,mesAtual,1);const dow=first.getDay();
  const days=new Date(anoAtual,mesAtual+1,0).getDate();
  const aulasDoMes=DADOS.aulas.filter(a=>{if(!a.data)return false;const d=new Date(a.data);return d.getUTCMonth()===mesAtual&&d.getUTCFullYear()===anoAtual});
  let h='<div class="month-nav"><button onclick="mudarMes(-1)">‹</button><span>'+MESES[mesAtual]+' '+anoAtual+'</span><button onclick="mudarMes(1)">›</button></div>';
  h+=vistaToggle();
  h+='<div class="cal-grid">';
  DIAS_S.forEach(d=>{h+='<div class="cal-head">'+d+'</div>'});
  for(let i=0;i<dow;i++)h+='<div class="cal-day empty"></div>';
  for(let d=1;d<=days;d++){
    const ds=anoAtual+'-'+String(mesAtual+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isToday=ds===hojeStr;const isHoliday=isDiaNaoLetivo(ds);
    const cls='cal-day'+(isToday?' today':'')+(isHoliday?' holiday':'');
    h+='<div class="'+cls+'"><div class="cal-num">'+d+'</div>';
    if(feriadosMap[ds])h+='<div class="cal-holiday">'+feriadosMap[ds]+'</div>';
    else if(isHoliday){const pd=getPeriodoDesc(ds);if(pd)h+='<div class="cal-holiday">'+pd+'</div>'}
    const aulasHoje=aulasDoMes.filter(a=>a.data===ds).sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));
    aulasHoje.forEach(a=>{h+='<div class="cal-ev" style="background:'+(a.turma_cor||'#3b82f6')+'" onclick="verDetalhe('+a.id+')">'+a.hora_inicio+' '+(a.disciplina_nome||'').substring(0,12)+'</div>'});
    h+='</div>';
  }
  h+='</div>';el.innerHTML=h;
}
function renderSemanal(){
  const el=document.getElementById('calendario');
  const seg=new Date(semanaAtual);
  const dom=new Date(seg);dom.setDate(dom.getDate()+6);
  const segStr=toDS(seg);const domStr=toDS(dom);
  let h='<div class="month-nav"><button onclick="mudarSemana(-1)">‹</button><span>'+segStr.split('-')[2]+'/'+segStr.split('-')[1]+' — '+domStr.split('-')[2]+'/'+domStr.split('-')[1]+' '+dom.getFullYear()+'</span><button onclick="mudarSemana(1)">›</button></div>';
  h+=vistaToggle();
  for(let i=0;i<7;i++){
    const dia=new Date(seg);dia.setDate(dia.getDate()+i);
    const ds=toDS(dia);const isToday=ds===hojeStr;const isHoliday=isDiaNaoLetivo(ds);
    const hdrCls='week-day-header'+(isToday?' today':'')+(isHoliday?' holiday':'');
    const aulasHoje=DADOS.aulas.filter(a=>a.data===ds).sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));
    h+='<div class="week-day"><div class="'+hdrCls+'"><span>'+DIAS_S[dia.getDay()]+', '+dia.getDate()+' '+MESES[dia.getMonth()]+'</span>';
    if(feriadosMap[ds])h+='<span style="font-size:11px;font-weight:400">'+feriadosMap[ds]+'</span>';
    else if(isHoliday){const pd=getPeriodoDesc(ds);if(pd)h+='<span style="font-size:11px;font-weight:400">'+pd+'</span>'}
    h+='</div>';
    if(aulasHoje.length===0){h+='<div class="week-empty">Sem aulas</div>'}
    else{aulasHoje.forEach(a=>{
      h+='<div class="week-ev" onclick="verDetalhe('+a.id+')"><div class="dot" style="background:'+(a.turma_cor||'#3b82f6')+'"></div><div class="info"><div class="time">'+a.hora_inicio+'–'+a.hora_fim+(a.sala?' · '+a.sala:'')+'</div><div class="name">'+(a.disciplina_nome||'')+' · '+(a.turma_nome||'')+'</div></div></div>';
    })}
    h+='</div>';
  }
  el.innerHTML=h;
}
function vistaToggle(){return '<div class="vista-toggle"><button class="'+(vistaCal==='mensal'?'active':'')+'" onclick="setVista(\\\'mensal\\\')">Mensal</button><button class="'+(vistaCal==='semanal'?'active':'')+'" onclick="setVista(\\\'semanal\\\')">Semanal</button></div>'}
function setVista(v){vistaCal=v;renderCalendario()}
function toDS(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function mudarMes(d){mesAtual+=d;if(mesAtual>11){mesAtual=0;anoAtual++}if(mesAtual<0){mesAtual=11;anoAtual--}renderCalendario()}
function mudarSemana(d){semanaAtual.setDate(semanaAtual.getDate()+d*7);renderCalendario()}

function renderLista(){
  const el=document.getElementById('lista');
  let h='<div class="filter-bar"><select id="fTurma" onchange="renderLista()"><option value="">Todas as turmas</option>';
  const turmasComAulas=[...new Set(DADOS.aulas.map(a=>a.turma_id))];
  turmasComAulas.forEach(tid=>{const t=DADOS.turmas.find(t=>t.id===tid);if(t)h+='<option value="'+tid+'">'+t.designacao+'</option>'});
  h+='</select><select id="fEstado" onchange="renderLista()"><option value="">Todos</option><option value="r">Realizadas</option><option value="p">Planeadas</option></select></div>';
  const fT=document.getElementById('fTurma')?.value||'';
  const fE=document.getElementById('fEstado')?.value||'';
  let aulas=DADOS.aulas.slice().sort((a,b)=>a.data.localeCompare(b.data)||a.hora_inicio.localeCompare(b.hora_inicio));
  if(fT)aulas=aulas.filter(a=>String(a.turma_id)===fT);
  if(fE==='r')aulas=aulas.filter(a=>a.estado!=='Adiada'&&a.estado!=='Cancelada'&&a.data<=hojeStr);
  if(fE==='p')aulas=aulas.filter(a=>a.estado!=='Adiada'&&a.estado!=='Cancelada'&&a.data>hojeStr);
  aulas.forEach(a=>{
    const passou=a.data<=hojeStr;const override=a.estado==='Adiada'||a.estado==='Cancelada';
    const estado=override?a.estado:passou?'Realizada':'Planeada';
    const bc=estado==='Realizada'?'badge-r':estado==='Planeada'?'badge-p':estado==='Adiada'?'badge-a':'badge-c';
    h+='<div class="aula-card" style="border-left-color:'+(a.turma_cor||'#3b82f6')+'" onclick="verDetalhe('+a.id+')">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center"><span class="data">'+formatData(a.data)+'</span><span class="badge '+bc+'">'+estado+'</span></div>';
    h+='<div class="disc">'+(a.disciplina_nome||'')+'</div>';
    h+='<div class="turma">'+(a.turma_nome||'')+' · <span class="hora">'+a.hora_inicio+'–'+a.hora_fim+'</span></div>';
    if(a.topico)h+='<div class="topico">'+a.topico+'</div>';
    h+='</div>'});
  el.innerHTML=h;
}

function renderResumo(){
  const el=document.getElementById('resumo');let h='';
  const turmasComAulas=[...new Set(DADOS.aulas.map(a=>a.turma_id))];
  turmasComAulas.forEach(tid=>{
    const t=DADOS.turmas.find(t=>t.id===tid);if(!t)return;
    const aulasT=DADOS.aulas.filter(a=>a.turma_id===tid);
    const totalH=aulasT.reduce((s,a)=>{const[hi,mi]=a.hora_inicio.split(':').map(Number);const[hf,mf]=a.hora_fim.split(':').map(Number);return s+(hf*60+mf-hi*60-mi)/60},0);
    const realizadas=aulasT.filter(a=>a.data<=hojeStr&&a.estado!=='Adiada'&&a.estado!=='Cancelada').length;
    const pct=t.carga_horaria?Math.round(totalH/t.carga_horaria*100):0;
    h+='<div class="turma-sec"><div class="turma-title" style="border-left:4px solid '+(t.cor||'#3b82f6')+';padding-left:12px">';
    h+='<span>'+(t.designacao||'')+'<br><span style="font-size:12px;font-weight:400;color:var(--muted)">'+(aulasT[0]?.disciplina_nome||'')+'</span></span>';
    h+='<span class="hours">'+totalH.toFixed(0)+'h / '+(t.carga_horaria||'?')+'h</span></div>';
    h+='<div style="padding:0 12px 8px"><div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div style="background:'+(t.cor||'#3b82f6')+';height:100%;width:'+Math.min(pct,100)+'%"></div></div>';
    h+='<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px"><span>'+realizadas+' realizadas / '+aulasT.length+' total</span><span>'+pct+'%</span></div></div></div>'});
  el.innerHTML=h;
}

function verDetalhe(id){
  const a=DADOS.aulas.find(x=>x.id===id);if(!a)return;
  const passou=a.data<=hojeStr;const override=a.estado==='Adiada'||a.estado==='Cancelada';
  const estado=override?a.estado:passou?'Realizada':'Planeada';
  let h='<h3>'+(a.disciplina_nome||'Aula')+'</h3>';
  h+=r('Data',formatData(a.data));h+=r('Horário',a.hora_inicio+'–'+a.hora_fim+(a.sala?' · Sala '+a.sala:''));
  h+=r('Turma',a.turma_nome||'');h+=r('Estado',estado);
  if(a.numero)h+=r('Aula nº',''+a.numero);if(a.modulo_nome)h+=r('Módulo',a.modulo_nome);
  if(a.topico)h+=r('Tópico',a.topico);if(a.objetivos)h+=r('Objetivos',a.objetivos);
  if(a.conteudos)h+=r('Conteúdos',a.conteudos);if(a.atividades)h+=r('Atividades',a.atividades);
  if(a.recursos)h+=r('Recursos',a.recursos);if(a.avaliacao)h+=r('Avaliação',a.avaliacao);
  if(a.notas)h+=r('Notas',a.notas);
  h+='<button onclick="fecharDetalhe()" style="width:100%;padding:12px;margin-top:16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Fechar</button>';
  document.getElementById('detail').innerHTML=h;document.getElementById('overlay').classList.add('show');
}
function fecharDetalhe(){document.getElementById('overlay').classList.remove('show')}
function r(l,v){return '<div class="detail-row"><label>'+l+'</label><p>'+v+'</p></div>'}
function formatData(ds){if(!ds)return'';const[y,m,d]=ds.split('-');return d+'/'+m+'/'+y+' ('+DIAS_S[new Date(ds).getUTCDay()]+')'}

renderCalendario();renderLista();renderResumo();
<\/script></body></html>`
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

  // ─── Dashboard ──────────────────────────────────────────────────────────
  ipcMain.handle('dashboard:stats', async () => {
    try { return { success: true, data: models.obterDashboardStats() } }
    catch (e) { return { success: false, error: e.message } }
  })

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

  ipcMain.handle('modulos:sincronizarUFCD', async (_, disciplina_id) => {
    try { return { success: true, data: models.sincronizarModulosUFCD(disciplina_id) } }
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

  ipcMain.handle('pesquisa:global', async (_, query) => {
    try { return { success: true, data: models.pesquisarGlobal(query) } }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('aulas:eliminarDaTurma', async (_, turma_id) => {
    try { return { success: true, data: models.eliminarAulasDaTurma(turma_id) } }
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
  ipcMain.handle('export:relatorioTurma', async (_, { turma, horarios, aulas, config }) => {
    try {
      const html = gerarHTMLRelatorioTurma(turma, horarios, aulas, config || {})
      const nome = `relatorio-${(turma.designacao || 'turma').replace(/\s+/g, '-')}-${(turma.disciplina_nome || '').replace(/\s+/g, '-')}.pdf`
      return await imprimirPDF(html, nome)
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('export:aulaPlano', async (_, { aula, config }) => {
    try {
      // Tentar usar o template melhorado com contexto
      const contexto = models.obterContextoExportTurma(aula.turma_id)
      if (contexto) {
        const aulaCtx = contexto.aulas.find(a => a.id === aula.id)
        if (aulaCtx) {
          const html = gerarHTMLPlanos({ ...contexto, aulas: [aulaCtx] }, config || {})
          const nomeFicheiro = `plano-${(aula.disciplina_nome || 'aula').replace(/\s+/g, '-')}-${aula.data || 'sem-data'}.pdf`
          return await imprimirPDF(html, nomeFicheiro)
        }
      }
      // Fallback para template antigo
      const html = gerarHTMLPlanoAula(aula, config || {})
      const nomeFicheiro = `plano-${(aula.disciplina_nome || 'aula').replace(/\s+/g, '-')}-${aula.data || 'sem-data'}.pdf`
      return await imprimirPDF(html, nomeFicheiro)
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('export:turmaPlanos', async (_, { turma_id }) => {
    try {
      const contexto = models.obterContextoExportTurma(turma_id)
      if (!contexto || contexto.aulas.length === 0) return { success: false, error: 'Sem aulas para exportar' }
      const config = models.obterTodasConfiguracoes()
      const html = gerarHTMLPlanos(contexto, config)
      const nomeFicheiro = `planos-${contexto.turma.designacao}-${(contexto.turma.disciplina_nome || '').replace(/\s+/g, '-')}.pdf`
      return await imprimirPDF(html, nomeFicheiro)
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('export:calendarioHTML', async (_, { html, nome }) => {
    try { return await imprimirPDF(html, nome) }
    catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('export:mobileHTML', async () => {
    try {
      const aulas = models.listarAulas({})
      const turmas = models.listarTurmas()
      const config = models.obterTodasConfiguracoes()
      const diasNaoLetivos = models.listarDiasNaoLetivos()
      const periodos = getDb().prepare('SELECT * FROM periodos_nao_letivos').all()

      const { filePath } = await dialog.showSaveDialog({
        title: 'Exportar HTML Mobile',
        defaultPath: `PlanAula-mobile.html`,
        filters: [{ name: 'HTML', extensions: ['html'] }]
      })
      if (!filePath) return { success: false, cancelled: true }

      const dados = JSON.stringify({ aulas, turmas, config, diasNaoLetivos, periodos })
      const html = gerarHTMLMobile(dados, config)
      fs.writeFileSync(filePath, html, 'utf-8')
      shell.showItemInFolder(filePath)
      return { success: true, path: filePath }
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

  // ─── Professor Cargos ─────────────────────────────────────────────────────
  ipcMain.handle('professorCargos:listar', async () => {
    try { return { success: true, data: models.listarProfessorCargos() } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('professorCargos:criar', async (_, dados) => {
    try { return { success: true, data: models.criarProfessorCargo(dados) } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('professorCargos:editar', async (_, { id, dados }) => {
    try { return { success: true, data: models.editarProfessorCargo(id, dados) } } catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('professorCargos:eliminar', async (_, id) => {
    try { return { success: true, data: models.eliminarProfessorCargo(id) } } catch (e) { return { success: false, error: e.message } }
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

      return { success: true }
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('backup:reiniciar', () => {
    app.relaunch()
    app.exit(0)
  })
}
