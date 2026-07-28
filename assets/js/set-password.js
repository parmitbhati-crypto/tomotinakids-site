(() => {
  const form = document.getElementById("setPasswordForm");
  const message = document.getElementById("passwordMessage");
  const show = (text, type) => { message.textContent = text; message.dataset.type = type; message.hidden = false; };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    if (password !== data.get("confirmPassword")) return show("Passwords do not match.", "error");
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return show("Use uppercase, lowercase, a number, and a symbol.", "error");
    }
    const button = form.querySelector("button");
    button.disabled = true;
    const { error } = await window.sb.auth.updateUser({ password });
    if (error) {
      show("This invitation link may have expired. Ask your administrator for a new invitation.", "error");
      button.disabled = false;
      return;
    }
    show("Password saved. Opening your workspace…", "success");
    setTimeout(() => { window.location.href = "/portal/day.html"; }, 800);
  });
})();
