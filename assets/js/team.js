(() => {
  const list = document.getElementById("teamList");
  const summary = document.getElementById("teamSummary");
  const message = document.getElementById("teamMessage");
  const search = document.getElementById("teamSearch");
  const status = document.getElementById("teamStatus");
  let teachers = [];
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const show = (text, type = "info") => { message.textContent = text; message.dataset.type = type; message.hidden = false; };

  async function photoUrl(path) {
    if (!path) return "";
    const { data } = await window.sb.storage.from("teacher-photos").createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  }
  function readiness(teacher) {
    const details = teacher.teacher_profiles || {};
    const programs = (teacher.teacher_programs || []).filter((item) => item.programs?.name);
    return [
      !details.mobile && "mobile number",
      !details.joining_date && "joining date",
      !programs.length && "program assignment",
    ].filter(Boolean);
  }
  function matches(teacher) {
    const term = search.value.trim().toLowerCase();
    const details = teacher.teacher_profiles || {};
    const searchable = [teacher.full_name, teacher.specialization, details.email, details.mobile].join(" ").toLowerCase();
    const state = status.value;
    return (!term || searchable.includes(term)) && (state === "all"
      || (state === "active" && teacher.is_active) || (state === "inactive" && !teacher.is_active)
      || (state === "invited" && details.invitation_status === "invited")
      || (state === "needs_attention" && readiness(teacher).length));
  }
  async function render() {
    const visible = teachers.filter(matches);
    const active = teachers.filter((t) => t.is_active).length;
    const pending = teachers.filter((t) => t.teacher_profiles?.invitation_status === "invited").length;
    const incomplete = teachers.filter((teacher) => readiness(teacher).length).length;
    summary.innerHTML = `<span><strong>${teachers.length}</strong> team members</span><span><strong>${active}</strong> active</span><span><strong>${pending}</strong> invitations pending</span><span class="${incomplete ? "summary-attention" : ""}"><strong>${incomplete}</strong> need attention</span>`;
    if (!visible.length) return void (list.innerHTML = `<div class="portal-state"><strong>No matching team members</strong><span>Change the search or status filter, or invite a new team member.</span></div>`);
    const urls = await Promise.all(visible.map((t) => photoUrl(t.teacher_profiles?.photo_path)));
    list.innerHTML = visible.map((teacher, index) => {
      const details = teacher.teacher_profiles || {};
      const programs = (teacher.teacher_programs || []).map((x) => x.programs?.name).filter(Boolean);
      const missing = readiness(teacher);
      const avatar = urls[index] ? `<img src="${esc(urls[index])}" alt="">` : `<span>${esc((teacher.full_name || "T").slice(0, 1).toUpperCase())}</span>`;
      return `<article class="team-card" data-id="${teacher.id}">
        <div class="team-card-head"><div class="team-avatar">${avatar}</div><div><h3>${esc(teacher.full_name || "Unnamed teacher")}</h3><p>${esc(details.designation || teacher.specialization || "Teacher")}</p></div><span class="status-pill ${teacher.is_active ? "is-published" : ""}">${teacher.is_active ? "Active" : "Inactive"}</span></div>
        <dl class="team-meta"><div><dt>Email</dt><dd>${esc(details.email || "—")}</dd></div><div><dt>Mobile</dt><dd>${esc(details.mobile || "—")}</dd></div><div><dt>Invitation</dt><dd>${esc(details.invitation_status || "unknown")}</dd></div><div><dt>Employment</dt><dd>${esc((details.employment_type || "—").replace("_", " "))}</dd></div><div><dt>Programs</dt><dd>${esc(programs.join(", ") || "Not assigned")}</dd></div><div><dt>Joined</dt><dd>${esc(details.joining_date || "Not recorded")}</dd></div></dl>
        ${missing.length ? `<div class="team-readiness"><strong>Needs attention</strong><span>Add ${esc(missing.join(", "))} before regular scheduling.</span></div>` : `<div class="team-ready">Profile ready for scheduling</div>`}
        <div class="team-verification"><span>Aadhaar ${details.aadhaar_verified ? "verified" : "not verified"}${details.aadhaar_last4 ? ` · •••• ${esc(details.aadhaar_last4)}` : ""}</span><span>PAN ${details.pan_verified ? "verified" : "not verified"}${details.pan_last4 ? ` · •••• ${esc(details.pan_last4)}` : ""}</span></div>
        <div class="team-actions"><a class="btn" href="/portal/team-new.html?id=${teacher.id}">Edit profile</a><button class="btn ${teacher.is_active ? "danger" : "primary"}" data-action="toggle" type="button">${teacher.is_active ? "Deactivate access" : "Reactivate access"}</button></div>
      </article>`;
    }).join("");
  }
  async function load() {
    list.innerHTML = `<div class="portal-state">Loading team directory…</div>`;
    const { data, error } = await window.sb.from("profiles").select("id,full_name,specialization,is_active,teacher_profiles(*),teacher_programs(programs(name))").eq("role", "teacher").order("full_name");
    if (error) { list.innerHTML = `<div class="portal-state">Team directory could not be loaded.</div>`; return show(error.message, "error"); }
    teachers = data || []; render();
  }
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='toggle']");
    if (!button) return;
    const teacher = teachers.find((item) => item.id === button.closest("[data-id]").dataset.id);
    if (!teacher) return;
    const next = !teacher.is_active;
    if (!window.confirm(`${next ? "Reactivate" : "Deactivate"} ${teacher.full_name}? Historical records will be kept.`)) return;
    button.disabled = true;
    const { error: profileError } = await window.sb.from("profiles").update({ is_active: next }).eq("id", teacher.id);
    if (profileError) show("Access status could not be updated.", "error");
    else { show(`${teacher.full_name} is now ${next ? "active" : "inactive"}.`, "success"); await load(); }
    button.disabled = false;
  });
  [search, status].forEach((control) => control.addEventListener("input", render));
  document.getElementById("refreshTeam").addEventListener("click", load);
  const created = new URLSearchParams(location.search).get("created");
  if (created) show(`${created}'s profile was created and the invitation email was sent.`, "success");
  const updated = new URLSearchParams(location.search).get("updated");
  if (updated) show(`${updated}'s profile was updated.`, "success");
  requireAuth().then((user) => { if (user) load(); });
})();
