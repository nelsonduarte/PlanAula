import React, { createContext, useContext, useState } from 'react'

// ── Modo de trabalho global ──────────────────────────────────────────────────
// 'ensino'   — universidade/politécnico (disciplinas, semestres, horários semanais)
// 'formacao' — formação profissional (UFCDs, sessões com data específica)
// 'todos'    — sem filtro
// O modo é persistido em localStorage e propagado por contexto React.
// Páginas que listam disciplinas/turmas/aulas/cursos filtram pelo modo.
// Ecrãs financeiros (Financeiro, Estatísticas, Folha de Horas) ignoram o modo — agregam tudo.

const STORAGE_KEY = 'planaula:modo_trabalho'
const ModoTrabalhoContext = createContext(null)

export function ModoTrabalhoProvider({ children }) {
  const [modo, setModoState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'todos' } catch { return 'todos' }
  })

  function setModo(novo) {
    setModoState(novo)
    try { localStorage.setItem(STORAGE_KEY, novo) } catch {}
  }

  return (
    <ModoTrabalhoContext.Provider value={{ modo, setModo }}>
      {children}
    </ModoTrabalhoContext.Provider>
  )
}

export function useModoTrabalho() {
  return useContext(ModoTrabalhoContext) || { modo: 'todos', setModo: () => {} }
}

// ── Helpers de filtragem ─────────────────────────────────────────────────────

// Devolve true se um item (com disciplina_tipo ou tipo='UFCD') passa no modo actual
export function disciplinaPassaModo(disciplina, modo) {
  if (modo === 'todos') return true
  const ehUFCD = disciplina?.tipo === 'UFCD'
  return modo === 'formacao' ? ehUFCD : !ehUFCD
}

// Para turmas/aulas que trazem disciplina_tipo via JOIN
export function itemDisciplinaTipoPassaModo(item, modo) {
  if (modo === 'todos') return true
  const ehUFCD = item?.disciplina_tipo === 'UFCD'
  return modo === 'formacao' ? ehUFCD : !ehUFCD
}

// Para cursos — pelo tipo do curso
export function cursoPassaModo(curso, modo) {
  if (modo === 'todos') return true
  const ehFormacao = curso?.tipo === 'formação'
  return modo === 'formacao' ? ehFormacao : !ehFormacao
}

// ── Terminologia adaptada ao modo ────────────────────────────────────────────
// Em modo 'formacao' usa-se a terminologia IEFP (UFCD, sessão, sumário…).
// Nos restantes (ensino, todos) usa-se a terminologia universitária.
const TERMOS_FORMACAO = {
  disciplinas: 'UFCDs',
  disciplina: 'UFCD',
  novaDisciplina: 'Nova UFCD',
  semDisciplinas: 'Sem UFCDs',
  aulas: 'Sessões',
  aula: 'Sessão',
  novaAula: 'Nova Sessão',
  topico: 'Sumário',
}
const TERMOS_ENSINO = {
  disciplinas: 'Disciplinas',
  disciplina: 'Disciplina',
  novaDisciplina: 'Nova Disciplina',
  semDisciplinas: 'Sem disciplinas',
  aulas: 'Aulas',
  aula: 'Aula',
  novaAula: 'Nova Aula',
  topico: 'Tópico',
}

export function useTermos() {
  const { modo } = useModoTrabalho()
  return modo === 'formacao' ? TERMOS_FORMACAO : TERMOS_ENSINO
}
