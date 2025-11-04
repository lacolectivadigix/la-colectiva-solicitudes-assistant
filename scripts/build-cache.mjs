#!/usr/bin/env node
/**
 * Build and upload daily cache JSON files to Supabase Storage (bucket: cache)
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Outputs: cache/clientes.json, cache/servicios.json, cache/brief_preguntas.json
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

async function uploadJSON(bucket, path, data) {
  const json = JSON.stringify(data, null, 2)
  const { error } = await supabase.storage.from(bucket).upload(path, new Blob([json], { type: 'application/json' }), {
    upsert: true,
    contentType: 'application/json',
  })
  if (error) throw new Error(`Upload failed for ${bucket}/${path}: ${error.message}`)
}

async function build() {
  try {
    console.log('Building cache...')

    const { data: clientes, error: clientesErr } = await supabase
      .from('clientes_digix')
      .select('id, cliente, division_pais')
    if (clientesErr) throw clientesErr

    const { data: servicios, error: serviciosErr } = await supabase
      .from('servicios')
      .select('id, categoria, subcategoria_1, subcategoria_2')
    if (serviciosErr) throw serviciosErr

    const { data: preguntas, error: preguntasErr } = await supabase
      .from('brief_preguntas')
      .select('id, pregunta_texto, categoria, subcategoria_1, subcategoria_2, orden')
      .order('orden', { ascending: true })
    if (preguntasErr) throw preguntasErr

    console.log(`Rows fetched: clientes=${(clientes||[]).length}, servicios=${(servicios||[]).length}, preguntas=${(preguntas||[]).length}`)

    await uploadJSON('cache', 'clientes.json', clientes || [])
    await uploadJSON('cache', 'servicios.json', servicios || [])
    await uploadJSON('cache', 'brief_preguntas.json', preguntas || [])

    console.log('Cache uploaded to Storage bucket "cache"')
  } catch (err) {
    console.error('Cache build failed:', err?.message || err)
    process.exit(1)
  }
}

build()