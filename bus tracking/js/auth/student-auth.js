// ==========================================
// STUDENT AUTHENTICATION
// LOGIN + SIGNUP
// ==========================================


// ==========================================
// CHECK CURRENT SESSION
// ==========================================

async function checkStudentSession() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {
        console.error("Session error:", error);
        return;
    }

    // Only redirect if we are already logged in
    if (data.session) {

        const currentPage =
            window.location.pathname;

        // Don't redirect while creating a new account
        if (!currentPage.includes("signup.html")) {
            await verifyStudentRole(data.session.user.id);
        }
    }
}


// ==========================================
// VERIFY STUDENT ROLE
// ==========================================

async function verifyStudentRole(userId) {

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", userId)
            .single();

    if (error) {

        console.error("Profile error:", error);

        showMessage(
            "Unable to load your student profile.",
            "error"
        );

        return;
    }

    if (!data) {

        showMessage(
            "Student profile not found.",
            "error"
        );

        return;
    }


    // Only students can enter student dashboard
    if (data.role !== "student") {

        await supabaseClient.auth.signOut();

        showMessage(
            "This account is not registered as a student.",
            "error"
        );

        return;
    }


    // Student verified
    window.location.href = "dashboard.html";
}


// ==========================================
// STUDENT LOGIN
// ==========================================

async function studentLogin(email, password) {

    const loginBtn =
        document.getElementById("loginBtn");

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "Signing in...";
    }

    hideMessage();


    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });


    if (error) {

        console.error("Login error:", error);

        let message =
            "Unable to sign in. Please try again.";


        if (
            error.message
                .toLowerCase()
                .includes("invalid login")
        ) {
            message =
                "Invalid email or password.";
        }


        if (
            error.message
                .toLowerCase()
                .includes("email not confirmed")
        ) {
            message =
                "Please verify your email before signing in.";
        }


        showMessage(message, "error");


        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = "Sign In";
        }

        return;
    }


    // Verify student role
    await verifyStudentRole(data.user.id);


    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign In";
    }
}


// ==========================================
// LOGIN FORM
// ==========================================

const loginForm =
    document.getElementById("studentLoginForm");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("password")
                    .value;


            if (!email || !password) {

                showMessage(
                    "Please enter your email and password.",
                    "error"
                );

                return;
            }


            await studentLogin(
                email,
                password
            );
        }
    );
}


// ==========================================
// STUDENT SIGNUP
// ==========================================

async function studentSignup(
    fullName,
    email,
    password
) {

    const signupBtn =
        document.getElementById("signupBtn");


    if (signupBtn) {
        signupBtn.disabled = true;
        signupBtn.textContent = "Creating account...";
    }


    hideSignupMessage();


    const { data, error } =
        await supabaseClient.auth.signUp({

            email: email,

            password: password,

            options: {
                data: {
                    full_name: fullName
                }
            }
        });


    // Signup failed
    if (error) {

        console.error(
            "Signup error:",
            error
        );


        let message =
            "Unable to create account. Please try again.";


        if (
            error.message
                .toLowerCase()
                .includes("already registered")
        ) {
            message =
                "This email is already registered. Please sign in.";
        }


        if (
            error.message
                .toLowerCase()
                .includes("password")
        ) {
            message =
                "Password must contain at least 6 characters.";
        }


        showSignupMessage(
            message,
            "error"
        );


        if (signupBtn) {
            signupBtn.disabled = false;
            signupBtn.textContent = "Create Account";
        }


        return;
    }


    console.log(
        "Student account created:",
        data.user
    );


    // Email confirmation disabled
    // So session should normally exist immediately.

    if (data.session) {

        showSignupMessage(
            "Account created successfully! Opening your dashboard...",
            "success"
        );


        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 1000);


    } else {

        // Useful if email confirmation is enabled later
        showSignupMessage(
            "Account created! Please check your email to verify your account.",
            "success"
        );


        if (signupBtn) {
            signupBtn.disabled = false;
            signupBtn.textContent = "Create Account";
        }
    }
}


// ==========================================
// SIGNUP FORM
// ==========================================

const signupForm =
    document.getElementById(
        "studentSignupForm"
    );


if (signupForm) {

    signupForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const fullName =
                document
                    .getElementById("fullName")
                    .value
                    .trim();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("password")
                    .value;


            const confirmPassword =
                document
                    .getElementById("confirmPassword")
                    .value;


            // Full name validation
            if (!fullName) {

                showSignupMessage(
                    "Please enter your full name.",
                    "error"
                );

                return;
            }


            // Email validation
            if (!email) {

                showSignupMessage(
                    "Please enter your email.",
                    "error"
                );

                return;
            }


            // Password validation
            if (password.length < 6) {

                showSignupMessage(
                    "Password must contain at least 6 characters.",
                    "error"
                );

                return;
            }


            // Confirm password
            if (password !== confirmPassword) {

                showSignupMessage(
                    "Passwords do not match.",
                    "error"
                );

                return;
            }


            // Create account
            await studentSignup(
                fullName,
                email,
                password
            );
        }
    );
}


// ==========================================
// PASSWORD TOGGLE
// ==========================================

const togglePassword =
    document.getElementById(
        "togglePassword"
    );


if (togglePassword) {

    togglePassword.addEventListener(
        "click",
        function () {

            const passwordInput =
                document.getElementById(
                    "password"
                );


            if (
                passwordInput.type ===
                "password"
            ) {

                passwordInput.type =
                    "text";

                togglePassword.textContent =
                    "🙈";

            } else {

                passwordInput.type =
                    "password";

                togglePassword.textContent =
                    "👁";
            }
        }
    );
}


// ==========================================
// CONFIRM PASSWORD TOGGLE
// ==========================================

const toggleConfirmPassword =
    document.getElementById(
        "toggleConfirmPassword"
    );


if (toggleConfirmPassword) {

    toggleConfirmPassword.addEventListener(
        "click",
        function () {

            const confirmPasswordInput =
                document.getElementById(
                    "confirmPassword"
                );


            if (
                confirmPasswordInput.type ===
                "password"
            ) {

                confirmPasswordInput.type =
                    "text";

                toggleConfirmPassword.textContent =
                    "🙈";

            } else {

                confirmPasswordInput.type =
                    "password";

                toggleConfirmPassword.textContent =
                    "👁";
            }
        }
    );
}


// ==========================================
// FORGOT PASSWORD
// ==========================================

const forgotPassword =
    document.getElementById(
        "forgotPassword"
    );


if (forgotPassword) {

    forgotPassword.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            if (!email) {

                showMessage(
                    "First enter your student email.",
                    "error"
                );

                return;
            }


            const { error } =
                await supabaseClient.auth
                    .resetPasswordForEmail(
                        email,
                        {
                            redirectTo:
                                window.location.origin +
                                "/student/login.html"
                        }
                    );


            if (error) {

                console.error(
                    "Password reset error:",
                    error
                );

                showMessage(
                    "Unable to send password reset email.",
                    "error"
                );

                return;
            }


            showMessage(
                "Password reset link has been sent to your email.",
                "success"
            );
        }
    );
}


// ==========================================
// LOGIN MESSAGE
// ==========================================

function showMessage(
    message,
    type
) {

    const messageBox =
        document.getElementById(
            "message"
        );


    if (!messageBox) return;


    messageBox.textContent =
        message;


    messageBox.className =
        "message " + type;
}


function hideMessage() {

    const messageBox =
        document.getElementById(
            "message"
        );


    if (!messageBox) return;


    messageBox.textContent =
        "";


    messageBox.className =
        "message";
}


// ==========================================
// SIGNUP MESSAGE
// ==========================================

function showSignupMessage(
    message,
    type
) {

    const messageBox =
        document.getElementById(
            "signupMessage"
        );


    if (!messageBox) return;


    messageBox.textContent =
        message;


    messageBox.className =
        "message " + type;
}


function hideSignupMessage() {

    const messageBox =
        document.getElementById(
            "signupMessage"
        );


    if (!messageBox) return;


    messageBox.textContent =
        "";


    messageBox.className =
        "message";
}


// ==========================================
// START SESSION CHECK
// ==========================================

checkStudentSession();