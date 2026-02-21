// TETHER: Audio Engine
// Handles all sound synthesis, noise generation, and chimes

let ctx, noiseMaster, noiseOut1, noiseOut2, analyser, dataArray;
let noiseNode1, lpfNode1, noiseNode2, lpfNode2;
let noiseRunning = false;

const initAudio = () => {
    return new Promise((resolve) => {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            dataArray = new Uint8Array(analyser.frequencyBinCount);

            noiseMaster = ctx.createGain();
            noiseMaster.connect(analyser);
            analyser.connect(ctx.destination);

            noiseOut1 = ctx.createGain(); noiseOut1.connect(noiseMaster);
            noiseOut2 = ctx.createGain(); noiseOut2.connect(noiseMaster);

            // Access UI globals from app.js (ensure app.js logic populates these or keys)
            // Note: ui object is global
            if (typeof ui !== 'undefined') {
                noiseOut1.gain.value = ui.vNoise.value;
                noiseOut2.gain.value = ui.vNoise2.value;
            }
        }
        if (ctx.state === 'suspended') ctx.resume().then(resolve); else resolve();
    });
};

const playChime = async (type) => {
    if (navigator.vibrate && typeof hapticEnabled !== 'undefined' && hapticEnabled) {
        if (type === 0) navigator.vibrate(20);
        else if (type === 1) navigator.vibrate(10);
        else navigator.vibrate([100, 50, 100]);
    }
    await initAudio();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(analyser);

    // Type 0: Minute, 1: Ping, 2: Finish, 3: Warning
    if (type === 0) {
        osc.frequency.value = 660;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(ui.vMin.value, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(); osc.stop(t + 0.4);
    }
    else if (type === 1) {
        osc.frequency.value = 440;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(ui.vPing.value, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(); osc.stop(t + 0.1);
    }
    else if (type === 3) {
        osc.frequency.value = 880;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(ui.vWarn.value, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.start(); osc.stop(t + 0.8);
    }
    else {
        [200, 400, 600].forEach(f => {
            const o = ctx.createOscillator(); const gain = ctx.createGain();
            o.frequency.value = f; o.connect(gain); gain.connect(analyser);
            gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(ui.vFin.value, t + 0.1); gain.gain.exponentialRampToValueAtTime(0.001, t + 2);
            o.start(); o.stop(t + 2);
        });
    }
};

const toggleNoise = async () => {
    await initAudio();
    noiseRunning = !noiseRunning;
    if (noiseRunning) { updateSoundscape(1); updateSoundscape(2); }
    else {
        if (noiseNode1) { try { noiseNode1.stop(); } catch (e) { } noiseNode1.disconnect(); }
        if (noiseNode2) { try { noiseNode2.stop(); } catch (e) { } noiseNode2.disconnect(); }
    }
};

const updateSoundscape = async (layer = 1) => {
    if (!noiseRunning) return;
    await initAudio();
    const type = layer === 1 ? ui.shieldSel.value : ui.shieldSel2.value;

    // Cleanup existing
    if (layer === 1 && noiseNode1) { try { noiseNode1.stop(); } catch (e) { } noiseNode1.disconnect(); }
    if (layer === 2 && noiseNode2) { try { noiseNode2.stop(); } catch (e) { } noiseNode2.disconnect(); }

    if (type === 'none') return;

    const bSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(type === 'binaural' ? 2 : 1, bSize, ctx.sampleRate);
    const d = buf.getChannelData(0); let lastOut = 0;
    for (let i = 0; i < bSize; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'brown') lastOut = (lastOut + 0.02 * w) / 1.02; else lastOut = (lastOut + 0.1 * w) / 1.1;
        let final = lastOut * 3.5;
        if (type === 'waves') final *= (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.1 * i / ctx.sampleRate));
        d[i] = final;
    }
    if (type === 'binaural') {
        const dR = buf.getChannelData(1);
        for (let i = 0; i < bSize; i++) { d[i] = Math.sin(2 * Math.PI * 200 * i / ctx.sampleRate) * 0.1; dR[i] = Math.sin(2 * Math.PI * 210 * i / ctx.sampleRate) * 0.1; }
    }

    const source = ctx.createBufferSource(); source.buffer = buf; source.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = (type === 'rain' ? 2000 : 400);
    source.connect(filter); filter.connect(layer === 1 ? noiseOut1 : noiseOut2); source.start();

    if (layer === 1) { noiseNode1 = source; lpfNode1 = filter; } else { noiseNode2 = source; lpfNode2 = filter; }
};
