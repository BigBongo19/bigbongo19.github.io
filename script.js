(function () {
  var LA = 0.15;              // vooruitplannen (s)
  var UITREKGEBIED = 0.85;    // vast uitrekgebied (s)
  var ctx = null, buffer = null;
  var knop = document.getElementById('knop');

  // zachte vensterfunctie voor de korrels (Hann)
  var HANN = new Float32Array(128);
  for (var i = 0; i < HANN.length; i++) {
    HANN[i] = 0.7 * 0.5 * (1 - Math.cos(2 * Math.PI * i / (HANN.length - 1)));
  }


  function maakCtx() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    return ctx;
  }

  function audio() {
    maakCtx();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // het standaardgeluid (rene_mmyeah) laden zodra de pagina opent
  (async function () {
    try {
      var bin = atob(GELUID), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      buffer = await maakCtx().decodeAudioData(u.buffer);
    } catch (e) {
      console.error('Geluid kon niet worden geladen', e);
    }
  })();


  // Het einde van het geluid (zonder stilte) bepalen
  function effectiefEinde() {
    var d = buffer.getChannelData(0), sr = buffer.sampleRate;
    var e = d.length - 1;
    while (e > 0 && Math.abs(d[e]) < 0.01) e--;
    return Math.max(e / sr, 0.1);
  }

  var spel = null;

  var minder = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function schietPlaatje() {
    var img = document.createElement('img');
    img.src = PLAATJE;
    img.alt = '';
    img.className = 'vlieger';
    var hoogte = Math.min(window.innerHeight * 0.3, 240);
    var halfBreed = hoogte * (520 / 628) / 2;
    var min = halfBreed, max = Math.max(min, window.innerWidth - halfBreed);
    var x = min + Math.random() * (max - min);             // willekeurige plek over de hele breedte
    var draai = (Math.random() < 0.5 ? -1 : 1) * 360;
    img.style.left = x + 'px';
    document.body.appendChild(img);
    var weg = 'translate(-50%, 110%)';
    var top = 'translate(-50%, -' + Math.round(window.innerHeight * 0.5) + 'px)';
    var kf = [
      { transform: weg + ' rotate(0deg)', easing: 'cubic-bezier(.15,.8,.3,1)' },
      { transform: top + ' rotate(' + (minder ? 0 : draai) + 'deg)', offset: 0.45, easing: 'cubic-bezier(.55,0,.9,.4)' },
      { transform: weg + ' rotate(' + (minder ? 0 : draai * 2) + 'deg)' }
    ];
    var a = img.animate(kf, { duration: 1700, fill: 'forwards' });
    a.onfinish = function () { img.remove(); };
  }


  // Kort tikken = plaatje schiet omhoog en draait. Vasthouden = plaatje groeit tot het limiet en trilt.
  var TAP_MAX = 250;     // ms: korter dan dit telt als tik
  var GROEI = 2.7;       // s: duur van klein naar maximaal formaat
  var MAXSCHAAL = 3;     // 200% groter dan het beginformaat (waar het scherm ruimte heeft)
  var plaat = null;

  function maatPlaatje() {
    var h = Math.min(window.innerHeight * 0.3, 240), w = h * (520 / 628);
    var maxS = Math.min(MAXSCHAAL, 0.9 * window.innerWidth / w, 0.85 * window.innerHeight / h);
    return { h: h, w: w, maxS: Math.max(1, maxS) };
  }

  function beginPlaatje() {
    plaat = { hold: false, el: null, ty: 100, scale: 1 };
    plaat.timer = setTimeout(startHold, TAP_MAX);
  }

  function startHold() {
    if (!plaat) return;
    var m = maatPlaatje();
    var img = document.createElement('img');
    img.src = PLAATJE; img.alt = '';
    img.className = 'vlieger houd';
    img.style.height = m.h + 'px';
    var halfMax = m.w * m.maxS / 2 + 14;
    var x = window.innerWidth / 2;
    if (window.innerWidth - 2 * halfMax > 0) x = halfMax + Math.random() * (window.innerWidth - 2 * halfMax);
    img.style.left = x + 'px';
    img.style.transform = 'translate(-50%, 100%)';
    document.body.appendChild(img);
    plaat.hold = true; plaat.el = img; plaat.m = m; plaat.tHold = performance.now();
    document.body.classList.add('regenboog');
    requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!plaat || !plaat.hold) return;
    var t = (now - plaat.tHold) / 1000, m = plaat.m;
    var instap = Math.max(0, Math.min(1, t / 0.25));
    var ty = Math.pow(1 - instap, 3) * 100;                       // komt van onder in beeld
    var p = Math.max(0, Math.min(1, (t - 0.25) / GROEI));        // groeivoortgang
    var sc = 1 + (m.maxS - 1) * p;
    var dx = 0, dy = 0, r = 0;
    if (p >= 1 && !minder) {                                      // limiet bereikt: trillen en schudden
      dx = Math.sin(t * 47) * 8 + Math.sin(t * 31) * 4;
      dy = Math.sin(t * 53) * 6;
      r = Math.sin(t * 41) * 4;
    }
    plaat.ty = ty; plaat.scale = sc;
    plaat.el.style.transform = 'translate(-50%, ' + ty + '%) translate(' + dx + 'px, ' + dy + 'px) rotate(' + r + 'deg) scale(' + sc + ')';
    requestAnimationFrame(frame);
  }

  function eindPlaatje() {
    if (!plaat) return;
    var pl = plaat; plaat = null;
    clearTimeout(pl.timer);
    document.body.classList.remove('regenboog');
    if (!pl.hold) { schietPlaatje(); return; }
    var img = pl.el;
    var van = 'translate(-50%, ' + pl.ty + '%) scale(' + pl.scale + ')';
    var naar = 'translate(-50%, 115%) scale(' + pl.scale + ')';
    var a = img.animate([{ transform: van, easing: 'cubic-bezier(.5,0,.9,.5)' }, { transform: naar }],
                        { duration: 450, fill: 'forwards' });
    a.onfinish = function () { img.remove(); };
  }

  function plan(s, when) {
    // één korreltje: een klein stukje uit het uitrekgebied met zachte in- en uitfade
    var pos = s.S + Math.random() * Math.max(0, s.E - s.S - s.G);
    var src = ctx.createBufferSource();
    var g = ctx.createGain();
    src.buffer = buffer;
    g.gain.value = 0;
    g.gain.setValueCurveAtTime(HANN, when, s.G);
    src.connect(g); g.connect(s.bus);
    src.start(when, pos, s.G + 0.02);
    src.onended = function () { try { g.disconnect(); } catch (_) {} };
    s.grains.push(src);
    s.lastPos = pos + s.G * 0.5;
  }

  function tick() {
    if (!spel) return;
    var s = spel, now = ctx.currentTime;
    if (!s.cloud && now >= s.tc - LA) {
      s.cloud = true;
      s.bus = ctx.createGain();
      s.bus.connect(ctx.destination);
      s.next = s.tc;
      // origineel wegfaden terwijl de korrelwolk opbouwt
      s.ga.gain.cancelScheduledValues(now);
      s.ga.gain.setValueAtTime(1, s.tc);
      s.ga.gain.linearRampToValueAtTime(0, s.tc + 0.75 * s.G);
    }
    if (s.cloud) {
      while (s.next < now + LA) { plan(s, s.next); s.next += s.H; }
    }
  }

  function omlaag(e) {
    if (spel || !buffer) return;
    if (e) { try { knop.setPointerCapture(e.pointerId); } catch (_) {} }
    var c = audio();
    var a = c.createBufferSource(), ga = c.createGain();
    a.buffer = buffer;
    a.connect(ga); ga.connect(c.destination);
    var start = c.currentTime + 0.005;
    a.start(start);

    var E = effectiefEinde();
    var gebiedLengte = Math.min(UITREKGEBIED, E * 0.6);
    var G = Math.min(0.3, gebiedLengte * 0.6);
    spel = {
      a: a, ga: ga, start: start, cloud: false, grains: [], lastPos: 0,
      E: E, S: E - gebiedLengte, G: G, H: G / 4,
      tc: start + Math.max(0.01, E - gebiedLengte - 0.75 * G)
    };
    spel.timer = setInterval(tick, 25);

    knop.classList.add('actief');
    beginPlaatje();
  }

  function omhoog() {
    if (!spel) return;
    var s = spel, now = ctx.currentTime;
    clearInterval(s.timer);
    eindPlaatje();
    knop.classList.remove('actief');

    if (s.cloud && now < s.tc) {
      // los gelaten voordat het uitrekken begon: wolk annuleren, origineel speelt gewoon uit
      s.bus.gain.setValueAtTime(0, now);
      s.grains.forEach(function (g) { try { g.stop(); } catch (_) {} });
      s.ga.gain.cancelScheduledValues(now);
      s.ga.gain.setValueAtTime(1, now);
    } else if (s.cloud) {
      // los gelaten tijdens het uitrekken: wolk wegfaden en het echte einde van het geluid laten horen
      var r = ctx.createBufferSource(), rg = ctx.createGain();
      r.buffer = buffer;
      r.connect(rg); rg.connect(ctx.destination);
      rg.gain.setValueAtTime(0.0001, now);
      rg.gain.linearRampToValueAtTime(1, now + 0.07);
      var p = Math.min(buffer.duration - 0.05, Math.max(s.lastPos, buffer.duration - 0.6));
      r.start(now, Math.max(0, p));
      s.bus.gain.setValueAtTime(1, now);
      s.bus.gain.linearRampToValueAtTime(0, now + 0.07);
      setTimeout(function () {
        s.grains.forEach(function (g) { try { g.stop(); } catch (_) {} });
        try { s.bus.disconnect(); } catch (_) {}
        try { s.a.stop(); } catch (_) {}
      }, 150);
    }
    spel = null;
  }

  knop.addEventListener('pointerdown', function (e) { e.preventDefault(); omlaag(e); });
  knop.addEventListener('pointerup', omhoog);
  knop.addEventListener('pointercancel', omhoog);
  knop.addEventListener('lostpointercapture', omhoog);
  knop.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  knop.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); omlaag(); }
  });
  knop.addEventListener('keyup', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); omhoog(); }
  });
  knop.addEventListener('blur', omhoog);
})();
