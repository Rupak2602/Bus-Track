
/* =========================================================
   BUS TRACK - STUDENT LIVE TRACKING
   Smooth bus movement + blue road route + live GPS
========================================================= */

let currentUser = null;
let map = null;
let activeTrips = [];
let selectedTrip = null;

const busMarkers = {};
const stopMarkers = {};
const routeLines = {};
const lastPositions = {};

let realtimeChannel = null;
let routeRequestId = 0;

const DEFAULT_CENTER = [13.0827, 80.2707];

/* ================= PAGE LOAD ================= */

document.addEventListener("DOMContentLoaded", async () => {
    try {
        initializeMap();

        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            window.location.href = "login.html";
            return;
        }

        currentUser = data.session.user;

        await loadActiveTrips();
        subscribeToLiveLocations();

    } catch (error) {
        console.error("Tracking initialization error:", error);
        showBusError("Unable to load buses. Check the browser console.");
    }
});

/* ================= MAP ================= */

function initializeMap() {
    const mapElement = document.getElementById("map");

    if (!mapElement || typeof L === "undefined") {
        throw new Error("Map element or Leaflet library is missing.");
    }

    if (map) return;

    map = L.map("map", {
        zoomControl: true
    }).setView(DEFAULT_CENTER, 12);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 400);
}

/* ================= LOAD ACTIVE TRIPS ================= */

async function loadActiveTrips() {
    const { data, error } = await supabaseClient
        .from("trips")
        .select(`
            id,
            bus_id,
            route_id,
            driver_id,
            status,
            started_at,
            current_stop_id,
            buses (
                id,
                bus_number,
                bus_name,
                registration_number
            ),
            routes (
                id,
                route_name,
                start_point,
                end_point
            )
        `)
        .eq("status", "active")
        .order("started_at", { ascending: false });

    if (error) throw error;

    activeTrips = data || [];
    renderBusList();

    if (!activeTrips.length) {
        setText("selectedBus", "No active buses");
        setText("selectedRoute", "No bus is currently on a trip");
        setText("connectionStatus", "● NO ACTIVE TRIP");
        return;
    }

    for (const trip of activeTrips) {
        await loadRouteStops(trip);
        await loadLatestLocation(trip);
    }

    if (!selectedTrip || !activeTrips.some(t => t.id === selectedTrip.id)) {
        await selectTrip(activeTrips[0].id, true);
    }
}

/* ================= BUS LIST ================= */

function renderBusList() {
    const container = document.getElementById("busList");
    if (!container) return;

    if (!activeTrips.length) {
        container.innerHTML = `
            <div class="empty">
                <div style="font-size:35px">🚌</div>
                <p style="margin-top:10px">
                    No buses are currently on a trip.
                </p>
            </div>`;
        return;
    }

    container.innerHTML = activeTrips.map(trip => {
        const bus = trip.buses || {};
        const route = trip.routes || {};

        return `
            <div class="bus-card ${selectedTrip?.id === trip.id ? "active" : ""}"
                 id="bus-card-${trip.id}"
                 onclick="selectTrip('${trip.id}')">

                <div class="bus-top">
                    <div class="bus-number">
                        🚌 ${escapeHTML(bus.bus_number || "Bus")}
                    </div>
                    <div class="live-badge">● LIVE</div>
                </div>

                <div class="route-name">
                    ${escapeHTML(route.route_name || "Route unavailable")}
                </div>

                <div class="bus-status">
                    <span>
                        ${escapeHTML(route.start_point || "--")}
                        → ${escapeHTML(route.end_point || "--")}
                    </span>
                    <span>Active</span>
                </div>
            </div>`;
    }).join("");
}

/* ================= SELECT BUS ================= */

async function selectTrip(tripId, fitRoute = false) {
    const trip = activeTrips.find(item => item.id === tripId);
    if (!trip) return;

    selectedTrip = trip;
    renderBusList();

    setText("selectedBus", trip.buses?.bus_number || "Bus");
    setText("selectedRoute", trip.routes?.route_name || "Route");
    setText("connectionStatus", "● CONNECTING...");

    await loadRouteStops(trip);
    await loadLatestLocation(trip);

    const marker = busMarkers[trip.id];

    if (marker && map) {
        map.setView(marker.getLatLng(), 16);
    } else if (fitRoute && routeLines[trip.id]) {
        map.fitBounds(routeLines[trip.id].getBounds(), {
            padding: [40, 40]
        });
    }
}

window.selectTrip = selectTrip;

/* ================= LATEST GPS ================= */

async function loadLatestLocation(trip) {
    const { data, error } = await supabaseClient
        .from("live_locations")
        .select("latitude, longitude, speed, heading, recorded_at, trip_id")
        .eq("trip_id", trip.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Latest GPS error:", error);
        return;
    }

    if (data) {
        updateBusMarker(trip, data, false);
    }
}

/* ================= CUSTOM BUS ICON ================= */

function createBusIcon(heading = 0) {
    return L.divIcon({
        className: "bus-track-marker",
        html: `
            <div style="
                width:46px;
                height:46px;
                display:flex;
                align-items:center;
                justify-content:center;
                position:relative;
                filter:drop-shadow(0 3px 5px rgba(0,0,0,.28));
            ">
                <div style="
                    position:absolute;
                    width:44px;
                    height:44px;
                    border-radius:50%;
                    background:rgba(37,99,235,.13);
                    border:2px solid rgba(37,99,235,.28);
                "></div>
                <div style="
                    width:34px;
                    height:34px;
                    border-radius:50%;
                    background:#ffffff;
                    border:2px solid #2563eb;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    transform:rotate(${Number(heading) || 0}deg);
                    font-size:21px;
                    z-index:1;
                ">🚌</div>
            </div>`,
        iconSize: [46, 46],
        iconAnchor: [23, 23]
    });
}

/* ================= BUS MARKER + MOVEMENT ================= */

function updateBusMarker(trip, location, animate = true) {
    if (!map || !location) return;

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    const newPosition = L.latLng(lat, lng);
    const heading = Number(location.heading || 0);
    let marker = busMarkers[trip.id];

    if (!marker) {
        marker = L.marker(newPosition, {
            icon: createBusIcon(heading),
            zIndexOffset: 1000,
            title: trip.buses?.bus_number || "Live bus"
        }).addTo(map);

        marker.bindPopup(`
            <strong>🚌 ${escapeHTML(trip.buses?.bus_number || "Bus")}</strong>
            <br>${escapeHTML(trip.routes?.route_name || "Live bus")}
        `);

        busMarkers[trip.id] = marker;
    } else {
        marker.setIcon(createBusIcon(heading));

        const oldPosition = marker.getLatLng();

        if (animate) {
            animateMarker(marker, oldPosition, newPosition, 900);
        } else {
            marker.setLatLng(newPosition);
        }
    }

    lastPositions[trip.id] = newPosition;

    if (selectedTrip?.id === trip.id) {
        updateLocationUI(location);

        // Map follows the selected bus without changing zoom every time.
        if (animate) {
            map.panTo(newPosition, { animate: true, duration: 0.6 });
        } else if (map.getZoom() < 14) {
            map.setView(newPosition, 16);
        }
    }

    // Extend the blue travelled path with each real GPS update.
    updateTravelledLine(trip.id, newPosition);
}

/* ================= SMOOTH ANIMATION ================= */

function animateMarker(marker, from, to, duration) {
    const start = performance.now();

    const startLat = from.lat;
    const startLng = from.lng;
    const endLat = to.lat;
    const endLng = to.lng;

    function frame(now) {
        if (!marker || !map) return;

        const progress = Math.min((now - start) / duration, 1);
        // Smooth ease-in/ease-out.
        const eased = progress * progress * (3 - 2 * progress);

        const lat = startLat + (endLat - startLat) * eased;
        const lng = startLng + (endLng - startLng) * eased;

        marker.setLatLng([lat, lng]);

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}

/* ================= ROUTE STOPS + BLUE ROAD LINE ================= */

async function loadRouteStops(trip) {
    if (!trip?.route_id || !map) return;

    clearStopMarkers(trip.id);

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
        .eq("route_id", trip.route_id)
        .order("stop_order", { ascending: true });

    if (error) {
        console.error("Route stops error:", error);
        return;
    }

    const stops = (data || [])
        .filter(item => item.stops)
        .map(item => ({
            id: item.stops.id,
            name: item.stops.stop_name,
            lat: Number(item.stops.latitude),
            lng: Number(item.stops.longitude),
            order: Number(item.stop_order)
        }))
        .filter(stop =>
            Number.isFinite(stop.lat) &&
            Number.isFinite(stop.lng)
        );

    stops.forEach(stop => {
        const marker = L.marker([stop.lat, stop.lng], {
            title: stop.name
        }).addTo(map);

        marker.bindPopup(`
            <strong>📍 ${escapeHTML(stop.name)}</strong>
            <br>Stop ${stop.order}
        `);

        stopMarkers[trip.id] ||= [];
        stopMarkers[trip.id].push(marker);
    });

    // Ask the free OSRM routing demo for a road-following route.
    // If routing fails, use a simple stop-to-stop line as fallback.
    await drawRoadRoute(trip, stops);
}

async function drawRoadRoute(trip, stops) {
    const requestId = ++routeRequestId;

    if (routeLines[trip.id]) {
        map.removeLayer(routeLines[trip.id]);
        delete routeLines[trip.id];
    }

    if (!stops || stops.length < 2) return;

    const coordinates = stops
        .map(stop => `${stop.lng},${stop.lat}`)
        .join(";");

    const url =
        `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
        `?overview=full&geometries=geojson&steps=false`;

    try {
        const response = await fetch(url);

        if (!response.ok) throw new Error("Routing request failed");

        const result = await response.json();

        if (requestId !== routeRequestId) return;
        if (result.code !== "Ok" || !result.routes?.length) {
            throw new Error("No road route returned");
        }

        const roadCoordinates = result.routes[0].geometry.coordinates
            .map(point => [point[1], point[0]]);

        routeLines[trip.id] = L.polyline(roadCoordinates, {
            color: "#2563eb",
            weight: 6,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round"
        }).addTo(map);

        routeLines[trip.id].bringToBack();

        if (selectedTrip?.id === trip.id) {
            map.fitBounds(routeLines[trip.id].getBounds(), {
                padding: [35, 35],
                maxZoom: 16
            });

            const marker = busMarkers[trip.id];
            if (marker) map.panTo(marker.getLatLng());
        }

    } catch (error) {
        console.warn("Road routing unavailable; drawing fallback line.", error);

        if (requestId !== routeRequestId) return;

        routeLines[trip.id] = L.polyline(
            stops.map(stop => [stop.lat, stop.lng]),
            {
                color: "#2563eb",
                weight: 5,
                opacity: 0.8,
                dashArray: "8, 8"
            }
        ).addTo(map);

        routeLines[trip.id].bringToBack();
    }
}

/* ================= TRAVELLED BLUE LINE ================= */

function updateTravelledLine(tripId, position) {
    // Keep the planned road route visible.
    // This line separately shows the actual GPS path travelled so far.
    if (!map) return;

    const key = `travelled-${tripId}`;

    if (!window[key]) {
        window[key] = L.polyline([position], {
            color: "#0ea5e9",
            weight: 4,
            opacity: 0.9
        }).addTo(map);
    } else {
        const points = window[key].getLatLngs();
        const last = points[points.length - 1];

        // Ignore tiny GPS repeats.
        if (!last || map.distance(last, position) > 5) {
            window[key].addLatLng(position);

            // Keep memory use reasonable on long trips.
            if (window[key].getLatLngs().length > 3000) {
                window[key].setLatLngs(window[key].getLatLngs().slice(-2000));
            }
        }
    }
}

function clearStopMarkers(tripId) {
    (stopMarkers[tripId] || []).forEach(marker => {
        if (map) map.removeLayer(marker);
    });

    stopMarkers[tripId] = [];
}

/* ================= REALTIME GPS ================= */

function subscribeToLiveLocations() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel("student-live-locations")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "live_locations"
            },
            payload => {
                handleRealtimeLocation(payload.new);
            }
        )
        .subscribe(status => {
            console.log("GPS Realtime status:", status);

            if (status === "SUBSCRIBED") {
                setText("connectionStatus", "● LIVE");
                setColor("connectionStatus", "#14804a");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                setText("connectionStatus", "● RECONNECTING");
                setColor("connectionStatus", "#b45309");
            }
        });
}

function handleRealtimeLocation(location) {
    if (!location) return;

    const trip = activeTrips.find(item => item.id === location.trip_id);
    if (!trip) return;

    updateBusMarker(trip, location, true);

    if (selectedTrip?.id === trip.id) {
        setText("connectionStatus", "● LIVE");
        setColor("connectionStatus", "#14804a");
    }
}

/* ================= LOCATION INFORMATION ================= */

function updateLocationUI(location) {
    setText("liveLatitude", Number(location.latitude).toFixed(6));
    setText("liveLongitude", Number(location.longitude).toFixed(6));

    const speed = Number(location.speed || 0) * 3.6;
    setText("liveSpeed", `${speed.toFixed(1)} km/h`);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setColor(id, color) {
    const element = document.getElementById(id);
    if (element) element.style.color = color;
}

/* ================= ERROR MESSAGE ================= */

function showBusError(message) {
    const container = document.getElementById("busList");
    if (!container) return;

    container.innerHTML = `
        <div class="empty">
            <div style="font-size:35px">⚠️</div>
            <p style="margin-top:10px">${escapeHTML(message)}</p>
        </div>`;
}

/* ================= NAVIGATION ================= */

function goDashboard() {
    window.location.href = "dashboard.html";
}

window.goDashboard = goDashboard;

/* ================= SAFE HTML ================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ================= CLEANUP ================= */

window.addEventListener("beforeunload", () => {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }
});
