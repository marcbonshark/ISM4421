// Email + password login for Owl Beats, using Supabase Auth.
// Until someone is signed in, the login screen covers the app. Once they are,
// it hides and calls startApp() from app.js.

"use strict";

(function () {
  const cfg = window.OWLBEATS_CONFIG || {};
  const $ = (sel) => document.querySelector(sel);
  const screen = $("#auth-screen");
  const form = $("#auth-form");
  const heading = $("#auth-heading");
  const sub = $("#auth-sub");
  const email = $("#auth-email");
  const password = $("#auth-password");
  const passwordField = $("#auth-password-field");
  const confirm = $("#auth-confirm");
  const confirmField = $("#auth-confirm-field");
  const submit = $("#auth-submit");
  const msg = $("#auth-msg");
  const links = $("#auth-links");
  const userBox = $("#user-box");
  const userEmail = $("#user-email");
  const signOutBtn = $("#sign-out");

  // Email links (confirm signup, reset password) bring people back to this page.
  const returnUrl = location.origin + location.pathname;

  const MODES = {
    signin: { heading: "Sign in", sub: "Welcome back! Sign in to make music.", button: "Sign in", password: true, confirm: false },
    signup: { heading: "Create an account", sub: "Sign up with your email to start making music.", button: "Create account", password: true, confirm: true },
    forgot: { heading: "Reset your password", sub: "We'll email you a link to choose a new password.", button: "Send reset link", password: false, confirm: false },
    recover: { heading: "Choose a new password", sub: "Enter a new password for your account.", button: "Save new password", password: true, confirm: true },
  };
  const LINKS = {
    signin: [["signup", "Create an account"], ["forgot", "Forgot password?"]],
    signup: [["signin", "Already have an account? Sign in"]],
    forgot: [["signin", "Back to sign in"]],
    recover: [],
  };

  let mode = "signin";

  // Read email-link details before the Supabase client consumes the URL.
  const hash = new URLSearchParams(location.hash.slice(1));
  const linkError = hash.get("error_description");
  const isRecovery = hash.get("type") === "recovery";

  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) {
    showMessage("Login is not configured. Check config.js.", true);
    submit.disabled = true;
    return;
  }

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  function setMode(next, keepMessage) {
    mode = next;
    const m = MODES[mode];
    heading.textContent = m.heading;
    sub.textContent = m.sub;
    submit.textContent = m.button;
    passwordField.hidden = !m.password;
    password.required = m.password;
    password.autocomplete = mode === "signin" ? "current-password" : "new-password";
    confirmField.hidden = !m.confirm;
    confirm.required = m.confirm;
    email.closest(".field").hidden = mode === "recover";
    email.required = mode !== "recover";
    links.replaceChildren(
      ...LINKS[mode].map(([to, text]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "link-btn";
        b.textContent = text;
        b.addEventListener("click", () => setMode(to));
        return b;
      })
    );
    if (!keepMessage) showMessage("");
    (mode === "recover" ? password : email).focus();
  }

  function showMessage(text, isError) {
    msg.textContent = text;
    msg.hidden = !text;
    msg.className = `notice ${isError ? "notice-error" : "notice-ok"}`;
  }

  function friendly(error) {
    const text = (error && error.message) || String(error);
    if (/invalid login credentials/i.test(text)) return "Wrong email or password.";
    if (/email not confirmed/i.test(text)) return "Please confirm your email first. Check your inbox for the link.";
    if (/already registered|already been registered/i.test(text)) return "That email already has an account. Sign in instead.";
    if (/rate limit|too many/i.test(text)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/failed to fetch|network/i.test(text)) return "Couldn't reach the login server. Check your connection.";
    return text;
  }

  async function onSubmit(e) {
    e.preventDefault();
    showMessage("");
    const addr = email.value.trim();
    const pw = password.value;
    if (MODES[mode].confirm && pw !== confirm.value) return showMessage("The passwords don't match.", true);
    if (MODES[mode].password && mode !== "signin" && pw.length < 6) {
      return showMessage("Use at least 6 characters for your password.", true);
    }

    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = "Please wait…";
    try {
      if (mode === "signin") {
        const { error } = await client.auth.signInWithPassword({ email: addr, password: pw });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email: addr,
          password: pw,
          options: { emailRedirectTo: returnUrl },
        });
        if (error) throw error;
        // With "Confirm email" on, Supabase returns no session until the link is clicked.
        // It also returns a user with no identities when the email is already registered.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error("already registered");
        }
        if (!data.session) {
          setMode("signin", true);
          email.value = addr;
          showMessage(`Almost done! We sent a confirmation link to ${addr}. Click it, then sign in.`);
        }
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(addr, { redirectTo: returnUrl });
        if (error) throw error;
        showMessage(`If ${addr} has an account, a reset link is on its way.`);
      } else if (mode === "recover") {
        const { error } = await client.auth.updateUser({ password: pw });
        if (error) throw error;
        history.replaceState(null, "", returnUrl);
        showMessage("");
        mode = "signin";
        enterApp((await client.auth.getUser()).data.user);
      }
    } catch (err) {
      showMessage(friendly(err), true);
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  }

  function enterApp(user) {
    if (!user || mode === "recover") return;
    screen.hidden = true;
    document.body.classList.remove("locked");
    userEmail.textContent = user.email || "";
    userBox.hidden = false;
    if (typeof window.startApp === "function") window.startApp(user.id);
  }

  function showLogin() {
    screen.hidden = false;
    screen.classList.remove("checking");
    document.body.classList.add("locked");
    userBox.hidden = true;
  }

  form.addEventListener("submit", onSubmit);
  signOutBtn.addEventListener("click", async () => {
    signOutBtn.disabled = true;
    await client.auth.signOut();
    location.replace(returnUrl); // fresh page: clears this user's tracks from view
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      showLogin();
      setMode("recover");
      return;
    }
    if (session && session.user) {
      // Defer so this callback returns before app code calls Supabase again.
      setTimeout(() => enterApp(session.user), 0);
    } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
      showLogin();
    }
  });

  if (isRecovery) {
    setMode("recover");
  } else {
    setMode("signin", true);
  }
  // Errors from email links (expired or already used) arrive in the URL hash.
  if (linkError) {
    showMessage(`${linkError.replace(/\+/g, " ")}. Please try again.`, true);
    history.replaceState(null, "", returnUrl);
  }
})();
