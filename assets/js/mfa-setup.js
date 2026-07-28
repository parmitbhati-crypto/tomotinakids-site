(() => {
  const message = document.getElementById("mfaMessage");
  const form = document.getElementById("mfaSetupForm");
  const code = document.getElementById("mfaCode");
  const button = document.getElementById("verifyMfa");
  let factorId = "";

  const show = (text, type = "info") => {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = !text;
  };
  const signOut = async () => {
    await window.sb.auth.signOut();
    window.location.href = "/portal/login.html";
  };

  async function init() {
    const { data: authData } = await window.sb.auth.getUser();
    if (!authData?.user) return signOut();
    const { data: access } = await window.sb.rpc("get_portal_access_state").maybeSingle();
    if (access?.portal_role !== "admin" || access.account_is_active === false) return signOut();

    const { data: assurance } = await window.sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === "aal2") {
      window.location.href = "/portal/admin-home.html";
      return;
    }
    const { data: factors } = await window.sb.auth.mfa.listFactors();
    if ((factors?.totp || []).some((factor) => factor.status === "verified")) {
      window.location.href = "/portal/mfa-challenge.html";
      return;
    }
    for (const factor of factors?.totp || []) {
      await window.sb.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error } = await window.sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Tomotina administrator",
    });
    if (error || !data?.id || !data?.totp) {
      show("Authenticator setup is temporarily unavailable. Sign out and try again.", "error");
      form.hidden = true;
      return;
    }
    factorId = data.id;
    const qrImage = document.createElement("img");
    qrImage.src = data.totp.qr_code;
    qrImage.alt = "Authenticator setup QR code";
    document.getElementById("mfaQrWrap").replaceChildren(qrImage);
    document.getElementById("mfaSecret").textContent = data.totp.secret;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!factorId || !/^[0-9]{6}$/.test(code.value)) return show("Enter the six-digit code from your authenticator app.", "error");
    button.disabled = true;
    button.textContent = "Verifying...";
    const { data: challenge, error: challengeError } = await window.sb.auth.mfa.challenge({ factorId });
    const { error: verifyError } = challengeError || !challenge?.id
      ? { error: challengeError || new Error("Challenge unavailable") }
      : await window.sb.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.value });
    if (verifyError) {
      show("That code could not be verified. Wait for a new code and try again.", "error");
      code.value = "";
      code.focus();
      button.disabled = false;
      button.textContent = "Verify and continue";
      return;
    }
    await window.sb.auth.refreshSession();
    window.location.href = "/portal/admin-home.html";
  });

  document.getElementById("mfaSetupLogout").addEventListener("click", signOut);
  init();
})();
