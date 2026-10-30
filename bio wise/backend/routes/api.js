const express = require('express');
const { supabase, configured } = require('../supabase');
const router = express.Router();

const number = (v) => typeof v === 'number' && Number.isFinite(v);
const fail = (res, status, message) => res.status(status).json({ success: false, error: message });
const dbReady = (res) => {
  if (!configured) {
    fail(res, 503, 'Database is not configured. Add your Supabase URL and service-role key to backend/.env, then restart the server.');
    return false;
  }
  return true;
};
const dbError = (res, error) => {
  console.error('Database operation failed:', error.message);
  return fail(res, 500, 'Database operation failed. Check your Supabase setup and database schema.');
};

function factors() {
  return {
    biogasKwhPerM3: Number(process.env.BIOGAS_KWH_PER_M3 || 6),
    cookingEfficiency: Number(process.env.USEFUL_COOKING_EFFICIENCY || 0.55),
    lpgKwhPerKg: Number(process.env.LPG_KWH_PER_KG || 12.8),
    lpgPricePerKg: Number(process.env.LPG_PRICE_PER_KG || 100),
    digestateRatio: Number(process.env.DIGESTATE_KG_PER_KG_WET_WASTE || 0.85)
  };
}

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', databaseConfigured: configured }));

router.get('/dashboard', async (_req, res) => {
  if (!dbReady(res)) return;
  try {
    const [est, obs, energy, dig] = await Promise.all([
      supabase.from('biogas_estimates').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('observations').select('*').order('observed_at', { ascending: true }).limit(100),
      supabase.from('energy_calculations').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('digestate_entries').select('*').order('recorded_at', { ascending: false }).limit(10)
    ]);
    for (const r of [est, obs, energy, dig]) if (r.error) return dbError(res, r.error);
    res.json({ success: true, estimates: est.data, observations: obs.data, energy: energy.data, digestate: dig.data });
  } catch (e) { return dbError(res, e); }
});

router.get('/estimates', async (_req, res) => {
  if (!dbReady(res)) return;
  const { data, error } = await supabase.from('biogas_estimates').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return dbError(res, error);
  res.json({ success: true, data });
});
router.post('/estimates', async (req, res) => {
  if (!dbReady(res)) return;
  const { waste_type, waste_kg } = req.body;
  if (typeof waste_type !== 'string' || !waste_type.trim() || !number(waste_kg) || waste_kg <= 0 || waste_kg > 100000) return fail(res, 400, 'Enter a waste type and a quantity greater than 0 and no more than 100,000 kg.');
  // Simplified illustrative yield assumptions (m³/kg wet waste); not a scientific prediction.
  const yields = { food: 0.10, kitchen: 0.10, cattle: 0.035, cow_dung: 0.035, agricultural: 0.06, mixed: 0.07, other: 0.05 };
  const key = waste_type.toLowerCase().replace(/[ -]+/g, '_');
  const yieldFactor = yields[key] ?? (key.includes('food') ? yields.food : key.includes('dung') ? yields.cattle : yields.other);
  const estimated_m3 = Math.round(waste_kg * yieldFactor * 1000) / 1000;
  const assumptions = { method: 'simple illustrative yield factor', yield_m3_per_kg: yieldFactor, note: 'Actual yield depends on feedstock composition, moisture, retention time and digester conditions.' };
  const { data, error } = await supabase.from('biogas_estimates').insert({ waste_type: waste_type.trim(), waste_kg, estimated_m3, assumptions }).select().single();
  if (error) return dbError(res, error);
  res.status(201).json({ success: true, data });
});

router.get('/observations', async (_req, res) => {
  if (!dbReady(res)) return;
  const { data, error } = await supabase.from('observations').select('*').order('observed_at', { ascending: true }).limit(500);
  if (error) return dbError(res, error);
  res.json({ success: true, data });
});
router.post('/observations', async (req, res) => {
  if (!dbReady(res)) return;
  const { observed_at, gas_production_m3, temperature_c, ph, methane_percent, predicted_m3, actual_m3, notes } = req.body;
  const ranges = [
    ['gas_production_m3', gas_production_m3, 0, 100000], ['temperature_c', temperature_c, -10, 100],
    ['ph', ph, 0, 14], ['methane_percent', methane_percent, 0, 100], ['predicted_m3', predicted_m3, 0, 100000], ['actual_m3', actual_m3, 0, 100000]
  ];
  for (const [name, val, min, max] of ranges) if (val !== undefined && val !== null && (!number(val) || val < min || val > max)) return fail(res, 400, `${name} must be between ${min} and ${max}.`);
  if (![gas_production_m3, temperature_c, ph, methane_percent, predicted_m3, actual_m3].some(v => v !== undefined && v !== null)) return fail(res, 400, 'Enter at least one measurement.');
  const row = { observed_at: observed_at || new Date().toISOString(), gas_production_m3: gas_production_m3 ?? null, temperature_c: temperature_c ?? null, ph: ph ?? null, methane_percent: methane_percent ?? null, predicted_m3: predicted_m3 ?? null, actual_m3: actual_m3 ?? null, notes: typeof notes === 'string' ? notes.slice(0, 1000) : null };
  const { data, error } = await supabase.from('observations').insert(row).select().single();
  if (error) return dbError(res, error);
  res.status(201).json({ success: true, data });
});

router.post('/energy/calculate', async (req, res) => {
  if (!dbReady(res)) return;
  const { biogas_m3 } = req.body;
  if (!number(biogas_m3) || biogas_m3 < 0 || biogas_m3 > 100000) return fail(res, 400, 'Biogas production must be a number from 0 to 100,000 m³.');
  const f = factors();
  const cooking_kwh = biogas_m3 * f.biogasKwhPerM3 * f.cookingEfficiency;
  const lpg_kg = cooking_kwh / f.lpgKwhPerKg;
  const savings_inr = lpg_kg * f.lpgPricePerKg;
  const assumptions = { ...f, note: 'Illustrative conversion assumptions only. Real outcomes depend on methane content, appliance efficiency, local LPG price and usage.' };
  const { data, error } = await supabase.from('energy_calculations').insert({ biogas_m3, cooking_energy_kwh: cooking_kwh, lpg_displaced_kg: lpg_kg, estimated_savings_inr: savings_inr, assumptions }).select().single();
  if (error) return dbError(res, error);
  res.status(201).json({ success: true, data });
});
router.get('/energy', async (_req, res) => {
  if (!dbReady(res)) return;
  const { data, error } = await supabase.from('energy_calculations').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return dbError(res, error);
  res.json({ success: true, data });
});

router.get('/digestate', async (_req, res) => {
  if (!dbReady(res)) return;
  const { data, error } = await supabase.from('digestate_entries').select('*').order('recorded_at', { ascending: false }).limit(200);
  if (error) return dbError(res, error);
  res.json({ success: true, data });
});
router.post('/digestate', async (req, res) => {
  if (!dbReady(res)) return;
  const { waste_input_kg, digestate_kg, recorded_at, status, notes } = req.body;
  if (waste_input_kg !== undefined && (!number(waste_input_kg) || waste_input_kg < 0 || waste_input_kg > 100000)) return fail(res, 400, 'Waste input must be from 0 to 100,000 kg.');
  if (digestate_kg !== undefined && (!number(digestate_kg) || digestate_kg < 0 || digestate_kg > 100000)) return fail(res, 400, 'Digestate quantity must be from 0 to 100,000 kg.');
  if (waste_input_kg === undefined && digestate_kg === undefined) return fail(res, 400, 'Enter waste input or a digestate quantity.');
  const ratio = factors().digestateRatio;
  const estimated = digestate_kg === undefined ? Number((waste_input_kg * ratio).toFixed(3)) : null;
  const { data, error } = await supabase.from('digestate_entries').insert({ waste_input_kg: waste_input_kg ?? null, digestate_kg: digestate_kg ?? estimated, is_estimated: digestate_kg === undefined, recorded_at: recorded_at || new Date().toISOString(), status: typeof status === 'string' ? status.slice(0, 80) : 'Not assessed', notes: typeof notes === 'string' ? notes.slice(0, 1000) : null, assumptions: { kg_per_kg_wet_waste: ratio, note: 'Estimate only; actual mass depends on process and moisture.' } }).select().single();
  if (error) return dbError(res, error);
  res.status(201).json({ success: true, data });
});

module.exports = router;
