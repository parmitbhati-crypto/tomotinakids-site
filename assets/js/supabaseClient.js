// assets/js/supabaseClient.js
(function () {
  if (!window.ENV_SUPABASE_URL || !window.ENV_SUPABASE_ANON_KEY) {
    console.error("Missing ENV_SUPABASE_URL or ENV_SUPABASE_ANON_KEY in env.js");
    return;
  }
  if (!window.supabase) {
    console.error("Missing Supabase JS SDK. Ensure the supabase script is loaded before supabaseClient.js");
    return;
  }

  window.sb = window.supabase.createClient(
    window.ENV_SUPABASE_URL,
    window.ENV_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    }
  );

  if (window.location.pathname.startsWith("/portal/") && !window.location.pathname.includes("/login")) {
    const shellScript = document.createElement("script");
    shellScript.src = "/assets/js/portal-shell.js";
    shellScript.defer = true;
    document.head.appendChild(shellScript);
  }
})();
