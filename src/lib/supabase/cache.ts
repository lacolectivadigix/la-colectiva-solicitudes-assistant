export function getPublicStorageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const cleanBase = base.replace(/\/$/, '')
  const cleanPath = String(path || '').replace(/^\/+/, '')
  return `${cleanBase}/storage/v1/object/public/${cleanPath}`
}

export async function readStorageJSON(path: string): Promise<any[] | null> {
  try {
    const url = getPublicStorageUrl(path)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json().catch(() => null)
    if (!json || (typeof json !== 'object')) return null
    return Array.isArray(json) ? json : null
  } catch {
    return null
  }
}

export async function readLocalJSON(publicPath: string): Promise<any[] | null> {
  try {
    const clean = String(publicPath || '').replace(/^\/+/, '')
    const filePath = path.join(process.cwd(), 'public', clean)
    const buf = await fs.readFile(filePath)
    const json = JSON.parse(buf.toString('utf-8'))
    return Array.isArray(json) ? json : null
  } catch {
    return null
  }
}
import path from 'node:path'
import fs from 'node:fs/promises'