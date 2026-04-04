# PlanAula — Documentação para Programadores

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitectura](#2-arquitectura)
3. [Instalação e Desenvolvimento](#3-instalação-e-desenvolvimento)
4. [Base de Dados](#4-base-de-dados)
5. [API IPC (Main ↔ Renderer)](#5-api-ipc-main--renderer)
6. [Preload API (window.api)](#6-preload-api-windowapi)
7. [Funções do Modelo (models.js)](#7-funções-do-modelo-modelsjs)
8. [Páginas React](#8-páginas-react)
9. [Componentes e Hooks](#9-componentes-e-hooks)
10. [Sistema de Exportação](#10-sistema-de-exportação)
11. [Sistema de Migrações](#11-sistema-de-migrações)
12. [Importação Excel](#12-importação-excel)
13. [Lógica de Negócio](#13-lógica-de-negócio)
14. [Guia: Adicionar Nova Funcionalidade](#14-guia-adicionar-nova-funcionalidade)
15. [Convenções e Cuidados](#15-convenções-e-cuidados)

---

## 1. Visão Geral

**PlanAula** é uma aplicação desktop para professores e formadores planearem e gerirem aulas, horários e finanças. Funciona 100% offline com base de dados SQLite local.

### Tech Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Electron | 41.1.1 |
| Frontend | React + React Router | 18.2.0 / 6.22.3 |
| Estilo | Tailwind CSS | 3.4.1 |
| Base de Dados | SQLite (better-sqlite3) | 12.8.0 |
| Gráficos | Recharts | 3.8.1 |
| Build | Vite + electron-vite | 7.3.1 / 5.0.0 |
| Packaging | electron-builder | 26.8.1 |
| Excel | ExcelJS | 4.x |
| Vulnerabilidades | **0** | — |

### Estrutura de Ficheiros

```
src/
├── main/                          # Processo principal Electron
│   ├── main.js                    # Entry point, criação da janela
│   ├── preload.js                 # Context bridge (window.api)
│   ├── ipc-handlers.js            # Todos os IPC handlers (~1100 linhas)
│   ├── database/
│   │   ├── db.js                  # Conexão SQLite (singleton, WAL mode)
│   │   ├── migrations.js          # Schema + migrações versionadas (v0-v3)
│   │   └── models.js              # Funções CRUD e lógica de negócio (~1260 linhas)
│   └── exporters/
│       ├── plano-aula-template.js # Templates HTML para PDF (IEFP + ISLA)
│       ├── pdf-exporter.js        # Placeholder
│       └── docx-exporter.js       # Placeholder
├── renderer/                      # Frontend React
│   ├── App.jsx                    # Router (HashRouter, 11 rotas)
│   ├── main.jsx                   # Entry point React
│   ├── index.html                 # HTML base
│   ├── index.css                  # Tailwind + estilos globais
│   ├── pages/                     # 11 páginas
│   │   ├── Dashboard.jsx          # Painel principal
│   │   ├── Disciplinas.jsx        # Gestão de UC/UFCDs
│   │   ├── Turmas.jsx             # Gestão de turmas e horários
│   │   ├── Aulas.jsx              # Planeamento de aulas
│   │   ├── Calendario.jsx         # Vistas mensal/semanal/agenda/anual
│   │   ├── Financeiro.jsx         # Rendimentos e facturação
│   │   ├── Estatisticas.jsx       # Gráficos e KPIs
│   │   ├── Cursos.jsx             # Gestão de cursos
│   │   ├── Definicoes.jsx         # Configurações e backup
│   │   ├── Importar.jsx           # Importação Excel (2 templates)
│   │   └── Ajuda.jsx              # Documentação de utilizador
│   ├── components/
│   │   ├── Layout.jsx             # Layout com sidebar + header
│   │   ├── Sidebar.jsx            # Menu de navegação
│   │   ├── Modal.jsx              # Modal genérico
│   │   ├── DialogModal.jsx        # Diálogo de confirmação
│   │   └── PesquisaGlobal.jsx     # Pesquisa global (Ctrl+K)
│   └── hooks/
│       ├── useDatabase.js         # Wrapper da API com loading/error
│       └── useDialog.js           # Gestão de diálogos confirm/alert
build/
├── icon.ico                       # Ícone multi-resolução (16-256px)
├── icon.png                       # Ícone PNG original (651x734, não quadrado)
└── icon_*.png                     # Ícones por resolução
scripts/
├── run.mjs                        # Build + actualizar exe + lançar
└── dev.js                         # Servidor de desenvolvimento
```

---

## 2. Arquitectura

### Fluxo de Comunicação

```
React Component
    ↓ window.api.disciplinas.listar()
Preload (contextBridge)
    ↓ ipcRenderer.invoke('disciplinas:listar')
IPC Handler (main process)
    ↓ models.listarDisciplinas()
SQLite (better-sqlite3)
    ↓ SELECT ...
    ↑ rows[]
    ↑ { success: true, data: rows }
    ↑ rows (after ipc helper extraction)
React Component (setState)
```

### Padrão de Resposta IPC

Todos os handlers retornam `{ success: boolean, data?: any, error?: string }`. O helper `ipc()` no `Importar.jsx` e o `useDatabase` hook extraem `data` automaticamente.

### Gestão de Estado

- **React State**: Estado local de cada componente (formulários, filtros, listas)
- **SQLite**: Fonte de verdade (ficheiro em `%APPDATA%/PlanAula/planaula.db`)
- **localStorage**: Apenas o tema (light/dark)

---

## 3. Instalação e Desenvolvimento

### Setup

```bash
git clone https://github.com/nelsonduarte/PlanAula.git
cd PlanAula
npm install
```

### Desenvolvimento

```bash
npm run dev          # electron-vite dev (hot reload)
```

### Build e Executar

```bash
node scripts/run.mjs  # Compila + actualiza .exe + lança
npm run build          # Build completo com electron-builder
```

### Aplicar Ícone ao .exe

O `signAndEditExecutable` está `false` (sem certificado). Após `npm run build`:

```bash
./node_modules/electron-winstaller/vendor/rcedit.exe ./release/win-unpacked/PlanAula.exe --set-icon ./build/icon.ico
```

### Base de Dados

- **Localização**: `%APPDATA%/PlanAula/planaula.db`
- **Modo**: WAL (Write-Ahead Logging)
- **Foreign Keys**: Activadas via PRAGMA

---

## 4. Base de Dados

### Diagrama de Relações

```
instituicoes ──┐
               ├── cursos ──── disciplinas ──── modulos
               │                    │
               │               turmas ──┬── horarios
               │                   │    └── valores_hora
               │                   │
               │               aulas
               │
               ├── periodos_nao_letivos
               └── professor_cargos

dias_nao_letivos (independente)
config_fiscal (independente)
configuracoes (key-value)
outros_rendimentos (independente)
audit_log (independente)
schema_version (migração)
```

### Tabelas Principais

#### disciplinas

| Coluna | Tipo | Constraints | Notas |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| nome | TEXT | NOT NULL | Nome da UC/UFCD |
| codigo | TEXT | UNIQUE | Código (ex: "PW101") |
| area_cientifica | TEXT | | Área científica |
| carga_horaria | INTEGER | NOT NULL DEFAULT 0 | Horas totais |
| ects | REAL | | Créditos ECTS |
| tipo | TEXT | NOT NULL DEFAULT 'mista' | 'UC', 'UFCD', 'mista', etc. |
| descricao | TEXT | | |
| curso_id | INTEGER | FK cursos(id) SET NULL | Curso associado |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

#### turmas

| Coluna | Tipo | Constraints | Notas |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| disciplina_id | INTEGER | NOT NULL FK disciplinas(id) CASCADE | |
| designacao | TEXT | NOT NULL | Ex: "Turma A", "IGR2" |
| ano_letivo | TEXT | | Ex: "2025/2026" ou "2026" |
| semestre | INTEGER | DEFAULT NULL | NULL para formação |
| sala | TEXT | | |
| cor | TEXT | DEFAULT '#2E86C1' | Cor hex para UI |
| data_inicio | DATE | | |
| data_fim | DATE | | |
| carga_horaria | INTEGER | NOT NULL DEFAULT 0 | |

#### aulas

| Coluna | Tipo | Constraints | Notas |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| turma_id | INTEGER | NOT NULL FK turmas(id) CASCADE | |
| modulo_id | INTEGER | FK modulos(id) | |
| data | DATE | NOT NULL | YYYY-MM-DD |
| hora_inicio | TEXT | NOT NULL | HH:MM |
| hora_fim | TEXT | NOT NULL | HH:MM |
| topico | TEXT | NOT NULL DEFAULT '' | Tópico/Sumário |
| objetivos | TEXT | | |
| conteudos | TEXT | | |
| atividades | TEXT | | |
| recursos | TEXT | | |
| avaliacao | TEXT | | |
| notas | TEXT | | |
| estado | TEXT | DEFAULT 'Planeada' | 'Planeada', 'Realizada', 'Adiada', 'Cancelada' |
| numero | INTEGER | | Nº sequencial |
| data_avaliacao | DATE | | Data de avaliação |
| sala | TEXT | | Sala específica desta sessão |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

#### horarios

| Coluna | Tipo | Constraints | Notas |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| turma_id | INTEGER | NOT NULL FK turmas(id) CASCADE | |
| dia_semana | INTEGER | NOT NULL | 0=Dom, 1=Seg, ..., 6=Sáb |
| hora_inicio | TEXT | NOT NULL | HH:MM |
| hora_fim | TEXT | NOT NULL | HH:MM |
| sala | TEXT | | |

#### Outras tabelas

- **valores_hora**: disciplina_id, turma_id?, valor_hora, ano_letivo
- **config_fiscal**: ano, taxa_iva, isento_iva, taxa_retencao_irs, sem_retencao
- **configuracoes**: chave (PK), valor
- **instituicoes**: nome, tipo, contacto, notas
- **cursos**: instituicao_id, nome, tipo, ano_letivo, valor_hora
- **modulos**: disciplina_id, nome, ordem, horas, objetivos
- **dias_nao_letivos**: data (UNIQUE), descricao, tipo
- **periodos_nao_letivos**: instituicao_id?, descricao, data_inicio, data_fim, tipo
- **professor_cargos**: instituicao_id?, instituicao_nome, departamento, cargo, ativo
- **outros_rendimentos**: descricao, valor, data, tipo, notas
- **audit_log**: entidade, entidade_id, acao, descricao
- **schema_version**: version (INTEGER)

---

## 5. API IPC (Main ↔ Renderer)

Todos os handlers estão em `src/main/ipc-handlers.js`. Formato: `ipcMain.handle('canal', async (_, args) => { ... })`

### Dashboard
| Canal | Args | Retorno |
|-------|------|---------|
| `dashboard:stats` | — | `{ aulasHoje[], aulasAmanha[], avaliacoes[], horasSemana, horasMesInst[], turmasTerminar[], semPreparar }` |

### Disciplinas
| Canal | Args | Retorno |
|-------|------|---------|
| `disciplinas:listar` | — | `Disciplina[]` |
| `disciplinas:buscar` | `id` | `Disciplina` |
| `disciplinas:criar` | `dados` | `Disciplina` |
| `disciplinas:editar` | `{ id, dados }` | `Disciplina` |
| `disciplinas:eliminar` | `id` | `{ success }` |

### Módulos
| Canal | Args | Retorno |
|-------|------|---------|
| `modulos:listar` | `disciplina_id` | `Modulo[]` |
| `modulos:criar` | `dados` | `Modulo` |
| `modulos:editar` | `{ id, dados }` | `Modulo` |
| `modulos:eliminar` | `id` | `{ success }` |
| `modulos:sincronizarUFCD` | `disciplina_id` | `{ sincronizadas }` |

### Turmas
| Canal | Args | Retorno |
|-------|------|---------|
| `turmas:listar` | `disciplina_id?` | `Turma[]` |
| `turmas:criar` | `dados` | `Turma` |
| `turmas:editar` | `{ id, dados }` | `Turma` |
| `turmas:eliminar` | `id` | `{ success }` — limpa aulas, horários, valores_hora |

### Horários
| Canal | Args | Retorno |
|-------|------|---------|
| `horarios:listar` | `turma_id` | `Horario[]` |
| `horarios:criar` | `dados` | `Horario` |
| `horarios:editar` | `{ id, dados }` | `Horario` |
| `horarios:eliminar` | `id` | `{ success }` |
| `horarios:eliminarDaTurma` | `turma_id` | `{ success }` |

### Aulas
| Canal | Args | Retorno |
|-------|------|---------|
| `aulas:listar` | `filtros` | `Aula[]` — filtros: turma_id, disciplina_id, data_inicio, data_fim, estado, mes |
| `aulas:buscar` | `id` | `Aula` |
| `aulas:criar` | `dados` | `Aula` |
| `aulas:editar` | `{ id, dados }` | `Aula` |
| `aulas:eliminar` | `id` | `{ success }` |
| `aulas:gerarAutomatico` | `{ turma_id, data_inicio, data_fim }` | `{ aulas[], horas_geradas, carga_horaria, limite_atingido }` |
| `aulas:proximoNumero` | `turma_id` | `number` |
| `aulas:eliminarDaTurma` | `turma_id` | `{ success, eliminadas }` |
| `aulas:eliminarDaDisciplina` | `disciplina_id` | `{ success, eliminadas }` |

### Exportação
| Canal | Args | Retorno |
|-------|------|---------|
| `export:aulaPlano` | `{ aula, config }` | PDF (usa template IEFP ou ISLA automaticamente) |
| `export:turmaPlanos` | `{ turma_id }` | PDF com todos os planos da turma |
| `export:folhaHoras` | `{ ano, mes }` | PDF folha de horas por instituição/turma |
| `export:calendarioHTML` | `{ html, nome }` | PDF do calendário |
| `export:ics` | — | Ficheiro .ics (iCalendar) |
| `export:mobileHTML` | — | HTML standalone para telemóvel |
| `export:relatorioTurma` | `{ turma, horarios, aulas, config }` | PDF relatório da turma |
| `export:relatorioFinanceiro` | `{ dados, tipo, ano, mes, config }` | PDF financeiro |

### Financeiro, Configurações, Estatísticas, etc.

Seguem o mesmo padrão CRUD. Ver `src/main/preload.js` para a lista completa.

---

## 6. Preload API (window.api)

Definido em `src/main/preload.js`. Todas as chamadas usam `ipcRenderer.invoke()`.

```javascript
window.api = {
  dashboard: { stats() },
  disciplinas: { listar(), buscar(id), criar(dados), editar(id, dados), eliminar(id) },
  modulos: { listar(disc_id), criar(dados), editar(id, dados), eliminar(id), sincronizarUFCD(disc_id) },
  turmas: { listar(disc_id?), criar(dados), editar(id, dados), eliminar(id) },
  horarios: { listar(turma_id), criar(dados), editar(id, dados), eliminar(id), eliminarDaTurma(turma_id) },
  aulas: { listar(filtros), buscar(id), criar(dados), editar(id, dados), eliminar(id),
           gerarAutomatico(turma_id, di, df), proximoNumero(turma_id),
           eliminarDaTurma(turma_id), eliminarDaDisciplina(disc_id) },
  diasNaoLetivos: { listar(ano), criar(dados), eliminar(id), importarFeriados(ano) },
  financeiro: { calcularMensal(ano, mes), calcularAnual(ano), obterConfig(ano), salvarConfig(dados),
                listarValoresHora(al), salvarValorHora(dados) },
  configuracoes: { obter(chave?), salvar(dados) },
  estatisticas: { obter(ano) },
  exports: { aulaPlano(aula, cfg), relatorioFinanceiro(...), calendarioHTML(html, nome),
             mobileHTML(), ics(), relatorioTurma(...), turmaPlanos(turma_id), folhaHoras(ano, mes) },
  backup: { exportar(), importar(), reiniciar() },
  pesquisa: { global(query) },
  instituicoes: { listar(), criar(dados), editar(id, dados), eliminar(id) },
  cursos: { listar(inst_id?), criar(dados), editar(id, dados), eliminar(id) },
  periodosNaoLetivos: { listar(inst_id), criar(dados), eliminar(id) },
  professorCargos: { listar(), criar(dados), editar(id, dados), eliminar(id) },
  outrosRendimentos: { listar(filtros), criar(dados), editar(id, dados), eliminar(id) }
}
```

---

## 7. Funções do Modelo (models.js)

Todas as funções exportadas em `src/main/database/models.js`:

### CRUD Principal

```javascript
// Disciplinas
criarDisciplina(dados) → { id, ...dados }
listarDisciplinas() → Disciplina[] (JOIN cursos, instituicoes)
buscarDisciplina(id) → Disciplina
editarDisciplina(id, dados) → Disciplina
eliminarDisciplina(id) → { success }

// Turmas
criarTurma(dados) → { id, ...dados }  // semestre defaults to null
listarTurmas(disciplina_id?) → Turma[] (JOIN disciplinas, inclui disciplina_tipo)
buscarTurma(id) → Turma
editarTurma(id, dados) → Turma
eliminarTurma(id) → { success }  // CASCADE manual: aulas, horarios, valores_hora

// Aulas
criarAula(dados) → { id, ...dados }  // sala defaults to null, numero auto-calculado
listarAulas(filtros?) → Aula[]  // COALESCE(a.sala, h.sala), estado virtual para filtro
editarAula(id, dados) → Aula
eliminarAula(id) → { success }
gerarAulasAutomatico(turma_id, data_inicio, data_fim) → { aulas, horas_geradas, ... }
```

### Funções Especiais

```javascript
// Geração automática de aulas
gerarAulasAutomatico(turma_id, data_inicio, data_fim)
// - Lê horários semanais da turma
// - Gera aulas para cada slot, excluindo dias não letivos e períodos
// - Para quando atinge carga_horaria
// - Ajusta última aula se necessário (duração parcial)

// Dashboard
obterDashboardStats()
// - aulasHoje, aulasAmanha (com sala e instituição)
// - avaliacoes próximas 7 dias
// - horasSemana, horasMesInst (por instituição)
// - turmasTerminar (<15% restante)
// - semPreparar (aulas sem tópico nas próximas 2 semanas)

// Exportação
obterContextoExportTurma(turma_id)
// - Retorna turma + aulas com horasAcumuladas e sequência
// - isFormacao (UFCD vs UC)

// Financeiro
calcularFinanceiroMensal(ano, mes)
// - Prioridade valor/hora: turma > disciplina > curso
// - Aplica IVA e IRS da config_fiscal do ano
// - Inclui outros_rendimentos

// Estatísticas
obterEstatisticas(ano_letivo)
// - Estado virtual: Adiada/Cancelada mantém; senão data<=hoje=Realizada, futuro=Planeada
// - rendimentoMensal por instituição
```

---

## 8. Páginas React

| Página | Ficheiro | Descrição |
|--------|----------|-----------|
| Painel | Dashboard.jsx | KPIs, aulas hoje/amanhã, avaliações, horas por instituição, turmas a terminar |
| Disciplinas | Disciplinas.jsx | CRUD UC/UFCD, agrupadas por nome (UFCD) ou curso (UC) |
| Turmas | Turmas.jsx | CRUD turmas, agrupadas por designação (formação) ou lado a lado (ensino), color picker |
| Aulas | Aulas.jsx | CRUD aulas, geração automática, filtros por turma/estado/data, label "Sumário" para UFCD |
| Calendário | Calendario.jsx | Vistas mensal/semanal/agenda/anual, exportar PDF/Mobile/.ics |
| Financeiro | Financeiro.jsx | Mensal/anual, valor/hora, config fiscal, folha de horas |
| Estatísticas | Estatisticas.jsx | Evolução horas+rendimento, rendimento/horas por instituição |
| Cursos | Cursos.jsx | CRUD cursos por instituição |
| Definições | Definicoes.jsx | Perfil, instituições, cargos, backup/restore |
| Importar | Importar.jsx | 2 templates (Ensino Superior + Formação), importação com detecção automática |
| Ajuda | Ajuda.jsx | Documentação de utilizador com secções expansíveis |

---

## 9. Componentes e Hooks

### Componentes

| Componente | Props | Descrição |
|-----------|-------|-----------|
| Layout | children | Wrapper com Sidebar, header, tema, pesquisa |
| Sidebar | — | Navegação, 11 links, toggle collapse |
| Modal | isOpen, onClose, title, size, footer, children | Modal genérico para formulários |
| DialogModal | dialog, onOk, onCancel | Confirmação/alerta |
| PesquisaGlobal | — | Ctrl+K, pesquisa aulas/turmas/disciplinas |

### Hooks

**useDatabase()** — Wrapper sobre `window.api` com estados de loading/error e mock data para desenvolvimento sem Electron.

```javascript
const db = useDatabase()
const aulas = await db.listarAulas({ turma_id: 5 })
const fin = await db.calcularFinanceiroMensal(2026, 4)
```

**useDialog()** — Gestão de diálogos modais.

```javascript
const { confirm, alert, dialog, handleOk, handleCancel } = useDialog()
if (await confirm('Eliminar?', { danger: true })) { ... }
```

---

## 10. Sistema de Exportação

### Templates PDF (plano-aula-template.js)

Dois templates seleccionados automaticamente pelo tipo da disciplina:

**templateIEFP** (formação profissional):
- Cabeçalho: instituição, curso, acção, UFCD com código
- Sessão X / Total, data, horário, duração, sala
- Barra de progresso (horas acumuladas / carga)
- Secções: Sumário, Objectivos, Conteúdos, Actividades, Recursos, Avaliação, Observações
- Linhas de assinatura: Formador/a + Coordenador/a

**templateISLA** (ensino superior):
- Cabeçalho: instituição, departamento
- Nº aula, data, horário, sala, módulo, estado (badge)
- Secções: Tópico, Objectivos, Conteúdos, Actividades, Recursos, Avaliação, Notas

### Exportação em Lote

`export:turmaPlanos` gera um PDF com todos os planos de uma turma, com page breaks entre cada aula.

### Folha de Horas

`export:folhaHoras` gera PDF com:
- Tabela de sessões agrupada por instituição
- Subtotais por turma (linha azul)
- Total geral
- Linha de assinatura

### Outros Formatos

- **HTML Mobile**: Página standalone com calendário mensal/semanal, lista de aulas, resumo por turma. Funciona offline.
- **.ics**: Ficheiro iCalendar com todos os eventos. Cada aula = VEVENT com DTSTART, DTEND, SUMMARY, LOCATION.

---

## 11. Sistema de Migrações

Definido em `src/main/database/migrations.js`.

### Funcionamento

1. Tabela `schema_version` guarda a versão actual
2. Array `MIGRATIONS` contém funções numeradas (v0, v1, v2, v3)
3. Na inicialização: lê versão, corre migrações pendentes
4. BD legada (sem `schema_version`) é detectada e actualizada

### Versões

| Versão | Descrição |
|--------|-----------|
| v0 | Baseline: todas as tabelas core + configurações default |
| v1 | Colunas extra: numero/data_avaliacao/sala em aulas, curso_id em disciplinas, sala em horarios, datas/carga em turmas |
| v2 | Tabelas: outros_rendimentos, periodos_nao_letivos, professor_cargos |
| v3 | Semestre nullable + ano_letivo nullable (formação profissional) |

### Adicionar Nova Migração

```javascript
// Em migrations.js, adicionar ao array MIGRATIONS:
function v4_nova_feature(db) {
  const cols = db.prepare('PRAGMA table_info(aulas)').all().map(c => c.name)
  if (!cols.includes('nova_coluna')) {
    db.exec('ALTER TABLE aulas ADD COLUMN nova_coluna TEXT')
  }
}
```

---

## 12. Importação Excel

Definido em `src/renderer/pages/Importar.jsx`. Usa **ExcelJS** (async).

### Detecção Automática

- Sheet "Sessões" presente → template **Formação** (sessões directas)
- Sheet "Horários" presente → template **Ensino Superior** (horários semanais + geração automática)

### Template Ensino Superior

Sheets: Instruções → Configurações → Instituições → Períodos Não Letivos → Cursos → Disciplinas → Módulos → Turmas → Horários

Fluxo:
1. Importa dados sequencialmente
2. Limpa horários existentes das turmas importadas
3. Valida conflitos de horário (apenas turmas com períodos sobrepostos)
4. Limpa aulas existentes
5. Gera aulas automaticamente com `gerarAulasAutomatico`

### Template Formação

Sheets: Instruições → Instituições → Cursos → UFCDs → Turmas → Sessões

Fluxo:
1. Importa UFCDs como disciplinas com `tipo: 'UFCD'`
2. Aceita `ufcd_nome` ou `disciplina_nome` como coluna
3. Aceita `ano` ou `ano_letivo` como coluna
4. Semestre fica NULL
5. Limpa aulas existentes
6. Cria aulas directamente a partir da sheet Sessões (sem geração automática)

### Helpers

```javascript
addSheet(wb, name, data, colWidths)    // Adicionar sheet a partir de array-of-arrays
saveWorkbook(wb, filename)              // Gerar download do ficheiro
parseSheet(wb, name) → rows[]          // Converter sheet para JSON (converte Dates para YYYY-MM-DD)
norm(row, key) → string                // Normalizar header (remove " *", trim)
normNum(row, key, def) → number        // Normalizar número
normDate(row, key) → string            // Normalizar data (serial Excel, dd/mm/yyyy, yyyy-mm-dd)
normTime(row, key, def) → string       // Normalizar hora (serial Excel ou HH:MM)
```

---

## 13. Lógica de Negócio

### Estado Virtual das Aulas

O campo `estado` na BD pode ser 'Planeada', 'Adiada' ou 'Cancelada'. O estado 'Realizada' é **calculado**:

```
Se estado IN ('Adiada', 'Cancelada') → manter
Se data <= hoje → 'Realizada'
Senão → 'Planeada'
```

O filtro SQL de `listarAulas` aplica esta lógica:
- Filtro "Realizada": `estado NOT IN ('Adiada','Cancelada') AND data <= date('now')`
- Filtro "Planeada": `estado NOT IN ('Adiada','Cancelada') AND data > date('now')`

### Sala (COALESCE)

A sala de uma aula vem de duas fontes:
1. `aulas.sala` — definida directamente (importação de sessões)
2. `horarios.sala` — derivada do horário semanal

Query: `COALESCE(a.sala, h.sala) as sala`

### Cálculo Financeiro

Prioridade do valor/hora:
1. `valores_hora` com `turma_id` específico
2. `valores_hora` com `turma_id IS NULL` (por disciplina)
3. `cursos.valor_hora` (fallback do curso)

Cálculo mensal:
```
valor_bruto = Σ(horas × valor_hora) por disciplina
total_iva = valor_bruto × taxa_iva (se não isento)
total_irs = valor_bruto × taxa_retencao_irs (se não sem_retencao)
total_liquido = valor_bruto + total_iva - total_irs
```

### Geração Automática de Aulas

1. Lê horários semanais da turma
2. Itera dia a dia de `data_inicio` a `data_fim`
3. Para cada dia, verifica se é dia não letivo (feriados + períodos expandidos)
4. Se o dia da semana coincide com um horário, cria a aula
5. Para quando `horas_geradas + horas_existentes >= carga_horaria`
6. A última aula pode ser encurtada para cumprir exactamente a carga

---

## 14. Guia: Adicionar Nova Funcionalidade

### Exemplo: Adicionar entidade "Avaliadores"

**1. Migração** (`migrations.js`):
```javascript
function v4_avaliadores(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS avaliadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL, email TEXT, instituicao_id INTEGER
  )`)
}
```

**2. Modelo** (`models.js`):
```javascript
export function criarAvaliador(dados) { ... }
export function listarAvaliadores() { ... }
export function editarAvaliador(id, dados) { ... }
export function eliminarAvaliador(id) { ... }
```

**3. IPC** (`ipc-handlers.js`):
```javascript
ipcMain.handle('avaliadores:listar', async () => {
  try { return { success: true, data: models.listarAvaliadores() } }
  catch (e) { return { success: false, error: e.message } }
})
```

**4. Preload** (`preload.js`):
```javascript
avaliadores: {
  listar: () => invoke('avaliadores:listar'),
  criar: (dados) => invoke('avaliadores:criar', dados),
  // ...
},
```

**5. Página React** (`pages/Avaliadores.jsx`):
```jsx
export default function Avaliadores() {
  // useState, useEffect, CRUD handlers, Modal, etc.
}
```

**6. Rota** (`App.jsx`):
```jsx
<Route path="/avaliadores" element={<Avaliadores />} />
```

**7. Sidebar** (`components/Sidebar.jsx`): Adicionar link.

---

## 15. Convenções e Cuidados

### Formatos

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Datas | ISO 8601 | `2026-04-04` |
| Horas | 24h | `09:30`, `14:00` |
| Moeda | EUR | Calculado, não armazenado formatado |
| Cores | Hex | `#2E86C1` |
| Dia da semana | 0-6 | 0=Dom, 1=Seg, ..., 6=Sáb |

### Cuidados Específicos

1. **`diasNaoLetivos`** no Calendario.jsx guarda **objectos** (não strings) — usar `.descricao` para texto
2. **Módulos** existem no backend mas o botão foi removido da UI (confuso para utilizadores)
3. **Migrações**: nova alteração ao schema = nova função no array `MIGRATIONS`
4. **ExcelJS** é async — templates usam helpers `addSheet()` e `saveWorkbook()`
5. **Ícone**: após `npm run build`, aplicar com `rcedit.exe --set-icon` (signAndEditExecutable=false)
6. **icon.png** não é quadrado (651×734) — resize com LANCZOS centrado em fundo transparente
7. **`eliminarTurma`** faz CASCADE manual (limpa aulas, horários, valores_hora antes de apagar)
8. **Filtro estado**: "Realizada" e "Planeada" são calculados pela data, não pelo valor na BD
9. **`run.mjs`** é ESM (.mjs) — o package.json NÃO tem `"type": "module"` (incompatível com Electron CJS)
10. **Horas começam a :30** — todas as aulas do utilizador actual começam a :30, não corrigir

### Segurança

- `contextBridge` isola o renderer — sem acesso a `fs`, `child_process`, etc.
- Queries parametrizadas via better-sqlite3 (sem SQL injection)
- Sem dados sensíveis expostos ao renderer
- Zero vulnerabilidades npm

---

*Documentação gerada em Abril 2026. Última actualização: commit 19abfa6.*
