const fs = require('fs');
const path = require('path');

const file = path.resolve('c:/Users/Digix/OneDrive - GRUPO DIMEO/Documentos/La colectiva Web/Agente ia la colectiva/la-colectiva-v2/src/app/api/ai/chat/route.ts');

const src = fs.readFileSync(file, 'utf8');
let s = src;
let changed = false;

// 1) Reemplazar texto en caso sin globales
s = s.replace(
  /No hay preguntas generales, así que inicia seleccionando la categoría de servicio: \$\{cats\.join\(', '\)\}\./,
  'No hay preguntas generales, así que dime: ¿qué servicio necesitas cotizar?'
);
if (s !== src) changed = true;

// 2) Reemplazar texto tras terminar globales
s = s.replace(
  /Gracias\. Ahora selecciona la categoría de servicio: \$\{cats\.join\(', '\)\}\./,
  'Entendido. Ahora, ¿qué servicio necesitas cotizar?'
);
if (s !== src) changed = true;

// 3) Insertar handler PASO_2_ESPERANDO_SERVICIO antes del bloque de categoría
const marker = '    // --- PASO 2: Selección data-driven del servicio ---';
if (!s.includes("if (estado.step === 'PASO_2_ESPERANDO_SERVICIO'")) {
  const handler = [
    '    // --- PASO 2: Búsqueda abierta por servicio (v3.2) ---',
    "    if (estado.step === 'PASO_2_ESPERANDO_SERVICIO' && mensajeUsuario.length > 0) {",
    '      const entrada = normalizeText(mensajeUsuario)',
    '      const tokens = entrada.split(/\\s+/).filter(Boolean)',
    '      const { data: servRows, error: servErr } = await supabaseAuthed!\\n        .from(\'servicios\')\\n        .select(\'categoria, subcategoria_1, subcategoria_2\')',
    "      if (servErr) return NextResponse.json({ error: 'Error consultando servicios', details: servErr.message }, { status: 400 })",
    '      const rows = Array.isArray(servRows) ? servRows : []',
    '      const candidatosServ = rows',
    '        .map((r) => {',
    "          const servNorm = normalizeText(String(r.subcategoria_2 || ''))",
    "          const comboNorm = normalizeText((r.categoria || '') + ' ' + (r.subcategoria_1 || '') + ' ' + (r.subcategoria_2 || ''))",
    '          const hasIntersection = tokens.some((t) => servNorm.includes(t)) || tokens.some((t) => comboNorm.includes(t))',
    '          const contains = entrada.length >= 4 && (servNorm.includes(entrada) || comboNorm.includes(entrada))',
    '          const tokensSubset = tokens.length > 0 && tokens.every((t) => servNorm.includes(t) || comboNorm.includes(t))',
    '          const score = tokensSubset ? 3 : hasIntersection ? 2 : contains ? 1 : 0',
    '          return { raw: r, score: score, len: servNorm.length + comboNorm.length }',
    '        })',
    '        .filter((c) => c.score > 0)',
    '        .sort((a, b) => (b.score - a.score) || (b.len - a.len))',
    '',
    '      if (candidatosServ.length === 1) {',
    '        const elegido = candidatosServ[0].raw',
    '        const { data: preguntasEspec, error: peErr } = await supabaseAuthed!\\n          .from(\'brief_preguntas\')\\n          .select(\'*\')\\n          .eq(\'categoria\', elegido.categoria)\\n          .eq(\'subcategoria_1\', elegido.subcategoria_1)\\n          .eq(\'subcategoria_2\', elegido.subcategoria_2)\\n          .order(\'orden\', { ascending: true })',
    "        if (peErr) return NextResponse.json({ error: 'Error consultando preguntas específicas', details: peErr.message }, { status: 400 })",
    '        const arrE = Array.isArray(preguntasEspec) ? preguntasEspec : []',
    "        sessionStates.set(user.id, { step: 'PASO_3_ESPECIFICAS_PENDIENTES', clienteId: estado.clienteId || 0, clienteNombre: estado.clienteNombre || '', subdivision: estado.subdivision || null, servicioCategoria: elegido.categoria, subcategoria1: elegido.subcategoria_1, subcategoria2: elegido.subcategoria_2, preguntas: arrE, indice: 0, respuestasGlobales: estado.respuestasGlobales, respuestasEspecificas: {} })",
    "        const lead = 'Perfecto. Servicio: ' + elegido.categoria + ' / ' + elegido.subcategoria_1 + ' / ' + elegido.subcategoria_2 + '.'",
    "        const q0 = arrE[0] || {}",
    "        const textoQ = String((q0 as any).pregunta_texto || (q0 as any).pregunta || (q0 as any).texto || (q0 as any).enunciado || 'Primera pregunta específica')",
    "        return new NextResponse(lead + ' ' + textoQ, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })",
    '      }',
    '',
    '      if (candidatosServ.length > 1) {',
    '        const opciones = candidatosServ',
    '          .slice(0, Math.min(candidatosServ.length, 6))',
    '          .map((c) => c.raw)',
    "        sessionStates.set(user.id, { step: 'PASO_2_ESPERANDO_SERVICIO_AMBIGUO', clienteId: estado.clienteId || 0, clienteNombre: estado.clienteNombre || '', subdivision: estado.subdivision || null, opcionesServicios: opciones, respuestasGlobales: estado.respuestasGlobales })",
    "        const lista = opciones.map((r, i) => (i + 1) + '. ' + (String(r.categoria || '')).trim().toUpperCase() + ' / ' + (String(r.subcategoria_1 || '')).trim().toUpperCase() + ' / ' + (String(r.subcategoria_2 || '')).trim().toUpperCase()).join('\n')",
    "        const texto = 'Entendido. Encontré varios servicios posibles para \"' + mensajeUsuario + '\":\n' + lista + '\n¿Con cuál seguimos? Puedes responder con el número o el nombre completo.'",
    "        return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })",
    '      }',
    '',
    '      // Sin coincidencias: ofrecer guía y fallback suave',
    '      const { data: filasServ2 } = await supabaseAuthed!',
    "        .from('servicios')",
    "        .select('categoria')",
    "        .order('categoria', { ascending: true })",
    '      const cats2 = Array.from(new Set((filasServ2 || []).map((r) => r.categoria).filter(Boolean)))',
    "      const texto = 'No encontré un servicio que coincida con \"' + mensajeUsuario + '\". Puedes intentar con otra descripción o elegir una categoría: ' + cats2.join(', ') + '.'",
    "      return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })",
    '    }'
  ].join('\n');

  if (s.includes(marker)) {
    s = s.replace(marker, handler + '\n' + marker);
    changed = true;
  }
}

if (!changed) {
  console.log('No changes applied (markers not found or already patched).');
} else {
  fs.writeFileSync(file, s, 'utf8');
  console.log('Patch applied successfully.');
}
