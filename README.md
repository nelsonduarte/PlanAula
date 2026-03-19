# PlanAula

**PlanAula** é uma aplicação desktop para professores planearem, gerirem e acompanharem as suas aulas. Desenvolvida com Electron, React e SQLite — funciona completamente offline, sem necessidade de conta ou ligação à internet.

---

## Funcionalidades

### Gestão Académica
- **Instituições** — regista escolas, universidades ou centros de formação
- **Cursos** — organiza cursos por instituição, tipo (semestral, anual, formação, livre) e ano letivo
- **Disciplinas** — associa disciplinas a cursos, com código, área científica, carga horária e ECTS
- **Módulos** — divide cada disciplina em módulos ordenados com objetivos e duração
- **Turmas** — cria turmas por disciplina com sala, semestre e cor identificativa

### Planeamento de Aulas
- **Aulas** — regista cada aula com tópico, objetivos, conteúdos, atividades, recursos e avaliação
- **Horários** — define horários semanais por turma
- **Calendário** — vista mensal interativa com todas as aulas e dias não letivos
- **Dias não letivos** — marca feriados, interrupções letivas e outros eventos

### Financeiro
- **Valores/hora** — define valor por hora a nível de curso, disciplina ou turma
- **Configuração fiscal** — taxa de IVA, taxa de retenção de IRS por ano
- **Relatórios** — cálculo automático de remunerações com base nas aulas registadas

### Análise e Relatórios
- **Dashboard** — resumo rápido do estado atual: aulas planeadas, realizadas, turmas ativas
- **Estatísticas** — gráficos de carga horária, progresso por disciplina e distribuição de aulas
- **Exportação PDF** — gera relatórios de aulas e planos de aula em PDF

### Sistema
- **Backup e restauro** — exporta e importa a base de dados SQLite
- **Definições** — configura nome do professor, instituição padrão, departamento e ano letivo atual
- **Tema** — suporte a tema claro e escuro

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 29 |
| Build system | electron-vite 2 |
| Frontend | React 18 + React Router |
| Base de dados | SQLite (better-sqlite3) |
| Estilos | Tailwind CSS 3 |
| Gráficos | Recharts |

---

## Instalação e Execução

### Pré-requisitos
- [Node.js](https://nodejs.org/) 18 ou superior
- npm

### Instalar dependências

```bash
npm install
```

### Modo de desenvolvimento

```bash
npm run dev
```

Inicia o Vite (renderer) e o Electron em simultâneo com hot-reload.

### Executar a app compilada

```bash
npm run run:app
```

Executa a versão já compilada em `dist/` sem reconstruir.

### Build de produção

```bash
npm run build
```

Gera o instalador na pasta `release/`. No Windows produz uma pasta executável (`win-unpacked`).

---

## Estrutura do Projeto

```
src/
├── main/
│   ├── main.js                  # Entry point Electron
│   ├── ipc-handlers.js          # Handlers IPC (comunicação main ↔ renderer)
│   ├── preload.js               # API exposta ao renderer via contextBridge
│   └── database/
│       ├── db.js                # Conexão SQLite
│       ├── migrations.js        # Criação de tabelas e migrações
│       └── models.js            # CRUD de todos os modelos
└── renderer/
    ├── App.jsx                  # Router e layout principal
    ├── components/
    │   └── Sidebar.jsx          # Navegação lateral
    ├── hooks/
    │   └── useDatabase.js       # Hook React com todas as funções de BD
    └── pages/
        ├── Dashboard.jsx
        ├── Cursos.jsx
        ├── Disciplinas.jsx
        ├── Turmas.jsx
        ├── Aulas.jsx
        ├── Calendario.jsx
        ├── Financeiro.jsx
        ├── Estatisticas.jsx
        └── Definicoes.jsx
```

---

## Como Utilizar

### 1. Configurar o Perfil
Vai a **Definições** e preenche o teu nome, instituição, departamento e ano letivo atual.

### 2. Criar a Hierarquia Académica
Segue esta ordem:
1. **Instituições** — adiciona a(s) instituição(ões) onde leccionas
2. **Cursos** — cria os cursos dentro de cada instituição
3. **Disciplinas** — associa disciplinas a cada curso
4. **Turmas** — cria turmas para cada disciplina

### 3. Planear Aulas
- Vai a **Aulas** e cria aulas associadas a uma turma e módulo
- Preenche o tópico, objetivos, conteúdos e atividades previstas
- Altera o estado da aula (Planeada → Realizada) depois de a dar

### 4. Acompanhar no Calendário
O **Calendário** mostra todas as aulas agendadas. Podes clicar em qualquer aula para ver ou editar os detalhes.

### 5. Gerir Financeiro
- Define o valor/hora nas configurações do curso ou da disciplina
- Vai a **Financeiro** para ver o resumo de remunerações por período

### 6. Fazer Backup
Em **Definições**, usa a opção de backup para guardar uma cópia da base de dados. Restaura a partir do mesmo menu.

---

## Base de Dados

A base de dados é um ficheiro SQLite guardado localmente em:

- **Windows:** `%APPDATA%/PlanAula/`
- **macOS:** `~/Library/Application Support/PlanAula/`
- **Linux:** `~/.config/PlanAula/`

Todos os dados ficam no teu computador — nada é enviado para servidores externos.

---

## Licença

Uso pessoal. Todos os direitos reservados.
