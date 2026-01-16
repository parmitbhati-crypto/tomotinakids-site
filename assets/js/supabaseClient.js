// assets/js/supabaseClient.js
(function () {
  if (!window.ENV_SUPABASE_URL || !window.ENV_SUPABASE_ANON_KEY) {
    console.error("Missing ENV_SUPABASE_URL or ENV_SUPABASE_ANON_KEY in env.js");
    return;
  }
  window.sb = window.supabase.createClient(
    window.ENV_SUPABASE_URL,
    window.ENV_SUPABASE_ANON_KEY
  );
})();
