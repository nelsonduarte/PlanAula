const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtData(ds) {
  if (!ds) return ''
  const d = new Date(ds + 'T12:00:00')
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDataCurta(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-')
  return `${d}/${m}/${y}`
}

function secao(titulo, conteudo) {
  if (!conteudo) return ''
  return `<div class="secao"><div class="secao-titulo">${titulo}</div><div class="secao-corpo">${conteudo.replace(/\n/g, '<br>')}</div></div>`
}

const CSS_BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1f2937; background: white; }
  .page { padding: 24px 32px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .cabecalho { border-bottom: 3px solid var(--cor-turma, #2563eb); padding-bottom: 12px; margin-bottom: 16px; }
  .cabecalho .inst { font-size: 11pt; font-weight: 700; color: #111827; }
  .cabecalho .curso { font-size: 9pt; color: #6b7280; margin-top: 2px; }
  .cabecalho .titulo { font-size: 14pt; font-weight: 700; color: #111827; margin-top: 8px; }
  .cabecalho .subtitulo { font-size: 11pt; color: #4b5563; margin-top: 2px; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px 16px; margin-bottom: 16px; background: #f9fafb; border-radius: 6px; padding: 10px 12px; }
  .meta-item label { font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; display: block; }
  .meta-item span { font-weight: 600; color: #111827; font-size: 10pt; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 8pt; font-weight: 600; color: white; }
  .secao { margin-bottom: 12px; }
  .secao-titulo { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 6px; }
  .secao-corpo { font-size: 10pt; line-height: 1.5; color: #374151; }
  .rodape { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 8pt; color: #9ca3af; display: flex; justify-content: space-between; }
  .assinaturas { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .assinatura { text-align: center; }
  .assinatura .linha { border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 4px; font-size: 9pt; color: #6b7280; }
  .progresso { margin-bottom: 16px; }
  .progresso-bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-top: 4px; }
  .progresso-fill { height: 100%; border-radius: 3px; }
  .progresso-text { display: flex; justify-content: space-between; font-size: 8pt; color: #6b7280; margin-top: 2px; }
`

function estadoCor(estado) {
  const map = { Realizada: '#16a34a', Planeada: '#2563eb', Adiada: '#ca8a04', Cancelada: '#dc2626' }
  return map[estado] || '#2563eb'
}

/**
 * Template IEFP — formato DTP (Dossier Técnico-Pedagógico)
 */
export function templateIEFP(aula, turma, config) {
  const pct = turma.carga_horaria > 0 ? Math.min(100, (aula.horasAcumuladas / turma.carga_horaria) * 100) : 0

  return `<div class="page" style="--cor-turma: ${turma.cor || '#2563eb'}">
  <div class="cabecalho">
    <div class="inst">${turma.instituicao_nome || config.instituicao || 'IEFP'}</div>
    <div class="curso">${turma.curso_nome || ''} — Ação: ${turma.designacao}</div>
    <div class="titulo">Plano de Sessão</div>
    <div class="subtitulo">UFCD ${turma.disciplina_codigo || ''} — ${turma.disciplina_nome || ''}</div>
  </div>

  <div class="meta">
    <div class="meta-item"><label>Sessão</label><span>${aula.sequencia} / ${aula.totalAulas}</span></div>
    <div class="meta-item"><label>Data</label><span>${fmtDataCurta(aula.data)}</span></div>
    <div class="meta-item"><label>Horário</label><span>${aula.hora_inicio || ''} – ${aula.hora_fim || ''}</span></div>
    <div class="meta-item"><label>Duração</label><span>${aula.duracao}h</span></div>
    <div class="meta-item"><label>Sala</label><span>${aula.sala || '—'}</span></div>
    <div class="meta-item"><label>Horas Acumuladas</label><span>${aula.horasAcumuladas}h / ${turma.carga_horaria || '?'}h</span></div>
  </div>

  <div class="progresso">
    <div class="progresso-bar"><div class="progresso-fill" style="width:${pct}%;background:${turma.cor || '#2563eb'}"></div></div>
    <div class="progresso-text"><span>Progresso da UFCD</span><span>${pct.toFixed(0)}%</span></div>
  </div>

  ${aula.topico ? `<div class="secao"><div class="secao-titulo">Tema / Sumário</div><div class="secao-corpo" style="font-weight:600">${aula.topico}</div></div>` : `<div class="secao"><div class="secao-titulo">Tema / Sumário</div><div class="secao-corpo" style="color:#9ca3af;font-style:italic">A preencher</div></div>`}
  ${secao('Objetivos', aula.objetivos)}
  ${secao('Conteúdos', aula.conteudos)}
  ${secao('Atividades / Estratégias', aula.atividades)}
  ${secao('Recursos', aula.recursos)}
  ${secao('Avaliação', aula.avaliacao)}
  ${secao('Observações', aula.notas)}

  <div class="assinaturas">
    <div class="assinatura"><div class="linha">O/A Formador/a<br>${config.nome_professor || ''}</div></div>
    <div class="assinatura"><div class="linha">O/A Coordenador/a</div></div>
  </div>

  <div class="rodape">
    <span>${turma.instituicao_nome || ''}</span>
    <span>PlanAula · ${new Date().toLocaleDateString('pt-PT')}</span>
  </div>
</div>`
}

/**
 * Template ISLA — formato académico (Ensino Superior)
 */
export function templateISLA(aula, turma, config) {
  return `<div class="page" style="--cor-turma: ${turma.cor || '#2563eb'}">
  <div class="cabecalho">
    <div class="inst">${turma.instituicao_nome || config.instituicao || ''}</div>
    ${config.departamento ? `<div class="curso">${config.departamento}</div>` : ''}
    <div class="titulo">Plano de Aula</div>
    <div class="subtitulo">${turma.disciplina_nome || ''} — ${turma.designacao}${turma.semestre ? ` · ${turma.semestre}º Semestre` : ''}</div>
  </div>

  <div class="meta">
    ${aula.numero != null ? `<div class="meta-item"><label>Aula nº</label><span>${aula.numero}</span></div>` : ''}
    <div class="meta-item"><label>Data</label><span>${fmtData(aula.data)}</span></div>
    <div class="meta-item"><label>Horário</label><span>${aula.hora_inicio || ''} – ${aula.hora_fim || ''}</span></div>
    ${aula.sala ? `<div class="meta-item"><label>Sala</label><span>${aula.sala}</span></div>` : ''}
    ${aula.modulo_nome ? `<div class="meta-item"><label>Módulo</label><span>${aula.modulo_nome}</span></div>` : ''}
    <div class="meta-item"><label>Estado</label><span class="badge" style="background:${estadoCor(aula.estado)}">${aula.estado || ''}</span></div>
  </div>

  ${aula.topico ? `<div class="secao"><div class="secao-titulo">Tópico</div><div class="secao-corpo" style="font-size:11pt;font-weight:600">${aula.topico}</div></div>` : ''}
  ${secao('Objetivos', aula.objetivos)}
  ${secao('Conteúdos', aula.conteudos)}
  ${secao('Atividades', aula.atividades)}
  ${secao('Recursos', aula.recursos)}
  ${secao('Avaliação', aula.avaliacao)}
  ${secao('Notas', aula.notas)}

  <div class="rodape">
    <span>${config.nome_professor || ''}</span>
    <span>${turma.disciplina_nome} · ${fmtDataCurta(aula.data)}</span>
  </div>
</div>`
}

/**
 * Gera HTML completo para um ou vários planos de aula
 */
export function gerarHTMLPlanos(contexto, config) {
  const { turma, aulas, isFormacao } = contexto
  const templateFn = isFormacao ? templateIEFP : templateISLA
  const paginas = aulas.map(a => templateFn(a, turma, config)).join('\n')

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<style>${CSS_BASE}</style></head><body>
${paginas}
</body></html>`
}
