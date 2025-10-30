const fs=require('fs');
const p='src\\app\\api\\ai\\chat\\route.ts';
let s=fs.readFileSync(p,'utf8');
// 1) Update two transitions from CATEGORIA -> SERVICIO and messages
s=s.replace("step: 'PASO_2_ESPERANDO_CATEGORIA', clienteId, clienteNombre, subdivision, respuestasGlobales: respuestas","step: 'PASO_2_ESPERANDO_SERVICIO', clienteId, clienteNombre, subdivision, respuestasGlobales: respuestas");
s=s.replace("const texto = `Gracias. Ahora selecciona la categoría de servicio: ${cats.join(', ')}.`","const texto = 'Entendido. Ahora, ¿qué servicio necesitas cotizar?'");
s=s.replace("step: 'PASO_2_ESPERANDO_CATEGORIA', clienteId: 0, clienteNombre: '', subdivision: null, respuestasGlobales: {}","step: 'PASO_2_ESPERANDO_SERVICIO', clienteId: 0, clienteNombre: '', subdivision: null, respuestasGlobales: {}");
s=s.replace(/const texto = `¡Claro! Empecemos tu solicitud\. No hay preguntas generales, así que inicia seleccionando la categoría de servicio: .*?`;/,"const texto = '¡Claro! Empecemos tu solicitud. Entendido. Ahora, ¿qué servicio necesitas cotizar?';");
// 2) Insert new handler before the category block marker
if(!s.includes("estado.step === 'PASO_2_ESPERANDO_SERVICIO'")){
  const rx=/\n\s*\/\/\s*---\s*PASO 2:\s*Selección data-driven del servicio\s*---/;
  const m=s.match(rx);
  if(m){
    const idx=m.index;
    const frag=fs.readFileSync('scripts\\paso2_v32_block.tsfrag','utf8');
    s=s.slice(0,idx)+"\n"+frag+s.slice(idx);
  }
}
fs.writeFileSync(p,s);
console.log('Applied v3.2 fix.');
