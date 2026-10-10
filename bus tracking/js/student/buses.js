
const busGrid = document.getElementById("busGrid");
const busSearch = document.getElementById("busSearch");
const pageMessage = document.getElementById("pageMessage");
const busCount = document.getElementById("busCount");
const activeCount = document.getElementById("activeCount");

let allBuses = [];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showMessage(message, isError = false) {
  pageMessage.textContent = message;
  pageMessage.className = isError ? "message error" : "message";
}

function renderBuses(buses) {
  busGrid.innerHTML = "";

  if (!buses.length) {
    busGrid.innerHTML = `
      <div class="empty-state">
        <strong>🚌 No buses found</strong>
        Try another search or check whether buses have been added by admin.
      </div>`;
    return;
  }

  buses.forEach(bus => {
    const number = escapeHTML(bus.bus_number || "Bus number unavailable");
    const name = escapeHTML(bus.bus_name || "College Bus");
    const status = String(bus.status || "Unknown");
    const isActive = status.toLowerCase() === "active";
    const capacity = bus.capacity ?? "Not specified";

    const card = document.createElement("article");
    card.className = "bus-card";

    card.innerHTML = `
      <div class="bus-card-top">
        <div class="bus-icon">🚌</div>
        <span class="status ${isActive ? "active" : ""}">
          ${escapeHTML(status)}
        </span>
      </div>

      <h3 class="bus-number">Bus ${number}</h3>
      <p class="bus-name">${name}</p>

      <div class="bus-details">
        <div>
          <span class="detail-label">Bus Number</span>
          <span class="detail-value">${number}</span>
        </div>
        <div>
          <span class="detail-label">Total Capacity</span>
          <span class="detail-value">${escapeHTML(capacity)} seats</span>
        </div>
      </div>

      <a class="track-btn" href="live-tracking.html">
        View Live Tracking →
      </a>
    `;

    busGrid.appendChild(card);
  });
}

async function loadBuses() {
  showMessage("Loading buses...");

  try {
    const { data: { user }, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      showMessage("Please log in to view buses.", true);
      busGrid.innerHTML = "";
      return;
    }

    const { data, error } = await supabaseClient
      .from("buses")
      .select("bus_number, bus_name, capacity, status")
      .order("bus_number");

    if (error) throw error;

    allBuses = data || [];

    busCount.textContent = allBuses.length;

    activeCount.textContent = allBuses.filter(bus =>
      String(bus.status || "").toLowerCase() === "active"
    ).length;

    renderBuses(allBuses);
    showMessage(
      allBuses.length
        ? "Showing buses available in the system."
        : "No buses have been added yet."
    );
  } catch (error) {
    console.error("My Buses error:", error);
    showMessage(
      "Buses load aagala. Supabase connection and buses SELECT policy check pannunga.",
      true
    );
  }
}

busSearch.addEventListener("input", () => {
  const query = busSearch.value.trim().toLowerCase();

  const filtered = allBuses.filter(bus =>
    String(bus.bus_number || "").toLowerCase().includes(query) ||
    String(bus.bus_name || "").toLowerCase().includes(query)
  );

  renderBuses(filtered);
});

loadBuses();
