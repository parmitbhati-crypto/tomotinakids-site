(() => {
  const title = document.getElementById("actionTitle");
  const copy = document.getElementById("actionCopy");
  const message = document.getElementById("actionMessage");
  const button = document.getElementById("continueAction");
  const params = new URLSearchParams(window.location.hash.slice(1));
  const flow = params.get("flow") === "invite" ? "invite" : "recovery";
  const tokenHash = params.get("token_hash") || "";

  const show = (text, type = "error") => {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
  };

  if (flow === "invite") {
    title.textContent = "Create your staff password";
    copy.textContent = "Press Continue to accept your invitation and choose a secure password.";
    button.textContent = "Continue to password setup";
  } else {
    title.textContent = "Reset your password";
    copy.textContent = "Press Continue to verify the reset request and choose a new password.";
    button.textContent = "Continue to reset password";
  }

  // Supabase token hashes are URL-safe opaque values. Keep them in the URL
  // fragment so they never reach Cloudflare/server request logs.
  if (!/^[A-Za-z0-9._~-]{20,512}$/.test(tokenHash)) {
    button.disabled = true;
    show("This secure link is incomplete or invalid. Request a new invitation or password reset email.");
    return;
  }

  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Opening…";
    const target = `/portal/set-password.html#token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(flow)}`;
    window.location.assign(target);
  });
})();
