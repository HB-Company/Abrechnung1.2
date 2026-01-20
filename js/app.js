// js/app.js (v8.3)
'use strict';
/* ---------- DOM CACHE ---------- */
let pn, pp, pk, pc, symbolBtn, pkgTable;
let tabs, dashboard, orderTable;
let bar, progressText;
let m_date, m_time, m_artikel, m_package, m_order;



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
  m_order = document.getElementById('m_order');

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
let gsBar, gsProgressText, cmpBar, cmpProgressText;


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
		if(typeof o.orderNo !== "string") o.orderNo = o.orderNo ? String(o.orderNo) : "";


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

      __ocrStatus(`Bild ${done+1}/${files.length}: ${f.name || "Bild"}`);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const scale = isIOS ? 2 : 1.5;
      const pre = await preprocessImage(f, scale);

      __ocrStatus(`OCR läuft… (${done+1}/${files.length})`);
      const r = await worker.recognize(pre, {
        tessedit_pageseg_mode: 6,
        preserve_interword_spaces: '1'
      });

      parseOCR((r && r.data && r.data.text) ? r.data.text : '');

      done++;
__ocrBar(done / files.length);


      __ocrStatus(`${done} / ${files.length}`);
    }

__sortAllOrders();

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
// helpeer funktion parse für bestellnummer 
function ocrDigits(s){
  // OCR-typische Verwechslungen -> Ziffern normalisieren
  return String(s || "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8");
}




function splitByFixiert(segment, parts){
  const reFix = /Fixiert\s+\d/g;
  const pos = [];
  let m;
  while((m = reFix.exec(segment)) !== null){
    pos.push(m.index);
  }

  // wenn nicht genug Fixiert-Treffer: gib Segment als 1 Teil + Rest leer zurück
  if(pos.length < parts){
    const out = [segment.trim()];
    while(out.length < parts) out.push("");
    return out;
  }

  // wir nehmen genau so viele wie gebraucht
  const starts = pos.slice(0, parts);
  const out = [];
  for(let i=0;i<starts.length;i++){
    const a = starts[i];
    const b = (i < starts.length-1) ? starts[i+1] : segment.length;
    out.push(segment.slice(a, b).trim());
  }
  return out;
}

// aus "82/15" -> 2, aus "6083/15" -> 3, aus "689/15" -> 9
function normalizeRowIndex(leftPart, total){
  const d = digitsOnly(leftPart);
  if(!d) return 0;

  // Kandidaten: letzte 2 Ziffern (für 10-17 wichtig), dann letzte 1 Ziffer
  const cands = [];

  if(d.length >= 2){
    const n2 = Number(d.slice(-2));
    if(n2 >= 1 && n2 <= total) cands.push(n2);
  }

  const n1 = Number(d.slice(-1));
  if(n1 >= 1 && n1 <= total) cands.push(n1);

  // fallback: ganze Zahl
  const nAll = Number(d);
  if(Number.isFinite(nAll) && nAll >= 1 && nAll <= total) cands.push(nAll);

  // Priorität: 2-stellig wenn total >= 10
  if(total >= 10){
    const two = cands.find(x => x >= 10);
    if(two) return two;
  }

  return cands[0] || 0;
}




function detectTotalFromText(t){
  const s = String(t || "");

  // 1) Anzahl=xx bevorzugt
  const am = s.match(/Anzahl\s*=?\s*(\d{1,3})/i);
  if(am){
    const n = Number(am[1]);
    if(Number.isFinite(n) && n >= 2 && n <= 80) return n;
  }

  // 2) sonst: häufigster Nenner aus "/xx"
  const denom = {};
  const re = /\/\s*(\d{1,2})\b/g;
  let m;
  while((m = re.exec(s)) !== null){
    const n = Number(m[1]);
    if(n >= 2 && n <= 80) denom[n] = (denom[n]||0) + 1;
  }
  let best = 0, bestC = 0;
  for(const [k,v] of Object.entries(denom)){
    if(v > bestC){ bestC = v; best = Number(k); }
  }
  return best || 15;
}


// split segment into N parts using tolerant "Fixiert"-like anchors + "/total" markers
function splitByFixLike(segment, parts, total){
  const s = String(segment || "");

  // A) sehr toleranter "Fixiert"-Anker (Fixiert, Fixier, Fhriert, Fixi..., usw.)
  const reFix = /\b(?:Fix\w{0,8}|F\w{2,10}rt)\b\s*[0-9OIlSB]/ig;

  // B) Row-Marker-Anker: "<irgendwas>/<total>"
  const reRow = total ? new RegExp(String.raw`[0-9OIlSB]{1,6}\s*\/\s*${total}\b`, "g") : null;

  const pos = [];

  let m;
  while((m = reFix.exec(s)) !== null) pos.push(m.index);

  if(reRow){
    while((m = reRow.exec(s)) !== null) pos.push(m.index);
  }

  // unique + sort
  const starts = Array.from(new Set(pos)).sort((a,b)=>a-b);

  // Wenn wir genug Starts haben: exakt parts Segmente schneiden
  if(starts.length >= parts){
    const cut = starts.slice(0, parts);
    const out = [];
    for(let i=0;i<cut.length;i++){
      const a = cut[i];
      const b = (i < cut.length-1) ? cut[i+1] : s.length;
      out.push(s.slice(a, b).trim());
    }
    return out;
  }

  // Wenn zu wenig Starts: fallback 1) nach Länge gleichmäßig teilen
  // (besser als "eine Zeile fehlt")
  const out = [];
  const len = s.length;
  for(let i=0;i<parts;i++){
    const a = Math.floor((i * len) / parts);
    const b = Math.floor(((i+1) * len) / parts);
    out.push(s.slice(a, b).trim());
  }
  return out;
}


// --- OCR Digit Helper: typische OCR-Verwechslungen korrigieren (nur in Zahlen-Kontext) ---
function __normalizeOcrDigits(raw){
  return String(raw || "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Zz]/g, "2")
    .replace(/[Bb]/g, "8");
}

function digitsOnly(x){
  return String(x || "").replace(/\D/g, "");
}

// --- Erwartete Zeilenzahl aus 1/15, 7/13, 10/17 etc. ---
function __detectExpectedTotal(text){
  const t = String(text || "");
  const re = /([0-9IlOoSsZzBb]{1,2})\s*\/\s*(\d{1,2})/g;

  const count = new Map(); // denom -> occurrences
  let m;
  while((m = re.exec(t)) !== null){
    const denom = parseInt(m[2], 10);
    if(!Number.isFinite(denom) || denom < 2 || denom > 60) continue;
    count.set(denom, (count.get(denom) || 0) + 1);
  }

  // nimm den Nenner der am häufigsten vorkommt
  let best = 0, bestCnt = 0;
  for(const [den, c] of count.entries()){
    if(c > bestCnt){
      best = den; bestCnt = c;
    }
  }
  return best || 0;
}

// --- Bestellnummer robust: bevorzugt "Fixiert <nummer>" ---
function extractOrderNo(str){
  const s0 = String(str || "").replace(/\u00A0/g, " ").replace(/\u202F/g, " ");
  const s = __normalizeOcrDigits(s0);

  // 1) Direkt nach (evtl. OCR-verdrehtem) "Fixiert" suchen
  // z.B. "Fixiert 117540556520" oder "Fixlert 4114 124 3339"
  let m = s.match(/F\s*i\s*x\s*i\s*e?\s*r\s*t[^0-9]{0,10}([0-9][0-9\s-]{6,20})/i);
  if(m){
    const d = digitsOnly(m[1]);
    if(d.length >= 7 && d.length <= 14) return d;
  }

  // 2) Wenn OCR die Spalte schreibt: "Bestellung 123456789"
  m = s.match(/Bestell(?:ung|nr|nummer)?\s*[:#]?\s*([0-9][0-9\s-]{6,20})/i);
  if(m){
    const d = digitsOnly(m[1]);
    if(d.length >= 7 && d.length <= 14) return d;
  }

  // 3) Fallback: erste plausible lange Zahl (7..14), aber NICHT 1/15, nicht PLZ (5-stellig)
  const cand = s.match(/(?:[0-9][0-9\s-]*){7,20}/g) || [];
  let best = "";
  for(const c of cand){
    const d = digitsOnly(c);
    if(d.length >= 7 && d.length <= 14){
      if(d.length > best.length) best = d;
    }
  }
  return best;
}

// --- Zeitfenster aus einem Block holen (erste passende Uhrzeit) ---
function __extractTimeWindow(chunk){
  const m = String(chunk || "").match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/);
  return m ? m[0].replace(/\s+/g, " ") : "";
}

// --- "Fixiert" Anker finden (um Zeilen sauber zu trennen) ---
function __findFixAnchors(text, expectedTotal){
  const t = String(text || "");

  // sehr tolerantes "Fixiert" (mit optionalen Spaces / OCR-Schluckern)
  const re = /F\s*i\s*x\s*i\s*e?\s*r\s*t/gi;

  const anchors = [];
  let m;
  while((m = re.exec(t)) !== null){
    const pos = m.index;

    // nur behalten wenn kurz danach eine plausible Bestellnummer folgt
    const look = t.slice(pos, pos + 80);
    const d = extractOrderNo(look);
    if(d && d.length >= 7) anchors.push(pos);
  }

  // Falls zu viele: nimm die ersten expectedTotal (meist sind die korrekt)
  if(expectedTotal && anchors.length > expectedTotal){
    return anchors.slice(0, expectedTotal);
  }
  return anchors;
}

// --- Alternativ: 1/15 Marker als Anker (falls Fixiert fehlt) ---
function __findRowMarkers(text, expectedTotal){
  const t = String(text || "");
  const denom = expectedTotal || 0;

  // numerator darf auch OCR-Zeichen haben (I statt 1 etc.)
  const re = /([0-9IlOoSsZzBb]{1,2})\s*\/\s*(\d{1,2})/g;

  const marks = [];
  let m;
  while((m = re.exec(t)) !== null){
    const num = parseInt(__normalizeOcrDigits(m[1]).replace(/\D/g,"") || "0", 10);
    const den = parseInt(m[2], 10);

    if(!Number.isFinite(num) || !Number.isFinite(den)) continue;
    if(den < 2 || den > 60) continue;
    if(denom && den !== denom) continue;
    if(num < 1 || (denom && num > denom)) continue;

    marks.push({ pos: m.index, num, den });
  }

  // sortiere nach Position und entferne Duplikate derselben num
  marks.sort((a,b)=>a.pos-b.pos);
  const seen = new Set();
  const out = [];
  for(const x of marks){
    if(seen.has(x.num)) continue;
    seen.add(x.num);
    out.push(x);
  }
  return out;
}

// ✅ NEUES parseOCR: Zeilen über Fixiert/1/15 trennen → keine Zeile “verschlucken”
function parseOCR(text){
  if(!text) return;

  // 1) Datum robust (auch 2-stelliges Jahr)
  let date = "";
  const dm = String(text).match(/(\d{2}\.\d{2}\.\d{2,4})/);
  if(dm){
    date = dm[1];
    // optional: 2-stelliges Jahr -> 20xx
    if(date.length === 8){ // dd.mm.yy
      const yy = date.slice(-2);
      date = date.slice(0,6) + "20" + yy;
    }
  }
  if(date) days[date] = days[date] || [];

  // 2) Normalisieren (Spaces ok, Newlines behalten)
  const raw = String(text).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");
  const expectedTotal = __detectExpectedTotal(raw);

  // 3) Anker finden: zuerst Fixiert (am stabilsten), sonst 1/15-Marker
  let anchors = __findFixAnchors(raw, expectedTotal);

  // wenn Fixiert-Anker zu wenig → Marker probieren
  if(expectedTotal && anchors.length < expectedTotal){
    const marks = __findRowMarkers(raw, expectedTotal);
    if(marks.length){
      anchors = marks.map(x=>x.pos);
    }
  }

  // wenn immer noch keine Anker → fallback: Zeitfenster-Logik wie vorher
  if(!anchors.length){
    const timeRe = /\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g;
    const matches = [];
    let mt;
    while((mt = timeRe.exec(raw)) !== null){
      matches.push({ time: mt[0].replace(/\s+/g," "), idx: mt.index });
    }
    if(matches.length === 0) return;

    for(let i=0; i<matches.length; i++){
      const hit = matches[i];
      const prevIdx = (i === 0) ? Math.max(0, hit.idx - 650) : matches[i-1].idx;
      const nextIdx = (i < matches.length - 1) ? matches[i+1].idx : Math.min(raw.length, hit.idx + 750);
      const chunk = raw.slice(prevIdx, nextIdx).replace(/\s+/g," ").trim();

      const orderNo = extractOrderNo(chunk);
      const artikelClean = cleanArtikelOneCustomer(chunk, hit.time);

      const obj = {
        date,
        time: hit.time,
        orderNo,
        artikel: artikelClean,
        package: "",
        price: 0,
        slot: hit.time.startsWith("08") ? "morning" : "afternoon"
      };
      if(date) days[date].push(obj); else unknown.push(obj);
    }
    return;
  }

  // 4) Mit Ankern sauber in Blöcke splitten
  anchors.sort((a,b)=>a-b);
  const blocks = [];
  for(let i=0;i<anchors.length;i++){
    const start = anchors[i];
    const end = (i < anchors.length-1) ? anchors[i+1] : raw.length;
    const chunk = raw.slice(start, end).replace(/\s+/g," ").trim();
    if(chunk.length > 10) blocks.push(chunk);
  }

  // 5) Objekte bauen – und WICHTIG: wenn expectedTotal bekannt ist, niemals “weniger” anzeigen:
  //    fehlende Zeile wird als Platzhalter eingefügt (damit du sie siehst & manuell fixen kannst)
  const objs = [];
  let lastTime = "";

  for(const chunk of blocks){
    const time = __extractTimeWindow(chunk) || lastTime || "";
    if(time) lastTime = time;

    const orderNo = extractOrderNo(chunk);
    const artikelClean = cleanArtikelOneCustomer(chunk, time);

    objs.push({
      date,
      time,
      orderNo,
      artikel: artikelClean,
      package: "",
      price: 0,
      slot: time.startsWith("08") ? "morning" : "afternoon"
    });
  }

  // 6) Falls OCR einen Anker “verschluckt”: zeige Platzhalter, statt Zeile zu verlieren
  if(expectedTotal && objs.length < expectedTotal){
    const missing = expectedTotal - objs.length;
    for(let i=0;i<missing;i++){
      objs.push({
        date,
        time: lastTime || "",
        orderNo: "",
        artikel: "⚠️ FEHLT (OCR) – bitte manuell prüfen",
        package: "",
        price: 0,
        slot: (lastTime || "").startsWith("08") ? "morning" : "afternoon"
      });
    }
  }

  for(const obj of objs){
    if(date) days[date].push(obj); else unknown.push(obj);
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

//Helfer Tabs Chronilogisch
function __dateKeyToISO(d){ // "dd.mm.yyyy" -> "yyyy-mm-dd"
  const m = String(d||"").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(!m) return "0000-00-00";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function __sortedDayKeys(){
  return Object.keys(days).sort((a,b)=> __dateKeyToISO(a).localeCompare(__dateKeyToISO(b)));
}

function __timeStartMinutes(range){
  const m = String(range||"").match(/(\d{2}):(\d{2})/);
  if(!m) return 9999;
  return (parseInt(m[1],10)*60) + parseInt(m[2],10);
}

function __sortOrdersArray(arr){
  if(!Array.isArray(arr)) return;
  arr.sort((a,b)=>{
    const ta = __timeStartMinutes(a.time);
    const tb = __timeStartMinutes(b.time);
    if(ta !== tb) return ta - tb;

    // stabiler Tie-Breaker
    const oa = String(a.orderNo||"");
    const ob = String(b.orderNo||"");
    if(oa !== ob) return oa.localeCompare(ob);

    return String(a.artikel||"").localeCompare(String(b.artikel||""));
  });
}

function __sortAllOrders(){
  // sort pro Tag
  for(const k of Object.keys(days)){
    __sortOrdersArray(days[k]);
  }
  // unknown auch sortieren (falls Zeiten drin sind)
  __sortOrdersArray(unknown);
}


/* ---------- UI ---------- */
function renderTabs(){
  tabs.innerHTML = `<span class="${activeTab=="ALL"?"active":""}" onclick="setTab('ALL')">Gesamt</span>`;

  // ✅ chronologisch
  const keys = (typeof __sortedDayKeys === "function") ? __sortedDayKeys() : Object.keys(days);

  keys.forEach(d=>{
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
// ===== Jump / Scroll Helpers =====

// Bestellnr normalisieren (nur Ziffern)
function normalizeOrderNo(x){
  const d = digitsOnly(x);
  // Bestellnr ist bei dir meist 9–11, aber wir lassen 7–14 zu (OCR schwankt)
  if(d.length < 7) return "";
  if(d.length > 14) return d.slice(0, 14);
  return d;
}
function escAttr(s){
  return String(s || "").replace(/"/g, "&quot;");
}
function statusSelectHtml(current, onChangeJs){
  const val = current || "";
  return `
    <select class="status-select" onchange="${onChangeJs}">
      <option value="" ${val==="" ? "selected" : ""}>—</option>
      <option value="✅" ${val==="✅" ? "selected" : ""}>✅</option>
      <option value="⚠️" ${val==="⚠️" ? "selected" : ""}>⚠️</option>
      <option value="❌" ${val==="❌" ? "selected" : ""}>❌</option>
    </select>
  `;
}
let __uiOrdersRef = [];

function setWorkOrderNo(i, raw){
  const o = (__uiOrdersRef && __uiOrdersRef[i]) ? __uiOrdersRef[i] : null;
  if(!o) return;
  o.orderNo = normalizeOrderNo(raw);

  // Status nach manueller Änderung erstmal neutral lassen (Vergleich setzt später neu)
  if(o.matchStatus) o.matchStatus = "";

  renderOrders(); // sauber neu zeichnen (einfach & robust auf iPhone/PC)
}

function setWorkStatus(i, status){
  const o = (__uiOrdersRef && __uiOrdersRef[i]) ? __uiOrdersRef[i] : null;
  if(!o) return;
  o.matchStatus = status || "";
  renderOrders();
}
let __uiGsRowsRef = [];

function setGsOrderNo(i, raw){
  const e = (__uiGsRowsRef && __uiGsRowsRef[i]) ? __uiGsRowsRef[i] : null;
  if(!e) return;
  e.orderNo = normalizeOrderNo(raw);
  if(e.matchStatus) e.matchStatus = "";
  renderGutschriftAll();
}
function setGsStatus(i, status){
  const e = (__uiGsRowsRef && __uiGsRowsRef[i]) ? __uiGsRowsRef[i] : null;
  if(!e) return;
  e.matchStatus = status || "";
  renderGutschriftAll();
}
/* ---- Scroll + Highlight ---- */
function scrollToOrderRow(tableId, orderNo){
  const on = normalizeOrderNo(orderNo);
  if(!on) return;

  const tbl = document.getElementById(tableId);
  if(!tbl) return;

  const row = tbl.querySelector(`tr[data-orderno="${on}"]`);
  if(!row) return;

  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.add("row-flash");
  setTimeout(() => row.classList.remove("row-flash"), 1200);
}

// Springt in Accordion (öffnet ihn, wenn nötig)
function openAccordion(contentId, toggleFn){
  const el = document.getElementById(contentId);
  if(!el) return;
  if(el.style.display !== "block"){
    if(typeof toggleFn === "function") toggleFn();
    el.style.display = "block";
  }
}

// Markiert eine Tabellenzeile kurz
function flashRow(tr){
  if(!tr) return;
  tr.classList.add("jump-flash");
  setTimeout(()=>tr.classList.remove("jump-flash"), 1600);
}

// Springe zu Aufträge (Arbeit) anhand Bestellnr
/* ---- Jump: Gutschrift -> Work ---- */

function moneyEq(a, b){
  const x = Number(a || 0);
  const y = Number(b || 0);
  return Math.abs(x - y) < 0.01;
}

// Setzt matchStatus in AUFTRÄGE (days/unknown) und in GUTSCHRIFT (gsEntries)
// Regeln:
// ✅ = gefunden + Preis passt
// ⚠️ = gefunden + Preis abweicht
// ❌ = nicht gefunden
function applyCompareStatuses(){
  // ---- Index: Gutschrift nach Bestellnr ----
  const gsMap = new Map(); // orderNo -> entry
  (gsEntries || []).forEach(e => {
    const on = normalizeOrderNo(e.orderNo || e.beleg || e.fo);
    if(!on) return;
    if(!gsMap.has(on)) gsMap.set(on, e); // ersten behalten
  });

  // ---- Index: Aufträge nach Bestellnr ----
  const workMap = new Map(); // orderNo -> order
  const allWork = [];

  for(const d of Object.keys(days || {})){
    const arr = Array.isArray(days[d]) ? days[d] : [];
    for(const o of arr){
      allWork.push(o);
      const on = normalizeOrderNo(o.orderNo);
      if(on && !workMap.has(on)) workMap.set(on, o);
    }
  }
  if(Array.isArray(unknown)){
    for(const o of unknown){
      allWork.push(o);
      const on = normalizeOrderNo(o.orderNo);
      if(on && !workMap.has(on)) workMap.set(on, o);
    }
  }

  // 1) Status in Aufträge setzen (gegen Gutschrift prüfen)
  for(const o of allWork){
    const on = normalizeOrderNo(o.orderNo);
    if(!on){
      o.matchStatus = "❌";
      continue;
    }
    const g = gsMap.get(on);
    if(!g){
      o.matchStatus = "❌";
      continue;
    }
    // Preisvergleich: Aufträge-Preis (o.price) gegen Gutschrift-Preis (g.price)
    o.matchStatus = moneyEq(o.price, g.price) ? "✅" : "⚠️";
  }

  // 2) Status in Gutschrift setzen (gegen Aufträge prüfen)
  for(const e of (gsEntries || [])){
    const on = normalizeOrderNo(e.orderNo || e.beleg || e.fo);
    if(!on){
      e.matchStatus = "❌";
      continue;
    }
    const o = workMap.get(on);
    if(!o){
      e.matchStatus = "❌";
      continue;
    }
    e.matchStatus = moneyEq(e.price, o.price) ? "✅" : "⚠️";
  }

  // UI refresh
  renderAll();
  renderGutschriftAll();
}

// Springe zu Gutschrift anhand Bestellnr
/* ---- Jump: Work -> Gutschrift ---- */
function jumpToGutschrift(orderNo){
  const on = normalizeOrderNo(orderNo);
  if(!on) return;

  // Accordion öffnen wenn vorhanden
  const gsContent = document.getElementById("gsContent");
  if(gsContent && gsContent.style.display !== "block" && typeof toggleGutschrift === "function"){
    toggleGutschrift();
  }

  // passenden Eintrag finden und ggf. Datums-Tab aktivieren
  const hit = (Array.isArray(gsEntries) ? gsEntries : []).find(x => normalizeOrderNo(x.orderNo || x.beleg || x.fo) === on);
  if(hit && hit.date){
    if(typeof setGsTab === "function") setGsTab(hit.date);
    else { gsActiveTab = hit.date; renderGutschriftAll(); }
  }else{
    // zumindest rendern
    if(typeof renderGutschriftAll === "function") renderGutschriftAll();
  }

  setTimeout(() => scrollToOrderRow("gsTable", on), 60);
}

// UI-Helfer: Referenz auf aktuell gerenderte Auftragsliste (damit Paket-Zuordnung in ALL/Datum/UNK funktioniert)


function renderOrders(){
  const list =
    activeTab === "ALL" ? [...Object.values(days).flat()] :
    activeTab === "UNK" ? (unknown || []) :
    (days[activeTab] || []);

  __uiOrdersRef = list;

  const pkgs = Array.isArray(packages) ? packages : [];

  // Header
  const html = [];
  html.push('<tr><th>Datum</th><th>Uhrzeit</th><th>Bestellnr</th><th>Artikel</th><th>Paket</th><th>Preis €</th></tr>');

  for(let i=0; i<list.length; i++){
    const o = list[i] || {};
    const on = normalizeOrderNo(o.orderNo);

    // Paket-Select (Pakete sind meist wenige -> ok)
    let sel = `<select onchange="assignPkg(this.value,${i})"><option value=""></option>`;
    for(let j=0; j<pkgs.length; j++){
      const p = pkgs[j];
      if(!p) continue;
      const val = escAttr(p.name || "");
      const selected = (p.name === o.package) ? "selected" : "";
      sel += `<option value="${val}" ${selected}>${escAttr(p.name || "")}</option>`;
    }
    sel += `</select>`;

    // Bestellnr: Input + Jump(GS) + Status
    const orderCell =
      `<div class="ord-cell">` +
        `<input class="ord-input" inputmode="numeric" placeholder="Bestellnr" ` +
          `value="${escAttr(on)}" onchange="setWorkOrderNo(${i}, this.value)">` +
        (on ? `<button type="button" class="jump-btn" onclick="jumpToGutschrift('${escAttr(on)}')">GS</button>` : ``) +
        statusSelectHtml(o.matchStatus || "", `setWorkStatus(${i}, this.value)`) +
      `</div>`;

    const trClass = `${o.package ? "good" : "bad"} ${o.slot || ""}`.trim();

    html.push(
      `<tr class="${trClass}" data-orderno="${escAttr(on)}">` +
        `<td data-label="Datum">${escAttr(o.date || "")}</td>` +
        `<td data-label="Uhrzeit">${escAttr(o.time || "")}</td>` +
        `<td data-label="Bestellnr">${orderCell}</td>` +
        `<td data-label="Artikel">${escAttr(o.artikel || "")}</td>` +
        `<td data-label="Paket">${sel}</td>` +
        `<td data-label="Preis €">${Number(o.price || 0)}</td>` +
      `</tr>`
    );
  }

  orderTable.innerHTML = html.join("");
}



function assignPkg(name, i){
  const o = (__uiOrdersRef && __uiOrdersRef[i]) ? __uiOrdersRef[i] : null;
  if(!o) return;

  const p = packages.find(x=>x.name==name);

  if(p){
    o.package = p.name;
    o.price = p.price;
  }else{
    o.package = "";
    o.price = 0;
  }

  // Wenn Auftrag in unknown war und jetzt Paket hat -> in days verschieben
  const unkIdx = Array.isArray(unknown) ? unknown.indexOf(o) : -1;
  if(unkIdx !== -1 && p && o.date){
    unknown.splice(unkIdx, 1);
    days[o.date] = days[o.date] || [];
    days[o.date].push(o);
  }

  renderAll();
}


function renderAll(){
  __sortAllOrders();          // ✅ Sortierung einmal zentral
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
  date,
  time,
  orderNo: (document.getElementById("m_order")?.value || "").trim(),
  artikel: text,
  package: pkg.name,
  price: pkg.price,
  slot: time.startsWith("08") ? "morning" : "afternoon",
  manual: true
});

const mo = document.getElementById("m_order");
if(mo) mo.value = "";

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

  // ✅ KEIN renderAll() mehr hier -> das war der Lag-Killer
  // Falls Tabellen noch nie gerendert wurden, dann nur 1x leicht nachziehen:
  if(!isOpen){
    requestAnimationFrame(() => {
      if(orderTable && (!orderTable.innerHTML || orderTable.innerHTML.length < 30)){
        renderOrders();
      }
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

  const vr = getVisibleRowsForGsTable();
  const mode = vr.mode;
  const rows = vr.rows || [];

  // INV
  if(mode === "INV"){
    const html = [];
    html.push(`<tr><th>Rechnung</th><th>Wert</th></tr>`);
    const entries = Object.entries(gsInvoice || {});
    for(let i=0;i<entries.length;i++){
      const [k,v] = entries[i];
      html.push(`<tr><td>${escAttr(k)}</td><td>${escAttr(v)}</td></tr>`);
    }
    tbl.innerHTML = html.join("");
    return;
  }

  // KM
  if(mode === "KM"){
    const html = [];
    html.push(`<tr><th>Datum</th><th>Tour</th><th>KM</th><th>€</th></tr>`);
    for(let i=0;i<rows.length;i++){
      const e = rows[i] || {};
      html.push(
        `<tr>` +
          `<td>${escAttr(e.date||"")}</td>` +
          `<td>${escAttr(e.tour||"")}</td>` +
          `<td>${Number(e.km||0).toFixed(2)}</td>` +
          `<td>${Number(e.amount||0).toFixed(2)}</td>` +
        `</tr>`
      );
    }
    tbl.innerHTML = html.join("");
    return;
  }

  // ALT
  if(mode === "ALT"){
    const html = [];
    html.push(`<tr><th>Datum</th><th>Beleg</th><th>FO</th><th>Fahrer</th><th>Typ</th><th>€</th></tr>`);
    for(let i=0;i<rows.length;i++){
      const e = rows[i] || {};
      html.push(
        `<tr>` +
          `<td>${escAttr(e.date||"")}</td>` +
          `<td>${escAttr(e.beleg||"")}</td>` +
          `<td>${escAttr(e.fo||"")}</td>` +
          `<td>${escAttr(e.fahrer||"")}</td>` +
          `<td>${escAttr(e.typ||"")}</td>` +
          `<td>${Number(e.amount||0).toFixed(2)}</td>` +
        `</tr>`
      );
    }
    tbl.innerHTML = html.join("");
    return;
  }

  // DELIVERY (mit edit + Jump AU + Status)
  __uiGsRowsRef = rows;

  const html = [];
  html.push(
    `<tr>` +
      `<th>Datum</th><th>Bestellnr/Beleg</th><th>FO</th><th>Fahrer</th><th>Paket (Quelle)</th><th>€</th>` +
    `</tr>`
  );

  for(let i=0;i<rows.length;i++){
    const e = rows[i] || {};
    const on = normalizeOrderNo(e.orderNo || e.beleg || e.fo);

    const orderCell =
      `<div class="ord-cell">` +
        `<input class="ord-input" inputmode="numeric" placeholder="Bestellnr" ` +
          `value="${escAttr(on)}" onchange="setGsOrderNo(${i}, this.value)">` +
        (on ? `<button type="button" class="jump-btn" onclick="jumpToWork('${escAttr(on)}')">AU</button>` : ``) +
        statusSelectHtml(e.matchStatus || "", `setGsStatus(${i}, this.value)`) +
      `</div>` +
      ((!on && e.beleg) ? `<div class="ord-sub">${escAttr(e.beleg)}</div>` : ``);

    html.push(
      `<tr data-orderno="${escAttr(on)}">` +
        `<td>${escAttr(e.date||"")}</td>` +
        `<td>${orderCell}</td>` +
        `<td>${escAttr(e.fo||"")}</td>` +
        `<td>${escAttr(e.fahrer||"")}</td>` +
        `<td>${escAttr(e.paketname||"")}</td>` +
        `<td>${Number(e.price||0).toFixed(2)}</td>` +
      `</tr>`
    );
  }

  tbl.innerHTML = html.join("");
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
//Helfer für Progress 
function __setProg(barEl, textEl, frac, msg){
  try{
    if(textEl && typeof msg === "string") textEl.innerText = msg;
    if(barEl && typeof frac === "number"){
      const f = Math.max(0, Math.min(1, frac));
      barEl.style.width = (f * 100).toFixed(1) + "%";
    }
  }catch(e){}
}

function __resetProg(barEl, textEl){
  __setProg(barEl, textEl, 0, "");
}

/* ---------- IMPORT: PDF oder XLSX ---------- */
async function importGutschrift(files){


  if(!files || !files.length) return;

  const file = files[0];
  const name = (file.name||"").toLowerCase();

  try{
	  	__ensureDom();
__setProg(gsBar, gsProgressText, 0.05, "Gutschrift: starte…");
    // Reset vorher
    gsEntries = [];
    gsKmEntries = [];
    gsAltEntries = [];
    gsInvoice = {};
    gsActiveTab = "ALL";

    if(name.endsWith(".xlsx")){
		__setProg(gsBar, gsProgressText, 0.15, "Gutschrift: XLSX öffnen…");

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

__setProg(gsBar, gsProgressText, 1.00, `✅ Gutschrift geladen: ${gsEntries.length} Positionen`);

    alert(`✅ Gutschrift geladen: ${gsEntries.length} Positionen • KM: ${kmCount} • Alt: ${altCount}`);
  }catch(err){
    console.error(err);
	__setProg(gsBar, gsProgressText, 0, "❌ Gutschrift: Fehler (siehe Konsole)");

    alert("❌ Fehler beim Gutschrift-Import: " + (err && err.message ? err.message : String(err)));
  }
}

__setProg(gsBar, gsProgressText, 0.15, "Gutschrift: XLSX öffnen…");
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

__setProg(gsBar, gsProgressText, 0.35, "Gutschrift: lese Table 1 (Lieferpositionen)…");

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
    // ... innerhalb von Table 1 loop
const orderNo = normalizeOrderNo(beleg) || normalizeOrderNo(fo);
entries.push({ date, beleg, fo, fahrer, price, paketname, orderNo, matchStatus:"" });




    }
  }

__setProg(gsBar, gsProgressText, 0.55, "Gutschrift: lese Table 3 (KM)…");

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

__setProg(gsBar, gsProgressText, 0.70, "Gutschrift: lese Table 4 (Altgeräte)…");
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

__setProg(gsBar, gsProgressText, 0.80, "Gutschrift: lese Table 5 (Rechnung)…");

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
// Vergleichs UI Logik
let cmpActiveTab = "ALL";
let cmpRows = [];

function toggleCompare(){
  const el = document.getElementById("cmpContent");
  if(!el) return;

  const isOpen = el.style.display === "block";
  el.style.display = isOpen ? "none" : "block";

  const acc = document.querySelector(".accordion[onclick*=toggleCompare]");
  if(acc) acc.setAttribute("aria-expanded", String(!isOpen));
}

function setCmpTab(t){
  cmpActiveTab = t;
  renderCompare();
}

function moneyEq(a,b){
  return Math.abs(Number(a||0) - Number(b||0)) < 0.01;
}

function getAllOrderRows(){
  const all = [];
  for(const d of Object.keys(days)){
    if(Array.isArray(days[d])) all.push(...days[d]);
  }
  if(Array.isArray(unknown)) all.push(...unknown);
  return all;
}
function flashRow(tr){
  if(!tr) return;
  tr.classList.add("flash");
  tr.scrollIntoView({ behavior:"smooth", block:"center" });
  setTimeout(()=>tr.classList.remove("flash"), 1200);
}

// Zwischen Tabellen springen
function jumpTo(target, orderNo){
  __ensureDom(); // wichtig, damit auf PC nichts "tot" wird

  const on = normalizeOrderNo(orderNo);
  if(!on) return;

  // --- helper: accordions öffnen (ohne toggle-fehler) ---
  const openContent = (contentId, toggleFnName) => {
    const el = document.getElementById(contentId);
    if(!el) return;
    if(el.style.display !== "block"){
      // aria expanded setzen wenn möglich
      const acc = document.querySelector(`.accordion[onclick*=${toggleFnName}]`);
      if(acc) acc.setAttribute("aria-expanded", "true");

      // toggle aufrufen falls vorhanden
      const fn = window[toggleFnName];
      if(typeof fn === "function") fn();

      el.style.display = "block";
    }
  };

  // --- helper: scroll + flash ---
  const scrollAndFlash = (tableId, on2) => {
    const tbl = document.getElementById(tableId);
    if(!tbl) return;
    const row = tbl.querySelector(`tr[data-orderno="${on2}"]`);
    if(!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("row-flash");
    setTimeout(() => row.classList.remove("row-flash"), 1200);
  };

  if(target === "GS"){
    // 1) Gutschrift öffnen
    openContent("gsContent", "toggleGutschrift");

    // 2) passenden GS-Eintrag finden und Tab setzen
    const hit = (Array.isArray(gsEntries) ? gsEntries : [])
      .find(e => normalizeOrderNo(e.orderNo || e.beleg || e.fo) === on);

    if(hit && hit.date){
      if(typeof setGsTab === "function") setGsTab(hit.date);
      else { gsActiveTab = hit.date; renderGutschriftAll(); }
    } else {
      renderGutschriftAll();
    }

    // 3) nach render scrollen
    setTimeout(() => scrollAndFlash("gsTable", on), 80);
    return;
  }

  if(target === "AUF"){
    // 1) Arbeit öffnen
    openContent("workContent", "toggleWork");

    // 2) passenden Auftrag finden (days oder unknown) -> Tab setzen
    let foundTab = "";

    for(const d of Object.keys(days || {})){
      const arr = Array.isArray(days[d]) ? days[d] : [];
      if(arr.some(o => normalizeOrderNo(o.orderNo) === on)){
        foundTab = d;
        break;
      }
    }
    if(!foundTab && Array.isArray(unknown) && unknown.some(o => normalizeOrderNo(o.orderNo) === on)){
      foundTab = "UNK";
    }

    activeTab = foundTab ? foundTab : "ALL";
    renderAll();

    // 3) nach render scrollen
    setTimeout(() => scrollAndFlash("orderTable", on), 80);
    return;
  }
}
function jumpToGutschrift(orderNo){ return jumpTo("GS", orderNo); }
function jumpToWork(orderNo){ return jumpTo("AUF", orderNo); }
function jumpToOrders(orderNo){ return jumpTo("AUF", orderNo); }


// Gutschrift öffnen + zur Bestellnr springen

function cmpStatusToEmoji(s){
  // Status aus runComparison -> Emoji
  if(s === "OK") return "✅";
  if(s === "PRICE_DIFF") return "⚠️";
  // alles was fehlt oder keine ID -> ❌
  if(s === "MISSING_GS" || s === "MISSING_ORD" || s === "NO_ID") return "❌";
  return "";
}
function __ensureDom(){
  gsBar = gsBar || document.getElementById('gsBar');
  gsProgressText = gsProgressText || document.getElementById('gsProgressText');
  cmpBar = cmpBar || document.getElementById('cmpBar');
  cmpProgressText = cmpProgressText || document.getElementById('cmpProgressText');
}

// UI-Thread kurz freigeben, damit Progress wirklich sichtbar “läuft”
function __yieldUI(){
  return new Promise(res => requestAnimationFrame(() => res()));
}

async function runComparison(){
  __ensureDom();
  __setProg(cmpBar, cmpProgressText, 0.03, "Vergleich: starte…");
  await __yieldUI();

  const orderRows = getAllOrderRows();
  if(!orderRows.length){
    __setProg(cmpBar, cmpProgressText, 0, "❌ Vergleich: keine Aufträge");
    alert("❗ Keine Aufträge vorhanden. Bitte erst Screenshots laden oder manuell Einträge erstellen.");
    return;
  }
  if(!gsEntries || !gsEntries.length){
    __setProg(cmpBar, cmpProgressText, 0, "❌ Vergleich: keine Gutschrift");
    alert("❗ Keine Gutschrift vorhanden. Bitte erst Gutschrift (XLSX/PDF) laden.");
    return;
  }

  // 1) GS index
  __setProg(cmpBar, cmpProgressText, 0.10, `Vergleich: indexiere Gutschrift (${gsEntries.length})…`);
  await __yieldUI();

  const gsMap = new Map(); // orderNo -> [entries]
  for(let i=0;i<gsEntries.length;i++){
    const e = gsEntries[i];
    const id = normalizeOrderNo(e.orderNo || e.beleg || e.fo);
    if(!id) continue;
    if(!gsMap.has(id)) gsMap.set(id, []);
    gsMap.get(id).push(e);

    if(i % 120 === 0){
      __setProg(cmpBar, cmpProgressText, 0.10 + (i/gsEntries.length)*0.10, `Vergleich: indexiere Gutschrift… ${i}/${gsEntries.length}`);
      await __yieldUI();
    }
  }

  // 2) Orders index
  __setProg(cmpBar, cmpProgressText, 0.22, `Vergleich: indexiere Aufträge (${orderRows.length})…`);
  await __yieldUI();

  const ordMap = new Map(); // orderNo -> [orders]
  for(let i=0;i<orderRows.length;i++){
    const o = orderRows[i];
    const id = normalizeOrderNo(o.orderNo); // ✅ BUGFIX: nicht "e...." !
    if(!id) continue;
    if(!ordMap.has(id)) ordMap.set(id, []);
    ordMap.get(id).push(o);

    if(i % 120 === 0){
      __setProg(cmpBar, cmpProgressText, 0.22 + (i/orderRows.length)*0.10, `Vergleich: indexiere Aufträge… ${i}/${orderRows.length}`);
      await __yieldUI();
    }
  }

  const out = [];

  // 3) Orders -> check GS
  __setProg(cmpBar, cmpProgressText, 0.35, "Vergleich: prüfe Aufträge → Gutschrift…");
  await __yieldUI();

  for(let i=0;i<orderRows.length;i++){
    const o = orderRows[i];
    const id = normalizeOrderNo(o.orderNo);

    if(!id){
      out.push({
        status: "NO_ID", orderNo: "",
        date: o.date||"", time: o.time||"", artikel: o.artikel||"",
        myPackage: o.package||"", myPrice: Number(o.price||0),
        gsPrice: null, note: "Keine Bestellnr im Auftrag"
      });
    }else{
      const matches = gsMap.get(id) || [];
      if(matches.length === 0){
        out.push({
          status: "MISSING_GS", orderNo: id,
          date: o.date||"", time: o.time||"", artikel: o.artikel||"",
          myPackage: o.package||"", myPrice: Number(o.price||0),
          gsPrice: null, note: "Bestellnr nicht in Gutschrift"
        });
      }else{
        const g = matches[0];
        const gsPrice = Number(g.price||0);

        if(!moneyEq(o.price, gsPrice)){
          out.push({
            status: "PRICE_DIFF", orderNo: id,
            date: o.date||"", time: o.time||"", artikel: o.artikel||"",
            myPackage: o.package||"", myPrice: Number(o.price||0),
            gsPrice, note: (matches.length>1 ? `Preisabweichung (mehrfach in GS: ${matches.length})` : "Preisabweichung")
          });
        }else{
          out.push({
            status: "OK", orderNo: id,
            date: o.date||"", time: o.time||"", artikel: o.artikel||"",
            myPackage: o.package||"", myPrice: Number(o.price||0),
            gsPrice, note: (matches.length>1 ? `OK (mehrfach in GS: ${matches.length})` : "OK")
          });
        }
      }
    }

    if(i % 25 === 0){
      __setProg(
        cmpBar, cmpProgressText,
        0.35 + (i/orderRows.length)*0.40,
        `Vergleich: Aufträge → GS… ${i+1}/${orderRows.length}`
      );
      await __yieldUI();
    }
  }

  // 4) GS -> missing in Orders
  const gsKeys = Array.from(gsMap.keys());
  __setProg(cmpBar, cmpProgressText, 0.78, "Vergleich: prüfe Gutschrift → Aufträge…");
  await __yieldUI();

  for(let i=0;i<gsKeys.length;i++){
    const id = gsKeys[i];
    if(!ordMap.has(id)){
      const list = gsMap.get(id) || [];
      const g = list[0] || {};
      out.push({
        status: "MISSING_ORD",
        orderNo: id,
        date: g.date||"",
        time: "",
        artikel: g.paketname||"",
        myPackage: "",
        myPrice: null,
        gsPrice: Number(g.price||0),
        note: `In Gutschrift, aber nicht in Aufträgen (GS mehrfach: ${list.length})`
      });
    }

    if(i % 80 === 0){
      __setProg(
        cmpBar, cmpProgressText,
        0.78 + (i/gsKeys.length)*0.17,
        `Vergleich: GS → Aufträge… ${i+1}/${gsKeys.length}`
      );
      await __yieldUI();
    }
  }

  cmpRows = out;

  // Status direkt in Vergleichsliste setzen
  for(const r of cmpRows){
    r.matchStatus = cmpStatusToEmoji(r.status);
  }

  cmpActiveTab = "ALL";

  // Accordion öffnen
  const content = document.getElementById("cmpContent");
  if(content) content.style.display = "block";

  __setProg(cmpBar, cmpProgressText, 0.96, "Vergleich: Status setzen…");
  await __yieldUI();

  // ✅ Status in Arbeit & Gutschrift übernehmen
  applyCompareStatuses();

  __setProg(cmpBar, cmpProgressText, 0.99, "Vergleich: rendern…");
  await __yieldUI();

  renderCompare();

  __setProg(cmpBar, cmpProgressText, 1.00, `✅ Vergleich fertig: ${cmpRows.length} Zeilen`);
}



function renderCompare(){
  const sumEl = document.getElementById("cmpSummary");
  const tabEl = document.getElementById("cmpTabs");
  const tbl = document.getElementById("cmpTable");
  if(!sumEl || !tabEl || !tbl) return;

  const counts = {
    ALL: cmpRows.length,
    OK: cmpRows.filter(r=>r.status==="OK").length,
    PRICE_DIFF: cmpRows.filter(r=>r.status==="PRICE_DIFF").length,
    MISSING_GS: cmpRows.filter(r=>r.status==="MISSING_GS").length,
    MISSING_ORD: cmpRows.filter(r=>r.status==="MISSING_ORD").length,
    NO_ID: cmpRows.filter(r=>r.status==="NO_ID").length
  };

  // Summary Cards
  sumEl.innerHTML = `
    <div class="card"><b>Gesamt</b><br>${counts.ALL}</div>
    <div class="card"><b>✅ OK</b><br>${counts.OK}</div>
    <div class="card"><b>⚠ Preis</b><br>${counts.PRICE_DIFF}</div>
    <div class="card"><b>❌ Fehlt GS</b><br>${counts.MISSING_GS}</div>
    <div class="card"><b>❌ Fehlt Aufträge</b><br>${counts.MISSING_ORD}</div>
    <div class="card"><b>ℹ Keine Nr</b><br>${counts.NO_ID}</div>
  `;

  // Tabs
  tabEl.innerHTML = `
    <span class="${cmpActiveTab==='ALL'?'active':''}" onclick="setCmpTab('ALL')">Alle (${counts.ALL})</span>
    <span class="${cmpActiveTab==='PRICE_DIFF'?'active':''}" onclick="setCmpTab('PRICE_DIFF')">⚠ Preis (${counts.PRICE_DIFF})</span>
    <span class="${cmpActiveTab==='MISSING_GS'?'active':''}" onclick="setCmpTab('MISSING_GS')">❌ Fehlt GS (${counts.MISSING_GS})</span>
    <span class="${cmpActiveTab==='MISSING_ORD'?'active':''}" onclick="setCmpTab('MISSING_ORD')">❌ Fehlt Aufträge (${counts.MISSING_ORD})</span>
    <span class="${cmpActiveTab==='NO_ID'?'active':''}" onclick="setCmpTab('NO_ID')">ℹ Keine Nr (${counts.NO_ID})</span>
    <span class="${cmpActiveTab==='OK'?'active':''}" onclick="setCmpTab('OK')">✅ OK (${counts.OK})</span>
  `;

  // Filter
  const rows = cmpActiveTab==="ALL" ? cmpRows : cmpRows.filter(r=>r.status===cmpActiveTab);

  // Table
  tbl.innerHTML = `
    <tr>
      <th>Status</th><th>Bestellnr</th><th>Datum</th><th>Uhrzeit</th>
      <th>Auftrag</th><th>Paket</th><th>Preis (App)</th><th>Preis (GS)</th><th>Hinweis</th>
    </tr>
  `;

  for(const r of rows){
    let cls = "";
    if(r.status==="OK") cls="cmp-ok";
    else if(r.status==="PRICE_DIFF") cls="cmp-warn";
    else cls="cmp-bad";

    tbl.innerHTML += `
      <tr class="${cls}">
        <td>${r.status}</td>
        <td>
  <div style="display:flex; gap:6px; align-items:center; flex-wrap:nowrap;">
    <b>${r.orderNo||""}</b>
    <button class="chip" onclick="jumpToGutschrift('${r.orderNo||""}')">GS</button>
    <button class="chip" onclick="jumpToOrders('${r.orderNo||""}')">AUF</button>
  </div>
</td>

        <td>${r.date||""}</td>
        <td>${r.time||""}</td>
        <td>${r.artikel||""}</td>
        <td>${r.myPackage||""}</td>
        <td>${r.myPrice==null ? "" : Number(r.myPrice).toFixed(2)}</td>
        <td>${r.gsPrice==null ? "" : Number(r.gsPrice).toFixed(2)}</td>
        <td>${r.note||""}</td>
      </tr>
    `;
  }
}


/* ---------- INIT: keine Dummywerte ---------- */
window.addEventListener("load", ()=>{
  const dash = document.getElementById("gsDashboard");
  const tabs = document.getElementById("gsTabs");
  const tbl  = document.getElementById("gsTable");
  gsBar = document.getElementById('gsBar');
gsProgressText = document.getElementById('gsProgressText');

cmpBar = document.getElementById('cmpBar');
cmpProgressText = document.getElementById('cmpProgressText');

  if(dash) dash.innerHTML = "";
  if(tabs) tabs.innerHTML = "";
  if(tbl)  tbl.innerHTML = "";
});