// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

const adminLoginForm = document.getElementById("adminLoginForm");
const loginButton = document.getElementById("loginButton");
const errorMessage = document.getElementById("errorMessage");


// ==========================================
// SHOW ERROR
// ==========================================

function showError(message) {

    errorMessage.textContent = message;
    errorMessage.style.display = "block";

}


// ==========================================
// HIDE ERROR
// ==========================================

function hideError() {

    errorMessage.textContent = "";
    errorMessage.style.display = "none";

}


// ==========================================
// ADMIN LOGIN
// ==========================================

adminLoginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    hideError();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {

        showError("Please enter email and password.");
        return;

    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";


    try {

        // Login using Supabase Auth
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });


        if (error) {
            throw error;
        }


        if (!data.user) {
            throw new Error("Login failed. User not found.");
        }


        // Get user's profile
        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("id, full_name, role")
                .eq("id", data.user.id)
                .single();


        if (profileError) {
            throw profileError;
        }


        // Check admin role
        if (profile.role !== "admin") {

            await supabaseClient.auth.signOut();

            throw new Error(
                "This account does not have Admin access."
            );

        }


        // Admin verified
        console.log("Admin login successful");
        console.log("Admin:", profile);


        // Go to admin dashboard
        window.location.href = "dashboard.html";


    } catch (error) {

        console.error("Admin login error:", error);

        showError(
            error.message || "Login failed. Please try again."
        );

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login";

    }

});