(() => {
  const message = document.getElementById("profileMessage");
  const photo = document.getElementById("profilePhoto");
  const form = document.getElementById("photoForm");
  const input = document.getElementById("photoInput");
  const submit = document.getElementById("photoSubmit");
  let user;
  let currentPhotoPath = "";

  const show = (text, type = "info") => {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
  };
  const setText = (id, value) => {
    document.getElementById(id).textContent = value || "—";
  };
  const renderPhoto = async (path, name) => {
    photo.textContent = (name || "T").slice(0, 1).toUpperCase();
    if (!path) return;
    const { data } = await window.sb.storage.from("teacher-photos").createSignedUrl(path, 3600);
    if (data?.signedUrl) photo.innerHTML = `<img src="${data.signedUrl}" alt="Profile photo">`;
  };

  async function load() {
    user = await requireAuth();
    if (!user) return;
    const { data, error } = await window.sb
      .from("profiles")
      .select("full_name,specialization,teacher_profiles(email,mobile,designation,address,photo_path)")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data) {
      show("Your profile could not be loaded. Please try again.", "error");
      return;
    }
    const details = data.teacher_profiles || {};
    currentPhotoPath = details.photo_path || "";
    setText("profileName", data.full_name);
    setText("profileDesignation", details.designation || data.specialization || "Teacher");
    setText("profileEmail", details.email || user.email);
    setText("profileMobile", details.mobile);
    setText("profileAddress", details.address);
    await renderPhoto(currentPhotoPath, data.full_name);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = input.files?.[0];
    if (!file) return show("Choose a photo before uploading.", "error");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return show("Use a JPG, PNG, or WebP image.", "error");
    if (file.size > 5 * 1024 * 1024) return show("The photo must be 5 MB or smaller.", "error");

    submit.disabled = true;
    submit.textContent = "Uploading…";
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
    const newPath = `${user.id}/profile-${Date.now()}.${extension}`;
    const { error: uploadError } = await window.sb.storage
      .from("teacher-photos")
      .upload(newPath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      show("The photo could not be uploaded. Please try again.", "error");
    } else {
      const { error: updateError } = await window.sb
        .from("teacher_profiles")
        .update({ photo_path: newPath })
        .eq("user_id", user.id);
      if (updateError) {
        await window.sb.storage.from("teacher-photos").remove([newPath]);
        show("Your profile could not be updated. No photo was changed.", "error");
      } else {
        const oldPath = currentPhotoPath;
        currentPhotoPath = newPath;
        await renderPhoto(newPath, document.getElementById("profileName").textContent);
        input.value = "";
        show("Your profile photo has been updated.", "success");
        if (oldPath && oldPath !== newPath) await window.sb.storage.from("teacher-photos").remove([oldPath]);
      }
    }
    submit.disabled = false;
    submit.textContent = "Upload new photo";
  });

  load();
})();
