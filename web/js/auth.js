/** Firebase Google auth + allowlist for admin page */
(function (global) {
  let auth = null;
  let ready = false;

  function configReady() {
    const c = global.FIREBASE_CONFIG;
    return c && c.apiKey && !String(c.apiKey).startsWith("YOUR_");
  }

  async function initFirebase() {
    if (!configReady()) {
      return { ok: false, reason: "missing_config" };
    }
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
    );
    const { getAuth } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );
    const app = initializeApp(global.FIREBASE_CONFIG);
    auth = getAuth(app);
    ready = true;
    return { ok: true };
  }

  function isAllowed(email) {
    if (!email) return false;
    const list = (global.ADMIN_ALLOWLIST || []).map((e) => e.toLowerCase());
    return list.includes(String(email).toLowerCase());
  }

  async function signInWithGoogle() {
    if (!ready) {
      const r = await initFirebase();
      if (!r.ok) throw new Error(r.reason);
    }
    const { GoogleAuthProvider, signInWithPopup } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    const email = result.user?.email;
    if (!isAllowed(email)) {
      await signOut();
      const err = new Error("not_allowed");
      err.email = email;
      throw err;
    }
    return result.user;
  }

  async function signOut() {
    if (!auth) return;
    const { signOut: so } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );
    await so(auth);
  }

  function onAuth(callback) {
    return initFirebase().then(async (r) => {
      if (!r.ok) {
        callback(null, r.reason);
        return () => {};
      }
      const { onAuthStateChanged } = await import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
      );
      return onAuthStateChanged(auth, async (user) => {
        if (user && !isAllowed(user.email)) {
          await signOut();
          callback(null, "not_allowed");
          return;
        }
        callback(user, null);
      });
    });
  }

  global.THEAuth = {
    configReady,
    initFirebase,
    signInWithGoogle,
    signOut,
    onAuth,
    isAllowed,
  };
})(window);
