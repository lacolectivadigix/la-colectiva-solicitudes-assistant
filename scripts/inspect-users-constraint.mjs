import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(process.cwd())
function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) return
    const [, key, rawVal] = m
    const val = rawVal.replace(/^"|"$/g, '')
    if (!process.env[key]) process.env[key] = val
  })
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) throw new Error('Falta config supabase')
const admin = createClient(url, service)

async function main() {
  const { data: cons, error } = await admin
    .from('information_schema.check_constraints')
    .select('constraint_name, check_clause')
    .like('constraint_name', '%password_hash_format%')
  if (error) throw error
  console.log(cons)
}

main().catch(err => { console.error(err); process.exitCode = 1 })