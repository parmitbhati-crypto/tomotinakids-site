function qs(id) {
  return document.getElementById(id);
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function truncateText(text, max = 90) {
  const s = String(text || "").trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function setMsg(text, type = "info") {
  const el = qs("msg");
  if (!el) return;
  el.textContent = text || "";
  el.className = "msg";
  el.dataset.type = type;
}

let allRows = [];
let isLoading = false;

async function requireAdminEnquiries() {
  const user = await requireAuth();
  if (!user) return null;

  const profile = await getMyProfile();
  if (profile?.role !== "admin") {
    alert("Admins only.");
    window.location.href = "/portal/admin-home.html";
    return null;
  }

  return { user, profile };
}

function render(rows) {
  const tbody = qs("tbody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="muted">No enquiries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const id = escapeHtml(r.id);
    const createdAt = escapeHtml(fmtDateTime(r.created_at));
    const parentName = escapeHtml(r.parent_name || "—");
    const childName = escapeHtml(r.child_name || "—");
    const phone = escapeHtml(r.phone || "—");
    const email = escapeHtml(r.email || "—");
    const childAge = escapeHtml(r.child_age || "—");
    const fullMessage = escapeHtml(r.message || "");
    const shortMessage = escapeHtml(truncateText(r.message, 90));
    const status = String(r.status || "new").toLowerCase();
    const adminNote = escapeHtml(r.admin_note || "");

    return `
      <tr>
        <td>${createdAt}</td>
        <td>${parentName}</td>
        <td>${childName}</td>
        <td>${phone}</td>
        <td>${email}</td>
        <td>${childAge}</td>
        <td title="${fullMessage}">${shortMessage}</td>
        <td>
          <select class="select enquiry-status" data-id="${id}">
            <option value="new" ${status === "new" ? "selected" : ""}>New</option>
            <option value="lead" ${status === "lead" ? "selected" : ""}>Lead</option>
            <option value="scheduled_appointment" ${status === "scheduled_appointment" ? "selected" : ""}>Scheduled Appointment</option>
            <option value="contacted" ${status === "contacted" ? "selected" : ""}>Contacted</option>
            <option value="closed" ${status === "closed" ? "selected" : ""}>Closed</option>
          </select>
        </td>
        <td>
          <input
            type="text"
            class="input enquiry-note"
            data-id="${id}"
            value="${adminNote}"
            placeholder="Add short note"
          />
        </td>
        <td>
          <button class="btn enquiry-save" data-id="${id}" type="button">Save</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".enquiry-save").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const enquiryId = e.currentTarget.getAttribute("data-id");
      const statusEl = tbody.querySelector(`.enquiry-status[data-id="${CSS.escape(enquiryId)}"]`);
      const noteEl = tbody.querySelector(`.enquiry-note[data-id="${CSS.escape(enquiryId)}"]`);

      const nextStatus = statusEl?.value || "new";
      const adminNote = noteEl?.value.trim() || null;

      btn.disabled = true;
      btn.textContent = "Saving...";
      if (statusEl) statusEl.disabled = true;
      if (noteEl) noteEl.disabled = true;

      setMsg("Saving enquiry update...", "info");

      const { error } = await window.sb
        .from("enquiries")
        .update({
          status: nextStatus,
          admin_note: adminNote
        })
        .eq("id", enquiryId);

      if (error) {
        setMsg(error.message || "Failed to update enquiry.", "error");
      } else {
        const idx = allRows.findIndex(x => x.id === enquiryId);
        if (idx >= 0) {
          allRows[idx].status = nextStatus;
          allRows[idx].admin_note = adminNote;
        }
        setMsg("Enquiry updated successfully.", "success");
      }

      btn.disabled = false;
      btn.textContent = "Save";
      if (statusEl) statusEl.disabled = false;
      if (noteEl) noteEl.disabled = false;
    });
  });
}

function applyFilters() {
  const q = (qs("q")?.value || "").trim().toLowerCase();
  const statusFilter = qs("statusFilter")?.value || "all";

  let rows = [...allRows];

  if (statusFilter !== "all") {
    rows = rows.filter(r => String(r.status || "").toLowerCase() === statusFilter);
  }

  if (q) {
    rows = rows.filter(r =>
      (r.parent_name || "").toLowerCase().includes(q) ||
      (r.child_name || "").toLowerCase().includes(q) ||
      (r.phone || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.child_age || "").toLowerCase().includes(q) ||
      (r.message || "").toLowerCase().includes(q) ||
      (r.admin_note || "").toLowerCase().includes(q)
    );
  }

  render(rows);
}

async function loadEnquiries() {
  if (isLoading) return;
  isLoading = true;

  const tbody = qs("tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="10" class="muted">Loading…</td></tr>`;
  }
  setMsg("");

  try {
    const { data, error } = await window.sb
      .from("enquiries")
      .select("id, created_at, parent_name, child_name, phone, email, child_age, message, status, admin_note, source")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allRows = data || [];
    applyFilters();
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="muted">Error loading enquiries.</td></tr>`;
    }
    setMsg(e.message || "Failed to load enquiries.", "error");
  } finally {
    isLoading = false;
  }
}

(async function init() {
  const ok = await requireAdminEnquiries();
  if (!ok) return;

  const qInput = qs("q");
  const statusFilter = qs("statusFilter");
  const refreshBtn = qs("refreshBtn");
  const btnLogout = qs("btnLogout");

  if (qInput) qInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
  if (refreshBtn) refreshBtn.addEventListener("click", loadEnquiries);
  if (btnLogout) btnLogout.addEventListener("click", logout);

  await loadEnquiries();
})();