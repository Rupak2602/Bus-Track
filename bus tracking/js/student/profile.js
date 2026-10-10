
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("profileForm");
    const saveBtn = document.getElementById("saveBtn");
    const resetBtn = document.getElementById("resetBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const messageBox = document.getElementById("message");

    let currentUser = null;
    let originalValues = null;
    let studentRecordExists = false;

    const fieldIds = [
        "fullName",
        "phone",
        "studentId",
        "department",
        "year",
        "section"
    ];

    function value(id) {
        return document.getElementById(id).value.trim();
    }

    function setValue(id, val) {
        document.getElementById(id).value = val ?? "";
    }

    function showMessage(text, type = "info") {
        messageBox.textContent = text;
        messageBox.className = type;
        messageBox.style.display = "block";
        messageBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function updateHeader() {
        document.getElementById("displayName").textContent =
            value("fullName") || "Student";

        document.getElementById("displayEmail").textContent =
            currentUser?.email || "";

        document.getElementById("displayStudentId").textContent =
            "Student ID: " + (value("studentId") || "Not assigned");
    }

    function takeSnapshot() {
        const result = {};
        fieldIds.forEach(id => result[id] = value(id));
        return result;
    }

    function restoreSnapshot() {
        if (!originalValues) return;

        fieldIds.forEach(id => setValue(id, originalValues[id]));
        updateHeader();
        messageBox.style.display = "none";
    }

    async function loadProfile() {
        saveBtn.disabled = true;
        showMessage("Loading your profile...", "info");

        try {
            const { data: authData, error: authError } =
                await supabaseClient.auth.getUser();

            if (authError) throw authError;

            currentUser = authData.user;

            if (!currentUser) {
                window.location.href = "login.html";
                return;
            }

            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .select("id, full_name, phone, role")
                    .eq("id", currentUser.id)
                    .maybeSingle();

            if (profileError) throw profileError;

            if (!profile) {
                throw new Error("Profile record kidaikkala. Student signup check pannu.");
            }

            if (profile.role !== "student") {
                throw new Error("Student account-la login pannu.");
            }

            const { data: student, error: studentError } =
                await supabaseClient
                    .from("students")
                    .select("student_id, department, year, section")
                    .eq("profile_id", currentUser.id)
                    .maybeSingle();

            if (studentError) throw studentError;

            studentRecordExists = !!student;

            setValue("fullName", profile.full_name);
            setValue("email", currentUser.email);
            setValue("phone", profile.phone);

            setValue("studentId", student?.student_id);
            setValue("department", student?.department);
            setValue("year", student?.year);
            setValue("section", student?.section);

            updateHeader();
            originalValues = takeSnapshot();

            messageBox.style.display = "none";

            if (!studentRecordExists) {
                showMessage(
                    "Personal profile loaded. College details update panna students table-la student record venum.",
                    "info"
                );
            }
        } catch (error) {
            console.error("Profile load error:", error);
            showMessage(error.message || "Profile load aagala.", "error");
        } finally {
            saveBtn.disabled = false;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!currentUser) {
            showMessage("Please login again.", "error");
            return;
        }

        const fullName = value("fullName");
        const phone = value("phone");
        const studentId = value("studentId");
        const department = value("department");
        const year = value("year");
        const section = value("section");

        if (!fullName) {
            showMessage("Full name enter pannu.", "error");
            return;
        }

        if (!studentId) {
            showMessage("Register number enter pannu.", "error");
            return;
        }

        if (phone && !/^[0-9+\-\s()]{7,15}$/.test(phone)) {
            showMessage("Valid phone number enter pannu.", "error");
            return;
        }

        if (!studentRecordExists) {
            showMessage(
                "Students table-la un account-ku record illa. Admin/DB setup-la student record create pannitu save pannu.",
                "error"
            );
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        messageBox.style.display = "none";

        try {
            // Update main profile first.
            const { data: updatedProfile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .update({
                        full_name: fullName,
                        phone: phone || null
                    })
                    .eq("id", currentUser.id)
                    .select("id");

            if (profileError) throw profileError;

            if (!updatedProfile || updatedProfile.length === 0) {
                throw new Error(
                    "Profile update permission illa. Supabase profiles UPDATE policy check pannu."
                );
            }

            // Update student number and college information.
            const studentChanges = {
                student_id: studentId,
                department: department || null,
                year: year ? Number(year) : null,
                section: section || null
            };

            const { data: updatedStudent, error: studentError } =
                await supabaseClient
                    .from("students")
                    .update(studentChanges)
                    .eq("profile_id", currentUser.id)
                    .select("profile_id");

            if (studentError) throw studentError;

            if (!updatedStudent || updatedStudent.length === 0) {
                throw new Error(
                    "Student details update aagala. Supabase students UPDATE policy check pannu."
                );
            }

            // Read the saved values back from the database.
            const { data: savedProfile, error: savedProfileError } =
                await supabaseClient
                    .from("profiles")
                    .select("full_name, phone")
                    .eq("id", currentUser.id)
                    .single();

            if (savedProfileError) throw savedProfileError;

            const { data: savedStudent, error: savedStudentError } =
                await supabaseClient
                    .from("students")
                    .select("student_id, department, year, section")
                    .eq("profile_id", currentUser.id)
                    .single();

            if (savedStudentError) throw savedStudentError;

            setValue("fullName", savedProfile.full_name);
            setValue("phone", savedProfile.phone);
            setValue("studentId", savedStudent.student_id);
            setValue("department", savedStudent.department);
            setValue("year", savedStudent.year);
            setValue("section", savedStudent.section);

            updateHeader();
            originalValues = takeSnapshot();

            showMessage("✅ Profile saved successfully!", "success");
        } catch (error) {
            console.error("Profile save error:", error);

            let errorText = error.message || "Unknown error";

            if (error.code === "23505") {
                errorText = "Indha register number already another student use panraanga.";
            } else if (error.code === "42501") {
                errorText = "Permission denied. Supabase RLS UPDATE policy check pannanum.";
            }

            showMessage("❌ Save failed: " + errorText, "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Changes";
        }
    });

    resetBtn.addEventListener("click", restoreSnapshot);

    logoutBtn.addEventListener("click", async () => {
        if (!confirm("Logout panna virumburiya?")) return;

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            showMessage(error.message, "error");
            return;
        }

        window.location.href = "login.html";
    });

    document.getElementById("fullName").addEventListener("input", updateHeader);
    document.getElementById("studentId").addEventListener("input", updateHeader);

    loadProfile();
});
