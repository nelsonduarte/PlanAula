import React from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard',    label: 'Painel',       icon: '🏠' },
  { to: '/disciplinas',  label: 'Disciplinas',  icon: '📚' },
  { to: '/turmas',       label: 'Turmas',       icon: '👥' },
  { to: '/aulas',        label: 'Aulas',        icon: '📝' },
  { to: '/calendario',   label: 'Calendário',   icon: '📅' },
  { to: '/financeiro',   label: 'Financeiro',   icon: '💰' },
  { to: '/estatisticas', label: 'Estatísticas', icon: '📊' },
  { to: '/definicoes',   label: 'Definições',   icon: '⚙️' },
]

export default function Sidebar({ collapsed }) {
  return (
    <aside className={`h-full flex flex-col bg-gray-900 dark:bg-gray-950 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-700 ${collapsed ? 'justify-center px-2' : ''}`}>
        <span className="text-2xl flex-shrink-0">🎓</span>
        {!collapsed && (
          <div>
            <p className="font-bold text-white leading-tight">PlanAula</p>
            <p className="text-gray-400 text-xs">Planeador de Aulas</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {!collapsed && (
              <span className="text-sm font-medium truncate">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-700">
          <p className="text-xs text-gray-500">v1.0.0</p>
        </div>
      )}
    </aside>
  )
}
