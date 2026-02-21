// TETHER: Visual Engine
// Handles Starfield, Visualizer, and Animations

let vizCtx, vizCanvas;
let bgCtx, bgCanvas, stars = [];

const initVisuals = () => {
    // Access UI globals from app.js
    if (typeof ui !== 'undefined' && ui.cvs) {
        vizCanvas = ui.cvs;
        vizCtx = vizCanvas.getContext('2d');
        resizeViz();
        drawViz();
    }

    // Background Canvas
    if (!bgCtx) {
        bgCanvas = document.getElementById('bgCanvas');
        if (bgCanvas) {
            bgCtx = bgCanvas.getContext('2d');
            initStars();
            animateBg();
        }
    }
};

const drawViz = () => {
    requestAnimationFrame(drawViz);
    if (!vizCtx) return;
    if (typeof analyser !== 'undefined' && analyser && typeof dataArray !== 'undefined') analyser.getByteFrequencyData(dataArray);
    vizCtx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);

    const barCount = 120;
    const barWidth = (vizCanvas.width / barCount);
    const centerX = vizCanvas.width / 2;
    // Globals: bioActive, atmSync, atmSyncFactor, noiseRunning
    const syncScale = (typeof bioActive !== 'undefined' && bioActive && typeof atmSync !== 'undefined' && atmSync) ? (0.3 + 0.7 * atmSyncFactor) : 1.0;

    // Check for activity
    let maxVal = 0;
    if (typeof dataArray !== 'undefined' && dataArray) {
        for (let i = 0; i < dataArray.length; i++) if (dataArray[i] > maxVal) maxVal = dataArray[i];
    }

    if (maxVal < 5 && (typeof noiseRunning === 'undefined' || !noiseRunning)) {
        // SYSTEM IDLE: Neural Standby Pulse
        const now = Date.now();
        const ms = now % 1000;
        const pulse = Math.max(0, 1 - (ms / 500)); // 500ms pulse duration
        const glow = 0.02 + (0.1 * pulse);

        vizCtx.strokeStyle = `rgba(34, 211, 238, ${glow})`;
        vizCtx.lineWidth = 1.5;
        vizCtx.beginPath();
        vizCtx.moveTo(0, vizCanvas.height / 2);

        for (let x = 0; x <= vizCanvas.width; x += 5) {
            const normalizedX = (x / vizCanvas.width) * 2 - 1; // -1 to 1
            const dist = Math.abs(x - centerX) / (vizCanvas.width / 2);
            // ECG-like spike in the center
            let yOffset = 0;
            if (dist < 0.2) {
                yOffset = Math.sin(dist * Math.PI * 5) * (15 * pulse) * Math.exp(-dist * 10);
            }
            vizCtx.lineTo(x, (vizCanvas.height / 2) - yOffset);
        }
        vizCtx.stroke();

        // Subtle scanline glow
        vizCtx.fillStyle = `rgba(34, 211, 238, ${glow * 0.3})`;
        vizCtx.fillRect(0, vizCanvas.height / 2, vizCanvas.width, 1);
    } else if (typeof dataArray !== 'undefined' && dataArray) {
        // ACTIVE: Frequency Bars
        // Focus on the sub-mid range (first 30% of spectrum) where our soundscapes live
        for (let i = 0; i < barCount / 2; i++) {
            const sampleIdx = Math.floor(i * (dataArray.length * 0.3) / (barCount / 2));
            const val = dataArray[sampleIdx] || 0;
            const percent = val / 255;
            const h = percent * vizCanvas.height * 0.9 * syncScale;

            vizCtx.fillStyle = `rgba(34, 211, 238, ${0.1 + percent * 0.8})`;

            const xOffset = i * barWidth;

            // Mirror from center
            // Right
            vizCtx.fillRect(centerX + xOffset, vizCanvas.height - h, barWidth - 1, h || 1);
            // Left
            vizCtx.fillRect(centerX - xOffset - barWidth, vizCanvas.height - h, barWidth - 1, h || 1);
        }

        // Baseline glow
        vizCtx.fillStyle = 'rgba(34, 211, 238, 0.05)';
        vizCtx.fillRect(0, vizCanvas.height - 1, vizCanvas.width, 1);
    }
};

const resizeViz = () => { if (vizCanvas) { vizCanvas.width = vizCanvas.offsetWidth; vizCanvas.height = vizCanvas.offsetHeight; } };
window.onresize = () => { resizeViz(); if (bgCanvas) { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; initStars(); } };

const initStars = () => {
    if (!bgCanvas) return;
    bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
    stars = Array.from({ length: 200 }, () => ({
        x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height,
        size: Math.random() * 2, speed: Math.random() * 0.5 + 0.1, opacity: Math.random()
    }));
};

const animateBg = () => {
    requestAnimationFrame(animateBg);
    if (!bgCtx) return;
    bgCtx.fillStyle = '#020617'; bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    stars.forEach(s => {
        s.y += s.speed * ((typeof bioActive !== 'undefined' && bioActive) ? 2 : 1);
        if (s.y > bgCanvas.height) s.y = 0;
        bgCtx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2); bgCtx.fill();
    });
};

const setGhost = (s, o, c) => {
    if (typeof ui !== 'undefined' && ui.ghost) {
        ui.ghost.style.transform = `translate(-50%, -50%) scale(${s})`;
        ui.ghost.style.opacity = o;
        ui.ghost.style.background = `radial-gradient(circle, transparent 20%, ${c}20 50%, ${c}60 100%)`;
    }
};
