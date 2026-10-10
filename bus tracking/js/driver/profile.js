
document.addEventListener("DOMContentLoaded", () => {
  loadDriverProfile();

  document.getElementById("profileForm")
    .addEventListener("submit", saveProfile);

  document.getElementById("logoutBtn")
    .addEventListener("click", logoutDriver);
});

let currentUser = null;
let currentProfile = null;
let currentDriver = null;

function setMessage(message, isError = false) {
  const element = document.getElementById("message");
  element.textContent = message;
  element.style.color = isError ? "#c53232" : "#8190aa";
}

function display(id, value) {
  document.getElementById(id).textContent =
    value === null || value === undefined || value === ""
      ? "-"
      : String(value);
}

function showStatus(status) {
  const element = document.getElementById("driverStatus");
  const value = String(status || "unknown");

  element.textContent =
    value.charAt(0).toUpperCase() + value.slice(1);

  const normalized = value.toLowerCase();

  if (normalized === "available") {
    element.style.background = "#e8f8ee";
    element.style.color = "#16804a";
  } else if (normalized === "busy") {
    element.style.background = "#fff1dc";
    element.style.color = "#a45b00";
  } else {
    element.style.background = "#edf0f5";
    element.style.color = "#586780";
  }
}

async function loadDriverProfile() {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error(
        "Supabase client load aagala. js/config/supabase.js check pannu."
      );
    }

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

    if (!profile || profile.role !== "driver") {
      setMessage(
        "Driver account mattum indha page access panna mudiyum.",
        true
      );
      return;
    }

    currentProfile = profile;

    const { data: driver, error: driverError } =
      await supabaseClient
        .from("drivers")
        .select("id, profile_id, driver_code, license_number, status")
        .eq("profile_id", currentUser.id)
        .maybeSingle();

    if (driverError) throw driverError;

    if (!driver) {
      setMessage(
        "Driver record kidaikkala. Admin driver account-ai check pannanum.",
        true
      );
      return;
    }

    currentDriver = driver;

    display("driverName", profile.full_name || "Driver");
    display("driverEmail", currentUser.email);
    display("driverCode", driver.driver_code);
    display("licenseNumber", driver.license_number);
    showStatus(driver.status);

    document.getElementById("fullName").value =
      profile.full_name || "";

    document.getElementById("phone").value =
      profile.phone || "";

    await loadAssignment();

    document.getElementById("profileContent").hidden = false;
    setMessage("");
  } catch (error) {
    console.error("Driver profile error:", error);
    setMessage(
      "Profile load aagala: " + (error.message || "Unknown error"),
      true
    );
  }
}

async function loadAssignment() {
  display("busNumber", "Not assigned");
  display("busName", "-");
  display("busRegistration", "-");
  display("busCapacity", "-");
  display("routeName", "Not assigned");
  display("routeStart", "-");
  display("routeEnd", "-");
  display("assignmentStatus", "No assignment found");

  const { data: assignments, error: assignmentError } =
    await supabaseClient
      .from("bus_routes")
      .select("bus_id, route_id")
      .eq("driver_id", currentDriver.id);

  if (assignmentError) throw assignmentError;

  if (!assignments || assignments.length === 0) return;

  const assignment = assignments[0];

  const results = await Promise.all([
    supabaseClient
      .from("buses")
      .select("bus_number, bus_name, registration_number, capacity")
      .eq("id", assignment.bus_id)
      .maybeSingle(),

    supabaseClient
      .from("routes")
      .select("route_name, start_point, end_point")
      .eq("id", assignment.route_id)
      .maybeSingle()
  ]);

  const busResult = results[0];
  const routeResult = results[1];

  if (busResult.error) throw busResult.error;
  if (routeResult.error) throw routeResult.error;

  const bus = busResult.data;
  const route = routeResult.data;

  if (bus) {
    display("busNumber", bus.bus_number);
    display("busName", bus.bus_name);
    display("busRegistration", bus.registration_number);

    display(
      "busCapacity",
      bus.capacity === null || bus.capacity === undefined
        ? "-"
        : bus.capacity + " seats"
    );
  }

  if (route) {
    display("routeName", route.route_name);
    display("routeStart", route.start_point);
    display("routeEnd", route.end_point);
  }

  display("assignmentStatus", "Assigned by Admin");
}

async function saveProfile(event) {
  event.preventDefault();

  if (!currentUser || !currentProfile) {
    setMessage("Profile load aana piragu try pannu.", true);
    return;
  }

  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const saveBtn = document.getElementById("saveBtn");

  if (!fullName) {
    setMessage("Full name enter pannu.", true);
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null
      })
      .eq("id", currentUser.id)
      .select("id, full_name, phone, role")
      .single();

    if (error) throw error;

    currentProfile = data;

    display("driverName", data.full_name);
    setMessage("Profile successfully updated!");

  } catch (error) {
    console.error("Profile update error:", error);
    setMessage(
      "Save aagala. Supabase profiles UPDATE policy check pannu. " +
      (error.message || ""),
      true
    );
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
}

async function logoutDriver() {
  const confirmed = window.confirm("Logout panna virumburiya?");
  if (!confirmed) return;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Logout aagala: " + error.message);
  }
}
