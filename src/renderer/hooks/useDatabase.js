import { useState, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.api !== undefined

// Mock data for development without Electron
const mockData = {
  disciplinas: [
    { id: 1, nome: 'Matemática', codigo: 'MAT101', area_cientifica: 'Ciências Exatas', carga_horaria: 60, ects: 6, tipo: 'teórica', descricao: '' },
    { id: 2, nome: 'Física', codigo: 'FIS101', area_cientifica: 'Ciências Exatas', carga_horaria: 45, ects: 4.5, tipo: 'mista', descricao: '' },
  ],
  turmas: [
    { id: 1, disciplina_id: 1, designacao: 'T1', ano_letivo: '2025/2026', semestre: 1, sala: 'A101', cor: '#2E86C1', disciplina_nome: 'Matemática' },
    { id: 2, disciplina_id: 2, designacao: 'T1', ano_letivo: '2025/2026', semestre: 1, sala: 'B202', cor: '#27AE60', disciplina_nome: 'Física' },
  ],
  aulas: [],
  modulos: [],
  horarios: [],
  configuracoes: { tema: 'light', nome_professor: '', instituicao: '', departamento: '', ano_letivo_atual: '2025/2026' }
}

async function callApi(fn, fallback) {
  if (isElectron) {
    const result = await fn()
    if (result.success) return result.data
    throw new Error(result.error)
  }
  return fallback
}

export function useDatabase() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(async (fn, fallback = null) => {
    setLoading(true)
    setError(null)
    try {
      const result = await callApi(fn, fallback)
      return result
    } catch (e) {
      setError(e.message)
      return fallback
    } finally {
      setLoading(false)
    }
  }, [])

  // Disciplinas
  const listarDisciplinas = () => execute(
    () => window.api.disciplinas.listar(),
    mockData.disciplinas
  )

  const criarDisciplina = (dados) => execute(
    () => window.api.disciplinas.criar(dados),
    { id: Date.now(), ...dados }
  )

  const editarDisciplina = (id, dados) => execute(
    () => window.api.disciplinas.editar(id, dados),
    { id, ...dados }
  )

  const eliminarDisciplina = (id) => execute(
    () => window.api.disciplinas.eliminar(id),
    { success: true }
  )

  // Módulos
  const listarModulos = (disciplina_id) => execute(
    () => window.api.modulos.listar(disciplina_id),
    mockData.modulos
  )

  const criarModulo = (dados) => execute(
    () => window.api.modulos.criar(dados),
    { id: Date.now(), ...dados }
  )

  const editarModulo = (id, dados) => execute(
    () => window.api.modulos.editar(id, dados),
    { id, ...dados }
  )

  const eliminarModulo = (id) => execute(
    () => window.api.modulos.eliminar(id),
    { success: true }
  )

  // Turmas
  const listarTurmas = (disciplina_id) => execute(
    () => window.api.turmas.listar(disciplina_id),
    mockData.turmas
  )

  const criarTurma = (dados) => execute(
    () => window.api.turmas.criar(dados),
    { id: Date.now(), ...dados }
  )

  const editarTurma = (id, dados) => execute(
    () => window.api.turmas.editar(id, dados),
    { id, ...dados }
  )

  const eliminarTurma = (id) => execute(
    () => window.api.turmas.eliminar(id),
    { success: true }
  )

  // Horários
  const listarHorarios = (turma_id) => execute(
    () => window.api.horarios.listar(turma_id),
    mockData.horarios
  )

  const criarHorario = (dados) => execute(
    () => window.api.horarios.criar(dados),
    { id: Date.now(), ...dados }
  )

  const eliminarHorario = (id) => execute(
    () => window.api.horarios.eliminar(id),
    { success: true }
  )

  const editarHorario = (id, dados) => execute(
    () => window.api.horarios.editar(id, dados),
    { id, ...dados }
  )

  const eliminarHorariosDaTurma = (turma_id) => execute(
    () => window.api.horarios.eliminarDaTurma(turma_id),
    { success: true }
  )

  // Aulas
  const eliminarAulasDaDisciplina = (disciplina_id) => execute(
    () => window.api.aulas.eliminarDaDisciplina(disciplina_id),
    { success: true }
  )

  const listarAulas = (filtros) => execute(
    () => window.api.aulas.listar(filtros),
    mockData.aulas
  )

  const criarAula = (dados) => execute(
    () => window.api.aulas.criar(dados),
    { id: Date.now(), ...dados }
  )

  const editarAula = (id, dados) => execute(
    () => window.api.aulas.editar(id, dados),
    { id, ...dados }
  )

  const eliminarAula = (id) => execute(
    () => window.api.aulas.eliminar(id),
    { success: true }
  )

  const gerarAulasAutomatico = (turma_id, data_inicio, data_fim) => execute(
    () => window.api.aulas.gerarAutomatico(turma_id, data_inicio, data_fim),
    null
  )

  const proximoNumeroAula = (turma_id) => execute(
    () => window.api.aulas.proximoNumero(turma_id),
    1
  )

  // Dias Não Lectivos
  const listarDiasNaoLetivos = (ano) => execute(
    () => window.api.diasNaoLetivos.listar(ano),
    []
  )

  const criarDiaNaoLetivo = (dados) => execute(
    () => window.api.diasNaoLetivos.criar(dados),
    { id: Date.now(), ...dados }
  )

  const eliminarDiaNaoLetivo = (id) => execute(
    () => window.api.diasNaoLetivos.eliminar(id),
    { success: true }
  )

  const importarFeriadosNacionais = (ano) => execute(
    () => window.api.diasNaoLetivos.importarFeriados(ano),
    []
  )

  // Financeiro
  const calcularFinanceiroMensal = (ano, mes) => execute(
    () => window.api.financeiro.calcularMensal(ano, mes),
    { mes: `${ano}-${String(mes).padStart(2,'0')}`, itens: [], total_horas: 0, total_bruto: 0, taxa_iva: 0, total_iva: 0, total_com_iva: 0, taxa_irs: 0.25, total_irs: 0, total_liquido: 0 }
  )

  const calcularFinanceiroAnual = (ano) => execute(
    () => window.api.financeiro.calcularAnual(ano),
    []
  )

  const obterConfigFiscal = (ano) => execute(
    () => window.api.financeiro.obterConfig(ano),
    { ano, taxa_iva: 0, isento_iva: 0, taxa_retencao_irs: 0.25, sem_retencao: 0, notas: '' }
  )

  const salvarConfigFiscal = (dados) => execute(
    () => window.api.financeiro.salvarConfig(dados),
    dados
  )

  const listarValoresHora = (ano_letivo) => execute(
    () => window.api.financeiro.listarValoresHora(ano_letivo),
    []
  )

  const salvarValorHora = (dados) => execute(
    () => window.api.financeiro.salvarValorHora(dados),
    dados
  )

  // Períodos Não Letivos
  const listarPeriodosNaoLetivos = (instituicao_id) => execute(
    () => window.api.periodosNaoLetivos.listar(instituicao_id),
    []
  )
  const criarPeriodoNaoLetivo = (dados) => execute(
    () => window.api.periodosNaoLetivos.criar(dados),
    { id: Date.now(), ...dados }
  )
  const eliminarPeriodoNaoLetivo = (id) => execute(
    () => window.api.periodosNaoLetivos.eliminar(id),
    { success: true }
  )

  // Instituições
  const listarInstituicoes = () => execute(() => window.api.instituicoes.listar(), [])
  const criarInstituicao = (dados) => execute(() => window.api.instituicoes.criar(dados), { id: Date.now(), ...dados })
  const editarInstituicao = (id, dados) => execute(() => window.api.instituicoes.editar(id, dados), { id, ...dados })
  const eliminarInstituicao = (id) => execute(() => window.api.instituicoes.eliminar(id), { success: true })

  // Cursos
  const listarCursos = (instituicao_id) => execute(() => window.api.cursos.listar(instituicao_id), [])
  const criarCurso = (dados) => execute(() => window.api.cursos.criar(dados), { id: Date.now(), ...dados })
  const editarCurso = (id, dados) => execute(() => window.api.cursos.editar(id, dados), { id, ...dados })
  const eliminarCurso = (id) => execute(() => window.api.cursos.eliminar(id), { success: true })

  // Configurações
  const obterConfiguracoes = (chave) => execute(
    () => window.api.configuracoes.obter(chave),
    chave ? mockData.configuracoes[chave] : mockData.configuracoes
  )

  const salvarConfiguracoes = (dados) => execute(
    () => window.api.configuracoes.salvar(dados),
    { success: true }
  )

  // Estatísticas
  const obterEstatisticas = (ano_letivo) => execute(
    () => window.api.estatisticas.obter(ano_letivo),
    { porEstado: [], porDisciplina: [], evolucaoMensal: [], totalAulas: 0, realizadas: 0, taxaConclusao: 0 }
  )

  // Exportação PDF
  const exportarAulaPlano = (aula, config) => execute(
    () => window.api.exports.aulaPlano(aula, config),
    { success: false, error: 'Não disponível fora do Electron' }
  )

  const exportarRelatorioFinanceiro = (dados, tipo, ano, mes, config) => execute(
    () => window.api.exports.relatorioFinanceiro(dados, tipo, ano, mes, config),
    { success: false, error: 'Não disponível fora do Electron' }
  )

  const pesquisarGlobal = (query) => execute(
    () => window.api.pesquisa.global(query),
    { aulas: [], turmas: [], disciplinas: [] }
  )

  const exportarRelatorioTurma = (turma, horarios, aulas, config) => execute(
    () => window.api.exports.relatorioTurma(turma, horarios, aulas, config),
    { success: false, error: 'Não disponível fora do Electron' }
  )

  // Backup
  const exportarBackup = () => execute(
    () => window.api.backup.exportar(),
    { success: false, error: 'Não disponível fora do Electron' }
  )

  const reiniciarApp = () => window.api?.backup?.reiniciar?.()

  const importarBackup = () => execute(
    () => window.api.backup.importar(),
    { success: false, error: 'Não disponível fora do Electron' }
  )

  // Outros Rendimentos
  const listarOutrosRendimentos = (filtros) => execute(
    () => window.api.outrosRendimentos.listar(filtros),
    []
  )
  const criarOutroRendimento = (dados) => execute(
    () => window.api.outrosRendimentos.criar(dados),
    { id: Date.now(), ...dados }
  )
  const editarOutroRendimento = (id, dados) => execute(
    () => window.api.outrosRendimentos.editar(id, dados),
    { id, ...dados }
  )
  const eliminarOutroRendimento = (id) => execute(
    () => window.api.outrosRendimentos.eliminar(id),
    { success: true }
  )

  return {
    loading, error,
    listarDisciplinas, criarDisciplina, editarDisciplina, eliminarDisciplina,
    listarModulos, criarModulo, editarModulo, eliminarModulo,
    listarTurmas, criarTurma, editarTurma, eliminarTurma,
    listarHorarios, criarHorario, editarHorario, eliminarHorario, eliminarHorariosDaTurma,
    listarAulas, criarAula, editarAula, eliminarAula, gerarAulasAutomatico, proximoNumeroAula, eliminarAulasDaDisciplina,
    listarDiasNaoLetivos, criarDiaNaoLetivo, eliminarDiaNaoLetivo, importarFeriadosNacionais,
    calcularFinanceiroMensal, calcularFinanceiroAnual, obterConfigFiscal, salvarConfigFiscal,
    listarValoresHora, salvarValorHora,
    listarInstituicoes, criarInstituicao, editarInstituicao, eliminarInstituicao,
    listarCursos, criarCurso, editarCurso, eliminarCurso,
    obterConfiguracoes, salvarConfiguracoes,
    obterEstatisticas,
    exportarAulaPlano, exportarRelatorioFinanceiro, exportarRelatorioTurma,
    pesquisarGlobal, reiniciarApp,
    exportarBackup, importarBackup,
    listarOutrosRendimentos, criarOutroRendimento, editarOutroRendimento, eliminarOutroRendimento,
    listarPeriodosNaoLetivos, criarPeriodoNaoLetivo, eliminarPeriodoNaoLetivo
  }
}
