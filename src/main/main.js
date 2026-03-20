import { app, BrowserWindow, Notification } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import { runMigrations } from './database/migrations.js'
import { registerHandlers } from './ipc-handlers.js'
import { closeDb } from './database/db.js'
import { buscarAvaliacoesAmanha } from './database/models.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow

function createWindow() {
  const isDev = !app.isPackaged
  const iconPath = isDev
    ? path.join(__dirname, '../../build/icon.ico')
    : path.join(process.resourcesPath, 'icon.ico')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#f8fafc',
    icon: iconPath
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    // Notificar avaliações de amanhã
    if (Notification.isSupported()) {
      try {
        const avaliacoes = buscarAvaliacoesAmanha()
        for (const a of avaliacoes) {
          const titulo = `Avaliação amanhã — ${a.disciplina_nome}`
          const corpo = `${a.turma_nome}${a.topico ? ` · ${a.topico}` : ''}${a.hora_inicio ? ` · ${a.hora_inicio}` : ''}`
          new Notification({ title: titulo, body: corpo }).show()
        }
      } catch (e) {
        console.error('Erro ao verificar avaliações:', e)
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  try {
    runMigrations()
    registerHandlers()
  } catch (err) {
    console.error('Erro na inicialização:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDb()
})
