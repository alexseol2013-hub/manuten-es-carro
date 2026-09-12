/* ===================================================================
   Garagem Zero — painel de manutenção do carro
   Dados salvos localmente (localStorage) no navegador do usuário.
=================================================================== */

const STORAGE_KEY = "garagem-zero:v1";

/* ---------- catálogo padrão de manutenções ---------- */
const CATALOG = [
  { id: "oleo_motor",   category: "Óleo & Filtros",              name: "Óleo do motor",              intervalKm: 10000, intervalMonths: 12 },
  { id: "filtro_oleo",  category: "Óleo & Filtros",              name: "Filtro de óleo",              intervalKm: 10000, intervalMonths: 12 },
  { id: "filtro_ar",    category: "Óleo & Filtros",              name: "Filtro de ar",                intervalKm: 15000, intervalMonths: 12 },
  { id: "filtro_combustivel", category: "Óleo & Filtros",        name: "Filtro de combustível",       intervalKm: 20000, intervalMonths: 24 },
  { id: "filtro_cabine", category: "Óleo & Filtros",             name: "Filtro de cabine (ar-cond.)", intervalKm: 15000, intervalMonths: 12 },

  { id: "rodizio",      category: "Pneus, Freios & Suspensão",   name: "Rodízio de pneus",            intervalKm: 10000, intervalMonths: 12 },
  { id: "alinhamento",  category: "Pneus, Freios & Suspensão",   name: "Alinhamento e balanceamento", intervalKm: 10000, intervalMonths: 12 },
  { id: "pastilhas",    category: "Pneus, Freios & Suspensão",   name: "Pastilhas de freio",          intervalKm: 30000, intervalMonths: null },
  { id: "discos",       category: "Pneus, Freios & Suspensão",   name: "Discos de freio",             intervalKm: 60000, intervalMonths: null },
  { id: "amortecedores",category: "Pneus, Freios & Suspensão",   name: "Amortecedores",               intervalKm: 60000, intervalMonths: null },

  { id: "ignicao",      category: "Motor & Elétrica",            name: "Ignição (velas, cabos)",      intervalKm: 30000, intervalMonths: null },
  { id: "correias",     category: "Motor & Elétrica",            name: "Correias (dentada e acessórios)", intervalKm: 40000, intervalMonths: 36 },
  { id: "bateria",      category: "Motor & Elétrica",            name: "Bateria",                     intervalKm: null,  intervalMonths: 30 },
  { id: "arrefecimento",category: "Motor & Elétrica",            name: "Fluido de arrefecimento",     intervalKm: 40000, intervalMonths: 24 },

  { id: "fluido_freio", category: "Outros",                      name: "Fluido de freio",             intervalKm: 20000, intervalMonths: 24 },
  { id: "direcao_hidraulica", category: "Outros",                name: "Fluido de direção",           intervalKm: 40000, intervalMonths: 36 },
  { id: "ar_condicionado", category: "Outros",                   name: "Higienização do ar-condicionado", intervalKm: null, intervalMonths: 12 },
  { id: "revisao_geral", category: "Outros",                     name: "Revisão geral",               intervalKm: 10000, intervalMonths: 12 },
];

const CATEGORY_ORDER = ["Óleo & Filtros", "Pneus, Freios & Suspensão", "Motor & Elétrica", "Outros"];

const LEVELS = [
  { name: "Iniciante", min: 0 },
  { name: "Cuidadoso", min: 100 },
  { name: "Experiente", min: 300 },
  { name: "Mestre da Garagem", min: 600 },
];

/* ---------- state ---------- */
let state = loadState();
let editingItemId = null;

function defaultState(){
  return {
    vehicle: { name: "", model: "", year: "", km: 0 },
    items: CATALOG.map(c => ({ ...c, done: false, lastDate: null, lastKm: null, custom: false })),
    fuelLogs: [],
    kmHistory: [],
    maintenanceHistory: [],
    points: 0,
    onboarded: false,
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge in any new catalog items that didn't exist in a saved older version
    const existingIds = new Set(parsed.items.map(i => i.id));
    CATALOG.forEach(c => {
      if(!existingIds.has(c.id)) parsed.items.push({ ...c, done:false, lastDate:null, lastKm:null, custom:false });
    });
    // backward compatibility for users who saved before fuel log / km history existed
    if(!parsed.fuelLogs) parsed.fuelLogs = [];
    if(!parsed.maintenanceHistory){
      // seed from whatever is currently recorded on each item, so existing users don't start empty-handed
      parsed.maintenanceHistory = parsed.items
        .filter(i => i.lastDate || i.lastKm != null)
        .map(i => ({ itemId: i.id, itemName: i.name, category: i.category, date: i.lastDate, km: i.lastKm }));
    }
    if(!parsed.kmHistory){
      parsed.kmHistory = [];
      if(parsed.onboarded && parsed.vehicle && parsed.vehicle.km){
        // seed a first entry so the history isn't empty for existing users
        parsed.kmHistory.push({ date: new Date().toISOString().slice(0,10), km: parsed.vehicle.km, label: "Km inicial" });
      }
    }
    return parsed;
  }catch(e){
    return defaultState();
  }
}

function pushKmHistory(km, label){
  const last = state.kmHistory[state.kmHistory.length - 1];
  if(last && last.km === km) return; // avoid duplicate consecutive entries
  state.kmHistory.push({ date: new Date().toISOString().slice(0,10), km, label });
}

function pushMaintenanceHistory(item){
  const entriesForItem = state.maintenanceHistory.filter(h => h.itemId === item.id);
  const last = entriesForItem[entriesForItem.length - 1];
  if(last && last.date === item.lastDate && last.km === item.lastKm) return; // avoid duplicate consecutive entries
  state.maintenanceHistory.push({
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    date: item.lastDate,
    km: item.lastKm,
  });
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- helpers ---------- */
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

// Aceita tanto "6,20" quanto "6.20" (o teclado numérico do Android costuma
// bloquear a vírgula em campos type=number, então esses campos viraram texto
// e essa função normaliza o que a pessoa digitar).
function toNumber(str){
  if(str == null || str === "") return NaN;
  return Number(String(str).replace(",", "."));
}

function monthsBetween(dateStr){
  if(!dateStr) return null;
  const then = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

function itemStatus(item){
  if(!item.lastDate && item.lastKm == null){
    return item.done ? "ok" : "unknown";
  }
  const kmSince = item.lastKm != null ? (state.vehicle.km - item.lastKm) : null;
  const monthsSince = monthsBetween(item.lastDate);

  let kmRatio = null, monthRatio = null;
  if(item.intervalKm && kmSince != null) kmRatio = kmSince / item.intervalKm;
  if(item.intervalMonths && monthsSince != null) monthRatio = monthsSince / item.intervalMonths;

  const ratios = [kmRatio, monthRatio].filter(r => r != null);
  if(ratios.length === 0) return "ok";
  const worst = Math.max(...ratios);

  if(worst >= 1) return "overdue";
  if(worst >= 0.85) return "warn";
  return "ok";
}

function itemStatusLabel(item, status){
  if(status === "unknown") return "Sem registro";
  const kmSince = item.lastKm != null ? (state.vehicle.km - item.lastKm) : null;
  if(item.intervalKm && kmSince != null){
    const remaining = item.intervalKm - kmSince;
    if(remaining <= 0) return `Vencido há ${Math.abs(remaining).toLocaleString("pt-BR")} km`;
    return `Faltam ${remaining.toLocaleString("pt-BR")} km`;
  }
  const monthsSince = monthsBetween(item.lastDate);
  if(item.intervalMonths && monthsSince != null){
    const remaining = item.intervalMonths - monthsSince;
    if(remaining <= 0) return `Vencido há ${Math.abs(remaining)} meses`;
    return `Faltam ${remaining} meses`;
  }
  return "Em dia";
}

function computeHealth(){
  const tracked = state.items.filter(i => i.lastDate || i.lastKm != null);
  if(tracked.length === 0) return 100;
  let score = 0;
  tracked.forEach(i => {
    const s = itemStatus(i);
    if(s === "ok") score += 1;
    else if(s === "warn") score += 0.5;
    else if(s === "overdue") score += 0;
  });
  return Math.round((score / tracked.length) * 100);
}

function computeLevel(){
  let current = LEVELS[0];
  let next = LEVELS[1] || null;
  for(let i = 0; i < LEVELS.length; i++){
    if(state.points >= LEVELS[i].min){
      current = LEVELS[i];
      next = LEVELS[i+1] || null;
    }
  }
  return { current, next };
}

function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function groupByCategory(items){
  const map = {};
  CATEGORY_ORDER.forEach(c => map[c] = []);
  items.forEach(i => {
    if(!map[i.category]) map[i.category] = [];
    map[i.category].push(i);
  });
  return map;
}

/* ===================================================================
   ONBOARDING
=================================================================== */
function renderOnboardingCategories(){
  const grouped = groupByCategory(state.items);
  const container = $("#onbCategories");
  container.innerHTML = "";

  CATEGORY_ORDER.forEach((cat, idx) => {
    const items = grouped[cat];
    const block = document.createElement("div");
    block.className = "cat-block" + (idx === 0 ? " open" : "");
    block.dataset.category = cat;

    const doneCount = items.filter(i => i.done).length;

    block.innerHTML = `
      <div class="cat-header">
        <div class="cat-header-left">
          <span class="cat-name">${cat}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="cat-count ${doneCount ? 'ok' : ''}">${doneCount}</span>
          <span class="cat-chevron">▾</span>
        </div>
      </div>
      <div class="cat-items"></div>
    `;

    const itemsWrap = block.querySelector(".cat-items");
    items.forEach(item => itemsWrap.appendChild(renderOnboardingItem(item)));

    block.querySelector(".cat-header").addEventListener("click", () => {
      block.classList.toggle("open");
    });

    container.appendChild(block);
  });
}

function renderOnboardingItem(item){
  const row = document.createElement("div");
  row.className = "mnt-item";
  row.innerHTML = `
    <div class="mnt-row">
      <div class="mnt-check ${item.done ? 'checked' : ''}">${item.done ? '✓' : ''}</div>
      <div class="mnt-main">
        <div class="mnt-name-row">
          <span class="mnt-name">${item.name}</span>
          <span class="mnt-interval">${intervalLabel(item)}</span>
        </div>
        <div class="mnt-detail" ${item.done ? '' : 'hidden'}>
          <label class="field">
            <span>Última data</span>
            <input type="date" class="onb-date" value="${item.lastDate || ''}">
          </label>
          <label class="field">
            <span>KM na época</span>
            <input type="number" class="onb-km" inputmode="numeric" value="${item.lastKm ?? ''}">
          </label>
        </div>
      </div>
    </div>
  `;

  const check = row.querySelector(".mnt-check");
  const detail = row.querySelector(".mnt-detail");
  const dateInput = row.querySelector(".onb-date");
  const kmInput = row.querySelector(".onb-km");

  check.addEventListener("click", () => {
    item.done = !item.done;
    check.classList.toggle("checked", item.done);
    check.textContent = item.done ? "✓" : "";
    detail.hidden = !item.done;
    renderOnboardingCategories(); // refresh counts
  });

  dateInput.addEventListener("change", () => { item.lastDate = dateInput.value || null; });
  kmInput.addEventListener("change", () => { item.lastKm = kmInput.value ? Number(kmInput.value) : null; });

  return row;
}

function intervalLabel(item){
  const parts = [];
  if(item.intervalKm) parts.push(`${(item.intervalKm/1000).toString().replace('.0','')}k km`);
  if(item.intervalMonths) parts.push(`${item.intervalMonths >= 12 && item.intervalMonths % 12 === 0 ? (item.intervalMonths/12)+' anos' : item.intervalMonths+' meses'}`);
  return parts.join(" / ") || "—";
}

function initOnboardingFlow(){
  $("#btnToStep2").addEventListener("click", () => {
    const name = $("#inpName").value.trim();
    const model = $("#inpModel").value.trim();
    const year = $("#inpYear").value;
    const km = $("#inpKm").value;

    if(!model){
      toast("Conta pra gente o modelo do carro");
      return;
    }
    state.vehicle = { name, model, year, km: km ? Number(km) : 0 };
    renderOnboardingCategories();
    $("#onbStep1").hidden = true;
    $("#onbStep2").hidden = false;
    $("#onbProgress").style.width = "100%";
  });

  $("#btnBackStep1").addEventListener("click", () => {
    $("#onbStep2").hidden = true;
    $("#onbStep1").hidden = false;
    $("#onbProgress").style.width = "50%";
  });

  $("#btnFinishOnboarding").addEventListener("click", () => {
    state.onboarded = true;
    // award starting points for whatever history was filled in
    const trackedItems = state.items.filter(i => i.done && (i.lastDate || i.lastKm != null));
    state.points += trackedItems.length * 10;
    trackedItems.forEach(pushMaintenanceHistory);
    pushKmHistory(state.vehicle.km || 0, "Km inicial");
    saveState();
    showHome();
  });
}

/* ===================================================================
   HOME (MENU)
=================================================================== */
function renderHome(){
  const v = state.vehicle;
  $("#vModel").textContent = v.model || "Seu carro";
  $("#vYear").textContent = v.year ? `Ano ${v.year}` : "—";
  $("#vKm").textContent = Number(v.km || 0).toLocaleString("pt-BR");

  const health = computeHealth();
  $("#gaugeNumber").textContent = health;
  const fill = $("#gaugeFill");
  const circumference = 157; // matches path length approx (semi-circle r=50)
  fill.style.strokeDashoffset = circumference - (circumference * health / 100);
  fill.style.stroke = health >= 75 ? "var(--good)" : health >= 40 ? "var(--warn)" : "var(--danger)";

  const { current, next } = computeLevel();
  $("#levelName").textContent = current.name;
  $("#levelPoints").textContent = state.points;
  if(next){
    const span = next.min - current.min;
    const progressed = state.points - current.min;
    $("#levelBarFill").style.width = Math.min(100, Math.round((progressed/span)*100)) + "%";
    $("#levelSub").textContent = `${next.min - state.points} pts para o próximo nível`;
  }else{
    $("#levelBarFill").style.width = "100%";
    $("#levelSub").textContent = "Nível máximo alcançado";
  }

  const overdueCount = state.items.filter(i => itemStatus(i) === "overdue").length;
  $("#menuManutSub").textContent = overdueCount > 0
    ? `${overdueCount} item${overdueCount > 1 ? 's' : ''} vencido${overdueCount > 1 ? 's' : ''}`
    : "Histórico e lembretes";

  const avgA = averageKmPerLiter("Álcool");
  const avgG = averageKmPerLiter("Gasolina");
  $("#menuConsumoSub").textContent = (avgA || avgG)
    ? [avgA ? `Álcool ${avgA.toFixed(1)} km/l` : null, avgG ? `Gasolina ${avgG.toFixed(1)} km/l` : null].filter(Boolean).join(" · ")
    : "Registre seus abastecimentos";
}

function renderMaintenance(){
  renderReminders();
  renderDashboardCategories();
}

function renderReminders(){
  const withStatus = state.items
    .filter(i => i.lastDate || i.lastKm != null)
    .map(i => ({ item: i, status: itemStatus(i) }))
    .filter(x => x.status === "overdue" || x.status === "warn")
    .sort((a,b) => (a.status === "overdue" ? -1 : 1) - (b.status === "overdue" ? -1 : 1));

  const list = $("#remindersList");
  list.innerHTML = "";

  if(withStatus.length === 0){
    list.innerHTML = `
      <div class="empty-reminders">
        <span class="big">🎉</span>
        <p>Tudo em dia por aqui. Nada próximo do vencimento no momento.</p>
      </div>`;
    return;
  }

  withStatus.slice(0, 5).forEach(({item, status}) => {
    const row = document.createElement("div");
    row.className = "reminder-row";
    row.innerHTML = `
      <span class="reminder-dot ${status}"></span>
      <span class="reminder-text">${item.name}</span>
      <span class="reminder-when">${itemStatusLabel(item, status)}</span>
    `;
    list.appendChild(row);
  });
}

function renderDashboardCategories(){
  const grouped = groupByCategory(state.items);
  const container = $("#dashCategories");
  const openCats = new Set($all(".cat-block.open").map(b => b.dataset.category));
  container.innerHTML = "";

  CATEGORY_ORDER.forEach(cat => {
    const items = grouped[cat];
    const overdueCount = items.filter(i => itemStatus(i) === "overdue").length;
    const block = document.createElement("div");
    block.className = "cat-block" + (openCats.has(cat) ? " open" : "");
    block.dataset.category = cat;

    block.innerHTML = `
      <div class="cat-header">
        <div class="cat-header-left">
          <span class="cat-name">${cat}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="cat-count ${overdueCount ? '' : 'ok'}">${overdueCount || items.length}</span>
          <span class="cat-chevron">▾</span>
        </div>
      </div>
      <div class="cat-items"></div>
    `;

    const itemsWrap = block.querySelector(".cat-items");
    items.forEach(item => itemsWrap.appendChild(renderDashboardItem(item)));

    block.querySelector(".cat-header").addEventListener("click", () => {
      block.classList.toggle("open");
    });

    container.appendChild(block);
  });
}

function renderDashboardItem(item){
  const status = itemStatus(item);
  const row = document.createElement("div");
  row.className = "mnt-item";
  row.innerHTML = `
    <div class="mnt-row">
      <div class="mnt-main" style="width:100%;">
        <div class="mnt-name-row">
          <span class="mnt-name">${item.name}</span>
          <span class="mnt-interval">${intervalLabel(item)}</span>
        </div>
        <div class="mnt-status ${status}">${itemStatusLabel(item, status)}</div>
      </div>
    </div>
  `;
  row.style.cursor = "pointer";
  row.addEventListener("click", () => openEditModal(item.id));
  return row;
}

/* ---------- edit modal ---------- */
function openEditModal(itemId){
  editingItemId = itemId;
  const item = state.items.find(i => i.id === itemId);
  $("#modalTitle").textContent = item.name;
  $("#modalDate").value = item.lastDate || "";
  $("#modalKm").value = item.lastKm ?? "";
  $("#modalBackdrop").hidden = false;
}

function closeEditModal(){
  $("#modalBackdrop").hidden = true;
  editingItemId = null;
}

function initModal(){
  $("#modalClose").addEventListener("click", closeEditModal);
  $("#modalBackdrop").addEventListener("click", (e) => {
    if(e.target.id === "modalBackdrop") closeEditModal();
  });
  $("#modalSave").addEventListener("click", () => {
    const item = state.items.find(i => i.id === editingItemId);
    if(!item) return;
    const wasTracked = !!(item.lastDate || item.lastKm != null);
    item.lastDate = $("#modalDate").value || null;
    item.lastKm = $("#modalKm").value ? Number($("#modalKm").value) : null;
    item.done = true;
    if(item.lastDate || item.lastKm != null) pushMaintenanceHistory(item);
    if(!wasTracked && (item.lastDate || item.lastKm != null)) state.points += 10;
    else state.points += 5;
    saveState();
    closeEditModal();
    renderHome();
    renderMaintenance();
    toast("Manutenção atualizada");
  });
}

/* ---------- add custom item modal ---------- */
function initAddModal(){
  const select = $("#addCategory");
  select.innerHTML = CATEGORY_ORDER.map(c => `<option value="${c}">${c}</option>`).join("");

  $("#btnQuickAdd").addEventListener("click", () => { $("#addModalBackdrop").hidden = false; });
  $("#addModalClose").addEventListener("click", () => { $("#addModalBackdrop").hidden = true; });
  $("#addModalBackdrop").addEventListener("click", (e) => {
    if(e.target.id === "addModalBackdrop") $("#addModalBackdrop").hidden = true;
  });

  $("#addSave").addEventListener("click", () => {
    const name = $("#addName").value.trim();
    if(!name){ toast("Dá um nome pra manutenção"); return; }
    const km = $("#addIntervalKm").value ? Number($("#addIntervalKm").value) : null;
    const months = $("#addIntervalMonths").value ? Number($("#addIntervalMonths").value) : null;

    state.items.push({
      id: "custom_" + Date.now(),
      category: select.value,
      name,
      intervalKm: km,
      intervalMonths: months,
      done: false,
      lastDate: null,
      lastKm: null,
      custom: true,
    });
    state.points += 5;
    saveState();
    $("#addModalBackdrop").hidden = true;
    $("#addName").value = "";
    $("#addIntervalKm").value = "";
    $("#addIntervalMonths").value = "";
    renderHome();
    renderMaintenance();
    toast("Manutenção adicionada");
  });
}

/* ---------- km update ---------- */
function initKmUpdate(){
  function promptKm(){
    const current = state.vehicle.km || 0;
    const val = window.prompt("Nova quilometragem atual:", current);
    if(val === null) return;
    const num = Number(val);
    if(isNaN(num) || num < 0) { toast("Digite um número válido"); return; }
    if(num < current){ toast("A km não pode ser menor que a atual"); return; }
    state.vehicle.km = num;
    state.points += 2;
    pushKmHistory(num, "Atualização manual");
    saveState();
    renderHome();
    renderMaintenance();
    toast("Quilometragem atualizada");
  }
  $("#btnUpdateKm").addEventListener("click", promptKm);
  $("#btnQuickKm").addEventListener("click", promptKm);
}

/* ---------- km history ---------- */
function renderKmHistory(){
  const list = $("#kmHistoryList");
  list.innerHTML = "";

  if(state.kmHistory.length === 0){
    list.innerHTML = `<div class="empty-km-history">Nenhum registro ainda. A KM inicial e cada atualização aparecem aqui.</div>`;
    return;
  }

  const sorted = [...state.kmHistory].sort((a,b) => b.km - a.km);

  sorted.forEach((entry, idx) => {
    const older = sorted[idx + 1];
    const delta = older ? entry.km - older.km : null;
    const row = document.createElement("div");
    row.className = "km-history-row";
    row.innerHTML = `
      <div class="km-history-main">
        <span class="km-history-km">${entry.km.toLocaleString("pt-BR")} km</span>
        <span class="km-history-label">${entry.label}</span>
      </div>
      <div>
        <div class="km-history-date">${formatDateBR(entry.date)}</div>
        ${delta ? `<div class="km-history-delta">+${delta.toLocaleString("pt-BR")} km</div>` : ''}
      </div>
    `;
    list.appendChild(row);
  });
}

function initKmHistoryModal(){
  $("#btnKmHistory").addEventListener("click", () => {
    renderKmHistory();
    $("#kmHistoryBackdrop").hidden = false;
  });
  $("#kmHistoryClose").addEventListener("click", () => { $("#kmHistoryBackdrop").hidden = true; });
  $("#kmHistoryBackdrop").addEventListener("click", (e) => {
    if(e.target.id === "kmHistoryBackdrop") $("#kmHistoryBackdrop").hidden = true;
  });
}

/* ---------- maintenance history ---------- */
function renderMaintenanceHistory(){
  const list = $("#maintHistoryList");
  list.innerHTML = "";

  if(state.maintenanceHistory.length === 0){
    list.innerHTML = `<div class="empty-km-history">Nenhum registro ainda. Cada vez que você marcar uma manutenção como feita, ela aparece aqui.</div>`;
    return;
  }

  // most recent first — sort by date, falling back to insertion order for same-day entries
  const sorted = [...state.maintenanceHistory]
    .map((entry, idx) => ({ entry, idx }))
    .sort((a, b) => {
      const dateCompare = (b.entry.date || "").localeCompare(a.entry.date || "");
      return dateCompare !== 0 ? dateCompare : b.idx - a.idx;
    })
    .map(x => x.entry);

  sorted.forEach(entry => {
    const row = document.createElement("div");
    row.className = "km-history-row";
    row.innerHTML = `
      <div class="km-history-main">
        <span class="km-history-km">${entry.itemName}</span>
        <span class="km-history-label">${entry.category}${entry.km != null ? ` · ${entry.km.toLocaleString("pt-BR")} km` : ''}</span>
      </div>
      <div class="km-history-date">${entry.date ? formatDateBR(entry.date) : '—'}</div>
    `;
    list.appendChild(row);
  });
}

function initMaintHistoryModal(){
  $("#btnMaintHistory").addEventListener("click", () => {
    renderMaintenanceHistory();
    $("#maintHistoryBackdrop").hidden = false;
  });
  $("#maintHistoryClose").addEventListener("click", () => { $("#maintHistoryBackdrop").hidden = true; });
  $("#maintHistoryBackdrop").addEventListener("click", (e) => {
    if(e.target.id === "maintHistoryBackdrop") $("#maintHistoryBackdrop").hidden = true;
  });
}

/* ---------- edit vehicle ---------- */
function initEditVehicle(){
  $("#btnEditVehicle").addEventListener("click", () => {
    $("#settingsBackdrop").hidden = true;
    const model = window.prompt("Modelo do carro:", state.vehicle.model || "");
    if(model === null) return;
    const year = window.prompt("Ano:", state.vehicle.year || "");
    state.vehicle.model = model.trim();
    state.vehicle.year = year ? year.trim() : "";
    saveState();
    renderHome();
  });
}

/* ---------- settings / export / import ---------- */
function initSettings(){
  $("#btnSettings").addEventListener("click", () => { $("#settingsBackdrop").hidden = false; });
  $("#settingsClose").addEventListener("click", () => { $("#settingsBackdrop").hidden = true; });
  $("#settingsBackdrop").addEventListener("click", (e) => {
    if(e.target.id === "settingsBackdrop") $("#settingsBackdrop").hidden = true;
  });

  $("#btnExportData").addEventListener("click", exportData);

  $("#btnImportData").addEventListener("click", () => {
    $("#importFileInput").click();
  });
  $("#importFileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => importData(reader.result);
    reader.readAsText(file);
    e.target.value = ""; // allow re-selecting the same file later
  });
}

function exportData(){
  const dateStr = new Date().toISOString().slice(0,10);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `garagem-zero-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Backup baixado");
}

function importData(text){
  let parsed;
  try{
    parsed = JSON.parse(text);
  }catch(e){
    toast("Arquivo inválido");
    return;
  }
  if(!parsed || !parsed.vehicle || !Array.isArray(parsed.items)){
    toast("Esse arquivo não parece ser um backup do Garagem Zero");
    return;
  }
  const ok = window.confirm("Isso substitui todos os dados atuais pelos do backup. Continuar?");
  if(!ok) return;

  state = parsed;
  if(!state.fuelLogs) state.fuelLogs = [];
  if(!state.kmHistory) state.kmHistory = [];
  if(!state.maintenanceHistory) state.maintenanceHistory = [];
  saveState();
  $("#settingsBackdrop").hidden = true;
  showHome();
  toast("Dados restaurados");
}

/* ===================================================================
   FUEL LOG
=================================================================== */
let selectedFuelType = "Álcool";

function fuelLogsFor(type){
  return state.fuelLogs.filter(l => l.fuelType === type);
}

function averageKmPerLiter(type){
  const logs = fuelLogsFor(type);
  if(logs.length === 0) return null;
  const totalKm = logs.reduce((sum, l) => sum + (l.kmEnd - l.kmStart), 0);
  const totalLiters = logs.reduce((sum, l) => sum + l.liters, 0);
  if(totalLiters <= 0) return null;
  return totalKm / totalLiters;
}

function initFuelTab(){
  $("#btnFuelAlcool").addEventListener("click", () => setFuelType("Álcool"));
  $("#btnFuelGasolina").addEventListener("click", () => setFuelType("Gasolina"));

  const kmStartInput = $("#fuelKmStart");
  const kmEndInput = $("#fuelKmEnd");
  const litersInput = $("#fuelLiters");

  [kmStartInput, kmEndInput, litersInput].forEach(inp => {
    inp.addEventListener("input", updateFuelPreview);
  });

  $("#btnSaveFuel").addEventListener("click", saveFuelEntry);
}

function setFuelType(type){
  selectedFuelType = type;
  $("#btnFuelAlcool").classList.toggle("active", type === "Álcool");
  $("#btnFuelGasolina").classList.toggle("active", type === "Gasolina");
}

function updateFuelPreview(){
  const kmStart = Number($("#fuelKmStart").value);
  const kmEnd = Number($("#fuelKmEnd").value);
  const liters = toNumber($("#fuelLiters").value);
  const preview = $("#fuelPreview");

  if(kmStart && kmEnd && liters && kmEnd > kmStart){
    const kml = (kmEnd - kmStart) / liters;
    preview.textContent = `${(kmEnd-kmStart).toLocaleString("pt-BR")} km rodados → média de ${kml.toFixed(2)} km/l`;
    preview.classList.add("ready");
  }else{
    preview.textContent = "";
    preview.classList.remove("ready");
  }
}

function prefillFuelForm(){
  const lastEntry = [...state.fuelLogs].sort((a,b) => b.kmEnd - a.kmEnd)[0];
  const startKm = lastEntry ? lastEntry.kmEnd : (state.vehicle.km || "");
  $("#fuelKmStart").value = startKm;
  $("#fuelKmEnd").value = state.vehicle.km || "";
  $("#fuelLiters").value = "";
  $("#fuelPrice").value = "";
  updateFuelPreview();
}

function saveFuelEntry(){
  const kmStart = Number($("#fuelKmStart").value);
  const kmEnd = Number($("#fuelKmEnd").value);
  const liters = toNumber($("#fuelLiters").value);
  const price = $("#fuelPrice").value ? toNumber($("#fuelPrice").value) : null;

  if(!kmStart || !kmEnd || kmEnd <= kmStart){ toast("Confira o km inicial e final"); return; }
  if(!liters || liters <= 0){ toast("Informe os litros abastecidos"); return; }

  state.fuelLogs.push({
    id: "fuel_" + Date.now(),
    fuelType: selectedFuelType,
    kmStart, kmEnd, liters, price,
    date: new Date().toISOString().slice(0,10),
  });

  if(kmEnd > (state.vehicle.km || 0)) state.vehicle.km = kmEnd;
  pushKmHistory(state.vehicle.km, `Abastecimento (${selectedFuelType})`);
  state.points += 8;
  saveState();
  toast("Abastecimento salvo");
  renderFuelScreen();
  renderHome();
}

function renderFuelScreen(){
  $("#avgAlcool").textContent = fmtKml(averageKmPerLiter("Álcool"));
  $("#avgGasolina").textContent = fmtKml(averageKmPerLiter("Gasolina"));
  prefillFuelForm();

  const list = $("#fuelHistory");
  list.innerHTML = "";
  const sorted = [...state.fuelLogs].sort((a,b) => b.kmEnd - a.kmEnd);

  if(sorted.length === 0){
    list.innerHTML = `<div class="empty-fuel">Nenhum abastecimento registrado ainda.</div>`;
    return;
  }

  sorted.forEach(log => {
    const kml = (log.kmEnd - log.kmStart) / log.liters;
    const row = document.createElement("div");
    row.className = "fuel-entry";
    row.innerHTML = `
      <div class="fuel-entry-badge ${log.fuelType === 'Álcool' ? 'alcool' : 'gasolina'}">${log.fuelType === 'Álcool' ? '🌿' : '⛽'}</div>
      <div class="fuel-entry-main">
        <div class="fuel-entry-top">
          <span class="fuel-entry-fuel">${log.fuelType}</span>
          <span class="fuel-entry-date">${formatDateBR(log.date)}</span>
        </div>
        <div class="fuel-entry-detail">${(log.kmEnd-log.kmStart).toLocaleString("pt-BR")} km · ${log.liters.toLocaleString("pt-BR")} l${log.price ? ` · R$ ${log.price.toFixed(2)}/l` : ''}</div>
      </div>
      <div class="fuel-entry-kml">${kml.toFixed(1)}<br><small style="font-weight:400;color:var(--muted);">km/l</small></div>
    `;
    list.appendChild(row);
  });
}

function fmtKml(v){ return v ? v.toFixed(1) : "—"; }

function formatDateBR(dateStr){
  const [y,m,d] = dateStr.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/* ===================================================================
   CALCULATOR — álcool ou gasolina
=================================================================== */
function initCalcTab(){
  $("#calcPriceAlcool").addEventListener("input", renderCalc);
  $("#calcPriceGasolina").addEventListener("input", renderCalc);
}

function renderCalc(){
  const priceAlcool = toNumber($("#calcPriceAlcool").value);
  const priceGasolina = toNumber($("#calcPriceGasolina").value);
  const card = $("#calcResultCard");
  const label = $("#calcResultLabel");
  const winner = $("#calcResultWinner");
  const detail = $("#calcResultDetail");
  const explainer = $("#calcExplainer");

  const avgAlcool = averageKmPerLiter("Álcool");
  const avgGasolina = averageKmPerLiter("Gasolina");
  const usingRealData = avgAlcool && avgGasolina;
  const ratio = usingRealData ? (avgAlcool / avgGasolina) : 0.7;

  if(!priceAlcool || !priceGasolina){
    label.textContent = "Preencha os dois preços";
    winner.textContent = "—";
    detail.textContent = "";
  }else{
    const costAlcoolPerKm = avgAlcool ? priceAlcool / avgAlcool : priceAlcool / (avgGasolina ? avgGasolina * 0.7 : 10 * 0.7);
    const costGasolinaPerKm = avgGasolina ? priceGasolina / avgGasolina : priceGasolina / 10;
    const alcoolCompensa = (priceAlcool / priceGasolina) <= ratio;

    label.textContent = usingRealData ? "Com base na sua média real de consumo" : "Estimativa (ainda sem sua média registrada)";
    winner.textContent = alcoolCompensa ? "Álcool compensa mais" : "Gasolina compensa mais";
    winner.style.color = alcoolCompensa ? "var(--good)" : "var(--warn)";

    const breakeven = (priceGasolina * ratio).toFixed(2);
    detail.textContent = `Pelo seu preço, o álcool só compensa se custar até R$ ${breakeven} — hoje ele está a ${(priceAlcool/priceGasolina*100).toFixed(0)}% do preço da gasolina.`;
  }

  if(usingRealData){
    explainer.textContent = `Com a sua média real (${avgAlcool.toFixed(1)} km/l no álcool e ${avgGasolina.toFixed(1)} km/l na gasolina), o álcool compensa enquanto custar até ${(ratio*100).toFixed(0)}% do preço da gasolina no seu carro.`;
  }else{
    explainer.textContent = `Sem abastecimentos registrados dos dois combustíveis ainda, usamos a regra geral: o álcool rende cerca de 30% menos que a gasolina, então ele só compensa se custar até 70% do preço dela. Registre alguns abastecimentos de cada tipo na aba Consumo para um cálculo com o desempenho real do seu carro.`;
  }
}

/* ===================================================================
   SCREEN SWITCHING
=================================================================== */
const ALL_SCREENS = ["onboarding", "homeScreen", "maintenanceScreen", "fuelScreen", "calcScreen"];

function showOnly(screenId){
  ALL_SCREENS.forEach(id => { $("#" + id).hidden = (id !== screenId); });
}

function showOnboarding(){
  showOnly("onboarding");
}

function showHome(){
  showOnly("homeScreen");
  renderHome();
}

function showMaintenance(){
  showOnly("maintenanceScreen");
  renderMaintenance();
}

function showFuel(){
  showOnly("fuelScreen");
  renderFuelScreen();
}

function showCalc(){
  showOnly("calcScreen");
  renderCalc();
}

function initNavigation(){
  $("#goManutencoes").addEventListener("click", showMaintenance);
  $("#goConsumo").addEventListener("click", showFuel);
  $("#goCalculadora").addEventListener("click", showCalc);
  $("#backFromManut").addEventListener("click", showHome);
  $("#backFromFuel").addEventListener("click", showHome);
  $("#backFromCalc").addEventListener("click", showHome);
}

/* ===================================================================
   INIT
=================================================================== */
function init(){
  initOnboardingFlow();
  initModal();
  initAddModal();
  initKmUpdate();
  initKmHistoryModal();
  initMaintHistoryModal();
  initEditVehicle();
  initSettings();
  initFuelTab();
  initCalcTab();
  initNavigation();

  if(state.onboarded){
    showHome();
  }else{
    renderOnboardingCategories();
    showOnboarding();
  }
}

document.addEventListener("DOMContentLoaded", init);
