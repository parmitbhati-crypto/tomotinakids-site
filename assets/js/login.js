// assets/js/login.js
function qs(id) { return document.getElementById(id); }

function setMsg(text) {
  const el = qs("msg");
  if (el) el.textContent = text || "";
}

async function ensureClientReady() {
  if (!window.sb) throw new Error("Supabase client not initialized (sb missing). Check env.js + supabaseClient.js + supabase CDN script).");
}

async function doLogin() {
  setMsg("Logging in...");
  await ensureClientReady();

  const email = (qs("email").value || "").trim();
  const password = qs("password").value || "";

  if (!email || !password) {
    setMsg("Enter email and password.");
    return;
  }

  const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
  if (error) {
    setMsg(error.message);
    return;
  }

  // Signed in
  window.location.href = "/portal/day.html";
}

async function sendReset() {
  setMsg("Sending reset link...");
  await ensureClientReady();

  const email = (qs("email").value || "").trim();
  if (!email) {
    setMsg("Enter your email first.");
    return;
  }

  // IMPORTANT: this must be allowed in Supabase Auth -> URL Configuration
  const redirectTo = `${window.location.origin}/portal/login.html`;

  const { error } = await window.sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("Reset link sent. Check your email.");
}

(function init() {
  const btnLogin = qs("btnLogin");
  const btnReset = qs("btnReset");

  if (btnLogin) btnLogin.onclick = doLogin;
  if (btnReset) btnReset.onclick = sendReset;

  // Enter key triggers login
  const pwd = qs("password");
  if (pwd) {
    pwd.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }
})();
