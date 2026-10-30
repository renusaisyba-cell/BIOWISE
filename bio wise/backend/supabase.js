const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && key && !url.includes('YOUR-PROJECT-REF') && !key.includes('YOUR_SUPABASE'));
const supabase = configured
  ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

module.exports = { supabase, configured };
