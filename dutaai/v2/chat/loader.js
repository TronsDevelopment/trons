// ---------------------- Terminal Boot Loader (tricky load version) ----------------------
/*
 Total duration: 3.4s (2.4s typing + 1s pause)
 - Line 1 slower (600ms)
 - 2 random lines slower (200–350ms)
 - Service Worker status will be updated live: if SW registers => green 'online',
   if it fails => show error message in red. Works whether SW resolves before/during/after typing.
*/

(function terminalBootTricky() {
  const TOTAL_MS = 2400;
  const fadeDelay = 220;
  const afterReadyPause = 1000;
  const failsafeExtra = 1800;

  const bootScreen = document.getElementById('loading-screen');
  const bootLinesEl = document.getElementById('bootLines');
  const dutaLabel = document.getElementById('dutaLabel');
  const bootReady = document.getElementById('bootReady');
  const chatEl = document.getElementById('chat');

  const LINES = [
    "Initializing core...",
    "Loading low-level services...",
    "Mounting virtual FS: /duta/config...",
    "Connecting UI modules...",
    "Setting up memory management...",
    "Loading model bundles...",
    "Service worker online.", /* <-- will be updated to success/failure dynamically */
    "Establishing secure sandbox...",
    "Preparing inference engine...",
    "Verifying model bundles...",
    "Decrypting personality key...",
    "Loading language packs (id,en,auto)...",
    "Optimizing tokenizer cache...",
    "Allocating inference buffers...",
    "Warming up inference kernels...",
    "Syncing DUTA personality...",
    "Initializing chat renderer...",
    "Registering plugins: Markdown, MathJax...",
    "Checking network endpoints...",
    "Applying theme presets...",
    "Finalizing setup...",
    "Performing last integrity checks...",
    "Ready."
  ];

  // --- locate service worker line index so we can update it later ---
  const SW_LINE_LABEL = "Service worker online.";
  const SW_INDEX = LINES.findIndex(l => l === SW_LINE_LABEL);

  // --- generate slot durations ---
  const usableMs = TOTAL_MS - fadeDelay;
  const lengths = LINES.map(l => Math.min(1 + l.length, 120));
  const totalLen = lengths.reduce((s, n) => s + n, 0);
  const baseSlots = lengths.map(len => Math.max(20, Math.floor((len / totalLen) * usableMs)));

  // pick 2 random "slow" lines (not including 0 and last)
  const slowIndices = [];
  while (slowIndices.length < 2) {
    const r = Math.floor(Math.random() * (LINES.length - 2)) + 1; // skip first & last
    if (!slowIndices.includes(r)) slowIndices.push(r);
  }

  // apply slow factors
  const slots = baseSlots.slice();
  slots[0] = 600; // first always slow
  slowIndices.forEach(i => {
    slots[i] = 200 + Math.floor(Math.random() * 150); // 200–350ms
  });

  // recalc remaining time to keep total constant (best-effort)
  const used = slots.reduce((s, n) => s + n, 0);
  const diff = usableMs - used;
  if (Math.abs(diff) > 0) {
    // distribute diff proportionally among non-slow, non-first, non-last lines
    const adjustable = [];
    for (let i = 0; i < slots.length; i++) {
      if (i !== 0 && i !== LINES.length - 1 && !slowIndices.includes(i)) adjustable.push(i);
    }
    if (adjustable.length) {
      const addPer = Math.floor(diff / adjustable.length);
      adjustable.forEach(i => {
        slots[i] = Math.max(20, slots[i] + addPer);
      });
      // small remainder: add to first adjustable items
      let rem = diff - addPer * adjustable.length;
      let idx = 0;
      while (rem !== 0 && idx < adjustable.length) {
        slots[adjustable[idx]] = Math.max(20, slots[adjustable[idx]] + (rem > 0 ? 1 : -1));
        rem += (rem > 0) ? -1 : 1;
        idx++;
      }
    }
  }

  // --- typing logic & element tracking ---
  const lineEls = new Array(LINES.length).fill(null); // store references to each rendered line element
  let pendingSWUpdate = null; // if SW status arrives before line is created

  function typeLine(text, slotMs, index) {
    return new Promise(resolve => {
      const lineEl = document.createElement('div');
      lineEl.setAttribute('role', 'listitem');
      lineEl.className = 'boot-line';
      // initially put a caret so typing feels real
      const caret = document.createElement('span');
      caret.className = 'caret';
      lineEl.appendChild(caret);
      bootLinesEl.appendChild(lineEl);

      // store element reference for external updates (e.g., SW status)
      lineEls[index] = lineEl;

      // If there's a pending SW update and this is the SW line, apply it now
      if (index === SW_INDEX && pendingSWUpdate) {
        // we'll override text content after typing finishes so animation remains natural
      }

      const minCharDelay = 8;
      const maxCharDelay = 22;
      const totalChars = Math.max(1, text.length);
      let base = Math.max(minCharDelay, Math.floor(slotMs / (totalChars + 1)));
      base = Math.min(base, maxCharDelay);

      let i = 0;
      function step() {
        const batch = (slotMs < 140) ? 5 : 3;
        // ensure caret remains and text appended before it
        // remove caret while appending, then re-add to keep DOM simple
        if (caret.parentElement) caret.parentElement.removeChild(caret);
        for (let b = 0; b < batch && i < text.length; b++) {
          lineEl.textContent += text[i++];
        }
        // append caret back if not finished
        lineEl.appendChild(caret);

        const container = bootLinesEl.parentElement;
        if (container) container.scrollTop = container.scrollHeight;

        if (i < text.length) {
          const jitter = Math.random() * (base * 0.6);
          setTimeout(step, base + jitter);
        } else {
          // typing finished: remove caret and finalize text
          if (caret.parentElement) caret.parentElement.removeChild(caret);

          // If this is the SW line and we had a pending update, apply it now
          if (index === SW_INDEX && pendingSWUpdate) {
            const { success, message, extraError } = pendingSWUpdate;
            if (success) {
              lineEl.textContent = message || "Service worker online.";
              lineEl.style.color = "rgba(0,255,153,1)";
              lineEl.style.fontWeight = 600;
            } else {
              // show failure message and make it prominent
              const msg = message || "Service worker failed to register.";
              lineEl.textContent = msg;
              lineEl.style.color = "rgba(255,80,80,1)";
              lineEl.style.fontWeight = 700;

              // optionally add a small extra-line with error detail (non-blocking)
              if (extraError) {
                const errEl = document.createElement('div');
                errEl.className = 'boot-line boot-line-error';
                errEl.textContent = `  › ${String(extraError).slice(0, 200)}`;
                errEl.style.color = 'rgba(255,120,120,1)';
                errEl.style.fontSize = '0.92em';
                bootLinesEl.appendChild(errEl);
                if (container) container.scrollTop = container.scrollHeight;
              }
            }
            // clear pending
            pendingSWUpdate = null;
          } else {
            // Normal finalization for non-SW lines. Special-case "Ready." styling.
            if (text.trim().toLowerCase() === 'ready.') {
              lineEl.style.color = "rgba(0,255,153,1)";
              lineEl.style.fontWeight = 700;

              setTimeout(() => {
                const versionEl = document.querySelector('.duta-version');
                if (versionEl) {
                  versionEl.style.opacity = '0';
                  versionEl.style.transform = 'translateY(6px)';
                  versionEl.style.transition = 'all 0.5s ease-out';
                  versionEl.style.display = 'block';
                  requestAnimationFrame(() => {
                    versionEl.style.opacity = '1';
                    versionEl.style.transform = 'translateY(0)';
                  });
                }
              }, 240);
            }
          }
          resolve();
        }
      }
      step();
    });
  }

  async function run() {
    bootLinesEl.innerHTML = '';
    bootLinesEl.parentElement.scrollTop = 0;

    for (let i = 0; i < LINES.length; i++) {
      const txt = LINES[i];
      const slot = slots[i] || Math.floor(usableMs / LINES.length);
      await typeLine(txt, slot, i);
      await new Promise(r => setTimeout(r, 8));
    }

    bootReady.style.opacity = '1';
    bootReady.style.transform = 'translateY(0) scale(1)';
    dutaLabel.style.color = 'rgba(0,255,153,1)';
    dutaLabel.style.transform = 'scale(1.03)';
    setTimeout(() => { dutaLabel.style.transform = ''; }, 160);

    setTimeout(exitLoader, fadeDelay + afterReadyPause);
  }

  function exitLoader() {
    if (!bootScreen) return finishNow();
    bootScreen.classList.add('loader-exit');
    setTimeout(() => {
      try { bootScreen.remove(); } catch(e) {}
      finishNow();
    }, 460);
  }

  function finishNow() {
    if (chatEl) {
      chatEl.style.display = 'block';
      chatEl.style.opacity = '0';
      chatEl.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 280, easing: 'ease-in-out', fill: 'forwards'
      });
    }
  }

  // small helper to update SW status (can be called anytime)
  function updateServiceWorkerStatus(success, message, extraError) {
    // prepare a nice message
    const msg = (typeof message === 'string') ? message : (success ? "Service worker online." : "Service worker failed to register.");
    if (SW_INDEX < 0) {
      // no SW line to update — append a new line
      const el = document.createElement('div');
      el.className = 'boot-line';
      el.textContent = msg;
      el.style.color = success ? "rgba(0,255,153,1)" : "rgba(255,80,80,1)";
      el.style.fontWeight = success ? 600 : 700;
      bootLinesEl.appendChild(el);
      if (extraError) {
        const errEl = document.createElement('div');
        errEl.className = 'boot-line boot-line-error';
        errEl.textContent = `  › ${String(extraError).slice(0, 200)}`;
        errEl.style.color = 'rgba(255,120,120,1)';
        errEl.style.fontSize = '0.92em';
        bootLinesEl.appendChild(errEl);
      }
      const container = bootLinesEl.parentElement;
      if (container) container.scrollTop = container.scrollHeight;
      return;
    }

    const lineEl = lineEls[SW_INDEX];
    if (lineEl) {
      // If the SW line is already created, update immediately
      lineEl.textContent = msg;
      lineEl.style.color = success ? "rgba(0,255,153,1)" : "rgba(255,80,80,1)";
      lineEl.style.fontWeight = success ? 600 : 700;

      if (!success && extraError) {
        const errEl = document.createElement('div');
        errEl.className = 'boot-line boot-line-error';
        errEl.textContent = `  › ${String(extraError).slice(0, 200)}`;
        errEl.style.color = 'rgba(255,120,120,1)';
        errEl.style.fontSize = '0.92em';
        bootLinesEl.appendChild(errEl);
      }
      const container = bootLinesEl.parentElement;
      if (container) container.scrollTop = container.scrollHeight;
    } else {
      // Not yet created: save as pending to apply when typed
      pendingSWUpdate = { success, message: msg, extraError };
    }
  }

  requestAnimationFrame(() => setTimeout(run, 40));

  // fail-safe: force exit loader if something hangs
  setTimeout(() => {
    if (document.getElementById('loading-screen')) exitLoader();
  }, TOTAL_MS + failsafeExtra);

  // expose updateServiceWorkerStatus globally for SW registration block below
  window._updateServiceWorkerStatus = updateServiceWorkerStatus;

})(); // end boot loader IIFE


// ============================
// 📡 SERVICE WORKER REGISTRATION (dengan notifikasi ke boot screen)
// ============================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(async reg => {
      // === STATUS BOOT UI MILIKMU — tetap utuh ===
      if (window._updateServiceWorkerStatus) {
        window._updateServiceWorkerStatus(true, "Service worker online.");
      } else {
        console.log('%c[ServiceWorker] Registered ✅', 'color:#10a37f');
      }

      // === JIKA SW BARU SUDAH WAITING (misalnya reload kedua) ===
      if (reg.waiting) {
        showUpdateBanner(reg);
      }

      // === DETEKSI SAAT ADA SW BARU INSTALL ===
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            // SW baru menunggu — tampilkan banner
            showUpdateBanner(reg);
          }
        });
      });

      // Terima pesan dari sw.js (opsional)
      navigator.serviceWorker.addEventListener('message', event => {
        const msg = event.data;
        if (msg?.type === 'NEW_VERSION_WAITING') {
          showUpdateBanner(reg, msg.version);
        }
      });

      // === Saat SW baru aktif (setelah user klik Update) → reload halaman ===
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!window.__swReloading) {
          window.__swReloading = true;
          window.location.reload();
        }
      });

    })
    .catch(err => {
      // === BOOT UI ERROR MILIKMU — tetap utuh ===
      const shortMsg = "Service worker failed to register.";
      if (window._updateServiceWorkerStatus) {
        window._updateServiceWorkerStatus(false, shortMsg, err);
      } else {
        console.error('[ServiceWorker] Failed:', err);
      }
    });
} else {
  if (window._updateServiceWorkerStatus) {
    window._updateServiceWorkerStatus(false, "Service worker unsupported in this browser.");
  } else {
    console.warn('[ServiceWorker] Unsupported in this environment');
  }
}

// ==============================
// BANNER LOGIC — MODE B
// ==============================
function showUpdateBanner(reg, version) {
  if (document.getElementById('sw-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.innerHTML = `
    <div class="sw-banner-inner">
      <div class="sw-banner-text">Versi baru tersedia${version ? ' — ' + version : ''}.</div>
      <div class="sw-banner-actions">
        <button id="sw-update-btn" class="sw-btn">Update</button>
        <button id="sw-dismiss-btn" class="sw-btn sw-btn--ghost">Tutup</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('sw-update-btn').onclick = () => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    banner.querySelector('.sw-banner-text').textContent = 'Menerapkan pembaruan…';
  };

  document.getElementById('sw-dismiss-btn').onclick = () => banner.remove();
}
