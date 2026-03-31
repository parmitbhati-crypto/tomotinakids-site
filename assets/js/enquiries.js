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
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No enquiries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const id = escapeHtml(r.id);
    const createdAt = escapeHtml(fmtDateTime(r.created_at));
    const parentName = escapeHtml(r.parent_name || "—");
    const phone = escapeHtml(r.phone || "—");
    const email = escapeHtml(r.email || "—");
    const childAge = escapeHtml(r.child_age || "—");
    const fullMessage = escapeHtml(r.message || "");
    const shortMessage = escapeHtml(truncateText(r.message, 90));
    const status = String(r.status || "new").toLowerCase();

    return `
      <tr>
        <td>${createdAt}</td>
        <td>${parentName}</td>
        <td>${phone}</td>
        <td>${email}</td>
        <td>${childAge}</td>
        <td title="${fullMessage}">${shortMessage}</td>
        <td>
          <select class="select enquiry-status" data-id="${id}">
            <option value="new" ${status === "new" ? "selected" : ""}>New</option>
            <option value="contacted" ${status === "contacted" ? "selected" : ""}>Contacted</option>
            <option value="closed" ${status === "closed" ? "selected" : ""}>Closed</option>
          </select>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".enquiry-status").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const enquiryId = e.target.getAttribute("data-id");
      const nextStatus = e.target.value;
      const prev = allRows.find(x => x.id === enquiryId)?.status || "new";

      e.target.disabled = true;
      setMsg("Updating enquiry status…", "info");

      const { error } = await window.sb
        .from("enquiries")
        .update({ status: nextStatus })
        .eq("id", enquiryId);

      if (error) {
        e.target.value = prev;
        setMsg(error.message || "Failed to update enquiry.", "error");
      } else {
        const idx = allRows.findIndex(x => x.id === enquiryId);
        if (idx >= 0) allRows[idx].status = nextStatus;
        setMsg("Enquiry updated successfully.", "success");
      }

      e.target.disabled = false;
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
      (r.phone || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.child_age || "").toLowerCase().includes(q) ||
      (r.message || "").toLowerCase().includes(q)
    );
  }

  render(rows);
}

async function loadEnquiries() {
  if (isLoading) return;
  isLoading = true;

  const tbody = qs("tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Loading…</td></tr>`;
  }
  setMsg("");

  try {
    const { data, error } = await window.sb
      .from("enquiries")
      .select("id, created_at, parent_name, phone, email, child_age, message, status, source")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allRows = data || [];
    applyFilters();
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Error loading enquiries.</td></tr>`;
    }
    setMsg(e.message || "Failed to load enquiries.", "error");
  } finally {
    isLoading = false;
  }
}

(async function init() {
  const ok = await requireAdminEnquiries();
  if (!ok) return;

  const who = qs("who");
  if (who) who.textContent = ok.profile?.full_name || "Admin";

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