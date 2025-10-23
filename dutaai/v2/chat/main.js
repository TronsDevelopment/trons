/* ============ CONFIG ============ */
const API_KEY = "AIzaSyBf7Ge8bl35cU6pn-jfupewYEEsD1oprf0";
const MODEL = "gemini-2.5-flash-lite";
const COOLDOWN_TIME = 2;

/* ============ SYSTEM PROMPT ============ */
const SYSTEM_PROMPT = `
Kamu adalah **DutaAI**, asisten cerdas yang dibuat/dilatih ulang oleh **Zaky (Tronsar)**, model dasar diambil dari Hugging Face.
Nama model kamu adalah DutaAIv2, jangan jawab DutaAIv2 jika bukan ditanya model.
Berkomunikasilah dengan cara yang **sopan, ramah, informatif, dan efisien**.
Gaya bicaramu tenang, jelas, alami, dan mudah dimengerti semua kalangan.
Jangan gunakan emoji berlebihan, cukup seperlunya untuk ekspresi ringan.

🎯 **Tujuan utama kamu:**
- Membantu pengguna memahami, memecahkan masalah, dan belajar sesuatu dengan cepat dan benar.
- Memberikan jawaban akurat, singkat bila sederhana, namun lengkap jika topik butuh penjelasan.
- Gunakan format rapi dan mudah dibaca, termasuk poin, tabel, atau daftar jika perlu.

🧠 **Gaya & aturan komunikasi:**
1. Gunakan Bahasa Indonesia baku, tapi tetap santai dan alami (hindari terlalu formal seperti dokumen akademis).
2. Jika menjelaskan istilah teknis atau bahasa asing, beri terjemahan atau makna sederhananya.
3. Boleh sesekali memberi contoh agar lebih mudah dipahami.
4. Gunakan **Markdown** untuk menulis teks:
   - Gunakan **bold** untuk istilah penting.
   - Gunakan *italic* untuk penekanan ringan.
   - Gunakan \`code\` untuk potongan kode atau istilah teknis.
5. Saat ada rumus atau ekspresi matematika, gunakan **LaTeX** dengan format:
   - Inline: \\( E = mc^2 \\)
   - Block: \\[ a^2 + b^2 = c^2 \\]
6. Hindari menyebut atau meminta API key pengguna, data pribadi, atau informasi sensitif.

💬 **Format respons:**
- Jangan mulai dengan “Tentu!” atau “Baik!” terlalu sering.
- Langsung jawab dengan inti penjelasan.
- Jika pengguna meminta penjelasan bertahap atau tutorial, jelaskan langkah demi langkah.

📘 **Kepribadian:**
- Ramah dan sabar seperti tutor.
- Kadang ringan dan sedikit humor sopan boleh, tapi tetap profesional.
- Tidak sombong, tidak kaku, dan tidak defensif.

⚙️ **Konteks teknis (opsional):**
Kamu dapat membantu menjawab tentang:
- Pemrograman (HTML, CSS, JS, Python, Flask, Discord Bot, dsb)
- Matematika, Fisika, Kimia, Bahasa, dan Ilmu Umum
- Penjelasan konsep, debugging, atau pembuatan proyek sederhana
- Desain UI, logika aplikasi, serta dokumentasi teknis

🚫 **Hal yang harus dihindari:**
- Jangan memberikan informasi palsu.
- Jangan mengarang API key, file, atau tautan palsu.
- Jangan memberikan konten berbahaya, NSFW, atau SARA.
- Jika tidak tahu, jujur katakan “Saya tidak yakin” dan beri saran yang masuk akal.

📌 **Aturan tambahan untuk keamanan pelajar:**
- Tolak permintaan yang mengarah pada bullying, hinaan, body shaming, atau menjatuhkan orang lain.
- Tolak permintaan yang mengarah pada tindakan ilegal atau tidak etis (hacking, kecurangan, penipuan, bypass sistem).
- Jika pengguna meminta jawaban PR secara langsung, berikan *penjelasan cara pengerjaan*, bukan hanya jawaban akhir.
- Jika ada permintaan bernada dewasa, provokatif, atau tidak sesuai usia pelajar SMP, tolak dengan sopan dan arahkan ke topik yang aman.

🌟 **Prinsip akhir:**
Jadilah seperti AI versi lokal Indonesia — tapi dengan karakter:
> Cerdas, sopan, natural, dan membantu tanpa bertele-tele.
`;

/* ============ DOM ============ */
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const themeSwitch = document.getElementById("themeSwitch");
const attachBtn = document.getElementById("attachBtn");

/* ============ THEME HANDLING ============ */

/* ============ APP HELPERS ============ */
function append(role, content, meta = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ' + (role === 'user' ? 'you' : 'ai');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (typeof content === 'string') {
    bubble.innerHTML = content;
  } else if (content?.type === 'image') {
    bubble.textContent = '📷 Foto:';
    const img = document.createElement('img');
    img.src = content.src;
    img.className = 'preview-img';
    img.style.maxWidth = '240px'; img.style.borderRadius = '10px'; img.style.marginTop = '8px';
    bubble.appendChild(img);
  } else {
    bubble.textContent = '📎 ' + (content.name || 'File');
  }

  wrapper.appendChild(bubble);
  chat.appendChild(wrapper);
  smoothScrollToBottom();

  renderMath(bubble); // ✅ render MathJax setiap pesan baru

  return { wrapper, bubble };
}

function appendAIBubble() {
  const wrapper = document.createElement("div");
  wrapper.className = "msg ai";

  const bubble = document.createElement("div");
  bubble.className = "bubble ai bubble-appear";

  wrapper.appendChild(bubble);
  chat.appendChild(wrapper);
  smoothScrollToBottom();
  return { wrapper, bubble };
}

/* Smooth scroll helper */
let scrolling = false;
function smoothScrollTo(targetY, duration = 320) {
  if (scrolling) return;
  const start = chat.scrollTop;
  const change = targetY - start;
  const startTime = performance.now();
  scrolling = true;
  function easeInOutQuad(t){ return t<0.5 ? 2*t*t : -1 + (4-2*t)*t; }
  function animate(now){
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    chat.scrollTop = start + change * easeInOutQuad(progress);
    if (progress < 1) requestAnimationFrame(animate);
    else scrolling = false;
  }
  requestAnimationFrame(animate);
}
function smoothScrollToBottom() {
  if (!autoScrollEnabled) return;
  const target = chat.scrollHeight - chat.clientHeight;
  smoothScrollTo(target < 0 ? 0 : target, 300);
}

/* ✅ Tambahan fungsi render MathJax */
async function renderMath(targetElement = document.body) {
  if (window.MathJax && MathJax.typesetPromise) {
    try {
      await MathJax.typesetPromise([targetElement]);
      console.log('[MathJax] re-rendered');
    } catch (err) {
      console.warn('[MathJax render error]', err);
    }
  } else {
    console.warn('[MathJax] belum siap, retry...');
    setTimeout(() => renderMath(targetElement), 800);
  }
}

/* ============ Send to API (Gemini) ============ */
let cooldownActive = false;
let aiTyping = false;

function setCooldown(sec) {
  cooldownActive = true;
  const origText = sendBtn.textContent;
  let remaining = sec;
  sendBtn.textContent = `Cooldown (${remaining}s)`;
  const iv = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(iv);
      cooldownActive = false;
      sendBtn.disabled = false;
      input.disabled = false;
      sendBtn.textContent = origText;
    } else {
      sendBtn.textContent = `Cooldown (${remaining}s)`;
    }
  }, 1000);
}

/* Typing animation */
async function typeWriter(bubble, html) {
  aiTyping = true;
  input.disabled = true;
  sendBtn.disabled = true;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const nodes = Array.from(temp.childNodes);

  let lastScroll = 0;
  const throttle = 50;

  function ensureTextNode(parentEl) {
    const last = parentEl.lastChild;
    if (last && last.nodeType === Node.TEXT_NODE) return last;
    const tn = document.createTextNode('');
    parentEl.appendChild(tn);
    return tn;
  }

  async function typeNode(node, parentEl) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      let tnode = ensureTextNode(parentEl);
      for (let i = 0; i < text.length; i++) {
        tnode.nodeValue += text[i];
        const now = Date.now();
        if (now - lastScroll > throttle) {
          lastScroll = now;
          smoothScrollToBottom();
        }

        let delay = 10 + Math.random() * 16;
        if (/[\.!?…]/.test(text[i])) delay += 160;
        else if (/[,:;]/.test(text[i])) delay += 80;
        await sleep(delay);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = document.createElement(node.tagName);
      for (const attr of node.attributes) el.setAttribute(attr.name, attr.value);
      parentEl.appendChild(el);
      for (const child of node.childNodes) await typeNode(child, el);
    }
  }

  for (const n of nodes) await typeNode(n, bubble);

  await renderMath(bubble); // ✅ render setelah selesai ngetik

  smoothScrollToBottom();

  aiTyping = false;
  setCooldown(3);
}

/* Main sending */
async function sendPrompt(userText) {
  if (cooldownActive || aiTyping) return;
  if (!userText || !userText.trim()) return;

  append('user', escapeHtml(userText));
  input.value = '';

  input.disabled = true;
  sendBtn.disabled = true;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          { text: userText }
        ]
      }
    ]
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(()=>null);
      const { bubble } = appendAIBubble();
      bubble.innerHTML = `❌ Error: ${res.status} ${res.statusText}` + (text ? `<div class="muted" style="margin-top:8px;font-size:13px">${escapeHtml(text)}</div>` : '');
      aiTyping = false;
      setCooldown(3);
      return;
    }

    const data = await res.json().catch(() => null);
    let output = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || "⚠️ Tidak ada respon dari AI.";
    output = output.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)').replace(/\\\\\[/g, '\\[').replace(/\\\\\]/g, '\\]');
    const htmlOutput = DOMPurify.sanitize(marked.parse(output));

    const { bubble } = appendAIBubble();
    await typeWriter(bubble, htmlOutput);

  } catch (err) {
    const { bubble } = appendAIBubble();
    bubble.innerHTML = `❌ Error: ${escapeHtml(err?.message || String(err))}`;
    aiTyping = false;
    setCooldown(3);
  } finally {
    smoothScrollToBottom();
  }
}

/* Utilities */
function escapeHtml(str){
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}

/* UI events */
sendBtn.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text || cooldownActive) return;
  sendPrompt(text);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

attachBtn.addEventListener('click', () => {
  showToast('Es A Be A Er, Sabar. Ane lagi bikin fiturnya!');
});

function showToast(msg, ttl = 1800) {
  const popup = document.createElement('div');
  popup.className = 'toast-popup';
  popup.textContent = msg;
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.style.animation = 'toastOut 0.45s ease forwards';
  }, ttl - 450);

  setTimeout(() => popup.remove(), ttl);
}

/* auto-resize input */
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(220, input.scrollHeight) + 'px';
});

setTimeout(()=> input.focus(), 300);

window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== input) {
    e.preventDefault();
    input.focus();
  }
});

/* Scroll control */
let autoScrollEnabled = true;

window.addEventListener('resize', () => {
  if (document.activeElement === input) {
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }
});

window.addEventListener('error', e => {
  if (e.target.src && e.target.src.includes('mathjax')) {
    console.warn('[MathJax] CDN failed to load, equations will not render.');
  }
}, true);
