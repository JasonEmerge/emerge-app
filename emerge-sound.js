/* ==================================================================
   EMERGE_SOUND v2 — Final Sound System V4 engine
   ------------------------------------------------------------------
   Sonic law (locked): low-register, physical, dark, restrained, dry,
   spatial. No pitch sweeps. Movement expressed via gain / density /
   stereo only. Relative WAV levels are preserved — every cue plays
   at gain 1.0; the master limiter exists strictly to guard against
   stacking, never to reshape a single cue.
   iOS: the context is born inside the first user gesture. Any cue
   fired while the context is locked or a buffer is still decoding
   is dropped silently (loops are remembered and started when ready).
   ================================================================== */
(function(){
  'use strict';

  var FILES = {
    voidatm:      '01_void_atmosphere.wav',
    motion:       '02_phone_motion_bend_FINAL.wav',
    fold:         '03_c_vacuum_fold.wav',
    tap:          '04_tap_to_emerge_v3_quieter.wav',
    dot:          '05_blue_dot_v3_very_faint.wav',
    growth:       '06_earth_growth_no_rising_tone.wav',
    arrival:      '07_earth_arrival.wav',
    orbit:        '08_earth_rotation_silent_orbit_FINAL.wav',
    found:        '09_location_found.wav',
    harmony:      '11_birth_data_complete_fixed_harmony.wav',
    calc:         '12_tropical_calculation.wav',
    construction: '14_b_magnetic_construction.wav',
    sweep:        '15_fast_screen_sweep_FINAL.wav',
    tokens:       '16_b_unified_planet_tokens.wav',
    impact:       '17_final_reveal_clean_impact.wav',
    hum:          '18_reading_hum_plus_20.wav',
    choice:       '19_two_perspectives.wav',
    ascension:    '20_ascension_final.wav',
    music:        '21_chart_music_bells.wav'
  };
  var IS_LOOP = { voidatm:1, motion:1, orbit:1, calc:1, hum:1, choice:1, music:1 };
  /* one-shots that briefly duck the void bed so they read clearly */
  var DUCKS   = { found:1, harmony:1, arrival:1, impact:1, fold:1, ascension:1 };

  var AUDIO_VER = '6';   /* bump on ANY wav content change — defeats stale wav caching */
  var ctx = null, master = null, limiter = null;
  var buffers = {}, loading = {}, loops = {}, wantLoop = {};
  var fired = {};                   /* timeline cues fired once per page */
  var voidGain = null;              /* remembered for ducking */
  var motionLevel = 0, motionRAF = 0, lastMotion = 0;

  function ready(){ return ctx && ctx.state === 'running'; }

  function buildGraph(){
    master = ctx.createGain();
    master.gain.value = 1.0;
    limiter = ctx.createDynamicsCompressor();       /* stacking guard only */
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(limiter);
    limiter.connect(ctx.destination);
  }

  function load(name){
    if (buffers[name] || loading[name]) return;
    loading[name] = true;
    fetch(FILES[name] + '?a=' + AUDIO_VER)
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function(ab){ return ctx.decodeAudioData(ab); })
      .then(function(buf){
        buffers[name] = buf; loading[name] = false;
        if (wantLoop[name]) { wantLoop[name] = false; startLoop(name); }
      })
      .catch(function(e){ loading[name] = false;
        try { console.log('[SOUND] load failed:', name, e && e.message); } catch(_){} });
  }

  function unlock(){
    try {
      if (!ctx){
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        buildGraph();
        for (var k in FILES) load(k);            /* warm every cue */
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch(_){}
  }

  function makeSource(name, pan){
    var src = ctx.createBufferSource();
    src.buffer = buffers[name];
    var g = ctx.createGain();
    g.gain.value = 1.0;                          /* relative WAV levels preserved */
    src.connect(g);
    if (typeof pan === 'number' && ctx.createStereoPanner){
      var p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(master);
    } else g.connect(master);
    return { src: src, gain: g };
  }

  function duckVoid(){
    if (!voidGain) return;
    var t = ctx.currentTime;
    try {
      voidGain.gain.cancelScheduledValues(t);
      voidGain.gain.setValueAtTime(voidGain.gain.value, t);
      voidGain.gain.linearRampToValueAtTime(0.35, t + 0.12);
      voidGain.gain.linearRampToValueAtTime(1.0,  t + 1.8);
    } catch(_){}
  }

  /* digit-entry tone: generated, not sampled — one fixed clock-set beep,
     identical pitch and level on every press */
  function beep(){
    if (!ready()) return;
    var t = ctx.currentTime;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.20, t + 0.002);
    g.gain.setValueAtTime(0.20, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.085);
    g.connect(master);
    var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 620;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 1240;
    var g2 = ctx.createGain(); g2.gain.value = 0.18;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    o1.start(t); o2.start(t); o1.stop(t + 0.1); o2.stop(t + 0.1);
  }

  function play(name, opts){
    if (name === 'pulse') return beep();
    if (!ready() || !buffers[name]) return;      /* locked or not decoded: drop */
    opts = opts || {};
    var n = makeSource(name, opts.pan);
    if (DUCKS[name]) duckVoid();
    try { n.src.start(0); } catch(_){}
  }

  /* short grain from a one-shot bank — digit pulses stay in the approved timbre */
  function grain(name){
    if (!ready() || !buffers[name]) return;
    var buf = buffers[name];
    var n = makeSource(name);
    var maxOff = Math.max(0, buf.duration - 0.25);
    var off = Math.random() * maxOff;
    var t = ctx.currentTime;
    try {
      n.gain.gain.setValueAtTime(0.0, t);
      n.gain.gain.linearRampToValueAtTime(1.0, t + 0.015);
      n.gain.gain.setValueAtTime(1.0, t + 0.13);
      n.gain.gain.linearRampToValueAtTime(0.0, t + 0.2);
      n.src.start(0, off, 0.22);
    } catch(_){}
  }

  function startLoop(name){
    if (loops[name]) return;
    if (!ready() || !buffers[name]) { wantLoop[name] = true; return; }
    var n = makeSource(name);
    n.src.loop = true;
    var t = ctx.currentTime;
    var target = (name === 'motion') ? 0.0 : 1.0;  /* motion bed rides intensity */
    var fadeIn = (name === 'music') ? 3.5 : 0.9;   /* the bells drift in, not arrive */
    try {
      n.gain.gain.setValueAtTime(0.0, t);
      n.gain.gain.linearRampToValueAtTime(target, t + fadeIn);
      n.src.start(0);
    } catch(_){}
    loops[name] = n;
    if (name === 'voidatm') voidGain = n.gain;
  }

  function stopLoop(name, fade){
    wantLoop[name] = false;
    var n = loops[name];
    if (!n) return;
    loops[name] = null;
    if (name === 'voidatm') voidGain = null;
    var f = (typeof fade === 'number') ? fade : 1.0;
    try {
      var t = ctx.currentTime;
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setValueAtTime(n.gain.gain.value, t);
      n.gain.gain.linearRampToValueAtTime(0.0, t + f);
      n.src.stop(t + f + 0.05);
    } catch(_){}
  }

  function stopAll(){
    for (var k in loops) if (loops[k]) stopLoop(k, 0.35);
  }

  /* movement expressed via gain only: touch / gyro pushes the motion bed up,
     silence lets it fall away */
  function motionDecay(){
    motionRAF = 0;
    if (!loops.motion) return;
    var now = performance.now();
    var idle = now - lastMotion;
    if (idle > 140) motionLevel = Math.max(0, motionLevel - 0.028);
    try { loops.motion.gain.gain.setTargetAtTime(motionLevel, ctx.currentTime, 0.08); } catch(_){}
    if (motionLevel > 0.001) motionRAF = requestAnimationFrame(motionDecay);
  }
  function motion(strength){
    if (!ready()) return;
    if (!loops.motion) startLoop('motion');
    lastMotion = performance.now();
    var s = (typeof strength === 'number') ? strength : 0.5;
    motionLevel = Math.min(1, motionLevel + 0.10 * s + 0.04);
    if (!motionRAF) motionRAF = requestAnimationFrame(motionDecay);
  }

  /* event-driven sync to the real drawing timeline: each named cue fires
     exactly once when t crosses its threshold */
  function tick(map, t, pans){
    for (var key in map){
      if (!fired[key] && t >= map[key]){
        fired[key] = true;
        if (IS_LOOP[key]) startLoop(key);
        else play(key, pans && (key in pans) ? { pan: pans[key] } : undefined);
      }
    }
  }

  function haptic(ms){
    try { navigator.vibrate && navigator.vibrate(ms || 10); } catch(_){}
  }

  window.EMERGE_SOUND = {
    unlock: unlock, play: play, grain: grain,
    loop: startLoop, stopLoop: stopLoop, stopAll: stopAll,
    motion: motion, tick: tick, haptic: haptic
  };
})();
