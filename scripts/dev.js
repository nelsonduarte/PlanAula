#!/usr/bin/env node
// Launch electron-vite dev with ELECTRON_RUN_AS_NODE unset
// (VSCode sets this env var which breaks Electron when run as a GUI app)
const { exec } = require('child_process')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = exec('npx electron-vite dev', { env })
child.stdout.pipe(process.stdout)
child.stderr.pipe(process.stderr)
process.stdin.pipe(child.stdin)
child.on('close', (code) => process.exit(code || 0))
