// ---------- Storage keys ----------
const K_CURRENT = 'gymlog_current';
const K_HISTORY = 'gymlog_history';
const K_TIMER = 'gymlog_timer';
const K_CLIENT_ID = 'gymlog_client_id';
const K_WEIGHT_UNIT = 'gymlog_weight_unit';
const K_LAST_EMAIL = 'gymlog_last_email';
function sheetIdKey(email){ return 'gymlog_sheet_id_' + email; }

// ---------- State ----------
let current = loadCurrent();
let history = loadHistory();
let timer = loadTimer();

function loadCurrent(){ try{ const r=localStorage.getItem(K_CURRENT); if(r) return JSON.parse(r); }catch(e){} return { exercises: [] }; }
function saveCurrent(){ localStorage.setItem(K_CURRENT, JSON.stringify(current)); }
function loadHistory(){ try{ const r=localStorage.getItem(K_HISTORY); if(r) return JSON.parse(r); }catch(e){} return []; }
function saveHistory(){ localStorage.setItem(K_HISTORY, JSON.stringify(history)); }
function loadTimer(){ try{ const r=localStorage.getItem(K_TIMER); if(r) return JSON.parse(r); }catch(e){} return { running:false, elapsedMs:0, startedAt:null }; }
function saveTimer(){ localStorage.setItem(K_TIMER, JSON.stringify(timer)); }
function uid(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2,10)); }
function getWeightUnit(){ return localStorage.getItem(K_WEIGHT_UNIT) || 'kg'; }

// Strip any HTML-ish characters from free-text before it goes into the sheet or DOM.
function sanitizeText(str){ return String(str == null ? '' : str).replace(/[<>]/g, '').slice(0, 200); }

// ---------- Timer ----------
const timerDisplay = document.getElementById('timerDisplay');
const timerToggleBtn = document.getElementById('timerToggleBtn');
const timerResetBtn = document.getElementById('timerResetBtn');

function fmt(ms){
  const total = Math.floor(ms/1000);
  const h = String(Math.floor(total/3600)).padStart(2,'0');
  const m = String(Math.floor((total%3600)/60)).padStart(2,'0');
  const s = String(total%60).padStart(2,'0');
  return h+':'+m+':'+s;
}
function currentElapsed(){
  if(timer.running && timer.startedAt) return timer.elapsedMs + (Date.now() - timer.startedAt);
  return timer.elapsedMs;
}
function renderTimer(){
  timerDisplay.textContent = fmt(currentElapsed());
  timerDisplay.classList.toggle('running', timer.running);
  timerToggleBtn.textContent = timer.running ? 'Stop' : 'Start';
  timerToggleBtn.className = timer.running ? 'btn-stop' : 'btn-primary';
}
timerToggleBtn.addEventListener('click', () => {
  if(timer.running){
    timer.elapsedMs = currentElapsed(); timer.running = false; timer.startedAt = null;
  } else {
    timer.running = true; timer.startedAt = Date.now();
  }
  saveTimer(); renderTimer();
});
timerResetBtn.addEventListener('click', () => {
  timer = { running:false, elapsedMs:0, startedAt:null };
  saveTimer(); renderTimer();
});
setInterval(() => { if(timer.running) renderTimer(); }, 1000);
renderTimer();

// ---------- Workout logging ----------
const exerciseList = document.getElementById('exerciseList');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const saveWorkoutBtn = document.getElementById('saveWorkoutBtn');

function addExercise(focus){
  const ex = { id: uid(), name:'', sets:[{reps:'', weight:''}] };
  current.exercises.push(ex);
  saveCurrent();
  renderExercises(focus ? ex.id : null);
}
function addSet(exId){
  const ex = current.exercises.find(e => e.id === exId);
  ex.sets.push({reps:'', weight:''});
  saveCurrent(); renderExercises();
}
function removeSet(exId, idx){
  const ex = current.exercises.find(e => e.id === exId);
  ex.sets.splice(idx,1);
  if(ex.sets.length === 0) ex.sets.push({reps:'', weight:''});
  saveCurrent(); renderExercises();
}
function removeExercise(exId){
  current.exercises = current.exercises.filter(e => e.id !== exId);
  saveCurrent(); renderExercises();
}
function inputMode(input){ input.setAttribute('inputmode','decimal'); input.setAttribute('pattern','[0-9]*'); }

function renderExercises(focusId){
  const unit = getWeightUnit().toUpperCase();
  exerciseList.innerHTML = '';
  current.exercises.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'exercise';

    const head = document.createElement('div');
    head.className = 'exercise-head';
    const nameInput = document.createElement('input');
    nameInput.className = 'exercise-name';
    nameInput.placeholder = 'Exercise name';
    nameInput.value = ex.name;
    nameInput.addEventListener('input', e => { ex.name = e.target.value; saveCurrent(); });
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-exercise';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove exercise');
    removeBtn.addEventListener('click', () => removeExercise(ex.id));
    head.appendChild(nameInput); head.appendChild(removeBtn);
    card.appendChild(head);

    ex.sets.forEach((set, idx) => {
      const row = document.createElement('div');
      row.className = 'set-row';
      const num = document.createElement('div');
      num.className = 'set-num'; num.textContent = idx+1;

      const repsField = document.createElement('div'); repsField.className = 'set-field';
      const repsLabel = document.createElement('label'); repsLabel.textContent = 'REPS';
      const repsInput = document.createElement('input'); repsInput.type='number'; inputMode(repsInput);
      repsInput.value = set.reps;
      repsInput.addEventListener('input', e => { set.reps = e.target.value; saveCurrent(); });
      repsField.appendChild(repsLabel); repsField.appendChild(repsInput);

      const weightField = document.createElement('div'); weightField.className = 'set-field';
      const weightLabel = document.createElement('label'); weightLabel.textContent = 'WEIGHT (' + unit + ')';
      const weightInput = document.createElement('input'); weightInput.type='number'; inputMode(weightInput);
      weightInput.value = set.weight;
      weightInput.addEventListener('input', e => { set.weight = e.target.value; saveCurrent(); });
      weightField.appendChild(weightLabel); weightField.appendChild(weightInput);

      const rm = document.createElement('button'); rm.className = 'remove-set'; rm.textContent = '✕';
      rm.setAttribute('aria-label', 'Remove set');
      rm.addEventListener('click', () => removeSet(ex.id, idx));

      row.appendChild(num); row.appendChild(repsField); row.appendChild(weightField); row.appendChild(rm);
      card.appendChild(row);
    });

    const addSetBtn = document.createElement('button');
    addSetBtn.className = 'add-set-btn'; addSetBtn.textContent = '+';
    addSetBtn.setAttribute('aria-label', 'Add set');
    addSetBtn.addEventListener('click', () => addSet(ex.id));
    card.appendChild(addSetBtn);

    exerciseList.appendChild(card);
    if(focusId === ex.id) nameInput.focus();
  });
}

addExerciseBtn.addEventListener('click', () => addExercise(true));

saveWorkoutBtn.addEventListener('click', () => {
  const cleanExercises = current.exercises
    .map(ex => ({
      name: sanitizeText(ex.name || 'Unnamed exercise').trim() || 'Unnamed exercise',
      sets: ex.sets
        .filter(s => s.reps !== '' || s.weight !== '')
        .map(s => ({
          reps: s.reps === '' ? '' : Number(s.reps),
          weight: s.weight === '' ? '' : Number(s.weight)
        }))
    }))
    .filter(ex => ex.sets.length > 0);

  if(cleanExercises.length === 0){ alert('Log at least one set before saving.'); return; }

  const entry = {
    id: uid(),
    date: new Date().toISOString(),
    durationMs: currentElapsed(),
    exercises: cleanExercises,
    synced: false
  };
  history.unshift(entry);
  saveHistory();

  current = { exercises: [] };
  saveCurrent();
  renderExercises();

  timer = { running:false, elapsedMs:0, startedAt:null };
  saveTimer(); renderTimer();

  renderHistory();
  renderCalendar();
  refreshSyncBadge();
  syncAll(false);
});

// ---------- History ----------
const historyList = document.getElementById('historyList');
const historyEmptyNote = document.getElementById('historyEmptyNote');

function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'}) +
    ' · ' + d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
}

function renderHistory(){
  historyList.innerHTML = '';
  historyEmptyNote.style.display = history.length ? 'none' : 'block';

  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const head = document.createElement('div');
    head.className = 'history-head';
    const setCount = entry.exercises.reduce((n,e) => n + e.sets.length, 0);
    head.innerHTML = `
      <div>
        <div class="history-date">${formatDate(entry.date)}<span class="sync-tag ${entry.synced?'synced':''}">${entry.synced?'Synced':'Pending'}</span></div>
        <div class="history-meta">${entry.exercises.length} exercise${entry.exercises.length===1?'':'s'} · ${setCount} set${setCount===1?'':'s'} · ${fmt(entry.durationMs||0)}</div>
      </div>
      <div class="history-chevron">▾</div>
    `;

    const body = document.createElement('div');
    body.className = 'history-body';
    entry.exercises.forEach(ex => {
      const block = document.createElement('div');
      block.className = 'hist-exercise';
      const title = document.createElement('div');
      title.className = 'hist-exercise-name'; title.textContent = ex.name;
      block.appendChild(title);
      ex.sets.forEach((s,i) => {
        const line = document.createElement('div');
        line.className = 'hist-set-line';
        line.textContent = `Set ${i+1}:  ${s.reps === '' ? '-' : s.reps} reps  ×  ${s.weight === '' ? '-' : s.weight}`;
        block.appendChild(line);
      });
      body.appendChild(block);
    });

    const actions = document.createElement('div');
    actions.className = 'hist-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger'; delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const msg = entry.synced
        ? 'Delete this workout from the app? It will stay in your Google Sheet — delete it there too if you want it fully gone.'
        : 'Delete this workout? This cannot be undone.';
      if(!confirm(msg)) return;
      history = history.filter(h => h.id !== entry.id);
      saveHistory(); renderHistory(); renderCalendar();
    });
    actions.appendChild(delBtn);
    body.appendChild(actions);

    head.addEventListener('click', () => body.classList.toggle('open'));

    item.appendChild(head); item.appendChild(body);
    historyList.appendChild(item);
  });
}

// ---------- Calendar ----------
const calPrev = document.getElementById('calPrev');
const calNext = document.getElementById('calNext');
const calMonthLabel = document.getElementById('calMonthLabel');
const calGrid = document.getElementById('calGrid');
const dayDetail = document.getElementById('dayDetail');
const dayDetailTitle = document.getElementById('dayDetailTitle');
const dayDetailBody = document.getElementById('dayDetailBody');
const dayDetailClose = document.getElementById('dayDetailClose');
const dayDetailPrev = document.getElementById('dayDetailPrev');
const dayDetailNext = document.getElementById('dayDetailNext');

const today = new Date();
let calView = { year: today.getFullYear(), month: today.getMonth() }; // month 0-indexed

function dateKey(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function entriesByDay(){
  const map = {};
  history.forEach(entry => {
    const key = dateKey(new Date(entry.date));
    if(!map[key]) map[key] = [];
    map[key].push(entry);
  });
  return map;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['S','M','T','W','T','F','S'];

function renderCalendar(){
  calMonthLabel.textContent = MONTH_NAMES[calView.month] + ' ' + calView.year;
  calGrid.innerHTML = '';

  DOW.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dow'; el.textContent = d;
    calGrid.appendChild(el);
  });

  const firstDay = new Date(calView.year, calView.month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(calView.year, calView.month + 1, 0).getDate();
  const map = entriesByDay();
  const todayKey = dateKey(today);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for(let i=0; i<startWeekday; i++){
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    calGrid.appendChild(el);
  }

  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(calView.year, calView.month, day);
    const key = dateKey(d);
    const entries = map[key];
    const isPastOrToday = d <= todayMidnight;
    const el = document.createElement('div');
    el.className = 'cal-day'
      + (entries ? ' has-workout' : '')
      + (!entries && isPastOrToday ? ' rest-day' : '')
      + (key === todayKey ? ' today' : '');
    el.innerHTML = `<span>${day}</span>` + (entries ? '<span class="cal-dot"></span>' : (isPastOrToday ? '<span class="cal-dot-rest"></span>' : ''));
    el.addEventListener('click', () => showDayDetail(key));
    calGrid.appendChild(el);
  }
}

let currentDetailKey = null;

function showDayDetail(key){
  currentDetailKey = key;
  const [y,m,d] = key.split('-').map(Number);
  const label = new Date(y, m-1, d).toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'});
  dayDetailTitle.textContent = label;
  dayDetailBody.innerHTML = '';

  const entries = entriesByDay()[key];
  if(!entries || entries.length === 0){
    const note = document.createElement('div');
    note.className = 'dd-rest-note';
    note.textContent = 'Rest day — no workout logged.';
    dayDetailBody.appendChild(note);
  } else {
    entries.forEach(entry => {
      entry.exercises.forEach(ex => {
        const block = document.createElement('div');
        block.className = 'dd-exercise';
        const title = document.createElement('div');
        title.className = 'dd-exercise-name'; title.textContent = ex.name;
        block.appendChild(title);
        ex.sets.forEach((s,i) => {
          const line = document.createElement('div');
          line.className = 'dd-set-line';
          line.textContent = `Set ${i+1}:  ${s.reps === '' ? '-' : s.reps} reps  ×  ${s.weight === '' ? '-' : s.weight}`;
          block.appendChild(line);
        });
        dayDetailBody.appendChild(block);
      });
    });
  }

  dayDetail.classList.add('open');
}

function shiftDetailDay(delta){
  if(!currentDetailKey) return;
  const [y,m,d] = currentDetailKey.split('-').map(Number);
  const next = new Date(y, m-1, d + delta);
  if(next.getFullYear() !== calView.year || next.getMonth() !== calView.month){
    calView = { year: next.getFullYear(), month: next.getMonth() };
    renderCalendar();
  }
  showDayDetail(dateKey(next));
}
dayDetailPrev.addEventListener('click', () => shiftDetailDay(-1));
dayDetailNext.addEventListener('click', () => shiftDetailDay(1));
dayDetailClose.addEventListener('click', () => dayDetail.classList.remove('open'));

calPrev.addEventListener('click', () => {
  calView.month--; if(calView.month < 0){ calView.month = 11; calView.year--; }
  dayDetail.classList.remove('open');
  renderCalendar();
});
calNext.addEventListener('click', () => {
  calView.month++; if(calView.month > 11){ calView.month = 0; calView.year++; }
  dayDetail.classList.remove('open');
  renderCalendar();
});

// ---------- Google sign-in + Sheets API sync ----------
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const signedOutBlock = document.getElementById('signedOutBlock');
const signedInBlock = document.getElementById('signedInBlock');
const clientIdInput = document.getElementById('clientIdInput');
const clientIdSave = document.getElementById('clientIdSave');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const accountAvatar = document.getElementById('accountAvatar');
const accountEmail = document.getElementById('accountEmail');
const sheetLink = document.getElementById('sheetLink');
const unitKgBtn = document.getElementById('unitKgBtn');
const unitLbBtn = document.getElementById('unitLbBtn');
const sheetSyncNow = document.getElementById('sheetSyncNow');
const syncStatus = document.getElementById('syncStatus');
const syncStatusText = document.getElementById('syncStatusText');
const syncBadge = document.getElementById('syncBadge');

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let userEmail = localStorage.getItem(K_LAST_EMAIL) || null;
let userPicture = null;
let spreadsheetId = null;
let sheetMetaCache = null; // { [tabTitle]: sheetId } for the current spreadsheet

function setSyncStatus(kind, text){
  syncStatus.className = 'sync-status' + (kind ? ' ' + kind : '');
  syncStatusText.textContent = text;
}

function updateAuthUI(){
  const hasClientId = !!localStorage.getItem(K_CLIENT_ID);
  const signedIn = !!accessToken && !!userEmail;

  signedOutBlock.style.display = signedIn ? 'none' : 'block';
  signedInBlock.style.display = signedIn ? 'block' : 'none';
  signInBtn.disabled = !hasClientId;

  if(signedIn){
    accountEmail.textContent = userEmail;
    accountAvatar.src = userPicture || '';
    accountAvatar.style.visibility = userPicture ? 'visible' : 'hidden';
    if(spreadsheetId){
      sheetLink.href = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit';
      sheetLink.style.display = 'inline-block';
    } else {
      sheetLink.style.display = 'none';
    }
    const unit = getWeightUnit();
    unitKgBtn.classList.toggle('active', unit === 'kg');
    unitLbBtn.classList.toggle('active', unit === 'lb');
  }

  refreshSyncBadge();
}

function refreshSyncBadge(){
  const hasClientId = !!localStorage.getItem(K_CLIENT_ID);
  const signedIn = !!accessToken && !!userEmail;
  syncBadge.classList.remove('connected','warn');
  if(!hasClientId){
    setSyncStatus('', 'Not configured — add a Google Client ID above.');
    return;
  }
  if(!signedIn){
    syncBadge.classList.add('warn');
    setSyncStatus('', 'Configured — tap "Sign in with Google" to connect your Sheet.');
    return;
  }
  syncBadge.classList.add('connected');
  const pending = history.filter(h => !h.synced).length;
  setSyncStatus('ok', pending > 0 ? `Signed in · ${pending} unsynced` : 'Signed in · all synced');
}

function initTokenClientIfReady(){
  const clientId = localStorage.getItem(K_CLIENT_ID);
  if(!clientId || !window.google || !google.accounts || !google.accounts.oauth2) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {}
  });
  updateAuthUI();
}

clientIdInput.value = localStorage.getItem(K_CLIENT_ID) || '';
clientIdSave.addEventListener('click', () => {
  const id = clientIdInput.value.trim();
  if(!id){ alert('Paste your Google Client ID first.'); return; }
  localStorage.setItem(K_CLIENT_ID, id);
  initTokenClientIfReady();
  setSyncStatus('ok', 'Client ID saved. Tap "Sign in with Google".');
});

signInBtn.addEventListener('click', () => {
  if(!tokenClient){ alert('Save a valid Google Client ID first.'); return; }
  tokenClient.callback = async (resp) => {
    if(resp.error){ setSyncStatus('err', 'Sign-in failed: ' + resp.error); return; }
    accessToken = resp.access_token;
    tokenExpiry = Date.now() + (resp.expires_in * 1000) - 60000;
    await afterSignIn();
  };
  tokenClient.requestAccessToken({ prompt: 'consent' });
});

signOutBtn.addEventListener('click', () => {
  if(accessToken && window.google && google.accounts && google.accounts.oauth2){
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null; tokenExpiry = 0; userEmail = null; userPicture = null; spreadsheetId = null; sheetMetaCache = null;
  localStorage.removeItem(K_LAST_EMAIL);
  updateAuthUI();
});

unitKgBtn.addEventListener('click', () => { localStorage.setItem(K_WEIGHT_UNIT, 'kg'); updateAuthUI(); renderExercises(); });
unitLbBtn.addEventListener('click', () => { localStorage.setItem(K_WEIGHT_UNIT, 'lb'); updateAuthUI(); renderExercises(); });

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
});

async function afterSignIn(){
  try{
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers:{ Authorization: 'Bearer ' + accessToken } });
    if(!infoRes.ok) throw new Error('Could not read account info (' + infoRes.status + ')');
    const info = await infoRes.json();
    userEmail = info.email;
    userPicture = info.picture || null;
    localStorage.setItem(K_LAST_EMAIL, userEmail);
    updateAuthUI();
    setSyncStatus('ok', 'Signed in. Preparing your Google Sheet…');
    await ensureSpreadsheet();
    updateAuthUI();
    await syncAll(false);
  } catch(err){
    setSyncStatus('err', 'Sign-in error: ' + err.message);
  }
}

async function getValidToken(){
  if(accessToken && Date.now() < tokenExpiry) return accessToken;
  if(!tokenClient) throw new Error('Not configured');
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if(resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in * 1000) - 60000;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function ensureSpreadsheet(){
  const key = sheetIdKey(userEmail);
  const token = await getValidToken();
  let id = localStorage.getItem(key);

  if(id){
    const check = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetId`, { headers:{ Authorization:'Bearer '+token } });
    if(check.ok){ spreadsheetId = id; await loadSheetMeta(token); return id; }
    localStorage.removeItem(key);
  }

  const searchRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name='Gym Log Data' and trashed=false") + '&fields=files(id,name)',
    { headers:{ Authorization:'Bearer '+token } }
  );
  if(searchRes.ok){
    const data = await searchRes.json();
    if(data.files && data.files.length){
      spreadsheetId = data.files[0].id;
      localStorage.setItem(key, spreadsheetId);
      await loadSheetMeta(token);
      return spreadsheetId;
    }
  }

  spreadsheetId = await createSpreadsheet(token);
  localStorage.setItem(key, spreadsheetId);
  return spreadsheetId;
}

async function loadSheetMeta(token){
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, { headers:{ Authorization:'Bearer '+token } });
  if(!res.ok) throw new Error('Failed to read spreadsheet (' + res.status + ')');
  const data = await res.json();
  sheetMetaCache = {};
  data.sheets.forEach(s => { sheetMetaCache[s.properties.title] = s.properties.sheetId; });
}

async function createSpreadsheet(token){
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({
      properties:{ title:'Gym Log Data' },
      sheets:[ { properties:{ title:'Overview' } } ]
    })
  });
  if(!createRes.ok) throw new Error('Failed to create spreadsheet (' + createRes.status + ')');
  const created = await createRes.json();
  const id = created.spreadsheetId;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({
      valueInputOption:'USER_ENTERED',
      data:[
        { range:'Overview!A1', values:[['Gym Log']] },
        { range:'Overview!A2', values:[['Each workout day gets its own tab, named by its date (e.g. "8 Aug 2026"). Tabs appear as you log workouts.']] }
      ]
    })
  });

  sheetMetaCache = {};
  created.sheets.forEach(s => { sheetMetaCache[s.properties.title] = s.properties.sheetId; });

  return id;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function sheetTitleForDate(iso){
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function exerciseRowsForEntry(entry){
  return entry.exercises.map(ex => {
    const reps = ex.sets.map(s => s.reps === '' ? '-' : s.reps).join('+');
    const weight = ex.sets.map(s => s.weight === '' ? '-' : s.weight).join('+');
    return [ex.name, ex.sets.length, reps, weight];
  });
}

async function ensureDateSheet(token, title){
  if(sheetMetaCache && sheetMetaCache[title] != null) return sheetMetaCache[title];

  const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({ requests:[ { addSheet:{ properties:{ title, gridProperties:{ frozenRowCount:1 } } } } ] })
  });
  if(!addRes.ok) throw new Error('Failed to create tab "' + title + '" (' + addRes.status + ')');
  const added = await addRes.json();
  const sheetId = added.replies[0].addSheet.properties.sheetId;

  const unit = getWeightUnit().toUpperCase();
  const headerRange = `'${title}'!A1:D1`;
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
    { method:'PUT', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values:[['Exercise','Sets','Reps',`Weight (${unit})`]] }) }
  );
  if(!headerRes.ok) throw new Error('Failed to write header for "' + title + '" (' + headerRes.status + ')');

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({ requests:[ {
      repeatCell:{
        range:{ sheetId, startRowIndex:0, endRowIndex:1 },
        cell:{ userEnteredFormat:{ textFormat:{ bold:true } } },
        fields:'userEnteredFormat.textFormat.bold'
      }
    } ] })
  });

  if(!sheetMetaCache) sheetMetaCache = {};
  sheetMetaCache[title] = sheetId;
  return sheetId;
}

async function syncEntry(token, entry){
  const title = sheetTitleForDate(entry.date);
  await ensureDateSheet(token, title);

  // If this tab already has rows from an earlier workout logged the same day,
  // add a small time-stamped separator so the two sessions don't blend together.
  const existingRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${title}'!A2:A`)}`,
    { headers:{ Authorization:'Bearer '+token } }
  );
  const existingData = existingRes.ok ? await existingRes.json() : null;
  const hasPriorSession = !!(existingData && existingData.values && existingData.values.length);

  const rows = [];
  if(hasPriorSession){
    const time = new Date(entry.date).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
    rows.push([`— ${time} —`, '', '', '']);
  }
  rows.push(...exerciseRowsForEntry(entry));

  const appendRange = `'${title}'!A1`;
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values: rows }) }
  );
  if(!appendRes.ok) throw new Error('Append failed for "' + title + '" (' + appendRes.status + ')');
}

async function syncAll(showAlerts){
  const hasClientId = !!localStorage.getItem(K_CLIENT_ID);
  if(!hasClientId){
    if(showAlerts) alert('Add your Google Client ID in Settings first.');
    return;
  }
  if(!userEmail){
    if(showAlerts) alert('Sign in with Google in Settings first.');
    return;
  }
  const pending = history.filter(h => !h.synced);
  if(pending.length === 0){
    if(showAlerts) setSyncStatus('ok', 'Already up to date.');
    return;
  }
  try{
    const token = await getValidToken();
    if(!spreadsheetId) await ensureSpreadsheet();
    let failed = 0;
    for(const entry of pending){
      try{ await syncEntry(token, entry); entry.synced = true; }
      catch(e){ failed++; }
    }
    saveHistory();
    renderHistory();
    refreshSyncBadge();
    if(showAlerts){
      if(failed === 0) setSyncStatus('ok', 'Synced successfully.');
      else setSyncStatus('err', `${failed} entr${failed===1?'y':'ies'} failed to sync.`);
    }
  } catch(err){
    if(showAlerts) setSyncStatus('err', 'Sync failed: ' + err.message);
  }
}
sheetSyncNow.addEventListener('click', () => syncAll(true));

// GIS script loads async; poll briefly until it's ready, then wire up the token client.
(function waitForGis(tries){
  if(window.google && google.accounts && google.accounts.oauth2){ initTokenClientIfReady(); return; }
  if(tries <= 0) return;
  setTimeout(() => waitForGis(tries - 1), 200);
})(25);

// ---------- Service worker (installable PWA) ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- Init ----------
if(current.exercises.length === 0){ addExercise(false); } else { renderExercises(); }
renderHistory();
renderCalendar();
updateAuthUI();
