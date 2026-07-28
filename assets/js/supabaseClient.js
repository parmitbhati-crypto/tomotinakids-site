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

  const isStandaloneAuthPage = /\/portal\/(?:login|mfa-setup|mfa-challenge)(?:\.html)?\/?$/.test(window.location.pathname);
  if (window.location.pathname.startsWith("/portal/") && !isStandaloneAuthPage) {
    const monitoringScript = document.createElement("script");
    monitoringScript.src = "/assets/js/portal-monitoring.js";
    monitoringScript.defer = true;
    document.head.appendChild(monitoringScript);

    const shellScript = document.createElement("script");
    shellScript.src = "/assets/js/portal-shell.js";
    shellScript.defer = true;
    document.head.appendChild(shellScript);
  }
})();
