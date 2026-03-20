import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Disciplinas from './pages/Disciplinas.jsx'
import Turmas from './pages/Turmas.jsx'
import Aulas from './pages/Aulas.jsx'
import Calendario from './pages/Calendario.jsx'
import Financeiro from './pages/Financeiro.jsx'
import Estatisticas from './pages/Estatisticas.jsx'
import Cursos from './pages/Cursos.jsx'
import Definicoes from './pages/Definicoes.jsx'
import Importar from './pages/Importar.jsx'
import Ajuda from './pages/Ajuda.jsx'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="disciplinas" element={<Disciplinas />} />
          <Route path="turmas" element={<Turmas />} />
          <Route path="aulas" element={<Aulas />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="cursos" element={<Cursos />} />
          <Route path="estatisticas" element={<Estatisticas />} />
          <Route path="definicoes" element={<Definicoes />} />
          <Route path="importar" element={<Importar />} />
          <Route path="ajuda" element={<Ajuda />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
