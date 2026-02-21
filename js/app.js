// TETHER: Core Logic
// Handling State, UI, Worker, and PWA

const STORE_KEYS = {
    int: 'dp_interval',
    min: 'dp_vol_min',
    warn: 'dp_vol_warn',
    fin: 'dp_vol_finish',
    noise: 'dp_vol_noise',
    noise2: 'dp_vol_noise2',
    pings: 'dp_vol_pings',
    theme: 'dp_theme',
    total: 'dp_stats_total',
    cycles: 'dp_stats_cycles',
    bio: 'dp_bio_active',
    breath: 'dp_breath_pattern',
    atm: 'dp_atm_sync',
    presets: 'dp_presets',
    shade: 'dp_base_shade'
};

const DEFAULTS = {
    int: 5,
    min: 0.3,
    warn: 0.5,
    fin: 0.6,
    noise: 0.2,
    noise2: 0.1,
    pings: 0.2,
    theme: 'cyan'
};

const BREATH_PATTERNS = {
    box: { in: 4, h1: 4, ex: 4, h2: 4 },
    relax: { in: 4, h1: 7, ex: 8, h2: 0 },
    balance: { in: 5, h1: 0, ex: 5, h2: 0 },
    focus: { in: 4, h1: 2, ex: 4, h2: 0 }, // Added missing focus pattern if needed or relying on default behavior
    cohere: { in: 5.5, h1: 0, ex: 5.5, h2: 0 },
    energy: { in: 4, h1: 0, ex: 2, h2: 0 }
};

const wBlob = new Blob([`setInterval(()=>postMessage('t'),100)`], { type: 'text/javascript' });
const worker = new Worker(URL.createObjectURL(wBlob));

let isRunning = false;
let bioActive = false;
let breathStartTime = 0;
let breathRafId = null;
let durationMins = 5;
let cycles = 0;
let lastMin = -1, lastSec = -1;
let hapticEnabled = true;
let atmSync = false;
let atmSyncFactor = 1.0;
let pulseActive = false;
let minChimeEnabled = true;
let warnChimeEnabled = true;
let finGongEnabled = true;

// UI Object Construction
const ui = {
    clk: document.getElementById('clock'),
    clkWrap: document.getElementById('clockWrapper'),
    stHint: document.getElementById('statusHint'),
    ring: document.getElementById('progRing'),
    ghost: document.getElementById('ghostRing'),
    bTxt: document.getElementById('breathTxt'),
    sel: document.getElementById('intervalSel'),
    lblT: document.getElementById('lblTime'),
    lblC: document.getElementById('lblCount'),
    vMin: document.getElementById('volMinute'),
    vWarn: document.getElementById('volWarn'),
    vFin: document.getElementById('volFinish'),
    vNoise: document.getElementById('volNoise'),
    vNoise2: document.getElementById('volNoise2'),
    vPing: document.getElementById('volPing'),
    nBtn: document.getElementById('noiseBtn'),
    pingBtn: document.getElementById('pingBtn'),
    pingBtnSet: document.getElementById('pingBtnSet'),
    bioBtn: document.getElementById('bioBtn'),
    atmBtn: document.getElementById('atmBtn'),
    hapticBtn: document.getElementById('hapticBtn'),
    breathSel: document.getElementById('breathSel'),
    shieldSel: document.getElementById('shieldSel'),
    shieldSel2: document.getElementById('shieldSel2'),
    themeSel: document.getElementById('themeSel'),
    fs: document.getElementById('fsBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    overlay: document.getElementById('settingsOverlay'),
    target: document.getElementById('closeTarget'),
    cvs: document.getElementById('vizCanvas'),
    valMin: document.getElementById('valMin'),
    valWarn: document.getElementById('valWarn'),
    valFin: document.getElementById('valFin'),
    valNoise: document.getElementById('valNoise'),
    valNoise2: document.getElementById('valNoise2'),
    valPing: document.getElementById('valPing'),
    stMins: document.getElementById('stMins'),
    stCycles: document.getElementById('stCycles'),
    stStreak: document.getElementById('stStreak'),
    btnMinChime: document.getElementById('btnMinChime'),
    btnWarnChime: document.getElementById('btnWarnChime'),
    btnFinGong: document.getElementById('btnFinGong'),
    presetName: document.getElementById('presetName'),
    savePresetBtn: document.getElementById('savePresetBtn'),
    presetsList: document.getElementById('presetsList'),
    primaryColorPicker: document.getElementById('primaryColorPicker'),
    customColorWrap: document.getElementById('customColorWrap'),
    shadeSel: document.getElementById('shadeSel'),
    bgColorPicker: document.getElementById('bgColorPicker'),
    customShadeWrap: document.getElementById('customShadeWrap')
};

// Core Functions

const updateState = () => {
    document.body.classList.toggle('focus-mode', isRunning);
    const logoWrapper = document.querySelector('.logo-wrapper');
    if (isRunning) {
        ui.stHint.innerText = 'SESSION ACTIVE';
        if (logoWrapper) logoWrapper.classList.add('active'); // Turn ON glow
        if (typeof initAudio !== 'undefined') initAudio();
    } else {
        ui.stHint.innerText = 'INITIALIZE SESSION';
        if (logoWrapper) logoWrapper.classList.remove('active'); // Turn OFF glow
        ui.sel.disabled = false;
    }
};

const toggleSession = () => {
    isRunning = !isRunning;
    if (isRunning) {
        // Master Start: Initialize only if Armed (highlighted)
        if (ui.nBtn.classList.contains('active')) {
            if (typeof noiseRunning !== 'undefined' && !noiseRunning) {
                if (typeof toggleNoise !== 'undefined') toggleNoise();
            }
        }
        if (bioActive) {
            // Ensure animation/loop starts
            breathStartTime = Date.now();
            runBreathLoop();
            ui.bTxt.classList.add('visible');
            ui.ghost.style.opacity = 0.2;
        }
    } else {
        // Master Stop: Stop everything logic-wise, but keep buttons Armed
        if (typeof noiseRunning !== 'undefined' && noiseRunning) {
            if (typeof toggleNoise !== 'undefined') toggleNoise();
            ui.nBtn.classList.add('active'); // Keep it armed
        }
        if (bioActive) {
            cancelAnimationFrame(breathRafId);
            ui.bTxt.classList.remove('visible');
            ui.ghost.style.opacity = 0;
            ui.bioBtn.classList.add('active'); // Keep it armed
        }
    }
    updateState();
};

const toggleBio = async () => {
    if (typeof initAudio !== 'undefined') await initAudio();
    bioActive = !bioActive;
    ui.bioBtn.classList.toggle('active', bioActive);

    localStorage.setItem(STORE_KEYS.bio, bioActive);

    if (bioActive && isRunning) {
        ui.bTxt.classList.add('visible');
        ui.ghost.style.opacity = 0.2;
        breathStartTime = Date.now();
        runBreathLoop();
    } else {
        cancelAnimationFrame(breathRafId);
        ui.bTxt.classList.remove('visible');
        ui.ghost.style.opacity = 0;
    }
};

const runBreathLoop = () => {
    if (!bioActive) return; breathRafId = requestAnimationFrame(runBreathLoop);
    const p = BREATH_PATTERNS[ui.breathSel.value] || BREATH_PATTERNS.box;
    const total = (p.in + p.h1 + p.ex + p.h2) * 1000;
    const elapsed = (Date.now() - breathStartTime) % total; const t = elapsed / 1000;
    let phase = '', sec = 0, prog = 0;

    // Safety check for setGhost
    const safeSetGhost = (typeof setGhost !== 'undefined') ? setGhost : () => { };

    if (t < p.in) {
        phase = 'INHALE';
        sec = Math.ceil(p.in - t);
        prog = t / p.in;
        safeSetGhost(0.8 + 0.6 * prog, 0.1 + 0.7 * prog, '#22d3ee');
        atmSyncFactor = 0.2 + 0.8 * prog;
    }
    else if (t < p.in + p.h1) {
        phase = 'HOLD';
        sec = Math.ceil(p.h1 - (t - p.in));
        safeSetGhost(1.4, 0.8, '#fff');
        atmSyncFactor = 1.0;
    }
    else if (t < p.in + p.h1 + p.ex) {
        phase = 'EXHALE';
        sec = Math.ceil(p.ex - (t - p.in - p.h1));
        prog = (t - p.in - p.h1) / p.ex;
        safeSetGhost(1.4 - 0.6 * prog, 0.8 - 0.6 * prog, '#a78bfa');
        atmSyncFactor = 1.0 - 0.8 * prog;
    }
    else {
        phase = 'WAIT';
        sec = Math.ceil(p.h2 - (t - p.in - p.h1 - p.ex));
        safeSetGhost(0.8, 0.2, '#64748b');
        atmSyncFactor = 0.2;
    }
    ui.bTxt.innerText = `${phase} (${sec})`;

    if (atmSync && typeof noiseMaster !== 'undefined' && noiseMaster && typeof noiseRunning !== 'undefined' && noiseRunning) {
        // Access ctx from audio.js (global)
        if (typeof ctx !== 'undefined') noiseMaster.gain.setTargetAtTime(atmSyncFactor, ctx.currentTime, 0.1);
    }
};

const applyTheme = (t) => {
    document.body.className = (t === 'cyan' || t === 'custom') ? '' : `theme-${t}`;

    // Toggle custom color picker visibility
    if (ui.customColorWrap) {
        ui.customColorWrap.style.display = (t === 'custom') ? 'grid' : 'none';
    }

    if (t === 'custom') {
        const col = localStorage.getItem('dp_custom_color') || '#22d3ee';
        document.documentElement.style.setProperty('--primary', col);
        document.documentElement.style.setProperty('--glow', `${col}99`);
        document.documentElement.style.setProperty('--secondary', col);
        if (ui.primaryColorPicker) ui.primaryColorPicker.value = col;
    } else {
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--glow');
        document.documentElement.style.removeProperty('--secondary');
    }

    localStorage.setItem(STORE_KEYS.theme, t);
};

const applyShade = (s) => {
    if (ui.customShadeWrap) ui.customShadeWrap.style.display = (s === 'custom') ? 'grid' : 'none';

    if (s === 'abyss') {
        document.documentElement.style.removeProperty('--bg-start');
        document.documentElement.style.removeProperty('--bg-end');
    } else {
        let start = '#0f172a', end = '#020617';
        if (s === 'black') { start = '#000000'; end = '#000000'; }
        if (s === 'gray') { start = '#1f2937'; end = '#111827'; }
        if (s === 'custom') {
            start = localStorage.getItem('dp_custom_bg') || '#0f172a';
            end = start;
            if (ui.bgColorPicker) ui.bgColorPicker.value = start;
        }
        document.documentElement.style.setProperty('--bg-start', start);
        document.documentElement.style.setProperty('--bg-end', end);
    }
    localStorage.setItem(STORE_KEYS.shade, s);
};

const updateStatsUI = () => {
    const mins = localStorage.getItem(STORE_KEYS.total) || 0;
    const cycles = localStorage.getItem(STORE_KEYS.cycles) || 0;
    ui.stMins.innerText = `${mins} MINS`;
    ui.stCycles.innerText = cycles;
    ui.stStreak.innerText = `ACTIVE`;
};

// Auto-Save Feedback logic
const showSaveFlag = () => {
    const flag = document.createElement('div');
    flag.style.cssText = "position:fixed; bottom:20px; right:20px; font-family:'Orbitron'; font-size:0.6rem; color:var(--primary); background:rgba(34,211,238,0.1); padding:8px 15px; border-radius:10px; border:1px solid var(--primary); z-index:1000; animation: fadeIn 0.3s forwards, fadeOut 0.3s 2s forwards;";
    flag.innerText = "CONFIGURATION SYNCED";
    document.body.appendChild(flag);
    setTimeout(() => flag.remove(), 2500);
};

const togglePulse = () => {
    pulseActive = !pulseActive;
    ui.pingBtn.classList.toggle('active', pulseActive);
    if (ui.pingBtnSet) {
        ui.pingBtnSet.classList.toggle('active', pulseActive);
        ui.pingBtnSet.innerText = pulseActive ? 'ON' : 'OFF';
    }
    localStorage.setItem('dp_precision_pings', pulseActive);
};

const toggleAnchor = (type) => {
    if (type === 'min') {
        minChimeEnabled = !minChimeEnabled;
        ui.btnMinChime.classList.toggle('active', minChimeEnabled);
        ui.btnMinChime.innerText = minChimeEnabled ? 'ON' : 'OFF';
        localStorage.setItem('dp_min_chime_enabled', minChimeEnabled);
    } else if (type === 'warn') {
        warnChimeEnabled = !warnChimeEnabled;
        ui.btnWarnChime.classList.toggle('active', warnChimeEnabled);
        ui.btnWarnChime.innerText = warnChimeEnabled ? 'ON' : 'OFF';
        localStorage.setItem('dp_warn_chime_enabled', warnChimeEnabled);
    } else if (type === 'fin') {
        finGongEnabled = !finGongEnabled;
        ui.btnFinGong.classList.toggle('active', finGongEnabled);
        ui.btnFinGong.innerText = finGongEnabled ? 'ON' : 'OFF';
        localStorage.setItem('dp_fin_gong_enabled', finGongEnabled);
    }
};

// Worker Tick
worker.onmessage = () => {
    const d = new Date(); const s = d.getSeconds(); const m = d.getMinutes();
    ui.clk.innerText = d.toLocaleTimeString([], { hour12: false });
    const total = (d.getHours() * 60) + m; const elapsed = total % durationMins;
    const secIn = (elapsed * 60) + s; const totalSec = durationMins * 60;
    ui.ring.style.strokeDashoffset = 691 - ((secIn / totalSec) * 691);
    const remain = durationMins - elapsed;
    const target = new Date(d.getTime() + (remain * 60000 - s * 1000));
    ui.target.innerText = `CLOSE: ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    if (!isRunning) return;
    // Completion Gong
    if (elapsed === 0 && s === 0) {
        if (typeof playChime !== 'undefined' && finGongEnabled) playChime(2);
        cycles++;
        ui.lblC.innerText = cycles;
        localStorage.setItem(STORE_KEYS.cycles, cycles);
        if (ui.stCycles) ui.stCycles.innerText = cycles; // Real-time update

    }
    // Minute Mark (Top of any minute)
    else if (s === 0 && m !== lastMin) {
        if (elapsed === durationMins - 1) { if (typeof playChime !== 'undefined' && warnChimeEnabled) playChime(3); }
        else { if (typeof playChime !== 'undefined' && minChimeEnabled) playChime(0); }

        lastMin = m;
        let totalMins = parseInt(localStorage.getItem(STORE_KEYS.total) || '0') + 1;
        localStorage.setItem(STORE_KEYS.total, totalMins);
        if (ui.stMins) ui.stMins.innerText = `${totalMins} MINS`; // Real-time update

    }
    if (s > 0) lastMin = -1;

    // Precision Countdown Logic
    const isLastMinuteOfSession = (elapsed === durationMins - 1);
    if (s >= 55 && s <= 59) {
        if (s !== lastSec) {
            if (isLastMinuteOfSession || pulseActive) {
                if (typeof playChime !== 'undefined') playChime(1);
                lastSec = s;
            }
        }
    } else {
        lastSec = -1;
    }
};

const getCurrentConfig = () => ({
    int: ui.sel.value,
    min: ui.vMin.value,
    warn: ui.vWarn.value,
    fin: ui.vFin.value,
    noise: ui.vNoise.value,
    noise2: ui.vNoise2.value,
    ping: ui.vPing.value,
    theme: ui.themeSel.value,
    customColor: ui.primaryColorPicker ? ui.primaryColorPicker.value : '#22d3ee',
    shade: ui.shadeSel.value,
    customBg: ui.bgColorPicker ? ui.bgColorPicker.value : '#0f172a',
    breath: ui.breathSel.value,
    shield: ui.shieldSel.value,
    shield2: ui.shieldSel2.value,
    bio: bioActive,
    pings: pulseActive,
    chimeMin: minChimeEnabled,
    chimeWarn: warnChimeEnabled,
    chimeFin: finGongEnabled,
    atm: atmSync,
    haptic: hapticEnabled,
    armed: ui.nBtn.classList.contains('active')
});

const applyConfig = (config) => {
    // Toggles & Armed State
    bioActive = config.bio;
    ui.bioBtn.classList.toggle('active', bioActive);
    pulseActive = config.pings;
    if (ui.pingBtnSet) {
        ui.pingBtnSet.classList.toggle('active', pulseActive);
        ui.pingBtnSet.innerText = pulseActive ? 'ON' : 'OFF';
    }
    ui.pingBtn.classList.toggle('active', pulseActive);

    minChimeEnabled = config.chimeMin;
    ui.btnMinChime.classList.toggle('active', minChimeEnabled);
    ui.btnMinChime.innerText = minChimeEnabled ? 'ON' : 'OFF';

    warnChimeEnabled = config.chimeWarn;
    ui.btnWarnChime.classList.toggle('active', warnChimeEnabled);
    ui.btnWarnChime.innerText = warnChimeEnabled ? 'ON' : 'OFF';

    finGongEnabled = config.chimeFin;
    ui.btnFinGong.classList.toggle('active', finGongEnabled);
    ui.btnFinGong.innerText = finGongEnabled ? 'ON' : 'OFF';

    ui.nBtn.classList.toggle('active', config.armed);
    atmSync = config.atm;
    ui.atmBtn.classList.toggle('active', atmSync);

    hapticEnabled = config.haptic;
    ui.hapticBtn.classList.toggle('active', hapticEnabled);
    if (ui.hapticBtn.querySelector('span')) {
        ui.hapticBtn.querySelector('span').innerText = hapticEnabled ? 'HAPTICS: ON' : 'HAPTICS: OFF';
    }

    // Sliders & Selects
    ui.sel.value = config.int;
    durationMins = parseInt(config.int);
    ui.lblT.innerText = config.int;

    ui.vMin.value = config.min;
    ui.vWarn.value = config.warn;
    ui.vFin.value = config.fin;
    ui.vNoise.value = config.noise;
    ui.vNoise2.value = config.noise2;
    ui.vPing.value = config.ping;

    ui.themeSel.value = config.theme;
    if (config.customColor) localStorage.setItem('dp_custom_color', config.customColor);
    applyTheme(config.theme);

    if (config.shade) {
        ui.shadeSel.value = config.shade;
        if (config.customBg) localStorage.setItem('dp_custom_bg', config.customBg);
        applyShade(config.shade);
    }

    ui.breathSel.value = config.breath;
    ui.shieldSel.value = config.shield;
    ui.shieldSel2.value = config.shield2;

    // Trigger audio updates if running
    if (isRunning) {
        if (config.armed && typeof noiseRunning !== 'undefined' && !noiseRunning) toggleNoise();
        else if (!config.armed && typeof noiseRunning !== 'undefined' && noiseRunning) toggleNoise();

        if (bioActive) {
            breathStartTime = Date.now();
            runBreathLoop();
            ui.bTxt.classList.add('visible');
            ui.ghost.style.opacity = 0.2;
        } else {
            cancelAnimationFrame(breathRafId);
            ui.bTxt.classList.remove('visible');
            ui.ghost.style.opacity = 0;
        }
    }

    // Save to storage
    Object.keys(config).forEach(k => {
        // Map config keys to STORE_KEYS or manual keys
        if (k === 'int') localStorage.setItem(STORE_KEYS.int, config.int);
        if (k === 'min') localStorage.setItem(STORE_KEYS.min, config.min);
        if (k === 'warn') localStorage.setItem(STORE_KEYS.warn, config.warn);
        if (k === 'fin') localStorage.setItem(STORE_KEYS.fin, config.fin);
        if (k === 'noise') localStorage.setItem(STORE_KEYS.noise, config.noise);
        if (k === 'noise2') localStorage.setItem(STORE_KEYS.noise2, config.noise2);
        if (k === 'ping') localStorage.setItem('dp_vol_pings', config.ping);
        if (k === 'theme') localStorage.setItem(STORE_KEYS.theme, config.theme);
        if (k === 'breath') localStorage.setItem(STORE_KEYS.breath, config.breath);
        if (k === 'shield') localStorage.setItem('dp_shield_1', config.shield);
        if (k === 'shield2') localStorage.setItem('dp_shield_2', config.shield2);
        if (k === 'bio') localStorage.setItem(STORE_KEYS.bio, config.bio);
        if (k === 'pings') localStorage.setItem('dp_precision_pings', config.pings);
        if (k === 'chimeMin') localStorage.setItem('dp_min_chime_enabled', config.chimeMin);
        if (k === 'chimeWarn') localStorage.setItem('dp_warn_chime_enabled', config.chimeWarn);
        if (k === 'chimeFin') localStorage.setItem('dp_fin_gong_enabled', config.chimeFin);
        if (k === 'atm') localStorage.setItem(STORE_KEYS.atm, config.atm);
        if (k === 'haptic') localStorage.setItem('dp_haptic_enabled', config.haptic);
        if (k === 'armed') localStorage.setItem('dp_ambience_armed', config.armed);
    });

    // Update slider labels
    ['valMin', 'valWarn', 'valFin', 'valNoise', 'valNoise2', 'valPing'].forEach(id => {
        const val = ui[id.replace('val', 'v')].value;
        ui[id].innerText = `${Math.round(val * 100)}%`;
    });

    showSaveFlag();
};

const renderPresets = () => {
    const presets = JSON.parse(localStorage.getItem(STORE_KEYS.presets) || '[]');
    ui.presetsList.innerHTML = '';

    presets.forEach(p => {
        const div = document.createElement('div');
        div.className = 'preset-item';
        div.innerHTML = `
            <div class="preset-meta">
                <span class="preset-name">${p.name}</span>
                <span class="preset-details">${p.config.int}M • ${p.config.theme.toUpperCase()}</span>
            </div>
            <div class="preset-actions">
                <button class="preset-btn load" data-name="${p.name}">LOAD</button>
                <button class="preset-btn delete" data-name="${p.name}">DEL</button>
            </div>
        `;

        div.querySelector('.load').onclick = () => applyConfig(p.config);
        div.querySelector('.delete').onclick = () => {
            const updated = presets.filter(x => x.name !== p.name);
            localStorage.setItem(STORE_KEYS.presets, JSON.stringify(updated));
            renderPresets();
        };

        ui.presetsList.appendChild(div);
    });
};

const savePreset = () => {
    const name = ui.presetName.value.trim().toUpperCase();
    if (!name) return;

    const presets = JSON.parse(localStorage.getItem(STORE_KEYS.presets) || '[]');
    const newPreset = { name, config: getCurrentConfig() };

    const idx = presets.findIndex(p => p.name === name);
    if (idx > -1) presets[idx] = newPreset; else presets.push(newPreset);

    localStorage.setItem(STORE_KEYS.presets, JSON.stringify(presets));
    ui.presetName.value = '';
    renderPresets();
    showSaveFlag();
};

// Initialization
const load = () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Error'));
    }
    if (typeof initVisuals !== 'undefined') initVisuals();

    const keys = { min: 'vMin', warn: 'vWarn', fin: 'vFin', noise: 'vNoise', noise2: 'vNoise2', pings: 'vPing' };
    Object.keys(keys).forEach(k => {
        const v = localStorage.getItem(STORE_KEYS[k]) || DEFAULTS[k];
        const input = ui[keys[k]];
        if (input) {
            input.value = v;
            const labelId = keys[k].replace('v', 'val');
            if (document.getElementById(labelId)) document.getElementById(labelId).innerText = Math.round(v * 100) + '%';
        }
    });

    const i = localStorage.getItem(STORE_KEYS.int) || DEFAULTS.int;
    ui.sel.value = i; durationMins = parseInt(i); ui.lblT.innerText = i;
    cycles = parseInt(localStorage.getItem(STORE_KEYS.cycles) || '0'); ui.lblC.innerText = cycles;

    pulseActive = localStorage.getItem('dp_precision_pings') === 'true';
    ui.pingBtn.classList.toggle('active', pulseActive);
    if (ui.pingBtnSet) {
        ui.pingBtnSet.classList.toggle('active', pulseActive);
        ui.pingBtnSet.innerText = pulseActive ? 'ON' : 'OFF';
    }

    const t = localStorage.getItem(STORE_KEYS.theme) || DEFAULTS.theme;
    applyTheme(t); ui.themeSel.value = t;

    hapticEnabled = localStorage.getItem('dp_haptic_enabled') === 'true';
    ui.hapticBtn.classList.toggle('active', hapticEnabled);
    if (ui.hapticBtn.querySelector('span')) {
        ui.hapticBtn.querySelector('span').innerText = hapticEnabled ? 'HAPTICS: ON' : 'HAPTICS: OFF';
    } else {
        ui.hapticBtn.innerText = hapticEnabled ? 'ON' : 'OFF';
    }

    ui.shieldSel.value = localStorage.getItem('dp_shield_1') || 'brown';
    ui.shieldSel2.value = localStorage.getItem('dp_shield_2') || 'none';

    const s = localStorage.getItem(STORE_KEYS.shade) || 'abyss';
    ui.shadeSel.value = s;
    applyShade(s);

    updateStatsUI();

    const bp = localStorage.getItem(STORE_KEYS.breath) || 'box';
    ui.breathSel.value = bp;

    minChimeEnabled = localStorage.getItem('dp_min_chime_enabled') !== 'false';
    ui.btnMinChime.classList.toggle('active', minChimeEnabled);
    ui.btnMinChime.innerText = minChimeEnabled ? 'ON' : 'OFF';

    warnChimeEnabled = localStorage.getItem('dp_warn_chime_enabled') !== 'false';
    ui.btnWarnChime.classList.toggle('active', warnChimeEnabled);
    ui.btnWarnChime.innerText = warnChimeEnabled ? 'ON' : 'OFF';

    finGongEnabled = localStorage.getItem('dp_fin_gong_enabled') !== 'false';
    ui.btnFinGong.classList.toggle('active', finGongEnabled);
    ui.btnFinGong.innerText = finGongEnabled ? 'ON' : 'OFF';

    if (localStorage.getItem(STORE_KEYS.bio) === 'true') {
        bioActive = true;
        ui.bioBtn.classList.add('active');
    }

    atmSync = localStorage.getItem(STORE_KEYS.atm) === 'true';
    ui.atmBtn.classList.toggle('active', atmSync);

    renderPresets();

    if (localStorage.getItem('dp_ambience_armed') === 'true') {
        ui.nBtn.classList.add('active');
    }

    window.showSaveFlag = showSaveFlag; // Global for slide debounce
};

// Event Listeners
['vMin', 'vWarn', 'vFin', 'vNoise', 'vNoise2', 'vPing'].forEach(id => {
    ui[id].oninput = (e) => {
        const k = id.slice(1).toLowerCase();
        let storageKey = k;
        if (k === 'minute') storageKey = 'min';
        else if (k === 'ping') storageKey = 'pings';
        else if (k === 'noise') storageKey = 'noise';
        else if (k === 'noise2') storageKey = 'noise2';

        localStorage.setItem(STORE_KEYS[storageKey], e.target.value);
        const labelId = id.replace('v', 'val');
        if (document.getElementById(labelId)) document.getElementById(labelId).innerText = Math.round(e.target.value * 100) + '%';

        if (id === 'vNoise' && typeof noiseOut1 !== 'undefined' && noiseOut1 && ctx) noiseOut1.gain.setTargetAtTime(e.target.value, ctx.currentTime, 0.1);
        if (id === 'vNoise2' && typeof noiseOut2 !== 'undefined' && noiseOut2 && ctx) noiseOut2.gain.setTargetAtTime(e.target.value, ctx.currentTime, 0.1);

        clearTimeout(window.saveTimer);
        window.saveTimer = setTimeout(showSaveFlag, 1000);
    };
});

ui.shieldSel.addEventListener('change', () => {
    if (typeof updateSoundscape !== 'undefined') updateSoundscape(1);
    localStorage.setItem('dp_shield_1', ui.shieldSel.value);
    showSaveFlag();
});
ui.shieldSel2.addEventListener('change', () => {
    if (typeof updateSoundscape !== 'undefined') updateSoundscape(2);
    localStorage.setItem('dp_shield_2', ui.shieldSel2.value);
    showSaveFlag();
});

const tabBtns = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.settings-section');
tabBtns.forEach(btn => btn.onclick = () => {
    tabBtns.forEach(b => b.classList.remove('active')); sections.forEach(s => s.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(`${btn.dataset.tab}-section`).classList.add('active');
    if (btn.dataset.tab === 'presets') renderPresets();
});

const switchTab = (t) => {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    sections.forEach(s => s.classList.toggle('active', s.id === `${t}-section`));
    if (t === 'stats') updateStatsUI();
    if (t === 'presets') renderPresets();
};

ui.clkWrap.onclick = toggleSession;
ui.settingsBtn.onclick = () => { ui.overlay.classList.add('visible'); switchTab('ambient'); };
document.querySelectorAll('.exit-settings').forEach(btn => btn.onclick = () => ui.overlay.classList.remove('visible'));
ui.overlay.onclick = (e) => { if (e.target === ui.overlay) ui.overlay.classList.remove('visible'); };
ui.fs.onclick = () => !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen();

ui.bioBtn.onclick = () => { toggleBio(); showSaveFlag(); };
ui.nBtn.onclick = () => {
    const isArmed = ui.nBtn.classList.toggle('active');
    localStorage.setItem('dp_ambience_armed', isArmed);

    if (isRunning) {
        if (typeof noiseRunning !== 'undefined') {
            if (isArmed && !noiseRunning) toggleNoise();
            else if (!isArmed && noiseRunning) toggleNoise();
        }
    }
    showSaveFlag();
};
ui.pingBtn.onclick = () => { togglePulse(); showSaveFlag(); };
if (ui.pingBtnSet) ui.pingBtnSet.onclick = () => { togglePulse(); showSaveFlag(); };
ui.themeSel.onchange = (e) => { applyTheme(e.target.value); showSaveFlag(); };
ui.shadeSel.onchange = (e) => { applyShade(e.target.value); showSaveFlag(); };
if (ui.bgColorPicker) {
    ui.bgColorPicker.oninput = (e) => {
        document.documentElement.style.setProperty('--bg-start', e.target.value);
        document.documentElement.style.setProperty('--bg-end', e.target.value);
        localStorage.setItem('dp_custom_bg', e.target.value);
    };
    ui.bgColorPicker.onchange = () => showSaveFlag();
}
if (ui.primaryColorPicker) {
    ui.primaryColorPicker.oninput = (e) => {
        const col = e.target.value;
        document.documentElement.style.setProperty('--primary', col);
        document.documentElement.style.setProperty('--glow', `${col}99`);
        document.documentElement.style.setProperty('--secondary', col);
        localStorage.setItem('dp_custom_color', col);
    };
    ui.primaryColorPicker.onchange = () => showSaveFlag();
}
ui.breathSel.onchange = () => { localStorage.setItem(STORE_KEYS.breath, ui.breathSel.value); showSaveFlag(); };
ui.atmBtn.onclick = () => {
    atmSync = !atmSync;
    ui.atmBtn.classList.toggle('active', atmSync);
    localStorage.setItem(STORE_KEYS.atm, atmSync);
    if (!atmSync && typeof noiseMaster !== 'undefined' && noiseMaster && typeof ctx !== 'undefined') noiseMaster.gain.setTargetAtTime(1.0, ctx.currentTime, 0.1);
    showSaveFlag();
};
ui.hapticBtn.onclick = () => {
    hapticEnabled = !hapticEnabled;
    ui.hapticBtn.classList.toggle('active', hapticEnabled);
    if (ui.hapticBtn.querySelector('span')) {
        ui.hapticBtn.querySelector('span').innerText = hapticEnabled ? 'HAPTICS: ON' : 'HAPTICS: OFF';
    } else {
        ui.hapticBtn.innerText = hapticEnabled ? 'ON' : 'OFF';
    }
    localStorage.setItem('dp_haptic_enabled', hapticEnabled);
    showSaveFlag();
};

ui.savePresetBtn.onclick = savePreset;
ui.presetName.onkeydown = (e) => { if (e.key === 'Enter') savePreset(); };

ui.btnMinChime.onclick = () => { toggleAnchor('min'); showSaveFlag(); };
ui.btnWarnChime.onclick = () => { toggleAnchor('warn'); showSaveFlag(); };
ui.btnFinGong.onclick = () => { toggleAnchor('fin'); showSaveFlag(); };

ui.sel.onchange = () => {
    durationMins = parseInt(ui.sel.value);
    localStorage.setItem(STORE_KEYS.int, ui.sel.value);
    ui.lblT.innerText = ui.sel.value;
    showSaveFlag();
};

document.getElementById('testMin').onclick = () => { if (typeof playChime !== 'undefined') playChime(0); };
document.getElementById('testPing').onclick = () => { if (typeof playChime !== 'undefined') playChime(1); };
document.getElementById('testWarn').onclick = () => { if (typeof playChime !== 'undefined') playChime(3); };
document.getElementById('testFin').onclick = () => { if (typeof playChime !== 'undefined') playChime(2); };
document.getElementById('testShield').onclick = async () => {
    if (typeof noiseRunning !== 'undefined' && noiseRunning) return;
    if (typeof toggleNoise !== 'undefined') await toggleNoise();
    setTimeout(() => { if (typeof noiseRunning !== 'undefined' && noiseRunning && typeof toggleNoise !== 'undefined') toggleNoise(); }, 2000);
};
document.getElementById('testShield2').onclick = async () => {
    if (typeof noiseRunning !== 'undefined' && noiseRunning) return;
    if (typeof toggleNoise !== 'undefined') await toggleNoise();
    setTimeout(() => { if (typeof noiseRunning !== 'undefined' && noiseRunning && typeof toggleNoise !== 'undefined') toggleNoise(); }, 2000);
};

window.onkeydown = (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); toggleSession(); }
    if (k === 'b') toggleBio();
    if (k === 'a') { ui.nBtn.click(); }
    if (k === 'p') togglePulse();
    if (k === 'f') document.getElementById('fsBtn').click();
    if (k === 's') { ui.overlay.classList.toggle('visible'); if (ui.overlay.classList.contains('visible')) switchTab('ambient'); }
    if (k === 'h') { ui.overlay.classList.add('visible'); switchTab('help'); } // Corrected tab name if it was manual
};

window.onload = load;

// PWA Logic
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'block';
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
    });
}

window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    console.log('TETHER Installed');
});
