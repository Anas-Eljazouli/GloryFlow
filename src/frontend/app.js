let currentShipmentId = null;
let shipmentsData = [];
let clientsData = [];
let shippingLinesData = [];
let containersData = [];
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

async function loadContainers(){
  containersData = await fetchJSON('/containers');
  renderContainers();
}

async function loadClientsAndLines(){
  clientsData = await fetchJSON('/clients');
  shippingLinesData = await fetchJSON('/shipping_lines');
  const clientSelect = document.getElementById('clientSelect');
  const shippingLineSelect = document.getElementById('shippingLineSelect');
  if(clientSelect){
    clientSelect.innerHTML = '<option value=\"\">-- Sélectionner --</option>' +
      clientsData.map(c => `<option value=\"${c.id}\">${c.name}</option>`).join('');
  }
  if(shippingLineSelect){
    shippingLineSelect.innerHTML = '<option value=\"\">-- Sélectionner --</option>' +
      shippingLinesData.map(sl => `<option value=\"${sl.id}\">${sl.name}</option>`).join('');
  }
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
        <td>${s.client_name ?? ''}</td>
        <td>${s.shipping_line_name ?? ''}</td>
        <td>${s.container_count ?? 0}</td>
        <td>${s.eta ?? ''}</td>
        <td>${s.free_days ?? ''}</td>
        <td class="actionsRow"></td>
      </tr>`);
      const actions = row.querySelector('.actionsRow');
      const riskBtn = el(`<button class="secondary">Risque</button>`);
      riskBtn.onclick = () => computeRisk(s.id);
      const docsBtn = el(`<button class="secondary">Docs</button>`);
      docsBtn.onclick = () => loadDocs(s.id);
      const editBtn = el(`<button class="secondary">Modifier</button>`);
      editBtn.onclick = () => openEditShipmentModal(s);
      const delBtn = el(`<button class="ghost">Supprimer</button>`);
      delBtn.onclick = () => deleteShipment(s.id);
      actions.append(riskBtn, docsBtn, editBtn, delBtn);
      tbody.appendChild(row);
    });
  highlightSelected(currentShipmentId);
}

function openEditShipmentModal(s){
  const modal = document.getElementById('editShipmentModal');
  document.getElementById('editShipmentId').value = s.id;
  document.getElementById('editReference').value = s.reference || '';
  document.getElementById('editDirection').value = s.direction || 'import';
  document.getElementById('editMode').value = s.mode || 'sea';
  document.getElementById('editIncoterm').value = s.incoterm || '';
  document.getElementById('editPol').value = s.pol || '';
  document.getElementById('editPod').value = s.pod || '';
  document.getElementById('editVessel').value = s.vessel || '';
  document.getElementById('editEta').value = s.eta || '';
  document.getElementById('editFreeDays').value = s.free_days ?? '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

function closeEditShipmentModal(){
  const modal = document.getElementById('editShipmentModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

async function computeRisk(id){
  const r = await fetchJSON(`/kpi/demurrage_risk?shipment_id=${id}`);
  currentShipmentId = id;
  navigateToPage('risque');
  const daysLabel = r.days_left >= 0 ? r.days_left : `+${Math.abs(r.days_left)} jours de retard`;
  document.getElementById('riskContent').innerHTML = `
    <p><strong>Dossier:</strong> ${id}</p>
    <ul>
      <li><strong>Score:</strong> ${r.score}</li>
      <li><strong>Jours restants:</strong> ${daysLabel}</li>
      <li><strong>Complétude docs:</strong> ${Math.round(r.docs_completeness*100)}%</li>
      <li><strong>Message:</strong> ${r.message}</li>
    </ul>`;
  highlightSelected(id);
}

async function loadDocs(id){
  currentShipmentId = id;
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

// Container add form (now only on Conteneurs page)
const VALID_OWNER_CODES = new Set([
  'MSC','MAE','CMA','CSC','HAP','ONE','EGL','YML','PIL','ZIM','WAN','HMM','MSK','SEA',
  'NYK','MOL','KLI','APL','OOC','ACL','HLC','COS','CHI','TEX','TRI','CAI','FSC','GEI',
  'TGH','TEM','SUD','OOL'
]);
function computeIsoCheckDigit(owner, serial){
  const letterVals = {}; let val = 10;
  for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
    letterVals[ch] = val; val++; if(val % 11 === 0) val++;
  }
  const code = owner + 'U' + serial;
  let total = 0;
  for(let i=0;i<code.length;i++){
    const ch = code[i];
    const v = /[A-Z]/.test(ch) ? letterVals[ch] : parseInt(ch,10);
    total += v * (2**i);
  }
  const remainder = total % 11;
  return remainder === 10 ? 0 : remainder;
}
async function addContainer(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.shipment_id = parseInt(payload.shipment_id || currentShipmentId || '0', 10);
  if(payload.code){
    payload.code = payload.code.trim().toUpperCase();
    // Validate & give user-friendly message before sending
    if(payload.code.length === 11){
      const owner = payload.code.slice(0,3);
      const category = payload.code[3];
      const serial = payload.code.slice(4,10);
      const providedDigit = payload.code.slice(10);
      // Check BIC registration
      if(!VALID_OWNER_CODES.has(owner)){
        alert(`Code propriétaire '${owner}' non reconnu. Utilisez un code enregistré BIC (ex: MSC, MAE, CMA, ONE, HAP, etc.)`);
        return;
      }
      if(category === 'U'){
        const expected = computeIsoCheckDigit(owner, serial);
        if(String(expected) !== providedDigit){
          alert(`Code conteneur invalide: chiffre de contrôle attendu ${expected}. Utilisez ${owner}U${serial}${expected}`);
          return; // Stop submission
        }
      }
    }
  }
  console.log('Submitting container payload', payload);
  try{
    await fetchJSON('/containers',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    alert('Conteneur ajouté.');
    e.target.reset();
    await loadContainers();
  } catch(err){
    console.error('Échec ajout conteneur', err);
    alert(err.message || 'Erreur lors de l’ajout du conteneur');
  }
}
async function createShipment(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.client_id = parseInt(payload.client_id || '1', 10);
  payload.shipping_line_id = parseInt(payload.shipping_line_id || '1', 10);
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
  try {
    await fetchJSON('/admin/seed', { method:'POST' });
    await Promise.all([loadShipments(), refreshReferenceData(), loadContainers()]);
    alert('Données démo chargées.');
  } catch (err) {
    console.error('Seed failed', err);
    alert('Échec du chargement des données démo : ' + err.message);
  }
}

async function refreshReferenceData(){
  await loadClientsAndLines();
  renderClientsTable();
  renderShippingLinesTable();
}

function renderClientsTable(){
  const tbody = document.querySelector('#clientsTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  clientsData.forEach(c => {
    const row = el(`<tr>
      <td>${c.name}</td>
      <td>${c.email ?? ''}</td>
      <td>${c.phone ?? ''}</td>
      <td><button class="ghost" data-action="delete" data-type="client" data-id="${c.id}">Supprimer</button></td>
    </tr>`);
    tbody.appendChild(row);
  });
}

function renderShippingLinesTable(){
  const tbody = document.querySelector('#shippingLinesTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  shippingLinesData.forEach(sl => {
    const row = el(`<tr>
      <td>${sl.name}</td>
      <td>${sl.email ?? ''}</td>
      <td>${sl.phone ?? ''}</td>
      <td><button class="ghost" data-action="delete" data-type="shipping_line" data-id="${sl.id}">Supprimer</button></td>
    </tr>`);
    tbody.appendChild(row);
  });
}

async function addClient(e){
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  await fetchJSON('/clients', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  e.target.reset();
  await refreshReferenceData();
}

async function addShippingLine(e){
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  await fetchJSON('/shipping_lines', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  e.target.reset();
  await refreshReferenceData();
}

async function handleDeleteReference(type, id){
  if(!id) return;
  const endpoint = type === 'client' ? `/clients/${id}` : `/shipping_lines/${id}`;
  await fetchJSON(endpoint, { method:'DELETE' });
  await refreshReferenceData();
}

async function saveShipmentEdits(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const sid = payload.id;
  delete payload.id;
  payload.free_days = payload.free_days ? parseInt(payload.free_days, 10) : null;
  await fetchJSON(`/shipments/${sid}`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  closeEditShipmentModal();
  await loadShipments();
}

async function deleteShipment(id){
  if(!confirm('Supprimer ce dossier ?')) return;
  await fetchJSON(`/shipments/${id}`, { method:'DELETE' });
  await loadShipments();
}

function renderContainers(){
  const tbody = document.querySelector('#containersTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  containersData.forEach(c => {
    const row = el(`<tr>
      <td>${c.id}</td>
      <td>${c.shipment_id}</td>
      <td>${c.code}</td>
      <td>${c.size ?? ''}</td>
      <td>${c.status ?? ''}</td>
      <td class="actionsRow"></td>
    </tr>`);
    const actions = row.querySelector('.actionsRow');
    const editBtn = el(`<button class="secondary">Modifier</button>`);
    editBtn.onclick = () => openEditContainerModal(c);
    const delBtn = el(`<button class="ghost" data-action="delete" data-type="container" data-id="${c.id}">Supprimer</button>`);
    delBtn.onclick = () => deleteContainer(c.id);
    actions.append(editBtn, delBtn);
    tbody.appendChild(row);
  });
}

function openEditContainerModal(c){
  const modal = document.getElementById('editContainerModal');
  document.getElementById('editContainerId').value = c.id;
  document.getElementById('editContainerCode').value = c.code || '';
  document.getElementById('editContainerSize').value = c.size || '';
  document.getElementById('editContainerStatus').value = c.status || 'full';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

function closeEditContainerModal(){
  const modal = document.getElementById('editContainerModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

async function saveContainerEdits(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const cid = payload.id;
  delete payload.id;
  payload.shipment_id = payload.shipment_id ? parseInt(payload.shipment_id, 10) : null;
  await fetchJSON(`/containers/${cid}`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  closeEditContainerModal();
  await loadContainers();
}

async function deleteContainer(id){
  if(!confirm('Supprimer ce conteneur ?')) return;
  await fetchJSON(`/containers/${id}`, { method:'DELETE' });
  await loadContainers();
}

document.getElementById('addContainerForm').addEventListener('submit', addContainer);
document.getElementById('createShipmentForm').addEventListener('submit', createShipment);
document.getElementById('seedBtn').addEventListener('click', seedDemo);
document.getElementById('refreshBtn').addEventListener('click', loadShipments);
const addClientForm = document.getElementById('addClientForm');
if(addClientForm){ addClientForm.addEventListener('submit', addClient); }
const addShippingLineForm = document.getElementById('addShippingLineForm');
if(addShippingLineForm){ addShippingLineForm.addEventListener('submit', addShippingLine); }

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="delete"]');
  if(!btn) return;
  const type = btn.getAttribute('data-type');
  const id = btn.getAttribute('data-id');
  if(type === 'container'){
    if(confirm('Supprimer ce conteneur ?')) deleteContainer(id);
    return;
  }
  if(confirm('Supprimer cet enregistrement ?')){
    handleDeleteReference(type, id).catch(err => alert(err.message));
  }
});

const editShipmentModal = document.getElementById('editShipmentModal');
const closeEditShipmentBtn = document.getElementById('closeEditShipmentBtn');
const cancelEditShipmentBtn = document.getElementById('cancelEditShipmentBtn');
if(closeEditShipmentBtn){ closeEditShipmentBtn.addEventListener('click', closeEditShipmentModal); }
if(cancelEditShipmentBtn){ cancelEditShipmentBtn.addEventListener('click', closeEditShipmentModal); }
if(editShipmentModal){
  editShipmentModal.addEventListener('click', (e) => {
    if(e.target.hasAttribute('data-close')) closeEditShipmentModal();
  });
}
const editShipmentForm = document.getElementById('editShipmentForm');
if(editShipmentForm){
  editShipmentForm.addEventListener('submit', saveShipmentEdits);
}

const editContainerModal = document.getElementById('editContainerModal');
const closeEditContainerBtn = document.getElementById('closeEditContainerBtn');
const cancelEditContainerBtn = document.getElementById('cancelEditContainerBtn');
if(closeEditContainerBtn){ closeEditContainerBtn.addEventListener('click', closeEditContainerModal); }
if(cancelEditContainerBtn){ cancelEditContainerBtn.addEventListener('click', closeEditContainerModal); }
if(editContainerModal){
  editContainerModal.addEventListener('click', (e) => { if(e.target.hasAttribute('data-close')) closeEditContainerModal(); });
}
const editContainerForm = document.getElementById('editContainerForm');
if(editContainerForm){
  editContainerForm.addEventListener('submit', saveContainerEdits);
}

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
  'risque': 'Risque & Documents',
  'containers': 'Conteneurs',
  'admin': 'Administration'
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
  
  // Load lookup data and shipments
  Promise.all([refreshReferenceData(), loadShipments(), loadContainers()]).catch(err => console.error(err));
});




