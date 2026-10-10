// ==========================================
// ADMIN STOPS MANAGEMENT
// ==========================================

let allStops = [];
let allRoutes = [];
let editingStopId = null;


// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Stop Management initialized");

    await checkAdminAccess();

    await loadRoutes();

    await loadStops();

});


// ==========================================
// CHECK ADMIN ACCESS
// ==========================================

async function checkAdminAccess() {

    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();


    if (error) {

        console.error(
            "Session error:",
            error
        );

        return;
    }


    if (!session) {

        window.location.href =
            "login.html";

        return;
    }


    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq(
            "id",
            session.user.id
        )
        .single();


    if (profileError) {

        console.error(
            "Profile error:",
            profileError
        );

        return;
    }


    if (
        !profile ||
        profile.role !== "admin"
    ) {

        alert(
            "Admin access required."
        );

        window.location.href =
            "../index.html";

        return;
    }

}


// ==========================================
// LOAD ROUTES
// ==========================================

async function loadRoutes() {

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

        console.error(
            "Load routes error:",
            error
        );

        return;
    }


    allRoutes =
        data || [];


    populateRouteDropdown();

}


// ==========================================
// POPULATE ROUTE DROPDOWN
// ==========================================

function populateRouteDropdown() {

    const routeSelect =
        document.getElementById(
            "routeId"
        );


    if (!routeSelect) {

        console.warn(
            "Route dropdown #routeId not found."
        );

        return;
    }


    routeSelect.innerHTML = `
        <option value="">
            Select Route
        </option>
    `;


    allRoutes
        .filter(
            route =>
                route.status !== "inactive"
        )
        .forEach(
            route => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    route.id;


                option.textContent =
                    route.route_name;


                routeSelect.appendChild(
                    option
                );

            }
        );

}


// ==========================================
// LOAD STOPS
// ==========================================

async function loadStops() {

    const tableBody =
        document.getElementById(
            "stopTableBody"
        );


    if (!tableBody) {

        return;
    }


    tableBody.innerHTML = `
        <tr>
            <td
                colspan="5"
                class="empty-table"
            >
                Loading stops...
            </td>
        </tr>
    `;


    const {
        data,
        error
    } = await supabaseClient
        .from("stops")
        .select("*")
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Load stops error:",
            error
        );


        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-table"
                >
                    Unable to load stops.
                </td>
            </tr>
        `;


        return;
    }


    allStops =
        data || [];


    await loadStopRouteAssignments();


    updateStopStats();

    renderStops(
        allStops
    );

}


// ==========================================
// LOAD ROUTE ASSIGNMENTS
// ==========================================

async function loadStopRouteAssignments() {

    if (!allStops.length) {

        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("route_stops")
        .select(`
            id,
            route_id,
            stop_id,
            stop_order,
            routes (
                id,
                route_name
            )
        `);


    if (error) {

        console.warn(
            "Route assignment loading error:",
            error
        );

        return;
    }


    const assignments =
        data || [];


    allStops =
        allStops.map(
            stop => {

                const assigned =
                    assignments
                        .filter(
                            item =>
                                item.stop_id ===
                                stop.id
                        )
                        .sort(
                            (a, b) =>
                                a.stop_order -
                                b.stop_order
                        );


                return {
                    ...stop,

                    routeAssignments:
                        assigned
                };

            }
        );

}


// ==========================================
// UPDATE STATISTICS
// ==========================================

function updateStopStats() {

    const total =
        allStops.length;


    const gpsStops =
        allStops.filter(
            stop =>
                stop.latitude !== null &&
                stop.longitude !== null
        ).length;


    const totalStops =
        document.getElementById(
            "totalStops"
        );


    const gpsStopsElement =
        document.getElementById(
            "gpsStops"
        );


    const defaultRadius =
        document.getElementById(
            "defaultRadius"
        );


    if (totalStops) {

        totalStops.textContent =
            total;

    }


    if (gpsStopsElement) {

        gpsStopsElement.textContent =
            gpsStops;

    }


    if (defaultRadius) {

        defaultRadius.textContent =
            "100m";

    }

}


// ==========================================
// RENDER STOPS
// ==========================================

function renderStops(stops) {

    const tableBody =
        document.getElementById(
            "stopTableBody"
        );


    if (!tableBody) {

        return;
    }


    if (
        !stops ||
        stops.length === 0
    ) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-table"
                >
                    No stops found.
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        stops
            .map(
                stop => {

                    const assignments =
                        stop.routeAssignments ||
                        [];


                    const routeText =
                        assignments.length
                            ? assignments
                                .map(
                                    item =>
                                        `${escapeHTML(
                                            item.routes?.route_name ||
                                            "Route"
                                        )} (#${item.stop_order})`
                                )
                                .join("<br>")
                            : "Not assigned";


                    return `
                        <tr>

                            <td>

                                <strong>
                                    ${escapeHTML(
                                        stop.stop_name
                                    )}
                                </strong>

                                <div
                                    style="
                                        margin-top:5px;
                                        font-size:12px;
                                        color:#64748b;
                                    "
                                >
                                    ${routeText}
                                </div>

                            </td>


                            <td>
                                ${Number(
                                    stop.latitude
                                ).toFixed(6)}
                            </td>


                            <td>
                                ${Number(
                                    stop.longitude
                                ).toFixed(6)}
                            </td>


                            <td>
                                ${
                                    stop.notification_radius ||
                                    100
                                } m
                            </td>


                            <td>

                                <div
                                    class="table-actions"
                                >

                                    <button
                                        class="edit-btn"
                                        onclick="editStop('${stop.id}')"
                                    >
                                        Edit
                                    </button>


                                    <button
                                        class="delete-btn"
                                        onclick="deleteStop('${stop.id}')"
                                    >
                                        Delete
                                    </button>

                                </div>

                            </td>

                        </tr>
                    `;

                }
            )
            .join("");

}


// ==========================================
// OPEN ADD STOP FORM
// ==========================================

function openAddStopForm() {

    const formSection =
        document.getElementById(
            "stopFormSection"
        );


    const form =
        document.getElementById(
            "stopForm"
        );


    const title =
        document.getElementById(
            "stopFormTitle"
        );


    if (!formSection) {

        return;
    }


    editingStopId = null;


    if (form) {

        form.reset();

    }


    const stopId =
        document.getElementById(
            "stopId"
        );


    if (stopId) {

        stopId.value = "";

    }


    const radius =
        document.getElementById(
            "notificationRadius"
        );


    if (radius) {

        radius.value = 100;

    }


    const routeSelect =
        document.getElementById(
            "routeId"
        );


    if (routeSelect) {

        routeSelect.value = "";

    }


    const stopOrder =
        document.getElementById(
            "stopOrder"
        );


    if (stopOrder) {

        stopOrder.value = 1;

    }


    if (title) {

        title.textContent =
            "Add New Stop";

    }


    formSection.style.display =
        "block";


    formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


// ==========================================
// CLOSE STOP FORM
// ==========================================

function closeStopForm() {

    const formSection =
        document.getElementById(
            "stopFormSection"
        );


    const form =
        document.getElementById(
            "stopForm"
        );


    if (form) {

        form.reset();

    }


    editingStopId = null;


    if (formSection) {

        formSection.style.display =
            "none";

    }

}


// ==========================================
// GET NEXT STOP ORDER
// ==========================================

async function getNextStopOrder(
    routeId
) {

    if (!routeId) {

        return 1;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("route_stops")
        .select("stop_order")
        .eq(
            "route_id",
            routeId
        )
        .order(
            "stop_order",
            {
                ascending: false
            }
        )
        .limit(1)
        .maybeSingle();


    if (error) {

        console.error(
            "Next stop order error:",
            error
        );

        return 1;
    }


    if (!data) {

        return 1;
    }


    return (
        Number(
            data.stop_order
        ) + 1
    );

}


// ==========================================
// SAVE STOP
// ==========================================

async function saveStop(
    event
) {

    event.preventDefault();


    const stopName =
        document.getElementById(
            "stopName"
        )
        ?.value
        .trim();


    const latitude =
        parseFloat(
            document.getElementById(
                "latitude"
            )?.value
        );


    const longitude =
        parseFloat(
            document.getElementById(
                "longitude"
            )?.value
        );


    const notificationRadius =
        parseInt(
            document.getElementById(
                "notificationRadius"
            )?.value
        );


    const routeId =
        document.getElementById(
            "routeId"
        )?.value;


    let stopOrder =
        parseInt(
            document.getElementById(
                "stopOrder"
            )?.value
        );


    // ======================================
    // VALIDATION
    // ======================================

    if (!stopName) {

        alert(
            "Please enter stop name."
        );

        return;
    }


    if (
        Number.isNaN(latitude) ||
        latitude < -90 ||
        latitude > 90
    ) {

        alert(
            "Please enter a valid latitude."
        );

        return;
    }


    if (
        Number.isNaN(longitude) ||
        longitude < -180 ||
        longitude > 180
    ) {

        alert(
            "Please enter a valid longitude."
        );

        return;
    }


    if (
        Number.isNaN(notificationRadius) ||
        notificationRadius < 10
    ) {

        alert(
            "Notification radius must be at least 10 meters."
        );

        return;
    }


    if (!routeId) {

        alert(
            "Please select a route."
        );

        return;
    }


    if (
        Number.isNaN(stopOrder) ||
        stopOrder < 1
    ) {

        stopOrder = 1;

    }


    // ======================================
    // IF ADDING
    // ======================================

    if (!editingStopId) {

        // ----------------------------------
        // CHECK DUPLICATE STOP NAME
        // ----------------------------------

        const {
            data: existingStop
        } = await supabaseClient
            .from("stops")
            .select("id")
            .ilike(
                "stop_name",
                stopName
            )
            .maybeSingle();


        if (existingStop) {

            const continueAdding =
                confirm(
                    "A stop with this name already exists.\n\nDo you want to use the existing stop?"
                );


            if (continueAdding) {

                await assignExistingStopToRoute(
                    existingStop.id,
                    routeId,
                    stopOrder
                );

                alert(
                    "Existing stop assigned to route successfully!"
                );

                closeStopForm();

                await loadStops();

            }

            return;
        }


        // ----------------------------------
        // CREATE NEW STOP
        // ----------------------------------

        const stopData = {

            stop_name:
                stopName,

            latitude:
                latitude,

            longitude:
                longitude,

            notification_radius:
                notificationRadius

        };


        const {
            data: newStop,
            error: insertError
        } = await supabaseClient
            .from("stops")
            .insert([
                stopData
            ])
            .select()
            .single();


        if (insertError) {

            console.error(
                "Stop insert error:",
                insertError
            );


            alert(
                "Unable to create stop.\n\n" +
                insertError.message
            );

            return;
        }


        // ----------------------------------
        // ASSIGN TO ROUTE
        // ----------------------------------

        const assignmentResult =
            await assignStopToRoute(
                newStop.id,
                routeId,
                stopOrder
            );


        if (!assignmentResult.success) {

            // ----------------------------------
            // ROLLBACK STOP IF ASSIGNMENT FAILED
            // ----------------------------------

            await supabaseClient
                .from("stops")
                .delete()
                .eq(
                    "id",
                    newStop.id
                );


            alert(
                "Stop was created but route assignment failed.\n\n" +
                assignmentResult.error
            );

            return;
        }


        alert(
            "Stop added and assigned to route successfully! 🚍"
        );


        closeStopForm();

        await loadStops();

        return;

    }


    // ======================================
    // EDIT EXISTING STOP
    // ======================================

    const stopData = {

        stop_name:
            stopName,

        latitude:
            latitude,

        longitude:
            longitude,

        notification_radius:
            notificationRadius

    };


    const {
        error: updateError
    } = await supabaseClient
        .from("stops")
        .update(
            stopData
        )
        .eq(
            "id",
            editingStopId
        );


    if (updateError) {

        console.error(
            "Update stop error:",
            updateError
        );


        alert(
            "Unable to update stop.\n\n" +
            updateError.message
        );

        return;
    }


    // --------------------------------------
    // UPDATE ROUTE ASSIGNMENT
    // --------------------------------------

    const assignmentResult =
        await updateStopRouteAssignment(
            editingStopId,
            routeId,
            stopOrder
        );


    if (!assignmentResult.success) {

        alert(
            "Stop updated, but route assignment failed.\n\n" +
            assignmentResult.error
        );

        return;
    }


    alert(
        "Stop updated successfully! 🚍"
    );


    closeStopForm();

    await loadStops();

}


// ==========================================
// ASSIGN NEW STOP TO ROUTE
// ==========================================

async function assignStopToRoute(
    stopId,
    routeId,
    stopOrder
) {

    // --------------------------------------
    // CHECK SAME ORDER
    // --------------------------------------

    const {
        data: existingOrder,
        error: orderError
    } = await supabaseClient
        .from("route_stops")
        .select("id, stop_id")
        .eq(
            "route_id",
            routeId
        )
        .eq(
            "stop_order",
            stopOrder
        )
        .maybeSingle();


    if (orderError) {

        console.error(
            "Route order check error:",
            orderError
        );

        return {
            success: false,
            error: orderError.message
        };

    }


    // --------------------------------------
    // IF ORDER ALREADY EXISTS
    // --------------------------------------

    if (existingOrder) {

        const replace =
            confirm(
                `Stop order ${stopOrder} is already used in this route.\n\nDo you want to move the existing stop to the next available order?`
            );


        if (!replace) {

            return {
                success: false,
                error:
                    "Stop order already exists."
            };

        }


        const nextOrder =
            await getNextStopOrder(
                routeId
            );


        stopOrder =
            nextOrder;

    }


    // --------------------------------------
    // INSERT ROUTE STOP
    // --------------------------------------

    const {
        error
    } = await supabaseClient
        .from("route_stops")
        .insert([
            {
                route_id:
                    routeId,

                stop_id:
                    stopId,

                stop_order:
                    stopOrder
            }
        ]);


    if (error) {

        console.error(
            "Route stop insert error:",
            error
        );


        return {
            success: false,
            error:
                error.message
        };

    }


    return {
        success: true
    };

}


// ==========================================
// ASSIGN EXISTING STOP TO ROUTE
// ==========================================

async function assignExistingStopToRoute(
    stopId,
    routeId,
    stopOrder
) {

    // --------------------------------------
    // CHECK ALREADY ASSIGNED
    // --------------------------------------

    const {
        data: existingAssignment
    } = await supabaseClient
        .from("route_stops")
        .select("id")
        .eq(
            "route_id",
            routeId
        )
        .eq(
            "stop_id",
            stopId
        )
        .maybeSingle();


    if (existingAssignment) {

        alert(
            "This stop is already assigned to this route."
        );

        return;
    }


    const result =
        await assignStopToRoute(
            stopId,
            routeId,
            stopOrder
        );


    if (!result.success) {

        alert(
            "Unable to assign stop.\n\n" +
            result.error
        );

    }

}


// ==========================================
// UPDATE STOP ROUTE ASSIGNMENT
// ==========================================

async function updateStopRouteAssignment(
    stopId,
    routeId,
    stopOrder
) {

    // --------------------------------------
    // CHECK NEW ORDER
    // --------------------------------------

    const {
        data: orderRow,
        error: orderError
    } = await supabaseClient
        .from("route_stops")
        .select("id, stop_id")
        .eq(
            "route_id",
            routeId
        )
        .eq(
            "stop_order",
            stopOrder
        )
        .maybeSingle();


    if (orderError) {

        return {
            success: false,
            error:
                orderError.message
        };

    }


    // --------------------------------------
    // IF ORDER USED BY ANOTHER STOP
    // --------------------------------------

    if (
        orderRow &&
        orderRow.stop_id !== stopId
    ) {

        const nextOrder =
            await getNextStopOrder(
                routeId
            );


        stopOrder =
            nextOrder;

    }


    // --------------------------------------
    // GET CURRENT ASSIGNMENTS
    // --------------------------------------

    const {
        data: currentAssignments,
        error: currentError
    } = await supabaseClient
        .from("route_stops")
        .select("id")
        .eq(
            "stop_id",
            stopId
        );


    if (currentError) {

        return {
            success: false,
            error:
                currentError.message
        };

    }


    // --------------------------------------
    // REMOVE OLD ASSIGNMENTS
    // --------------------------------------

    if (
        currentAssignments &&
        currentAssignments.length > 0
    ) {

        const {
            error: deleteError
        } = await supabaseClient
            .from("route_stops")
            .delete()
            .eq(
                "stop_id",
                stopId
            );


        if (deleteError) {

            return {
                success: false,
                error:
                    deleteError.message
            };

        }

    }


    // --------------------------------------
    // CREATE NEW ASSIGNMENT
    // --------------------------------------

    const {
        error: insertError
    } = await supabaseClient
        .from("route_stops")
        .insert([
            {
                route_id:
                    routeId,

                stop_id:
                    stopId,

                stop_order:
                    stopOrder
            }
        ]);


    if (insertError) {

        return {
            success: false,
            error:
                insertError.message
        };

    }


    return {
        success: true
    };

}


// ==========================================
// EDIT STOP
// ==========================================

async function editStop(
    id
) {

    const stop =
        allStops.find(
            item =>
                item.id === id
        );


    if (!stop) {

        alert(
            "Stop not found."
        );

        return;
    }


    editingStopId =
        id;


    document.getElementById(
        "stopId"
    ).value =
        stop.id;


    document.getElementById(
        "stopName"
    ).value =
        stop.stop_name || "";


    document.getElementById(
        "latitude"
    ).value =
        stop.latitude || "";


    document.getElementById(
        "longitude"
    ).value =
        stop.longitude || "";


    document.getElementById(
        "notificationRadius"
    ).value =
        stop.notification_radius ||
        100;


    // --------------------------------------
    // GET FIRST ROUTE ASSIGNMENT
    // --------------------------------------

    const assignments =
        stop.routeAssignments ||
        [];


    const firstAssignment =
        assignments[0];


    const routeSelect =
        document.getElementById(
            "routeId"
        );


    const stopOrder =
        document.getElementById(
            "stopOrder"
        );


    if (routeSelect) {

        routeSelect.value =
            firstAssignment?.route_id ||
            "";

    }


    if (stopOrder) {

        stopOrder.value =
            firstAssignment?.stop_order ||
            1;

    }


    document.getElementById(
        "stopFormTitle"
    ).textContent =
        "Edit Stop";


    const formSection =
        document.getElementById(
            "stopFormSection"
        );


    formSection.style.display =
        "block";


    formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


// ==========================================
// DELETE STOP
// ==========================================

async function deleteStop(
    id
) {

    const stop =
        allStops.find(
            item =>
                item.id === id
        );


    if (!stop) {

        return;
    }


    const confirmed =
        confirm(
            `Delete stop "${stop.stop_name}"?\n\nThis will also remove its route assignments.`
        );


    if (!confirmed) {

        return;
    }


    // --------------------------------------
    // DELETE ROUTE ASSIGNMENTS FIRST
    // --------------------------------------

    const {
        error: routeError
    } = await supabaseClient
        .from("route_stops")
        .delete()
        .eq(
            "stop_id",
            id
        );


    if (routeError) {

        console.error(
            "Delete route assignments error:",
            routeError
        );


        alert(
            "Unable to remove route assignment.\n\n" +
            routeError.message
        );

        return;
    }


    // --------------------------------------
    // DELETE STOP
    // --------------------------------------

    const {
        error
    } = await supabaseClient
        .from("stops")
        .delete()
        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Delete stop error:",
            error
        );


        alert(
            "Unable to delete stop.\n\n" +
            error.message
        );

        return;
    }


    alert(
        "Stop deleted successfully!"
    );


    await loadStops();

}


// ==========================================
// SEARCH STOPS
// ==========================================

function filterStops() {

    const searchInput =
        document.getElementById(
            "stopSearch"
        );


    if (!searchInput) {

        return;
    }


    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    if (!search) {

        renderStops(
            allStops
        );

        return;
    }


    const filtered =
        allStops.filter(
            stop => {

                return (

                    (
                        stop.stop_name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            search
                        )

                    ||

                    String(
                        stop.latitude ||
                        ""
                    )
                        .includes(
                            search
                        )

                    ||

                    String(
                        stop.longitude ||
                        ""
                    )
                        .includes(
                            search
                        )

                    ||

                    (
                        stop.routeAssignments ||
                        []
                    )
                        .some(
                            assignment =>
                                (
                                    assignment.routes?.route_name ||
                                    ""
                                )
                                    .toLowerCase()
                                    .includes(
                                        search
                                    )
                        )

                );

            }
        );


    renderStops(
        filtered
    );

}


// ==========================================
// HTML ESCAPE
// ==========================================

function escapeHTML(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ==========================================
// LOGOUT
// ==========================================

async function logoutAdmin() {

    const confirmed =
        confirm(
            "Do you want to logout?"
        );


    if (!confirmed) {

        return;
    }


    const {
        error
    } = await supabaseClient
        .auth
        .signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );


        alert(
            "Logout failed."
        );

        return;
    }


    window.location.href =
        "login.html";

}