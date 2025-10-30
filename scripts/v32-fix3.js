const fs=require('fs');
const p='src\\app\\api\\ai\\chat\\route.ts';
let s=fs.readFileSync(p,'utf8');
// 1) Ensure new state exists in union (idempotent)
if(!s.includes("| { step: 'PASO_2_ESPERANDO_SERVICIO'")){
  s=s.replace("| { step: 'PASO_1_ESPERANDO_CLIENTE'", "| { step: 'PASO_1_ESPERANDO_CLIENTE'\n  | { step: 'PASO_2_ESPERANDO_SERVICIO'; clienteId: number; clienteNombre: string; subdivision: string | null; respuestasGlobales: Record<string, string> }");
}
// 2) Update transitions to new state
s=s.replace(/(sessionStates\.set\(user\.id,\s*\{[\s\S]*?step:\s*')PASO_2_ESPERANDO_CATEGORIA'([^\n]*\n)/g, "$1PASO_2_ESPERANDO_SERVICIO'$2");
// 3) Replace transition messages to open service question
s=s.replace(/const texto = `Gracias\. Ahora selecciona la categoría de servicio:[^`]*`;/g, "const texto = 'Entendido. Ahora, ¿qué servicio necesitas cotizar?';");
s=s.replace(/const texto = `¡Claro! Empecemos tu solicitud\. No hay preguntas generales, así que inicia seleccionando la categoría de servicio:[^`]*`;/g, "const texto = '¡Claro! Empecemos tu solicitud. Entendido. Ahora, ¿qué servicio necesitas cotizar?';");
// 4) Insert new handler before category block if missing
if(!s.includes("estado.step === 'PASO_2_ESPERANDO_SERVICIO'")){
  const marker='// --- PASO 2: Selección data-driven del servicio ---';
  const idx=s.indexOf(marker);
  if(idx!==-1){
    const block=['',
      '    // --- PASO 2 v3.2: Búsqueda abierta de servicio con ILIKE en 3 columnas ---',
      "    if (estado.step === 'PASO_2_ESPERANDO_SERVICIO' && mensajeUsuario.length > 0) {",
      '      const termino = mensajeUsuario.trim();',
      "      const patron = '%' + termino + '%';",
      "      const { data: servMatches, error: servErr } = await supabaseAuthed!",
      "        .from('servicios')",
      "        .select('id, categoria, subcategoria_1, subcategoria_2')",
      "        .or('categoria.ilike.' + patron + ',subcategoria_1.ilike.' + patron + ',subcategoria_2.ilike.' + patron)",
      '        .limit(20);',
      "      if (servErr) return NextResponse.json({ error: 'Error buscando servicios', details: servErr.message }, { status: 400 });",
      '      const rows = Array.isArray(servMatches) ? servMatches : [];',
      '',
      '      if (rows.length === 0) {',
      "        const texto = 'No he podido encontrar el servicio \'" + "' + termino + "'" + "\' en nuestra base de datos. ¿Puedes intentarlo de nuevo?';",
      "        return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });",
      '      }',
      '',
      '      const nInput = normalizeText(termino);',
      '      const exactos = rows.filter(r => {',
      "        const nc = normalizeText(String(r.categoria || ''));",
      "        const n1 = normalizeText(String(r.subcategoria_1 || ''));",
      "        const n2 = normalizeText(String(r.subcategoria_2 || ''));",
      '        return nc === nInput || n1 === nInput || n2 === nInput;',
      '      });',
      '',
      '      const elegido = (exactos.length === 1 ? exactos[0] : (rows.length === 1 ? rows[0] : null));',
      '      if (elegido) {',
      "        const { data: preguntasEspec, error: peErr } = await supabaseAuthed!",
      "          .from('brief_preguntas')",
      "          .select('*')",
      "          .eq('categoria', elegido.categoria)",
      "          .eq('subcategoria_1', elegido.subcategoria_1)",
      "          .eq('subcategoria_2', elegido.subcategoria_2)",
      "          .order('orden', { ascending: true });",
      "        if (peErr) return NextResponse.json({ error: 'Error consultando preguntas específicas', details: peErr.message }, { status: 400 });",
      '        const arrE = Array.isArray(preguntasEspec) ? preguntasEspec : [];',
      '        sessionStates.set(user.id, {',
      "          step: 'PASO_3_ESPECIFICAS_PENDIENTES',",
      '          clienteId: estado.clienteId,',
      '          clienteNombre: estado.clienteNombre,',
      '          subdivision: estado.subdivision,',
      '          servicioCategoria: elegido.categoria,',
      '          subcategoria1: elegido.subcategoria_1,',
      '          subcategoria2: elegido.subcategoria_2,',
      '          preguntas: arrE,',
      '          indice: 0,',
      '          respuestasGlobales: estado.respuestasGlobales,',
      '          respuestasEspecificas: {}',
      '        });',
      "        const lead = '¡Perfecto! Para tu solicitud de \'" + String(elegido.subcategoria_2 || elegido.subcategoria_1 || elegido.categoria) + "\', necesito hacerte unas preguntas...';",
      '        const q0 = arrE[0] || {};',
      "        const textoQ = String((q0 as any).pregunta_texto || (q0 as any).pregunta || (q0 as any).texto || (q0 as any).enunciado || 'Primera pregunta específica');",
      "        return new NextResponse(lead + ' ' + textoQ, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });",
      '      }',
      '',
      '      const opciones = rows.slice(0, Math.min(rows.length, 10));',
      '      sessionStates.set(user.id, {',
      "        step: 'PASO_2_ESPERANDO_SERVICIO_AMBIGUO',",
      '        clienteId: estado.clienteId,',
      '        clienteNombre: estado.clienteNombre,',
      '        subdivision: estado.subdivision,',
      '        opcionesServicios: opciones.map(r => ({ categoria: r.categoria, subcategoria_1: r.subcategoria_1, subcategoria_2: r.subcategoria_2 })),',
      '        respuestasGlobales: estado.respuestasGlobales',
      '      });',
      "      const lista = opciones.map((r: any, i: number) => (i + 1) + '. ' + (String(r.categoria || '')).trim().toUpperCase() + ' / ' + (String(r.subcategoria_1 || '')).trim().toUpperCase() + ' / ' + (String(r.subcategoria_2 || '')).trim().toUpperCase()).join('\\n');",
      "      const texto = 'Entendido. Al buscar \'" + termino + "\', encontré ' + opciones.length + ' opciones:\\n' + lista + '\\n¿A cuál te refieres?';",
      "      return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });",
      '    }',
      ''
    ].join('\n');
    s = s.slice(0, idx) + block + s.slice(idx);
  }
}
fs.writeFileSync(p,s);
