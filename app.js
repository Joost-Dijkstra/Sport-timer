const STORAGE_KEY = 'sporttimer-settings-v3';
const DEFAULT_SETTINGS = {
  time1: 90,
  time2: 60,
  restTime: 30,
  sound: true,
  vibrate: true,
  cues: true,
  keepAwake: true,
  alarmCount: 3,
  alarmTone: 'beep',
  alarmVolume: 100,
  alarmTempo: 'normal',
  alarmLength: 'normal',
  theme: 'neon'
};

const circumference = 2 * Math.PI * 148;
const toneNames = new Set(['beep','double','chirp','bell','chime','siren','stadium','gong']);
const tempoNames = new Set(['fast','normal','slow']);
const lengthNames = new Set(['short','normal','long']);
const themeNames = new Set(['neon','arctic','lava']);
const tempoScale = { fast: 0.65, normal: 1, slow: 1.5 };
const lengthScale = { short: 0.72, normal: 1, long: 1.55 };

let settings = loadSettings();
let timerLoop = null;
let running = false;
let total = settings.time1;
let currentTime = total;
let remainingMs = total * 1000;
let deadlineMs = 0;
let lastSprintSecond = null;
let audioCtx = null;
let wakeLock = null;
let activeSources = new Set();
let previouslyFocused = null;

const elements = {
  timerText: document.getElementById('timerText'),
  ringElapsed: document.getElementById('ringElapsed'),
  progressHead: document.getElementById('progressHead'),
  progressHeadGlow: document.getElementById('progressHeadGlow'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  timerWrap: document.querySelector('.timer-wrap'),
  watchShell: document.querySelector('.watch-shell'),
  btn1: document.getElementById('btn1'),
  btn2: document.getElementById('btn2'),
  restBtn: document.getElementById('restBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  overlay: document.getElementById('overlay'),
  settingsDialog: document.getElementById('settingsDialog'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  previewBtn: document.getElementById('previewBtn'),
  statusText: document.getElementById('statusText'),
  wakeStatus: document.getElementById('wakeStatus'),
  time1Input: document.getElementById('time1input'),
  time2Input: document.getElementById('time2input'),
  restInput: document.getElementById('restInput'),
  themeSelect: document.getElementById('themeSelect'),
  alarmSelect: document.getElementById('alarmSelect'),
  toneSelect: document.getElementById('toneSelect'),
  volumeInput: document.getElementById('volumeInput'),
  volumeValue: document.getElementById('volumeValue'),
  tempoSelect: document.getElementById('tempoSelect'),
  lengthSelect: document.getElementById('lengthSelect'),
  soundToggle: document.getElementById('soundToggle'),
  vibrateToggle: document.getElementById('vibrateToggle'),
  cuesToggle: document.getElementById('cuesToggle'),
  wakeToggle: document.getElementById('wakeToggle')
};

const alarmTones = {
  beep: {
    notes: [{ freq: 1100, duration: 0.16, type: 'square', gain: 1 }],
    gap: 0.18
  },
  double: {
    notes: [
      { freq: 930, duration: 0.1, type: 'square', gain: 0.9, offset: 0 },
      { freq: 1220, duration: 0.12, type: 'square', gain: 1, offset: 0.14 }
    ],
    gap: 0.24
  },
  chirp: {
    notes: [
      { freq: 900, endFreq: 1550, duration: 0.22, type: 'triangle', gain: 1, offset: 0 }
    ],
    gap: 0.2
  },
  bell: {
    notes: [
      { freq: 660, duration: 0.3, type: 'sine', gain: 1, offset: 0 },
      { freq: 1320, duration: 0.36, type: 'sine', gain: 0.45, offset: 0 }
    ],
    gap: 0.34
  },
  chime: {
    notes: [
      { freq: 740, duration: 0.2, type: 'triangle', gain: 0.85, offset: 0 },
      { freq: 1110, duration: 0.24, type: 'triangle', gain: 0.65, offset: 0.08 },
      { freq: 1480, duration: 0.28, type: 'sine', gain: 0.4, offset: 0.14 }
    ],
    gap: 0.32
  },
  siren: {
    notes: [
      { freq: 520, endFreq: 1350, duration: 0.62, type: 'sawtooth', gain: 0.85, offset: 0 }
    ],
    gap: 0.16
  },
  stadium: {
    notes: [
      { freq: 230, endFreq: 175, duration: 0.72, type: 'sawtooth', gain: 1, offset: 0 },
      { freq: 460, endFreq: 350, duration: 0.72, type: 'square', gain: 0.28, offset: 0 }
    ],
    gap: 0.24
  },
  gong: {
    notes: [
      { freq: 196, duration: 0.75, type: 'sine', gain: 1, offset: 0 },
      { freq: 294, duration: 0.82, type: 'sine', gain: 0.55, offset: 0.01 },
      { freq: 392, duration: 0.9, type: 'sine', gain: 0.3, offset: 0.02 }
    ],
    gap: 0.28
  }
};

function sanitizeSettings(value){
  const source = value && typeof value === 'object' ? value : {};
  const parsedVolume = Number(source.alarmVolume);
  return {
    time1: TimerCore.clamp(parseInt(source.time1,10) || DEFAULT_SETTINGS.time1,1,3600),
    time2: TimerCore.clamp(parseInt(source.time2,10) || DEFAULT_SETTINGS.time2,1,3600),
    restTime: TimerCore.clamp(parseInt(source.restTime,10) || DEFAULT_SETTINGS.restTime,1,3600),
    sound: source.sound !== false,
    vibrate: source.vibrate !== false,
    cues: source.cues !== false,
    keepAwake: source.keepAwake !== false,
    alarmCount: TimerCore.clamp(parseInt(source.alarmCount,10) || DEFAULT_SETTINGS.alarmCount,1,10),
    alarmTone: toneNames.has(source.alarmTone) ? source.alarmTone : DEFAULT_SETTINGS.alarmTone,
    alarmVolume: Number.isFinite(parsedVolume)
      ? TimerCore.clamp(parsedVolume,0,150)
      : DEFAULT_SETTINGS.alarmVolume,
    alarmTempo: tempoNames.has(source.alarmTempo) ? source.alarmTempo : DEFAULT_SETTINGS.alarmTempo,
    alarmLength: lengthNames.has(source.alarmLength) ? source.alarmLength : DEFAULT_SETTINGS.alarmLength,
    theme: themeNames.has(source.theme) ? source.theme : DEFAULT_SETTINGS.theme
  };
}

function loadSettings(){
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(){
  try {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));
  } catch {}
}

function announce(message){
  elements.statusText.textContent = '';
  requestAnimationFrame(() => { elements.statusText.textContent = message; });
}

function applyTheme(name){
  settings.theme = themeNames.has(name) ? name : DEFAULT_SETTINGS.theme;
  document.body.dataset.theme = settings.theme;
}

function updatePresetLabels(){
  elements.btn1.textContent = settings.time1 + 's';
  elements.btn2.textContent = settings.time2 + 's';
  elements.restBtn.textContent = settings.restTime + 's';
}

function ringOffset(progress){
  return circumference * (1 - progress);
}

function updateRingSegments(elapsed){
  const progressElapsed = TimerCore.clamp(elapsed,0,1);
  elements.ringElapsed.style.strokeDasharray = circumference.toFixed(2);
  elements.ringElapsed.style.strokeDashoffset = (-ringOffset(progressElapsed)).toFixed(2);

  const angle = (-Math.PI / 2) - (progressElapsed * Math.PI * 2);
  const x = 181 + (148 * Math.cos(angle));
  const y = 181 + (148 * Math.sin(angle));
  const opacity = progressElapsed > 0 ? 1 : 0;

  elements.progressHeadGlow.setAttribute('cx',x.toFixed(2));
  elements.progressHeadGlow.setAttribute('cy',y.toFixed(2));
  elements.progressHeadGlow.setAttribute('opacity',progressElapsed > 0 ? '0.9' : '0');
  elements.progressHead.setAttribute('cx',x.toFixed(2));
  elements.progressHead.setAttribute('cy',y.toFixed(2));
  elements.progressHead.setAttribute('opacity',String(opacity));
}

function formatTime(seconds){
  const rounded = Math.max(0,Math.ceil(seconds));
  if(rounded < 1000) return String(rounded);
  const minutes = Math.floor(rounded / 60);
  return minutes + ':' + String(rounded % 60).padStart(2,'0');
}

function render(){
  const display = formatTime(currentTime);
  elements.timerText.textContent = display;
  elements.timerText.classList.toggle('compact-time',display.length > 3);
  const elapsed = TimerCore.elapsedFraction(total * 1000,remainingMs);
  updateRingSegments(elapsed);

  const sprintActive = running && currentTime > 0 && currentTime <= 5;
  elements.timerWrap.classList.toggle('end-sprint',sprintActive);
  elements.timerText.classList.toggle('end-sprint',sprintActive);
  elements.pauseBtn.textContent = running ? '\u23f8' : '\u25b6';
  elements.pauseBtn.setAttribute('aria-label',running ? 'Timer pauzeren' : 'Timer starten');
}

function syncClock(){
  if(!running) return;
  remainingMs = TimerCore.remainingFromDeadline(deadlineMs,Date.now());
  currentTime = remainingMs / 1000;
}

function clearTimerLoop(){
  if(timerLoop !== null){
    clearInterval(timerLoop);
    timerLoop = null;
  }
}

function handleSprintCue(){
  const sprintSecond = currentTime > 0 && currentTime <= 5 ? Math.ceil(currentTime) : null;
  if(sprintSecond === null || sprintSecond === lastSprintSecond) return;
  lastSprintSecond = sprintSecond;
  playCue('sprint');
  if(settings.vibrate && navigator.vibrate) navigator.vibrate(45);
}

function tickTimer(){
  if(!running) return;
  syncClock();
  handleSprintCue();

  if(remainingMs <= 0){
    running = false;
    clearTimerLoop();
    currentTime = 0;
    remainingMs = 0;
    render();
    finish();
    return;
  }

  render();
}

function ensureTimerLoop(){
  if(timerLoop !== null) return;
  timerLoop = setInterval(tickTimer,100);
}

function flashFeedback(){
  elements.watchShell.classList.remove('feedback-flash');
  void elements.watchShell.offsetWidth;
  elements.watchShell.classList.add('feedback-flash');
}

function startTimer(seconds){
  primeAudio();
  stopActiveSounds();
  clearTimerLoop();
  total = TimerCore.clamp(Number(seconds) || settings.time1,1,3600);
  remainingMs = total * 1000;
  currentTime = total;
  deadlineMs = Date.now() + remainingMs;
  running = true;
  lastSprintSecond = null;
  ensureTimerLoop();
  playCue('start');
  flashFeedback();
  requestWakeLock();
  announce('Timer gestart voor ' + total + ' seconden.');
  render();
}

function pauseTimer(){
  syncClock();
  running = false;
  clearTimerLoop();
  playCue('pause');
  announce('Timer gepauzeerd.');
  render();
}

function resumeTimer(){
  if(remainingMs <= 0){
    remainingMs = total * 1000;
    currentTime = total;
    lastSprintSecond = null;
  }
  deadlineMs = Date.now() + remainingMs;
  running = true;
  ensureTimerLoop();
  playCue('resume');
  flashFeedback();
  requestWakeLock();
  announce('Timer hervat.');
  render();
}

function togglePause(){
  primeAudio();
  if(running) pauseTimer();
  else resumeTimer();
}

function stopTimer(){
  primeAudio();
  stopActiveSounds();
  clearTimerLoop();
  running = false;
  lastSprintSecond = null;
  remainingMs = total * 1000;
  currentTime = total;
  playCue('pause');
  announce('Timer gestopt en teruggezet.');
  render();
}

function getAudioContext(){
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if(!Ctx) return null;
  if(!audioCtx) audioCtx = new Ctx();
  if(audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function primeAudio(){
  getAudioContext();
}

function stopActiveSounds(){
  for(const source of activeSources){
    try { source.stop(); } catch {}
  }
  activeSources.clear();
}

function createAudioOutput(ctx,volumePercent,scale){
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18,ctx.currentTime);
  compressor.knee.setValueAtTime(18,ctx.currentTime);
  compressor.ratio.setValueAtTime(8,ctx.currentTime);
  compressor.attack.setValueAtTime(0.003,ctx.currentTime);
  compressor.release.setValueAtTime(0.25,ctx.currentTime);

  const master = ctx.createGain();
  const level = TimerCore.clamp(volumePercent / 100,0,1.5) * scale * 1.2;
  master.gain.setValueAtTime(level,ctx.currentTime);
  master.connect(compressor);
  compressor.connect(ctx.destination);
  return master;
}

function playTonePreset(presetName,count,options = {}){
  const soundEnabled = options.soundEnabled !== false;
  if(!soundEnabled) return 0;
  const ctx = getAudioContext();
  if(!ctx) return 0;

  const tone = alarmTones[presetName] || alarmTones.beep;
  const repeats = TimerCore.clamp(parseInt(count,10) || 1,1,10);
  const volume = Number(options.volume ?? settings.alarmVolume);
  const scale = Number(options.scale ?? 1);
  const tempo = tempoScale[options.tempo || settings.alarmTempo] || 1;
  const length = lengthScale[options.length || settings.alarmLength] || 1;
  const output = createAudioOutput(ctx,volume,scale);
  let startAt = ctx.currentTime + 0.025;

  function scheduleNote(note,cycleStart){
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const offset = (note.offset || 0) * length;
    const duration = (note.duration || 0.1) * length;
    const release = Math.max(0.06,duration * 0.55);
    const noteStart = cycleStart + offset;
    const noteEnd = noteStart + duration;
    const peak = Math.max(0.0001,note.gain || 1);

    osc.type = note.type || 'sine';
    osc.frequency.setValueAtTime(note.freq || 880,noteStart);
    if(note.endFreq){
      osc.frequency.exponentialRampToValueAtTime(note.endFreq,noteEnd);
    }
    gain.gain.setValueAtTime(0.0001,noteStart);
    gain.gain.linearRampToValueAtTime(peak,noteStart + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,noteEnd + release);
    osc.connect(gain);
    gain.connect(output);
    osc.onended = () => activeSources.delete(osc);
    activeSources.add(osc);
    osc.start(noteStart);
    osc.stop(noteEnd + release + 0.02);
    return offset + duration + release;
  }

  for(let i = 0; i < repeats; i++){
    let cycleDuration = 0;
    for(const note of tone.notes){
      cycleDuration = Math.max(cycleDuration,scheduleNote(note,startAt));
    }
    startAt += cycleDuration + ((tone.gap || 0.2) * tempo);
  }

  return startAt - ctx.currentTime;
}

function playCue(kind){
  if(!settings.sound || !settings.cues) return;
  if(kind === 'start') playTonePreset('chirp',1,{ volume: settings.alarmVolume, scale: 0.38, length: 'short' });
  if(kind === 'resume') playTonePreset('double',1,{ volume: settings.alarmVolume, scale: 0.3, length: 'short' });
  if(kind === 'pause') playTonePreset('beep',1,{ volume: settings.alarmVolume, scale: 0.24, length: 'short' });
  if(kind === 'sprint') playTonePreset('beep',1,{ volume: settings.alarmVolume, scale: 0.3, length: 'short' });
}

function playAlarm(options = settings){
  stopActiveSounds();
  return playTonePreset(options.alarmTone,options.alarmCount,{
    soundEnabled: options.sound,
    volume: options.alarmVolume,
    tempo: options.alarmTempo,
    length: options.alarmLength,
    scale: 1
  });
}

function finish(){
  playAlarm();
  flashFeedback();
  announce('Timer klaar.');
  if(settings.vibrate && navigator.vibrate){
    navigator.vibrate([260,120,260,120,420]);
  }
}

function readFormSettings(){
  return sanitizeSettings({
    time1: elements.time1Input.value,
    time2: elements.time2Input.value,
    restTime: elements.restInput.value,
    theme: elements.themeSelect.value,
    alarmCount: elements.alarmSelect.value,
    alarmTone: elements.toneSelect.value,
    alarmVolume: elements.volumeInput.value,
    alarmTempo: elements.tempoSelect.value,
    alarmLength: elements.lengthSelect.value,
    sound: elements.soundToggle.checked,
    vibrate: elements.vibrateToggle.checked,
    cues: elements.cuesToggle.checked,
    keepAwake: elements.wakeToggle.checked
  });
}

function fillSettingsForm(){
  elements.time1Input.value = settings.time1;
  elements.time2Input.value = settings.time2;
  elements.restInput.value = settings.restTime;
  elements.themeSelect.value = settings.theme;
  elements.alarmSelect.value = String(settings.alarmCount);
  elements.toneSelect.value = settings.alarmTone;
  elements.volumeInput.value = String(settings.alarmVolume);
  elements.volumeValue.textContent = settings.alarmVolume + '%';
  elements.tempoSelect.value = settings.alarmTempo;
  elements.lengthSelect.value = settings.alarmLength;
  elements.soundToggle.checked = settings.sound;
  elements.vibrateToggle.checked = settings.vibrate;
  elements.cuesToggle.checked = settings.cues;
  elements.wakeToggle.checked = settings.keepAwake;
}

function openSettings(){
  previouslyFocused = document.activeElement;
  fillSettingsForm();
  elements.overlay.hidden = false;
  elements.settingsDialog.focus();
}

function closeSettings(){
  stopActiveSounds();
  elements.overlay.hidden = true;
  if(previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
}

function saveSettings(event){
  event.preventDefault();
  settings = readFormSettings();
  persistSettings();
  applyTheme(settings.theme);
  updatePresetLabels();
  if(!running){
    total = settings.time1;
    remainingMs = total * 1000;
    currentTime = total;
    lastSprintSecond = null;
  }
  if(settings.keepAwake) requestWakeLock();
  else releaseWakeLock();
  closeSettings();
  announce('Instellingen opgeslagen.');
  render();
}

function previewAlarm(){
  primeAudio();
  const previewSettings = readFormSettings();
  playAlarm(previewSettings);
}

function trapDialogFocus(event){
  if(event.key === 'Escape'){
    closeSettings();
    return;
  }
  if(event.key !== 'Tab') return;
  const focusable = [...elements.settingsDialog.querySelectorAll('button,input,select,[tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.disabled && node.offsetParent !== null);
  if(focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if(event.shiftKey && document.activeElement === first){
    event.preventDefault();
    last.focus();
  } else if(!event.shiftKey && document.activeElement === last){
    event.preventDefault();
    first.focus();
  }
}

function updateWakeStatus(text,state){
  elements.wakeStatus.textContent = text;
  elements.wakeStatus.className = 'wake-status' + (state ? ' ' + state : '');
}

async function requestWakeLock(){
  if(!settings.keepAwake){
    updateWakeStatus('Scherm aanhouden: uit','');
    return;
  }
  if(!('wakeLock' in navigator)){
    updateWakeStatus('Scherm aanhouden niet ondersteund','warning');
    return;
  }
  if(document.visibilityState !== 'visible'){
    updateWakeStatus('Scherm aanhouden wacht op zichtbare app','warning');
    return;
  }
  if(wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    updateWakeStatus('Scherm blijft aan','active');
    wakeLock.addEventListener('release',() => {
      wakeLock = null;
      if(settings.keepAwake && document.visibilityState === 'visible'){
        updateWakeStatus('Tik om scherm actief te houden','warning');
      }
    });
  } catch {
    updateWakeStatus('Tik om scherm actief te houden','warning');
  }
}

async function releaseWakeLock(){
  if(wakeLock){
    try { await wakeLock.release(); } catch {}
    wakeLock = null;
  }
  updateWakeStatus(settings.keepAwake ? 'Schermbeveiliging niet actief' : 'Scherm aanhouden: uit',settings.keepAwake ? 'warning' : '');
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    registration.update().catch(() => {});
  } catch {
    announce('Offline ondersteuning kon niet worden gestart.');
  }
}

function bindEvents(){
  elements.pauseBtn.addEventListener('click',togglePause);
  elements.stopBtn.addEventListener('click',stopTimer);
  elements.btn1.addEventListener('click',() => startTimer(settings.time1));
  elements.btn2.addEventListener('click',() => startTimer(settings.time2));
  elements.restBtn.addEventListener('click',() => startTimer(settings.restTime));
  elements.settingsBtn.addEventListener('click',openSettings);
  elements.closeSettingsBtn.addEventListener('click',closeSettings);
  elements.previewBtn.addEventListener('click',previewAlarm);
  elements.settingsDialog.addEventListener('submit',saveSettings);
  elements.settingsDialog.addEventListener('keydown',trapDialogFocus);
  elements.overlay.addEventListener('click',(event) => {
    if(event.target === elements.overlay) closeSettings();
  });
  elements.volumeInput.addEventListener('input',() => {
    elements.volumeValue.textContent = elements.volumeInput.value + '%';
  });
  window.addEventListener('pointerdown',() => {
    primeAudio();
    requestWakeLock();
  },{ once: true });
  document.addEventListener('visibilitychange',() => {
    if(document.visibilityState === 'visible'){
      if(running) tickTimer();
      requestWakeLock();
    }
  });
  window.addEventListener('load',registerServiceWorker);
}

function initialize(){
  applyTheme(settings.theme);
  updatePresetLabels();
  bindEvents();
  requestWakeLock();
  render();
}

initialize();
