
const tripList = document.getElementById("tripList");
const errorMessage = document.getElementById("errorMessage");

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function duration(start, end) {
  if (!start || !end) return "In progress";

  const milliseconds = new Date(end) - new Date(start);

  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "Not available";
  }

  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) return `${hours} hr ${remainingMinutes} min`;

  return `${minutes} min`;
}

async function loadTripHistory() {
  errorMessage.style.display = "none";

  tripList.innerHTML =
    '<div class="card loading">Trip history load aagudhu...</div>';

  document.getElementById("totalTrips").textContent = "—";
  document.getElementById("completedTrips").textContent = "—";
  document.getElementById("activeTrips").textContent = "—";

  try {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData.session?.user;

    if (!user) {
      showError("Login session illa. Driver login page-la login pannunga.");
      tripList.innerHTML = "";
      return;
    }

    const { data: driver, error: driverError } = await supabaseClient
      .from("drivers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (driverError) throw driverError;

    if (!driver) {
      showError("Indha account-ku driver record kidaikkala.");
      tripList.innerHTML = "";
      return;
    }

    const { data: trips, error: tripsError } = await supabaseClient
      .from("trips")
      .select(`
        id,
        status,
        started_at,
        ended_at,
        buses ( bus_number, bus_name ),
        routes ( route_name )
      `)
      .eq("driver_id", driver.id)
      .order("started_at", { ascending: false })
      .limit(100);

    if (tripsError) throw tripsError;

    const records = trips || [];

    document.getElementById("totalTrips").textContent = records.length;

    document.getElementById("completedTrips").textContent =
      records.filter(trip =>
        String(trip.status || "").toLowerCase() === "completed"
      ).length;

    document.getElementById("activeTrips").textContent =
      records.filter(trip =>
        String(trip.status || "").toLowerCase() === "active"
      ).length;

    if (records.length === 0) {
      tripList.innerHTML = `
        <div class="card empty">
          <div class="empty-icon">🚌</div>
          <h3>Trips innum illa</h3>
          <p>Driver portal-la oru trip start pannina, adhu inga display aagum.</p>
        </div>
      `;
      return;
    }

    tripList.innerHTML = records.map(trip => {
      const status = String(trip.status || "unknown").toLowerCase();
      const bus = trip.buses || {};
      const route = trip.routes || {};

      const busName = bus.bus_number || bus.bus_name || "Bus details unavailable";
      const routeName = route.route_name || "Route details unavailable";
      const statusClass = status === "active" ? "active" : "";

      return `
        <article class="trip-card">
          <div>
            <div class="trip-title">${escapeHTML(busName)}</div>

            <div class="trip-info">
              🛣️ Route: ${escapeHTML(routeName)}<br>
              🟢 Started: ${escapeHTML(formatDate(trip.started_at))}<br>
              🏁 Ended: ${escapeHTML(formatDate(trip.ended_at))}<br>
              ⏱️ Duration: ${escapeHTML(duration(trip.started_at, trip.ended_at))}
            </div>
          </div>

          <div>
            <span class="status ${statusClass}">
              ${escapeHTML(status)}
            </span>
          </div>
        </article>
      `;
    }).join("");

  } catch (error) {
    console.error("Trip history error:", error);

    tripList.innerHTML = `
      <div class="card empty">
        <div class="empty-icon">⚠️</div>
        <h3>Trip history load aagala</h3>
        <p>Supabase query / table permissions check pannunga.</p>
      </div>
    `;

    showError(error.message || "Unknown error occurred.");
  }
}

document.getElementById("refreshBtn").addEventListener(
  "click",
  loadTripHistory
);

loadTripHistory();
