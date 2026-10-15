const fs=require('fs'); eval(fs.readFileSync('routes-data.js','utf8')+';global.D={PURPOSES,TESTS,TYPES,DEFAULT_ROUTES}');
const {PURPOSES,TESTS,TYPES,DEFAULT_ROUTES:R}=D; const tk=new Set(TESTS.map(t=>t.key)), yk=new Set(TYPES.map(t=>t.key)), pk=new Set(PURPOSES.map(p=>p.key));
const RES=["submitted","received","released","storage","returned","external","disposed","rejected"];
for(const r of R){ for(const t of r.tests) if(!tk.has(t)) console.log('bad test',r.code,t);
 for(const t of r.types) if(t!=='*'&&!yk.has(t)) console.log('bad type',r.code,t);
 for(const p of r.purposes) if(!pk.has(p)) console.log('bad purpose',r.code,p);
 const ks=r.stages.map(s=>s.key); if(new Set(ks).size!==ks.length) console.log('dup key',r.code);
 ks.forEach(k=>RES.includes(k)&&console.log('reserved',r.code,k));
 if(r.stages.filter(s=>s.redo).length!==1) console.log('redo count',r.code,r.stages.filter(s=>s.redo).length);
 const h=r.stages.reduce((a,s)=>a+s.hours,0); console.log(r.code.padEnd(9), String(h+1).padStart(5),'h', r.stages.length,'stages');}
for(const t of TESTS) if(!R.some(r=>r.tests.includes(t.key))) console.log('no route for test',t.key);
function routeFor(ty,te,pu){let b=null,bs=-1;for(const r of R){if(!r.tests.includes(te))continue;const s=(r.purposes.includes(pu)?3:0)+(r.types.includes(ty)?2:(r.types.includes('*')||!r.types.length)?1:0);if(s>bs){b=r;bs=s}}return b}
for(const ty of TYPES) for(const te of ty.tests){ if(!tk.has(te)) console.log('type bad test',ty.key,te); }
console.log('rc/fa/gc', routeFor('rc','fa_aas','gc').code, 'core/fa/exp', routeFor('core','fa_aas','exp').code, 'gc_bh/fa/gc', routeFor('gc_bh','fa_aas','gc').code, 'plant_feed/fa/plant', routeFor('plant_feed','fa_aas','plant').code);
console.log(JSON.stringify(R).length,'bytes routes JSON');
