// js/app.js (v8.3)
'use strict';
/* ---------- DOM CACHE ---------- */
let pn, pp, pk, pc, symbolBtn, pkgTable;
let tabs, dashboard, orderTable;
let bar, progressText;
let m_date, m_time, m_artikel, m_package;

window.addEventListener('load', () => {
  pn = document.getElementById('pn');
  pp = document.getElementById('pp');
  pk = document.getElementById('pk');
  pc = document.getElementById('pc');
  symbolBtn = document.getElementById('symbolBtn');
  pkgTable = document.getElementById('pkgTable');

  tabs = document.getElementById('tabs');
  dashboard = document.getElementById('dashboard');
  orderTable = document.getElementById('orderTable');

  bar = document.getElementById('bar');
  progressText = document.getElementById('progressText');

  m_date = document.getElementById('m_date');
  m_time = document.getElementById('m_time');
  m_artikel = document.getElementById('m_artikel');
  m_package = document.getElementById('m_package');
});


/* ---------- DATEN ---------- */
let packages = JSON.parse(localStorage.getItem("packages")||"[]");
let days = {};
let unknown = [];
let activeTab = "ALL";

/* ---------- GUTSCHRIFT (PDF/XLSX) DATEN ---------- */
let gsEntries = [];       // Liefer-Positionen (Pakete)
let gsKmEntries = [];     // KM-Positionen
let gsAltEntries = [];    // Altgeräte
let gsInvoice = {};       // Rechnung/Brutto/MwSt usw.

let gsActiveTab = "ALL";  // "ALL" | "OTHER" | "KM" | "ALT" | "INV" | "dd.mm.yyyy"

/* ---------- PAKETE ---------- */
function togglePkg(){
  const el = document.getElementById("pkgContent");
  if(!el) return;

  const isOpen = el.style.display === "block";
  el.style.display = isOpen ? "none" : "block";

  const acc = document.querySelector(".accordion[onclick*=togglePkg]");
  if(acc) acc.setAttribute("aria-expanded", String(!isOpen));
}

function savePackages(){
  localStorage.setItem("packages", JSON.stringify(packages));
}

function addPackage(){
  packages.push({
    name: pn.value,
    price: +pp.value,
    keys: pk.value.split(',').map(k=>k.trim()).filter(Boolean),
    show: true,
    icon: symbolBtn.innerText || "📦",
    color: pc.value || "#22c55e"
  });
  pn.value = pp.value = pk.value = "";
  symbolBtn.innerText = "📦";
  savePackages();
  renderAll();
}

/* ---------- ZEITFENSTER SAMMELN ---------- */
function collectTimeSlots(){
  const set = new Set();
  Object.values(days).flat().forEach(o=>{ if(o.time) set.add(o.time); });
  unknown.forEach(o=>{ if(o.time) set.add(o.time); });
  return Array.from(set).sort();
}

function fillTimeDropdown(){
  const sel = document.getElementById("m_time");
  if(!sel) return;

  const times = collectTimeSlots();
  sel.innerHTML = "<option value=''>Zeitfenster wählen</option>";
  times.forEach(t => sel.innerHTML += `<option value="${t}">${t}</option>`);
}

function formatDateFromPicker(val){
  const [y,m,d] = val.split("-");
  return `${d}.${m}.${y}`;
}

/* ---------- PAKETE UI ---------- */
function renderPackages(){
  pkgTable.innerHTML = '<tr><th>Name</th><th>Preis</th><th>Keywords</th><th>Symbol</th><th>Farbe</th><th>Übersicht</th><th></th></tr>';
  packages.forEach((p,i)=>{
    let keywordsHtml = `
      <div class="keywords-accordion">
        <button onclick="toggleKeywords(${i})">Keywords (${p.keys.length}) ▾</button>
        <div id="keys-${i}" class="keywords-content" style="display:none">
          ${p.keys.map((k,ki)=>`
            <span class="chip" ondblclick="editKey(${i},${ki})">
              ${k}<span onclick="delKey(${i},${ki})">×</span>
            </span>
          `).join('')}
          <button onclick="addKey(${i})">➕</button>
        </div>
      </div>
    `;

    pkgTable.innerHTML += `
      <tr>
        <td><input value="${p.name}" onchange="renamePackage(${i},this.value)"></td>
        <td><input type="number" value="${p.price}" onchange="packages[${i}].price=+this.value;savePackages();renderAll()"></td>
        <td>${keywordsHtml}</td>
        <td><input type="text" value="${p.icon}" onchange="packages[${i}].icon=this.value;savePackages();renderAll()"></td>
        <td><input type="color" value="${p.color}" onchange="packages[${i}].color=this.value;savePackages();renderAll()"></td>
        <td style="text-align:center">
          <input type="checkbox" ${p.show?'checked':''} onchange="packages[${i}].show=this.checked;savePackages();renderAll()">
        </td>
        <td><button onclick="packages.splice(${i},1);savePackages();renderAll()">🗑</button></td>
      </tr>
    `;
  });

  // ⚠️ wenn Pakete geändert werden, auch Gutschrift neu rendern (damit Filter stimmt)
  if(gsEntries.length || gsKmEntries.length || gsAltEntries.length){
    renderGutschriftAll();
  }
}

function toggleKeywords(i){
  const el = document.getElementById(`keys-${i}`);
  if(!el) return;
  el.style.display = (el.style.display === "none") ? "block" : "none";
}

/* ---------- EXPORT / IMPORT TABELLEN (dein Teil unverändert) ---------- */
function renamePackage(i,n){
  let old = packages[i].name;
  packages[i].name = n;
  Object.values(days).flat().forEach(o=>{ if(o.package===old) o.package=n; });
  savePackages();
  renderAll();
}

function exportCurrentTab(){
  if(!activeTab){
    alert("❗ Kein Tab ausgewählt");
    return;
  }

  const data = {
    type: "tables",
    version: "tables-1.1",
    created: new Date().toISOString(),
    activeTab
  };

  if(activeTab === "ALL"){
    data.days = days || {};
    data.unknown = unknown || [];
  } else if(activeTab === "UNK"){
    data.unknown = unknown || [];
  } else {
    data.days = { [activeTab]: (days && days[activeTab]) ? days[activeTab] : [] };
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  if(activeTab === "ALL") a.download = `alle-tabellen.json`;
  else if(activeTab === "UNK") a.download = `tab-UNK.json`;
  else a.download = `tab-${activeTab.replace(/\./g,"-")}.json`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importCurrentTab(files){
  if(!files || files.length === 0){
    alert("❗ Keine Datei gewählt");
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try{
      const data = JSON.parse(e.target.result);

      if(Array.isArray(data)){
        alert("❗ Das ist eine Pakete-Datei. Bitte im Pakete-Importer laden (⬆ Pakete importieren).");
        return;
      }

      const hasDays = data && typeof data.days === "object" && data.days !== null;
      const hasUnknown = Array.isArray(data && data.unknown);

      if(!hasDays && !hasUnknown){
        throw new Error("Ungültige Tabellen-Datei: keine days/unknown gefunden");
      }

      const normalizeOrder = (raw) => {
        const o = { ...raw };
        if(typeof o.date !== "string") o.date = o.date ? String(o.date) : "";
        if(typeof o.time !== "string") o.time = o.time ? String(o.time) : "";
        if(typeof o.artikel !== "string") o.artikel = o.artikel ? String(o.artikel) : "";
        if(typeof o.package !== "string") o.package = o.package ? String(o.package) : "";
        if(typeof o.slot !== "string") o.slot = "";

        const pkg = packages.find(p => p.name === o.package);
        if(pkg){
          o.price = pkg.price;
          o.package = pkg.name;
          return { ok:true, order:o };
        } else {
          o.price = 0;
          o.package = "";
          return { ok:false, order:o };
        }
      };

      if(hasDays){
        for(const [tab, list] of Object.entries(data.days || {})){
          const arr = Array.isArray(list) ? list : [];
          for(const raw of arr){
            const res = normalizeOrder(raw);
            if(res.ok){
              days[tab] = Array.isArray(days[tab]) ? days[tab] : [];
              days[tab].push(res.order);
            } else {
              unknown = Array.isArray(unknown) ? unknown : [];
              unknown.push(res.order);
            }
          }
        }
      }

      if(hasUnknown){
        for(const raw of (data.unknown || [])){
          const res = normalizeOrder(raw);
          if(res.ok && res.order.date){
            days[res.order.date] = Array.isArray(days[res.order.date]) ? days[res.order.date] : [];
            days[res.order.date].push(res.order);
          } else {
            unknown = Array.isArray(unknown) ? unknown : [];
            unknown.push(res.order);
          }
        }
      }

      if(typeof data.activeTab === "string" && data.activeTab){
        activeTab = data.activeTab;
      } else if(hasDays){
        activeTab = Object.keys(data.days || {})[0] || "ALL";
      } else {
        activeTab = "UNK";
      }

      renderAll();
      alert("✅ Tabellen erfolgreich geladen (Pakete unverändert).");
    }catch(err){
      console.error(err);
      alert("❌ Fehler beim Tabellen-Import: " + (err && err.message ? err.message : String(err)));
    }
  };

  reader.readAsText(files[0]);
}

/* ---------- KEYWORDS EDIT ---------- */
function addKey(i){
  let k = prompt("Keyword");
  if(k){
    packages[i].keys.push(k);
    savePackages();
    renderAll();
  }
}
function delKey(i,k){
  packages[i].keys.splice(k,1);
  savePackages();
  renderAll();
}
function editKey(i,k){
  let n = prompt("Ändern", packages[i].keys[k]);
  if(n){
    packages[i].keys[k] = n;
    savePackages();
    renderAll();
  }
}

/* ---------- Emoji Picker ---------- */
const emojiList = ["📦","🍎","🍌","🍇","🥕","🥩","🍞","🥤","🛒","🎁"];
function openEmojiPicker(){
  const picker = document.createElement("div");
  picker.style.position="absolute";
  picker.style.background="var(--card)";
  picker.style.border="1px solid var(--stroke)";
  picker.style.borderRadius="12px";
  picker.style.padding="10px";
  picker.style.display="grid";
  picker.style.gridTemplateColumns="repeat(5,40px)";
  picker.style.gap="5px";
  picker.style.zIndex="999";
  picker.style.top=(symbolBtn.getBoundingClientRect().bottom+window.scrollY)+"px";
  picker.style.left=(symbolBtn.getBoundingClientRect().left+window.scrollX)+"px";

  emojiList.forEach(e=>{
    const b = document.createElement("button");
    b.innerText=e;
    b.onclick=()=>{
      symbolBtn.innerText=e;
      document.body.removeChild(picker);
    };
    picker.appendChild(b);
  });

  document.body.appendChild(picker);
  window.addEventListener("click", function closePicker(ev){
    if(!picker.contains(ev.target) && ev.target!==symbolBtn){
      document.body.removeChild(picker);
      window.removeEventListener("click", closePicker);
    }
  });
}

/* ---------- Export / Import Pakete ---------- */
function exportPackages(){
  const data = JSON.stringify(packages,null,2);
  const blob = new Blob([data],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url;
  a.download="pakete.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importPackages(files){
  if(!files || files.length === 0){
    alert("Keine Datei ausgewählt!");
    return;
  }

  const file = files[0];
  const reader = new FileReader();

  reader.onload = function(e){
    try{
      const imported = JSON.parse(e.target.result);
      if(!Array.isArray(imported)){
        throw new Error("Ungültige Datei (Pakete müssen ein Array sein)");
      }

      const normalized = imported.map((p, idx) => {
        if(!p || typeof p !== "object") throw new Error(`Paket #${idx+1} ist kein Objekt`);

        const name = (p.name ?? "").toString().trim();
        if(!name) throw new Error(`Paket #${idx+1}: Name fehlt`);

        let price = p.price;
        if(typeof price === "string") price = price.replace(",", ".");
        price = Number(price);
        if(!Number.isFinite(price)) price = 0;

        let keys = p.keys;
        if(typeof keys === "string"){
          keys = keys.split(",").map(k => k.trim()).filter(Boolean);
        }
        if(!Array.isArray(keys)) keys = [];

        const icon = (p.icon ?? "📦").toString();
        const color = (p.color ?? "#22c55e").toString();
        const show = (typeof p.show === "boolean") ? p.show : true;

        return { name, price, keys, icon, color, show };
      });

      packages = normalized;
      savePackages();
      renderAll();
      alert("✅ Pakete erfolgreich importiert!");
    }catch(err){
      console.error(err);
      alert("❌ Fehler beim Import: " + (err && err.message ? err.message : String(err)));
    }
  };

  reader.onerror = function(){
    alert("❌ Datei konnte nicht gelesen werden");
  };

  reader.readAsText(file);
}

/* ---------- OCR (dein Teil unverändert) ---------- */
async function preprocessImage(file, scale=2){
  const imgURL = URL.createObjectURL(file);
  const img = await new Promise((resolve, reject)=>{
    const im = new Image();
    im.onload = ()=>resolve(im);
    im.onerror = reject;
    im.src = imgURL;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const d = imgData.data;

  const contrast = 1.25;
  const intercept = 128 * (1 - contrast);

  for(let i=0;i<d.length;i+=4){
    const r=d[i], g=d[i+1], b=d[i+2];
    let y = 0.299*r + 0.587*g + 0.114*b;
    y = y * contrast + intercept;
    if(y<0) y=0;
    if(y>255) y=255;
    d[i]=d[i+1]=d[i+2]=y;
  }

  ctx.putImageData(imgData,0,0);
  URL.revokeObjectURL(imgURL);

  const blob = await new Promise(res=>canvas.toBlob(res,"image/png",1.0));
  return blob;
}

/* ---------- OCR WORKER (stabil) ---------- */
let __ocrWorkerPromise = null;

function __ocrStatus(msg){
  try{ if(progressText) progressText.innerText = msg; }catch(e){}
}
function __ocrBar(frac){
  try{ if(bar) bar.style.width = (Math.max(0, Math.min(1, frac))*100).toFixed(1) + '%'; }catch(e){}
}

function __withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, reject)=>setTimeout(()=>reject(new Error('Timeout: '+label)), ms))
  ]);
}

async function __getOcrWorker(){
  if(__ocrWorkerPromise) return __ocrWorkerPromise;

  if(!window.Tesseract || typeof Tesseract.createWorker !== 'function'){
    throw new Error('Tesseract.js wurde nicht geladen.');
  }

  // Quellen: best_int ist oft kleiner; unpkg als Alternative zu jsDelivr.
  const bases = [
    './tessdata',
    'https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu@1.0.0/4.0.0_best_int',
    'https://unpkg.com/@tesseract.js-data/deu@1.0.0/4.0.0_best_int',
    'https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu@1.0.0/4.0.0',
    'https://unpkg.com/@tesseract.js-data/deu@1.0.0/4.0.0',
    'https://tessdata.projectnaptha.com/4.0.0',
    'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0'
  ];

  __ocrWorkerPromise = (async () => {
    let lastErr = null;
    for(const base of bases){
      try{
        __ocrStatus('OCR: lade Sprache…');
        __ocrBar(0.05);
        const w = await __withTimeout(
          Tesseract.createWorker('deu', 1, {
            cacheMethod: 'none',
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/',
            langPath: base,
            logger: (m) => {
              try{
                const p = (typeof m.progress === 'number') ? m.progress : 0;
                const pct = Math.round(p*100);
                __ocrStatus(`${m.status || '...'}${pct ? ` (${pct}%)` : ''}`);
                // bei traineddata bleibt p oft 0 -> zeig wenigstens etwas
                __ocrBar(Math.max(0.05, p));
              }catch(e){}
            }
          }),
          45000,
          'load language ('+base+')'
        );
        __ocrStatus('OCR bereit');
        return w;
      }catch(e){
        lastErr = e;
        __ocrWorkerPromise = null; // wichtig: erneuter Versuch möglich
      }
    }
    throw (lastErr || new Error('OCR Worker konnte nicht initialisiert werden.'));
  })();

  return __ocrWorkerPromise;
}

async function loadScreenshots(files){
  try{
    if(!files || files.length === 0){
      alert('❗ Keine Bilder gewählt');
      return;
    }

    // falls DOM noch nicht gecached ist
    bar = bar || document.getElementById('bar');
    progressText = progressText || document.getElementById('progressText');

    __ocrBar(0);
    __ocrStatus('Starte OCR…');

    const worker = await __getOcrWorker();

    let done = 0;
    for(const f of files){
      const t = (f?.type||'').toLowerCase();
      const n = (f?.name||'').toLowerCase();
      if(t.includes('heic')||t.includes('heif')||n.endsWith('.heic')||n.endsWith('.heif')){
        throw new Error('HEIC/HEIF erkannt. Bitte JPG/PNG verwenden.');
      }

      __ocrStatus('Vorbereitung: ' + (f.name || 'Bild'));

      const pre = await preprocessImage(f, 2);

      __ocrStatus('OCR läuft…');
      const r = await worker.recognize(pre, {
        tessedit_pageseg_mode: 6,
        preserve_interword_spaces: '1'
      });

      parseOCR((r && r.data && r.data.text) ? r.data.text : '');

      done++;
      __ocrBar(done / files.length);
      __ocrStatus(`${done} / ${files.length}`);
    }

    assignPackagesAfterOCR();
  }catch(err){
    console.error(err);
    try{ __ocrStatus('❌ ' + (err && err.message ? err.message : String(err))); }catch(e){}
    alert('❌ ' + (err && err.message ? err.message : String(err)));
  }
}

function assignPackagesAfterOCR(){
  const all = [];
  for(const d of Object.keys(days)){
    if(Array.isArray(days[d])) all.push(...days[d]);
  }
  if(Array.isArray(unknown)) all.push(...unknown);

  for(const o of all){
    const pkg = findPkg(o.artikel || "");
    if(pkg){
      o.package = pkg.name;
      o.price = pkg.price;
    } else {
      o.package = "";
      o.price = 0;
    }
  }

  renderAll();
}

function parseOCR(text){
  if(!text) return;

  let date = "";
  const dm = text.match(/\d{2}\.\d{2}\.\d{4}/);
  if(dm) date = dm[0];
  if(date) days[date] = days[date] || [];

  const timeRe = /\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g;
  const matches = [];
  let m;
  while((m = timeRe.exec(text)) !== null){
    matches.push({ time: m[0].replace(/\s+/g," "), idx: m.index });
  }

  if(matches.length === 0){
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    for(const l of lines){
      const tm = l.match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/);
      if(!tm) continue;

      const time = tm[0].replace(/\s+/g," ");
      const artikelClean = cleanArtikelOneCustomer(l, time);

      const obj = { date, time, artikel: artikelClean, package:"", price:0, slot: time.startsWith("08") ? "morning" : "afternoon" };
      if(date) days[date].push(obj);
      else unknown.push(obj);
    }
    return;
  }

  for(let i=0; i<matches.length; i++){
    const hit = matches[i];

    const prevIdx = (i === 0) ? Math.max(0, hit.idx - 650) : matches[i-1].idx;
    const nextIdx = (i < matches.length - 1) ? matches[i+1].idx : Math.min(text.length, hit.idx + 750);

    const raw = text.slice(prevIdx, nextIdx).replace(/\s+/g," ").trim();
    const artikelClean = cleanArtikelOneCustomer(raw, hit.time);

    const obj = { date, time: hit.time, artikel: artikelClean, package:"", price:0, slot: hit.time.startsWith("08") ? "morning" : "afternoon" };
    if(date) days[date].push(obj);
    else unknown.push(obj);
  }
}

function cleanArtikelOneCustomer(str, currentTime){
  if(!str) return "";
  let s = String(str).replace(/\s+/g, " ").trim();
  const ct = (currentTime || "").replace(/\s+/g," ");

  const pos = ct ? s.indexOf(ct) : -1;
  if(pos !== -1){
    s = s.slice(Math.max(0, pos - 420));
  }

  const afterPos = ct && s.indexOf(ct) !== -1 ? (s.indexOf(ct) + ct.length) : 0;
  if(afterPos > 0){
    const rest = s.slice(afterPos);
    const next = rest.search(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/);
    if(next !== -1){
      s = s.slice(0, afterPos + next).trim();
    }
  } else {
    const times = [...s.matchAll(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g)];
    if(times.length >= 2){
      s = s.slice(0, times[1].index).trim();
    }
  }

  const rowPos = s.search(/\b\d{1,2}\s*\/\s*\d{1,2}\b/);
  if(rowPos !== -1 && rowPos > 320){
    s = s.slice(0, rowPos).trim();
  }

  return s;
}

function findPkg(t){
  return packages.find(p => p.keys.some(k => (t||"").toLowerCase().includes(k.toLowerCase())));
}

/* ---------- UI ---------- */
function renderTabs(){
  tabs.innerHTML = `<span class="${activeTab=="ALL"?"active":""}" onclick="setTab('ALL')">Gesamt</span>`;
  Object.keys(days).forEach(d=>{
    tabs.innerHTML += `<span class="${activeTab==d?'active':''}" onclick="setTab('${d}')">${d}</span>`;
  });
  tabs.innerHTML += `<span class="${activeTab=="UNK"?"active":""}" onclick="setTab('UNK')">❗ Unbekannt (${unknown.length})</span>`;
}
function setTab(t){ activeTab=t; renderAll(); }

function renderDashboard(){
  let orders = activeTab==="ALL" ? [...Object.values(days).flat()] : activeTab!=="UNK" ? (days[activeTab]||[]) : unknown;
  let pkgSum = orders.reduce((a,b)=>a+(b.price||0),0);

  let pkgCount={};
  packages.filter(p=>p.show).forEach(p=>pkgCount[p.name]=0);
  orders.forEach(o=>{ if(pkgCount[o.package]!=null) pkgCount[o.package]++; });

  let pkgCards = Object.entries(pkgCount).map(([n,c])=>{
    let pkgData=packages.find(p=>p.name===n);
    let ico=pkgData?.icon||"📦";
    let color=pkgData?.color||"#22c55e";
    return `<div class="card" style="background:${color}33;border-color:${color}"><b>${ico} ${n}</b><br>${c} Aufträge</div>`;
  }).join("");

  dashboard.innerHTML = `<div class="card"><b>Aufträge</b><br>${orders.length}</div>
  <div class="card"><b>Pakete €</b><br>${pkgSum.toFixed(2)}</div>${pkgCards}`;
}

function renderOrders(){
  let list = activeTab=="ALL" ? [...Object.values(days).flat()] : activeTab=="UNK" ? unknown : (days[activeTab]||[]);
  orderTable.innerHTML = '<tr><th>Datum</th><th>Zeit</th><th>Artikel</th><th>Paket</th><th>€</th></tr>';

  list.forEach((o,i)=>{
    let sel = '<select onchange="assignPkg(this.value,'+i+')"><option></option>';
    packages.forEach(p=>sel += `<option ${p.name==o.package?'selected':''}>${p.name}</option>`);
    sel += '</select>';

    orderTable.innerHTML += `<tr class="${o.package?'good':'bad'} ${o.slot}">
      <td>${o.date||''}</td><td>${o.time||''}</td><td>${o.artikel||''}</td><td>${sel}</td><td>${o.price||0}</td>
    </tr>`;
  });
}

function assignPkg(name,i){
  let p=packages.find(x=>x.name==name);
  let o=unknown[i];
  if(!o || !p) return;
  o.package=name;
  o.price=p.price;
  unknown.splice(i,1);
  days[o.date]=days[o.date]||[];
  days[o.date].push(o);
  renderAll();
}

function renderAll(){
  renderPackages();
  renderTabs();
  renderDashboard();
  renderOrders();
  fillTimeDropdown();
}

/* ---------- MANUELLER EINTRAG ---------- */
function toggleManual(){
  const el = document.getElementById("manualContent");
  if(!el) return;
  el.style.display = el.style.display === "block" ? "none" : "block";
}
function fillManualPackages(){
  const sel = document.getElementById('m_package');
  if(!sel) return;

  // iOS Safari: Options per DOM API ist stabiler als innerHTML
  sel.innerHTML = '';
  sel.appendChild(new Option('', ''));

  packages.forEach(p => {
    const label = `${p.icon || '📦'} ${p.name}`;
    sel.appendChild(new Option(label, p.name));
  });
}

function addManualEntry(){
  if(!m_date.value || !m_time.value || !m_artikel.value || !m_package.value){
    alert("❗ Bitte alle Felder ausfüllen");
    return;
  }

  const date = formatDateFromPicker(m_date.value);
  const time = m_time.value;
  const text = m_artikel.value.trim();
  const pkgName = m_package.value;

  const pkg = packages.find(p=>p.name===pkgName);
  if(!pkg){
    alert("❗ Paket nicht gefunden");
    return;
  }

  if(!days[date]) days[date] = [];
  days[date].push({
    date, time,
    artikel: text,
    package: pkg.name,
    price: pkg.price,
    slot: time.startsWith("08") ? "morning" : "afternoon",
    manual: true
  });

  activeTab = date;
  m_artikel.value = "";
  m_time.value = "";
  renderAll();
}

/* Pakete beim Rendern auch hier laden */
const _renderPackagesOld = renderPackages;
renderPackages = function(){
  _renderPackagesOld();
  fillManualPackages();
};

/* =========================================================
   =============== GUTSCHRIFT (PDF/XLSX) ===================
   ========================================================= */

/* ---------- GUTSCHRIFT UI ---------- */
function toggleGutschrift(){
  const el = document.getElementById("gsContent");
  if(!el) return;

  const isOpen = el.style.display === "block";
  el.style.display = isOpen ? "none" : "block";

  const acc = document.querySelector(".accordion[onclick*=toggleGutschrift]");
  if(acc) acc.setAttribute("aria-expanded", String(!isOpen));

  // Wichtig: NICHT automatisch rendern wenn leer (keine Dummywerte)
  if(isOpen === false && (gsEntries.length || gsKmEntries.length || gsAltEntries.length)){
    renderGutschriftAll();
  }
}

function toggleWork(){
  const el = document.getElementById('workContent');
  if(!el) return;

  const isOpen = el.style.display === 'block';
  el.style.display = isOpen ? 'none' : 'block';

  const acc = document.querySelector(".accordion[onclick*=toggleWork]");
  if(acc) acc.setAttribute('aria-expanded', String(!isOpen));

  // iOS Safari: erst sichtbar machen, dann rendern
  if(!isOpen){
    requestAnimationFrame(() => {
      renderAll();
      setTimeout(() => renderAll(), 50);
    });
  }
}


function setGsTab(t){
  gsActiveTab = t;
  renderGutschriftAll();
}

function clearGutschrift(){
  gsEntries = [];
  gsKmEntries = [];
  gsAltEntries = [];
  gsInvoice = {};
  gsActiveTab = "ALL";

  // absichtlich NICHT aus localStorage laden -> keine Startwerte
  const dash = document.getElementById("gsDashboard");
  const tabs = document.getElementById("gsTabs");
  const tbl  = document.getElementById("gsTable");
  if(dash) dash.innerHTML = "";
  if(tabs) tabs.innerHTML = "";
  if(tbl)  tbl.innerHTML = "";

  alert("✅ Gutschrift gelöscht.");
}

/* ---------- Helpers ---------- */
function eqMoney(a,b){
  return Math.abs(Number(a||0) - Number(b||0)) < 0.01;
}
function getActivePackages(){
  return packages.filter(p => p && p.show);
}
function normalizePkgName(s){
  // "Premiumliefer- ung" -> "Premiumlieferung"
  return String(s||"")
    .replace(/\s+/g," ")
    .replace(/-\s+/g,"")
    .trim();
}

/* Preis-Match: nur gegen PAKETE die show=true */
function matchMyPackageFromPrice(price){
  const p = Number(price||0);
  const activePkgs = getActivePackages();
  return activePkgs.find(x => eqMoney(p, x.price)) || null;
}

/* Split nach Preis: definierte vs Sonstiges */
function splitEntriesByActivePrices(list){
  const known = [];
  const other = [];

  for(const e of (list||[])){
    const pkg = matchMyPackageFromPrice(e.price);
    if(pkg){
      known.push({ ...e, myPackage: pkg.name });
    } else {
      other.push({ ...e, myPackage: "Sonstiges" });
    }
  }
  return { known, other };
}

/* Dates aus LIEFER-ENTRIES + KM/Alt (für Tabs) */
function getAllDatesFromGutschrift(){
  const set = new Set();
  gsEntries.forEach(e=> e.date && set.add(e.date));
  gsKmEntries.forEach(e=> e.date && set.add(e.date));
  gsAltEntries.forEach(e=> e.date && set.add(e.date));
  return Array.from(set).sort((a,b)=>{
    const pa=a.split(".").reverse().join("-");
    const pb=b.split(".").reverse().join("-");
    return pa.localeCompare(pb);
  });
}

function renderGutschriftTabs(){
  const el = document.getElementById("gsTabs");
  if(!el) return;

  const dates = getAllDatesFromGutschrift();

  let html = `<span class="${gsActiveTab==="ALL"?"active":""}" onclick="setGsTab('ALL')">Gesamt</span>`;
  for(const d of dates){
    html += `<span class="${gsActiveTab===d?"active":""}" onclick="setGsTab('${d}')">${d}</span>`;
  }
  html += `<span class="${gsActiveTab==="OTHER"?"active":""}" onclick="setGsTab('OTHER')">🟫 Sonstiges</span>`;
  html += `<span class="${gsActiveTab==="KM"?"active":""}" onclick="setGsTab('KM')">🛣 KM</span>`;
  html += `<span class="${gsActiveTab==="ALT"?"active":""}" onclick="setGsTab('ALT')">♻ Altgeräte</span>`;
  html += `<span class="${gsActiveTab==="INV"?"active":""}" onclick="setGsTab('INV')">🧾 Rechnung</span>`;

  el.innerHTML = html;
}

function getVisibleRowsForGsTable(){
  // Gesamt: zeige nur Liefer-Entries (Positionen) + (optional) sonst nichts in der Tabelle
  if(gsActiveTab === "ALL"){
    return { mode:"DELIVERY", rows: gsEntries };
  }

  if(gsActiveTab === "OTHER"){
    const { other } = splitEntriesByActivePrices(gsEntries);
    return { mode:"DELIVERY", rows: other };
  }

  if(gsActiveTab === "KM"){
    return { mode:"KM", rows: gsKmEntries };
  }

  if(gsActiveTab === "ALT"){
    return { mode:"ALT", rows: gsAltEntries };
  }

  if(gsActiveTab === "INV"){
    return { mode:"INV", rows: [] };
  }

  // Datum-Tab: Liefer + KM für diesen Tag getrennt (Tabelle zeigt Liefer-Positionen)
  const dayDeliver = gsEntries.filter(e => e.date === gsActiveTab);
  return { mode:"DELIVERY", rows: dayDeliver };
}

/* Dashboard-Regel:
   - ALL: nur Positionen+Summe + KM + Sonstiges (keine Paketcards)
   - DAY: Positionen+Summe + Paketcards (nur show=true & count>0) + Sonstiges + KM dieses Tages
   - OTHER: Positionen+Summe (nur sonstiges)
   - KM: KM Summe + KM gesamt
*/
function renderGutschriftDashboard(){
  const el = document.getElementById("gsDashboard");
  if(!el) return;

  const activePkgs = getActivePackages();

  const allDeliver = gsEntries;
  const allKm = gsKmEntries;
  const allAlt = gsAltEntries;

  const deliverForDay = (d) => gsEntries.filter(x=>x.date===d);
  const kmForDay = (d) => gsKmEntries.filter(x=>x.date===d);

  // Helpers for sums
  const sumPrices = (list) => (list||[]).reduce((a,b)=>a + Number(b.price||b.amount||0), 0);

  const { other: allOther } = splitEntriesByActivePrices(allDeliver);

  // KM total:
  const kmTotalAmount = sumPrices(allKm);
  const kmTotalKm = allKm.reduce((a,b)=>a + Number(b.km||0), 0);

  if(gsActiveTab === "ALL"){
    const totalCount = allDeliver.length;
    const totalSum = sumPrices(allDeliver);
    const otherCount = allOther.length;
    const otherSum = sumPrices(allOther);

    el.innerHTML = `
      <div class="card"><b>Positionen</b><br>${totalCount}</div>
      <div class="card"><b>Summe €</b><br>${totalSum.toFixed(2)}</div>
      <div class="card"><b>🛣 KM</b><br>${kmTotalKm.toFixed(2)} km • ${kmTotalAmount.toFixed(2)} €</div>
      <div class="card" style="background:#a3a3a333;border-color:#a3a3a3"><b>🟫 Sonstiges</b><br>${otherCount} • ${otherSum.toFixed(2)} €</div>
    `;
    return;
  }

  if(gsActiveTab === "OTHER"){
    const totalCount = allOther.length;
    const totalSum = sumPrices(allOther);
    el.innerHTML = `
      <div class="card" style="background:#a3a3a333;border-color:#a3a3a3"><b>🟫 Sonstiges</b><br>${totalCount}</div>
      <div class="card" style="background:#a3a3a333;border-color:#a3a3a3"><b>Summe €</b><br>${totalSum.toFixed(2)}</div>
    `;
    return;
  }

  if(gsActiveTab === "KM"){
    el.innerHTML = `
      <div class="card"><b>🛣 KM gesamt</b><br>${kmTotalKm.toFixed(2)} km</div>
      <div class="card"><b>🛣 KM €</b><br>${kmTotalAmount.toFixed(2)} €</div>
    `;
    return;
  }

  if(gsActiveTab === "ALT"){
    const altSum = sumPrices(allAlt);
    el.innerHTML = `
      <div class="card"><b>♻ Altgeräte</b><br>${allAlt.length}</div>
      <div class="card"><b>Summe €</b><br>${altSum.toFixed(2)}</div>
    `;
    return;
  }

  if(gsActiveTab === "INV"){
    const rows = [];
    for(const [k,v] of Object.entries(gsInvoice||{})){
      rows.push(`<div class="card"><b>${k}</b><br>${v}</div>`);
    }
    el.innerHTML = rows.join("") || `<div class="card"><b>Rechnung</b><br>Keine Daten</div>`;
    return;
  }

  // DAY TAB
  const day = gsActiveTab;
  const dayDeliver = deliverForDay(day);
  const dayKm = kmForDay(day);

  const { other: dayOther } = splitEntriesByActivePrices(dayDeliver);
  const totalCount = dayDeliver.length;
  const totalSum = sumPrices(dayDeliver);

  // Paketcards nur im DAY-Tab:
  const perPkg = {};
  activePkgs.forEach(p=>{
    perPkg[p.name] = { count:0, sum:0, icon:p.icon||"📦", color:p.color||"#22c55e" };
  });

  for(const e of dayDeliver){
    const pkg = matchMyPackageFromPrice(e.price);
    if(pkg && perPkg[pkg.name]){
      perPkg[pkg.name].count += 1;
      perPkg[pkg.name].sum += Number(e.price||0);
    }
  }

  const pkgCards = Object.entries(perPkg)
    .filter(([_,v])=>v.count>0)
    .map(([name,v])=>{
      return `<div class="card" style="background:${v.color}33;border-color:${v.color}">
        <b>${v.icon} ${name}</b><br>${v.count} • ${v.sum.toFixed(2)} €
      </div>`;
    }).join("");

  const dayKmSum = sumPrices(dayKm);
  const dayKmKm = dayKm.reduce((a,b)=>a + Number(b.km||0), 0);

  const otherCount = dayOther.length;
  const otherSum = sumPrices(dayOther);

  el.innerHTML = `
    <div class="card"><b>Positionen</b><br>${totalCount}</div>
    <div class="card"><b>Summe €</b><br>${totalSum.toFixed(2)}</div>
    ${pkgCards}
    <div class="card"><b>🛣 KM</b><br>${dayKmKm.toFixed(2)} km • ${dayKmSum.toFixed(2)} €</div>
    <div class="card" style="background:#a3a3a333;border-color:#a3a3a3"><b>🟫 Sonstiges</b><br>${otherCount} • ${otherSum.toFixed(2)} €</div>
  `;
}

function renderGutschriftTable(){
  const tbl = document.getElementById("gsTable");
  if(!tbl) return;

  const { mode, rows } = getVisibleRowsForGsTable();

  if(mode === "INV"){
    tbl.innerHTML = `
      <tr><th>Rechnung</th><th>Wert</th></tr>
      ${Object.entries(gsInvoice||{}).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
    `;
    return;
  }

  if(mode === "KM"){
    tbl.innerHTML = `
      <tr><th>Datum</th><th>Tour</th><th>KM</th><th>€</th></tr>
    `;
    for(const e of (rows||[])){
      tbl.innerHTML += `
        <tr>
          <td>${e.date||""}</td>
          <td>${e.tour||""}</td>
          <td>${Number(e.km||0).toFixed(2)}</td>
          <td>${Number(e.amount||0).toFixed(2)}</td>
        </tr>
      `;
    }
    return;
  }

  if(mode === "ALT"){
    tbl.innerHTML = `
      <tr><th>Datum</th><th>Beleg</th><th>FO</th><th>Fahrer</th><th>Typ</th><th>€</th></tr>
    `;
    for(const e of (rows||[])){
      tbl.innerHTML += `
        <tr>
          <td>${e.date||""}</td>
          <td>${e.beleg||""}</td>
          <td>${e.fo||""}</td>
          <td>${e.fahrer||""}</td>
          <td>${e.typ||""}</td>
          <td>${Number(e.amount||0).toFixed(2)}</td>
        </tr>
      `;
    }
    return;
  }

  // DELIVERY
  tbl.innerHTML = `
    <tr>
      <th>Datum</th><th>Beleg</th><th>FO</th><th>Fahrer</th><th>Paket (Quelle)</th><th>€</th>
    </tr>
  `;

  for(const e of (rows||[])){
    tbl.innerHTML += `
      <tr>
        <td>${e.date||""}</td>
        <td>${e.beleg||""}</td>
        <td>${e.fo||""}</td>
        <td>${e.fahrer||""}</td>
        <td>${e.paketname||""}</td>
        <td>${Number(e.price||0).toFixed(2)}</td>
      </tr>
    `;
  }
}

function renderGutschriftAll(){
  // wenn alles leer -> nichts anzeigen (keine Dummywerte)
  if(!gsEntries.length && !gsKmEntries.length && !gsAltEntries.length && !Object.keys(gsInvoice||{}).length){
    const dash = document.getElementById("gsDashboard");
    const tabs = document.getElementById("gsTabs");
    const tbl  = document.getElementById("gsTable");
    if(dash) dash.innerHTML = "";
    if(tabs) tabs.innerHTML = "";
    if(tbl)  tbl.innerHTML = "";
    return;
  }

  renderGutschriftTabs();
  renderGutschriftDashboard();
  renderGutschriftTable();
}

/* ---------- IMPORT: PDF oder XLSX ---------- */
async function importGutschrift(files){
  if(!files || !files.length) return;

  const file = files[0];
  const name = (file.name||"").toLowerCase();

  try{
    // Reset vorher
    gsEntries = [];
    gsKmEntries = [];
    gsAltEntries = [];
    gsInvoice = {};
    gsActiveTab = "ALL";

    if(name.endsWith(".xlsx")){
      const parsed = await readGutschriftXlsx(file);
      gsEntries = parsed.entries || [];
      gsKmEntries = parsed.km || [];
      gsAltEntries = parsed.alt || [];
      gsInvoice = parsed.invoice || {};
    } else {
      // Fallback PDF
      const { entries } = await readGutschriftPDF(file);
      gsEntries = entries || [];
      // KM/Alt/Invoice aus PDF sind schwer -> bleiben leer (Excel ist empfohlen)
      gsKmEntries = [];
      gsAltEntries = [];
      gsInvoice = {};
    }

    // Accordion automatisch öffnen
    const content = document.getElementById("gsContent");
    if(content) content.style.display = "block";

    renderGutschriftAll();

    const kmCount = gsKmEntries.length;
    const altCount = gsAltEntries.length;

    alert(`✅ Gutschrift geladen: ${gsEntries.length} Positionen • KM: ${kmCount} • Alt: ${altCount}`);
  }catch(err){
    console.error(err);
    alert("❌ Fehler beim Gutschrift-Import: " + (err && err.message ? err.message : String(err)));
  }
}

/* ---------- XLSX PARSER (BEST) ---------- */
async function readGutschriftXlsx(file){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type:"array" });

  // In deiner Datei: "Table 1" Lieferpositionen, "Table 3" KM, "Table 4" Altgeräte, "Table 5" Rechnung
  const getSheet = (name) => wb.Sheets[name] || null;

  const entries = [];
  const km = [];
  const alt = [];
  let invoice = {};

  // Table 1: Lieferpositionen
  const s1 = getSheet("Table 1");
  if(s1){
    const rows = XLSX.utils.sheet_to_json(s1, { defval:"" });
    for(const r of rows){
      const date = excelDateToDdMmYyyy(r["Lieferdatum"]);
      const beleg = String(r["Beleg"]||"").trim();
      const fo = String(r["FO Nummer"]||"").trim();
      const fahrer = String(r["Fahrer"]||"").trim();
      const price = Number(r["Preis"]||0);
      const paketname = normalizePkgName(r["Paketname"]);
      if(!date || !Number.isFinite(price)) continue;
      entries.push({ date, beleg, fo, fahrer, price, paketname });
    }
  }

  // Table 3: KM
  const s3 = getSheet("Table 3");
  if(s3){
    const rows = XLSX.utils.sheet_to_json(s3, { defval:"" });
    for(const r of rows){
      const tourname = String(r["Tourname"]||"").trim();
      const amount = Number(r["Mehrkilometerpreis"]||0);

      // Beispiel: "01.11.2025 Tour_15 168,97 km"
      const m = tourname.match(/(\d{2}\.\d{2}\.\d{4}).*?(\d+[.,]\d+)\s*km/i);
      const date = m ? m[1] : "";
      const kmVal = m ? Number(String(m[2]).replace(",", ".")) : 0;

      if(!date) continue;
      km.push({ date, tour: tourname, km: kmVal, amount: Number.isFinite(amount) ? amount : 0 });
    }
  }

  // Table 4: Altgeräte
  const s4 = getSheet("Table 4");
  if(s4){
    const rows = XLSX.utils.sheet_to_json(s4, { defval:"" });
    for(const r of rows){
      const date = excelDateToDdMmYyyy(r["Lieferdatum"]);
      const beleg = String(r["Beleg"]||"").trim();
      const fo = String(r["FO Nummer"]||"").trim();
      const fahrer = String(r["Fahrer"]||"").trim();
      const typ = String(r["Typ"]||"").trim();
      const amount = Number(r["Vergütungspreis"]||0);
      if(!date) continue;
      alt.push({ date, beleg, fo, fahrer, typ, amount: Number.isFinite(amount) ? amount : 0 });
    }
  }

  // Table 5: Rechnung / MwSt / Brutto
  const s5 = getSheet("Table 5");
  if(s5){
    const rows = XLSX.utils.sheet_to_json(s5, { header:1, defval:"" });
    // rows = [ [k,v], ...]
    const obj = {};
    for(const row of rows){
      const k = String(row[0]||"").trim();
      const v = String(row[1]||"").trim();
      if(!k || k.toLowerCase()==="bezeichnung") continue;
      if(!v) continue;
      obj[k] = v;
    }
    invoice = obj;
  }

  return { entries, km, alt, invoice };
}

function excelDateToDdMmYyyy(v){
  // v kann Date-Objekt, Number (Excel serial), oder String sein
  if(!v) return "";

  // Date object
  if(Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
    const d = v;
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  }

  // Excel serial number
  if(typeof v === "number" && Number.isFinite(v)){
    const d = XLSX.SSF.parse_date_code(v);
    if(!d) return "";
    return `${String(d.d).padStart(2,"0")}.${String(d.m).padStart(2,"0")}.${String(d.y).padStart(4,"0")}`;
  }

  // String date already
  const s = String(v).trim();
  const m = s.match(/(\d{2}\.\d{2}\.\d{4})/);
  return m ? m[1] : "";
}

/* ---------- PDF READ + PARSE (Fallback) ---------- */
async function readGutschriftPDF(file){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let fullText = "";
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    fullText += "\n" + tc.items.map(it => it.str).join(" ") + "\n";
  }

  fullText = normalizePdfText(fullText);
  const entries = parseGutschriftEntriesFromText(fullText);

  return { entries, rawText: fullText };
}

function normalizePdfText(s){
  return String(s)
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .replace(/liefer￾ung/g, "lieferung")
    .replace(/Aus￾tausch/g, "Austausch")
    .replace(/Pre￾mium/g, "Premium")
    .trim();
}

function parseGutschriftEntriesFromText(text){
  const out = [];
  const rowRe =
    /(\d{2}\.\d{2}\.\d{4})\s+(\S+)\s+(\S+)\s+(.+?)\s+\+(\d{1,3},\d{2})\s*€\s+(.+?)(?=\s+\d{2}\.\d{2}\.\d{4}\s+|\s*$)/g;

  let m;
  while((m = rowRe.exec(text)) !== null){
    const date = m[1];
    const beleg = m[2];
    const fo = m[3];
    const fahrer = (m[4]||"").trim();
    const price = Number(String(m[5]||"").replace(",", "."));
    const paketname = normalizePkgName(m[6]);

    if(!Number.isFinite(price)) continue;
    out.push({ date, beleg, fo, fahrer, price, paketname });
  }
  return out;
}

/* ---------- INIT: keine Dummywerte ---------- */
window.addEventListener("load", ()=>{
  const dash = document.getElementById("gsDashboard");
  const tabs = document.getElementById("gsTabs");
  const tbl  = document.getElementById("gsTable");
  if(dash) dash.innerHTML = "";
  if(tabs) tabs.innerHTML = "";
  if(tbl)  tbl.innerHTML = "";
});
