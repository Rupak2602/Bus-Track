// =====================================================
// BUS TRACK
// ADMIN - BUS ROUTE ASSIGNMENT
// =====================================================

let buses = [];
let routes = [];
let drivers = [];
let assignments = [];


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

    const allowed = await checkAdminAccess();

    if (!allowed) {
        return;
    }

    await loadAllData();

});


// =====================================================
// ADMIN ACCESS
// =====================================================

async function checkAdminAccess() {

    try {

        const {
            data: {
                session
            }
        } = await supabaseClient.auth.getSession();

        if (!session) {

            window.location.href = "login.html";

            return false;
        }


        const {
            data: profile,
            error
        } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();


        if (
            error ||
            !profile ||
            profile.role !== "admin"
        ) {

            alert("Admin access required.");

            window.location.href = "login.html";

            return false;
        }


        return true;


    } catch (error) {

        console.error(
            "Admin access error:",
            error
        );

        window.location.href =
            "login.html";

        return false;
    }

}


// =====================================================
// LOAD ALL DATA
// =====================================================

async function loadAllData() {

    await Promise.all([
        loadBuses(),
        loadRoutes(),
        loadDrivers(),
        loadAssignments()
    ]);

    populateDropdowns();

    renderAssignments();

    updateStats();

}


// =====================================================
// LOAD BUSES
// =====================================================

async function loadBuses() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("buses")
            .select(`
                id,
                bus_number,
                bus_name,
                registration_number,
                capacity,
                status
            `)
            .order(
                "bus_number",
                {
                    ascending: true
                }
            );


        if (error) {
            throw error;
        }


        buses = data || [];


        console.log(
            "Buses loaded:",
            buses
        );


    } catch (error) {

        console.error(
            "Bus loading error:",
            error
        );

        buses = [];

    }

}


// =====================================================
// LOAD ROUTES
// =====================================================

async function loadRoutes() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("routes")
            .select(`
                id,
                route_name,
                start_point,
                end_point,
                status
            `)
            .order(
                "route_name",
                {
                    ascending: true
                }
            );


        if (error) {
            throw error;
        }


        routes = data || [];


        console.log(
            "Routes loaded:",
            routes
        );


    } catch (error) {

        console.error(
            "Route loading error:",
            error
        );

        routes = [];

    }

}


// =====================================================
// LOAD DRIVERS
// =====================================================

async function loadDrivers() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("drivers")
            .select(`
                id,
                profile_id,
                driver_code,
                license_number,
                status,
                profiles (
                    full_name,
                    phone
                )
            `)
            .order(
                "driver_code",
                {
                    ascending: true
                }
            );


        if (error) {
            throw error;
        }


        drivers = data || [];


        console.log(
            "Drivers loaded:",
            drivers
        );


    } catch (error) {

        console.error(
            "Driver loading error:",
            error
        );

        drivers = [];

    }

}


// =====================================================
// LOAD ASSIGNMENTS
// =====================================================

async function loadAssignments() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("bus_routes")
            .select(`
                id,
                bus_id,
                route_id,
                driver_id,

                buses (
                    bus_number,
                    bus_name,
                    registration_number
                ),

                routes (
                    route_name,
                    start_point,
                    end_point
                ),

                drivers (
                    driver_code,
                    profile_id,

                    profiles (
                        full_name
                    )
                )
            `)
            .order(
                "id",
                {
                    ascending: false
                }
            );


        if (error) {
            throw error;
        }


        assignments = data || [];


        console.log(
            "Assignments loaded:",
            assignments
        );


    } catch (error) {

        console.error(
            "Assignment loading error:",
            error
        );

        assignments = [];

    }

}


// =====================================================
// POPULATE DROPDOWNS
// =====================================================

function populateDropdowns() {

    populateBusDropdown();

    populateRouteDropdown();

    populateDriverDropdown();

}


// =====================================================
// BUS DROPDOWN
// =====================================================

function populateBusDropdown() {

    const select =
        document.getElementById(
            "busSelect"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select Bus
        </option>
    `;


    const assignedBusIds =
        new Set(
            assignments.map(
                item => item.bus_id
            )
        );


    const availableBuses =
        buses.filter(
            bus =>
                bus.status === "active" &&
                !assignedBusIds.has(bus.id)
        );


    if (availableBuses.length === 0) {

        select.innerHTML = `
            <option value="">
                No buses available
            </option>
        `;

        return;
    }


    availableBuses.forEach(bus => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            bus.id;


        option.textContent =
            `${bus.bus_number} — ${bus.bus_name || "Bus"}`;


        select.appendChild(
            option
        );

    });

}


// =====================================================
// ROUTE DROPDOWN
// =====================================================

function populateRouteDropdown() {

    const select =
        document.getElementById(
            "routeSelect"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select Route
        </option>
    `;


    const availableRoutes =
        routes.filter(
            route =>
                route.status === "active"
        );


    if (availableRoutes.length === 0) {

        select.innerHTML = `
            <option value="">
                No active routes
            </option>
        `;

        return;
    }


    availableRoutes.forEach(route => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            route.id;


        option.textContent =
            `${route.route_name} (${route.start_point} → ${route.end_point})`;


        select.appendChild(
            option
        );

    });

}


// =====================================================
// DRIVER DROPDOWN
// =====================================================

function populateDriverDropdown() {

    const select =
        document.getElementById(
            "driverSelect"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select Driver
        </option>
    `;


    const assignedDriverIds =
        new Set(
            assignments.map(
                item => item.driver_id
            )
        );


    const availableDrivers =
        drivers.filter(
            driver =>
                driver.status !== "inactive" &&
                !assignedDriverIds.has(driver.id)
        );


    if (availableDrivers.length === 0) {

        select.innerHTML = `
            <option value="">
                No drivers available
            </option>
        `;

        return;
    }


    availableDrivers.forEach(driver => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            driver.id;


        const driverName =
            driver.profiles?.full_name ||
            "Driver";


        option.textContent =
            `${driver.driver_code} — ${driverName}`;


        select.appendChild(
            option
        );

    });

}


// =====================================================
// UPDATE PREVIEW
// =====================================================

function updateAssignmentPreview() {

    const busSelect =
        document.getElementById(
            "busSelect"
        );


    const routeSelect =
        document.getElementById(
            "routeSelect"
        );


    const driverSelect =
        document.getElementById(
            "driverSelect"
        );


    const previewBus =
        document.getElementById(
            "previewBus"
        );


    const previewRoute =
        document.getElementById(
            "previewRoute"
        );


    const previewDriver =
        document.getElementById(
            "previewDriver"
        );


    // BUS

    const bus =
        buses.find(
            item =>
                item.id === busSelect?.value
        );


    // ROUTE

    const route =
        routes.find(
            item =>
                item.id === routeSelect?.value
        );


    // DRIVER

    const driver =
        drivers.find(
            item =>
                item.id === driverSelect?.value
        );


    if (previewBus) {

        previewBus.textContent =
            bus
                ? bus.bus_number
                : "Select Bus";

    }


    if (previewRoute) {

        previewRoute.textContent =
            route
                ? route.route_name
                : "Select Route";

    }


    if (previewDriver) {

        previewDriver.textContent =
            driver
                ? (
                    driver.driver_code +
                    " — " +
                    (
                        driver.profiles?.full_name ||
                        "Driver"
                    )
                )
                : "Select Driver";

    }

}


// =====================================================
// SAVE ASSIGNMENT
// =====================================================

async function saveBusRoute(event) {

    event.preventDefault();


    const busId =
        document.getElementById(
            "busSelect"
        ).value;


    const routeId =
        document.getElementById(
            "routeSelect"
        ).value;


    const driverId =
        document.getElementById(
            "driverSelect"
        ).value;


    const button =
        document.getElementById(
            "assignButton"
        );


    if (
        !busId ||
        !routeId ||
        !driverId
    ) {

        alert(
            "Please select Bus, Route and Driver."
        );

        return;
    }


    // -----------------------------------------------
    // CHECK DUPLICATE BUS
    // -----------------------------------------------

    const duplicateBus =
        assignments.find(
            item =>
                item.bus_id === busId
        );


    if (duplicateBus) {

        alert(
            "This bus is already assigned."
        );

        return;
    }


    // -----------------------------------------------
    // CHECK DUPLICATE DRIVER
    // -----------------------------------------------

    const duplicateDriver =
        assignments.find(
            item =>
                item.driver_id === driverId
        );


    if (duplicateDriver) {

        alert(
            "This driver is already assigned."
        );

        return;
    }


    // -----------------------------------------------
    // LOADING
    // -----------------------------------------------

    button.disabled =
        true;

    button.textContent =
        "Assigning...";


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("bus_routes")
                .insert([
                    {
                        bus_id:
                            busId,

                        route_id:
                            routeId,

                        driver_id:
                            driverId
                    }
                ])
                .select()
                .single();


        if (error) {
            throw error;
        }


        console.log(
            "Assignment created:",
            data
        );


        alert(
            "Bus, Route and Driver assigned successfully! 🚍"
        );


        // Reload

        await loadAssignments();

        populateDropdowns();

        renderAssignments();

        updateStats();


        // Reset

        document
            .getElementById(
                "busRouteForm"
            )
            .reset();


        updateAssignmentPreview();


    } catch (error) {

        console.error(
            "Assignment save error:",
            error
        );


        alert(
            getAssignmentErrorMessage(
                error
            )
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Assign Bus & Route";

    }

}


// =====================================================
// RENDER ASSIGNMENT TABLE
// =====================================================

function renderAssignments(
    filteredData = assignments
) {

    const tbody =
        document.getElementById(
            "assignmentTableBody"
        );


    if (!tbody) {
        return;
    }


    if (
        !filteredData ||
        filteredData.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-table"
                >
                    No assignments found.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        filteredData
            .map(assignment => {

                const bus =
                    assignment.buses;


                const route =
                    assignment.routes;


                const driver =
                    assignment.drivers;


                const driverName =
                    driver?.profiles?.full_name ||
                    "Driver";


                return `
                    <tr>

                        <td>

                            <strong>
                                ${escapeHTML(
                                    bus?.bus_number || "-"
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    bus?.bus_name || ""
                                )}
                            </small>

                        </td>


                        <td>

                            <div class="route-name-cell">

                                <strong>
                                    ${escapeHTML(
                                        route?.route_name || "-"
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        route?.start_point || "-"
                                    )}
                                    →
                                    ${escapeHTML(
                                        route?.end_point || "-"
                                    )}
                                </span>

                            </div>

                        </td>


                        <td>

                            <strong>
                                ${escapeHTML(
                                    driver?.driver_code || "-"
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    driverName
                                )}
                            </small>

                        </td>


                        <td>

                            <span
                                class="assignment-status"
                            >
                                Active
                            </span>

                        </td>


                        <td>

                            <button
                                type="button"
                                class="danger-btn"
                                onclick="deleteAssignment('${assignment.id}')"
                            >
                                Remove
                            </button>

                        </td>

                    </tr>
                `;

            })
            .join("");

}


// =====================================================
// DELETE ASSIGNMENT
// =====================================================

async function deleteAssignment(
    assignmentId
) {

    const confirmed =
        confirm(
            "Remove this bus-route-driver assignment?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } =
            await supabaseClient
                .from("bus_routes")
                .delete()
                .eq(
                    "id",
                    assignmentId
                );


        if (error) {
            throw error;
        }


        alert(
            "Assignment removed successfully."
        );


        await loadAssignments();

        populateDropdowns();

        renderAssignments();

        updateStats();


    } catch (error) {

        console.error(
            "Delete assignment error:",
            error
        );


        alert(
            getAssignmentErrorMessage(
                error
            )
        );

    }

}


// =====================================================
// SEARCH
// =====================================================

function filterAssignments() {

    const search =
        document.getElementById(
            "assignmentSearch"
        ).value
            .trim()
            .toLowerCase();


    if (!search) {

        renderAssignments(
            assignments
        );

        return;
    }


    const filtered =
        assignments.filter(
            assignment => {

                const bus =
                    assignment.buses;


                const route =
                    assignment.routes;


                const driver =
                    assignment.drivers;


                const driverName =
                    driver?.profiles?.full_name ||
                    "";


                const text = [

                    bus?.bus_number,

                    bus?.bus_name,

                    route?.route_name,

                    route?.start_point,

                    route?.end_point,

                    driver?.driver_code,

                    driverName

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                return text.includes(
                    search
                );

            }
        );


    renderAssignments(
        filtered
    );

}


// =====================================================
// STATS
// =====================================================

function updateStats() {

    const total =
        assignments.length;


    const uniqueBuses =
        new Set(
            assignments.map(
                item =>
                    item.bus_id
            )
        ).size;


    const uniqueRoutes =
        new Set(
            assignments.map(
                item =>
                    item.route_id
            )
        ).size;


    const uniqueDrivers =
        new Set(
            assignments.map(
                item =>
                    item.driver_id
            )
        ).size;


    const totalElement =
        document.getElementById(
            "totalAssignments"
        );


    const busesElement =
        document.getElementById(
            "assignedBuses"
        );


    const routesElement =
        document.getElementById(
            "assignedRoutes"
        );


    const driversElement =
        document.getElementById(
            "assignedDrivers"
        );


    if (totalElement) {

        totalElement.textContent =
            total;

    }


    if (busesElement) {

        busesElement.textContent =
            uniqueBuses;

    }


    if (routesElement) {

        routesElement.textContent =
            uniqueRoutes;

    }


    if (driversElement) {

        driversElement.textContent =
            uniqueDrivers;

    }

}


// =====================================================
// ERROR MESSAGE
// =====================================================

function getAssignmentErrorMessage(
    error
) {

    const message =
        error?.message || "";


    const lower =
        message.toLowerCase();


    if (
        lower.includes(
            "row-level security"
        )
    ) {

        return (
            "Permission denied. Please add Admin RLS policies for bus_routes."
        );

    }


    if (
        lower.includes(
            "duplicate"
        )
    ) {

        return (
            "This assignment already exists."
        );

    }


    return (
        message ||
        "Unable to complete the assignment."
    );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// =====================================================
// BACK TO BUSES
// =====================================================

function goToBuses() {

    window.location.href =
        "buses.html";

}


// =====================================================
// LOGOUT
// =====================================================

async function logoutAdmin() {

    try {

        await supabaseClient.auth.signOut();

    } finally {

        window.location.href =
            "login.html";

    }

}