
/* =====================================================
   BUS TRACK - DRIVER LIVE TRIP
   GPS + MAP + ROUTE STOPS + GEOFENCE NOTIFICATIONS
===================================================== */

let currentUser = null;
let currentDriver = null;
let currentTrip = null;

let map = null;
let busMarker = null;
let gpsWatchId = null;

let routeStops = [];
let currentStopIndex = -1;

let notifiedStops = new Set();
let isSavingLocation = false;

/* =====================================================
   PAGE INITIALIZATION
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializeLiveTrip();
    } catch (error) {
        console.error("Live trip initialization error:", error);
        setText("locationMessage", "Unable to load trip. Check Console.");
    }
});

async function initializeLiveTrip() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (!data.session) {
        window.location.href = "login.html";
        return;
    }

    currentUser = data.session.user;

    await loadDriver();
    await loadActiveTrip();

    initializeMap();
    await loadRouteStops();

    startGPS();
}

/* =====================================================
   LOAD DRIVER
===================================================== */

async function loadDriver() {
    const { data, error } = await supabaseClient
        .from("drivers")
        .select("id, profile_id, driver_code, status")
        .eq("profile_id", currentUser.id)
        .single();

    if (error) throw error;

    currentDriver = data;
}

/* =====================================================
   LOAD ACTIVE TRIP
===================================================== */

async function loadActiveTrip() {
    const { data, error } = await supabaseClient
        .from("trips")
        .select(`
            *,
            buses (
                id,
                bus_number,
                bus_name
            ),
            routes (
                id,
                route_name,
                start_point,
                end_point
            )
        `)
        .eq("driver_id", currentDriver.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        setText("tripStatus", "No Active Trip");
        throw new Error("No active trip found.");
    }

    currentTrip = data;

    setText("busNumber", data.buses?.bus_number || "Unknown");
    setText("routeName", data.routes?.route_name || "Unknown");
    setText("tripStatus", "Active");

    console.log("Active trip:", currentTrip.id);
}

/* =====================================================
   INITIALIZE MAP
===================================================== */

function initializeMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement || typeof L === "undefined") {
        throw new Error("Map element or Leaflet is missing.");
    }

    map = L.map("map").setView([13.0827, 80.2707], 12);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
        {
            maxZoom: 20,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    ).addTo(map);

    setTimeout(() => map?.invalidateSize(), 500);
}

/* =====================================================
   LOAD ROUTE STOPS
===================================================== */

async function loadRouteStops() {
    const { data, error } = await supabaseClient
        .from("route_stops")
        .select(`
            stop_order,
            stops (
                id,
                stop_name,
                latitude,
                longitude,
                notification_radius
            )
        `)
        .eq("route_id", currentTrip.route_id)
        .order("stop_order", { ascending: true });

    if (error) throw error;

    routeStops = data || [];

    renderStops();
    addStopMarkers();
}

function addStopMarkers() {
    if (!map) return;

    routeStops.forEach(item => {
        const stop = item.stops;
        if (!stop) return;

        const lat = Number(stop.latitude);
        const lon = Number(stop.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        L.marker([lat, lon])
            .addTo(map)
            .bindPopup(
                `<strong>${escapeHTML(stop.stop_name)}</strong><br>
                 Stop ${item.stop_order}<br>
                 Radius: ${Number(stop.notification_radius) || 100}m`
            );
    });
}

function renderStops() {
    const container = document.getElementById("stopsList");
    if (!container) return;

    if (!routeStops.length) {
        container.textContent = "No stops assigned to this route.";
        return;
    }

    container.innerHTML = routeStops.map(item => {
        const stop = item.stops;
        if (!stop) return "";

        return `
            <div class="stop-item" id="stop-${escapeHTML(stop.id)}">
                <div class="stop-number">${Number(item.stop_order)}</div>
                <div>
                    <div class="stop-name">${escapeHTML(stop.stop_name)}</div>
                    <div class="stop-coordinates">
                        ${Number(stop.latitude).toFixed(6)},
                        ${Number(stop.longitude).toFixed(6)}
                    </div>
                    <small class="stop-distance" id="distance-${escapeHTML(stop.id)}">
                        Waiting for GPS...
                    </small>
                </div>
            </div>
        `;
    }).join("");
}

/* =====================================================
   START GPS
===================================================== */

function startGPS() {
    if (!navigator.geolocation) {
        setText("locationMessage", "GPS is not supported by this browser.");
        return;
    }

    setText("locationMessage", "Requesting GPS permission...");

    gpsWatchId = navigator.geolocation.watchPosition(
        handleGPSUpdate,
        handleGPSError,
        {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 15000
        }
    );
}

/* =====================================================
   GPS UPDATE
===================================================== */

async function handleGPSUpdate(position) {
    if (!currentTrip || isSavingLocation) return;

    isSavingLocation = true;

    try {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const speed = position.coords.speed || 0;
        const heading = position.coords.heading || 0;
        const speedKmh = speed * 3.6;

        setText("latitude", latitude.toFixed(6));
        setText("longitude", longitude.toFixed(6));
        setText("gpsSpeed", speedKmh.toFixed(1) + " km/h");
        setText("speed", speedKmh.toFixed(1) + " km/h");
        setText("lastUpdated", new Date().toLocaleTimeString());
        setText("locationMessage", "GPS location is being shared.");

        if (!map) return;

        if (!busMarker) {
            busMarker = L.marker([latitude, longitude])
                .addTo(map)
                .bindPopup("Your Bus");
        } else {
            busMarker.setLatLng([latitude, longitude]);
        }

        map.setView([latitude, longitude], 16);

        await saveLiveLocation(latitude, longitude, speed, heading);
        await checkNearbyStops(latitude, longitude);

    } catch (error) {
        console.error("GPS update error:", error);
    } finally {
        isSavingLocation = false;
    }
}

/* =====================================================
   SAVE LIVE LOCATION
===================================================== */

async function saveLiveLocation(latitude, longitude, speed, heading) {
    if (!currentTrip) return;

    const { error } = await supabaseClient
        .from("live_locations")
        .insert({
            trip_id: currentTrip.id,
            latitude,
            longitude,
            speed,
            heading,
            recorded_at: new Date().toISOString()
        });

    if (error) {
        console.error("GPS save error:", error);
        setText("locationMessage", "GPS active, but saving location failed.");
    }
}

/* =====================================================
   CHECK NEARBY STOPS - GEOFENCE
===================================================== */

async function checkNearbyStops(latitude, longitude) {
    for (let index = 0; index < routeStops.length; index++) {
        const item = routeStops[index];
        const stop = item.stops;

        if (!stop || notifiedStops.has(stop.id)) continue;

        const stopLat = Number(stop.latitude);
        const stopLon = Number(stop.longitude);

        if (!Number.isFinite(stopLat) || !Number.isFinite(stopLon)) continue;

        const distance = calculateDistance(
            latitude, longitude, stopLat, stopLon
        );

        const radius = Number(stop.notification_radius) || 100;

        setText(
            `distance-${stop.id}`,
            `${Math.round(distance)} metres away`
        );

        console.log(`${stop.stop_name}: ${Math.round(distance)}m`);

        if (distance <= radius) {
            notifiedStops.add(stop.id);
            currentStopIndex = index;

            highlightStop(stop.id);

            await updateCurrentStop(stop.id);
            await createStopNotifications(stop);

            setText("locationMessage", `Bus reached ${stop.stop_name}`);
            console.log("BUS REACHED:", stop.stop_name);
        }
    }
}

/* =====================================================
   CREATE STUDENT NOTIFICATIONS
   Sends to all students in the students table.
   Duplicate notifications are checked per trip and stop.
===================================================== */

async function createStopNotifications(stop) {
    if (!currentTrip || !stop) return;

    try {
       const { data: students, error: studentsError } =
  await supabaseClient
    .from("students")
    .select("id, profile_id");

console.log("Students query result:", students);
console.log("Students query error:", studentsError);

if (studentsError) throw studentsError;

if (!students || students.length === 0) {
  console.log("No students returned. Check SELECT RLS policy.");
  return;
}
        

        const { data: existing, error: existingError } =
            await supabaseClient
                .from("notifications")
                .select("student_id")
                .eq("trip_id", currentTrip.id)
                .eq("stop_id", stop.id);

        if (existingError) throw existingError;

        const alreadyNotified = new Set(
            (existing || []).map(row => row.student_id)
        );

        const notifications = students
            .filter(student => !alreadyNotified.has(student.id))
            .map(student => ({
                student_id: student.id,
                trip_id: currentTrip.id,
                stop_id: stop.id,
                title: `Bus has reached ${stop.stop_name}`,
                message: `${currentTrip.buses?.bus_number || "Your bus"} has reached ${stop.stop_name} stop.`,
                type: "stop_reached",
                is_read: false
            }));

        if (!notifications.length) {
            console.log("Already notified for this stop.");
            return;
        }

        const { error: insertError } = await supabaseClient
            .from("notifications")
            .insert(notifications);

        if (insertError) throw insertError;

        console.log(
            `${notifications.length} notifications created for ${stop.stop_name}`
        );

    } catch (error) {
        console.error("Stop notification error:", error);
    }
}

/* =====================================================
   UPDATE CURRENT STOP
===================================================== */

async function updateCurrentStop(stopId) {
    if (!currentTrip) return;

    const { error } = await supabaseClient
        .from("trips")
        .update({ current_stop_id: stopId })
        .eq("id", currentTrip.id);

    if (error) console.error("Current stop update error:", error);
}

/* =====================================================
   DISTANCE CALCULATION - METRES
===================================================== */

function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371000;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
}

function toRadians(value) {
    return value * Math.PI / 180;
}

/* =====================================================
   HIGHLIGHT REACHED STOP
===================================================== */

function highlightStop(stopId) {
    document.querySelectorAll(".stop-item").forEach(element => {
        element.classList.remove("current-stop");
    });

    const element = document.getElementById(`stop-${stopId}`);

    if (element) {
        element.classList.add("current-stop");
        element.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}

/* =====================================================
   GPS ERROR
===================================================== */

function handleGPSError(error) {
    console.error("GPS error:", error);

    const messages = {
        1: "GPS permission denied. Allow location access.",
        2: "GPS location unavailable.",
        3: "GPS request timed out."
    };

    setText(
        "locationMessage",
        messages[error.code] || "Unable to get GPS location."
    );
}

/* =====================================================
   END TRIP
===================================================== */

async function endTrip() {
    if (!currentTrip) return;

    if (!confirm("Are you sure you want to end this trip?")) return;

    const { error } = await supabaseClient
        .from("trips")
        .update({
            status: "completed",
            ended_at: new Date().toISOString()
        })
        .eq("id", currentTrip.id);

    if (error) {
        console.error("End trip error:", error);
        alert("Unable to end trip: " + error.message);
        return;
    }

    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    alert("Trip completed successfully!");
    window.location.href = "dashboard.html";
}

/* =====================================================
   NAVIGATION / LOGOUT
===================================================== */

function goDashboard() {
    window.location.href = "dashboard.html";
}

async function logoutDriver() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Logout failed: " + error.message);
        return;
    }

    window.location.href = "login.html";
}

/* =====================================================
   HELPERS
===================================================== */

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* Make functions available to HTML onclick handlers */
window.endTrip = endTrip;
window.goDashboard = goDashboard;
window.logoutDriver = logoutDriver;
