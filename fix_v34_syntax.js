const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src', 'app', 'api', 'ai', 'chat', 'route.ts');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf("if (estado.step === 'PASO_2_ESPERANDO_SERVICIO'");
let end = -1;
if (start !== -1) {
  end = s.indexOf("if (estado.step === 'PASO_2_ESPERANDO_CATEGORIA'", start);
}
if (start !== -1 && end !== -1) {
  let block = s.slice(start, end);
  block = block.replace(/supabaseAuthed!\\n\\s*\.from\('servicios'\)\\n\\s*\.select\('categoria, subcategoria_1, subcategoria_2'\)/g,
    "supabaseAuthed!\n        .from('servicios')\n        .select('categoria, subcategoria_1, subcategoria_2')");
  block = block.replace(/supabaseAuthed!\\n\\s*\.from\('brief_preguntas'\)\\n\\s*\.select\('\*'\)\\n\\s*\.eq\('categoria', elegido\.categoria\)\\n\\s*\.eq\('subcategoria_1', elegido\.subcategoria_1\)\\n\\s*\.eq\('subcategoria_2', elegido\.subcategoria_2\)\\n\\s*\.order\('orden', \{ ascending: true \}\)/g,
    "supabaseAuthed!\n          .from('brief_preguntas')\n          .select('*')\n          .eq('categoria', elegido.categoria)\n          .eq('subcategoria_1', elegido.subcategoria_1)\n          .eq('subcategoria_2', elegido.subcategoria_2)\n          .order('orden', { ascending: true })");
  // fix broken join('') into join('\n') within this block
  block = block.replace(/\.join\('\s*'\)/g, ".join('\\n')");
  // normalize texto line
  block = block.replace(/const texto =[^;]+;/g,
    "const texto = 'Entendido. Encontré varios servicios posibles para \"' + mensajeUsuario + '\":\\n' + lista + '\n¿Con cuál seguimos? Puedes responder con el número o el nombre completo.';");
  s = s.slice(0, start) + block + s.slice(end);
  fs.writeFileSync(p, s, 'utf8');
  console.log('Applied v3.4 syntax fix to PASO_2_ESPERANDO_SERVICIO block.');
} else {
  console.error('Could not locate PASO_2_ESPERANDO_SERVICIO block boundaries.');
}
