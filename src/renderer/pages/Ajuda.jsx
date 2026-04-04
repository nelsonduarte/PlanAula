import React, { useState } from 'react'

function Section({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
      >
        <span className="text-2xl">{icon}</span>
        <span className="flex-1 font-semibold text-gray-800 dark:text-gray-100">{title}</span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
      <span>{children}</span>
    </div>
  )
}

function Tip({ children }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
      <span className="flex-shrink-0">💡</span>
      <span>{children}</span>
    </div>
  )
}

function Note({ children }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
      <span className="flex-shrink-0">ℹ️</span>
      <span>{children}</span>
    </div>
  )
}

export default function Ajuda() {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="page-title">Ajuda</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Guia de utilização do PlanAula — como organizar as suas aulas, horários e finanças.
        </p>
      </div>

      {/* Introdução */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex gap-4">
          <span className="text-4xl">🎓</span>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">O que é o PlanAula?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              O PlanAula é um planeador de aulas para professores e formadores. Permite gerir disciplinas, UFCDs, turmas, planos de aula,
              horários, sessões de formação e acompanhar a situação financeira por instituição.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              <strong>Ensino Superior:</strong> Instituições → Cursos → Disciplinas → Turmas → Horários → Aulas (geração automática)
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              <strong>Formação Profissional:</strong> Instituições → Cursos → UFCDs → Turmas → Sessões (datas concretas)
            </p>
          </div>
        </div>
      </div>

      <Section icon="⚙️" title="Primeiros Passos — Definições" defaultOpen={true}>
        <p>Antes de começar, configure o seu perfil em <strong>Definições</strong>:</p>
        <div className="space-y-2">
          <Step n="1">Introduza o seu <strong>nome</strong> e o <strong>ano lectivo actual</strong>.</Step>
          <Step n="2">Em <strong>Instituições e Cargos</strong>, adicione cada instituição onde lecciona (universidades, politécnicos, centros IEFP, etc.) com o respectivo cargo e departamento.</Step>
          <Step n="3">Configure a <strong>situação fiscal</strong>: taxa de IVA (ou isenção) e taxa de retenção de IRS.</Step>
          <Step n="4">Em <strong>Dias Não Lectivos</strong>, importe os feriados nacionais e adicione interrupções lectivas. Estes dias são excluídos da geração automática de aulas.</Step>
        </div>
        <Tip>Os feriados nacionais podem ser importados automaticamente com um clique — basta seleccionar o ano.</Tip>
      </Section>

      <Section icon="🏫" title="Instituições e Cursos">
        <p>A organização parte das <strong>Instituições</strong> e dos <strong>Cursos</strong> que nelas existem.</p>
        <div className="space-y-2">
          <Step n="1">Aceda a <strong>Cursos</strong> no menu lateral.</Step>
          <Step n="2">Crie primeiro a instituição (separador "Instituições") e depois os cursos associados.</Step>
          <Step n="3">Cada curso tem nome, tipo (semestral, anual ou formação) e valor/hora opcional.</Step>
        </div>
        <Note>Uma instituição pode ter vários cursos. Para formação IEFP, crie um curso por acção (ex: "EFA - Técnico de Informática", "CET Cibersegurança").</Note>
      </Section>

      <Section icon="📚" title="Disciplinas e UFCDs">
        <p>As <strong>Disciplinas</strong> representam as unidades curriculares do ensino superior. As <strong>UFCDs</strong> são as unidades de formação profissional.</p>
        <div className="space-y-2">
          <Step n="1">Crie uma disciplina/UFCD com nome, código, área científica e carga horária.</Step>
          <Step n="2">Associe a disciplina a um curso.</Step>
          <Step n="3">Opcionalmente, crie <strong>Módulos</strong> dentro de cada disciplina — subdivisões temáticas que podem ser associadas a aulas individuais.</Step>
        </div>
        <Tip>Na importação via Excel, as UFCDs são criadas automaticamente a partir da sheet "UFCDs" do template de formação.</Tip>
      </Section>

      <Section icon="👥" title="Turmas e Horários">
        <p>Cada disciplina/UFCD pode ter uma ou várias <strong>Turmas</strong>.</p>
        <div className="space-y-2">
          <Step n="1">Crie a turma associada a uma disciplina. Defina designação, ano, cor e valor/hora.</Step>
          <Step n="2">Defina a <strong>carga horária</strong> (horas totais) e as datas de início/fim.</Step>
          <Step n="3"><strong>Ensino Superior:</strong> adicione <strong>Horários semanais</strong> (dia da semana, hora, sala). As aulas são geradas automaticamente.</Step>
          <Step n="4"><strong>Formação:</strong> as sessões são importadas directamente via Excel com datas e horas concretas — não é necessário definir horários semanais.</Step>
        </div>
        <Note>Na página de Turmas, as turmas com várias UFCDs (formação) aparecem agrupadas. Turmas com uma disciplina aparecem lado a lado.</Note>
      </Section>

      <Section icon="📝" title="Aulas e Planos de Aula">
        <p>As <strong>Aulas</strong> são o núcleo do PlanAula. Cada aula tem um plano detalhado.</p>
        <div className="space-y-2">
          <Step n="1">As aulas podem ser geradas automaticamente (ensino superior) ou importadas via sessões (formação).</Step>
          <Step n="2">Cada aula tem: tópico, módulo, objectivos, conteúdos, actividades, recursos, avaliação e notas.</Step>
          <Step n="3">O estado é calculado automaticamente: <em>Planeada</em> (futura), <em>Realizada</em> (passada), <em>Adiada</em> ou <em>Cancelada</em>.</Step>
          <Step n="4">Filtre por turma, estado ou datas. O total de horas é exibido junto ao número de aulas.</Step>
          <Step n="5">Exporte o plano de qualquer aula em <strong>PDF</strong>.</Step>
        </div>
        <Note>Se definir uma <strong>Data de Avaliação</strong>, a aplicação notifica-o no dia anterior ao abrir.</Note>
      </Section>

      <Section icon="📅" title="Calendário">
        <p>O <strong>Calendário</strong> mostra todas as aulas de forma visual:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Mensal</strong> — visão geral do mês, com aulas por cor de turma.</li>
          <li><strong>Semanal</strong> — detalhe da semana com horários e tópicos.</li>
          <li><strong>Anual</strong> — 12 mini-calendários com pontos de cor.</li>
        </ul>
        <div className="space-y-2 mt-2">
          <Step n="1"><strong>Imprimir</strong> — exporta a vista actual em PDF.</Step>
          <Step n="2"><strong>Mobile</strong> — exporta um ficheiro HTML interactivo para consultar no telemóvel (offline). Inclui calendário mensal/semanal, lista de aulas e resumo por turma.</Step>
        </div>
        <Tip>O ficheiro HTML mobile pode ser enviado por WhatsApp, email ou guardado no telemóvel — funciona sem internet.</Tip>
      </Section>

      <Section icon="💶" title="Financeiro">
        <p>O módulo <strong>Financeiro</strong> calcula automaticamente os rendimentos por instituição.</p>
        <div className="space-y-2">
          <Step n="1">Vista mensal: horas dadas, valor bruto, IVA e IRS por disciplina/UFCD.</Step>
          <Step n="2">Vista anual: totais acumulados por mês.</Step>
          <Step n="3"><strong>Outros Rendimentos</strong> — registe receitas extra (consultoria, etc.).</Step>
          <Step n="4">Exporte relatórios em PDF por mês ou anual.</Step>
        </div>
        <Note>Os cálculos usam as taxas fiscais de Definições e os valores/hora definidos em cada turma.</Note>
      </Section>

      <Section icon="📊" title="Estatísticas">
        <p>A página de <strong>Estatísticas</strong> oferece uma visão global:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>KPIs:</strong> total de horas, rendimento líquido, média mensal, turmas activas.</li>
          <li><strong>Evolução Mensal:</strong> gráfico de horas e rendimento ao longo do ano.</li>
          <li><strong>Rendimento por Instituição:</strong> barras empilhadas por mês.</li>
          <li><strong>Horas por Instituição:</strong> distribuição percentual.</li>
        </ul>
        <Tip>Filtre por ano para comparar diferentes períodos.</Tip>
      </Section>

      <Section icon="📥" title="Importar via Excel">
        <p>A página <strong>Importar</strong> permite carregar dados em massa. Existem dois templates:</p>
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Ensino Superior</p>
            <p className="text-blue-700 dark:text-blue-400 text-xs">Sheets: Configurações, Instituições, Períodos Não Letivos, Cursos, Disciplinas, Módulos, Turmas, Horários.</p>
            <p className="text-blue-700 dark:text-blue-400 text-xs mt-1">As aulas são geradas automaticamente a partir dos horários semanais.</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <p className="font-semibold text-orange-800 dark:text-orange-300 mb-1">Formação Profissional (IEFP)</p>
            <p className="text-orange-700 dark:text-orange-400 text-xs">Sheets: Instituições, Cursos, UFCDs, Turmas, Sessões.</p>
            <p className="text-orange-700 dark:text-orange-400 text-xs mt-1">Cada linha da sheet Sessões é uma aula concreta com data e hora do cronograma.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Step n="1">Descarregue o template adequado (botão azul ou laranja).</Step>
          <Step n="2">Preencha as folhas na ordem indicada.</Step>
          <Step n="3">Carregue o ficheiro e a app detecta automaticamente o tipo de template.</Step>
        </div>
        <Note>A reimportação limpa horários e aulas existentes antes de regenerar — sem duplicados.</Note>
        <Tip>Para formação, preencha a sheet Sessões com as datas e horas do cronograma recebido — cada linha corresponde a uma sessão concreta.</Tip>
      </Section>

      <Section icon="💾" title="Cópia de Segurança">
        <p>Em <strong>Definições → Cópia de Segurança</strong> pode proteger os seus dados:</p>
        <div className="space-y-2">
          <Step n="1"><strong>Exportar Backup</strong> — guarda um ficheiro <code>.db</code> com todos os dados.</Step>
          <Step n="2"><strong>Restaurar Backup</strong> — carrega um ficheiro <code>.db</code> previamente exportado. <em>Atenção: substitui todos os dados actuais.</em></Step>
        </div>
        <Tip>Faça backup regularmente e antes de qualquer actualização da aplicação.</Tip>
      </Section>

      <Section icon="🔍" title="Pesquisa Global">
        <p>Use <strong>Ctrl+K</strong> para abrir a pesquisa global e encontrar rapidamente qualquer aula, turma, disciplina ou UFCD.</p>
      </Section>
    </div>
  )
}
