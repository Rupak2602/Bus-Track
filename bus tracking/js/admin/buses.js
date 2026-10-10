// ======================================================
// BUS MANAGEMENT - ADMIN
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    initBusManagement();
});


// ======================================================
// GLOBAL VARIABLES
// ======================================================

let buses = [];
let editingBusId = null;


// ======================================================
// INITIALIZE
// ======================================================

async function initBusManagement() {

    console.log("Bus Management initialized");

    await loadBuses();

    setupForm();
    setupSearch();
    setupAddButton();
    setupCloseButton();
}


// ======================================================
// LOAD BUSES FROM SUPABASE
// ======================================================

async function loadBuses() {

    try {

        const { data, error } = await supabaseClient
            .from("buses")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Load buses error:", error);
            showMessage(error.message, "error");
            return;
        }

        buses = data || [];

        renderBuses();
        updateStatistics();

    } catch (error) {

        console.error(error);
        showMessage("Unable to load buses.", "error");

    }
}


// ======================================================
// RENDER BUS LIST
// ======================================================

function renderBuses(list = buses) {

    const tableBody =
        document.getElementById("busTableBody") ||
        document.getElementById("busesTableBody") ||
        document.getElementById("busList");

    if (!tableBody) {
        console.warn("Bus table container not found.");
        return;
    }

    if (list.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No buses found.
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML = list.map(bus => {

        const statusClass =
            bus.status === "active"
                ? "status-active"
                : bus.status === "maintenance"
                    ? "status-maintenance"
                    : "status-inactive";


        return `
            <tr>

                <td>
                    <strong>${escapeHTML(bus.bus_number || "-")}</strong>
                </td>

                <td>
                    ${escapeHTML(bus.bus_name || "-")}
                </td>

                <td>
                    ${escapeHTML(bus.registration_number || "-")}
                </td>

                <td>
                    ${bus.capacity ?? "-"}
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${capitalize(bus.status || "inactive")}
                    </span>
                </td>

                <td>

                    <div class="table-actions">

                        <button
                            class="action-btn edit-btn"
                            onclick="editBus('${bus.id}')"
                        >
                            Edit
                        </button>

                        <button
                            class="action-btn delete-btn"
                            onclick="deleteBus('${bus.id}')"
                        >
                            Delete
                        </button>

                    </div>

                </td>

            </tr>
        `;

    }).join("");
}


// ======================================================
// STATISTICS
// ======================================================

function updateStatistics() {

    const total = buses.length;

    const active =
        buses.filter(bus => bus.status === "active").length;

    const maintenance =
        buses.filter(bus => bus.status === "maintenance").length;

    const inactive =
        buses.filter(bus => bus.status === "inactive").length;


    setText("totalBuses", total);
    setText("activeBuses", active);
    setText("maintenanceBuses", maintenance);
    setText("inactiveBuses", inactive);
}


// ======================================================
// ADD BUS FORM
// ======================================================

function setupForm() {

    const form =
        document.getElementById("busForm") ||
        document.getElementById("addBusForm");

    if (!form) {
        console.warn("Bus form not found.");
        return;
    }


    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        await saveBus(form);

    });
}


// ======================================================
// SAVE BUS
// ======================================================

async function saveBus(form) {

    const busNumber =
        getValue("busNumber") ||
        getValue("bus_number");

    const busName =
        getValue("busName") ||
        getValue("bus_name");

    const registrationNumber =
        getValue("registrationNumber") ||
        getValue("registration_number");

    const capacity =
        getValue("capacity");

    const status =
        getValue("status") || "active";


    // ------------------------------
    // VALIDATION
    // ------------------------------

    if (!busNumber) {
        showMessage("Please enter bus number.", "error");
        return;
    }

    if (!registrationNumber) {
        showMessage("Please enter registration number.", "error");
        return;
    }

    if (!capacity) {
        showMessage("Please enter bus capacity.", "error");
        return;
    }


    const busData = {

        bus_number: busNumber.trim(),

        bus_name:
            busName
                ? busName.trim()
                : null,

        registration_number:
            registrationNumber.trim(),

        capacity:
            Number(capacity),

        status: status

    };


    try {

        let result;


        // ==================================================
        // UPDATE EXISTING BUS
        // ==================================================

        if (editingBusId) {

            result = await supabaseClient
                .from("buses")
                .update({
                    ...busData,
                    updated_at: new Date().toISOString()
                })
                .eq("id", editingBusId);

        }

        // ==================================================
        // CREATE NEW BUS
        // ==================================================

        else {

            result = await supabaseClient
                .from("buses")
                .insert([busData]);

        }


        if (result.error) {

            console.error(result.error);

            showMessage(
                result.error.message,
                "error"
            );

            return;
        }


        // SUCCESS

        showMessage(
            editingBusId
                ? "Bus updated successfully!"
                : "Bus added successfully!",
            "success"
        );


        editingBusId = null;

        resetBusForm();

        await loadBuses();

    }

    catch (error) {

        console.error(error);

        showMessage(
            "Something went wrong while saving the bus.",
            "error"
        );

    }

}


// ======================================================
// EDIT BUS
// ======================================================

function editBus(id) {

    const bus = buses.find(item => item.id === id);

    if (!bus) {
        return;
    }


    editingBusId = id;


    setValue(
        "busNumber",
        bus.bus_number || ""
    );

    setValue(
        "bus_number",
        bus.bus_number || ""
    );


    setValue(
        "busName",
        bus.bus_name || ""
    );

    setValue(
        "bus_name",
        bus.bus_name || ""
    );


    setValue(
        "registrationNumber",
        bus.registration_number || ""
    );

    setValue(
        "registration_number",
        bus.registration_number || ""
    );


    setValue(
        "capacity",
        bus.capacity || ""
    );


    setValue(
        "status",
        bus.status || "active"
    );


    // Change form title

    const title =
        document.getElementById("busFormTitle");

    if (title) {
        title.textContent = "Edit Bus";
    }


    // Scroll to form

    const form =
        document.getElementById("busForm") ||
        document.getElementById("addBusForm");

    if (form) {

        form.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    }

}


// ======================================================
// DELETE BUS
// ======================================================

async function deleteBus(id) {

    const bus = buses.find(item => item.id === id);

    if (!bus) {
        return;
    }


    const confirmed = confirm(
        `Delete bus "${bus.bus_number}"?`
    );


    if (!confirmed) {
        return;
    }


    try {

        const { error } = await supabaseClient
            .from("buses")
            .delete()
            .eq("id", id);


        if (error) {

            console.error(error);

            showMessage(
                error.message,
                "error"
            );

            return;
        }


        showMessage(
            "Bus deleted successfully!",
            "success"
        );


        await loadBuses();

    }

    catch (error) {

        console.error(error);

        showMessage(
            "Unable to delete bus.",
            "error"
        );

    }

}


// ======================================================
// SEARCH
// ======================================================

function setupSearch() {

    const searchInput =
        document.getElementById("busSearch") ||
        document.getElementById("searchBuses");


    if (!searchInput) {
        return;
    }


    searchInput.addEventListener("input", () => {

        const keyword =
            searchInput.value
                .toLowerCase()
                .trim();


        if (!keyword) {

            renderBuses(buses);

            return;
        }


        const filtered =
            buses.filter(bus => {

                return (

                    (bus.bus_number || "")
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (bus.bus_name || "")
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (bus.registration_number || "")
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (bus.status || "")
                        .toLowerCase()
                        .includes(keyword)

                );

            });


        renderBuses(filtered);

    });

}


// ======================================================
// ADD BUTTON
// ======================================================

function setupAddButton() {

    const buttons =
        document.querySelectorAll(
            "#addBusBtn, .add-bus-btn"
        );


    buttons.forEach(button => {

        button.addEventListener("click", () => {

            editingBusId = null;

            resetBusForm();

            showBusForm();

        });

    });

}


// ======================================================
// CLOSE BUTTON
// ======================================================

function setupCloseButton() {

    const closeButton =
        document.getElementById("closeBusForm");


    if (!closeButton) {
        return;
    }


    closeButton.addEventListener("click", () => {

        resetBusForm();

        hideBusForm();

    });

}


// ======================================================
// SHOW FORM
// ======================================================

function showBusForm() {

    const form =
        document.getElementById("busFormSection") ||
        document.getElementById("busFormContainer");


    if (form) {

        form.style.display = "block";

        form.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    }

}


// ======================================================
// HIDE FORM
// ======================================================

function hideBusForm() {

    const form =
        document.getElementById("busFormSection") ||
        document.getElementById("busFormContainer");


    if (form) {

        form.style.display = "none";

    }

}


// ======================================================
// RESET FORM
// ======================================================

function resetBusForm() {

    const form =
        document.getElementById("busForm") ||
        document.getElementById("addBusForm");


    if (form) {
        form.reset();
    }


    editingBusId = null;


    setValue("status", "active");


    const title =
        document.getElementById("busFormTitle");

    if (title) {
        title.textContent = "Add New Bus";
    }

}


// ======================================================
// MESSAGE
// ======================================================

function showMessage(message, type = "success") {

    let box =
        document.getElementById("busMessage");


    if (!box) {

        box = document.createElement("div");

        box.id = "busMessage";

        box.style.position = "fixed";
        box.style.top = "90px";
        box.style.right = "25px";
        box.style.zIndex = "9999";
        box.style.padding = "14px 20px";
        box.style.borderRadius = "12px";
        box.style.fontWeight = "600";
        box.style.boxShadow =
            "0 10px 30px rgba(0,0,0,0.12)";

        document.body.appendChild(box);

    }


    box.textContent = message;


    if (type === "error") {

        box.style.background = "#fee2e2";
        box.style.color = "#991b1b";

    } else {

        box.style.background = "#dcfce7";
        box.style.color = "#166534";

    }


    box.style.display = "block";


    setTimeout(() => {

        box.style.display = "none";

    }, 3000);

}


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function getValue(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value
        : "";

}


function setValue(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value = value;
    }

}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}


function capitalize(value) {

    if (!value) {
        return "";
    }

    return value.charAt(0).toUpperCase() +
        value.slice(1);

}


function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}