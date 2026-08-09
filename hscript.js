/* =========================================================
   HANUMAN JI TOSS — hscript.js
   Sections:
   1. State & Storage
   2. Secure Random Coin Logic
   3. Coin Flip Animation
   4. Result Display
   5. Statistics
   6. Particle Background
   7. Ambient Sound (procedural, no external file)
   8. Init / Event Wiring
   ========================================================= */

(function () {
  'use strict';

  /* ---------- 1. STATE & STORAGE ---------- */
  const STORAGE_KEY = 'hanumanTossStats';

  const defaultStats = {
    total: 0,
    heads: 0,
    tails: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastResult: null
  };

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultStats };
      const parsed = JSON.parse(raw);
      return { ...defaultStats, ...parsed };
    } catch (err) {
      console.warn('Could not read saved stats, starting fresh.', err);
      return { ...defaultStats };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (err) {
      console.warn('Could not save stats.', err);
    }
  }

  let stats = loadStats();
  let isFlipping = false;

  /* ---------- 2. SECURE RANDOM COIN LOGIC ---------- */
  // Uses crypto.getRandomValues for the actual outcome (not faked / not pre-decided by animation).
  function secureCoinFlip() {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0] % 2 === 0 ? 'heads' : 'tails';
  }

  // Non-cryptographic randomness is fine for purely cosmetic spin variety.
  function randomSpinCount(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ---------- 3. COIN FLIP ANIMATION ---------- */
  const coinInner = document.getElementById('coinInner');
  const coinBtn = document.getElementById('coin');
  const tossBtn = document.getElementById('tossBtn');
  const tossBtnLabel = document.getElementById('tossBtnLabel');

  function runToss() {
    if (isFlipping) return;
    isFlipping = true;

    tossBtn.disabled = true;
    tossBtnLabel.textContent = 'THE COIN IS RISING…';
    coinBtn.setAttribute('aria-label', 'The divine coin is being tossed.');
    document.body.classList.add('toss-active');

    const outcome = secureCoinFlip(); // ground-truth result, decided before animation ends
    const fullSpins = randomSpinCount(4, 7); // extra full rotations for drama
    const finalYDeg = fullSpins * 360 + (outcome === 'tails' ? 180 : 0);
    const wobbleX = randomSpinCount(-14, 14);

    coinInner.style.setProperty('--flip-target', `rotateY(${finalYDeg}deg) rotateX(${wobbleX}deg)`);

    // restart animation cleanly
    coinInner.classList.remove('flipping');
    void coinInner.offsetWidth; // force reflow
    coinInner.classList.add('flipping');

    playTossSound();
    burstParticles();

    const ANIMATION_MS = 1900;
    window.setTimeout(() => {
      finishToss(outcome);
    }, ANIMATION_MS);
  }

  /* ---------- 4. RESULT DISPLAY ---------- */
  const resultCard = document.getElementById('resultCard');
  const resultWord = document.getElementById('resultWord');
  const resultMessage = document.getElementById('resultMessage');

  const headsMessages = [
    'Jai Bajrang Bali.',
    'Courage answers the call.',
    'Strength walks beside you now.'
  ];
  const tailsMessages = [
    'Courage chooses its path.',
    'Even the unseen side carries devotion.',
    'Destiny turns; walk forward with faith.'
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function finishToss(outcome) {
    resultWord.textContent = outcome === 'heads' ? 'HEADS' : 'TAILS';
    resultMessage.textContent = outcome === 'heads' ? pick(headsMessages) : pick(tailsMessages);

    resultCard.classList.remove('show');
    void resultCard.offsetWidth;
    resultCard.classList.add('show');

    coinBtn.setAttribute(
      'aria-label',
      `Golden divine coin, showing ${outcome}. Press the toss button to flip again.`
    );

    updateStats(outcome);

    tossBtn.disabled = false;
    tossBtnLabel.textContent = 'TOSS THE DIVINE COIN';
    document.body.classList.remove('toss-active');
    isFlipping = false;
  }

  /* ---------- 5. STATISTICS ---------- */
  const statTotal = document.getElementById('statTotal');
  const statHeads = document.getElementById('statHeads');
  const statTails = document.getElementById('statTails');
  const statHeadsRate = document.getElementById('statHeadsRate');
  const statTailsRate = document.getElementById('statTailsRate');
  const statStreak = document.getElementById('statStreak');
  const statLongest = document.getElementById('statLongest');
  const resetBtn = document.getElementById('resetBtn');

  function updateStats(outcome) {
    stats.total += 1;

    if (outcome === 'heads') {
      stats.heads += 1;
    } else {
      stats.tails += 1;
    }

    if (stats.lastResult === outcome) {
      stats.currentStreak += 1;
    } else {
      stats.currentStreak = 1;
    }
    stats.lastResult = outcome;

    if (stats.currentStreak > stats.longestStreak) {
      stats.longestStreak = stats.currentStreak;
    }

    saveStats(stats);
    renderStats(true);
  }

  function renderStats(animate) {
    const headsRate = stats.total ? Math.round((stats.heads / stats.total) * 100) : 0;
    const tailsRate = stats.total ? 100 - headsRate : 0;

    setValue(statTotal, stats.total, animate);
    setValue(statHeads, stats.heads, animate);
    setValue(statTails, stats.tails, animate);
    setValue(statHeadsRate, headsRate + '%', animate);
    setValue(statTailsRate, tailsRate + '%', animate);
    setValue(statStreak, stats.currentStreak, animate);
    setValue(statLongest, stats.longestStreak, animate);
  }

  function setValue(el, value, animate) {
    el.textContent = value;
    if (animate) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  function resetStats() {
    stats = { ...defaultStats };
    saveStats(stats);
    renderStats(false);

    resultCard.classList.remove('show');
    resultWord.textContent = '\u00A0';
    resultMessage.textContent = '\u00A0';

    resetBtn.classList.remove('pulsing');
    void resetBtn.offsetWidth;
    resetBtn.classList.add('pulsing');
  }

  /* ---------- 6. PARTICLE BACKGROUND ---------- */
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = [];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resizeCanvas() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticle(burst) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: burst ? w / 2 + (Math.random() - 0.5) * 120 : Math.random() * w,
      y: burst ? h * 0.42 + (Math.random() - 0.5) * 80 : Math.random() * h,
      r: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * (burst ? 2.2 : 0.15),
      vy: burst ? -(Math.random() * 2.2 + 0.4) : -(Math.random() * 0.25 + 0.05),
      life: 1,
      decay: burst ? Math.random() * 0.012 + 0.006 : Math.random() * 0.002 + 0.0006,
      hue: Math.random() > 0.5 ? '255, 215, 122' : '255, 140, 26'
    };
  }

  function initParticles() {
    if (!canvas) return;
    const count = window.innerWidth < 640 ? 26 : 46;
    particles = Array.from({ length: count }, () => createParticle(false));
  }

  function burstParticles() {
    if (!canvas || reduceMotion) return;
    const extra = Array.from({ length: 22 }, () => createParticle(true));
    particles = particles.concat(extra);
  }

  function animateParticles() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue}, ${Math.max(p.life, 0) * 0.8})`;
      ctx.fill();
    });

    particles = particles.filter((p) => p.life > 0 && p.y > -20);

    // replenish ambient particles gently
    if (particles.length < 40) {
      particles.push(createParticle(false));
    }

    requestAnimationFrame(animateParticles);
  }

  /* ---------- 7. AMBIENT SOUND (procedural, no external audio file) ---------- */
  let audioCtx = null;

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
    return audioCtx;
  }

  // Plays a short ceremonial chime using oscillators only after a user interaction.
  // The whole site works perfectly with sound disabled or unsupported.
  function playTossSound() {
    try {
      const ac = ensureAudioContext();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();

      const now = ac.currentTime;
      const notes = [523.25, 659.25, 783.99]; // a bright, simple ascending chime

      notes.forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const start = now + i * 0.09;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.06, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);

        osc.connect(gain).connect(ac.destination);
        osc.start(start);
        osc.stop(start + 0.7);
      });
    } catch (err) {
      // Sound is optional; fail silently.
      console.warn('Ambient sound unavailable.', err);
    }
  }

  /* ---------- 8. INIT / EVENT WIRING ---------- */
  function init() {
    renderStats(false);

    if (canvas && ctx) {
      resizeCanvas();
      initParticles();
      if (!reduceMotion) {
        requestAnimationFrame(animateParticles);
      } else {
        // draw a single static frame for reduced-motion users
        animateParticles();
      }
      window.addEventListener('resize', resizeCanvas);
    }

    tossBtn.addEventListener('click', runToss);

    // Allow pressing the coin itself (mouse or keyboard) to toss.
    coinBtn.addEventListener('click', runToss);
    coinBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        runToss();
      }
    });

    resetBtn.addEventListener('click', resetStats);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
