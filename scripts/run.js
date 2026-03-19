#!/usr/bin/env node
// Script de desenvolvimento: compila + atualiza o app.asar + lança o PlanAula.exe
const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const ASAR_PATH = path.join(ROOT, 'release/win-unpacked/resources/app.asar')
const ELECTRON_EXE = path.join(ROOT, 'release/win-unpacked/PlanAula.exe')

// 1. Compilar com electron-vite
console.log('\n🔨 A compilar...')
try {
  execSync('npx electron-vite build', { cwd: ROOT, stdio: 'inherit' })
} catch (e) {
  process.exit(1)
}

// 2. Atualizar o asar com os novos ficheiros dist/
if (fs.existsSync(ASAR_PATH)) {
  console.log('\n📦 A atualizar o pacote...')
  try {
    const asar = require('@electron/asar')
    // Criar asar temporário com os novos dist files
    const tmpDir = path.join(ROOT, '.tmp-app')
    // Extrair asar atual para preservar node_modules
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true })
    asar.extractAll(ASAR_PATH, tmpDir)
    // Copiar novos dist files
    copyDir(path.join(ROOT, 'dist'), path.join(tmpDir, 'dist'))
    // Reempacotar
    asar.createPackage(tmpDir, ASAR_PATH).then(() => {
      fs.rmSync(tmpDir, { recursive: true })
      console.log('✅ Pacote atualizado')
      launchApp()
    }).catch(err => {
      console.error('Erro ao reempacotar:', err.message)
      fs.rmSync(tmpDir, { recursive: true })
      launchApp()
    })
  } catch (e) {
    console.warn('Aviso: não foi possível atualizar o asar:', e.message)
    launchApp()
  }
} else {
  console.warn('\n⚠️  PlanAula.exe não encontrado. Corre "npm run build" primeiro.')
  process.exit(1)
}

function launchApp() {
  console.log('\n🚀 A lançar PlanAula...')
  const proc = spawn(ELECTRON_EXE, [], { detached: true, stdio: 'ignore' })
  proc.unref()
  console.log('✅ PlanAula em execução\n')
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}
