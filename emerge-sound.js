/* ==========================================================================
   EMERGE — CENTRALIZED SOUND ENGINE · Final Sound System V4
   One engine. The animation sends meaningful events; the engine decides
   how they are rendered. All material comes from the 18 approved WAVs.
   Rules honored throughout: low-register, physical, dark, restrained,
   dry, spatial. No pitch sweeps. Fixed pitch during movement. Movement is
   expressed only through gain, density, stereo placement, low-pass
   filtering and controlled decay. Master limiter prevents stacking.
   Fails silently and gracefully everywhere (no audio ≠ broken app).
   ========================================================================== */
(function (global) {
  'use strict';

  var CUES = {
    void_:       'audio/01_void_atmosphere.wav',
    motion:      'audio/02_phone_motion_bend_FINAL.wav',
    zoom:        'audio/03_c_vacuum_fold.wav',
    tap:         'audio/04_tap_to_emerge_v3_quieter.wav',
    blueDot:     'audio/05_blue_dot_v3_very_faint.wav',
    growth:      'audio/06_earth_growth_no_rising_tone.wav',
    arrival:     'audio/07_earth_arrival.wav',
    orbit:       'audio/08_earth_rotation_silent_orbit_FINAL.wav',
    located:     'audio/09_location_found.wav',
    digits:      'audio/10_c_low_digital_pulses.wav',
    birthDone:   'audio/11_birth_data_complete_fixed_harmony.wav',
    calc:        'audio/12_tropical_calculation.wav',
    breath:      'audio/13_breath_c__distant_vacuum_breath.wav',
    construct:   'audio/14_b_magnetic_construction.wav',
    sweep:       'audio/15_fast_screen_sweep_v3_quieter.wav',
    planets:     'audio/16_b_unified_planet_tokens.wav',
    reveal:      'audio/17_final_reveal_clean_impact.wav',
    readingHum:  'audio/18_reading_hum_plus_20.wav'
  };

  /* The final WAVs already carry the approved relative volumes.
     Per-cue gains stay at (or near) unity — never re-normalized. */
  var LEVEL = {
    void_: 0.9, motion: 1.0, zoom: 0.9, tap: 1.0, blueDot: 1.0,
    growth: 1.0, arrival: 1.0, orbit: 1.0, located: 1.0, digits: 0.8,
    birthDone: 1.0, calc: 0.9, breath: 1.0, construct: 0.9, sweep: 1.0,
    planets: 1.0, reveal: 1.0, readingHum: 1.0
  };

  /* Void level per scene — the atmosphere never dominates the visual. */
  var VOID_SCENE = { void: 0.85, explore: 0.85, entry: 0.45, reading: 0.0 };

  var ctx = null, master = null, limiter = null;
  var buffers = {}, loading = false, loaded = false;
  var scene = 'void';
  var voidLayer = null, humLayer = null, motionLayer = null, orbitLayer = null, calcLayer = null;
  var growthSrc = null, growthGain = null, growthStarted = false, arrived = false;
  var lastMove = 0, lastZoom = 0, lastDigit = 0;
  var pendingResume = false;

  /* ---------------------------------------------------------- utilities */
  function now() { return ctx ? ctx.currentTime : 0; }

  function makeLoop(name, startGain) {
    if (!ctx || !buffers[name]) return null;
    var src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 20000;
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    var g = ctx.createGain();
    g.gain.value = startGain || 0;
    if (pan) { src.connect(lp); lp.connect(pan); pan.connect(g); }
    else { src.connect(lp); lp.connect(g); }
    g.connect(master);
    try { src.start(0, Math.random() * src.buffer.duration * 0.5); } catch (_) { return null; }
    return { src: src, gain: g, pan: pan, lp: lp, level: LEVEL[name] || 1 };
  }

  function setLoopTargets(layer, gain, panV, lpFreq, tc) {
    if (!layer || !ctx) return;
    var t = now();
    layer.gain.gain.setTargetAtTime(gain * layer.level, t, tc || 0.15);
    if (layer.pan && panV != null) layer.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, panV)), t, tc || 0.15);
    if (lpFreq != null) layer.lp.frequency.setTargetAtTime(lpFreq, t, tc || 0.15);
  }

  /* One-shot: whole cue, or a slice, with a hard-edged but click-free
     envelope. No playbackRate changes anywhere — pitch stays fixed. */
  function shot(name, opt) {
    if (!ctx || !buffers[name]) return null;
    opt = opt || {};
    var b = buffers[name];
    var src = ctx.createBufferSource();
    src.buffer = b;
    var g = ctx.createGain();
    var pan = (ctx.createStereoPanner && opt.pan != null) ? ctx.createStereoPanner() : null;
    var offset = opt.offset || 0;
    var dur = opt.dur || (b.duration - offset);
    var vol = (opt.gain != null ? opt.gain : 1) * (LEVEL[name] || 1);
    var t = now();
    var atk = opt.atk != null ? opt.atk : 0.004;
    var rel = opt.rel != null ? opt.rel : Math.min(0.08, dur * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + Math.max(atk, dur - rel));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    if (pan) { pan.pan.value = Math.max(-1, Math.min(1, opt.pan)); src.connect(g); g.connect(pan); pan.connect(master); }
    else { src.connect(g); g.connect(master); }
    try { src.start(t, offset, dur + 0.05); } catch (_) { return null; }
    if (opt.duck) duckVoid(opt.duck, dur);
    return { src: src, gain: g };
  }

  /* Short grain taken from inside an approved cue — used for digits,
     wheel divisions and planet tokens so every micro-sound stays inside
     the approved timbre family. Narrow low family, no melody. */
  function grain(name, opt) {
    if (!ctx || !buffers[name]) return;
    opt = opt || {};
    var b = buffers[name];
    var dur = opt.dur || 0.09;
    var span = Math.max(0.05, b.duration - dur - 0.1);
    var offset = opt.offset != null ? opt.offset : (0.05 + Math.random() * span);
    shot(name, { offset: offset, dur: dur, gain: opt.gain, pan: opt.pan, atk: 0.003, rel: dur * 0.5 });
  }

  /* When one important cue plays, the Void is slightly lowered beneath
     it rather than everything being raised. */
  function duckVoid(amount, seconds) {
    if (!voidLayer || !ctx) return;
    var base = (VOID_SCENE[scene] != null ? VOID_SCENE[scene] : 0.6);
    var t = now();
    voidLayer.gain.gain.cancelScheduledValues(t);
    voidLayer.gain.gain.setTargetAtTime(base * (1 - amount) * voidLayer.level, t, 0.05);
    voidLayer.gain.gain.setTargetAtTime(base * voidLayer.level, t + (seconds || 1), 0.6);
  }

  function haptic(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
  }

  /* ---------------------------------------------------------- lifecycle */
  function init() {
    if (ctx) { resume(); return; }
    try {
      ctx = new (global.AudioContext || global.webkitAudioContext)();
    } catch (_) { return; }
    master = ctx.createGain();
    master.gain.value = 0.9;
    limiter = ctx.createDynamicsCompressor();
    /* Limiter only prevents accidental stacking and clipping. */
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.18;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    loadAll();
    resume();
  }

  function resume() {
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      pendingResume = true;
      ctx.resume().then(function () { pendingResume = false; startCore(); }).catch(function () {});
    } else startCore();
  }

  function loadAll() {
    if (loading || loaded) return;
    loading = true;
    var names = Object.keys(CUES), left = names.length;
    names.forEach(function (n) {
      fetch(CUES[n]).then(function (r) { return r.arrayBuffer(); })
        .then(function (ab) { return ctx.decodeAudioData(ab); })
        .then(function (buf) { buffers[n] = buf; })
        .catch(function () {})
        .then(function () { if (--left === 0) { loaded = true; loading = false; startCore(); } });
    });
  }

  function startCore() {
    if (!ctx || !loaded || ctx.state !== 'running') return;
    if (!voidLayer && buffers.void_) {
      voidLayer = makeLoop('void_', 0);
      setLoopTargets(voidLayer, VOID_SCENE[scene] != null ? VOID_SCENE[scene] : 0.6, 0, 20000, 1.2);
    }
    if (!motionLayer && buffers.motion) { motionLayer = makeLoop('motion', 0); motionLayer.lp.frequency.value = 300; }
    if (!orbitLayer && buffers.orbit) { orbitLayer = makeLoop('orbit', 0); orbitLayer.lp.frequency.value = 500; }
    if (scene === 'reading') startReading();
  }

  function startReading() {
    if (!ctx || !buffers.readingHum) return;
    if (!humLayer) humLayer = makeLoop('readingHum', 0);
    setLoopTargets(humLayer, 0.9, 0, 20000, 1.5);
    if (voidLayer) setLoopTargets(voidLayer, 0.12, 0, 900, 2.0);
  }

  function setScene(s) {
    scene = s;
    if (!ctx) return;
    if (s === 'reading') { stopCalc(); startReading(); return; }
    if (voidLayer) setLoopTargets(voidLayer, VOID_SCENE[s] != null ? VOID_SCENE[s] : 0.6, 0, 20000, 1.0);
    if (humLayer && s !== 'reading') setLoopTargets(humLayer, 0, 0, 20000, 1.0);
  }

  function stopCalc() {
    if (calcLayer) { setLoopTargets(calcLayer, 0, 0, 20000, 0.2);
      var l = calcLayer; calcLayer = null;
      setTimeout(function () { try { l.src.stop(); } catch (_) {} }, 800); }
  }

  /* ------------------------------------------------------------- events */
  function emit(evt, d) {
    d = d || {};
    /* If iOS is still holding the context suspended (no gesture yet),
       events are dropped rather than queued — otherwise every scheduled
       cue would release at once on resume. */
    if (!ctx || ctx.state !== 'running') return;
    try { route(evt, d); } catch (_) {}
  }

  function route(evt, d) {
    switch (evt) {

      /* Cue 2 — phone / drag motion. Fixed pitch. Volume, density,
         stereo placement and a small filter opening follow velocity.
         Natural decay when movement stops (setTargetAtTime tail). */
      case 'interaction:move': {
        var v = Math.max(0, Math.min(1, d.velocity || 0));
        var t = performance.now();
        if (t - lastMove < 40) return;       // throttle
        lastMove = t;
        var g2 = v * 0.14;                    // extremely faint by design
        setLoopTargets(motionLayer, g2, (d.x || 0) * 0.7, 250 + v * 900, 0.12);
        /* decay back toward silence if no further events arrive */
        if (motionLayer) motionLayer.gain.gain.setTargetAtTime(0, now() + 0.25, 0.5);
        break;
      }

      /* Cue 3 — pinch/zoom, Vacuum Fold. Space compressing or widening:
         inward = denser + slightly darker, outward = release. No pitch. */
      case 'interaction:zoom': {
        var tz = performance.now();
        if (tz - lastZoom < 140) return;
        lastZoom = tz;
        var inward = d.direction === 'in' || (d.velocity || 0) > 0;
        grain('zoom', { dur: 0.22, gain: 0.28 + Math.min(0.25, Math.abs(d.velocity || 0.2) * 0.2), pan: 0 });
        if (voidLayer) setLoopTargets(voidLayer,
          (VOID_SCENE[scene] || 0.6) * (inward ? 1.12 : 0.92), 0, inward ? 5000 : 20000, 0.25);
        break;
      }

      /* Cue 4 — Tap to Emerge. The primary Emerge Pulse. */
      case 'emerge:tap':
        shot('tap', { gain: 1, duck: 0.5 });
        haptic(18);
        break;

      /* Cue 5 — Blue dot. Barely perceptible, one tiny centered pulse. */
      case 'blueDot':
        shot('blueDot', { gain: 1 });
        haptic(4);
        break;

      /* Cue 6 — Earth growth. Builds through density and pressure, not
         pitch: the approved growth render plays once; its gain and filter
         follow the actual formation progress. */
      case 'earth:formation': {
        var p = Math.max(0, Math.min(1, d.progress || 0));
        if (!growthStarted && buffers.growth) {
          growthStarted = true;
          var s = ctx.createBufferSource(); s.buffer = buffers.growth; s.loop = true;
          growthGain = ctx.createGain(); growthGain.gain.value = 0;
          s.connect(growthGain); growthGain.connect(master);
          try { s.start(); growthSrc = s; } catch (_) {}
          duckVoid(0.35, 8);
        }
        if (growthGain) growthGain.gain.setTargetAtTime(Math.pow(p, 1.4) * (LEVEL.growth || 1), now(), 0.25);
        break;
      }

      /* Cue 7 — Earth arrival. One deep rounded impact; excess falls away. */
      case 'earth:arrival':
        if (arrived) break;
        arrived = true;
        if (growthGain) {
          growthGain.gain.cancelScheduledValues(now());
          growthGain.gain.setTargetAtTime(0, now(), 0.12);
          (function (sr) { setTimeout(function () { try { sr.stop(); } catch (_) {} }, 900); })(growthSrc);
        }
        shot('arrival', { gain: 1, duck: 0.6 });
        haptic(30);
        /* Earth settles: atmosphere reduced significantly for the prompt */
        setTimeout(function () { setScene('entry'); }, 1400);
        break;

      /* Cue 8 — Silent Orbit. Planetary mass shifting through space.
         Intensity follows actual rotational velocity; stereo follows
         direction; restrained rise and release; pitch untouched. */
      case 'earth:rotation': {
        var mi = Math.max(0, Math.min(1, d.velocity || 0));
        setLoopTargets(orbitLayer, mi * 0.8, (d.direction || 0) * 0.6, 350 + mi * 1200, 0.2);
        if (orbitLayer) orbitLayer.gain.gain.setTargetAtTime(0, now() + 0.35, 0.7);
        break;
      }

      /* Cue 9 — Location found. Coordinate acquired. */
      case 'location:found':
        if (orbitLayer) setLoopTargets(orbitLayer, 0, 0, 500, 0.2);
        shot('located', { gain: 1, pan: (d.x != null ? d.x : 0) * 0.3, duck: 0.45 });
        haptic(14);
        break;

      /* Meaningful entry actions only (suggestion available / city chosen). */
      case 'ui:select':
        grain('digits', { dur: 0.1, gain: 0.5, pan: 0 });
        break;

      /* Cue 10 — Low digital pulses. One very short muted pulse per digit,
         slight variation within a narrow low family, never a melody. */
      case 'digit:input': {
        var td = performance.now();
        if (td - lastDigit < 50) return;
        lastDigit = td;
        grain('digits', { dur: 0.08, gain: d.field === 'time' ? 0.6 : 0.5, pan: (Math.random() - 0.5) * 0.15 });
        break;
      }

      /* Cue 11 — Birth data complete. Fixed-harmony bloom, no rise. */
      case 'birthData:complete':
        shot('birthDone', { gain: 1, duck: 0.5 });
        haptic(16);
        break;

      /* Chart choice — the sound opens slightly, stays dark. */
      case 'chart:choice':
        if (voidLayer) setLoopTargets(voidLayer, (VOID_SCENE.entry || 0.45) * 1.15, 0, 20000, 0.8);
        break;

      /* Cue 12 — Calculation. Low layer + irregular muted micro-pulses,
         driven by actual system events, never a fixed-duration file. */
      case 'chart:selected':
        grain('calc', { dur: 0.14, gain: 0.55, pan: d.system === 'sidereal' ? 0.12 : -0.12 });
        if (voidLayer) setLoopTargets(voidLayer, (VOID_SCENE.entry || 0.45) * 0.8, 0, 4000, 0.4);
        break;
      case 'calculation:start':
        if (!calcLayer && buffers.calc) { calcLayer = makeLoop('calc', 0); }
        setLoopTargets(calcLayer, 0.5, 0, 3500, 0.6);
        break;
      case 'calculation:progress':
        grain('calc', { dur: 0.07 + Math.random() * 0.05, gain: 0.4, pan: (Math.random() - 0.5) * 0.3 });
        break;
      case 'calculation:complete':
        stopCalc();
        haptic(10);
        break;

      /* Cue 13 — “The sky has always been here.” Intentional near-silence:
         calculation pulses removed, Void dropped, one faint breath. */
      case 'text:skyAlwaysHere':
        stopCalc();
        if (voidLayer) {
          var tb = now();
          voidLayer.gain.gain.cancelScheduledValues(tb);
          voidLayer.gain.gain.setTargetAtTime(0.05 * voidLayer.level, tb, 0.18);
          voidLayer.gain.gain.setTargetAtTime((VOID_SCENE[scene] || 0.6) * voidLayer.level, tb + 3.2, 1.4);
        }
        setTimeout(function () { shot('breath', { gain: 0.8 }); }, 250);
        break;

      /* Cue 14 — Wheel construction. Geometry locking into place.
         Major rings: low magnetic placements. Divisions: dry snaps.
         Volumes vary with the drawing, never an ascending sequence. */
      case 'wheel:ring':
        grain('construct', { dur: 0.24, gain: 0.65 - (d.index || 0) * 0.06, pan: ((d.index || 0) % 2 ? 0.15 : -0.15) });
        break;
      case 'wheel:division':
        grain('construct', { dur: 0.07, gain: 0.3 + Math.random() * 0.15, pan: (Math.random() - 0.5) * 0.4 });
        break;
      case 'wheel:signs':
        grain('construct', { dur: 0.3, gain: 0.4, pan: 0 });
        break;

      /* Cue 15 — Fast screen sweep. Follows direction across the field,
         dry, ends cleanly. */
      case 'screen:sweep': {
        var sw = shot('sweep', { gain: 1 });
        if (sw && ctx.createStereoPanner) { /* direction handled via cue's own image */ }
        break;
      }

      /* Cue 16 — Unified planet tokens. Same arrival language for every
         planet; subtle density/attack variation; stereo from screen x. */
      case 'planet:reveal': {
        var px = d.x != null ? d.x : 0;                       // -1..1
        var heavy = /saturn|pluto|jupiter|sun|rahu|ketu/i.test(d.planet || '');
        grain('planets', { dur: heavy ? 0.30 : 0.22, gain: heavy ? 0.9 : 0.75, pan: px * 0.6 });
        break;
      }

      /* Cue 17 — Final chart reveal. Immediate low Emerge impact, short
         restrained resonance, construction/calculation layers removed,
         quick transition into the reading atmosphere. */
      case 'chart:revealed':
        stopCalc();
        shot('reveal', { gain: 1, duck: 0.7 });
        haptic(24);
        setTimeout(function () { setScene('reading'); }, 700);
        break;

      default: break;
    }
  }

  /* Unlock on any first gesture so navigations into the reveal pages can
     start sound the moment the user touches the screen. */
  function armUnlock() {
    var fn = function () { init(); };
    global.addEventListener('pointerdown', fn, { once: true, passive: true });
    global.addEventListener('touchstart', fn, { once: true, passive: true });
    global.addEventListener('keydown', fn, { once: true });
  }
  armUnlock();

  global.EMERGE_SOUND = {
    init: init,
    setScene: setScene,
    emit: emit,
    _state: function () { return { loaded: loaded, ctx: ctx && ctx.state, scene: scene }; }
  };
})(window);
