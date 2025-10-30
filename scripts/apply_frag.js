const fs=require('fs');
const p='src\\app\\api\\ai\\chat\\route.ts';
const fragPath='scripts\\paso2_v32_block.tsfrag';
let s=fs.readFileSync(p,'utf8');
let frag=fs.readFileSync(fragPath,'utf8');
const marker='// --- PASO 2: Selección data-driven del servicio ---';
const idx=s.indexOf(marker);
if(idx!==-1 && !s.includes("estado.step === 'PASO_2_ESPERANDO_SERVICIO'")){
  s = s.slice(0, idx) + frag + s.slice(idx);
  fs.writeFileSync(p, s);
  console.log('Inserted fragment before marker.');
} else {
  console.log('Marker not found or handler already present.');
}
