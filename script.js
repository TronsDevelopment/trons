// Modern interaction: filter, search, reveal, tilt, modal, theme toggle
(function(){
  const root = document.documentElement;
  const cardsGrid = document.getElementById('cardsGrid');
  const filters = document.querySelectorAll('.filter');
  const searchInput = document.getElementById('searchInput');
  const cards = Array.from(document.querySelectorAll('.card'));
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');
  const modalClose = document.querySelector('.modal-close');
  const themeToggle = document.getElementById('themeToggle');

  // IntersectionObserver for reveal
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) entry.target.classList.add('revealed');
    });
  }, {threshold: 0.12});
  cards.forEach(c => obs.observe(c));

  // Filter logic
  function applyFilter(filter){
    filters.forEach(b => b.classList.toggle('active', b.dataset.filter===filter));
    cards.forEach(card=>{
      const cat = card.dataset.category;
      const matches = (filter === 'all') || (cat === filter);
      card.style.display = matches ? '' : 'none';
    });
  }
  filters.forEach(btn=> btn.addEventListener('click', ()=> applyFilter(btn.dataset.filter)));

  // Search logic (title + desc)
  searchInput.addEventListener('input', (e)=>{
    const q = e.target.value.trim().toLowerCase();
    cards.forEach(card=>{
      const title = (card.dataset.title || card.querySelector('.card-title')?.innerText || '').toLowerCase();
      const desc = (card.querySelector('.card-desc')?.innerText || '').toLowerCase();
      const visible = title.includes(q) || desc.includes(q);
      card.style.display = visible ? '' : 'none';
    });
  });

  // Card tilt microinteraction
  function attachTilt(card){
    card.addEventListener('mousemove', (ev)=>{
      const rect = card.getBoundingClientRect();
      const px = (ev.clientX - rect.left) / rect.width;
      const py = (ev.clientY - rect.top) / rect.height;
      const rx = (py - 0.5) * -8;
      const ry = (px - 0.5) * 10;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    });
    card.addEventListener('mouseleave', ()=>{
      card.style.transform = '';
    });
  }
  cards.forEach(attachTilt);

  // Modal open (Try / Details)
  cardsGrid.addEventListener('click', (e)=>{
    const tryBtn = e.target.closest('.try-btn');
    const detailsBtn = e.target.closest('.details-btn');
    if(!tryBtn && !detailsBtn) return;
    const card = e.target.closest('.card');
    if(!card) return;
    openModal(card, !!tryBtn);
  });

  // Also support keyboard Enter on focused card to open Try
  cards.forEach(card=>{
    card.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' '){
        openModal(card, true);
        e.preventDefault();
      }
    });
  });

  function openModal(card, isTry){
    const title = card.querySelector('.card-title')?.innerText || card.dataset.title || 'Tool';
    const desc = card.querySelector('.card-desc')?.innerText || '';
    modalContent.innerHTML = `
      <h3 style="margin:0 0 .6rem">${title} ${isTry ? '<span style="font-weight:600;color:var(--accent)">• Try</span>':''}</h3>
      <p style="margin:0 0 1rem; color:var(--muted)">${desc}</p>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn btn-primary" id="modalAction">Open Demo</button>
        <button class="btn ghost" id="modalAlt">Open Details</button>
      </div>
    `;
    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'grid';
    // focus management
    setTimeout(()=> modal.querySelector('.modal-panel')?.focus(), 120);
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e)=> { if(e.key==='Escape') closeModal(); });

  function closeModal(){
    modal.setAttribute('aria-hidden','true');
    setTimeout(()=> { modal.style.display='none'; modalContent.innerHTML=''; }, 200);
  }

  // theme toggle
  const currentTheme = localStorage.getItem('tronsar_theme') || 'dark';
  if(currentTheme === 'light') document.documentElement.setAttribute('data-theme','light');
  themeToggle.addEventListener('click', ()=>{
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if(isLight){
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('tronsar_theme','dark');
      themeToggle.setAttribute('aria-pressed','false');
    } else {
      document.documentElement.setAttribute('data-theme','light');
      localStorage.setItem('tronsar_theme','light');
      themeToggle.setAttribute('aria-pressed','true');
    }
  });

  // quick demo peek from hero
  document.getElementById('demoPeek').addEventListener('click', ()=> {
    const first = cards.find(c => c.style.display !== 'none');
    if(first) openModal(first, true);
  });

})();
