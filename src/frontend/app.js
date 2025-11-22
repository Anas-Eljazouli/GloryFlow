let currentShipmentId = null;
let shipmentsData = [];
let filters = { direction: 'any', modes: [], eta_min: '', eta_max: '', fd_min: '', fd_max: '' };
let currentPage = 'dossiers';

async function fetchJSON(url, options={}){
  const res = await fetch(url, options);
  if(!res.ok){ 
    let txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

function el(html){
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstChild;
}

async function loadShipments(){
  shipmentsData = await fetchJSON('/shipments');
  renderShipments();
}

function renderShipments(filterText=''){
  const tbody = document.querySelector('#shipmentsTable tbody');
  tbody.innerHTML = '';
  const q = filterText.trim().toLowerCase();
  shipmentsData
    .filter(s => !q || `${s.reference} ${s.pol} ${s.pod}`.toLowerCase().includes(q))
    .filter(s => {
      if(filters.direction !== 'any' && s.direction !== filters.direction) return false;
      if(filters.modes && filters.modes.length && s.mode && !filters.modes.includes(s.mode)) return false;
      if(filters.fd_min !== '' && Number.isFinite(+filters.fd_min) && s.free_days != null && s.free_days < +filters.fd_min) return false;
      if(filters.fd_max !== '' && Number.isFinite(+filters.fd_max) && s.free_days != null && s.free_days > +filters.fd_max) return false;
      const eta = s.eta ? new Date(s.eta) : null;
      if(filters.eta_min){
        const min = new Date(filters.eta_min);
        if(eta && eta < min) return false;
      }
      if(filters.eta_max){
        const max = new Date(filters.eta_max);
        if(eta && eta > max) return false;
      }
      return true;
    })
    .forEach(s => {
      const row = el(`<tr data-id="${s.id}">
        <td>${s.id ?? ''}</td>
        <td><strong>${s.reference}</strong></td>
        <td><span class="badge">${s.direction}</span></td>
        <td><span class="route">${s.pol} → ${s.pod}</span></td>
        <td>${s.eta ?? ''}</td>
        <td>${s.free_days ?? ''}</td>
        <td class="actionsRow"></td>
      </tr>`);
      const actions = row.querySelector('.actionsRow');
      const riskBtn = el(`<button class="secondary">Risque</button>`);
      riskBtn.onclick = () => computeRisk(s.id);
      const docsBtn = el(`<button class="secondary">Docs</button>`);
      docsBtn.onclick = () => loadDocs(s.id);
      const contBtn = el(`<button>Ajouter conteneur</button>`);
      contBtn.onclick = () => openContainerModal(s.id);
      actions.append(riskBtn, docsBtn, contBtn);
      tbody.appendChild(row);
    });
  highlightSelected(currentShipmentId);
}

async function computeRisk(id){
  const r = await fetchJSON(`/kpi/demurrage_risk?shipment_id=${id}`);
  currentShipmentId = id;
  document.getElementById('containerShipmentId').value = id;
  navigateToPage('risque');
  document.getElementById('riskContent').innerHTML = `
    <p><strong>Dossier:</strong> ${id}</p>
    <ul>
      <li><strong>Score:</strong> ${r.score}</li>
      <li><strong>Jours restants:</strong> ${r.days_left}</li>
      <li><strong>Complétude docs:</strong> ${Math.round(r.docs_completeness*100)}%</li>
      <li><strong>Message:</strong> ${r.message}</li>
    </ul>`;
  highlightSelected(id);
}

async function loadDocs(id){
  currentShipmentId = id;
  document.getElementById('containerShipmentId').value = id;
  navigateToPage('risque');
  const docs = await fetchJSON(`/documents?shipment_id=${id}`);
  const have = new Set(docs.map(d => d.type));
  const holder = document.getElementById('docsContent');
  holder.innerHTML = '';
  ['BL','Invoice','PackingList'].forEach(type => {
    const has = have.has(type);
    const row = el(`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="width:120px">${type}</span>
      <span class="badge" style="background:${has?'#dcfce7':'#fee2e2'};color:${has?'#166534':'#991b1b'}">${has?'Présent':'Manquant'}</span>
    </div>`);
    if(!has){
      const addBtn = el(`<button>Ajouter</button>`);
      addBtn.onclick = async () => {
        await fetchJSON('/documents', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ shipment_id: id, type })
        });
        await loadDocs(id);
        await computeRisk(id);
      };
      row.appendChild(addBtn);
    }
    holder.appendChild(row);
  });
  highlightSelected(id);
}

function selectShipmentForContainer(id){
  currentShipmentId = id;
  document.getElementById('containerShipmentId').value = id;
  document.getElementById('riskContent').innerHTML = `<p>Dossier sélectionné: <strong>${id}</strong>. Vous pouvez maintenant ajouter un conteneur ISO 6346.</p>`;
  highlightSelected(id);
}

async function addContainer(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.shipment_id = parseInt(payload.shipment_id || currentShipmentId, 10);
  await fetchJSON('/containers', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  alert('Conteneur ajouté.');
  e.target.reset();
}

async function createShipment(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.customer_id = parseInt(payload.customer_id || '2', 10);
  payload.free_days = parseInt(payload.free_days || '7', 10);
  await fetchJSON('/shipments', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  e.target.reset();
  await loadShipments();
  navigateToPage('dossiers');
  alert('Dossier créé avec succès!');
}

async function seedDemo(){
  await fetchJSON('/admin/seed', { method:'POST' });
  await loadShipments();
}

document.getElementById('addContainerForm').addEventListener('submit', addContainer);
document.getElementById('createShipmentForm').addEventListener('submit', createShipment);
document.getElementById('seedBtn').addEventListener('click', seedDemo);
document.getElementById('refreshBtn').addEventListener('click', loadShipments);

// UI Toggles: compact density
const densePrefKey = 'ui.compact';
const filterPrefKey = 'ui.filters';
function applyPrefs(){
  const compact = localStorage.getItem(densePrefKey) === '1';
  const savedFilters = localStorage.getItem(filterPrefKey);
  if(savedFilters){ try { filters = { ...filters, ...JSON.parse(savedFilters) }; } catch {}
  }
  document.body.classList.toggle('compact', compact);
}
const toggleDensityBtn = document.getElementById('toggleDensity');
if(toggleDensityBtn) {
  toggleDensityBtn.addEventListener('click', () => {
    const isCompact = document.body.classList.toggle('compact');
    localStorage.setItem(densePrefKey, isCompact ? '1' : '0');
  });
}

// Search filter
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
searchInput.addEventListener('input', () => {
  renderShipments(searchInput.value);
});
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  renderShipments('');
});

function highlightSelected(id){
  document.querySelectorAll('#shipmentsTable tbody tr').forEach(tr => tr.classList.remove('selected'));
  if(!id) return;
  const tr = document.querySelector(`#shipmentsTable tbody tr[data-id="${id}"]`);
  if(tr){ tr.classList.add('selected'); }
}

applyPrefs();

// Modal logic: Add container
const modal = document.getElementById('containerModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const modalForm = document.getElementById('modalAddContainerForm');
const modalShipmentIdInput = document.getElementById('modalShipmentId');

function openContainerModal(shipmentId){
  currentShipmentId = shipmentId;
  modalShipmentIdInput.value = shipmentId;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.getElementById('modalCode').focus();
}
function closeContainerModal(){
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

modal.addEventListener('click', (e) => {
  if(e.target.hasAttribute('data-close')) closeContainerModal();
});
closeModalBtn.addEventListener('click', closeContainerModal);
cancelModalBtn.addEventListener('click', closeContainerModal);
window.addEventListener('keydown', (e) => { if(e.key === 'Escape' && modal.classList.contains('open')) closeContainerModal(); });

modalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(modalForm);
  const payload = Object.fromEntries(fd.entries());
  payload.shipment_id = parseInt(payload.shipment_id || currentShipmentId, 10);
  await fetchJSON('/containers', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  closeContainerModal();
  alert('Conteneur ajouté.');
  await loadShipments();
  highlightSelected(payload.shipment_id);
});

// Filters drawer logic
const drawer = document.getElementById('filtersDrawer');
const toggleFiltersBtn = document.getElementById('toggleFilters');
const closeFiltersBtn = document.getElementById('closeFiltersBtn');
const filtersForm = document.getElementById('filtersForm');
const clearFiltersBtn = document.getElementById('clearFilters');

function openFilters(){ drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false'); syncFiltersToForm(); }
function closeFilters(){ drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
function saveFilters(){ localStorage.setItem(filterPrefKey, JSON.stringify(filters)); }

function syncFiltersToForm(){
  if(!filtersForm) return;
  filtersForm.direction.value = filters.direction || 'any';
  [...filtersForm.querySelectorAll('input[name="mode"]')].forEach(cb => cb.checked = (filters.modes||[]).includes(cb.value));
  filtersForm.eta_min.value = filters.eta_min || '';
  filtersForm.eta_max.value = filters.eta_max || '';
  filtersForm.fd_min.value = filters.fd_min || '';
  filtersForm.fd_max.value = filters.fd_max || '';
}

function readFiltersFromForm(){
  if(!filtersForm) return;
  const formData = new FormData(filtersForm);
  filters.direction = formData.get('direction') || 'any';
  filters.modes = [...filtersForm.querySelectorAll('input[name="mode"]:checked')].map(cb => cb.value);
  filters.eta_min = formData.get('eta_min') || '';
  filters.eta_max = formData.get('eta_max') || '';
  filters.fd_min = formData.get('fd_min') || '';
  filters.fd_max = formData.get('fd_max') || '';
}

toggleFiltersBtn.addEventListener('click', openFilters);
closeFiltersBtn.addEventListener('click', closeFilters);
drawer.addEventListener('click', (e) => { if(e.target.hasAttribute('data-close')) closeFilters(); });
window.addEventListener('keydown', (e) => { if(e.key === 'Escape' && drawer.classList.contains('open')) closeFilters(); });

filtersForm.addEventListener('submit', (e) => {
  e.preventDefault();
  readFiltersFromForm();
  saveFilters();
  closeFilters();
  renderShipments(document.getElementById('searchInput')?.value || '');
});

clearFiltersBtn.addEventListener('click', () => {
  filters = { direction: 'any', modes: [], eta_min: '', eta_max: '', fd_min: '', fd_max: '' };
  saveFilters();
  syncFiltersToForm();
  renderShipments(document.getElementById('searchInput')?.value || '');
});

// Page Navigation
const pageTitles = {
  'dossiers': 'Dossiers',
  'nouveau': 'Nouveau dossier',
  'risque': 'Risque & Documents'
};

function navigateToPage(pageId){
  console.log('Navigating to page:', pageId);
  currentPage = pageId;
  // Update page visibility
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${pageId}`);
  console.log('Target page element:', targetPage);
  if(targetPage) {
    targetPage.classList.add('active');
  }
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if(targetNav) {
    targetNav.classList.add('active');
  }
  // Update page title
  const titleEl = document.getElementById('pageTitle');
  if(titleEl) {
    titleEl.textContent = pageTitles[pageId] || pageId;
  }
}

// Wire navigation items
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, setting up navigation');
  document.querySelectorAll('.nav-item').forEach(item => {
    console.log('Found nav item:', item.getAttribute('data-page'));
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = item.getAttribute('data-page');
      navigateToPage(pageId);
    });
  });
  
  // Initialize on first page
  navigateToPage('dossiers');
  
  // Load shipments data
  loadShipments().catch(err => console.error(err));
});
