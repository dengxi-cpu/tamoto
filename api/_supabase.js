// 共享 Supabase 配置（直接用 fetch 调 REST API，不依赖 @supabase/supabase-js）
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isReady = !!(SUPABASE_URL && SUPABASE_KEY);

function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
}

module.exports = { supabaseFetch, isReady, SUPABASE_URL, SUPABASE_KEY };
