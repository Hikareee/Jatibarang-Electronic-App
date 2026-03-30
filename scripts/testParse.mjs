import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(process.cwd())
const csvPath = path.resolve('/Users/nick/Downloads/Untitled spreadsheet - Upah Bahan.csv')
if (!fs.existsSync(csvPath)) {
  console.error('CSV not found at', csvPath)
  process.exit(2)
}
const text = fs.readFileSync(csvPath, { encoding: 'utf8' })
const buffer = Buffer.from(text, 'utf8')

// import parser
const parserPath = path.join(repoRoot, 'src/utils/rabImportMaterials.js')
const parser = await import('file://' + parserPath)

async function run() {
  const fakeFile = {
    name: path.basename(csvPath),
    text: async () => text,
    arrayBuffer: async () => buffer.buffer,
  }

  try {
    const rows = await parser.parseUniversalImportFile(fakeFile)
    console.log('Parsed rows count:', Array.isArray(rows) ? rows.length : 0)
    if (Array.isArray(rows)) {
      console.log('Sample rows:', JSON.stringify(rows.slice(0, 20), null, 2))
      const missing = rows.filter(r => r.price === null || r.price === undefined || r.price === '')
      console.log('Missing price count:', missing.length)
    }
  } catch (err) {
    console.error('Parser error:', err)
    process.exit(1)
  }
}

run()
