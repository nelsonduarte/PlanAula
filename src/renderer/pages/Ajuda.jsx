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
              O PlanAula é um planeador de aulas para professores. Permite gerir disciplinas, turmas, planos de aula,
              horários e acompanhar a situação financeira das suas actividades lectivas.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              <strong>Fluxo recomendado:</strong> Instituições → Cursos → Disciplinas → Turmas → Horários → Aulas
            </p>
          </div>
        </div>
      </div>

      <Section icon="⚙️" title="Primeiros Passos — Definições" defaultOpen={true}>
        <p>Antes de começar, configure o seu perfil em <strong>Definições</strong>:</p>
        <div className="space-y-2">
          <Step n="1">Introduza o seu <strong>nome</strong> e o <strong>ano lectivo actual</strong>.</Step>
          <Step n="2">Em <strong>Instituições e Cargos</strong>, adicione cada instituição onde lecciona com o respectivo cargo e departamento. Pode ter múltiplas instituições e marcar as activas.</Step>
          <Step n="3">Configure a <strong>situação fiscal</strong>: taxa de IVA (ou isenção) e taxa de retenção de IRS.</Step>
          <Step n="4">Em <strong>Dias Não Lectivos</strong>, importe os feriados nacionais e adicione interrupções lectivas do seu calendário escolar. Estes dias são excluídos da geração automática de aulas.</Step>
        </div>
        <Tip>Os feriados nacionais podem ser importados automaticamente com um clique — basta seleccionar o ano e clicar em "Importar Feriados Nacionais".</Tip>
      </Section>

      <Section icon="🏫" title="Instituições e Cursos">
        <p>A organização parte das <strong>Instituições</strong> (universidades, escolas, etc.) e dos <strong>Cursos</strong> que nelas existem.</p>
        <div className="space-y-2">
          <Step n="1">Aceda a <strong>Cursos</strong> no menu lateral.</Step>
          <Step n="2">Crie primeiro a instituição (separador "Instituições") e depois os cursos associados a ela.</Step>
          <Step n="3">Cada curso tem nome, tipo (semestral/anual), ano lectivo e valor/hora opcional.</Step>
        </div>
        <Note>As instituições criadas aqui ficam disponíveis para associar às disciplinas, turmas e ao seu perfil em Definições.</Note>
      </Section>

      <Section icon="📚" title="Disciplinas">
        <p>As <strong>Disciplinas</strong> representam as unidades curriculares que lecciona.</p>
        <div className="space-y-2">
          <Step n="1">Crie uma disciplina com nome, código, área científica e tipo (teórica, prática ou mista).</Step>
          <Step n="2">Associe a disciplina a um curso (opcional).</Step>
          <Step n="3">Dentro de cada disciplina pode criar <strong>Módulos</strong> — subdivisões temáticas com duração e objectivos próprios. Os módulos podem ser associados às aulas individualmente.</Step>
        </div>
        <Tip>A carga horária é definida ao nível da turma, não da disciplina — a mesma disciplina pode ter cargas diferentes em turmas distintas.</Tip>
      </Section>

      <Section icon="👥" title="Turmas e Horários">
        <p>Cada disciplina pode ter várias <strong>Turmas</strong> (T1, T2, PL1…), cada uma com o seu horário.</p>
        <div className="space-y-2">
          <Step n="1">Crie a turma associada a uma disciplina. Defina designação, ano lectivo, semestre e cor (para distinguir no calendário).</Step>
          <Step n="2">Defina a <strong>carga horária</strong> (horas totais) e o <strong>valor/hora</strong> para o cálculo financeiro.</Step>
          <Step n="3">Defina as datas de início e fim da turma.</Step>
          <Step n="4">Adicione os <strong>Horários</strong>: dia da semana, hora de início e fim, e sala. Uma turma pode ter vários slots semanais.</Step>
        </div>
        <Tip>Com os horários e datas definidos, pode gerar todas as aulas automaticamente — a app cria uma aula por cada slot semanal, excluindo feriados e dias não lectivos.</Tip>
      </Section>

      <Section icon="📝" title="Aulas e Planos de Aula">
        <p>As <strong>Aulas</strong> são o núcleo do PlanAula. Cada aula tem um plano detalhado.</p>
        <div className="space-y-2">
          <Step n="1">As aulas podem ser geradas automaticamente (a partir dos horários da turma) ou criadas manualmente.</Step>
          <Step n="2">Cada aula tem separadores: <strong>Conteúdos</strong> (tópico, módulo, objectivos, conteúdos, actividades, recursos), <strong>Avaliação</strong> (instrumentos, critérios e data de avaliação) e <strong>Notas</strong>.</Step>
          <Step n="3">O estado da aula é calculado automaticamente: <em>Planeada</em> (futura), <em>Realizada</em> (passada), <em>Adiada</em> ou <em>Cancelada</em>.</Step>
          <Step n="4">Pode exportar o plano de qualquer aula em <strong>PDF</strong> clicando no ícone de impressão.</Step>
        </div>
        <Note>
          Se definir uma <strong>Data de Avaliação</strong> numa aula, a aplicação irá notificá-lo no dia anterior ao abrir.
        </Note>
        <Tip>Use os filtros no topo da lista de aulas para encontrar rapidamente aulas por turma, estado ou período de datas.</Tip>
      </Section>

      <Section icon="📅" title="Calendário">
        <p>O <strong>Calendário</strong> mostra todas as aulas de forma visual em três vistas:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Mensal</strong> — visão geral do mês, com as aulas de cada dia por cor de turma.</li>
          <li><strong>Semanal</strong> — detalhe da semana actual, com horários e tópicos.</li>
          <li><strong>Anual</strong> — 12 mini-calendários com pontos de cor a indicar dias com aulas. Clique num mês para navegar até ele.</li>
        </ul>
        <Tip>Use o botão <strong>Imprimir</strong> (ícone da impressora) para exportar a vista actual em PDF.</Tip>
      </Section>

      <Section icon="💶" title="Financeiro">
        <p>O módulo <strong>Financeiro</strong> calcula automaticamente os seus rendimentos de docência.</p>
        <div className="space-y-2">
          <Step n="1">Seleccione o ano e mês para ver o resumo mensal: horas dadas, valor bruto, IVA e IRS.</Step>
          <Step n="2">A vista anual mostra todos os meses do ano com totais acumulados.</Step>
          <Step n="3">Em <strong>Outros Rendimentos</strong> pode registar receitas que não são aulas (consultoria, formações, etc.).</Step>
          <Step n="4">Exporte relatórios em PDF para cada mês ou para o ano inteiro.</Step>
        </div>
        <Note>Os cálculos usam as taxas configuradas em Definições → Configuração Fiscal e os valores/hora definidos em cada turma.</Note>
      </Section>

      <Section icon="📊" title="Estatísticas">
        <p>A página de <strong>Estatísticas</strong> dá-lhe uma visão global do ano lectivo:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Total de aulas planeadas vs. realizadas e taxa de conclusão.</li>
          <li>Distribuição de aulas por disciplina.</li>
          <li>Evolução mensal do número de aulas ao longo do ano.</li>
        </ul>
        <Tip>Filtre por ano lectivo para comparar diferentes anos.</Tip>
      </Section>

      <Section icon="📥" title="Importar via Excel">
        <p>A página <strong>Importar</strong> permite carregar dados em massa a partir de um ficheiro Excel (.xlsx).</p>
        <div className="space-y-2">
          <Step n="1">Descarregue o <strong>template Excel</strong> clicando em "Descarregar Template".</Step>
          <Step n="2">Preencha as folhas na ordem indicada: Configurações, Instituições, Períodos Não Letivos, Cursos, Disciplinas, Módulos, Turmas, Horários.</Step>
          <Step n="3">Carregue o ficheiro preenchido e clique em <strong>Importar</strong>.</Step>
        </div>
        <Note>Após a importação, as aulas são geradas automaticamente para todas as turmas que tiverem horários e datas de início/fim definidos.</Note>
        <Tip>Use o template para configurar uma turma nova de raiz de forma rápida — é mais eficiente do que criar tudo manualmente.</Tip>
      </Section>

      <Section icon="💾" title="Cópia de Segurança">
        <p>Em <strong>Definições → Cópia de Segurança</strong> pode proteger os seus dados:</p>
        <div className="space-y-2">
          <Step n="1"><strong>Exportar Backup</strong> — guarda um ficheiro <code>.db</code> com todos os dados.</Step>
          <Step n="2"><strong>Restaurar Backup</strong> — carrega um ficheiro <code>.db</code> previamente exportado. <em>Atenção: substitui todos os dados actuais.</em></Step>
        </div>
        <Tip>Faça backup regularmente e antes de qualquer actualização da aplicação.</Tip>
      </Section>
    </div>
  )
}
