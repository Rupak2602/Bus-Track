// =====================================================
// BUS TRACK - ADMIN DASHBOARD
// =====================================================

let currentAdmin = null;


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Admin Dashboard loading...");

    await initializeAdminDashboard();

});


// =====================================================
// INITIALIZE ADMIN DASHBOARD
// =====================================================

async function initializeAdminDashboard() {

    try {

        // ---------------------------------------------
        // CHECK SUPABASE
        // ---------------------------------------------

        if (typeof supabaseClient === "undefined") {

            console.error("Supabase client not found.");

            alert("Supabase connection problem.");

            return;

        }


        // ---------------------------------------------
        // GET CURRENT SESSION
        // ---------------------------------------------

        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();


        if (sessionError) {

            console.error(
                "Session error:",
                sessionError
            );

            window.location.href = "login.html";

            return;

        }


        // ---------------------------------------------
        // NO SESSION
        // ---------------------------------------------

        if (
            !sessionData ||
            !sessionData.session
        ) {

            console.warn(
                "No admin session found."
            );

            window.location.href = "login.html";

            return;

        }


        currentAdmin =
            sessionData.session.user;


        console.log(
            "Current user:",
            currentAdmin.email
        );


        // ---------------------------------------------
        // CHECK ADMIN ROLE
        // ---------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabaseClient

            .from("profiles")

            .select(
                "id, full_name, phone, role"
            )

            .eq(
                "id",
                currentAdmin.id
            )

            .single();


        if (profileError) {

            console.error(
                "Profile error:",
                profileError
            );

            alert(
                "Unable to verify admin account."
            );

            return;

        }


        console.log(
            "Profile:",
            profile
        );


        // ---------------------------------------------
        // ADMIN ONLY
        // ---------------------------------------------

        if (
            !profile ||
            profile.role !== "admin"
        ) {

            alert(
                "Admin account required."
            );

            await supabaseClient.auth.signOut();

            window.location.href =
                "login.html";

            return;

        }


        console.log(
            "Admin authentication verified."
        );


        // ---------------------------------------------
        // LOAD DASHBOARD DATA
        // ---------------------------------------------

        await loadDashboardStats();


        console.log(
            "Admin Dashboard ready."
        );


    } catch (error) {

        console.error(
            "Dashboard initialization error:",
            error
        );

    }

}


// =====================================================
// LOAD DASHBOARD STATISTICS
// =====================================================

async function loadDashboardStats() {

    console.log(
        "Loading dashboard statistics..."
    );


    // ---------------------------------------------
    // TOTAL BUSES
    // ---------------------------------------------

    const {
        count: totalBusCount,
        error: busError
    } = await supabaseClient

        .from("buses")

        .select(
            "*",
            {
                count: "exact",
                head: true
            }
        );


    if (busError) {

        console.error(
            "Bus count error:",
            busError
        );

    }


    // ---------------------------------------------
    // ACTIVE BUSES
    // ---------------------------------------------

    const {
        count: activeBusCount,
        error: activeBusError
    } = await supabaseClient

        .from("buses")

        .select(
            "*",
            {
                count: "exact",
                head: true
            }
        )

        .eq(
            "status",
            "active"
        );


    if (activeBusError) {

        console.error(
            "Active bus count error:",
            activeBusError
        );

    }


    // ---------------------------------------------
    // TOTAL ROUTES
    // ---------------------------------------------

    const {
        count: totalRouteCount,
        error: routeError
    } = await supabaseClient

        .from("routes")

        .select(
            "*",
            {
                count: "exact",
                head: true
            }
        );


    if (routeError) {

        console.error(
            "Route count error:",
            routeError
        );

    }


    // ---------------------------------------------
    // TOTAL STOPS
    // ---------------------------------------------

    const {
        count: totalStopCount,
        error: stopError
    } = await supabaseClient

        .from("stops")

        .select(
            "*",
            {
                count: "exact",
                head: true
            }
        );


    if (stopError) {

        console.error(
            "Stop count error:",
            stopError
        );

    }


    // ---------------------------------------------
    // UPDATE UI
    // ---------------------------------------------

    const totalBuses =
        document.getElementById(
            "totalBuses"
        );

    const activeBuses =
        document.getElementById(
            "activeBuses"
        );

    const totalRoutes =
        document.getElementById(
            "totalRoutes"
        );

    const totalStops =
        document.getElementById(
            "totalStops"
        );


    if (totalBuses) {

        totalBuses.textContent =
            totalBusCount ?? 0;

    }


    if (activeBuses) {

        activeBuses.textContent =
            activeBusCount ?? 0;

    }


    if (totalRoutes) {

        totalRoutes.textContent =
            totalRouteCount ?? 0;

    }


    if (totalStops) {

        totalStops.textContent =
            totalStopCount ?? 0;

    }


    console.log(
        "Dashboard stats:",
        {
            buses: totalBusCount,
            activeBuses: activeBusCount,
            routes: totalRouteCount,
            stops: totalStopCount
        }
    );

}


// =====================================================
// NAVIGATION
// =====================================================

function goTo(page) {

    if (!page) {

        return;

    }


    window.location.href = page;

}


// =====================================================
// ADMIN LOGOUT
// =====================================================

async function logoutAdmin() {

    const confirmed =
        confirm(
            "Do you want to logout?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const {
            error
        } = await supabaseClient.auth.signOut();


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


        console.log(
            "Admin logout successful."
        );


        window.location.href =
            "login.html";


    } catch (error) {

        console.error(
            "Logout exception:",
            error
        );

        alert(
            "Logout failed."
        );

    }

}


// =====================================================
// GLOBAL FUNCTIONS
// =====================================================

window.goTo =
    goTo;

window.logoutAdmin =
    logoutAdmin;

window.loadDashboardStats =
    loadDashboardStats;