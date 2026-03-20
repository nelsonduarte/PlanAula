import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase.js'

const DIAS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function fmtData(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return `${DIAS_PT[dt.getDay()]} ${dt.toLocaleDateString('pt-PT')}`
}

export default function PesquisaGlobal() {
  const db = useDatabase()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState({ aulas: [], turmas: [], disciplinas: [] })
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const inputRef = useRef(null)
  const overlayRef = useRef(null)
  const timerRef = useRef(null)

  // Ctrl+K abre a pesquisa
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setAberto(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) fechar()
    }
    if (aberto) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto])

  function fechar() {
    setAberto(false)
    setQuery('')
    setResultados({ aulas: [], turmas: [], disciplinas: [] })
    setCursor(-1)
  }

  // Debounce da pesquisa
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.trim().length < 2) {
      setResultados({ aulas: [], turmas: [], disciplinas: [] })
      return
    }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      const r = await db.pesquisarGlobal(query)
      setResultados(r || { aulas: [], turmas: [], disciplinas: [] })
      setCursor(-1)
      setLoading(false)
    }, 200)
    return () => clearTimeout(timerRef.current)
  }, [query])

  // Todos os itens navegáveis em ordem
  const itens = [
    ...resultados.aulas.map(a => ({ tipo: 'aula', dado: a })),
    ...resultados.turmas.map(t => ({ tipo: 'turma', dado: t })),
    ...resultados.disciplinas.map(d => ({ tipo: 'disciplina', dado: d })),
  ]

  function navegar(item) {
    if (item.tipo === 'aula') navigate('/aulas')
    else if (item.tipo === 'turma') navigate('/turmas')
    else if (item.tipo === 'disciplina') navigate('/disciplinas')
    fechar()
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, itens.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
    else if (e.key === 'Enter' && cursor >= 0) { navegar(itens[cursor]) }
  }

  const temResultados = itens.length > 0
  const pesquisou = query.trim().length >= 2

  return (
    <>
      {/* Botão na topbar */}
      <button
        onClick={() => { setAberto(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        title="Pesquisa global (Ctrl+K)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Pesquisar</span>
        <kbd className="hidden sm:inline text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded px-1">Ctrl+K</kbd>
      </button>

      {/* Overlay */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm">
          <div ref={overlayRef} className="w-full max-w-xl mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pesquisar aulas, turmas, disciplinas..."
                className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-base"
              />
              {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
              <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 flex-shrink-0">Esc</kbd>
            </div>

            {/* Resultados */}
            <div className="max-h-96 overflow-y-auto">
              {!pesquisou ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Digite pelo menos 2 caracteres para pesquisar</p>
              ) : !temResultados && !loading ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Sem resultados para "{query}"</p>
              ) : (
                <>
                  {resultados.aulas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">Aulas</p>
                      {resultados.aulas.map((a, i) => {
                        const idx = i
                        return (
                          <button key={a.id} onClick={() => navegar({ tipo: 'aula', dado: a })}
                            className={`w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${cursor === idx ? 'bg-gray-50 dark:bg-gray-700' : ''}`}>
                            <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: a.turma_cor || '#3B82F6' }} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.topico || '(sem tópico)'}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{a.disciplina_nome} · {a.turma_nome} · {fmtData(a.data)} · {a.hora_inicio}–{a.hora_fim}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {resultados.turmas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">Turmas</p>
                      {resultados.turmas.map((t, i) => {
                        const idx = resultados.aulas.length + i
                        return (
                          <button key={t.id} onClick={() => navegar({ tipo: 'turma', dado: t })}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${cursor === idx ? 'bg-gray-50 dark:bg-gray-700' : ''}`}>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.cor || '#3B82F6' }} />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.designacao}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{t.disciplina_nome} · {t.ano_letivo}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {resultados.disciplinas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">Disciplinas</p>
                      {resultados.disciplinas.map((d, i) => {
                        const idx = resultados.aulas.length + resultados.turmas.length + i
                        return (
                          <button key={d.id} onClick={() => navegar({ tipo: 'disciplina', dado: d })}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${cursor === idx ? 'bg-gray-50 dark:bg-gray-700' : ''}`}>
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{d.nome}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{d.codigo}{d.carga_horaria ? ` · ${d.carga_horaria}h` : ''}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {temResultados && (
              <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                <span>↑↓ navegar</span>
                <span>Enter selecionar</span>
                <span>Esc fechar</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
