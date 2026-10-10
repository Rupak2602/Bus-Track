// ==========================================
// STUDENT DASHBOARD
// ==========================================


// ==========================================
// GLOBAL STUDENT DATA
// ==========================================

let currentUser = null;
let currentStudent = null;


// ==========================================
// INITIALIZE DASHBOARD
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    await initializeDashboard();

});


// ==========================================
// INITIALIZE
// ==========================================

async function initializeDashboard() {

    try {

        // Get logged-in user
        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();


        if (sessionError) {

            console.error(
                "Session error:",
                sessionError
            );

            redirectToLogin();

            return;
        }


        // No logged-in user
        if (!sessionData.session) {

            redirectToLogin();

            return;
        }


        currentUser =
            sessionData.session.user;


        // Load student profile
        await loadStudentProfile();


        // Load active trip
        await loadActiveTrip();


        // Load notifications
        await loadNotifications();

    }

    catch (error) {

        console.error(
            "Dashboard initialization error:",
            error
        );

    }

}


// ==========================================
// LOAD STUDENT PROFILE
// ==========================================

async function loadStudentProfile() {

    // Get profile
    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select(
            "id, full_name, role"
        )
        .eq(
            "id",
            currentUser.id
        )
        .single();


    if (profileError) {

        console.error(
            "Profile loading error:",
            profileError
        );

        return;
    }


    // Make sure this is a student
    if (!profile || profile.role !== "student") {

        await supabaseClient.auth.signOut();

        redirectToLogin();

        return;
    }


    // Save profile
    currentStudent = profile;


    // Display student name
    const studentName =
        document.getElementById(
            "studentName"
        );


    if (studentName) {

        studentName.textContent =
            getFirstName(profile.full_name);

    }


    // Profile initial
    const profileInitial =
        document.getElementById(
            "profileInitial"
        );


    if (profileInitial) {

        profileInitial.textContent =
            getInitial(profile.full_name);

    }


    // Get student table data
    const {
        data: studentData,
        error: studentError
    } = await supabaseClient
        .from("students")
        .select(
            "id, student_id, department, year, section"
        )
        .eq(
            "profile_id",
            currentUser.id
        )
        .single();


    if (studentError) {

        console.warn(
            "Student details:",
            studentError.message
        );

        return;
    }


    currentStudent = {
        ...profile,
        ...studentData
    };

}


// ==========================================
// LOAD ACTIVE TRIP
// ==========================================

async function loadActiveTrip() {

    const {
        data: trips,
        error
    } = await supabaseClient
        .from("trips")
        .select(`
            id,
            bus_id,
            route_id,
            driver_id,
            status,
            current_stop_id,
            started_at
        `)
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
            "Active trip error:",
            error
        );

        return;
    }


    // No active trip
    if (!trips || trips.length === 0) {

        showNoActiveTrip();

        return;
    }


    const trip = trips[0];


    // Load bus
    const {
        data: bus
    } = await supabaseClient
        .from("buses")
        .select(
            "id, bus_number, bus_name"
        )
        .eq(
            "id",
            trip.bus_id
        )
        .single();


    // Load route
    const {
        data: route
    } = await supabaseClient
        .from("routes")
        .select(
            "id, route_name, start_point, end_point"
        )
        .eq(
            "id",
            trip.route_id
        )
        .single();


    // Update bus
    const liveBusNumber =
        document.getElementById(
            "liveBusNumber"
        );


    if (liveBusNumber) {

        liveBusNumber.textContent =
            bus
                ? bus.bus_number
                : "Unknown bus";

    }


    // Update route
    const liveRoute =
        document.getElementById(
            "liveRoute"
        );


    if (liveRoute) {

        liveRoute.textContent =
            route
                ? route.route_name
                : "Unknown route";

    }


    // Update status
    const busStatus =
        document.getElementById(
            "busStatus"
        );


    if (busStatus) {

        busStatus.textContent =
            "On Trip";

    }


    // Load current stop
    if (trip.current_stop_id) {

        await loadCurrentStop(
            trip.current_stop_id
        );

    }

}


// ==========================================
// NO ACTIVE TRIP
// ==========================================

function showNoActiveTrip() {

    const liveBusNumber =
        document.getElementById(
            "liveBusNumber"
        );

    const liveRoute =
        document.getElementById(
            "liveRoute"
        );

    const busStatus =
        document.getElementById(
            "busStatus"
        );

    const nextStop =
        document.getElementById(
            "nextStop"
        );

    const nextStopInfo =
        document.getElementById(
            "nextStopInfo"
        );


    if (liveBusNumber) {

        liveBusNumber.textContent =
            "No active bus";

    }


    if (liveRoute) {

        liveRoute.textContent =
            "No active route";

    }


    if (busStatus) {

        busStatus.textContent =
            "Waiting";

    }


    if (nextStop) {

        nextStop.textContent =
            "No active trip";

    }


    if (nextStopInfo) {

        nextStopInfo.textContent =
            "Start tracking when your bus begins its trip.";

    }

}


// ==========================================
// LOAD CURRENT STOP
// ==========================================

async function loadCurrentStop(stopId) {

    const {
        data: stop,
        error
    } = await supabaseClient
        .from("stops")
        .select(
            "id, stop_name"
        )
        .eq(
            "id",
            stopId
        )
        .single();


    if (error) {

        console.error(
            "Stop loading error:",
            error
        );

        return;
    }


    if (!stop) return;


    const nextStop =
        document.getElementById(
            "nextStop"
        );


    const nextStopInfo =
        document.getElementById(
            "nextStopInfo"
        );


    if (nextStop) {

        nextStop.textContent =
            stop.stop_name;

    }


    if (nextStopInfo) {

        nextStopInfo.textContent =
            "Bus is currently at this stop.";

    }

}


// ==========================================
// LOAD NOTIFICATIONS
// ==========================================

async function loadNotifications() {

    if (!currentUser) return;


    // Get student ID
    const {
        data: student,
        error: studentError
    } = await supabaseClient
        .from("students")
        .select("id")
        .eq(
            "profile_id",
            currentUser.id
        )
        .single();


    if (studentError || !student) {

        console.error(
            "Student notification lookup error:",
            studentError
        );

        return;
    }


    // Get notifications
    const {
        data: notifications,
        error
    } = await supabaseClient
        .from("notifications")
        .select(`
            id,
            title,
            message,
            type,
            is_read,
            created_at
        `)
        .eq(
            "student_id",
            student.id
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        )
        .limit(10);


    if (error) {

        console.error(
            "Notification error:",
            error
        );

        return;
    }


    if (!notifications) return;


    // Unread count
    const unreadCount =
        notifications.filter(
            notification =>
                !notification.is_read
        ).length;


    const notificationCount =
        document.getElementById(
            "notificationCount"
        );


    if (notificationCount) {

        notificationCount.textContent =
            unreadCount;

    }


    // Latest notification
    if (notifications.length > 0) {

        const latest =
            notifications[0];


        const latestNotification =
            document.getElementById(
                "latestNotification"
            );


        const latestNotificationMessage =
            document.getElementById(
                "latestNotificationMessage"
            );


        if (latestNotification) {

            latestNotification.textContent =
                latest.title;

        }


        if (latestNotificationMessage) {

            latestNotificationMessage.textContent =
                latest.message;

        }

    }

}


// ==========================================
// GET FIRST NAME
// ==========================================

function getFirstName(fullName) {

    if (!fullName) {
        return "Student";
    }


    return fullName
        .trim()
        .split(" ")[0];

}


// ==========================================
// GET INITIAL
// ==========================================

function getInitial(fullName) {

    if (!fullName) {
        return "S";
    }


    return fullName
        .trim()
        .charAt(0)
        .toUpperCase();

}


// ==========================================
// REDIRECT TO LOGIN
// ==========================================

function redirectToLogin() {

    window.location.href =
        "login.html";

}


// ==========================================
// NAVIGATION
// ==========================================

function goHome() {

    window.location.href =
        "dashboard.html";

}


function openLiveTracking() {

    window.location.href =
        "live-tracking.html";

}


function openBuses() {

    window.location.href =
        "buses.html";

}


function openRoutes() {

    window.location.href =
        "routes.html";

}


function openStops() {

    window.location.href =
        "stops.html";

}


function openNotifications() {

    window.location.href =
        "notifications.html";

}


function openProfile() {

    window.location.href =
        "profile.html";

}