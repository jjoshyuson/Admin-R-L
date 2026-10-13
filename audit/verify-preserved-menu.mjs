import fs from 'node:fs/promises'
import crypto from 'node:crypto'
const env = Object.fromEntries((await fs.readFile('.env.local','utf8')).split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i).trim(),line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}))
const backup = process.env.RNL_MENU_BACKUP || (await fs.readFile('/tmp/rnl-backup-audit/backup-path.txt','utf8')).trim()
const manifest = JSON.parse(await fs.readFile(`${backup}/manifest.json`,'utf8'))
const results = []
for (const table of ['products','categories']) {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc&limit=500`,{headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}`}})
  if (!response.ok) throw new Error(`Read failed: ${table} HTTP ${response.status}`)
  const rows=await response.json()
  const hash=crypto.createHash('sha256').update(JSON.stringify(rows,null,2)+'\n').digest('hex')
  const unchanged=hash===manifest.tables[table].sha256
  results.push({table,count:rows.length,unchanged})
  if (!unchanged) throw new Error(`Protected ${table} differs from backup`)
}
console.log(JSON.stringify(results))
