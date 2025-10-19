/*
 Terminal Boot loader (fast techy) — total duration fixed to 3400ms (3.4s)
 - Many lines will appear quickly (type-like feel).
 - After finished, shows Ready. and pauses 1 second.
 - Then flashes [ DUTA AI ], fades out, and reveals chat.
*/

(function terminalBootFixed() {
  const TOTAL_MS = 2400; // typing still 2.4s, extra 1s added after Ready
  const finalPause = 220; // fade delay (ms)
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

  const usableMs = TOTAL_MS - finalPause;
  const lengths = LINES.map(l => Math.min(1 + l.length, 120));
  const totalLen = lengths.reduce((s,n)=>s+n,0);
  const slots = lengths.map(len => Math.max(20, Math.floor((len/totalLen) * usableMs)));

  let sumSlots = slots.reduce((s,n)=>s+n,0);
  let diff = usableMs - sumSlots;
  let idx = 0;
  while (diff !== 0) {
    if (diff > 0) { slots[idx % slots.length]++; diff--; }
    else { if (slots[idx % slots.length] > 20) { slots[idx % slots.length]--; diff++; } }
    idx++;
    if (idx > 10000) break;
  }

  const caret = document.createElement('span');
  caret.className = 'caret';

  function typeLine(text, slotMs) {
    return new Promise(resolve => {
      const lineEl = document.createElement('div');
      lineEl.setAttribute('role','listitem');
      bootLinesEl.appendChild(lineEl);

      const minCharDelay = 8;
      const maxCharDelay = 22;
      const totalChars = Math.max(1, text.length);
      let base = Math.max(minCharDelay, Math.floor(slotMs / (totalChars + 1)));
      base = Math.min(base, maxCharDelay);

      let i = 0;
      function step() {
        const batch = (slotMs < 140) ? 3 : 4;
        for (let b=0;b<batch && i<text.length;b++) {
          lineEl.textContent += text[i++];
        }
        bootLinesEl.parentElement.scrollTop = bootLinesEl.parentElement.scrollHeight;
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
      lineEl.appendChild(caret);
      step();
    });
  }

  async function run() {
    bootLinesEl.innerHTML = '';
    bootLinesEl.parentElement.scrollTop = 0;

    for (let i=0;i<LINES.length;i++) {
      const txt = LINES[i];
      const slot = slots[i] || Math.floor(usableMs / LINES.length);
      await typeLine(txt, slot);
      await new Promise(r => setTimeout(r, 8));
    }

    bootReady.style.opacity = '1';
    bootReady.style.transform = 'translateY(0) scale(1)';
    dutaLabel.style.color = 'rgba(0,255,153,1)';
    dutaLabel.style.transform = 'scale(1.03)';
    setTimeout(()=> {
      dutaLabel.style.transform = '';
    }, 160);

    // ✅ 1 SECOND PAUSE AFTER "READY."
    setTimeout(() => exitLoader(), finalPause + 1000);
  }

  function exitLoader() {
    if (!bootScreen) return finishNow();

    bootScreen.classList.add('loader-exit');
    setTimeout(() => {
      try { bootScreen.remove(); } catch(e){}
      finishNow();
    }, 460);
  }

  function finishNow() {
    if (chatEl) {
      chatEl.style.display = 'block';
      chatEl.style.opacity = '0';
      chatEl.animate([{opacity:0},{opacity:1}], {duration:280, easing:'ease-in-out', fill:'forwards'});
    }
  }

  requestAnimationFrame(() => {
    setTimeout(run, 40);
  });

  setTimeout(() => {
    if (document.getElementById('loading-screen')) exitLoader();
  }, TOTAL_MS + 1600);

})();
