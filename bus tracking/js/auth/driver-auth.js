// =====================================================
// BUS TRACK
// DRIVER AUTHENTICATION
// =====================================================


// =====================================================
// DRIVER LOGIN
// =====================================================

async function driverLogin(event) {

    event.preventDefault();


    // -----------------------------------------------
    // GET ELEMENTS
    // -----------------------------------------------

    const emailInput =
        document.getElementById("email");


    const passwordInput =
        document.getElementById("password");


    const loginButton =
        document.getElementById("loginButton");


    const errorBox =
        document.getElementById("loginError");


    // -----------------------------------------------
    // GET VALUES
    // -----------------------------------------------

    const email =
        emailInput.value.trim();


    const password =
        passwordInput.value;


    // -----------------------------------------------
    // CLEAR ERROR
    // -----------------------------------------------

    errorBox.classList.remove("show");

    errorBox.textContent = "";


    // -----------------------------------------------
    // LOADING
    // -----------------------------------------------

    loginButton.disabled = true;

    loginButton.textContent =
        "Logging in...";


    try {

        // ===========================================
        // SUPABASE LOGIN
        // ===========================================

        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({

                    email: email,

                    password: password

                });


        if (error) {

            throw error;

        }


        // ===========================================
        // GET USER
        // ===========================================

        const user =
            data.user;


        if (!user) {

            throw new Error(
                "Unable to get user information."
            );

        }


        console.log(
            "Logged in user:",
            user.id
        );


        // ===========================================
        // CHECK PROFILE
        // ===========================================

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id, full_name, phone, role"
                )
                .eq(
                    "id",
                    user.id
                )
                .single();


        if (profileError) {

            console.error(
                "Profile error:",
                profileError
            );


            await supabaseClient
                .auth
                .signOut();


            throw new Error(
                "Driver profile was not found."
            );

        }


        // ===========================================
        // CHECK ROLE
        // ===========================================

        if (
            !profile ||
            profile.role !== "driver"
        ) {

            await supabaseClient
                .auth
                .signOut();


            throw new Error(
                "This account is not registered as a driver."
            );

        }


        // ===========================================
        // GET DRIVER RECORD
        // ===========================================

        const {
            data: driver,
            error: driverError
        } =
            await supabaseClient
                .from("drivers")
                .select(
                    `
                    id,
                    profile_id,
                    driver_code,
                    license_number,
                    status
                    `
                )
                .eq(
                    "profile_id",
                    user.id
                )
                .single();


        if (
            driverError ||
            !driver
        ) {

            console.error(
                "Driver record error:",
                driverError
            );


            await supabaseClient
                .auth
                .signOut();


            throw new Error(
                "Driver record was not found."
            );

        }


        // ===========================================
        // CHECK DRIVER STATUS
        // ===========================================

        if (
            driver.status === "inactive"
        ) {

            await supabaseClient
                .auth
                .signOut();


            throw new Error(
                "Your driver account is inactive. Please contact the admin."
            );

        }


        // ===========================================
        // SAVE DRIVER INFO
        // ===========================================

        sessionStorage.setItem(
            "driverId",
            driver.id
        );


        sessionStorage.setItem(
            "driverCode",
            driver.driver_code || ""
        );


        sessionStorage.setItem(
            "driverName",
            profile.full_name || ""
        );


        sessionStorage.setItem(
            "driverPhone",
            profile.phone || ""
        );


        sessionStorage.setItem(
            "driverStatus",
            driver.status || ""
        );


        // ===========================================
        // SUCCESS
        // ===========================================

        console.log(
            "Driver login successful"
        );


        console.log(
            "Driver:",
            driver.driver_code
        );


        // ===========================================
        // REDIRECT
        // ===========================================

        window.location.href =
            "dashboard.html";


    } catch (error) {

        console.error(
            "Driver login error:",
            error
        );


        // ===========================================
        // FRIENDLY ERROR
        // ===========================================

        errorBox.textContent =
            getDriverLoginErrorMessage(
                error
            );


        errorBox.classList.add(
            "show"
        );


        // ===========================================
        // RESET BUTTON
        // ===========================================

        loginButton.disabled =
            false;

        loginButton.textContent =
            "Login as Driver";

    }

}



// =====================================================
// FRIENDLY ERROR MESSAGE
// =====================================================

function getDriverLoginErrorMessage(
    error
) {

    const message =
        error?.message || "";


    const lowerMessage =
        message.toLowerCase();


    // Invalid credentials

    if (
        lowerMessage.includes(
            "invalid login credentials"
        )
    ) {

        return (
            "Invalid email or password."
        );

    }


    // Email confirmation

    if (
        lowerMessage.includes(
            "email not confirmed"
        )
    ) {

        return (
            "Please confirm your email before logging in."
        );

    }


    // Driver profile

    if (
        lowerMessage.includes(
            "driver profile"
        )
    ) {

        return (
            "Driver profile not found. Please contact the admin."
        );

    }


    // Driver record

    if (
        lowerMessage.includes(
            "driver record"
        )
    ) {

        return (
            "Driver account is not configured correctly. Please contact the admin."
        );

    }


    // Default

    return (
        message ||
        "Login failed. Please try again."
    );

}



// =====================================================
// CHECK DRIVER SESSION
// =====================================================

async function checkDriverSession() {

    try {

        const {
            data: {
                session
            }
        } =
            await supabaseClient
                .auth
                .getSession();


        if (!session) {

            return false;

        }


        // -------------------------------------------
        // CHECK PROFILE ROLE
        // -------------------------------------------

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq(
                    "id",
                    session.user.id
                )
                .single();


        if (
            profileError ||
            !profile ||
            profile.role !== "driver"
        ) {

            await supabaseClient
                .auth
                .signOut();


            return false;

        }


        // -------------------------------------------
        // CHECK DRIVER RECORD
        // -------------------------------------------

        const {
            data: driver,
            error: driverError
        } =
            await supabaseClient
                .from("drivers")
                .select(
                    "id, driver_code, status"
                )
                .eq(
                    "profile_id",
                    session.user.id
                )
                .single();


        if (
            driverError ||
            !driver
        ) {

            await supabaseClient
                .auth
                .signOut();


            return false;

        }


        // -------------------------------------------
        // CHECK STATUS
        // -------------------------------------------

        if (
            driver.status === "inactive"
        ) {

            await supabaseClient
                .auth
                .signOut();


            return false;

        }


        // -------------------------------------------
        // RESTORE SESSION STORAGE
        // -------------------------------------------

        sessionStorage.setItem(
            "driverId",
            driver.id
        );


        sessionStorage.setItem(
            "driverCode",
            driver.driver_code || ""
        );


        sessionStorage.setItem(
            "driverStatus",
            driver.status || ""
        );


        return true;


    } catch (error) {

        console.error(
            "Driver session error:",
            error
        );


        return false;

    }

}



// =====================================================
// LOGOUT DRIVER
// =====================================================

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
                "Logout failed."
            );

            return;

        }


        // Clear local session data

        sessionStorage.removeItem(
            "driverId"
        );


        sessionStorage.removeItem(
            "driverCode"
        );


        sessionStorage.removeItem(
            "driverName"
        );


        sessionStorage.removeItem(
            "driverPhone"
        );


        sessionStorage.removeItem(
            "driverStatus"
        );


        window.location.href =
            "login.html";


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );


        alert(
            "Unable to logout."
        );

    }

}



// =====================================================
// PROTECT DRIVER PAGE
// =====================================================

async function protectDriverPage() {

    const loggedIn =
        await checkDriverSession();


    if (!loggedIn) {

        window.location.href =
            "login.html";

        return false;

    }


    return true;

}



// =====================================================
// LOGIN PAGE SESSION CHECK
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        const currentPage =
            window.location.pathname
                .split("/")
                .pop();


        /*
        Only redirect automatically
        when currently on login page.
        */

        if (
            currentPage === "login.html" ||
            currentPage === ""
        ) {

            const loggedIn =
                await checkDriverSession();


            if (loggedIn) {

                window.location.href =
                    "dashboard.html";

            }

        }

    }
);