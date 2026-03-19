"use strict";
const electron = require("electron");
function invoke(channel, ...args) {
  return electron.ipcRenderer.invoke(channel, ...args);
}
electron.contextBridge.exposeInMainWorld("api", {
  // Disciplinas
  disciplinas: {
    listar: () => invoke("disciplinas:listar"),
    buscar: (id) => invoke("disciplinas:buscar", id),
    criar: (dados) => invoke("disciplinas:criar", dados),
    editar: (id, dados) => invoke("disciplinas:editar", { id, dados }),
    eliminar: (id) => invoke("disciplinas:eliminar", id)
  },
  // Módulos
  modulos: {
    listar: (disciplina_id) => invoke("modulos:listar", disciplina_id),
    criar: (dados) => invoke("modulos:criar", dados),
    editar: (id, dados) => invoke("modulos:editar", { id, dados }),
    eliminar: (id) => invoke("modulos:eliminar", id)
  },
  // Turmas
  turmas: {
    listar: (disciplina_id) => invoke("turmas:listar", disciplina_id),
    criar: (dados) => invoke("turmas:criar", dados),
    editar: (id, dados) => invoke("turmas:editar", { id, dados }),
    eliminar: (id) => invoke("turmas:eliminar", id)
  },
  // Horários
  horarios: {
    listar: (turma_id) => invoke("horarios:listar", turma_id),
    criar: (dados) => invoke("horarios:criar", dados),
    editar: (id, dados) => invoke("horarios:editar", { id, dados }),
    eliminar: (id) => invoke("horarios:eliminar", id),
    eliminarDaTurma: (turma_id) => invoke("horarios:eliminarDaTurma", turma_id)
  },
  // Aulas
  aulas: {
    listar: (filtros) => invoke("aulas:listar", filtros),
    buscar: (id) => invoke("aulas:buscar", id),
    criar: (dados) => invoke("aulas:criar", dados),
    editar: (id, dados) => invoke("aulas:editar", { id, dados }),
    eliminar: (id) => invoke("aulas:eliminar", id),
    gerarAutomatico: (turma_id, data_inicio, data_fim) => invoke("aulas:gerarAutomatico", { turma_id, data_inicio, data_fim }),
    proximoNumero: (turma_id) => invoke("aulas:proximoNumero", turma_id),
    eliminarDaDisciplina: (disciplina_id) => invoke("aulas:eliminarDaDisciplina", disciplina_id)
  },
  // Dias Não Lectivos
  diasNaoLetivos: {
    listar: (ano) => invoke("diasNaoLetivos:listar", ano),
    criar: (dados) => invoke("diasNaoLetivos:criar", dados),
    eliminar: (id) => invoke("diasNaoLetivos:eliminar", id),
    importarFeriados: (ano) => invoke("diasNaoLetivos:importarFeriados", ano)
  },
  // Financeiro
  financeiro: {
    calcularMensal: (ano, mes) => invoke("financeiro:calcularMensal", { ano, mes }),
    calcularAnual: (ano) => invoke("financeiro:calcularAnual", ano),
    obterConfig: (ano) => invoke("financeiro:obterConfig", ano),
    salvarConfig: (dados) => invoke("financeiro:salvarConfig", dados),
    listarValoresHora: (ano_letivo) => invoke("financeiro:listarValoresHora", ano_letivo),
    salvarValorHora: (dados) => invoke("financeiro:salvarValorHora", dados)
  },
  // Configurações
  configuracoes: {
    obter: (chave) => invoke("configuracoes:obter", chave),
    salvar: (dados) => invoke("configuracoes:salvar", dados)
  },
  // Estatísticas
  estatisticas: {
    obter: (ano_letivo) => invoke("estatisticas:obter", ano_letivo)
  },
  // Exportação PDF
  exports: {
    aulaPlano: (aula, config) => invoke("export:aulaPlano", { aula, config }),
    relatorioFinanceiro: (dados, tipo, ano, mes, config) => invoke("export:relatorioFinanceiro", { dados, tipo, ano, mes, config })
  },
  // Instituições
  instituicoes: {
    listar: () => invoke("instituicoes:listar"),
    criar: (dados) => invoke("instituicoes:criar", dados),
    editar: (id, dados) => invoke("instituicoes:editar", { id, dados }),
    eliminar: (id) => invoke("instituicoes:eliminar", id)
  },
  // Cursos
  cursos: {
    listar: (instituicao_id) => invoke("cursos:listar", instituicao_id),
    criar: (dados) => invoke("cursos:criar", dados),
    editar: (id, dados) => invoke("cursos:editar", { id, dados }),
    eliminar: (id) => invoke("cursos:eliminar", id)
  },
  // Períodos Não Letivos
  periodosNaoLetivos: {
    listar: (instituicao_id) => invoke("periodosNaoLetivos:listar", instituicao_id),
    criar: (dados) => invoke("periodosNaoLetivos:criar", dados),
    eliminar: (id) => invoke("periodosNaoLetivos:eliminar", id)
  },
  // Backup
  backup: {
    exportar: () => invoke("backup:exportar"),
    importar: () => invoke("backup:importar")
  },
  // Outros Rendimentos
  outrosRendimentos: {
    listar: (filtros) => invoke("outrosRendimentos:listar", filtros),
    criar: (dados) => invoke("outrosRendimentos:criar", dados),
    editar: (id, dados) => invoke("outrosRendimentos:editar", { id, dados }),
    eliminar: (id) => invoke("outrosRendimentos:eliminar", id)
  }
});
