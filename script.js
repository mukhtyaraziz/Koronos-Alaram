// ── State ──
let alarms = JSON.parse(localStorage.getItem('kronos_alarms') || '[]');
let ringingId = null;
let audioCtx = null;
let idCounter = alarms.length ? Math.max(...alarms.map(a => a.id)) + 1 : 1;

// ── DOM refs ──
const clockEl    = document.getElementById('clock-display');
const ampmEl     = document.getElementById('ampm-display');
const dateEl     = document.getElementById('date-display');
const listEl     = document.getElementById('alarm-list');
const flashEl    = document.getElementById('flash-overlay');
const toastEl    = document.getElementById('toast');
const inpHour    = document.getElementById('inp-hour');
const inpMin     = document.getElementById('inp-min');
const inpAmpm    = document.getElementById('inp-ampm');
const inpLabel   = document.getElementById('inp-label');
const setBtn     = document.getElementById('set-btn');

// ── Clock tick ──
function tick() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;

  clockEl.textContent = `${pad(h12)}:${pad(m)}:${pad(s)}`;
  ampmEl.textContent = ampm;

  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  dateEl.textContent = `${days[now.getDay()]} ${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}`;

  if (s === 0) checkAlarms(h12, m, ampm);
}

function pad(n) { return String(n).padStart(2, '0'); }

function checkAlarms(h12, m, ampm) {
  if (ringingId !== null) return; 
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    if (alarm.hour === h12 && alarm.minute === m && alarm.ampm === ampm) {
      triggerAlarm(alarm.id);
      break;
    }
  }
}

// ── Audio ──
function startSound() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function beepCycle(time) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, time);
      osc.frequency.setValueAtTime(1100, time + 0.1);
      osc.frequency.setValueAtTime(880, time + 0.2);
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.35, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(time);
      osc.stop(time + 0.4);
    }
    let t = audioCtx.currentTime;
    for (let i = 0; i < 40; i++) beepCycle(t + i * 0.6);
  } catch(e) { console.warn('Audio failed:', e); }
}

function stopSound() {
  if (audioCtx) {
    try { audioCtx.close(); } catch(e){}
    audioCtx = null;
  }
}

// ── Alarm Actions ──
function triggerAlarm(id) {
  ringingId = id;
  startSound();
  flashEl.classList.add('flashing');
  renderAlarms();
  showToast('⏰ Alarm ringing!');
}

function dismissAlarm() {
  stopSound();
  flashEl.classList.remove('flashing');
  ringingId = null;
  renderAlarms();
  showToast('Alarm dismissed');
}

function addAlarm() {
  let h = parseInt(inpHour.value);
  let m = parseInt(inpMin.value);
  const ampm = inpAmpm.value;
  const label = inpLabel.value.trim();

  if (isNaN(h) || h < 1 || h > 12) { showToast('Hour 1–12'); return; }
  if (isNaN(m) || m < 0 || m > 59) { showToast('Minute 0–59'); return; }

  alarms.push({ id: idCounter++, hour: h, minute: m, ampm, label, enabled: true });
  saveAlarms();
  renderAlarms();
  inpLabel.value = '';
}

function deleteAlarm(id) {
  if (ringingId === id) dismissAlarm();
  alarms = alarms.filter(a => a.id !== id);
  saveAlarms();
  renderAlarms();
}

function toggleAlarm(id) {
  const alarm = alarms.find(a => a.id === id);
  if (!alarm) return;
  alarm.enabled = !alarm.enabled;
  if (!alarm.enabled && ringingId === id) dismissAlarm();
  saveAlarms();
  renderAlarms();
}

function saveAlarms() {
  localStorage.setItem('kronos_alarms', JSON.stringify(alarms));
}

function renderAlarms() {
  if (!alarms.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="icon">⏰</div>No alarms set</div>`;
    return;
  }
  const sorted = [...alarms].sort((a, b) => {
    const toMin = x => (x.ampm === 'AM' ? (x.hour % 12) : (x.hour % 12 + 12)) * 60 + x.minute;
    return toMin(a) - toMin(b);
  });

  listEl.innerHTML = sorted.map(alarm => {
    const isRinging = ringingId === alarm.id;
    return `
    <div class="alarm-item ${!alarm.enabled ? 'disabled' : ''} ${isRinging ? 'ringing' : ''}">
      <span class="alarm-time">${pad(alarm.hour)}:${pad(alarm.minute)}</span>
      <span class="alarm-ampm">${alarm.ampm}</span>
      <div class="alarm-info">
        <span class="alarm-label">${alarm.label || 'No label'}</span>
        <span class="alarm-status">${isRinging ? 'RINGING' : alarm.enabled ? 'ACTIVE' : 'DISABLED'}</span>
      </div>
      <div class="alarm-controls">
        ${isRinging ? `<button class="btn-dismiss" onclick="dismissAlarm()">Dismiss</button>` : ''}
        <label class="toggle">
          <input type="checkbox" ${alarm.enabled ? 'checked' : ''} onchange="toggleAlarm(${alarm.id})" />
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
        </label>
        <button class="btn-icon" onclick="deleteAlarm(${alarm.id})">✕</button>
      </div>
    </div>`;
  }).join('');
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ── Init ──
setBtn.addEventListener('click', addAlarm);
setInterval(tick, 1000);
renderAlarms();
tick();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}