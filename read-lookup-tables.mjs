#!/usr/bin/env node
/**
 * Reads mc://context/lookup-tables from the MC MCP server via stdio.
 * Usage: node read-lookup-tables.mjs [--mc-dir /path/to/fm-360/mc-mcp]
 */

import { spawn } from 'child_process'
import { resolve } from 'path'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    'mc-dir': { type: 'string', default: process.env.MC_MCP_DIR ?? './mc-mcp' },
  },
})

const mcDir = resolve(values['mc-dir'])

// ── MCP JSON-RPC over stdio ──────────────────────────────────────────────────

let msgId = 1
const pending = new Map()
let buffer = ''

function send(proc, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    pending.set(id, { resolve, reject })
    proc.stdin.write(msg + '\n')
  })
}

function handleData(chunk) {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() // keep incomplete line
  for (const line of lines) {
    if (!line.trim()) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message ?? JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const proc = spawn('bun', ['run', 'dev'], {
  cwd: mcDir,
  stdio: ['pipe', 'pipe', 'inherit'],
})

proc.stdout.setEncoding('utf8')
proc.stdout.on('data', handleData)
proc.on('error', (err) => {
  console.error('Failed to start MC MCP:', err.message)
  process.exit(1)
})

// Give the process a moment to boot, then initialize
await new Promise((r) => setTimeout(r, 1500))

try {
  // 1. Initialize
  await send(proc, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: { resources: {} },
    clientInfo: { name: 'lookup-table-reader', version: '1.0.0' },
  })

  // 2. Send initialized notification
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

  // 3. Read the resource
  const result = await send(proc, 'resources/read', {
    uri: 'mc://context/lookup-tables',
  })

  // 4. Parse and display
  const text = result?.contents?.[0]?.text
  if (!text) {
    console.error('Unexpected response shape:', JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const payload = JSON.parse(text)
  const tables = Array.isArray(payload.tables) ? payload.tables : []

  console.log(`\nTotal lookup tables: ${payload.totalTables ?? tables.length}\n`)
  console.log('First 5 lookup tables:\n')

  tables.slice(0, 5).forEach((table, i) => {
    const valueCount = table.valueCount ?? (Array.isArray(table.values) ? table.values.length : 0)
    const preview = (table.values ?? [])
      .slice(0, 3)
      .map((v) => `${v.codeName}${v.description ? `: ${v.description}` : ''}`)
      .join(', ')

    console.log(`${i + 1}. ${table.lookupTableID}`)
    console.log(`   Description: ${table.description ?? '(none)'}`)
    console.log(`   Values: ${valueCount}`)
    console.log(`   Preview: ${preview}${valueCount > 3 ? ', ...' : ''}\n`)
  })
} catch (err) {
  console.error('Error:', err.message)
} finally {
  proc.kill()
}
