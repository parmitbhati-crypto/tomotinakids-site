(() => {
  const form = document.getElementById("teacherForm");
  const message = document.getElementById("teacherMessage");
  const button = document.getElementById("inviteTeacher");
  const programSelect = document.getElementById("programIds");
  const editId = new URLSearchParams(location.search).get("id");
  const show = (text, type = "info") => { message.textContent = text; message.dataset.type = type; message.hidden = false; };

  async function init() {
    const user = await requireAuth();
    if (!user) return;
    const { data, error } = await window.sb.from("programs").select("id,name").order("name");
    if (error) return show("Programs could not be loaded. Refresh and try again.", "error");
    programSelect.innerHTML = (data || []).map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    if (!editId) return;
    const { data: teacher, error: teacherError } = await window.sb.from("profiles")
      .select("full_name,specialization,is_active,teacher_profiles(*),teacher_programs(program_id)")
      .eq("id", editId).eq("role", "teacher").maybeSingle();
    if (teacherError || !teacher) return show("Teacher profile could not be loaded.", "error");
    const details = teacher.teacher_profiles || {};
    const values = { fullName: teacher.full_name, email: details.email, mobile: details.mobile, designation: details.designation || teacher.specialization, address: details.address, employmentType: details.employment_type, joiningDate: details.joining_date, aadhaarLast4: details.aadhaar_last4, panLast4: details.pan_last4 };
    Object.entries(values).forEach(([name, value]) => { if (form.elements[name] && value != null) form.elements[name].value = value; });
    form.elements.email.readOnly = true;
    form.elements.isActive.checked = teacher.is_active;
    form.elements.aadhaarVerified.checked = details.aadhaar_verified;
    form.elements.panVerified.checked = details.pan_verified;
    const selected = new Set((teacher.teacher_programs || []).map((item) => item.program_id));
    Array.from(programSelect.options).forEach((option) => { option.selected = selected.has(option.value); });
    document.querySelector(".portal-title").textContent = "Edit Team Member";
    document.querySelector(".portal-subtitle").textContent = "Update teacher details, program assignments, and portal access.";
    button.textContent = "Save teacher profile";
  }

  async function uploadPhoto(userId, file) {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be 5 MB or smaller.");
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
    if (!ext) throw new Error("Photo must be JPG, PNG, or WebP.");
    const path = `${userId}/profile-${Date.now()}.${ext}`;
    const { error } = await window.sb.storage.from("teacher-photos").upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { error: updateError } = await window.sb.from("teacher_profiles").update({ photo_path: path }).eq("user_id", userId);
    if (updateError) throw updateError;
    return path;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    button.disabled = true;
    button.textContent = "Creating secure profile…";
    message.hidden = true;
    try {
      const payload = {
        fullName: values.get("fullName"), email: values.get("email"), mobile: values.get("mobile"),
        designation: values.get("designation"), address: values.get("address"),
        employmentType: values.get("employmentType"), joiningDate: values.get("joiningDate"),
        aadhaarLast4: values.get("aadhaarLast4"), aadhaarVerified: values.has("aadhaarVerified"),
        panLast4: values.get("panLast4"), panVerified: values.has("panVerified"),
        isActive: values.has("isActive"),
      };
      let userId = editId;
      if (editId) {
        const { error: profileError } = await window.sb.from("profiles").update({ full_name: payload.fullName, specialization: payload.designation, is_active: payload.isActive }).eq("id", editId);
        const { error: detailsError } = await window.sb.from("teacher_profiles").update({
          mobile: payload.mobile || null, designation: payload.designation, address: payload.address || null,
          employment_type: payload.employmentType, joining_date: payload.joiningDate || null,
          aadhaar_last4: payload.aadhaarLast4 || null, aadhaar_verified: payload.aadhaarVerified,
          pan_last4: String(payload.panLast4 || "").toUpperCase() || null, pan_verified: payload.panVerified,
        }).eq("user_id", editId);
        if (profileError || detailsError) throw new Error("Teacher details could not be updated.");
      } else {
        const { data, error } = await window.sb.functions.invoke("invite-teacher", { body: payload });
        if (error) throw new Error(data?.error || error.message);
        if (data?.error) throw new Error(data.error);
        userId = data.userId;
      }

      const selectedPrograms = Array.from(programSelect.selectedOptions).map((option) => ({
        teacher_id: userId, program_id: option.value,
      }));
      if (editId) {
        const { error: assignmentError } = await window.sb.rpc("replace_teacher_programs", {
          target_teacher_id: userId,
          selected_program_ids: selectedPrograms.map((item) => item.program_id),
        });
        if (assignmentError) throw new Error("Program assignments could not be updated.");
      } else if (selectedPrograms.length) {
        const { error: programError } = await window.sb.from("teacher_programs").insert(selectedPrograms);
        if (programError) throw new Error("Invitation sent, but program assignments need attention in Team Directory.");
      }
      try {
        await uploadPhoto(userId, values.get("photo")?.size ? values.get("photo") : null);
      } catch (photoError) {
        show(`Invitation sent. The profile was created, but the photo needs to be added later: ${photoError.message}`, "info");
        return;
      }
      window.location.href = editId ? `/portal/team.html?updated=${encodeURIComponent(payload.fullName)}` : `/portal/team.html?created=${encodeURIComponent(payload.fullName)}`;
    } catch (error) {
      show(error.message || "Teacher profile could not be created.", "error");
    } finally {
      button.disabled = false;
      button.textContent = editId ? "Save teacher profile" : "Create profile & send invitation";
    }
  });
  init();
})();
