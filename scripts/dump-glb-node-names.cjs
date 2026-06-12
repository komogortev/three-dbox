// Survey helper: dump OWLib entity-pattern node names from a GLB's JSON chunk.
// Usage: node scripts/dump-glb-node-names.cjs public/maps/chateau-guillard.glb [searchRegex]
const fs = require('fs')

const [, , glbPath, searchRaw] = process.argv
const buf = fs.readFileSync(glbPath)
const jsonLen = buf.readUInt32LE(12)
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
const names = (json.nodes ?? []).map(n => n.name ?? '')

console.log(`total nodes: ${names.length}`)

if (searchRaw) {
  const re = new RegExp(searchRaw, 'i')
  const hits = names.filter(n => re.test(n))
  console.log(`search /${searchRaw}/i hits: ${hits.length}`)
  for (const h of hits.slice(0, 30)) console.log('  ' + h)
}

// Entity-pattern census: 00000000<TypeHex4><Instance3>
const entRe = /^00000000([0-9A-Fa-f]{4})(\d{3})$/
const counts = new Map()
for (const n of names) {
  const m = n.match(entRe)
  if (m) counts.set(m[1].toUpperCase(), (counts.get(m[1].toUpperCase()) ?? 0) + 1)
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
console.log(`entity-pattern node types: ${sorted.length}`)
console.log(sorted.map(([t, c]) => `${t}x${c}`).join(' '))
