// =====================================================
// BUS TRACK - ROUTE STOPS MANAGEMENT
// =====================================================

let allRoutes = [];
let allStops = [];
let currentRouteStops = [];


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

    const accessGranted = await checkAdminAccess();

    if (!accessGranted) {
        return;
    }

    await loadRoutes();
    await loadAllStops();

});


// =====================================================
// ADMIN ACCESS CHECK
// =====================================================

async function checkAdminAccess() {

    try {

        const {
            data: { session },
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError || !session) {

            alert("Please login as Admin.");

            window.location.href = "login.html";

            return false;
        }


        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();


        if (error || !profile || profile.role !== "admin") {

            alert("Admin access required.");

            window.location.href = "login.html";

            return false;
        }


        return true;

    } catch (error) {

        console.error("Admin access error:", error);

        alert("Unable to verify admin access.");

        return false;
    }
}


// =====================================================
// LOAD ROUTES
// =====================================================

async function loadRoutes() {

    try {

        const { data, error } = await supabaseClient
            .from("routes")
            .select("*")
            .order("route_name", { ascending: true });


        if (error) {

            console.error("Load routes error:", error);

            alert("Unable to load routes.");

            return;
        }


        allRoutes = data || [];

        renderRouteDropdown();

    } catch (error) {

        console.error(error);
    }
}


// =====================================================
// ROUTE DROPDOWN
// =====================================================

function renderRouteDropdown() {

    const routeSelect = document.getElementById("routeSelect");

    if (!routeSelect) {
        return;
    }


    routeSelect.innerHTML = `
        <option value="">
            Select a route
        </option>
    `;


    allRoutes.forEach(route => {

        const option = document.createElement("option");

        option.value = route.id;

        option.textContent =
            `${route.route_name} (${route.start_point} → ${route.end_point})`;

        routeSelect.appendChild(option);

    });
}


// =====================================================
// LOAD ALL STOPS
// =====================================================

async function loadAllStops() {

    try {

        const { data, error } = await supabaseClient
            .from("stops")
            .select("*")
            .order("stop_name", { ascending: true });


        if (error) {

            console.error("Load stops error:", error);

            alert("Unable to load stops.");

            return;
        }


        allStops = data || [];

        renderStopDropdown();

    } catch (error) {

        console.error(error);
    }
}


// =====================================================
// STOP DROPDOWN
// =====================================================

function renderStopDropdown() {

    const stopSelect = document.getElementById("stopSelect");

    if (!stopSelect) {
        return;
    }


    stopSelect.innerHTML = `
        <option value="">
            Select a stop
        </option>
    `;


    allStops.forEach(stop => {

        const option = document.createElement("option");

        option.value = stop.id;

        option.textContent = stop.stop_name;

        stopSelect.appendChild(option);

    });
}


// =====================================================
// LOAD SELECTED ROUTE STOPS
// =====================================================

async function loadRouteStops() {

    const routeSelect = document.getElementById("routeSelect");

    const routeId = routeSelect.value;


    if (!routeId) {

        document.getElementById("selectedRouteName").textContent =
            "None";

        document.getElementById("routeStopsList").innerHTML = `
            <div class="empty-state">
                Select a route to view its stops.
            </div>
        `;

        currentRouteStops = [];

        return;
    }


    const selectedRoute = allRoutes.find(
        route => route.id === routeId
    );


    if (selectedRoute) {

        document.getElementById("selectedRouteName").textContent =
            selectedRoute.route_name;
    }


    try {

        const { data, error } = await supabaseClient
            .from("route_stops")
            .select(`
                id,
                route_id,
                stop_id,
                stop_order,
                stops (
                    id,
                    stop_name,
                    latitude,
                    longitude
                )
            `)
            .eq("route_id", routeId)
            .order("stop_order", { ascending: true });


        if (error) {

            console.error("Load route stops error:", error);

            alert("Unable to load route stops.");

            return;
        }


        currentRouteStops = data || [];

        renderRouteStops();

    } catch (error) {

        console.error(error);
    }
}


// =====================================================
// RENDER ROUTE STOPS
// =====================================================

function renderRouteStops() {

    const container =
        document.getElementById("routeStopsList");


    if (!currentRouteStops.length) {

        container.innerHTML = `
            <div class="empty-state">
                No stops assigned to this route yet.
            </div>
        `;

        return;
    }


    container.innerHTML = "";


    currentRouteStops
        .sort((a, b) => a.stop_order - b.stop_order)
        .forEach((routeStop, index) => {

            const stop = routeStop.stops;

            const item = document.createElement("div");

            item.className = "stop-item";


            item.innerHTML = `
                
                <div class="stop-order">
                    ${index + 1}
                </div>

                <div>

                    <div class="stop-name">
                        ${escapeHTML(stop.stop_name)}
                    </div>

                    <div class="stop-coordinates">
                        ${stop.latitude}, ${stop.longitude}
                    </div>

                </div>

                <button
                    class="btn btn-danger"
                    onclick="removeStopFromRoute('${routeStop.id}')"
                >
                    Remove
                </button>

            `;


            container.appendChild(item);

        });
}


// =====================================================
// ADD STOP TO ROUTE
// =====================================================

async function addStopToRoute() {

    const routeSelect =
        document.getElementById("routeSelect");

    const stopSelect =
        document.getElementById("stopSelect");

    const orderInput =
        document.getElementById("stopOrder");


    const routeId = routeSelect.value;

    const stopId = stopSelect.value;

    let requestedOrder =
        parseInt(orderInput.value);


    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (!routeId) {

        alert("Please select a route.");

        return;
    }


    if (!stopId) {

        alert("Please select a stop.");

        return;
    }


    if (!requestedOrder || requestedOrder < 1) {

        alert("Please enter a valid stop order.");

        return;
    }


    // -----------------------------------------------
    // CHECK DUPLICATE
    // -----------------------------------------------

    const alreadyExists =
        currentRouteStops.some(
            item => item.stop_id === stopId
        );


    if (alreadyExists) {

        alert("This stop is already added to this route.");

        return;
    }


    // -----------------------------------------------
    // GET EXISTING STOPS
    // -----------------------------------------------

    let updatedStops = [
        ...currentRouteStops
    ];


    const newStop = {
        stop_id: stopId,
        stop_order: requestedOrder
    };


    updatedStops.push(newStop);


    // Sort by requested order

    updatedStops.sort(
        (a, b) => a.stop_order - b.stop_order
    );


    // -----------------------------------------------
    // REBUILD ORDER
    // -----------------------------------------------

    updatedStops = updatedStops.map(
        (item, index) => {

            return {
                stop_id: item.stop_id,
                stop_order: index + 1
            };

        }
    );


    // -----------------------------------------------
    // SAVE
    // -----------------------------------------------

    const success =
        await saveRouteStops(routeId, updatedStops);


    if (success) {

        stopSelect.value = "";

        orderInput.value = "";

        await loadRouteStops();

    }
}


// =====================================================
// SAVE ROUTE STOPS
// =====================================================

async function saveRouteStops(routeId, stops) {

    try {

        // First remove old route stops

        const { error: deleteError } =
            await supabaseClient
                .from("route_stops")
                .delete()
                .eq("route_id", routeId);


        if (deleteError) {

            console.error(
                "Delete old route stops error:",
                deleteError
            );

            alert(
                "Unable to update route stops.\n\n" +
                deleteError.message
            );

            return false;
        }


        if (!stops.length) {

            return true;
        }


        const rows = stops.map(item => ({

            route_id: routeId,

            stop_id: item.stop_id,

            stop_order: item.stop_order

        }));


        const { error: insertError } =
            await supabaseClient
                .from("route_stops")
                .insert(rows);


        if (insertError) {

            console.error(
                "Insert route stops error:",
                insertError
            );

            alert(
                "Unable to save route stops.\n\n" +
                insertError.message
            );

            return false;
        }


        return true;

    } catch (error) {

        console.error(error);

        alert(
            "Something went wrong while saving route stops."
        );

        return false;
    }
}


// =====================================================
// REMOVE STOP
// =====================================================

async function removeStopFromRoute(routeStopId) {

    const confirmed =
        confirm(
            "Remove this stop from the route?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const { error } =
            await supabaseClient
                .from("route_stops")
                .delete()
                .eq("id", routeStopId);


        if (error) {

            console.error(
                "Remove stop error:",
                error
            );

            alert(
                "Unable to remove stop.\n\n" +
                error.message
            );

            return;
        }


        await loadRouteStops();


    } catch (error) {

        console.error(error);

        alert("Something went wrong.");
    }
}


// =====================================================
// BACK TO ROUTES
// =====================================================

function goBackToRoutes() {

    window.location.href = "routes.html";

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}