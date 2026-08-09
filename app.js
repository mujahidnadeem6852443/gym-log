// ---------- Storage keys ----------
const K_CURRENT = 'gymlog_current';
const K_HISTORY = 'gymlog_history';
const K_TIMER = 'gymlog_timer';
const K_CLIENT_ID = 'gymlog_client_id';
const K_WEIGHT_UNIT = 'gymlog_weight_unit';
const K_LAST_EMAIL = 'gymlog_last_email';
const K_DISPLAY_NAME = 'gymlog_display_name';
const K_ACCESS_TOKEN = 'gymlog_access_token';
const K_TOKEN_EXPIRY = 'gymlog_token_expiry';
const K_USER_PICTURE = 'gymlog_user_picture';
const K_SESSION_STARTED = 'gymlog_session_started';
const SESSION_MAX_MS = 3 * 60 * 60 * 1000; // 3 hours — a full workout should never need to reconnect
const K_PENDING_DELETES = 'gymlog_pending_deletes';
const K_EXERCISE_DICT = 'gymlog_exercise_dict';
function sheetIdKey(email){ return 'gymlog_sheet_id_' + email; }

// ---------- State ----------
let current = loadCurrent();
let history = loadHistory();
let timer = loadTimer();
let exerciseDict = loadExerciseDict();

function loadCurrent(){ try{ const r=localStorage.getItem(K_CURRENT); if(r) return JSON.parse(r); }catch(e){} return { exercises: [] }; }
function saveCurrent(){ localStorage.setItem(K_CURRENT, JSON.stringify(current)); }
function loadHistory(){ try{ const r=localStorage.getItem(K_HISTORY); if(r) return JSON.parse(r); }catch(e){} return []; }
function saveHistory(){ localStorage.setItem(K_HISTORY, JSON.stringify(history)); }
function loadTimer(){ try{ const r=localStorage.getItem(K_TIMER); if(r) return JSON.parse(r); }catch(e){} return { running:false, elapsedMs:0, startedAt:null }; }
function saveTimer(){ localStorage.setItem(K_TIMER, JSON.stringify(timer)); }
function loadPendingDeletes(){ try{ const r=localStorage.getItem(K_PENDING_DELETES); if(r) return JSON.parse(r); }catch(e){} return []; }
function savePendingDeletes(list){ localStorage.setItem(K_PENDING_DELETES, JSON.stringify(list)); }
function loadExerciseDict(){
  try{
    const r = localStorage.getItem(K_EXERCISE_DICT);
    if(r){
      const parsed = JSON.parse(r);
      // Migrate the old plain-string-array format to {name, muscle}.
      return parsed.map(item => typeof item === 'string' ? { name: item, muscle: '' } : item);
    }
  }catch(e){}
  return [];
}
function saveExerciseDict(list){ localStorage.setItem(K_EXERCISE_DICT, JSON.stringify(list)); }
function uid(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2,10)); }
function getWeightUnit(){ return localStorage.getItem(K_WEIGHT_UNIT) || 'kg'; }
function getDisplayName(){ return (localStorage.getItem(K_DISPLAY_NAME) || '').trim(); }

// Strip any HTML-ish characters from free-text before it goes into the sheet or DOM.
function sanitizeText(str){ return String(str == null ? '' : str).replace(/[<>]/g, '').slice(0, 200); }

// ---------- Timer ----------
const timerDisplay = document.getElementById('timerDisplay');
const timerToggleBtn = document.getElementById('timerToggleBtn');
const timerSaveBtn = document.getElementById('timerSaveBtn');
const timerResetBtn = document.getElementById('timerResetBtn');

function fmt(ms){
  const total = Math.floor(ms/1000);
  const h = String(Math.floor(total/3600)).padStart(2,'0');
  const m = String(Math.floor((total%3600)/60)).padStart(2,'0');
  const s = String(total%60).padStart(2,'0');
  return h+':'+m+':'+s;
}
function parseDurationToMs(str){
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec((str || '').trim());
  if(!m) return 0;
  return ((parseInt(m[1],10)*3600) + (parseInt(m[2],10)*60) + parseInt(m[3],10)) * 1000;
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

// Independent of Save Workout: stops the clock, commits whatever time has
// accumulated to today's single history record (creating it if this is the
// first thing saved today), and resets to 00:00:00 — entirely separate from
// whether any exercises have been logged yet.
timerSaveBtn.addEventListener('click', () => {
  const elapsed = currentElapsed();
  if(elapsed <= 0){ alert('Start the timer before saving time.'); return; }

  timer = { running:false, elapsedMs:0, startedAt:null };
  saveTimer(); renderTimer();

  commitToTodayEntry([], elapsed);

  renderHistory();
  renderCalendar();
  renderProgress();
  renderAttendance();
  refreshSyncBadge();
});

setInterval(() => { if(timer.running) renderTimer(); }, 1000);
renderTimer();

// ---------- Exercise dictionary ----------
// A standalone, persistent list of {name, muscle} — separate from history,
// so a name (and its muscle group, once set) is remembered the moment you
// type it, not only after the whole workout gets saved. Most-recently-used
// name sits at the front; matching is case-insensitive so "Bench Press" and
// "bench press" collapse into one remembered entry (keeping whichever
// casing you used last).
const MUSCLE_GROUPS = ['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Legs', 'Abs'];
const MUSCLE_ABBR = { Chest:'C', Back:'B', Biceps:'Bi', Triceps:'Tri', Shoulders:'S', Legs:'L', Abs:'A' };

// rememberExercise(name, muscle) — muscle is optional; when omitted, any
// muscle group already remembered for this name is kept as-is rather than
// being cleared.
function rememberExercise(name, muscle){
  const trimmed = sanitizeText(name).trim();
  if(!trimmed) return;
  const key = trimmed.toLowerCase();
  const existing = exerciseDict.find(e => e.name.toLowerCase() === key);
  const finalMuscle = (muscle !== undefined && muscle !== '') ? muscle : (existing ? existing.muscle : '');
  exerciseDict = exerciseDict.filter(e => e.name.toLowerCase() !== key);
  exerciseDict.unshift({ name: trimmed, muscle: finalMuscle });
  if(exerciseDict.length > 300) exerciseDict.length = 300;
  saveExerciseDict(exerciseDict);
}

function getMuscleForExercise(name){
  const key = name.trim().toLowerCase();
  const found = exerciseDict.find(e => e.name.toLowerCase() === key);
  return found ? found.muscle : '';
}

// Dictionary entries first (most-recent-first), then anything already in
// history that somehow isn't in the dictionary yet (e.g. workouts restored
// from the Sheet before this feature existed) — so nothing already logged
// is ever missing from suggestions.
function getExerciseSuggestions(){
  const seen = new Map();
  let order = 0;
  exerciseDict.forEach(e => {
    const key = e.name.toLowerCase();
    if(!seen.has(key)) seen.set(key, { name: e.name, order: order++ });
  });
  history.forEach(entry => {
    entry.exercises.forEach(ex => {
      const key = ex.name.trim().toLowerCase();
      if(!key || seen.has(key)) return;
      seen.set(key, { name: ex.name.trim(), order: order++ });
    });
  });
  return [...seen.values()].sort((a, b) => a.order - b.order).map(v => v.name);
}

// history is stored newest-first, so the first exercise-name match found is
// automatically the most recent occurrence.
function getLastPerformance(exerciseName){
  const key = exerciseName.trim().toLowerCase();
  if(!key) return null;
  for(const entry of history){
    const match = entry.exercises.find(ex => ex.name.trim().toLowerCase() === key);
    if(match) return { date: entry.date, sets: match.sets };
  }
  return null;
}

function formatSetsInline(sets){
  return sets.map(s => `${s.weight === '' ? '-' : s.weight}×${s.reps === '' ? '-' : s.reps}`).join(', ');
}

// Wraps a text input with a lightweight, mobile-reliable suggestion dropdown.
// Uses pointerdown (not click) with preventDefault so tapping a suggestion
// never fires the input's blur first — datalist's native behavior is too
// inconsistent on iOS Safari to rely on for this.
function attachExerciseAutocomplete(input, onSelect){
  const wrap = document.createElement('div');
  wrap.className = 'autocomplete-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const list = document.createElement('div');
  list.className = 'autocomplete-list';
  wrap.appendChild(list);

  function renderSuggestions(){
    const q = input.value.trim().toLowerCase();
    const all = getExerciseSuggestions();
    const matches = (q ? all.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q) : all).slice(0, 6);
    list.innerHTML = '';
    if(matches.length === 0){ list.classList.remove('open'); return; }
    matches.forEach(name => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = name;
      item.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.value = name;
        onSelect(name);
        list.classList.remove('open');
      });
      list.appendChild(item);
    });
    list.classList.add('open');
  }

  input.addEventListener('focus', renderSuggestions);
  input.addEventListener('input', renderSuggestions);
  input.addEventListener('blur', () => list.classList.remove('open'));
}

function createMuscleSelect(currentValue, onChange){
  const select = document.createElement('select');
  select.className = 'exercise-muscle';
  const blankOpt = document.createElement('option');
  blankOpt.value = ''; blankOpt.textContent = 'Muscle group';
  select.appendChild(blankOpt);
  MUSCLE_GROUPS.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    select.appendChild(opt);
  });
  select.value = currentValue || '';
  select.addEventListener('change', e => onChange(e.target.value));
  return select;
}

// ---------- Workout logging ----------
const exerciseList = document.getElementById('exerciseList');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const saveWorkoutBtn = document.getElementById('saveWorkoutBtn');

function addExercise(focus){
  const ex = { id: uid(), name:'', muscle:'', sets:[{reps:'', weight:''}] };
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
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-exercise';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove exercise');
    removeBtn.addEventListener('click', () => removeExercise(ex.id));
    head.appendChild(nameInput); head.appendChild(removeBtn);
    card.appendChild(head);

    const muscleSelect = createMuscleSelect(ex.muscle, (value) => {
      ex.muscle = value; saveCurrent();
      rememberExercise(ex.name, value);
    });
    card.appendChild(muscleSelect);

    const lastPerfEl = document.createElement('div');
    lastPerfEl.className = 'last-performance';
    function updateLastPerf(){
      const perf = getLastPerformance(ex.name);
      if(perf){
        lastPerfEl.innerHTML = '<b>Last:</b> ' + formatSetsInline(perf.sets);
        lastPerfEl.style.display = 'block';
      } else {
        lastPerfEl.style.display = 'none';
      }
    }
    updateLastPerf();
    card.appendChild(lastPerfEl);

    nameInput.addEventListener('input', e => { ex.name = e.target.value; saveCurrent(); updateLastPerf(); });
    nameInput.addEventListener('blur', () => {
      rememberExercise(ex.name, ex.muscle);
      if(!ex.muscle){
        const known = getMuscleForExercise(ex.name);
        if(known){ ex.muscle = known; muscleSelect.value = known; saveCurrent(); }
      }
    });
    attachExerciseAutocomplete(nameInput, (name) => {
      ex.name = name; saveCurrent(); updateLastPerf();
      const known = getMuscleForExercise(name);
      if(known){ ex.muscle = known; muscleSelect.value = known; }
      rememberExercise(name, ex.muscle);
      saveCurrent();
    });

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
      muscle: ex.muscle || '',
      sets: ex.sets
        .filter(s => s.reps !== '' || s.weight !== '')
        .map(s => ({
          reps: s.reps === '' ? '' : Number(s.reps),
          weight: s.weight === '' ? '' : Number(s.weight)
        }))
    }))
    .filter(ex => ex.sets.length > 0);

  if(cleanExercises.length === 0){ alert('Log at least one set before saving.'); return; }

  cleanExercises.forEach(ex => rememberExercise(ex.name, ex.muscle));

  // Exercises only — the stopwatch is fully independent now (see Save Time)
  // and must never be read or reset from here.
  commitToTodayEntry(cleanExercises, 0);

  current = { exercises: [] };
  saveCurrent();
  renderExercises();

  renderHistory();
  renderCalendar();
  renderProgress();
  renderAttendance();
  refreshSyncBadge();
});

// Every save (exercises and/or time) lands in a single history record per
// calendar day. If today already has one, the new exercises are appended
// to it and the elapsed time is added to its running total, then the whole
// thing is re-synced (delete-old-rows + re-append) so the Sheet ends up
// with exactly one consistent block for the day rather than duplicates.
// If today has no entry yet, a fresh one is created and queued normally.
function commitToTodayEntry(newExercises, elapsedMs){
  const todayKey = dateKey(new Date());
  const existing = history.find(h => dateKey(new Date(h.date)) === todayKey);

  if(existing){
    const mergedExercises = existing.exercises.concat(newExercises);
    existing.durationMs = (existing.durationMs || 0) + (elapsedMs || 0);
    saveEditedEntry(existing, mergedExercises); // exercises assign synchronously; Sheet sync runs in background
  } else {
    const id = uid();
    const entry = {
      id,
      mergedIds: [id],
      date: new Date().toISOString(),
      durationMs: elapsedMs || 0,
      exercises: newExercises,
      synced: false
    };
    history.unshift(entry);
    saveHistory();
    syncAll(false);
  }
}

// ---------- History ----------
const historyList = document.getElementById('historyList');
const historyEmptyNote = document.getElementById('historyEmptyNote');
const historySearch = document.getElementById('historySearch');

let editingEntryId = null;

function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'}) +
    ' · ' + d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
}

function matchesHistoryQuery(entry, query){
  if(entry.exercises.some(ex => ex.name.toLowerCase().includes(query))) return true;
  return formatDate(entry.date).toLowerCase().includes(query);
}

function renderHistory(){
  historyList.innerHTML = '';
  const query = historySearch.value.trim().toLowerCase();
  const visible = query ? history.filter(h => matchesHistoryQuery(h, query)) : history;

  if(history.length === 0){
    historyEmptyNote.style.display = 'block';
    historyEmptyNote.textContent = 'No saved workouts yet.';
  } else if(visible.length === 0){
    historyEmptyNote.style.display = 'block';
    historyEmptyNote.textContent = `No workouts match "${historySearch.value.trim()}".`;
  } else {
    historyEmptyNote.style.display = 'none';
  }

  visible.forEach(entry => {
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
    const isEditing = editingEntryId === entry.id;
    if(isEditing) body.classList.add('open');

    if(isEditing){
      renderEditForm(body, entry);
    } else {
      entry.exercises.forEach(ex => {
        const block = document.createElement('div');
        block.className = 'hist-exercise';
        const title = document.createElement('div');
        title.className = 'hist-exercise-name'; title.textContent = ex.name;
        if(ex.muscle){
          const tag = document.createElement('span');
          tag.className = 'muscle-tag'; tag.textContent = ex.muscle;
          title.appendChild(tag);
        }
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

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-ghost'; editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editingEntryId = entry.id;
        renderHistory();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger'; delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteWorkout(entry);
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      body.appendChild(actions);
    }

    head.addEventListener('click', () => { if(!isEditing) body.classList.toggle('open'); });

    item.appendChild(head); item.appendChild(body);
    historyList.appendChild(item);
  });
}

historySearch.addEventListener('input', () => renderHistory());

// In-place workout editor: edits a working copy so Cancel is a no-op, and
// Save re-syncs by deleting the old tagged rows and re-appending corrected
// ones (reusing the exact same functions the delete feature already uses).
function renderEditForm(container, entry){
  const draft = JSON.parse(JSON.stringify(entry.exercises));

  const wrap = document.createElement('div');
  wrap.className = 'edit-form';
  const exList = document.createElement('div');
  wrap.appendChild(exList);

  function renderDraftExercises(){
    exList.innerHTML = '';
    draft.forEach((ex, exIdx) => {
      const card = document.createElement('div');
      card.className = 'exercise';

      const head = document.createElement('div');
      head.className = 'exercise-head';
      const nameInput = document.createElement('input');
      nameInput.className = 'exercise-name'; nameInput.placeholder = 'Exercise name'; nameInput.value = ex.name;
      const rmEx = document.createElement('button');
      rmEx.className = 'remove-exercise'; rmEx.textContent = '✕'; rmEx.setAttribute('aria-label', 'Remove exercise');
      rmEx.addEventListener('click', () => { draft.splice(exIdx, 1); renderDraftExercises(); });
      head.appendChild(nameInput); head.appendChild(rmEx);
      card.appendChild(head);

      const muscleSelect = createMuscleSelect(ex.muscle, (value) => {
        ex.muscle = value;
        rememberExercise(ex.name, value);
      });
      card.appendChild(muscleSelect);

      nameInput.addEventListener('input', e => { ex.name = e.target.value; });
      nameInput.addEventListener('blur', () => {
        rememberExercise(ex.name, ex.muscle);
        if(!ex.muscle){
          const known = getMuscleForExercise(ex.name);
          if(known){ ex.muscle = known; muscleSelect.value = known; }
        }
      });
      attachExerciseAutocomplete(nameInput, (name) => {
        ex.name = name;
        const known = getMuscleForExercise(name);
        if(known){ ex.muscle = known; muscleSelect.value = known; }
        rememberExercise(name, ex.muscle);
      });

      ex.sets.forEach((set, idx) => {
        const row = document.createElement('div');
        row.className = 'set-row';
        const num = document.createElement('div'); num.className = 'set-num'; num.textContent = idx + 1;

        const repsField = document.createElement('div'); repsField.className = 'set-field';
        const repsLabel = document.createElement('label'); repsLabel.textContent = 'REPS';
        const repsInput = document.createElement('input'); repsInput.type = 'number'; inputMode(repsInput);
        repsInput.value = set.reps;
        repsInput.addEventListener('input', e => { set.reps = e.target.value; });
        repsField.appendChild(repsLabel); repsField.appendChild(repsInput);

        const weightField = document.createElement('div'); weightField.className = 'set-field';
        const weightLabel = document.createElement('label'); weightLabel.textContent = 'WEIGHT (' + getWeightUnit().toUpperCase() + ')';
        const weightInput = document.createElement('input'); weightInput.type = 'number'; inputMode(weightInput);
        weightInput.value = set.weight;
        weightInput.addEventListener('input', e => { set.weight = e.target.value; });
        weightField.appendChild(weightLabel); weightField.appendChild(weightInput);

        const rmSet = document.createElement('button'); rmSet.className = 'remove-set'; rmSet.textContent = '✕'; rmSet.setAttribute('aria-label', 'Remove set');
        rmSet.addEventListener('click', () => {
          ex.sets.splice(idx, 1);
          if(ex.sets.length === 0) ex.sets.push({ reps:'', weight:'' });
          renderDraftExercises();
        });

        row.appendChild(num); row.appendChild(repsField); row.appendChild(weightField); row.appendChild(rmSet);
        card.appendChild(row);
      });

      const addSetBtn = document.createElement('button');
      addSetBtn.className = 'add-set-btn'; addSetBtn.textContent = '+'; addSetBtn.setAttribute('aria-label', 'Add set');
      addSetBtn.addEventListener('click', () => { ex.sets.push({ reps:'', weight:'' }); renderDraftExercises(); });
      card.appendChild(addSetBtn);

      exList.appendChild(card);
    });
  }
  renderDraftExercises();

  const addExBtn = document.createElement('button');
  addExBtn.className = 'add-exercise-btn'; addExBtn.textContent = '+ Add Exercise';
  addExBtn.addEventListener('click', () => { draft.push({ id: uid(), name:'', muscle:'', sets:[{reps:'', weight:''}] }); renderDraftExercises(); });
  wrap.appendChild(addExBtn);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'edit-actions';
  const saveBtn = document.createElement('button'); saveBtn.className = 'btn-primary'; saveBtn.textContent = 'Save Changes';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn-ghost'; cancelBtn.textContent = 'Cancel';

  saveBtn.addEventListener('click', async () => {
    const cleaned = draft
      .map(ex => ({
        name: sanitizeText(ex.name || 'Unnamed exercise').trim() || 'Unnamed exercise',
        muscle: ex.muscle || '',
        sets: ex.sets.filter(s => s.reps !== '' || s.weight !== '').map(s => ({
          reps: s.reps === '' ? '' : Number(s.reps),
          weight: s.weight === '' ? '' : Number(s.weight)
        }))
      }))
      .filter(ex => ex.sets.length > 0);
    if(cleaned.length === 0){ alert('A workout needs at least one set.'); return; }

    saveBtn.disabled = true; cancelBtn.disabled = true; saveBtn.textContent = 'Saving…';
    await saveEditedEntry(entry, cleaned);
    editingEntryId = null;
    renderHistory();
    renderCalendar();
    renderProgress();
    renderAttendance();
  });
  cancelBtn.addEventListener('click', () => { editingEntryId = null; renderHistory(); });

  actionsRow.appendChild(saveBtn); actionsRow.appendChild(cancelBtn);
  wrap.appendChild(actionsRow);
  container.appendChild(wrap);
}

async function saveEditedEntry(entry, newExercises){
  entry.exercises = newExercises;
  newExercises.forEach(ex => rememberExercise(ex.name, ex.muscle));
  if(entry.synced && userEmail){
    try{
      const token = await getValidToken();
      await resyncEntryToSheet(token, entry);
      entry.synced = true;
    } catch(err){
      entry.synced = false;
      alert(isAuthError(err)
        ? 'Saved locally. Your Google session expired — sign in again in Settings to push this change to your Sheet.'
        : 'Saved locally, but couldn\'t update Google Sheets (check your connection). It will resync automatically next time.');
    }
  }
  saveHistory();
}

// ---------- Delete with undo ----------
// Local removal is immediate; the matching Sheet rows are only actually
// deleted once the undo window closes, so Undo never needs to talk to
// Google at all. The pending record is durable (localStorage), so if the
// app gets closed before the window closes, it's finalized on next launch
// instead of silently leaving orphan rows in the Sheet forever.
const toastEl = document.getElementById('toast');
let pendingDelete = null;

function showToast(message, actionLabel, actionFn){
  toastEl.innerHTML = '';
  const msg = document.createElement('span'); msg.textContent = message;
  const btn = document.createElement('button'); btn.className = 'toast-action'; btn.textContent = actionLabel;
  btn.addEventListener('click', actionFn);
  toastEl.appendChild(msg); toastEl.appendChild(btn);
  toastEl.classList.add('show');
}
function hideToast(){ toastEl.classList.remove('show'); }

function deleteWorkout(entry){
  if(pendingDelete) finalizePendingDelete();

  const index = history.findIndex(h => h.id === entry.id);
  if(index === -1) return;
  history.splice(index, 1);
  saveHistory();

  const pending = loadPendingDeletes();
  pending.push(entry);
  savePendingDeletes(pending);

  renderHistory(); renderCalendar(); renderProgress(); renderAttendance();

  pendingDelete = { entry, index };
  showToast('Workout deleted', 'Undo', undoDelete);
  pendingDelete.timeoutId = setTimeout(() => finalizePendingDelete(), 5000);
}

function undoDelete(){
  if(!pendingDelete) return;
  clearTimeout(pendingDelete.timeoutId);
  history.splice(pendingDelete.index, 0, pendingDelete.entry);
  saveHistory();
  savePendingDeletes(loadPendingDeletes().filter(e => e.id !== pendingDelete.entry.id));
  renderHistory(); renderCalendar(); renderProgress(); renderAttendance();
  pendingDelete = null;
  hideToast();
}

function finalizePendingDelete(){
  if(!pendingDelete) return;
  clearTimeout(pendingDelete.timeoutId);
  const { entry } = pendingDelete;
  pendingDelete = null;
  hideToast();
  finalizeDeleteById(entry.id, entry);
}

// Attempts the remote cleanup for a queued deletion. Leaves it queued
// (rather than dropping it) whenever the remote delete couldn't actually
// happen yet, so it's retried on a later, signed-in/online session.
async function finalizeDeleteById(id, entryHint){
  const entry = entryHint || loadPendingDeletes().find(e => e.id === id);
  if(!entry) return;

  if(entry.synced){
    if(!userEmail) return; // not signed in this session — retry later
    try{ await deleteFromSheet(entry); }
    catch(err){ return; } // offline or auth failure — retry later
  }

  savePendingDeletes(loadPendingDeletes().filter(e => e.id !== id));
}

async function flushStalePendingDeletes(){
  const pending = loadPendingDeletes();
  for(const entry of pending){
    await finalizeDeleteById(entry.id, entry);
  }
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

// Collapses any history entries sharing a calendar day into one, keeping the
// first entry's id (and so its Sheet rows) as the survivor and appending the
// rest's exercises/duration into it. Used as a one-time cleanup for data
// saved before "one entry per day" existed, and after restoring from the
// Sheet in case multiple devices synced the same day separately. Rows
// already in the Sheet for the entries that get merged away are left alone
// — merging is local-only; the next time that day is saved or edited, the
// re-sync naturally consolidates the Sheet side onto the surviving id too.
function mergeHistoryByDay(entries){
  const byDay = new Map();
  const order = [];
  entries.forEach(entry => {
    if(!entry.mergedIds) entry.mergedIds = [entry.id]; // backfill for entries saved before this field existed
    const key = dateKey(new Date(entry.date));
    if(byDay.has(key)){
      const base = byDay.get(key);
      base.exercises = base.exercises.concat(entry.exercises);
      base.durationMs = (base.durationMs || 0) + (entry.durationMs || 0);
      base.mergedIds = base.mergedIds.concat(entry.mergedIds);
      base.synced = false;
    } else {
      byDay.set(key, entry);
      order.push(key);
    }
  });
  return order.map(k => byDay.get(k)).sort((a, b) => new Date(b.date) - new Date(a.date));
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

// Distinct muscle groups trained across all entries logged that day, in the
// order first encountered, abbreviated (Chest→C, Triceps→Tri, etc.) and
// joined with "/" — e.g. two entries covering Chest and Triceps show "C/Tri".
function muscleAbbrForDay(entries){
  const seen = [];
  entries.forEach(entry => entry.exercises.forEach(ex => {
    if(ex.muscle && !seen.includes(ex.muscle)) seen.push(ex.muscle);
  }));
  if(seen.length === 0) return null;
  return seen.map(m => MUSCLE_ABBR[m] || m.slice(0, 1)).join('/');
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
    let marker = '';
    if(entries){
      const abbr = muscleAbbrForDay(entries);
      marker = abbr ? `<span class="cal-muscle">${abbr}</span>` : '<span class="cal-dot"></span>';
    } else if(isPastOrToday){
      marker = '<span class="cal-dot-rest"></span>';
    }
    el.innerHTML = `<span>${day}</span>` + marker;
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
    const totalDuration = entries.reduce((sum, e) => sum + (e.durationMs || 0), 0);
    if(totalDuration > 0){
      const durationLine = document.createElement('div');
      durationLine.className = 'dd-duration';
      durationLine.textContent = 'Time: ' + fmt(totalDuration);
      dayDetailBody.appendChild(durationLine);
    }
    entries.forEach(entry => {
      entry.exercises.forEach(ex => {
        const block = document.createElement('div');
        block.className = 'dd-exercise';
        const title = document.createElement('div');
        title.className = 'dd-exercise-name'; title.textContent = ex.name;
        if(ex.muscle){
          const tag = document.createElement('span');
          tag.className = 'muscle-tag'; tag.textContent = ex.muscle;
          title.appendChild(tag);
        }
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

// ---------- Progress (progressive overload) ----------
// Status colors are duplicated here as hex (rather than referencing the CSS
// custom properties) because they're written into dynamically generated SVG
// markup — keep in sync with :root in index.html if the theme changes.
const TREND_COLOR = { improved:'#5fd88f', stable:'#4da8ff', declined:'#ff6b6b', none:'#8b9199' };
const CHART_INK = { line:'#2a2d31', muted:'#8b9199', text:'#ececee', ring:'#17191c' };

function computeSetVolume(sets){
  return sets.reduce((sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
}

// Chronological (oldest-first) volume history for one exercise, each point
// tagged with its trend vs. the immediately previous session of the same
// exercise — the actual "progressive overload" comparison. A session within
// 2% of the previous one's volume counts as stable rather than a false
// improve/decline from rounding noise.
function getExerciseTrend(exerciseName){
  const key = exerciseName.trim().toLowerCase();
  if(!key) return [];
  const points = [];
  [...history].reverse().forEach(entry => {
    const ex = entry.exercises.find(e => e.name.trim().toLowerCase() === key);
    if(ex && ex.sets.length){
      points.push({ date: entry.date, volume: computeSetVolume(ex.sets) });
    }
  });
  return points.map((p, i) => {
    if(i === 0) return { ...p, status: null, diffPct: null };
    const prev = points[i - 1];
    const diffPct = prev.volume === 0 ? (p.volume > 0 ? 100 : 0) : ((p.volume - prev.volume) / prev.volume) * 100;
    const status = Math.abs(diffPct) < 2 ? 'stable' : (diffPct > 0 ? 'improved' : 'declined');
    return { ...p, status, diffPct };
  });
}

// Only exercises with 2+ logged sessions have a trend to show.
function getTrendableExercises(){
  return getExerciseSuggestions().filter(name => getExerciseTrend(name).length >= 2);
}

function renderProgressChartSvg(points){
  const W = 320, H = 176, padL = 34, padR = 14, padT = 16, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const volumes = points.map(p => p.volume);
  const minV = Math.min(0, ...volumes);
  const rawMax = Math.max(...volumes, 1);
  const niceMax = Math.ceil(rawMax / 100) * 100;

  const xFor = (i) => points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW;
  const yFor = (v) => padT + plotH - ((v - minV) / ((niceMax - minV) || 1)) * plotH;

  let svg = '';

  // Gridlines: 4 horizontal steps, hairline, recessive, with rounded value labels.
  const steps = 4;
  for(let s = 0; s <= steps; s++){
    const v = minV + (niceMax - minV) * (s / steps);
    const y = yFor(v);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${CHART_INK.line}" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="${CHART_INK.muted}" font-family="ui-monospace,monospace">${Math.round(v)}</text>`;
  }

  // Line segments, colored by the ending point's trend status.
  for(let i = 1; i < points.length; i++){
    const x1 = xFor(i - 1), y1 = yFor(points[i - 1].volume), x2 = xFor(i), y2 = yFor(points[i].volume);
    const color = TREND_COLOR[points[i].status] || TREND_COLOR.none;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
  }

  // Points + sparse x-axis date labels (never every point past a handful).
  const labelEvery = points.length <= 6 ? 1 : Math.ceil(points.length / 5);
  points.forEach((p, i) => {
    const x = xFor(i), y = yFor(p.volume);
    const color = TREND_COLOR[p.status] || TREND_COLOR.none;
    svg += `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="${CHART_INK.ring}" stroke-width="2"/>`;
    if(i === 0 || i === points.length - 1 || i % labelEvery === 0){
      const d = new Date(p.date);
      svg += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${CHART_INK.muted}" font-family="ui-monospace,monospace">${d.getMonth()+1}/${d.getDate()}</text>`;
    }
  });

  // Direct label: value at the endpoint only (the one point the story is about).
  const last = points[points.length - 1];
  const lx = xFor(points.length - 1), ly = yFor(last.volume);
  const labelAbove = ly > padT + 14;
  svg += `<text x="${lx}" y="${labelAbove ? ly - 10 : ly + 18}" text-anchor="middle" font-size="11" font-weight="700" fill="${CHART_INK.text}" font-family="ui-monospace,monospace">${Math.round(last.volume)}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="progress-chart" role="img" aria-label="Volume trend over time">${svg}</svg>`;
}

function renderProgressSummaryHtml(points){
  const last = points[points.length - 1];
  const unit = getWeightUnit();
  if(!last.status){
    return `First logged session — ${Math.round(last.volume)} ${unit} total volume. Log it again to see a trend.`;
  }
  const pct = Math.abs(Math.round(last.diffPct));
  if(last.status === 'stable'){
    return `<span class="trend-flat">→</span> About the same as last time (${Math.round(last.volume)} ${unit})`;
  }
  const cls = last.status === 'improved' ? 'trend-up' : 'trend-down';
  const arrow = last.status === 'improved' ? '↑' : '↓';
  const verb = last.status === 'improved' ? 'up' : 'down';
  return `<span class="${cls}">${arrow}</span> ${verb} ${pct}% vs last time (${Math.round(last.volume)} ${unit})`;
}

function renderProgressSessionList(points, container){
  container.innerHTML = '';
  [...points].reverse().forEach(p => {
    const row = document.createElement('div');
    row.className = 'progress-session-row';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'progress-session-date';
    dateSpan.textContent = new Date(p.date).toLocaleDateString(undefined, { month:'short', day:'numeric' });

    const volSpan = document.createElement('span');
    volSpan.className = 'progress-session-volume';
    volSpan.textContent = Math.round(p.volume) + ' ' + getWeightUnit();

    const badge = document.createElement('span');
    if(p.status){
      badge.className = 'progress-session-badge ' + p.status;
      badge.textContent = p.status === 'improved' ? '↑ Improved' : p.status === 'declined' ? '↓ Declined' : '→ Stable';
    } else {
      badge.className = 'progress-session-badge';
      badge.textContent = 'First';
    }

    row.appendChild(dateSpan); row.appendChild(volSpan); row.appendChild(badge);
    container.appendChild(row);
  });
}

const progressExerciseSelect = document.getElementById('progressExerciseSelect');
const progressChartWrap = document.getElementById('progressChartWrap');
const progressLegend = document.getElementById('progressLegend');
const progressSummary = document.getElementById('progressSummary');
const progressSessionList = document.getElementById('progressSessionList');

function renderProgressForExercise(name){
  const points = getExerciseTrend(name);
  progressChartWrap.innerHTML = renderProgressChartSvg(points);
  progressSummary.innerHTML = renderProgressSummaryHtml(points);
  renderProgressSessionList(points, progressSessionList);
}

function renderProgress(){
  const trendable = getTrendableExercises();
  const prevSelected = progressExerciseSelect.value;

  if(trendable.length === 0){
    progressExerciseSelect.style.display = 'none';
    progressLegend.style.display = 'none';
    progressChartWrap.innerHTML = '<div class="progress-empty">Log the same exercise at least twice to see a progress trend here.</div>';
    progressSummary.innerHTML = '';
    progressSessionList.innerHTML = '';
    return;
  }

  progressExerciseSelect.style.display = 'block';
  progressLegend.style.display = 'flex';
  progressExerciseSelect.innerHTML = '';
  trendable.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    progressExerciseSelect.appendChild(opt);
  });

  const selected = trendable.includes(prevSelected) ? prevSelected : trendable[0];
  progressExerciseSelect.value = selected;
  renderProgressForExercise(selected);
}
progressExerciseSelect.addEventListener('change', (e) => renderProgressForExercise(e.target.value));

// ---------- Attendance (weekly & monthly load + attendance tracking) ----------
// Deliberately independent of the per-exercise Progress feature above: its
// own data aggregation, its own charts, its own Sheet tabs, its own trend
// classification. Progress answers "am I getting stronger at this exercise";
// this answers "how consistently am I showing up, and how much total work
// am I doing, week to week / month to month" — different questions, so nothing
// here reads or writes Progress's state, and vice versa. It reuses only the
// shared TREND_COLOR / CHART_INK style palette and computeSetVolume (pure
// arithmetic, not feature state) so the visual language stays consistent.

function totalLoadForEntry(entry){
  return entry.exercises.reduce((sum, ex) => sum + computeSetVolume(ex.sets), 0);
}

// Sunday-start week boundary — matches the calendar's own S M T W T F S layout.
function weekStartOf(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function weekEndOf(weekStart){
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}
function weekRangeLabel(weekStart){
  const end = weekEndOf(weekStart);
  const fmt = (dt) => dt.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

function monthStartOf(date){
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function monthLabel(monthStart){
  return monthStart.toLocaleDateString(undefined, { month:'short', year:'numeric' });
}
function daysInMonth(monthStart){
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
}

function getWeeklyAggregates(){
  const map = new Map();
  history.forEach(entry => {
    const ws = weekStartOf(entry.date);
    const key = dateKey(ws);
    if(!map.has(key)) map.set(key, { periodStart: ws, days: new Set(), load: 0 });
    const agg = map.get(key);
    agg.days.add(dateKey(new Date(entry.date)));
    agg.load += totalLoadForEntry(entry);
  });
  return [...map.values()]
    .map(agg => ({
      periodStart: agg.periodStart,
      label: weekRangeLabel(agg.periodStart),
      attendance: agg.days.size,
      possibleDays: 7,
      load: agg.load
    }))
    .sort((a, b) => a.periodStart - b.periodStart);
}

function getMonthlyAggregates(){
  const map = new Map();
  history.forEach(entry => {
    const ms = monthStartOf(entry.date);
    const key = dateKey(ms);
    if(!map.has(key)) map.set(key, { periodStart: ms, days: new Set(), load: 0 });
    const agg = map.get(key);
    agg.days.add(dateKey(new Date(entry.date)));
    agg.load += totalLoadForEntry(entry);
  });
  return [...map.values()]
    .map(agg => ({
      periodStart: agg.periodStart,
      label: monthLabel(agg.periodStart),
      attendance: agg.days.size,
      possibleDays: daysInMonth(agg.periodStart),
      load: agg.load
    }))
    .sort((a, b) => a.periodStart - b.periodStart);
}

// Load compares by percent change (same ±2% "stable" band as Progress, for a
// consistent meaning of "stable" app-wide) — attendance compares by plain
// day-count delta, since "2% more days" isn't a meaningful idea at this scale.
function attachLoadTrend(points){
  return points.map((p, i) => {
    if(i === 0) return { ...p, loadStatus:null, loadDiffPct:null };
    const prev = points[i - 1];
    const diffPct = prev.load === 0 ? (p.load > 0 ? 100 : 0) : ((p.load - prev.load) / prev.load) * 100;
    const loadStatus = Math.abs(diffPct) < 2 ? 'stable' : (diffPct > 0 ? 'improved' : 'declined');
    return { ...p, loadStatus, loadDiffPct: diffPct };
  });
}
function attachAttendanceTrend(points){
  return points.map((p, i) => {
    if(i === 0) return { ...p, attStatus:null };
    const prev = points[i - 1];
    const attStatus = p.attendance > prev.attendance ? 'improved' : p.attendance === prev.attendance ? 'stable' : 'declined';
    return { ...p, attStatus };
  });
}

function renderLoadLineSvg(points){
  const W = 320, H = 150, padL = 34, padR = 14, padT = 14, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const values = points.map(p => p.load);
  const minV = Math.min(0, ...values);
  const niceMax = Math.ceil(Math.max(...values, 1) / 100) * 100;
  const xFor = i => points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW;
  const yFor = v => padT + plotH - ((v - minV) / ((niceMax - minV) || 1)) * plotH;

  let svg = '';
  for(let s = 0; s <= 3; s++){
    const v = minV + (niceMax - minV) * (s / 3), y = yFor(v);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${CHART_INK.line}" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="${CHART_INK.muted}" font-family="ui-monospace,monospace">${Math.round(v)}</text>`;
  }
  for(let i = 1; i < points.length; i++){
    const x1 = xFor(i - 1), y1 = yFor(points[i - 1].load), x2 = xFor(i), y2 = yFor(points[i].load);
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TREND_COLOR[points[i].loadStatus] || TREND_COLOR.none}" stroke-width="2" stroke-linecap="round"/>`;
  }
  points.forEach((p, i) => {
    const x = xFor(i), y = yFor(p.load), color = TREND_COLOR[p.loadStatus] || TREND_COLOR.none;
    svg += `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="${CHART_INK.ring}" stroke-width="2"/>`;
  });
  const last = points[points.length - 1];
  const lx = xFor(points.length - 1), ly = yFor(last.load);
  const above = ly > padT + 14;
  svg += `<text x="${lx}" y="${above ? ly - 10 : ly + 18}" text-anchor="middle" font-size="11" font-weight="700" fill="${CHART_INK.text}" font-family="ui-monospace,monospace">${Math.round(last.load)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="attendance-chart" role="img" aria-label="Total load trend">${svg}</svg>`;
}

function renderAttendanceBarSvg(points){
  const W = 320, H = 130, padL = 24, padR = 14, padT = 16, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxPossible = Math.max(...points.map(p => p.possibleDays));
  const barSlot = plotW / points.length;
  const barW = Math.min(22, barSlot * 0.55);
  const baseY = padT + plotH;
  const yFor = v => padT + plotH - (v / maxPossible) * plotH;

  let svg = '';
  const topY = yFor(maxPossible);
  svg += `<line x1="${padL}" y1="${topY}" x2="${W - padR}" y2="${topY}" stroke="${CHART_INK.line}" stroke-width="1" stroke-dasharray="2,3"/>`;
  svg += `<text x="${padL}" y="${topY - 4}" font-size="9" fill="${CHART_INK.muted}" font-family="ui-monospace,monospace">${maxPossible}</text>`;
  svg += `<line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="${CHART_INK.line}" stroke-width="1"/>`;

  points.forEach((p, i) => {
    const cx = padL + barSlot * i + barSlot / 2;
    const barY = yFor(p.attendance);
    const barH = Math.max(baseY - barY, 1);
    const color = TREND_COLOR[p.attStatus] || TREND_COLOR.none;
    svg += `<rect x="${cx - barW / 2}" y="${barY}" width="${barW}" height="${barH}" rx="4" fill="${color}"/>`;
    svg += `<text x="${cx}" y="${barY - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="${CHART_INK.text}" font-family="ui-monospace,monospace">${p.attendance}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="attendance-chart" role="img" aria-label="Days attended per period">${svg}</svg>`;
}

const attendanceTabs = document.getElementById('attendanceTabs');
const attendanceLoadChartWrap = document.getElementById('attendanceLoadChartWrap');
const attendanceDaysChartWrap = document.getElementById('attendanceDaysChartWrap');
const attendanceSummary = document.getElementById('attendanceSummary');
const attendanceList = document.getElementById('attendanceList');

let attendancePeriod = 'week';

function renderAttendance(){
  const raw = attendancePeriod === 'week' ? getWeeklyAggregates() : getMonthlyAggregates();

  if(raw.length === 0){
    attendanceLoadChartWrap.innerHTML = '<div class="attendance-empty">Log a workout to start tracking attendance and load.</div>';
    attendanceDaysChartWrap.innerHTML = '';
    attendanceSummary.innerHTML = '';
    attendanceList.innerHTML = '';
    return;
  }

  const points = attachAttendanceTrend(attachLoadTrend(raw));
  attendanceLoadChartWrap.innerHTML = renderLoadLineSvg(points);
  attendanceDaysChartWrap.innerHTML = renderAttendanceBarSvg(points);

  const last = points[points.length - 1];
  const unit = getWeightUnit();
  const periodWord = attendancePeriod === 'week' ? 'week' : 'month';
  let summaryHtml;
  if(!last.loadStatus){
    summaryHtml = `First ${periodWord} logged — ${last.attendance}/${last.possibleDays} days, ${Math.round(last.load)} ${unit} total load.`;
  } else {
    const loadCls = last.loadStatus === 'improved' ? 'trend-up' : last.loadStatus === 'declined' ? 'trend-down' : 'trend-flat';
    const loadArrow = last.loadStatus === 'improved' ? '↑' : last.loadStatus === 'declined' ? '↓' : '→';
    const loadPct = Math.abs(Math.round(last.loadDiffPct));
    const loadWords = last.loadStatus === 'stable'
      ? `about the same load as last ${periodWord}`
      : `${last.loadStatus === 'improved' ? 'up' : 'down'} ${loadPct}% load vs last ${periodWord}`;
    const attWords = last.attStatus === 'improved' ? 'up on attendance' : last.attStatus === 'declined' ? 'down on attendance' : 'same attendance';
    summaryHtml = `<span class="${loadCls}">${loadArrow}</span> ${loadWords} · ${attWords} (${last.attendance}/${last.possibleDays} days)`;
  }
  attendanceSummary.innerHTML = summaryHtml;

  attendanceList.innerHTML = '';
  [...points].reverse().forEach(p => {
    const row = document.createElement('div');
    row.className = 'attendance-row';

    const top = document.createElement('div');
    top.className = 'attendance-row-top';
    const periodSpan = document.createElement('span');
    periodSpan.className = 'attendance-period';
    periodSpan.textContent = p.label;
    const daysBadge = document.createElement('span');
    daysBadge.className = 'attendance-days-badge' + (p.attStatus ? ' ' + p.attStatus : '');
    daysBadge.textContent = `${p.attendance}/${p.possibleDays} days`;
    top.appendChild(periodSpan); top.appendChild(daysBadge);

    const bottom = document.createElement('div');
    bottom.className = 'attendance-row-bottom';
    const loadSpan = document.createElement('span');
    loadSpan.className = 'attendance-load-value';
    loadSpan.textContent = Math.round(p.load) + ' ' + unit + ' load';
    const loadBadge = document.createElement('span');
    if(p.loadStatus){
      loadBadge.className = 'progress-session-badge ' + p.loadStatus;
      loadBadge.textContent = p.loadStatus === 'improved' ? '↑ Improved' : p.loadStatus === 'declined' ? '↓ Declined' : '→ Stable';
    } else {
      loadBadge.className = 'progress-session-badge';
      loadBadge.textContent = 'First';
    }
    bottom.appendChild(loadSpan); bottom.appendChild(loadBadge);

    row.appendChild(top); row.appendChild(bottom);
    attendanceList.appendChild(row);
  });
}

attendanceTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.attendance-tab');
  if(!btn) return;
  attendancePeriod = btn.dataset.period;
  [...attendanceTabs.children].forEach(b => b.classList.toggle('active', b === btn));
  renderAttendance();
});

// ---------- Google sign-in + Sheets API sync ----------
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const brandGreeting = document.getElementById('brandGreeting');
const nameWelcomeHint = document.getElementById('nameWelcomeHint');
const displayNameInput = document.getElementById('displayNameInput');
const displayNameSave = document.getElementById('displayNameSave');
const signedOutBlock = document.getElementById('signedOutBlock');
const signedInBlock = document.getElementById('signedInBlock');
const clientIdInput = document.getElementById('clientIdInput');
const clientIdSave = document.getElementById('clientIdSave');
const signInBtn = document.getElementById('signInBtn');
const signInBtnLabel = document.getElementById('signInBtnLabel');
const reconnectHint = document.getElementById('reconnectHint');
const setupDetails = document.getElementById('setupDetails');
const signOutBtn = document.getElementById('signOutBtn');
const accountAvatar = document.getElementById('accountAvatar');
const accountEmail = document.getElementById('accountEmail');
const sheetLink = document.getElementById('sheetLink');
const unitKgBtn = document.getElementById('unitKgBtn');
const unitLbBtn = document.getElementById('unitLbBtn');
const sheetSyncNow = document.getElementById('sheetSyncNow');
const restoreFromSheetBtn = document.getElementById('restoreFromSheetBtn');
const syncStatus = document.getElementById('syncStatus');
const syncStatusText = document.getElementById('syncStatusText');
const syncBadge = document.getElementById('syncBadge');

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let userEmail = localStorage.getItem(K_LAST_EMAIL) || null;
let userPicture = localStorage.getItem(K_USER_PICTURE) || null;
let spreadsheetId = null;
let sheetMetaCache = null; // { [tabTitle]: sheetId } for the current spreadsheet

// ---------- Session persistence ----------
// The token-client OAuth flow used here (no backend, so no refresh token)
// only ever issues short-lived (~1hr) access tokens. Persisting the token
// itself means a reload or a swiped-away-and-reopened PWA doesn't need to
// reconnect as long as the token's own lifetime hasn't run out. On top of
// that, an explicit 3-hour app-level session cap — long enough to cover a
// full workout — auto-signs-out once it's exceeded, independent of whether
// the underlying Google browser session is still alive.
function sessionExpired(){
  const started = Number(localStorage.getItem(K_SESSION_STARTED) || 0);
  return !started || (Date.now() - started > SESSION_MAX_MS);
}
function startSession(){
  localStorage.setItem(K_SESSION_STARTED, String(Date.now()));
}
function persistToken(){
  if(accessToken){
    localStorage.setItem(K_ACCESS_TOKEN, accessToken);
    localStorage.setItem(K_TOKEN_EXPIRY, String(tokenExpiry));
  } else {
    localStorage.removeItem(K_ACCESS_TOKEN);
    localStorage.removeItem(K_TOKEN_EXPIRY);
  }
}
function clearSession(){
  accessToken = null; tokenExpiry = 0; userEmail = null; userPicture = null; spreadsheetId = null; sheetMetaCache = null;
  localStorage.removeItem(K_LAST_EMAIL);
  localStorage.removeItem(K_USER_PICTURE);
  localStorage.removeItem(K_ACCESS_TOKEN);
  localStorage.removeItem(K_TOKEN_EXPIRY);
  localStorage.removeItem(K_SESSION_STARTED);
}

// Restore a still-valid token across reloads/relaunches — skips reconnect
// entirely when possible. If the 3-hour session window has already lapsed,
// sign out quietly instead of leaving stale credentials sitting around.
if(userEmail){
  if(sessionExpired()){
    clearSession();
  } else {
    const storedToken = localStorage.getItem(K_ACCESS_TOKEN);
    const storedExpiry = Number(localStorage.getItem(K_TOKEN_EXPIRY) || 0);
    if(storedToken && Date.now() < storedExpiry){
      accessToken = storedToken;
      tokenExpiry = storedExpiry;
    }
  }
}

function setSyncStatus(kind, text){
  syncStatus.className = 'sync-status' + (kind ? ' ' + kind : '');
  syncStatusText.textContent = text;
}

function updateAuthUI(){
  const hasClientId = !!localStorage.getItem(K_CLIENT_ID);
  const signedIn = !!accessToken && !!userEmail;
  const needsReconnect = !signedIn && !!userEmail;

  signedOutBlock.style.display = signedIn ? 'none' : 'block';
  signedInBlock.style.display = signedIn ? 'block' : 'none';
  signInBtn.disabled = !hasClientId;
  signInBtnLabel.textContent = needsReconnect ? 'Reconnect Google Account' : 'Sign in with Google';

  if(needsReconnect){
    reconnectHint.style.display = 'block';
    reconnectHint.textContent = `Welcome back, ${userEmail} — your Google session isn't live right now. Tap below to reconnect and keep syncing.`;
    if(setupDetails) setupDetails.open = false;
  } else {
    reconnectHint.style.display = 'none';
  }

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

  // Best-effort: if we're still within the 3-hour session window but the
  // stored token itself has already expired (app was closed for over an
  // hour), try a silent, non-interactive refresh so no manual tap is
  // needed. Some browsers only allow requestAccessToken off a real click,
  // in which case this quietly fails and the "Reconnect" button (still
  // shown by updateAuthUI above) is the fallback.
  if(userEmail && !accessToken && !sessionExpired()){
    getValidToken().then(() => { updateAuthUI(); syncAll(false); }).catch(() => { updateAuthUI(); });
  }
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
    startSession(); // a fresh interactive sign-in starts a new 3-hour window
    persistToken();
    await afterSignIn();
  };
  tokenClient.requestAccessToken({ prompt: 'consent' });
});

signOutBtn.addEventListener('click', () => {
  if(accessToken && window.google && google.accounts && google.accounts.oauth2){
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  clearSession();
  updateAuthUI();
});

// Enforce the 3-hour cap even if the app is left open continuously through
// it (no reload to trigger the on-load check above).
setInterval(() => {
  if(userEmail && sessionExpired()){
    clearSession();
    updateAuthUI();
    setSyncStatus('', 'Signed out after 3 hours — sign in again to keep syncing.');
  }
}, 60 * 1000);

unitKgBtn.addEventListener('click', () => { localStorage.setItem(K_WEIGHT_UNIT, 'kg'); updateAuthUI(); renderExercises(); });
unitLbBtn.addEventListener('click', () => { localStorage.setItem(K_WEIGHT_UNIT, 'lb'); updateAuthUI(); renderExercises(); });

// ---------- Display name (local, with best-effort sync to the Sheet) ----------
function renderBrandGreeting(){
  const name = getDisplayName();
  if(name){
    brandGreeting.textContent = `Hi, ${name}`;
    brandGreeting.classList.add('show');
  } else {
    brandGreeting.textContent = '';
    brandGreeting.classList.remove('show');
  }
  nameWelcomeHint.style.display = name ? 'none' : 'block';
}
displayNameInput.value = getDisplayName();
renderBrandGreeting();
if(!getDisplayName()) settingsPanel.classList.add('open'); // ask once, first time only

displayNameSave.addEventListener('click', () => {
  const name = displayNameInput.value.trim();
  if(!name){ alert('Enter your name first.'); return; }
  localStorage.setItem(K_DISPLAY_NAME, name);
  renderBrandGreeting();
  if(userEmail && accessToken) syncDisplayNameToSheet(accessToken).catch(() => {});
});

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
    localStorage.setItem(K_USER_PICTURE, userPicture || '');
    updateAuthUI();
    setSyncStatus('ok', 'Signed in. Preparing your Google Sheet…');
    await ensureSpreadsheet();

    // Adopt a display name automatically the first time this device signs
    // in: prefer whatever name is already saved in the Sheet (set from
    // another device), falling back to the Google account's own name.
    // Never overwrites a name already entered locally.
    if(!getDisplayName()){
      const sheetName = await readDisplayNameFromSheet(accessToken).catch(() => null);
      const fallbackName = sheetName || info.name || '';
      if(fallbackName){
        localStorage.setItem(K_DISPLAY_NAME, fallbackName);
        displayNameInput.value = fallbackName;
        renderBrandGreeting();
      }
    } else {
      syncDisplayNameToSheet(accessToken).catch(() => {});
    }
    updateAuthUI();

    const hasRemoteTabs = sheetMetaCache && Object.keys(sheetMetaCache).some(t => t !== 'Overview');
    if(history.length === 0 && hasRemoteTabs){
      if(confirm('We found existing workouts in your Google Sheet. Restore them to this device?')){
        setSyncStatus('ok', 'Restoring…');
        const count = await restoreFromSheet();
        setSyncStatus('ok', count > 0 ? `Restored ${count} workout${count===1?'':'s'} from your Sheet.` : 'Nothing to restore.');
      }
    }

    await flushStalePendingDeletes();
    await syncAll(false);
  } catch(err){
    setSyncStatus('err', isAuthError(err) ? 'Sign-in didn\'t complete — please try again.' : 'Sign-in error: ' + err.message);
  }
}

// Recognizes GIS/OAuth failures specifically, so callers can point the user
// at "reconnect your Google account" instead of a raw error string.
function isAuthError(err){
  const msg = (err && err.message) || '';
  return /not configured|access_denied|interaction_required|consent_required|invalid_grant|login_required|token/i.test(msg);
}

async function getValidToken(){
  if(userEmail && sessionExpired()){
    clearSession();
    updateAuthUI();
    throw new Error('login_required');
  }
  if(accessToken && Date.now() < tokenExpiry) return accessToken;
  if(!tokenClient){
    accessToken = null; persistToken(); updateAuthUI();
    throw new Error('Not configured');
  }
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if(resp.error){
        accessToken = null; persistToken(); updateAuthUI();
        return reject(new Error(resp.error));
      }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in * 1000) - 60000;
      persistToken();
      updateAuthUI();
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

// Overview!A4:B4 holds ['Name', <display name>] — kept separate from the
// A1/A2 intro text above so it's easy to spot and edit by hand in the Sheet.
async function readDisplayNameFromSheet(token){
  if(!spreadsheetId) return null;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Overview!B4`,
    { headers:{ Authorization:'Bearer '+token } }
  );
  if(!res.ok) return null;
  const data = await res.json();
  return (data.values && data.values[0] && data.values[0][0]) || null;
}
async function syncDisplayNameToSheet(token){
  if(!spreadsheetId) return;
  const name = getDisplayName();
  if(!name) return;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Overview!A4:B4?valueInputOption=USER_ENTERED`,
    { method:'PUT', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values:[['Name', name]] }) }
  );
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
    return [ex.name, ex.sets.length, reps, weight, ex.muscle || ''];
  });
}

// Writes "Muscle" into E1 unconditionally — cheap, idempotent, and it's how
// tabs created before this column existed get migrated the next time
// they're synced to, without needing to track which tabs still need it.
async function ensureMuscleHeader(token, title){
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${title}'!E1`)}?valueInputOption=USER_ENTERED`,
    { method:'PUT', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values:[['Muscle']] }) }
  );
}

async function ensureDateSheet(token, title){
  if(sheetMetaCache && sheetMetaCache[title] != null){
    await ensureMuscleHeader(token, title);
    return sheetMetaCache[title];
  }

  const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({ requests:[ { addSheet:{ properties:{ title, gridProperties:{ frozenRowCount:1 } } } } ] })
  });
  if(!addRes.ok) throw new Error('Failed to create tab "' + title + '" (' + addRes.status + ')');
  const added = await addRes.json();
  const sheetId = added.replies[0].addSheet.properties.sheetId;

  const unit = getWeightUnit().toUpperCase();
  const headerRange = `'${title}'!A1:E1`;
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
    { method:'PUT', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values:[['Exercise','Sets','Reps',`Weight (${unit})`,'Muscle']] }) }
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

// Every row written for a given workout gets an invisible note on column A
// (e.g. "wk:<id>") so we can find and remove exactly those rows later if the
// workout is deleted — without adding a visible ID column to the table.
async function tagRowsWithWorkoutId(token, sheetId, updatedRange, workoutId){
  const m = /!A(\d+):[A-Za-z]+(\d+)/.exec(updatedRange || '');
  if(!m) return;
  const start = parseInt(m[1], 10);
  const end = parseInt(m[2], 10);
  const rows = Array.from({ length: end - start + 1 }, () => ({ values:[ { note:'wk:' + workoutId } ] }));
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({ requests:[ {
      updateCells:{
        range:{ sheetId, startRowIndex:start-1, endRowIndex:end, startColumnIndex:0, endColumnIndex:1 },
        rows,
        fields:'note'
      }
    } ] })
  });
}

// F1/F2 hold the day's total workout duration — separate from the A:E
// exercise table so it never collides with existing rows/columns there.
// Written unconditionally (even to "00:00:00") every sync so it always
// reflects entry.durationMs, including for a duration-only save with no
// exercises yet.
async function writeDurationCell(token, title, durationMs){
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({
      valueInputOption:'USER_ENTERED',
      data:[
        { range:`'${title}'!F1`, values:[['Duration']] },
        { range:`'${title}'!F2`, values:[[fmt(durationMs || 0)]] }
      ]
    })
  });
}

async function syncEntry(token, entry){
  const title = sheetTitleForDate(entry.date);
  const sheetId = await ensureDateSheet(token, title);

  await writeDurationCell(token, title, entry.durationMs);

  const exerciseRows = exerciseRowsForEntry(entry);
  if(exerciseRows.length === 0) return; // duration-only save, nothing else to write

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
    rows.push([`— ${time} —`, '', '', '', '']);
  }
  rows.push(...exerciseRows);

  const appendRange = `'${title}'!A1`;
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values: rows }) }
  );
  if(!appendRes.ok) throw new Error('Append failed for "' + title + '" (' + appendRes.status + ')');
  const appendData = await appendRes.json();
  const updatedRange = appendData.updates && appendData.updates.updatedRange;

  try{ await tagRowsWithWorkoutId(token, sheetId, updatedRange, entry.id); }
  catch(e){ /* best-effort — losing the tag just means a future delete can't auto-clean this one */ }
}

// Finds the rows tagged for this workout in its date tab and removes them.
// Returns quietly (no throw) if the workout was never synced, its tab is
// gone, or the rows can't be found — deletion is always best-effort so it
// never blocks the local delete.
async function deleteFromSheet(entry){
  if(!userEmail) return;
  const token = await getValidToken();
  if(!spreadsheetId) await ensureSpreadsheet();
  const title = sheetTitleForDate(entry.date);
  if(!sheetMetaCache) await loadSheetMeta(token);
  let sheetId = sheetMetaCache[title];
  if(sheetId == null) return; // no tab for that date — nothing to remove

  const getRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?ranges=${encodeURIComponent(`'${title}'!A2:A2000`)}` +
    `&fields=${encodeURIComponent('sheets.data.rowData.values.note')}`,
    { headers:{ Authorization:'Bearer '+token } }
  );
  if(!getRes.ok) throw new Error('Could not read sheet (' + getRes.status + ')');
  const data = await getRes.json();
  const rowData = (data.sheets && data.sheets[0] && data.sheets[0].data && data.sheets[0].data[0] && data.sheets[0].data[0].rowData) || [];

  // A merged (one-entry-per-day) record can carry rows tagged under several
  // older ids that got folded into it — clean up all of them, not just the
  // current id, so nothing orphaned is left for a future restore to find.
  const markers = new Set((entry.mergedIds && entry.mergedIds.length ? entry.mergedIds : [entry.id]).map(id => 'wk:' + id));
  const matchedRows = [];
  rowData.forEach((row, idx) => {
    const note = row.values && row.values[0] && row.values[0].note;
    if(note && markers.has(note)) matchedRows.push(idx + 2); // rowData[0] corresponds to sheet row 2
  });
  if(matchedRows.length === 0) return; // rows already gone or were never tagged

  matchedRows.sort((a, b) => a - b);
  const ranges = [];
  let rangeStart = matchedRows[0], rangeEnd = matchedRows[0];
  for(let i = 1; i < matchedRows.length; i++){
    if(matchedRows[i] === rangeEnd + 1){ rangeEnd = matchedRows[i]; }
    else { ranges.push([rangeStart, rangeEnd]); rangeStart = rangeEnd = matchedRows[i]; }
  }
  ranges.push([rangeStart, rangeEnd]);

  // Highest row range first within the same batch, so deleting one range
  // never shifts the row numbers already computed for another.
  const requests = ranges
    .sort((a, b) => b[0] - a[0])
    .map(([start, end]) => ({ deleteDimension:{ range:{ sheetId, dimension:'ROWS', startIndex: start - 1, endIndex: end } } }));

  const delRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({ requests })
  });
  if(!delRes.ok) throw new Error('Sheet delete failed (' + delRes.status + ')');
}

// The one safe way to put an entry's current exercises in the Sheet,
// whether it's brand new or being re-synced after a local edit/merge:
// always clear out anything already tagged for it first, then append fresh.
// deleteFromSheet is a no-op when there's nothing tagged yet, so this is
// exactly as cheap for a first-ever sync as calling syncEntry alone was —
// it just also guarantees a stale prior sync can never be duplicated.
async function resyncEntryToSheet(token, entry){
  await deleteFromSheet(entry);
  await syncEntry(token, entry);
  // Rows are now tagged fresh under entry.id only, so any ids merged in
  // from other local entries no longer exist in the Sheet under their own
  // tags — stop tracking them, keeping mergedIds from growing forever.
  entry.mergedIds = [entry.id];
}

function parseSheetTitleToDateParts(title){
  const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec((title || '').trim());
  if(!m) return null;
  const monthIdx = MONTH_SHORT.indexOf(m[2]);
  if(monthIdx === -1) return null;
  return { day: parseInt(m[1], 10), month: monthIdx, year: parseInt(m[3], 10) };
}

function parseSeparatorTime(text){
  const m = /—\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*—/i.exec(text || '');
  if(!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const isPM = /PM/i.test(m[3]);
  if(isPM && hours !== 12) hours += 12;
  if(!isPM && hours === 12) hours = 0;
  return { hours, minutes };
}

// Rebuilds local workout entries from whatever is currently sitting in the
// Sheet, using the same "wk:<id>" row notes that power remote delete to
// regroup rows back into distinct workouts — so a wiped phone or a brand
// new device can recover everything except the session duration (never
// written to the Sheet in the first place).
async function restoreFromSheet(){
  if(!userEmail) throw new Error('Not signed in');
  const token = await getValidToken();
  if(!spreadsheetId) await ensureSpreadsheet();

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?fields=${encodeURIComponent('sheets(properties(title),data(rowData(values(formattedValue,note))))')}`,
    { headers:{ Authorization:'Bearer '+token } }
  );
  if(!res.ok) throw new Error('Could not read spreadsheet (' + res.status + ')');
  const data = await res.json();

  // Flatten mergedIds too, not just the current top-level id — otherwise a
  // workout that was already folded into another day's entry (and so no
  // longer has an entry of its own) looks "new" again on every restore.
  const existingIds = new Set();
  history.forEach(h => (h.mergedIds && h.mergedIds.length ? h.mergedIds : [h.id]).forEach(id => existingIds.add(id)));
  const restored = [];

  (data.sheets || []).forEach(sheet => {
    const title = sheet.properties.title;
    if(title === 'Overview'){
      if(!getDisplayName()){
        const rowData = (sheet.data && sheet.data[0] && sheet.data[0].rowData) || [];
        const nameCell = rowData[3] && rowData[3].values && rowData[3].values[1];
        const sheetName = nameCell && nameCell.formattedValue;
        if(sheetName){
          localStorage.setItem(K_DISPLAY_NAME, sheetName);
          displayNameInput.value = sheetName;
          renderBrandGreeting();
        }
      }
      return;
    }
    const dateParts = parseSheetTitleToDateParts(title);
    if(!dateParts) return;

    const rowData = (sheet.data && sheet.data[0] && sheet.data[0].rowData) || [];
    // Duration lives in F2 (row index 1), independent of the exercise rows —
    // only the first reconstructed group for this tab gets it, so merging
    // same-day groups afterward doesn't double-count it.
    const durationCell = rowData[1] && rowData[1].values && rowData[1].values[5];
    const tabDurationMs = parseDurationToMs(durationCell && durationCell.formattedValue);
    let durationAssigned = false;

    const groups = [];
    let current = null;
    for(let i = 1; i < rowData.length; i++){ // row 0 is the header
      const cells = rowData[i].values || [];
      const note = cells[0] && cells[0].note;
      if(!note || !note.startsWith('wk:')){ current = null; continue; }
      const workoutId = note.slice(3);
      if(!current || current.workoutId !== workoutId){
        current = { workoutId, rows: [] };
        groups.push(current);
      }
      current.rows.push(cells.map(c => (c && c.formattedValue) || ''));
    }

    groups.forEach(g => {
      if(existingIds.has(g.workoutId)) return;

      let rows = g.rows;
      let hh = 12, mm = 0;
      const sepTime = rows[0] && /^—/.test(rows[0][0]) ? parseSeparatorTime(rows[0][0]) : null;
      if(sepTime){ hh = sepTime.hours; mm = sepTime.minutes; rows = rows.slice(1); }

      const exercises = rows.filter(r => r[0]).map(r => {
        const repsParts = (r[2] || '').split('+');
        const weightParts = (r[3] || '').split('+');
        const sets = repsParts.map((rp, i) => ({
          reps: (rp === '-' || rp === '') ? '' : Number(rp),
          weight: (weightParts[i] === '-' || weightParts[i] == null || weightParts[i] === '') ? '' : Number(weightParts[i])
        }));
        return { name: r[0], muscle: r[4] || '', sets };
      });
      if(exercises.length === 0) return;

      const entryDate = new Date(dateParts.year, dateParts.month, dateParts.day, hh, mm);
      const durationMs = durationAssigned ? 0 : tabDurationMs;
      durationAssigned = true;
      restored.push({ id: g.workoutId, mergedIds: [g.workoutId], date: entryDate.toISOString(), durationMs, exercises, synced: true });
      existingIds.add(g.workoutId);
    });
  });

  if(restored.length){
    history = mergeHistoryByDay(history.concat(restored));
    saveHistory();
    restored.forEach(entry => entry.exercises.forEach(ex => rememberExercise(ex.name, ex.muscle)));
    renderHistory();
    renderCalendar();
    renderProgress();
    renderAttendance();
  }
  return restored.length;
}

// ---------- Attendance Sheets sync (Weekly Progress / Monthly Progress tabs) ----------
// These are full-rebuild summary tabs, unlike the per-date exercise tabs:
// every sync clears and rewrites the whole table from local history, since
// they're recomputed aggregates rather than an append-only log. No row
// tagging or delete-by-marker is needed here — a full overwrite is simpler
// and just as safe for a tab that's entirely derived data.
async function ensureAggregateSheet(token, title, headers){
  if(!sheetMetaCache) await loadSheetMeta(token);
  if(sheetMetaCache[title] != null) return sheetMetaCache[title];

  const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: JSON.stringify({ requests:[ { addSheet:{ properties:{ title, gridProperties:{ frozenRowCount:1 } } } } ] })
  });
  if(!addRes.ok) throw new Error('Failed to create tab "' + title + '" (' + addRes.status + ')');
  const added = await addRes.json();
  const sheetId = added.replies[0].addSheet.properties.sheetId;

  const endCol = String.fromCharCode(65 + headers.length - 1);
  const headerRange = `'${title}'!A1:${endCol}1`;
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
    { method:'PUT', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values:[headers] }) }
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

async function overwriteAggregateSheet(token, title, rows, colCount){
  const endCol = String.fromCharCode(65 + colCount - 1);
  const clearRange = `'${title}'!A2:${endCol}5000`;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`, {
    method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }
  });
  if(rows.length === 0) return;
  const writeRange = `'${title}'!A2:${endCol}${rows.length + 1}`;
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
    { method:'PUT', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ values: rows }) }
  );
  if(!writeRes.ok) throw new Error('Failed to write "' + title + '" (' + writeRes.status + ')');
}

function sheetDateStr(date){
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function syncAttendanceSheets(token){
  const weekly = getWeeklyAggregates();
  await ensureAggregateSheet(token, 'Weekly Progress', ['Week Start', 'Week End', 'Days Attended', 'Total Load']);
  const weeklyRows = weekly.map(w => [
    sheetDateStr(w.periodStart), sheetDateStr(weekEndOf(w.periodStart)), w.attendance, Math.round(w.load)
  ]);
  await overwriteAggregateSheet(token, 'Weekly Progress', weeklyRows, 4);

  const monthly = getMonthlyAggregates();
  await ensureAggregateSheet(token, 'Monthly Progress', ['Month', 'Days Attended', 'Total Load']);
  const monthlyRows = monthly.map(m => [ monthLabel(m.periodStart), m.attendance, Math.round(m.load) ]);
  await overwriteAggregateSheet(token, 'Monthly Progress', monthlyRows, 3);
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
  try{
    const token = await getValidToken();
    if(!spreadsheetId) await ensureSpreadsheet();
    let failed = 0;
    for(const entry of pending){
      try{ await resyncEntryToSheet(token, entry); entry.synced = true; }
      catch(e){ failed++; }
    }
    if(pending.length){
      saveHistory();
      renderHistory();
    }

    // Best-effort: rebuild the weekly/monthly summary tabs from current
    // history. Runs even when every workout was already synced, since the
    // attendance tabs can still be stale (or not created yet). Failure here
    // shouldn't fail the whole sync — the workouts above already synced
    // fine, and the next sync retries this.
    try{ await syncAttendanceSheets(token); } catch(e){ /* retried next sync */ }
    try{ await syncDisplayNameToSheet(token); } catch(e){ /* retried next sync */ }

    refreshSyncBadge();
    if(showAlerts){
      if(failed === 0) setSyncStatus('ok', pending.length ? 'Synced successfully.' : 'Already up to date.');
      else setSyncStatus('err', `${failed} entr${failed===1?'y':'ies'} failed to sync.`);
    }
  } catch(err){
    if(showAlerts){
      setSyncStatus('err', isAuthError(err)
        ? 'Your Google session expired — tap "Sign in with Google" above to reconnect, then try again.'
        : 'Sync failed: ' + err.message);
    }
  }
}
sheetSyncNow.addEventListener('click', () => syncAll(true));

restoreFromSheetBtn.addEventListener('click', async () => {
  if(!confirm('Rebuild workout history from your Google Sheet? Anything already saved on this phone stays untouched — this only adds workouts found in the Sheet that aren\'t here yet.')) return;
  restoreFromSheetBtn.disabled = true;
  const originalText = restoreFromSheetBtn.textContent;
  restoreFromSheetBtn.textContent = 'Restoring…';
  try{
    const count = await restoreFromSheet();
    setSyncStatus('ok', count > 0 ? `Restored ${count} workout${count===1?'':'s'} from Sheet.` : 'Nothing new to restore — already up to date.');
    refreshSyncBadge();
  } catch(err){
    setSyncStatus('err', isAuthError(err)
      ? 'Your Google session expired — tap "Sign in with Google" above to reconnect, then try again.'
      : 'Restore failed: ' + err.message);
  } finally {
    restoreFromSheetBtn.disabled = false;
    restoreFromSheetBtn.textContent = originalText;
  }
});

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
history = mergeHistoryByDay(history); // one-time cleanup for any pre-existing same-day duplicates
saveHistory();
if(current.exercises.length === 0){ addExercise(false); } else { renderExercises(); }
renderHistory();
renderCalendar();
renderProgress();
renderAttendance();
updateAuthUI();
flushStalePendingDeletes(); // clean up anything left over from a session that closed early

// Splash screen: shown for ~2s on every open, then fades out.
setTimeout(() => {
  const splash = document.getElementById('splashScreen');
  if(splash) splash.classList.add('hide');
}, 1500);
