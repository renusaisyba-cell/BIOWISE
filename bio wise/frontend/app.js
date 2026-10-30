const $ = (id) => document.getElementById(id);
const state = { estimates: [], observations: [], energy: [], digestate: [] };
const notice = $('notice');
const fmt = (value, digits = 2) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: digits });
const dateFmt = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
function showNotice(message, isError = false) { notice.textContent = message; notice.className = `notice${isError ? ' error' : ''}`; notice.hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function hideNotice() { notice.hidden = true; }
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  let body;
  try { body = await response.json(); } catch { throw new Error('The server returned an unreadable response.'); }
  if (!response.ok || body.success === false) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}
function setLoading(form, yes) { form.querySelectorAll('button').forEach(b => { b.disabled = yes; if (yes) b.dataset.oldText = b.textContent; else if (b.dataset.oldText) { b.textContent = b.dataset.oldText; delete b.dataset.oldText; } }); }
function numOrNull(id) { const value = $(id).value.trim(); return value === '' ? null : Number(value); }
async function loadData() {
  hideNotice();
  try {
    const health = await api('/health');
    $('db-status').textContent = health.databaseConfigured ? 'Supabase connected' : 'Database not configured';
    $('db-status').className = `status-pill ${health.databaseConfigured ? 'status-ok' : 'status-warn'}`;
    if (!health.databaseConfigured) { showNotice('The dashboard is ready, but Supabase is not configured yet. Add your project URL and service-role key in backend/.env, run database/schema.sql in Supabase SQL Editor, and restart the server.', true); return; }
    const data = await api('/dashboard');
    Object.assign(state, { estimates: data.estimates || [], observations: data.observations || [], energy: data.energy || [], digestate: data.digestate || [] });
    renderDashboard();
  } catch (e) {
    $('db-status').textContent = 'Connection issue'; $('db-status').className = 'status-pill status-warn';
    showNotice(e.message, true);
  }
}
function renderDashboard() {
  const latestEstimate = state.estimates[0];
  const latestObs = state.observations[state.observations.length - 1];
  const latestEnergy = state.energy[0];
  const latestDigestate = state.digestate[0];
  $('metric-gas').innerHTML = `${latestEstimate ? fmt(latestEstimate.estimated_m3, 3) : '—'} <small>m³</small>`;
  $('metric-temp').innerHTML = `${latestObs?.temperature_c != null ? fmt(latestObs.temperature_c) : '—'} <small>°C</small>`;
  $('metric-methane').innerHTML = `${latestObs?.methane_percent != null ? fmt(latestObs.methane_percent) : '—'} <small>%</small>`;
  $('metric-savings').innerHTML = `${latestEnergy ? fmt(latestEnergy.estimated_savings_inr) : '—'} <small>₹</small>`;
  if (latestEstimate) $('estimate-result').innerHTML = `<span class="result-symbol">↗</span><div><small>ESTIMATED BIOGAS OUTPUT</small><strong>${fmt(latestEstimate.estimated_m3, 3)} m³</strong><p>Saved on ${dateFmt(latestEstimate.created_at)} · estimate only</p></div>`;
  if (latestEnergy) { $('energy-kwh').textContent = `${fmt(latestEnergy.cooking_energy_kwh)} kWh`; $('energy-lpg').textContent = `${fmt(latestEnergy.lpg_displaced_kg)} kg`; $('energy-rupees').textContent = `₹${fmt(latestEnergy.estimated_savings_inr)}`; }
  if (latestDigestate) { $('digestate-latest').textContent = `${fmt(latestDigestate.digestate_kg)} kg`; $('digestate-kind').textContent = latestDigestate.is_estimated ? 'Estimated quantity' : 'Measured quantity'; }
  renderCharts(); renderRecords();
}
function drawLine(canvasId, emptyId, points, label, unit, secondPoints = null) {
  const canvas = $(canvasId), empty = $(emptyId), ctx = canvas.getContext('2d');
  const valid = points.filter(p => p.value !== null && p.value !== undefined && Number.isFinite(Number(p.value)));
  const valid2 = secondPoints ? secondPoints.filter(p => p.value !== null && p.value !== undefined && Number.isFinite(Number(p.value))) : [];
  const all = [...valid, ...valid2];
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(300, rect.width * dpr); canvas.height = 175 * dpr; ctx.scale(dpr, dpr);
  const w = canvas.width / dpr, h = 175, left = 38, right = 10, top = 10, bottom = 29, plotW = w-left-right, plotH = h-top-bottom;
  ctx.clearRect(0,0,w,h);
  if (!all.length) { canvas.style.visibility = 'hidden'; empty.style.display = 'block'; return; }
  canvas.style.visibility = 'visible'; empty.style.display = 'none';
  const vals = all.map(p => Number(p.value)); let min = Math.min(0, ...vals), max = Math.max(...vals); if (min === max) max = min + 1;
  const pad = (max-min)*.12; min = Math.max(0, min-pad); max += pad;
  ctx.font = '10px DM Sans, sans-serif'; ctx.lineWidth = 1; ctx.strokeStyle = '#edf1ed'; ctx.fillStyle = '#8b978f'; ctx.textAlign = 'right';
  for(let i=0;i<4;i++){const y=top+plotH*i/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillText(fmt(max-(max-min)*i/3,1),left-7,y+3);}
  const draw = (arr, color) => { const data=arr.filter(p=>p.value!==null&&p.value!==undefined&&Number.isFinite(Number(p.value))); if(!data.length)return; ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();data.forEach((p,i)=>{const x=left+(data.length===1?plotW/2:i*plotW/(data.length-1));const y=top+plotH-(Number(p.value)-min)/(max-min)*plotH;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();data.forEach((p,i)=>{const x=left+(data.length===1?plotW/2:i*plotW/(data.length-1));const y=top+plotH-(Number(p.value)-min)/(max-min)*plotH;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();});};
  draw(valid, '#287a4e'); if(secondPoints) draw(valid2, '#df9a4d');
  ctx.fillStyle='#87938a';ctx.textAlign='left';ctx.fillText(valid.length ? new Date(valid[0].time).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '',left,h-8);ctx.textAlign='right';const last=(valid.length?valid[valid.length-1]:valid2[valid2.length-1]);ctx.fillText(last?new Date(last.time).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):'',w-right,h-8);
}
function renderCharts() {
  const obs = state.observations;
  const points = (field) => obs.filter(r=>r[field]!==null&&r[field]!==undefined).map(r=>({time:r.observed_at,value:Number(r[field])}));
  drawLine('chart-gas','empty-gas',points('gas_production_m3'),'Gas production','m³');
  drawLine('chart-temp','empty-temp',points('temperature_c'),'Temperature','°C');
  drawLine('chart-ph','empty-ph',points('ph'),'pH','');
  drawLine('chart-methane','empty-methane',points('methane_percent'),'Methane','%');
  const comparable=obs.filter(r=>r.predicted_m3!==null&&r.predicted_m3!==undefined&&r.actual_m3!==null&&r.actual_m3!==undefined);
  drawLine('chart-compare','empty-compare',comparable.map(r=>({time:r.observed_at,value:Number(r.predicted_m3)})),'Predicted','m³',comparable.map(r=>({time:r.observed_at,value:Number(r.actual_m3)})));
}
function renderRecords() {
  const records=[];
  state.estimates.forEach(r=>records.push({date:r.created_at,type:'Biogas estimate',details:`${r.waste_type} · ${fmt(r.waste_kg)} kg → ${fmt(r.estimated_m3,3)} m³`,kind:'Estimated'}));
  state.observations.forEach(r=>records.push({date:r.observed_at,type:'Observation',details:[r.gas_production_m3!=null?`Gas ${fmt(r.gas_production_m3)} m³`:null,r.temperature_c!=null?`${fmt(r.temperature_c)} °C`:null,r.ph!=null?`pH ${fmt(r.ph)}`:null,r.methane_percent!=null?`Methane ${fmt(r.methane_percent)}%`:null].filter(Boolean).join(' · ')||'Operating record',kind:'Manual measurement'}));
  state.energy.forEach(r=>records.push({date:r.created_at,type:'Energy calculator',details:`${fmt(r.biogas_m3)} m³ → ₹${fmt(r.estimated_savings_inr)} estimated savings`,kind:'Estimated'}));
  state.digestate.forEach(r=>records.push({date:r.recorded_at,type:'Digestate',details:`${fmt(r.digestate_kg)} kg${r.notes?` · ${r.notes}`:''}`,kind:r.is_estimated?'Estimated':'Measured'}));
  records.sort((a,b)=>new Date(b.date)-new Date(a.date));
  $('records-body').innerHTML = records.length ? records.slice(0,15).map(r=>`<tr><td>${escapeHtml(dateFmt(r.date))}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.details)}</td><td>${escapeHtml(r.kind)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-table">No saved records yet. Add an estimate or measurement to get started.</td></tr>';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
$('estimate-form').addEventListener('submit', async e=>{e.preventDefault();const form=e.currentTarget;setLoading(form,true);try{const body={waste_type:$('waste-type').value,waste_kg:Number($('waste-kg').value)};const result=await api('/estimates',{method:'POST',body:JSON.stringify(body)});showNotice(`Estimate saved: ${fmt(result.data.estimated_m3,3)} m³ biogas (illustrative estimate).`);$('waste-kg').value='';await loadData();}catch(err){showNotice(err.message,true);}finally{setLoading(form,false);}});
$('energy-form').addEventListener('submit', async e=>{e.preventDefault();const form=e.currentTarget;setLoading(form,true);try{const result=await api('/energy/calculate',{method:'POST',body:JSON.stringify({biogas_m3:Number($('energy-gas').value)})});const d=result.data;$('energy-kwh').textContent=`${fmt(d.cooking_energy_kwh)} kWh`; $('energy-lpg').textContent=`${fmt(d.lpg_displaced_kg)} kg`; $('energy-rupees').textContent=`₹${fmt(d.estimated_savings_inr)}`;showNotice('Energy and savings estimate calculated and saved. Review the assumptions in backend/.env.');await loadData();}catch(err){showNotice(err.message,true);}finally{setLoading(form,false);}});
$('digestate-form').addEventListener('submit', async e=>{e.preventDefault();const form=e.currentTarget;setLoading(form,true);try{const input=numOrNull('digestate-input'), measured=numOrNull('digestate-measured');if(input===null&&measured===null)throw new Error('Enter daily waste input or a measured digestate quantity.');const result=await api('/digestate',{method:'POST',body:JSON.stringify({waste_input_kg:input,digestate_kg:measured,notes:$('digestate-notes').value})});showNotice(`${result.data.is_estimated?'Estimated':'Measured'} digestate record saved: ${fmt(result.data.digestate_kg)} kg.`);form.reset();await loadData();}catch(err){showNotice(err.message,true);}finally{setLoading(form,false);}});
$('observation-form').addEventListener('submit', async e=>{e.preventDefault();const form=e.currentTarget;setLoading(form,true);try{const fields={gas_production_m3:'obs-gas',temperature_c:'obs-temp',ph:'obs-ph',methane_percent:'obs-methane',predicted_m3:'obs-predicted',actual_m3:'obs-actual'};const body={};for(const [key,id] of Object.entries(fields)){const value=numOrNull(id);if(value!==null)body[key]=value;}if(!$('obs-time').value.trim()===false) body.observed_at=new Date($('obs-time').value).toISOString();body.notes=$('obs-notes').value;if(!Object.keys(body).some(k=>fields[k]!==undefined))throw new Error('Enter at least one measurement.');await api('/observations',{method:'POST',body:JSON.stringify(body)});showNotice('Observation saved. The graphs will update from database records.');form.reset();await loadData();}catch(err){showNotice(err.message,true);}finally{setLoading(form,false);}});
$('refresh-btn').addEventListener('click',loadData);
$('today-label').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
const localNow=new Date();localNow.setMinutes(localNow.getMinutes()-localNow.getTimezoneOffset());$('obs-time').value=localNow.toISOString().slice(0,16);
window.addEventListener('resize',()=>{clearTimeout(window.__chartResize);window.__chartResize=setTimeout(renderCharts,150);});
loadData();
