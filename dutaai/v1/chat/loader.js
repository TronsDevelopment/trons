/*
 Terminal Boot Loader (tricky load version)
 - Total duration: 3.4s (2.4s typing + 1s pause)
 - Line 1 slower (600ms)
 - 2 random lines slower (200–350ms)
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

  // recalc remaining time to keep total constant
  const used = slots.reduce((s, n) => s + n, 0);
  const diff = usableMs - used;
  if (Math.abs(diff) > 0) {
    const factor = (usableMs - slots[0] - slots[slowIndices[0]] - slots[slowIndices[1]]) /
                   (usableMs - (slots[0] + slots[slowIndices[0]] + slots[slowIndices[1]] + diff));
    for (let i = 0; i < slots.length; i++) {
      if (i !== 0 && !slowIndices.includes(i) && i !== LINES.length - 1) {
        slots[i] = Math.max(20, Math.floor(slots[i] * factor));
      }
    }
  }

  // --- typing logic ---
  function typeLine(text, slotMs) {
    return new Promise(resolve => {
      const lineEl = document.createElement('div');
      lineEl.setAttribute('role', 'listitem');
      bootLinesEl.appendChild(lineEl);

      const caret = document.createElement('span');
      caret.className = 'caret';
      lineEl.appendChild(caret);

      const minCharDelay = 8;
      const maxCharDelay = 22;
      const totalChars = Math.max(1, text.length);
      let base = Math.max(minCharDelay, Math.floor(slotMs / (totalChars + 1)));
      base = Math.min(base, maxCharDelay);

      let i = 0;
      function step() {
        const batch = (slotMs < 140) ? 5 : 3;
        for (let b = 0; b < batch && i < text.length; b++) {
          lineEl.textContent += text[i++];
        }
        const container = bootLinesEl.parentElement;
        container.scrollTop = container.scrollHeight;

        if (i < text.length) {
          const jitter = Math.random() * (base * 0.6);
          setTimeout(step, base + jitter);
        } else {
          if (text.trim().toLowerCase() === 'ready.') {
            lineEl.style.color = "rgba(0,255,153,1)";
            lineEl.style.fontWeight = 700;
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
      await typeLine(txt, slot);
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

  requestAnimationFrame(() => setTimeout(run, 40));

  // fail-safe
  setTimeout(() => {
    if (document.getElementById('loading-screen')) exitLoader();
  }, TOTAL_MS + failsafeExtra);

})();
