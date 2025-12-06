/* ============ CONFIG ============ */
const WORKER_URL = "https://dutax.esrjoo841.workers.dev";  
const MODEL = "gemini-2.5-flash-lite";
const COOLDOWN_TIME = 2;

/* ============ SYSTEM PROMPT ============ */
import { SYSTEM_PROMPT } from './systemprompt.js';
console.log("System Prompt Loaded:", SYSTEM_PROMPT?.slice(0, 120) + "...");

/* ============ DOM ============ */
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const themeToggle = document.getElementById("themeToggle");
const attachBtn = document.getElementById("attachBtn");

const CLIENT_TOKEN = "clt_tronsar_9fN72QpLmA48";
const ACCESS_PASSWORD = "trnsr-pass-94n7k";

/* ============ HELPERS (external lookups kept) ============ */
async function fetchWeather(lat, lon, timezone = 'Asia/Jakarta') {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('hourly', 'temperature_2m,precipitation,weathercode');
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('forecast_days', '3');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`OpenMeteo ${res.status}`);
  return res.json();
}

async function searchWikipedia(query, lang = "id") {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();
  if (!searchData.query?.search?.length) {
    if (lang === "id") return await searchWikipedia(query, "en");
    return "Tidak ditemukan hasil di Wikipedia.";
  }
  const pageTitle = searchData.query.search[0].title;
  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const summaryResponse = await fetch(summaryUrl);
  if (!summaryResponse.ok) {
    if (lang === "id") return await searchWikipedia(query, "en");
    return "Tidak ditemukan hasil di Wikipedia.";
  }
  const summaryData = await summaryResponse.json();
  return summaryData.extract || "Tidak ada ringkasan yang tersedia.";
}

async function fetchWikidataInfo(query) {
  if (!query) return null;
  const sparql = `
    SELECT ?item ?itemLabel ?itemDescription WHERE {
      ?item rdfs:label "${query}"@id.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "id,en". }
    } LIMIT 5
  `;
  try {
    const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);
    const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' }});
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    const data = await res.json();
    const results = data?.results?.bindings || [];
    if (results.length) {
      return results.map(r => ({ label: r.itemLabel?.value, desc: r.itemDescription?.value || "(tidak ada deskripsi)" }));
    }
  } catch (err) {
    console.warn('[Wikidata] Query gagal:', err);
  }
  return null;
}

/* ============ UI helpers ============ */
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

  if (role === 'user' || role === 'ai') {
    updateSessionMemory(role, typeof content === 'string' ? content : JSON.stringify(content));
  }

  wrapper.appendChild(bubble);
  chat.appendChild(wrapper);
  smoothScrollToBottom();
  renderMath(bubble);
  return { wrapper, bubble };
}

let sessionMemory = [];
if (sessionStorage.getItem("dutaMemory")) {
  try {
    sessionMemory = JSON.parse(sessionStorage.getItem("dutaMemory"));
    sessionMemory.forEach(msg => append(msg.role, escapeHtml(msg.content)));
  } catch {
    sessionMemory = [];
  }
}

function updateSessionMemory(role, content) {
  sessionMemory.push({ role, content });
  sessionStorage.setItem("dutaMemory", JSON.stringify(sessionMemory));
}

/* image handling */
let pendingImage = null;
let pendingImageURL = null;
const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = 'image/*';
imageInput.style.display = 'none';
imageInput.id = 'imageInput';
document.body.appendChild(imageInput);

attachBtn.addEventListener('click', (e) => { e.preventDefault(); imageInput.click(); });
imageInput.addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  handleSelectedImage(file);
  imageInput.value = '';
});

chat.addEventListener('dragover', (e) => { e.preventDefault(); chat.classList.add('drag-over'); });
chat.addEventListener('dragleave', (e) => { chat.classList.remove('drag-over'); });
chat.addEventListener('drop', (e) => {
  e.preventDefault();
  chat.classList.remove('drag-over');
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) {
    const file = dt.files[0];
    if (file.type && file.type.startsWith('image/')) handleSelectedImage(file);
    else showToast('Hanya file gambar yang diterima.');
  }
});

function handleSelectedImage(file) {
  const MAX_MB = 7;
  if (file.size > MAX_MB * 1024 * 1024) {
    showToast(`Gambar terlalu besar. Maksimal ${MAX_MB} MB.`);
    return;
  }
  if (pendingImageURL) URL.revokeObjectURL(pendingImageURL);
  pendingImage = file;
  pendingImageURL = URL.createObjectURL(file);
  append('user', { type: 'image', src: pendingImageURL, name: file.name });
  input.focus();
}

/* UI niceties */
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

let autoScrollEnabled = true;
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

/* Math rendering (kept) */
function renderMath(el) {
  const now = new Date().toLocaleTimeString();
  const log = (msg, style = "color:#00b894;font-weight:bold") => {
    console.log(`%c[renderMath @${now}]`, style, msg);
  };
  if (window.MathJax && window.MathJax.typesetPromise) {
    const target = el ? [el] : undefined;
    const latexElements = el ? el.querySelectorAll("script[type='math/tex'], .MathJax, .mathjax-block")
                             : document.querySelectorAll(".MathJax, .mathjax-block");
    log("🚀 Starting MathJax render...");
    window.MathJax.typesetPromise(target)
      .then(() => log("✅ Render complete.", "color:#00cec9;font-weight:bold"))
      .catch(err => log("💥 Error during render: " + err, "color:#e17055;font-weight:bold"));
  } else {
    // retry later
    setTimeout(() => renderMath(el), 500);
  }
}

/* ============ SEND TO WORKER (proxy) ============ */
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

/* typing animation */
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
  await renderMath(bubble);
  smoothScrollToBottom();
  aiTyping = false;
  setCooldown(3);
}

/* Build reasoning & memory (kept) */
function buildReasoningContext(userText, memory) {
  const topic = userText.toLowerCase();
  const lastTopics = memory.slice(-5).map(m => m.content).join(" ");
  const intent = /\b(cara|apa|kenapa|bagaimana|siapa|bisa|buat)\b/.test(topic) ? "question" : "statement";
  const mood = /\b(marah|kesal|cape|bete|sedih)\b/.test(topic) ? "negative" :
               /\b(terima kasih|thanks|keren|hebat|bagus)\b/.test(topic) ? "positive" : "neutral";
  const domain = /\b(python|js|html|api|discord)\b/.test(topic) ? "tech" :
                 /\b(sejarah|perang|presiden|negara)\b/.test(topic) ? "history" :
                 /\b(matematika|rumus|fisika|kimia)\b/.test(topic) ? "science" : "general";
  return `🧠 Intent: ${intent}\nMood: ${mood}\nDomain: ${domain}\nContextPreview: "${lastTopics.slice(0,120)}"`;
}
function summarizeMemory(memory) {
  const recent = memory.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n");
  return `Ringkasan percakapan:\n${recent}`;
}

/* fileToBase64 helper */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => { reader.abort(); reject(new Error('File reading failed')); };
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/* Main sendPrompt - NOTE: sends to WORKER_URL (Cloudflare Worker) */
async function sendPrompt(userText) {
  if (cooldownActive || aiTyping) return;
  const inputEl = document.getElementById("input");
  const sendBtnEl = document.getElementById("send");
  if (!userText || !userText.trim()) {
    if (pendingImage) {
      const { bubble } = appendAIBubble();
      bubble.innerHTML = `📸 Gambar diterima! Mau aku bantu analisa apa nih?`;
      smoothScrollToBottom();
      setCooldown(COOLDOWN_TIME || 2);
      return;
    }
    return;
  }

  append("user", escapeHtml(userText));
  inputEl.value = "";
  inputEl.disabled = true;
  sendBtnEl.disabled = true;
  aiTyping = true;

  const lower = userText.toLowerCase();
  const externalParts = [];

  try {
    const wantsWeather = /\b(cuaca|ramalan|suhu|dingin|panas|hujan)\b/i.test(lower);
    if (wantsWeather) {
      try {
        const weatherData = await fetchWeather(-6.2, 106.8);
        const temps = weatherData?.hourly?.temperature_2m?.slice(0, 3) || [];
        externalParts.push({ text: `Cuaca Jakarta: ${temps.join("°C, ")}°C (3 jam ke depan)` });
      } catch (err) { console.warn("[Cuaca] gagal:", err); }
    }

    const wantsSearch = /\b(cara|apa itu|fungsi|contoh|daftar|pengertian|arti|tentang|mengapa|bagaimana|tips|siapa)\b/i.test(lower);
    if (wantsSearch) {
      const title = userText.replace(/\b(apa itu|tentang|mengenai|siapa|info tentang)\b/gi, "").trim();
      const wikiSummary = await searchWikipedia(title);
      if (wikiSummary && typeof wikiSummary === "string" && !wikiSummary.startsWith("Tidak ditemukan")) {
        externalParts.push({ text: `Wikipedia: ${wikiSummary}` });
      } else {
        const wd = await fetchWikidataInfo(title);
        if (wd?.length) {
          externalParts.push({ text: `Wikidata: ` + wd.map(i => `- ${i.label}: ${i.desc}`).join("\n") });
        } else {
          externalParts.push({ text: `Tidak ditemukan data di Wikipedia/Wikidata.` });
        }
      }
    }

    const now = new Date();
    const localTime = now.toLocaleString("id-ID", { weekday:"long", year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit", timeZone:"Asia/Jakarta" });
    externalParts.push({ text: `Waktu (Asia/Jakarta): ${localTime}` });

    // load sessionMemory from sessionStorage again to be safe
    let mem = JSON.parse(sessionStorage.getItem("dutaMemory") || "[]");
    if (mem.length > 20) mem = mem.slice(-20);

    const reasoningContext = buildReasoningContext(userText, mem);
    const memorySummary = summarizeMemory(mem);

    // build parts for current user message (image optional)
    const userParts = [
      { text: reasoningContext },
      { text: memorySummary },
      ...externalParts.map(p => ({ text: p.text }))
    ];

    if (pendingImage) {
      try {
        const base64 = await fileToBase64(pendingImage);
        const pureBase64 = base64.replace(/^data:[^;]+;base64,/, "");
        userParts.push({
          inline_data: {
            mime_type: pendingImage.type || "image/jpeg",
            data: pureBase64
          }
        });
      } catch (err) {
        const { bubble } = appendAIBubble();
        bubble.innerHTML = `❌ Gagal memproses gambar: ${escapeHtml(err.message)}`;
        aiTyping = false;
        inputEl.disabled = false;
        sendBtnEl.disabled = false;
        setCooldown(COOLDOWN_TIME || 2);
        return;
      }
    }

    // finally add the user's actual text
    userParts.push({ text: userText });

    // assemble contents following Gemini's expected structure:
    const contents = [
      // kalau butuh system prompt, kirim sebagai user message (atau hapus jika worker punya cara lain)
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },

      // map session memory -> user/model
      ...mem.map(m => ({
        role: m.role === "ai" ? "model" : "user",  // ai -> model, user -> user
        parts: [{ text: m.content }]
      })),

      // current user message (dengan externalParts, reasoning, image, dll)
      { role: "user", parts: userParts }
    ];

    const body = { contents };

    // send to Cloudflare Worker proxy
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Token": CLIENT_TOKEN,
        "X-Access-Password": ACCESS_PASSWORD
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      const { bubble } = appendAIBubble();
      bubble.innerHTML = `❌ Error: ${res.status} ${res.statusText}` + (text ? `<div class="muted">${escapeHtml(text)}</div>` : "");
      aiTyping = false;
      setCooldown(COOLDOWN_TIME || 2);
      return;
    }

    const data = await res.json().catch(() => null);
    // try to extract model output robustly
    let output =
      Array.isArray(data?.candidates) ? data.candidates[0]?.content?.parts?.map(p => p.text).join("") :
      data?.output?.[0]?.content?.parts?.map(p => p.text).join("") ||
      JSON.stringify(data);

    if (typeof output !== "string") output = String(output);

    output = output
      .replace(/\\\\\(/g, "\\(")
      .replace(/\\\\\)/g, "\\)")
      .replace(/\\\\\[/g, "\\[")
      .replace(/\\\\\]/g, "\\]");

    const htmlOutput = (window.DOMPurify && window.marked) ? DOMPurify.sanitize(marked.parse(output)) : escapeHtml(output);

    if (window.DOMPurify && window.DOMPurify.addHook) {
      DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
        if (data.value.includes("\\(") || data.value.includes("\\[")) {
          data.keepAttr = true;
        }
      });
    }

    const { bubble } = appendAIBubble();
    await typeWriter(bubble, htmlOutput);

    // save to memory
    mem.push({ role: "user", content: userText });
    mem.push({ role: "ai", content: output });
    sessionStorage.setItem("dutaMemory", JSON.stringify(mem));

  } catch (err) {
    const { bubble } = appendAIBubble();
    bubble.innerHTML = `❌ Error: ${escapeHtml(err.message || String(err))}`;
  } finally {
    aiTyping = false;
    inputEl.disabled = false;
    sendBtnEl.disabled = false;
    if (pendingImageURL) { URL.revokeObjectURL(pendingImageURL); pendingImageURL = null; }
    pendingImage = null;
    setCooldown(COOLDOWN_TIME || 2);
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

/* Events */
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});

function showToast(msg, ttl = 1800) {
  const popup = document.createElement('div');
  popup.className = 'toast-popup';
  popup.textContent = msg;
  document.body.appendChild(popup);
  setTimeout(() => { popup.style.animation = 'toastOut 0.45s ease forwards'; }, ttl - 450);
  setTimeout(() => popup.remove(), ttl);
}

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(220, input.scrollHeight) + 'px';
});

setTimeout(()=> input.focus(), 300);

window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
});

window.addEventListener('resize', () => {
  if (document.activeElement === input) {
    setTimeout(() => { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
  }
});

window.addEventListener('error', e => {
  if (e.target.src && e.target.src.includes('mathjax')) {
    console.warn('[MathJax] CDN failed to load, equations will not render.');
  }
}, true);

/* Simple styling tweak */
const style = document.createElement('style');
style.innerHTML = `
  #chat.drag-over { outline: 2px dashed rgba(100,150,255,0.9); background: rgba(240,248,255,0.6); transition: background .15s; }
  .preview-img { max-height: 240px; display:block; }
`;
document.head.appendChild(style);

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
  themeToggle.textContent = '🌞';
}
themeToggle?.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const dark = document.body.classList.contains('dark-mode');
  themeToggle.textContent = dark ? '🌞' : '🌗';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
});

window.addEventListener("scroll", () => {
  if (window.scrollY > 20) document.body.classList.add("scrolled");
  else document.body.classList.remove("scrolled");
});

/* wire send button */
sendBtn.removeEventListener('click', () => {});
sendBtn.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text && !pendingImage) return;
  if (cooldownActive) return;
  sendPrompt(text);
});
