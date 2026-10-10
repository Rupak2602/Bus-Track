// ============================================================
// DRIVER START TRIP
// ============================================================

let currentUser = null;
let currentProfile = null;
let currentDriver = null;

let assignments = [];


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("================================");
    console.log("DRIVER START TRIP");
    console.log("================================");

    await initializeStartTrip();

});


// ============================================================
// INITIALIZE
// ============================================================

async function initializeStartTrip() {

    try {

        // ------------------------------------------
        // GET LOGGED-IN USER
        // ------------------------------------------

        const {
            data: { user },
            error: authError
        } = await supabaseClient.auth.getUser();


        if (authError) {

            console.error(
                "Auth Error:",
                authError
            );

            window.location.href =
                "login.html";

            return;
        }


        if (!user) {

            console.log(
                "No logged-in user"
            );

            window.location.href =
                "login.html";

            return;
        }


        currentUser = user;


        console.log(
            "Logged-in user:",
            user.id
        );


        // ------------------------------------------
        // LOAD PROFILE
        // ------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();


        if (profileError) {

            console.error(
                "Profile Error:",
                profileError
            );

            showError(
                "Driver profile load panna mudiyala."
            );

            return;
        }


        currentProfile = profile;


        // ------------------------------------------
        // CHECK DRIVER ROLE
        // ------------------------------------------

        if (
            profile.role &&
            profile.role !== "driver"
        ) {

            alert(
                "This account is not a driver account."
            );

            await supabaseClient.auth.signOut();

            window.location.href =
                "login.html";

            return;
        }


        // ------------------------------------------
        // LOAD DRIVER
        // ------------------------------------------

        const {
            data: driver,
            error: driverError
        } = await supabaseClient
            .from("drivers")
            .select("*")
            .eq("profile_id", user.id)
            .single();


        if (driverError) {

            console.error(
                "Driver Error:",
                driverError
            );

            showError(
                "Driver record kandupidikka mudiyala."
            );

            return;
        }


        currentDriver = driver;


        console.log(
            "Driver:",
            driver
        );


        // ------------------------------------------
        // UPDATE DRIVER INFO
        // ------------------------------------------

        updateDriverInfo();


        // ------------------------------------------
        // CHECK ACTIVE TRIP
        // ------------------------------------------

        const hasActiveTrip =
            await checkActiveTrip();


        if (hasActiveTrip) {

            return;
        }


        // ------------------------------------------
        // LOAD BUS / ROUTE ASSIGNMENTS
        // ------------------------------------------

        await loadAssignments();


    }

    catch (error) {

        console.error(
            "Start Trip initialization error:",
            error
        );

        showError(
            "Something went wrong. Please refresh."
        );

    }

}


// ============================================================
// UPDATE DRIVER INFO
// ============================================================

function updateDriverInfo() {

    if (
        !currentProfile ||
        !currentDriver
    ) {

        return;
    }


    const name =
        currentProfile.full_name ||
        "Driver";


    const code =
        currentDriver.driver_code ||
        "--";


    const status =
        currentDriver.status ||
        "available";


    setText(
        "driverName",
        name
    );


    setText(
        "driverCode",
        code
    );


    setText(
        "driverStatusText",
        capitalize(status)
    );


    setText(
        "driverStatus",
        "● " + capitalize(status)
    );

}


// ============================================================
// CHECK ACTIVE TRIP
// ============================================================

async function checkActiveTrip() {

    if (!currentDriver) {

        return false;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("trips")
            .select(`
                id,
                bus_id,
                route_id,
                driver_id,
                status,
                started_at,

                buses (
                    bus_number,
                    bus_name
                ),

                routes (
                    route_name,
                    start_point,
                    end_point
                )
            `)
            .eq(
                "driver_id",
                currentDriver.id
            )
            .eq(
                "status",
                "active"
            )
            .order(
                "started_at",
                {
                    ascending: false
                }
            )
            .limit(1);


        if (error) {

            console.error(
                "Active trip check error:",
                error
            );

            return false;
        }


        if (
            !data ||
            data.length === 0
        ) {

            return false;
        }


        const activeTrip =
            data[0];


        console.log(
            "Active trip found:",
            activeTrip
        );


        // Show active trip box

        const activeMessage =
            document.getElementById(
                "activeTripMessage"
            );


        if (activeMessage) {

            activeMessage.classList.add(
                "show"
            );

        }


        // Disable trip selection

        const select =
            document.getElementById(
                "assignmentSelect"
            );


        if (select) {

            select.disabled = true;

        }


        const button =
            document.getElementById(
                "startTripButton"
            );


        if (button) {

            button.disabled = true;

        }


        return true;

    }

    catch (error) {

        console.error(
            "Active trip exception:",
            error
        );

        return false;

    }

}


// ============================================================
// LOAD BUS / ROUTE ASSIGNMENTS
// ============================================================

async function loadAssignments() {

    try {

        console.log(
            "Loading driver assignments..."
        );


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
                    id,
                    bus_number,
                    bus_name,
                    registration_number,
                    capacity,
                    status
                ),

                routes (
                    id,
                    route_name,
                    start_point,
                    end_point,
                    description,
                    status
                )
            `)
            .eq(
                "driver_id",
                currentDriver.id
            );


        if (error) {

            console.error(
                "Assignment Error:",
                error
            );

            showError(
                "Bus / Route assignment load panna mudiyala."
            );

            return;
        }


        assignments =
            data || [];


        console.log(
            "Assignments:",
            assignments
        );


        const select =
            document.getElementById(
                "assignmentSelect"
            );


        if (!select) {

            console.error(
                "assignmentSelect not found"
            );

            return;
        }


        // Clear

        select.innerHTML = "";


        // No assignment

        if (
            assignments.length === 0
        ) {

            const option =
                document.createElement(
                    "option"
                );


            option.value = "";

            option.textContent =
                "No bus / route assigned";

            select.appendChild(
                option
            );


            select.disabled = true;


            showError(
                "Admin innum bus and route assign pannala."
            );


            return;
        }


        // Default option

        const defaultOption =
            document.createElement(
                "option"
            );


        defaultOption.value = "";

        defaultOption.textContent =
            "Select Bus / Route";


        select.appendChild(
            defaultOption
        );


        // Add assignments

        assignments.forEach(
            (assignment, index) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    assignment.id;


                const bus =
                    assignment.buses;


                const route =
                    assignment.routes;


                const busNumber =
                    bus?.bus_number ||
                    "Bus";


                const routeName =
                    route?.route_name ||
                    "Route";


                option.textContent =
                    busNumber +
                    " — " +
                    routeName;


                select.appendChild(
                    option
                );

            }
        );


        console.log(
            "Assignments loaded successfully"
        );

    }

    catch (error) {

        console.error(
            "Load assignment error:",
            error
        );

        showError(
            "Assignment load failed."
        );

    }

}


// ============================================================
// SHOW ROUTE PREVIEW
// ============================================================

function showRoutePreview() {

    const select =
        document.getElementById(
            "assignmentSelect"
        );


    const preview =
        document.getElementById(
            "routePreview"
        );


    const routeName =
        document.getElementById(
            "previewRouteName"
        );


    const routePath =
        document.getElementById(
            "previewRoutePath"
        );


    const startButton =
        document.getElementById(
            "startTripButton"
        );


    if (!select) {

        return;
    }


    const assignmentId =
        select.value;


    // Nothing selected

    if (!assignmentId) {

        if (preview) {

            preview.classList.remove(
                "show"
            );

        }


        if (startButton) {

            startButton.disabled =
                true;

        }


        return;
    }


    // Find assignment

    const assignment =
        assignments.find(
            item =>
                item.id ===
                assignmentId
        );


    if (!assignment) {

        return;
    }


    const route =
        assignment.routes;


    const bus =
        assignment.buses;


    if (!route) {

        return;
    }


    // Route name

    if (routeName) {

        routeName.textContent =
            route.route_name ||
            "Selected Route";

    }


    // Route path

    if (routePath) {

        routePath.textContent =
            (route.start_point || "--") +
            " → " +
            (route.end_point || "--");

    }


    // Show preview

    if (preview) {

        preview.classList.add(
            "show"
        );

    }


    // Enable start

    if (startButton) {

        startButton.disabled =
            false;

    }


    console.log(
        "Selected assignment:",
        assignment
    );

}


// ============================================================
// START TRIP
// ============================================================

async function startTrip() {

    console.log(
        "Start Trip button clicked"
    );


    clearError();


    if (!currentDriver) {

        showError(
            "Driver information not loaded."
        );

        return;
    }


    // ------------------------------------------
    // GET SELECTED ASSIGNMENT
    // ------------------------------------------

    const select =
        document.getElementById(
            "assignmentSelect"
        );


    if (!select) {

        showError(
            "Assignment selector not found."
        );

        return;
    }


    const assignmentId =
        select.value;


    if (!assignmentId) {

        showError(
            "Please select a bus and route."
        );

        return;
    }


    // ------------------------------------------
    // FIND ASSIGNMENT
    // ------------------------------------------

    const assignment =
        assignments.find(
            item =>
                item.id ===
                assignmentId
        );


    if (!assignment) {

        showError(
            "Selected assignment not found."
        );

        return;
    }


    const bus =
        assignment.buses;


    const route =
        assignment.routes;


    if (!bus || !route) {

        showError(
            "Bus or route information missing."
        );

        return;
    }


    // ------------------------------------------
    // CONFIRM
    // ------------------------------------------

    const confirmed =
        confirm(
            "Start trip for " +
            bus.bus_number +
            " — " +
            route.route_name +
            "?"
        );


    if (!confirmed) {

        return;
    }


    // ------------------------------------------
    // DISABLE BUTTON
    // ------------------------------------------

    const button =
        document.getElementById(
            "startTripButton"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Starting Trip...";

    }


    try {

        // ------------------------------------------
        // DOUBLE CHECK ACTIVE TRIP
        // ------------------------------------------

        const {
            data: existingTrips,
            error: activeError
        } = await supabaseClient
            .from("trips")
            .select("id")
            .eq(
                "driver_id",
                currentDriver.id
            )
            .eq(
                "status",
                "active"
            )
            .limit(1);


        if (activeError) {

            console.error(
                "Active trip check:",
                activeError
            );

        }


        if (
            existingTrips &&
            existingTrips.length > 0
        ) {

            showError(
                "You already have an active trip."
            );


            if (button) {

                button.disabled =
                    true;

            }


            const activeMessage =
                document.getElementById(
                    "activeTripMessage"
                );


            if (activeMessage) {

                activeMessage.classList.add(
                    "show"
                );

            }


            return;
        }


        // ------------------------------------------
        // CREATE TRIP
        // ------------------------------------------

        const {
            data: trip,
            error: tripError
        } = await supabaseClient
            .from("trips")
            .insert({

                bus_id:
                    bus.id,

                route_id:
                    route.id,

                driver_id:
                    currentDriver.id,

                status:
                    "active",

                started_at:
                    new Date().toISOString()

            })
            .select()
            .single();


        if (tripError) {

            console.error(
                "Trip creation error:",
                tripError
            );

            throw tripError;
        }


        console.log(
            "Trip created:",
            trip
        );


        // ------------------------------------------
        // UPDATE DRIVER STATUS
        // ------------------------------------------

        const {
            error: driverUpdateError
        } = await supabaseClient
            .from("drivers")
            .update({
                status: "busy"
            })
            .eq(
                "id",
                currentDriver.id
            );


        if (driverUpdateError) {

            console.warn(
                "Driver status update failed:",
                driverUpdateError
            );

        }


        // ------------------------------------------
        // SAVE TRIP ID
        // ------------------------------------------

        localStorage.setItem(
            "activeTripId",
            trip.id
        );


        localStorage.setItem(
            "activeBusId",
            bus.id
        );


        localStorage.setItem(
            "activeRouteId",
            route.id
        );


        // ------------------------------------------
        // GO LIVE TRIP
        // ------------------------------------------

        window.location.href =
            "live-trip.html";

    }

    catch (error) {

        console.error(
            "START TRIP ERROR:",
            error
        );


        showError(
            error.message ||
            "Trip start failed."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "🚍 Start Trip";

        }

    }

}


// ============================================================
// GO TO LIVE TRIP
// ============================================================

function goToLiveTrip() {

    window.location.href =
        "live-trip.html";

}


// ============================================================
// LOGOUT
// ============================================================

async function logoutDriver() {

    try {

        const {
            error
        } =
            await supabaseClient
                .auth
                .signOut();


        if (error) {

            console.error(
                "Logout error:",
                error
            );

            alert(
                "Logout failed: " +
                error.message
            );

            return;
        }


        localStorage.removeItem(
            "activeTripId"
        );

        localStorage.removeItem(
            "activeBusId"
        );

        localStorage.removeItem(
            "activeRouteId"
        );


        window.location.href =
            "login.html";

    }

    catch (error) {

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Logout failed."
        );

    }

}


// ============================================================
// ERROR MESSAGE
// ============================================================

function showError(message) {

    const errorBox =
        document.getElementById(
            "tripError"
        );


    if (!errorBox) {

        alert(message);

        return;
    }


    errorBox.textContent =
        message;


    errorBox.classList.add(
        "show"
    );

}


// ============================================================
// CLEAR ERROR
// ============================================================

function clearError() {

    const errorBox =
        document.getElementById(
            "tripError"
        );


    if (!errorBox) {

        return;
    }


    errorBox.textContent =
        "";


    errorBox.classList.remove(
        "show"
    );

}


// ============================================================
// SET TEXT
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value ?? "--";

    }

}


// ============================================================
// CAPITALIZE
// ============================================================

function capitalize(value) {

    if (!value) {

        return "";

    }


    return (
        value
            .toString()
            .charAt(0)
            .toUpperCase()
        +
        value
            .toString()
            .slice(1)
    );

}