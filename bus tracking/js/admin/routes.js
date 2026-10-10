
/* =====================================================
   BUS TRACK - ADMIN ROUTES MANAGEMENT
===================================================== */

let allRoutes = [];
let editingRouteId = null;
let allBuses = [];
let allDrivers = [];

/* =====================================================
   PAGE INITIALIZATION
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Route Management initialized");

    try {
        const isAdmin = await checkAdminAccess();
        if (!isAdmin) return;

        await Promise.all([
            loadRoutes(),
            loadBuses(),
            loadDrivers()
        ]);
    } catch (error) {
        console.error("Route initialization error:", error);
        alert("Unable to initialize route management. Check console.");
    }
});

/* =====================================================
   ADMIN AUTHENTICATION
===================================================== */

async function checkAdminAccess() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Session error:", error);
        return false;
    }

    if (!data.session) {
        window.location.href = "login.html";
        return false;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

    if (profileError) {
        console.error("Admin profile error:", profileError);
        alert("Unable to verify admin account.");
        return false;
    }

    if (!profile || profile.role !== "admin") {
        alert("Admin account required.");
        window.location.href = "login.html";
        return false;
    }

    return true;
}

/* =====================================================
   LOAD ROUTES
===================================================== */

async function loadRoutes() {
    const tableBody = document.getElementById("routeTableBody");

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-table">Loading routes...</td>
            </tr>
        `;
    }

    const { data, error } = await supabaseClient
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Load routes error:", error);

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-table">
                        Unable to load routes.
                    </td>
                </tr>
            `;
        }
        return;
    }

    allRoutes = data || [];
    updateRouteStats();
    renderRoutes(allRoutes);
}

/* =====================================================
   LOAD BUSES
===================================================== */

async function loadBuses() {
    const select = document.getElementById("routeBusId");
    if (!select) return;

    select.innerHTML = `<option value="">Loading buses...</option>`;

    const { data, error } = await supabaseClient
        .from("buses")
        .select("id, bus_number, bus_name, registration_number, status")
        .order("bus_number", { ascending: true });

    if (error) {
        console.error("Load buses error:", error);
        select.innerHTML = `<option value="">Unable to load buses</option>`;
        return;
    }

    allBuses = data || [];
    select.innerHTML = `<option value="">Select Bus</option>`;

    allBuses.forEach(bus => {
        const option = document.createElement("option");
        option.value = bus.id;

        let label = `${bus.bus_number} — ${bus.bus_name || "College Bus"}`;

        if (bus.registration_number) {
            label += ` (${bus.registration_number})`;
        }

        if (bus.status && bus.status !== "active") {
            label += ` — ${capitalize(bus.status)}`;
        }

        option.textContent = label;
        select.appendChild(option);
    });
}

/* =====================================================
   LOAD DRIVERS - FIXED
   Fetch drivers first, then fetch profiles separately.
   This avoids depending on a nested Supabase relationship.
===================================================== */

async function loadDrivers() {
    const select = document.getElementById("routeDriverId");
    if (!select) return;

    select.innerHTML = `<option value="">Loading drivers...</option>`;

    // Step 1: Fetch driver records
    const { data: drivers, error: driverError } = await supabaseClient
        .from("drivers")
        .select("id, profile_id, driver_code, status")
        .order("driver_code", { ascending: true });

    if (driverError) {
        console.error("Load drivers error:", driverError);
        select.innerHTML = `<option value="">Unable to load drivers</option>`;
        return;
    }

    allDrivers = drivers || [];

    if (allDrivers.length === 0) {
        select.innerHTML = `<option value="">No drivers found</option>`;
        console.warn("No driver records were returned.");
        return;
    }

    // Step 2: Fetch matching profile names separately
    const profileIds = [
        ...new Set(
            allDrivers
                .map(driver => driver.profile_id)
                .filter(Boolean)
        )
    ];

    let profiles = [];

    if (profileIds.length > 0) {
        const { data: profileData, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("id, full_name, phone")
                .in("id", profileIds);

        if (profileError) {
            console.error("Load driver profiles error:", profileError);
            select.innerHTML =
                `<option value="">Unable to load driver profiles</option>`;
            return;
        }

        profiles = profileData || [];
    }

    // Step 3: Build dropdown
    select.innerHTML = `<option value="">Select Driver</option>`;

    allDrivers.forEach(driver => {
        const profile = profiles.find(
            item => item.id === driver.profile_id
        );

        const option = document.createElement("option");

        // IMPORTANT: bus_routes.driver_id references drivers.id
        option.value = driver.id;

        const name = profile?.full_name || "Driver";
        const code = driver.driver_code || "No code";

        option.textContent = `${name} — ${code}`;

        if (driver.status) {
            option.textContent += ` (${capitalize(driver.status)})`;
        }

        select.appendChild(option);
    });

    console.log("Drivers loaded:", allDrivers.length);
}

/* =====================================================
   ROUTE STATISTICS
===================================================== */

function updateRouteStats() {
    const total = allRoutes.length;
    const active = allRoutes.filter(
        route => route.status === "active"
    ).length;
    const inactive = allRoutes.filter(
        route => route.status === "inactive"
    ).length;

    const totalRoutes = document.getElementById("totalRoutes");
    const activeRoutes = document.getElementById("activeRoutes");
    const inactiveRoutes = document.getElementById("inactiveRoutes");

    if (totalRoutes) totalRoutes.textContent = total;
    if (activeRoutes) activeRoutes.textContent = active;
    if (inactiveRoutes) inactiveRoutes.textContent = inactive;

    loadTotalRouteStops();
}

async function loadTotalRouteStops() {
    const element = document.getElementById("totalRouteStops");
    if (!element) return;

    const { count, error } = await supabaseClient
        .from("route_stops")
        .select("*", { count: "exact", head: true });

    if (error) {
        console.error("Route stops count error:", error);
        element.textContent = "0";
        return;
    }

    element.textContent = count || 0;
}

/* =====================================================
   RENDER ROUTES
===================================================== */

function renderRoutes(routes) {
    const tableBody = document.getElementById("routeTableBody");
    if (!tableBody) return;

    if (!routes || routes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-table">No routes found.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = routes.map(route => {
        const statusClass = route.status === "active"
            ? "status-active"
            : "status-inactive";

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(route.route_name)}</strong>
                    ${route.description
                        ? `<small>${escapeHTML(route.description)}</small>`
                        : ""}
                </td>
                <td>${escapeHTML(route.start_point || "-")}</td>
                <td>${escapeHTML(route.end_point || "-")}</td>
                <td>
                    <span class="${statusClass}">
                        ${capitalize(route.status || "")}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="edit-btn"
                            onclick="editRoute('${route.id}')">Edit</button>
                        <button class="delete-btn"
                            onclick="deleteRoute('${route.id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/* =====================================================
   OPEN ADD ROUTE FORM
===================================================== */

async function openAddRouteForm() {
    const formSection = document.getElementById("routeFormSection");
    const form = document.getElementById("routeForm");
    const title = document.getElementById("routeFormTitle");

    if (!formSection) return;

    editingRouteId = null;

    if (form) form.reset();

    const routeId = document.getElementById("routeId");
    if (routeId) routeId.value = "";

    if (title) title.textContent = "Add New Route";

    await Promise.all([loadBuses(), loadDrivers()]);

    formSection.style.display = "block";
    formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closeRouteForm() {
    const formSection = document.getElementById("routeFormSection");
    const form = document.getElementById("routeForm");

    if (form) form.reset();

    editingRouteId = null;

    if (formSection) formSection.style.display = "none";
}

/* =====================================================
   SAVE ROUTE
===================================================== */

async function saveRoute(event) {
    event.preventDefault();

    const routeName = document.getElementById("routeName").value.trim();
    const startPoint = document.getElementById("startPoint").value.trim();
    const endPoint = document.getElementById("endPoint").value.trim();
    const description = document.getElementById("routeDescription").value.trim();
    const status = document.getElementById("routeStatus").value;
    const busId = document.getElementById("routeBusId").value;
    const driverId = document.getElementById("routeDriverId").value;

    if (!routeName || !startPoint || !endPoint) {
        alert("Please enter route name, start point and end point.");
        return;
    }

    if (!busId) {
        alert("Please select a bus.");
        return;
    }

    if (!driverId) {
        alert("Please select a driver.");
        return;
    }

    const routeData = {
        route_name: routeName,
        start_point: startPoint,
        end_point: endPoint,
        description: description || null,
        status: status
    };

    if (editingRouteId) {
        await updateExistingRoute(editingRouteId, routeData, busId, driverId);
    } else {
        await createNewRoute(routeData, busId, driverId);
    }
}

/* =====================================================
   CREATE ROUTE + ASSIGN BUS + DRIVER
===================================================== */

async function createNewRoute(routeData, busId, driverId) {
    const { data: newRoute, error: routeError } = await supabaseClient
        .from("routes")
        .insert([routeData])
        .select()
        .single();

    if (routeError) {
        console.error("Create route error:", routeError);
        alert("Unable to create route:\n" + routeError.message);
        return;
    }

    const { error: assignmentError } = await supabaseClient
        .from("bus_routes")
        .insert([{
            bus_id: busId,
            route_id: newRoute.id,
            driver_id: driverId
        }]);

    if (assignmentError) {
        console.error("Bus/driver assignment error:", assignmentError);

        // Remove the newly created route if assignment fails
        const { error: rollbackError } = await supabaseClient
            .from("routes")
            .delete()
            .eq("id", newRoute.id);

        if (rollbackError) {
            console.error("Route rollback error:", rollbackError);
        }

        alert(
            "Route assignment failed:\n" +
            assignmentError.message +
            "\n\nPlease check permissions and assignments."
        );
        return;
    }

    alert("Route + Bus + Driver assigned successfully! 🚍");
    closeRouteForm();
    await loadRoutes();
}

/* =====================================================
   UPDATE EXISTING ROUTE + ASSIGNMENT
===================================================== */

async function updateExistingRoute(routeId, routeData, busId, driverId) {
    const { error: routeError } = await supabaseClient
        .from("routes")
        .update(routeData)
        .eq("id", routeId);

    if (routeError) {
        console.error("Update route error:", routeError);
        alert("Unable to update route:\n" + routeError.message);
        return;
    }

    // Check existing assignment rows
    const { data: existingAssignments, error: fetchError } =
        await supabaseClient
            .from("bus_routes")
            .select("id, bus_id, route_id, driver_id")
            .eq("route_id", routeId);

    if (fetchError) {
        console.error("Fetch assignments error:", fetchError);
        alert("Could not check existing assignment:\n" + fetchError.message);
        return;
    }

    // Delete previous assignment(s) for this route
    if (existingAssignments && existingAssignments.length > 0) {
        const { error: deleteError } = await supabaseClient
            .from("bus_routes")
            .delete()
            .eq("route_id", routeId);

        if (deleteError) {
            console.error("Delete old assignment error:", deleteError);
            alert("Could not replace the old assignment:\n" + deleteError.message);
            return;
        }
    }

    // Insert the selected bus and driver
    const { error: insertError } = await supabaseClient
        .from("bus_routes")
        .insert([{
            bus_id: busId,
            route_id: routeId,
            driver_id: driverId
        }]);

    if (insertError) {
        console.error("New assignment error:", insertError);
        alert(
            "Route was updated, but assignment failed:\n" +
            insertError.message
        );
        await loadRoutes();
        return;
    }

    alert("Route, Bus and Driver updated successfully! 🚍");
    closeRouteForm();
    await loadRoutes();
}

/* =====================================================
   EDIT ROUTE
===================================================== */

async function editRoute(id) {
    const route = allRoutes.find(item => item.id === id);

    if (!route) {
        alert("Route not found.");
        return;
    }

    editingRouteId = id;

    document.getElementById("routeId").value = route.id;
    document.getElementById("routeName").value = route.route_name || "";
    document.getElementById("startPoint").value = route.start_point || "";
    document.getElementById("endPoint").value = route.end_point || "";
    document.getElementById("routeDescription").value = route.description || "";
    document.getElementById("routeStatus").value = route.status || "active";

    // Load dropdown data before setting selected values
    await Promise.all([loadBuses(), loadDrivers()]);

    const { data: assignment, error } = await supabaseClient
        .from("bus_routes")
        .select("bus_id, driver_id")
        .eq("route_id", id)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Load route assignment error:", error);
        alert("Unable to load the existing assignment:\n" + error.message);
    }

    if (assignment) {
        document.getElementById("routeBusId").value = assignment.bus_id;
        document.getElementById("routeDriverId").value = assignment.driver_id;
    } else {
        document.getElementById("routeBusId").value = "";
        document.getElementById("routeDriverId").value = "";
    }

    document.getElementById("routeFormTitle").textContent = "Edit Route";

    const formSection = document.getElementById("routeFormSection");
    if (formSection) {
        formSection.style.display = "block";
        formSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

/* =====================================================
   DELETE ROUTE
===================================================== */

async function deleteRoute(id) {
    const route = allRoutes.find(item => item.id === id);
    if (!route) return;

    const confirmed = confirm(
        `Delete route "${route.route_name}"?\n\n` +
        "Its bus/driver assignment will also be removed.\nContinue?"
    );

    if (!confirmed) return;

    const { error: assignmentError } = await supabaseClient
        .from("bus_routes")
        .delete()
        .eq("route_id", id);

    if (assignmentError) {
        console.error("Delete assignment error:", assignmentError);
        alert("Unable to remove bus assignment:\n" + assignmentError.message);
        return;
    }

    const { error: routeError } = await supabaseClient
        .from("routes")
        .delete()
        .eq("id", id);

    if (routeError) {
        console.error("Delete route error:", routeError);
        alert("Unable to delete route:\n" + routeError.message);
        return;
    }

    alert("Route deleted successfully!");
    await loadRoutes();
}

/* =====================================================
   SEARCH ROUTES
===================================================== */

function filterRoutes() {
    const searchInput = document.getElementById("routeSearch");
    if (!searchInput) return;

    const search = searchInput.value.trim().toLowerCase();

    if (!search) {
        renderRoutes(allRoutes);
        return;
    }

    const filtered = allRoutes.filter(route => {
        return [
            route.route_name,
            route.start_point,
            route.end_point,
            route.description
        ].some(value => (value || "").toLowerCase().includes(search));
    });

    renderRoutes(filtered);
}

/* =====================================================
   UTILITIES
===================================================== */

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function capitalize(value) {
    if (!value) return "";

    return value.charAt(0).toUpperCase() + value.slice(1);
}

/* =====================================================
   ADMIN LOGOUT
===================================================== */

async function logoutAdmin() {
    if (!confirm("Do you want to logout?")) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error("Logout error:", error);
        alert("Logout failed:\n" + error.message);
        return;
    }

    window.location.href = "login.html";
}

/* =====================================================
   GLOBAL FUNCTIONS FOR HTML BUTTONS
===================================================== */

window.openAddRouteForm = openAddRouteForm;
window.closeRouteForm = closeRouteForm;
window.saveRoute = saveRoute;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.filterRoutes = filterRoutes;
window.logoutAdmin = logoutAdmin;
