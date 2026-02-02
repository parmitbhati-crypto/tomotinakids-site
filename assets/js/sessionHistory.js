<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Session History</title>
  <link rel="stylesheet" href="/assets/css/portal.css" />
</head>
<body>
  <div class="container">

    <!-- Topbar -->
    <div class="topbar">
      <div class="brand">
        <img src="/assets/images/logo.png" class="top-logo" />
        <div class="brand-text">
          <div class="brand-title">Tomotina Kids</div>
          <div class="brand-sub">Admin</div>
        </div>
      </div>

      <div class="nav">
        <a href="/portal/admin.html">Create Schedule</a>
        <a class="active" href="/portal/session-history.html">Session History</a>
        <a href="/portal/registrations.html">Registrations</a>
      </div>

      <button id="btnLogout" class="btn danger">Logout</button>
    </div>

    <!-- Content -->
    <div class="grid">
      <div class="card">

        <h2 class="h2">Session History (Student-wise)</h2>

        <div class="fieldrow">
          <div>
            <label>Select Student</label>
            <select id="studentSelect">
              <option value="">— Select student —</option>
            </select>
          </div>
        </div>

        <hr />

        <div id="historyContainer" class="muted">
          Select a student to view session history.
        </div>

      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="/assets/js/env.js"></script>
  <script src="/assets/js/supabaseClient.js"></script>
  <script src="/assets/js/auth.js"></script>
  <script src="/assets/js/sessionHistory.js"></script>
</body>
</html>
