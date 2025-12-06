window.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.getElementById("loading-screen");
  const loginScreen = document.getElementById("login-screen");
  const chat = document.getElementById("chat");
  const loginBtn = document.getElementById("login-btn");
  const savedUser = localStorage.getItem("dutaUser");

  /* ==========================
     ✅ WHITELIST AKUN
     Format: "username": "password"
  ===========================*/
  const WHITELIST = {
    "Zaky": "tronsar",
    "Juli": "HEBWAT",
    "Tester": "duta2025"
  };

  /* ==========================
     🚫 BANNED AKUN
  ===========================*/
  const BANNED = {
    "Alvino": "123456789"
  };

  /* ==========================
     Fungsi: Menampilkan login
  ===========================*/
  function showLogin() {
    loginScreen.style.display = "flex";
    chat.style.display = "none";
  }

  /* ==========================
     Fungsi: Proses login
  ===========================*/
  function handleLogin() {
    const username = document.getElementById("username-input").value.trim();
    const password = document.getElementById("password-input").value.trim();

    if (!username || !password) {
      showDeniedPopup("Isi username dan password dulu ya!");
      return;
    }

    // 🚫 Cek banned
    if (username in BANNED) {
      showDeniedPopup(`🚫 Akun "${username}" telah diblokir.`);
      return;
    }

    // ✅ Cek whitelist
    if (!(username in WHITELIST)) {
      showDeniedPopup("Username tidak terdaftar!");
      return;
    }

    // 🔑 Cek password
    if (WHITELIST[username] !== password) {
      showDeniedPopup("Password salah!");
      return;
    }

    // 💾 Simpan login
    localStorage.setItem("dutaUser", username);

    // 🚀 Tutup login, tampilkan chat
    loginScreen.style.display = "none";
    chat.style.display = "block";

    // 🎉 Popup selamat datang (pakai CSS bawaan)
    showWelcomePopup(username);
  }

  /* ==========================
     Popup Selamat Datang (pakai CSS)
  ===========================*/
  function showWelcomePopup(username) {
    const popup = document.createElement("div");
    popup.id = "welcome-popup";
    popup.textContent = `Selamat datang kembali, ${username}!`;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add("show"), 100);
    setTimeout(() => {
      popup.classList.remove("show");
      setTimeout(() => popup.remove(), 600);
    }, 4000);
  }

  /* ==========================
     Popup Akses Ditolak (dengan style manual)
  ===========================*/
  function showDeniedPopup(message) {
    const popup = document.createElement("div");
    popup.id = "denied-popup";
    popup.textContent = message;

    // Inline style (karena belum ada di CSS)
    popup.style.position = "fixed";
    popup.style.top = "20px";
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
    popup.style.background = "rgba(255, 0, 0, 0.15)";
    popup.style.border = "1px solid rgba(255, 0, 0, 0.4)";
    popup.style.padding = "10px 20px";
    popup.style.borderRadius = "10px";
    popup.style.backdropFilter = "blur(10px)";
    popup.style.color = "#fff";
    popup.style.fontFamily = "Plus Jakarta Sans, sans-serif";
    popup.style.transition = "opacity 0.6s";
    popup.style.opacity = "0";
    popup.style.zIndex = "9999";

    document.body.appendChild(popup);

    setTimeout(() => popup.style.opacity = "1", 100);
    setTimeout(() => {
      popup.style.opacity = "0";
      setTimeout(() => popup.remove(), 600);
    }, 3500);
  }

  /* ==========================
     Event Listener
  ===========================*/
  if (loginBtn) loginBtn.addEventListener("click", handleLogin);

  /* ==========================
     Loading Awal
  ===========================*/
  setTimeout(() => {
    loadingScreen.style.display = "none";

    if (savedUser) {
      // 🚫 Kalau user dibanned, reset login
      if (savedUser in BANNED) {
        localStorage.removeItem("dutaUser");
        showDeniedPopup(`🚫 Akun "${savedUser}" telah diblokir.`);
        showLogin();
        return;
      }

      // ❌ Jika user tidak di whitelist, reset juga
      if (!(savedUser in WHITELIST)) {
        localStorage.removeItem("dutaUser");
        showDeniedPopup("Akun tidak terdaftar di sistem.");
        showLogin();
        return;
      }

      // ✅ Kalau aman, langsung ke chat
      chat.style.display = "block";
      showWelcomePopup(savedUser);
    } else {
      // 🧩 Belum pernah login
      showLogin();
    }
  }, 4000);
});
