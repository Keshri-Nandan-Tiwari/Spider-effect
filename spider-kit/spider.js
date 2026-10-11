/*!
 * SPIDER WALKER  —  drop-in, zero-dependency
 * ---------------------------------------------------------------------------
 * A canvas spider that follows the cursor (or roams), lights the page, drags a
 * silk trail, and makes nearby words flip / glitch / scramble. Comes with a
 * settings button (spider icon, bottom-right) for visitors to tune or switch off
 * everything, 5 quick looks, 14 vision filters and 5 colour palettes.
 *
 * USAGE (any site, any framework)
 *   import mountSpider from "./spider.js";
 *   const spider = mountSpider();            // that's it
 *
 *   // plain HTML:
 *   <script type="module">import mountSpider from "./spider.js"; mountSpider();</script>
 *
 * OPTIONS  mountSpider({ ... })
 *   panel         true   show the spider settings button + panel
 *   defaults      {}     override any default, e.g. { palette: "cyan", size: 80 }
 *   storageKey    "spider-walker"   localStorage key for the visitor's choices
 *   persist       true   remember the visitor's choices
 *   textSelector  "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption"   text Text-FX may touch
 *
 * RETURNS  { update(patch), get(), reset(), preset(id), open(), close(), destroy() }
 *
 * TIPS
 *   - Add  data-spider-ignore  to any element the spider must never touch.
 *   - Colours follow your site's  --highlight  CSS variable when palette is "theme".
 *   - Layers: filter overlay z-index 149, spider canvas 150, settings dock 210.
 * ---------------------------------------------------------------------------
 */

/* ======================================================================
 *  1. CONFIG — defaults, presets, vision filters, panel layout
 * ==================================================================== */
// Single source of truth for the spider: defaults, presets, vision filters and
// the settings-panel layout. The engine, the store and the panel all read this.

const DEFAULT_SETTINGS = {
  enabled: true,
  // spider
  palette: "theme", // theme | cyan | green | magma | rainbow
  steer: "follow", // follow | roam
  chaos: 50, // 0–100
  size: 60, // 30–160 %
  speed: 50, // 25–150 %
  frenzy: 50, // leg speed 25–160 %
  // touch & click
  pounce: true,
  sparks: true,
  // looks
  lights: 0, // 0–100 spotlight darkness
  textFx: true,
  silkLines: true,
  trail: true,
  web: false,
  aura: true,
  filter: "none", // see FILTERS
  scope: "lens", // lens | page
};

// Vision filters are drawn by a click-through overlay (backdrop-filter plus a
// little CSS animation), so they never change your layout or break
// position:fixed elements. `swatch` is only used for the picker preview.
const FILTERS = {
  none: { label: "Off", swatch: "linear-gradient(135deg,#1b1d24 46%,#3a3e4a 50%,#1b1d24 54%)" },
  night: {
    label: "Night vision", swatch: "linear-gradient(135deg,#031a09,#2dff7a)",
    css: "grayscale(1) sepia(1) hue-rotate(50deg) saturate(4) brightness(1.15) contrast(1.2)", tint: "rgba(0,255,100,0.06)", scan: true,
  },
  heat: {
    label: "Heat", swatch: "linear-gradient(135deg,#2b0a6b,#ff2a00 55%,#ffe23a)",
    css: "grayscale(1) contrast(1.5) sepia(1) saturate(6) hue-rotate(-25deg)", tint: "rgba(255,60,0,0.05)",
  },
  neon: { label: "Neon", swatch: "linear-gradient(135deg,#00e5ff,#ff2bd6)", css: "saturate(2.4) contrast(1.3) brightness(1.1)" },
  cyber: {
    label: "Cyber", swatch: "linear-gradient(135deg,#ff00aa,#00e6ff)",
    css: "saturate(2.4) contrast(1.35) hue-rotate(-18deg) brightness(1.05)",
    tint: "linear-gradient(120deg, rgba(255,0,170,0.16), rgba(0,230,255,0.16))",
  },
  vapor: {
    label: "Vapor", swatch: "linear-gradient(135deg,#ff71ce,#b967ff 50%,#05ffa1)",
    css: "hue-rotate(250deg) saturate(2.2) contrast(1.15) brightness(1.1)",
    tint: "linear-gradient(160deg, rgba(255,80,200,0.16), rgba(80,120,255,0.16))",
  },
  acid: {
    label: "Acid", swatch: "conic-gradient(#ff3b3b,#ffd23b,#3bff6a,#3bd5ff,#a03bff,#ff3b3b)",
    css: "hue-rotate(0deg) saturate(2.6) contrast(1.2)", // animated: the hue spins forever
  },
  glitch: {
    label: "Glitch", swatch: "repeating-linear-gradient(0deg,#00fff0 0 3px,#14151b 3px 7px,#ff0a6e 7px 9px,#14151b 9px 14px)",
    css: "contrast(1.25) saturate(1.9)",
  },
  matrix: {
    label: "Matrix", swatch: "repeating-linear-gradient(90deg,#00ff55 0 1px,#001a08 1px 5px)",
    css: "grayscale(1) sepia(1) hue-rotate(60deg) saturate(5) brightness(0.9) contrast(1.45)", tint: "rgba(0,255,70,0.05)",
  },
  vhs: {
    label: "VHS", swatch: "linear-gradient(135deg,#3a2bff,#ff4d8d)",
    css: "contrast(1.2) saturate(1.7) blur(0.5px) brightness(1.05)", tint: "rgba(80,60,255,0.07)", scan: true,
  },
  blood: {
    label: "Blood moon", swatch: "radial-gradient(circle at 50% 45%,#ff3b1f,#4a0000)",
    css: "sepia(1) saturate(5) hue-rotate(-50deg) contrast(1.2) brightness(0.85)",
    tint: "radial-gradient(ellipse at center, rgba(255,40,0,0.05), rgba(90,0,0,0.38))",
  },
  noir: { label: "Noir", swatch: "linear-gradient(135deg,#0b0b0b,#e8e8e8)", css: "grayscale(1) contrast(1.4) brightness(0.95)" },
  xray: { label: "X-ray", swatch: "linear-gradient(135deg,#dff6ff,#0a2a3a)", css: "invert(1) grayscale(1) contrast(1.25) brightness(1.05)" },
  invert: { label: "Invert", swatch: "linear-gradient(135deg,#ffe600,#2a00ff)", css: "invert(1) hue-rotate(180deg)" },
};

// One-tap looks. Each starts from the defaults, so it fully replaces the
// current mix (the spider itself stays on).
const PRESETS = [
  { id: "default", label: "Default", hint: "Fresh start", swatch: "linear-gradient(135deg,#3a3e4a,#8a90a0)", values: {} },
  {
    id: "calm", label: "Calm", hint: "Slow & gentle", swatch: "linear-gradient(135deg,#38d6ff,#4ade80)",
    values: { chaos: 20, speed: 40, frenzy: 40, sparks: false, silkLines: false },
  },
  {
    id: "crazy", label: "Crazy", hint: "Everything up", swatch: "conic-gradient(#ff3b3b,#ffd23b,#3bff6a,#3bd5ff,#a03bff,#ff3b3b)",
    values: { palette: "rainbow", chaos: 100, size: 100, speed: 130, frenzy: 140, lights: 35, web: true, filter: "acid", scope: "lens" },
  },
  {
    id: "cyber", label: "Cyber", hint: "Neon city", swatch: "linear-gradient(135deg,#ff00aa,#00e6ff)",
    values: { palette: "cyan", chaos: 70, size: 80, speed: 100, frenzy: 100, lights: 30, web: true, filter: "cyber", scope: "lens" },
  },
  {
    id: "horror", label: "Horror", hint: "Lights out", swatch: "radial-gradient(circle at 50% 45%,#ff3b1f,#2a0000)",
    values: { palette: "magma", chaos: 70, size: 90, speed: 70, frenzy: 70, lights: 80, sparks: false, filter: "blood", scope: "lens" },
  },
  {
    id: "stealth", label: "Stealth", hint: "Just the spider", swatch: "linear-gradient(135deg,#0b0b0b,#2a2d36)",
    values: { chaos: 0, textFx: false, silkLines: false, trail: false, aura: false, sparks: false },
  },
];

// Which preset (if any) matches the current settings exactly.
function activePreset(s) {
  for (const p of PRESETS) {
    const full = { ...DEFAULT_SETTINGS, ...p.values };
    if (Object.keys(full).every((k) => k === "enabled" || s[k] === full[k])) return p.id;
  }
  return null;
}

const PALETTE_OPTIONS = [
  { id: "theme", label: "Match theme", bg: "conic-gradient(var(--highlight), var(--surface-2), var(--highlight))" },
  { id: "cyan", label: "Cyan", bg: "linear-gradient(135deg,#38d6ff 50%,#ff4f8b 50%)" },
  { id: "green", label: "Toxic green", bg: "linear-gradient(135deg,#4ade80 50%,#ff8a3d 50%)" },
  { id: "magma", label: "Magma", bg: "linear-gradient(135deg,#ff8c28 50%,#ff3c5a 50%)" },
  { id: "rainbow", label: "Rainbow", bg: "conic-gradient(#ff4f4f,#ffd24f,#4fff7a,#4fd2ff,#a04fff,#ff4f4f)" },
];

// Panel layout. t = control type.
const TABS = [
  {
    id: "spider", label: "Spider",
    controls: [
      { t: "label", text: "Quick looks" },
      { t: "presets" },
      { t: "label", text: "Colour" },
      { t: "palette" },
      { t: "label", text: "Movement" },
      { t: "seg", key: "steer", options: [["follow", "Follow me"], ["roam", "Roam free"]] },
      { t: "slider", key: "chaos", label: "Chaos", min: 0, max: 100, unit: "%" },
      { t: "slider", key: "size", label: "Size", min: 30, max: 160, unit: "%" },
      { t: "slider", key: "speed", label: "Speed", min: 25, max: 150, unit: "%" },
      { t: "slider", key: "frenzy", label: "Leg frenzy", min: 25, max: 160, unit: "%" },
    ],
  },
  {
    id: "touch", label: "Touch",
    controls: [
      { t: "note", text: "What happens when you click or tap. Switch off whatever you don't like." },
      { t: "toggle", key: "pounce", label: "Pounce on click", hint: "Spider jumps to where you tap" },
      { t: "toggle", key: "sparks", label: "Sparks", hint: "Spark trail while it runs" },
    ],
  },
  {
    id: "looks", label: "Looks",
    controls: [
      { t: "slider", key: "lights", label: "Lights (darkness)", min: 0, max: 100, unit: "%" },
      { t: "label", text: "Vision filter" },
      { t: "filters", key: "filter" },
      { t: "seg", key: "scope", options: [["lens", "Spider lens"], ["page", "Whole page"]] },
      { t: "label", text: "Effects" },
      { t: "toggle", key: "textFx", label: "Text FX", hint: "Words near it flip, glitch & scramble" },
      { t: "toggle", key: "silkLines", label: "Silk to words", hint: "Threads to the words it affects" },
      { t: "toggle", key: "trail", label: "Silk trail" },
      { t: "toggle", key: "web", label: "Web particles" },
      { t: "toggle", key: "aura", label: "Glow aura" },
    ],
  },
];

/* ======================================================================
 *  2. ENGINE — spider, legs, silk, lights, text effects, vision filters
 * ==================================================================== */


// Spider Walker engine — a canvas spider that follows the cursor, drags silk
// behind it, spotlights the page, and makes nearby words react.
// Framework-free on purpose: SpiderWalker.jsx just mounts it and feeds it settings.

const TAU = Math.PI * 2;

// Only static copy is touched — never the animated loops, the 3D carousel,
// the shattering title or anything React re-renders on its own.
const TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption";
const IGNORE = "[data-spider-ignore],.spd-ui,.spd-filter,.coverflow,.nofx,script,style,textarea,input,select,button,svg,canvas";
const MAX_WORDS = 1500; // safety cap so very long pages stay smooth

const PALETTES = {
  cyan: { sp: [56, 214, 255], sd: [255, 79, 139], alt: [138, 255, 193] },
  green: { sp: [74, 222, 128], sd: [255, 138, 61], alt: [90, 169, 255] },
  magma: { sp: [255, 140, 40], sd: [255, 60, 90], alt: [255, 214, 90] },
};

function css(c, a) {
  return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a === undefined ? 1 : a) + ")";
}
function hsl2rgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
function rgb2hsl(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function parseColor(str) {
  str = (str || "").trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(str);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
// Colours that follow the site's own accent, so the spider matches whichever
// theme swatch is picked.
function themePalette() {
  const c = parseColor(getComputedStyle(document.documentElement).getPropertyValue("--highlight")) || [255, 51, 85];
  const hsl = rgb2hsl(c);
  if (hsl[1] < 0.12) return { sp: [236, 236, 242], sd: [120, 200, 255], alt: [190, 190, 205] };
  return { sp: c, sd: hsl2rgb(hsl[0] + 170, Math.max(hsl[1], 0.8), 0.62), alt: hsl2rgb(hsl[0] + 55, 0.95, 0.62) };
}

const FX = {
  box: { cls: "spd-fx-box", s: 1.1 },
  big: { cls: "spd-fx-big", s: 1.9, big: 1 },
  mag: { cls: "spd-fx-box spd-fx-big", s: 2.6, big: 1 },
  slant: { cls: "spd-fx-slant", r: -24, s: 1.3, big: 1 },
  flip: { cls: "spd-fx-flip", sx: -1, s: 1.05 },
  flipv: { cls: "spd-fx-flipv", sy: -1, s: 1.05 },
  pink: { cls: "spd-fx-pink", s: 1.12 },
  alt: { cls: "spd-fx-alt", s: 1.12 },
  glitch: { cls: "spd-fx-glitch" },
  ghost: { cls: "spd-fx-ghost" },
  float: { cls: "spd-fx-float", ty: -16, s: 1.2 },
  scramble: { cls: "spd-fx-scr" },
  spin: { cls: "spd-fx-box", r: 360, s: 1.2 },
};
const FXLIST = ["box", "box", "big", "mag", "slant", "flip", "flipv", "pink", "pink", "alt", "glitch", "glitch", "ghost", "float", "float", "scramble", "scramble", "spin"];
const CH = "01#@$%&*+=?<>/|";

function createSpiderEngine(canvas, initial, opts) {
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let S = Object.assign({}, DEFAULT_SETTINGS, initial);

  let running = false, raf = 0, W = 0, H = 0, dpr = 1, scale = 1;
  let pal = PALETTES.cyan, lastRb = 0;

  /* ---------- colour ---------- */
  function applyVars() {
    root.style.setProperty("--spd-sp", css(pal.sp));
    root.style.setProperty("--spd-sd", css(pal.sd));
    root.style.setProperty("--spd-alt", css(pal.alt));
    root.style.setProperty("--spd-glow", css(pal.sp, 0.55));
  }
  function setPalette() {
    if (S.palette === "theme") pal = themePalette();
    else if (PALETTES[S.palette]) pal = PALETTES[S.palette];
    applyVars();
  }
  const themeObserver = new MutationObserver(() => { if (S.palette === "theme") setPalette(); });
  themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- words ---------- */
  let words = [], wrapped = [], bigN = 0, measureTimer = 0;
  function newWord(el, text) {
    return { el: el, orig: text, cx: 0, cy: 0, fx: null, fd: null, fr: 0, last: 0, hold: 0, start: 0, act: false, wd: 0, jx: 0, jy: 0,
      tx: 0, ty: 0, r: 0, s: 1, sx: 1, sy: 1, vtx: 0, vty: 0, vr: 0, vs: 0, vsx: 0, vsy: 0 };
  }
  function wrapWords() {
    if (words.length) return;
    document.querySelectorAll((opts && opts.textSelector) || TEXT_SELECTOR).forEach((host) => {
      if (words.length >= MAX_WORDS) return;
      if (host.closest(IGNORE)) return;
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
      const texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      texts.forEach((t) => {
        if (!t.nodeValue.trim()) return;
        const p = t.parentNode;
        if (!p || (p.closest && p.closest(IGNORE)) || (p.classList && p.classList.contains("spd-w"))) return;
        const frag = document.createDocumentFragment(), made = [];
        t.nodeValue.split(/(\s+)/).forEach((s) => {
          if (!s) return;
          if (/^\s+$/.test(s)) { const tn = document.createTextNode(s); frag.appendChild(tn); made.push(tn); return; }
          const sp = document.createElement("span");
          sp.className = "spd-w"; sp.textContent = s;
          frag.appendChild(sp); made.push(sp);
          words.push(newWord(sp, s));
        });
        p.insertBefore(frag, t);
        p.removeChild(t);
        wrapped.push({ orig: t, parent: p, nodes: made });
      });
    });
    measure();
    measureTimer = setInterval(measure, 300);
  }
  // Puts every text node back exactly as React rendered it.
  function unwrapWords() {
    clearInterval(measureTimer);
    wrapped.forEach((rec) => {
      const first = rec.nodes[0];
      if (first && first.parentNode === rec.parent) rec.parent.insertBefore(rec.orig, first);
      rec.nodes.forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n); });
    });
    words = []; wrapped = []; bigN = 0;
  }
  function setCls(w) { w.el.className = "spd-w" + (w.act ? " spd-act" : "") + (w.fd ? " " + w.fd.cls : ""); }
  function clearFx(w) {
    if (w.fd && w.fd.big) bigN--;
    if (w.fx === "scramble") { w.el.textContent = w.orig; w.el.style.width = ""; }
    w.fx = null; w.fd = null; w.jx = 0; w.jy = 0; w.fr = 0;
    setCls(w);
  }
  function resetWord(w) {
    if (w.fx) clearFx(w);
    w.act = false; w.tx = w.ty = w.r = 0; w.s = w.sx = w.sy = 1;
    w.vtx = w.vty = w.vr = w.vs = w.vsx = w.vsy = 0;
    w.el.style.transform = ""; w.el.className = "spd-w";
  }
  function assignFx(w, now) {
    let name = FXLIST[(Math.random() * FXLIST.length) | 0];
    if (FX[name].big && bigN >= 5) name = "box";
    const fd = FX[name];
    w.fx = name; w.fd = fd; w.hold = 700 + Math.random() * 1100; w.start = now;
    w.fr = name === "float" ? (Math.random() - 0.5) * 24 : 0;
    if (fd.big) bigN++;
    if (name === "scramble") { w.wd = w.el.offsetWidth; w.el.style.width = w.wd + "px"; }
    w.act = true; setCls(w);
  }
  function clearAll() { words.forEach((w) => { if (w.act || w.fx) resetWord(w); }); bigN = 0; }
  // Words are measured at their un-transformed centre, so animated cards and
  // scrolling never leave the physics working from stale positions.
  function measure() {
    const sx = window.scrollX || 0, sy = window.scrollY || 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i], r = w.el.getBoundingClientRect();
      w.cx = r.left + r.width / 2 + sx - w.tx;
      w.cy = r.top + r.height / 2 + sy - w.ty;
    }
  }

  /* ---------- canvas ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    applyScale();
    initWeb();
    if (words.length) measure();
  }
  function applyScale() { scale = Math.max(0.78, Math.min(1.15, W / 900)) * (S.size / 100); }

  /* ---------- web particles ---------- */
  let bp = [];
  function initWeb() {
    const n = Math.max(24, Math.min(64, Math.round((W * H) / 18000)));
    while (bp.length < n) bp.push({ x: Math.random() * W, y: Math.random() * H, bx: (Math.random() - 0.5) * 30, by: (Math.random() - 0.5) * 30, ex: 0, ey: 0 });
    bp.length = n;
  }

  /* ---------- spider ---------- */
  const body = { x: 0, y: 0, h: -0.6, vx: 0, vy: 0 };
  const target = { x: 0, y: 0 };
  let lastInput = performance.now() - 5000, roaming = true;
  let gaitPhase = 0;
  let pFlag = false, pTime = 0, bump = 0, abd = 0, prevH = body.h;
  const L1 = 46, L2 = 58;
  const angs = [38, 68, 104, 142], reach = [88, 94, 92, 86], hipX = [15, 7, -2, -11];
  const legs = [];
  let sparks = [], trail = [], silk = [];
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 4; i++) {
      legs.push({ side: k === 0 ? -1 : 1, a: (angs[i] * Math.PI) / 180, R: reach[i], hx: hipX[i], group: (i + k) % 2,
        fx: 0, fy: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 1, dur: 0.14, lift: 0, half: -1 });
    }
  }
  function toWorld(lx, ly) {
    const c = Math.cos(body.h), s = Math.sin(body.h);
    return { x: body.x + lx * scale * c - ly * scale * s, y: body.y + lx * scale * s + ly * scale * c };
  }
  function ideal(leg) { return toWorld(Math.cos(leg.a) * leg.R, leg.side * Math.sin(leg.a) * leg.R); }
  function snapFeet() { legs.forEach((leg) => { const p = ideal(leg); leg.fx = p.x; leg.fy = p.y; leg.t = 1; }); }

  const chaosV = () => S.chaos / 100;

  /* ---------- shockwave / pounce ---------- */
  function shock(x, y, power, radius) {
    const R = radius * scale * (0.7 + chaosV() * 0.6);
    let j, d, k2, dx, dy;
    if (S.web) {
      for (j = 0; j < bp.length; j++) {
        dx = bp[j].x - x; dy = bp[j].y - y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        if (d < R * 1.3) { k2 = 1 - d / (R * 1.3); bp[j].ex += (dx / d) * k2 * power * 0.5; bp[j].ey += (dy / d) * k2 * power * 0.5; }
      }
    }
    if (!S.textFx) return;
    const sxd = x + (window.scrollX || 0), syd = y + (window.scrollY || 0);
    for (j = 0; j < words.length; j++) {
      const w = words[j];
      dx = w.cx - sxd; dy = w.cy - syd;
      if (dy > R || dy < -R) continue;
      d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      if (d < R) {
        k2 = 1 - d / R;
        w.vtx += (dx / d) * k2 * power * (0.8 + Math.random() * 0.4);
        w.vty += (dy / d) * k2 * power * (0.8 + Math.random() * 0.4);
        w.vr += (Math.random() - 0.5) * k2 * power * 1.1;
        if (!w.act) { w.act = true; setCls(w); }
      }
    }
  }
  function startPounce() {
    if (pFlag || !S.pounce) return;
    pFlag = true; pTime = 0.55;
    shock(body.x, body.y, 450 * (0.5 + chaosV()), 150);
  }

  /* ---------- input ---------- */
  const inUI = (e) => !!(e.target && e.target.closest && e.target.closest(".spd-ui,input,textarea,select"));
  function setTarget(x, y) { target.x = x; target.y = y; lastInput = performance.now(); roaming = false; }
  const onMove = (e) => { if (e.pointerType === "touch") return; setTarget(e.clientX, e.clientY); };
  const onDown = (e) => {
    if (e.pointerType === "touch" || inUI(e)) return;
    setTarget(e.clientX, e.clientY); startPounce();
  };
  const onTouch = (pounce) => (e) => {
    if (inUI(e)) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    setTarget(t.clientX, t.clientY);
    if (pounce) startPounce();
  };
  const onTouchStart = onTouch(true), onTouchMove = onTouch(false);

  /* ---------- drawing ---------- */
  function twoBone(hx, hy, fx, fy, side, lift) {
    let dx = fx - hx, dy = fy - hy, d = Math.sqrt(dx * dx + dy * dy);
    const l1 = L1 * scale, l2 = L2 * scale, max = (l1 + l2) * 0.995;
    if (d > max) { fx = hx + (dx / d) * max; fy = hy + (dy / d) * max; dx = fx - hx; dy = fy - hy; d = max; }
    if (d < 4) d = 4;
    const a = (d * d + l1 * l1 - l2 * l2) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a)) * (1 + 0.6 * lift);
    const ux = dx / d, uy = dy / d;
    let px = -uy, py = ux;
    const lx = -Math.sin(body.h), ly = Math.cos(body.h);
    if ((px * lx + py * ly) * side < 0) { px = -px; py = -py; }
    return { hx: hx, hy: hy, kx: hx + ux * a + px * h, ky: hy + uy * a + py * h, fx: fx, fy: fy };
  }

  function drawSpider(t) {
    const c = pal.sp, d = pal.sd, sc = scale;
    let n, leg, hip, ik;
    const iks = [];
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    for (n = 0; n < legs.length; n++) {
      leg = legs[n]; hip = toWorld(leg.hx, leg.side * 6);
      iks.push(twoBone(hip.x, hip.y, leg.fx, leg.fy, leg.side, leg.lift));
    }
    ctx.shadowColor = css(c, 1); ctx.shadowBlur = 12; ctx.strokeStyle = css(c, 1);
    for (n = 0; n < iks.length; n++) {
      ik = iks[n];
      ctx.lineWidth = 3.2 * sc; ctx.beginPath(); ctx.moveTo(ik.hx, ik.hy); ctx.lineTo(ik.kx, ik.ky); ctx.stroke();
      ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(ik.kx, ik.ky); ctx.lineTo(ik.fx, ik.fy); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // fine hairs along each segment
    ctx.strokeStyle = css(c, 0.55); ctx.lineWidth = 1; ctx.beginPath();
    const fr = [0.35, 0.6, 0.85];
    for (n = 0; n < iks.length; n++) {
      ik = iks[n];
      for (let q = 0; q < 2; q++) {
        const ax = q === 0 ? ik.hx : ik.kx, ay = q === 0 ? ik.hy : ik.ky;
        const bx = q === 0 ? ik.kx : ik.fx, by = q === 0 ? ik.ky : ik.fy;
        const sl = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) + 0.01;
        const nx = -(by - ay) / sl, ny = (bx - ax) / sl;
        for (let f = 0; f < 3; f++) {
          const px2 = ax + (bx - ax) * fr[f], py2 = ay + (by - ay) * fr[f];
          ctx.moveTo(px2, py2); ctx.lineTo(px2 + nx * 4 * sc, py2 + ny * 4 * sc);
        }
      }
    }
    ctx.stroke();

    ctx.fillStyle = css(d, 1);
    for (n = 0; n < iks.length; n++) {
      ik = iks[n];
      ctx.beginPath(); ctx.arc(ik.kx, ik.ky, 2.8 * sc, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(ik.fx, ik.fy, (3.2 + legs[n].lift * 1.8) * sc, 0, TAU); ctx.fill();
    }

    // body
    const bs = sc * (1 + 0.28 * bump + 0.025 * Math.sin(t * 4));
    ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.h); ctx.scale(bs, bs);
    const pulse = 0.5 + 0.4 * Math.sin(t * 3.2);
    let g;

    ctx.save(); ctx.translate(-9, 0); ctx.rotate(abd);
    g = ctx.createRadialGradient(-14, -7, 2, -18, 0, 30);
    g.addColorStop(0, css(c, 0.55)); g.addColorStop(0.4, "#0b1828"); g.addColorStop(1, "#040810");
    ctx.shadowColor = css(c, 1); ctx.shadowBlur = 16; ctx.fillStyle = g; ctx.strokeStyle = css(c, 1); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(-18, 0, 26, 19, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = css(d, 0.3 + 0.5 * pulse); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-42, 0); ctx.lineTo(-8, 0);
    ctx.moveTo(-36, -8); ctx.lineTo(-27, 0); ctx.lineTo(-36, 8);
    ctx.moveTo(-26, -11); ctx.lineTo(-17, 0); ctx.lineTo(-26, 11); ctx.stroke();
    ctx.fillStyle = css(d, 0.25 + 0.55 * pulse);
    ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(-14, 0); ctx.lineTo(-24, 6); ctx.lineTo(-30, 0); ctx.closePath(); ctx.fill();
    ctx.restore();

    g = ctx.createRadialGradient(2, -5, 1, 5, 0, 18);
    g.addColorStop(0, css(c, 0.6)); g.addColorStop(0.45, "#0d1c2e"); g.addColorStop(1, "#050a14");
    ctx.shadowColor = css(c, 1); ctx.shadowBlur = 12; ctx.fillStyle = g; ctx.strokeStyle = css(c, 1); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(5, 0, 16, 12.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    const wig = Math.sin(t * 7) * 2.2;
    ctx.strokeStyle = css(c, 1); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(17, -4); ctx.lineTo(26, -8 + wig); ctx.lineTo(31, -5 + wig);
    ctx.moveTo(17, 4); ctx.lineTo(26, 8 - wig); ctx.lineTo(31, 5 - wig); ctx.stroke();
    ctx.strokeStyle = css(d, 1); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(19, -2); ctx.quadraticCurveTo(25, -3, 26, 1);
    ctx.moveTo(19, 2); ctx.quadraticCurveTo(25, 3, 26, -1); ctx.stroke();
    ctx.shadowColor = css(d, 1); ctx.shadowBlur = 8; ctx.fillStyle = css(d, 1);
    ctx.beginPath();
    const ey = [-5, -1.7, 1.7, 5];
    for (let e = 0; e < 4; e++) { ctx.moveTo(14.5, ey[e]); ctx.arc(13, ey[e], 1.6, 0, TAU); }
    ctx.moveTo(11, -5.6); ctx.arc(9.6, -5.6, 1.3, 0, TAU);
    ctx.moveTo(11, 5.6); ctx.arc(9.6, 5.6, 1.3, 0, TAU);
    ctx.moveTo(6.5, -4); ctx.arc(5.2, -4, 1.1, 0, TAU);
    ctx.moveTo(6.5, 4); ctx.arc(5.2, 4, 1.1, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ---------- word physics ---------- */
  const K = 170, D = 13;
  function updateWords(dt, scX, scY) {
    const chaos = chaosV();
    const rad = (60 + 120 * chaos) * scale, rad2 = rad * rad, push = (24 + 80 * chaos) * scale;
    const sxd = body.x + scX, syd = body.y + scY, h = Math.min(dt, 0.033);
    for (let j = 0; j < words.length; j++) {
      const w = words[j], dx = w.cx - sxd, dy = w.cy - syd;
      let rx = 0, ry = 0, rr = 0, inr = false;
      if (S.textFx && dy < rad && dy > -rad) {
        const d2 = dx * dx + dy * dy;
        if (d2 < rad2) {
          const d = Math.sqrt(d2) + 0.01;
          let kk = 1 - d / rad; kk *= kk;
          rx = (dx / d) * kk * push; ry = (dy / d) * kk * push; rr = (dx > 0 ? 1 : -1) * kk * 22 * chaos; inr = true;
        }
      }
      if (!w.act) {
        if (!inr && !w.fx) continue;
        w.act = true; setCls(w);
      }
      const fd = w.fd;
      const ttx = rx + w.jx, tty = ry + w.jy + (fd && fd.ty ? fd.ty : 0);
      const tr = rr + (fd ? (fd.r || 0) + w.fr : 0);
      const ts = fd && fd.s ? fd.s : 1, tsx = fd && fd.sx ? fd.sx : 1, tsy = fd && fd.sy ? fd.sy : 1;
      w.vtx += ((ttx - w.tx) * K - w.vtx * D) * h; w.tx += w.vtx * h;
      w.vty += ((tty - w.ty) * K - w.vty * D) * h; w.ty += w.vty * h;
      w.vr += ((tr - w.r) * K - w.vr * D) * h; w.r += w.vr * h;
      w.vs += ((ts - w.s) * K - w.vs * D) * h; w.s += w.vs * h;
      w.vsx += ((tsx - w.sx) * K - w.vsx * D) * h; w.sx += w.vsx * h;
      w.vsy += ((tsy - w.sy) * K - w.vsy * D) * h; w.sy += w.vsy * h;

      const rest = !w.fx && !inr && Math.abs(w.tx) + Math.abs(w.ty) + Math.abs(w.r) < 0.2 &&
        Math.abs(w.s - 1) < 0.01 && Math.abs(w.sx - 1) < 0.01 && Math.abs(w.sy - 1) < 0.01 &&
        Math.abs(w.vtx) + Math.abs(w.vty) + Math.abs(w.vr) < 0.4;
      if (rest) { resetWord(w); continue; }
      w.el.style.transform = "translate(" + w.tx.toFixed(1) + "px," + w.ty.toFixed(1) + "px) rotate(" + w.r.toFixed(1) +
        "deg) scale(" + (w.s * w.sx).toFixed(3) + "," + (w.s * w.sy).toFixed(3) + ")";
    }
  }
  function effectTick(now, scX, scY) {
    silk = [];
    if (!S.textFx) return;
    const chaos = chaosV();
    const rad = (60 + 120 * chaos) * scale, rad2 = rad * rad, prob = 0.05 + 0.4 * chaos;
    const sxd = body.x + scX, syd = body.y + scY;
    for (let j = 0; j < words.length; j++) {
      const w = words[j], dx = w.cx - sxd, dy = w.cy - syd, d2 = dx * dx + dy * dy;
      if (d2 < rad2) {
        w.last = now;
        if (!w.fx && Math.random() < prob) assignFx(w, now);
      } else if (w.fx && now - w.last > w.hold) {
        clearFx(w);
      }
      if (w.fx) {
        if (w.fx === "glitch") { w.jx = (Math.random() - 0.5) * 6; w.jy = (Math.random() - 0.5) * 4; }
        if (w.fx === "scramble") {
          const p = (now - w.start) / (w.hold * 0.7), o = w.orig, n2 = Math.floor(Math.min(1, p) * o.length);
          let out = o.slice(0, n2);
          for (let c = n2; c < o.length; c++) out += CH.charAt((Math.random() * CH.length) | 0);
          w.el.textContent = out;
        }
        if (d2 < rad2 * 1.3 && silk.length < 26) silk.push(w);
      }
    }
  }


  /* ---------- vision filter overlay (night / heat / neon ...) ---------- */
  let lens = null;
  function applyFilter() {
    const f = FILTERS[S.filter];
    if (!f || !f.css) { if (lens) lens.style.display = "none"; return; }
    if (!lens) {
      lens = document.createElement("div");
      lens.className = "spd-filter"; lens.setAttribute("aria-hidden", "true");
      document.body.appendChild(lens);
    }
    lens.style.display = "block";
    lens.style.backdropFilter = f.css; lens.style.webkitBackdropFilter = f.css;
    lens.style.background = f.tint || "transparent";
    lens.className = "spd-filter fx-" + S.filter + (f.scan ? " scan" : "") + (S.scope === "lens" ? " lens" : "");
    positionLens();
  }
  function positionLens() {
    if (lens && S.scope === "lens" && lens.style.display !== "none") {
      lens.style.setProperty("--lx", body.x.toFixed(1) + "px");
      lens.style.setProperty("--ly", body.y.toFixed(1) + "px");
      lens.style.setProperty("--lr", (240 * scale).toFixed(0) + "px");
    }
  }

  /* ---------- main loop ---------- */
  let prev = performance.now(), lastFx = 0, lastMode = "";
  const maxSpeed = () => (reduce ? 200 : 390) * (S.speed / 100);
  const mode = { cb: null };

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    const t = now / 1000, scX = window.scrollX || 0, scY = window.scrollY || 0;
    let n, leg, speed;

    if (S.palette === "rainbow" && now - lastRb > 90) {
      lastRb = now; const hue = (now / 22) % 360;
      pal = { sp: hsl2rgb(hue, 1, 0.6), sd: hsl2rgb(hue + 150, 1, 0.62), alt: hsl2rgb(hue + 75, 1, 0.62) };
      applyVars();
    }

    // roam when nobody steers (or when "roam free" is chosen)
    if (S.steer === "roam" || now - lastInput > 4000) {
      roaming = true;
      const rdx = target.x - body.x, rdy = target.y - body.y;
      if (rdx * rdx + rdy * rdy < 900) {
        target.x = 40 + Math.random() * (W - 80);
        target.y = 90 + Math.random() * (H - 180);
        if (Math.random() < 0.4) startPounce();
      }
    }
    const label = pFlag ? "pounce" : roaming ? "roaming" : "following you";
    if (label !== lastMode) { lastMode = label; if (mode.cb) mode.cb(label); }

    // body motion
    const dx = target.x - body.x, dy = target.y - body.y, dist = Math.sqrt(dx * dx + dy * dy);
    const mul = pFlag ? 2.7 : 1;
    const want = dist > 16 * scale ? Math.min(maxSpeed() * mul * scale, dist * (pFlag ? 6 : 3.2)) : 0;
    const tvx = dist > 0 ? (dx / dist) * want : 0, tvy = dist > 0 ? (dy / dist) * want : 0;
    const k1 = Math.min(1, dt * (pFlag ? 14 : 6));
    body.vx += (tvx - body.vx) * k1; body.vy += (tvy - body.vy) * k1;
    body.x += body.vx * dt; body.y += body.vy * dt;
    speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
    if (speed > 18) {
      const th = Math.atan2(body.vy, body.vx);
      let diff = th - body.h;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      body.h += diff * Math.min(1, dt * 7);
    }
    if (pFlag) {
      pTime -= dt;
      if (dist < 30 * scale || pTime <= 0) { pFlag = false; bump = 1; shock(body.x, body.y, 1100 * (0.5 + chaosV()), 260); }
    }
    bump = Math.max(0, bump - dt * 3.5);
    let dh = body.h - prevH; if (dh > Math.PI) dh -= TAU; if (dh < -Math.PI) dh += TAU;
    prevH = body.h;
    abd += ((-dh * 9) / Math.max(dt, 0.008) * 0.06 - abd) * Math.min(1, dt * 8);
    abd = Math.max(-0.45, Math.min(0.45, abd));

    // feet — tetrapod gait. While moving, the two leg groups alternate on a
    // clock, so all eight legs keep stepping every cycle (faster = more
    // frantic). When slow or still, legs settle by distance and fidget.
    const moving = speed > 35;
    const freq = moving ? Math.min(7.5, 2.4 + speed / 85) * (S.frenzy / 100) : 0; // full cycles per second
    if (moving) gaitPhase += dt * freq;
    const half = Math.floor(gaitPhase * 2);
    const fidget = !moving && speed < 20 && Math.random() < dt * 2.4 ? (Math.random() * legs.length) | 0 : -1;
    for (n = 0; n < legs.length; n++) {
      leg = legs[n];
      if (leg.t >= 1) {
        const id = ideal(leg);
        let go = false, dur = 0.12;
        if (moving) {
          const lead = 0.5 / freq; // land half a stride ahead of the hip
          id.x += body.vx * lead; id.y += body.vy * lead;
          if (leg.group === (half & 1) && leg.half !== half) {
            go = true; leg.half = half;
            dur = Math.max(0.04, Math.min(0.2, 0.4 / freq));
          } else {
            const fdx = id.x - leg.fx, fdy = id.y - leg.fy;
            if (fdx * fdx + fdy * fdy > Math.pow(70 * scale, 2)) { go = true; dur = 0.07; } // overstretched safety
          }
        } else {
          const fdx = id.x - leg.fx, fdy = id.y - leg.fy;
          if (fdx * fdx + fdy * fdy > Math.pow(26 * scale, 2)) { go = true; dur = 0.12; }
          else if (n === fidget) {
            id.x += (Math.random() - 0.5) * 30 * scale; id.y += (Math.random() - 0.5) * 30 * scale;
            go = true; dur = 0.11;
          }
        }
        if (go) {
          leg.sx = leg.fx; leg.sy = leg.fy; leg.tx = id.x; leg.ty = id.y;
          leg.t = 0; leg.dur = dur;
        }
      } else {
        leg.t += dt / leg.dur;
        const p = Math.min(1, leg.t), e = p * p * (3 - 2 * p);
        leg.fx = leg.sx + (leg.tx - leg.sx) * e; leg.fy = leg.sy + (leg.ty - leg.sy) * e;
        leg.lift = Math.sin(Math.PI * p);
        if (leg.t >= 1) {
          leg.lift = 0;
          leg.steps = (leg.steps || 0) + 1;
          if (S.sparks && speed > 90 && sparks.length < 70) {
            for (let s2 = 0; s2 < 2; s2++) {
              const ang = Math.random() * TAU, sp2 = 30 + Math.random() * 70;
              sparks.push({ x: leg.fx, y: leg.fy, vx: Math.cos(ang) * sp2, vy: Math.sin(ang) * sp2, age: 0, life: 0.45 });
            }
          }
        }
      }
    }

    // silk trail (page coordinates, so it scrolls with the text)
    if (S.trail) {
      const last = trail[trail.length - 1], gx = body.x + scX, gy = body.y + scY;
      if (!last || Math.pow(gx - last.x, 2) + Math.pow(gy - last.y, 2) > Math.pow(10 * scale, 2)) {
        trail.push({ x: gx, y: gy, t: now });
        if (trail.length > 110) trail.shift();
      }
    }
    while (trail.length && now - trail[0].t > 5200) trail.shift();

    positionLens();
    updateWords(dt, scX, scY);
    draw(dt, t, now, scX, scY);

    if (now - lastFx > 70) { lastFx = now; effectTick(now, scX, scY); }
    raf = requestAnimationFrame(frame);
  }

  function drawWeb(dt) {
    let j, p, dx, dy, d, k2;
    const rr = 170 * scale;
    for (j = 0; j < bp.length; j++) {
      p = bp[j];
      dx = p.x - body.x; dy = p.y - body.y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      if (d < rr) { k2 = 1 - d / rr; p.ex += (dx / d) * k2 * 900 * dt; p.ey += (dy / d) * k2 * 900 * dt; }
      const damp = Math.pow(0.04, dt);
      p.ex *= damp; p.ey *= damp;
      p.x += (p.bx + p.ex) * dt; p.y += (p.by + p.ey) * dt;
      if (p.x < 0 || p.x > W) { p.bx *= -1; p.x = Math.min(Math.max(p.x, 0), W); }
      if (p.y < 0 || p.y > H) { p.by *= -1; p.y = Math.min(Math.max(p.y, 0), H); }
    }
    ctx.lineWidth = 0.8;
    for (let a = 0; a < bp.length; a++) {
      for (let b = a + 1; b < bp.length; b++) {
        dx = bp[a].x - bp[b].x; dy = bp[a].y - bp[b].y;
        if (dx > 115 || dx < -115 || dy > 115 || dy < -115) continue;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < 115) {
          ctx.strokeStyle = css(pal.sp, (1 - d / 115) * 0.22);
          ctx.beginPath(); ctx.moveTo(bp[a].x, bp[a].y); ctx.lineTo(bp[b].x, bp[b].y); ctx.stroke();
        }
      }
      dx = bp[a].x - body.x; dy = bp[a].y - body.y; d = Math.sqrt(dx * dx + dy * dy);
      if (d < 210 * scale) {
        ctx.strokeStyle = css(pal.sd, (1 - d / (210 * scale)) * 0.45);
        ctx.beginPath(); ctx.moveTo(bp[a].x, bp[a].y); ctx.lineTo(body.x, body.y); ctx.stroke();
      }
    }
    ctx.fillStyle = css(pal.sp, 0.45);
    for (let a2 = 0; a2 < bp.length; a2++) { ctx.beginPath(); ctx.arc(bp[a2].x, bp[a2].y, 1.5, 0, TAU); ctx.fill(); }
  }

  function draw(dt, t, now, scX, scY) {
    ctx.clearRect(0, 0, W, H);
    let j, a, b;

    // lights: dim the page except around the spider
    if (S.lights > 0) {
      ctx.fillStyle = "rgba(2,4,10," + ((S.lights / 100) * 0.8).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
      const R = 330 * scale;
      const lg = ctx.createRadialGradient(body.x, body.y, 40 * scale, body.x, body.y, R);
      lg.addColorStop(0, "rgba(0,0,0,1)"); lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }

    if (S.web) drawWeb(dt);

    // aura
    if (S.aura) {
      const ag = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, 150 * scale);
      ag.addColorStop(0, css(pal.sp, 0.2)); ag.addColorStop(1, css(pal.sp, 0));
      ctx.fillStyle = ag; ctx.fillRect(body.x - 160 * scale, body.y - 160 * scale, 320 * scale, 320 * scale);
    }

    // silk trail and cross strands
    const life = 5200, n = trail.length;
    if (S.trail) {
      ctx.lineWidth = 1.2; ctx.lineCap = "round";
      for (j = 1; j < n; j++) {
        a = trail[j - 1]; b = trail[j];
        const age = 1 - (now - b.t) / life;
        if (age <= 0) continue;
        ctx.strokeStyle = css(pal.sp, age * 0.7);
        ctx.beginPath(); ctx.moveTo(a.x - scX, a.y - scY); ctx.lineTo(b.x - scX, b.y - scY); ctx.stroke();
      }
      ctx.lineWidth = 0.8;
      const reachS = 80 * scale;
      for (j = 0; j < n; j++) {
        for (let m = j + 7; m < n; m++) {
          const dx = trail[j].x - trail[m].x, dy = trail[j].y - trail[m].y;
          if (dx > reachS || dx < -reachS || dy > reachS || dy < -reachS) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < reachS) {
            const aj = 1 - (now - trail[j].t) / life, am = 1 - (now - trail[m].t) / life, al = Math.min(aj, am);
            if (al <= 0) continue;
            ctx.strokeStyle = css(pal.alt, al * (1 - d / reachS) * 0.45);
            ctx.beginPath(); ctx.moveTo(trail[j].x - scX, trail[j].y - scY); ctx.lineTo(trail[m].x - scX, trail[m].y - scY); ctx.stroke();
          }
        }
      }
    }

    // sparks
    for (j = sparks.length - 1; j >= 0; j--) {
      const sk = sparks[j]; sk.age += dt;
      if (sk.age >= sk.life) { sparks.splice(j, 1); continue; }
      sk.x += sk.vx * dt; sk.y += sk.vy * dt;
      ctx.fillStyle = css(pal.alt, 1 - sk.age / sk.life);
      ctx.beginPath(); ctx.arc(sk.x, sk.y, 1.7, 0, TAU); ctx.fill();
    }

    // silk lines from the spider to the words it is affecting
    ctx.lineWidth = 1;
    for (j = 0; S.silkLines && j < silk.length; j++) {
      const w = silk[j];
      if (!w.fx) continue;
      const wx = w.cx - scX + w.tx, wy = w.cy - scY + w.ty;
      const mx = (body.x + wx) / 2, my = (body.y + wy) / 2 + 8;
      ctx.strokeStyle = css(pal.sp, 0.55);
      ctx.beginPath(); ctx.moveTo(body.x, body.y); ctx.quadraticCurveTo(mx, my, wx, wy); ctx.stroke();
      ctx.fillStyle = css(pal.sd, 1);
      ctx.beginPath(); ctx.arc(wx, wy, 2.4, 0, TAU); ctx.fill();
    }

    drawSpider(t);
  }

  /* ---------- lifecycle ---------- */
  function start() {
    if (running) return;
    running = true;
    canvas.style.display = "block";
    setPalette();
    resize();
    if (!body.x) {
      body.x = W * 0.5; body.y = Math.min(H * 0.5, 380);
      target.x = body.x + 80; target.y = body.y + 30;
    }
    snapFeet();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    if (S.textFx) wrapWords();
    applyFilter();
    prev = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    clearAll(); unwrapWords();
    sparks = []; trail = []; silk = [];
    if (lens) { lens.remove(); lens = null; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = "none";
  }

  function update(patch) {
    const before = S;
    S = Object.assign({}, S, patch);
    if (S.enabled !== before.enabled) { S.enabled ? start() : stop(); return; }
    if (!running) return;
    if (S.palette !== before.palette) setPalette();
    if (S.size !== before.size) { applyScale(); snapFeet(); }
    if (S.textFx !== before.textFx) {
      if (S.textFx) wrapWords();
      else { clearAll(); unwrapWords(); silk = []; }
    }
    if (!S.trail && before.trail) trail = [];
    if (S.filter !== before.filter || S.scope !== before.scope) applyFilter();
  }

  function destroy() {
    stop();
    themeObserver.disconnect();
    ["--spd-sp", "--spd-sd", "--spd-alt", "--spd-glow"].forEach((v) => root.style.removeProperty(v));
  }

  if (S.enabled) start(); else canvas.style.display = "none";

  return {
    update: update,
    destroy: destroy,
    onMode: (cb) => { mode.cb = cb; },
    legSteps: () => legs.map((l) => l.steps || 0),
  };
}

/* ======================================================================
 *  3. STYLES — injected once, scoped to the spider's own classes
 * ==================================================================== */
const SPIDER_CSS = `/* Reset scoped to the spider UI (zero specificity, so nothing below is overridden) */
:where(.spd-ui), :where(.spd-ui) * , :where(.spd-filter), :where(.spd-canvas) { box-sizing: border-box; }
:where(.spd-ui) { font-family: inherit; color: var(--text, #f2f2f0); line-height: 1.3; text-align: left; }
:where(.spd-ui) button { font: inherit; margin: 0; padding: 0; color: inherit; cursor: pointer; appearance: none; -webkit-appearance: none; -webkit-tap-highlight-color: transparent; }
:where(.spd-ui) input[type="range"] { cursor: pointer; margin: 0; }
:where(.spd-ui) p { margin: 0; }
:where(.spd-ui) i, :where(.spd-ui) b, :where(.spd-ui) small { font-style: normal; }
/* ===================== SPIDER WALKER ===================== */
/* Layers: canvas sits above page content (and nav) but below the quick-nav,
   the cursor and the loader. It never captures a click. */
:root {
  --spd-sp: rgb(56, 214, 255);
  --spd-sd: rgb(255, 79, 139);
  --spd-alt: rgb(138, 255, 193);
  --spd-glow: rgba(56, 214, 255, 0.55);
}

.spd-canvas {
  position: fixed; left: 0; top: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 150;
}

/* Words — the engine moves them; these classes only change how they look. */
.spd-w { display: inline-block; transition: color 0.15s, background-color 0.15s, opacity 0.3s; }
.spd-w.spd-act { position: relative; z-index: 2; }
.spd-fx-box { outline: 1.5px solid var(--spd-sp); outline-offset: 1px; box-shadow: 0 0 12px var(--spd-glow); }
.spd-fx-big { color: var(--spd-sp); background: var(--bg, #0d0e12); text-shadow: 0 0 12px var(--spd-glow); }
.spd-fx-slant { background: var(--spd-sd); color: #fff; }
.spd-fx-flip { color: var(--spd-sp); }
.spd-fx-flipv { color: var(--spd-sd); }
.spd-fx-pink { background: var(--spd-sd); color: #080c14; }
.spd-fx-alt { background: var(--spd-alt); color: #080c14; }
.spd-fx-glitch { text-shadow: 2px 0 var(--spd-sd), -2px 0 var(--spd-sp); }
.spd-fx-ghost { opacity: 0.07; }
.spd-fx-float { color: var(--spd-alt); text-shadow: 0 0 14px var(--spd-alt); }
.spd-fx-scr { font-family: "JetBrains Mono", monospace; color: var(--spd-sp); white-space: nowrap; text-align: center; background: rgba(56, 214, 255, 0.12); }

/* ---------- settings: floating spider icon + panel (bottom-right) ---------- */
.spd-dock { position: fixed; right: 20px; bottom: 22px; z-index: 210; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.spd-fab {
  width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--border, #383b46);
  background: var(--surface, #1c1e26); color: var(--text, #f2f2f0);
  display: flex; align-items: center; justify-content: center;
  transition: border-color .2s ease, color .2s ease, box-shadow .2s ease, transform .2s ease;
}
.spd-fab:hover, .spd-fab.open { border-color: var(--highlight, #ff3355); color: var(--highlight, #ff3355); }
.spd-fab.open { box-shadow: 0 0 22px color-mix(in srgb, var(--highlight, #ff3355) 45%, transparent); }
.spd-fab.off { color: var(--text-dim, #8d8d95); }
.spd-fab:active { transform: scale(0.94); }

.spd-panel {
  width: min(330px, calc(100vw - 32px)); max-height: min(76vh, 640px);
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--surface, #1c1e26); border: 1px solid var(--border, #383b46); border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.spd-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border, #383b46); }
.spd-title { font-family: "Archivo Black", sans-serif; font-size: 1rem; margin-right: 10px; }
.spd-mode { font-family: "JetBrains Mono", monospace; font-size: 0.7rem; color: var(--highlight, #ff3355); text-transform: uppercase; letter-spacing: 0.1em; }
.spd-x { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border, #383b46); background: transparent; color: var(--text-dim, #8d8d95); display: flex; align-items: center; justify-content: center; }
.spd-x:hover { color: var(--highlight, #ff3355); border-color: var(--highlight, #ff3355); }
.spd-master { padding: 0 16px; border-bottom: 1px solid var(--border, #383b46); }
.spd-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 10px 12px 0; }
.spd-tab { padding: 8px 4px; font-size: 0.76rem; font-weight: 700; color: var(--text-dim, #8d8d95); background: transparent; border: none; border-bottom: 2px solid transparent; }
.spd-tab[aria-selected="true"] { color: var(--highlight, #ff3355); border-bottom-color: var(--highlight, #ff3355); }
.spd-body { padding: 6px 16px 16px; overflow-y: auto; }
.spd-note { font-size: 0.78rem; line-height: 1.5; color: var(--text-dim, #8d8d95); margin: 12px 0 4px; }

.spd-disabled { opacity: 0.4; pointer-events: none; }
.spd-label { font-family: "JetBrains Mono", monospace; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-dim, #8d8d95); margin: 16px 0 4px; }

.spd-row { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; background: none; border: none; color: var(--text, #f2f2f0); text-align: left; }
.spd-row b { font-size: 0.86rem; font-weight: 600; display: block; }
.spd-row small { display: block; font-size: 0.72rem; color: var(--text-dim, #8d8d95); margin-top: 1px; }
.spd-switch { flex: none; width: 36px; height: 20px; border-radius: 999px; background: var(--surface-2, #24262f); border: 1px solid var(--border, #383b46); position: relative; transition: background .2s ease, border-color .2s ease; }
.spd-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--text-dim, #8d8d95); transition: transform .2s ease, background .2s ease; }
.spd-switch.on { background: color-mix(in srgb, var(--highlight, #ff3355) 30%, var(--surface-2, #24262f)); border-color: var(--highlight, #ff3355); }
.spd-switch.on::after { transform: translateX(16px); background: var(--highlight, #ff3355); }

.spd-slider { flex-direction: column; align-items: stretch; gap: 6px; }
.spd-slider-head { display: flex; justify-content: space-between; align-items: center; }
.spd-slider output { font-family: "JetBrains Mono", monospace; font-size: 0.75rem; color: var(--highlight, #ff3355); }
.spd-slider input { width: 100%; accent-color: var(--highlight, #ff3355); }

.spd-pals { display: flex; gap: 10px; padding: 8px 0 2px; }
.spd-pal { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; padding: 0; transition: transform .2s ease, border-color .2s ease; }
.spd-pal:hover { transform: scale(1.1); }
.spd-pal[aria-pressed="true"] { border-color: var(--text, #f2f2f0); transform: scale(1.15); }

.spd-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px 0 2px; }
.spd-seg button { padding: 8px 10px; font-size: 0.8rem; font-weight: 600; color: var(--text-dim, #8d8d95); background: transparent; border: 1px solid var(--border, #383b46); border-radius: 999px; }
.spd-seg button[aria-pressed="true"] { color: var(--highlight, #ff3355); border-color: var(--highlight, #ff3355); }

.spd-reset { margin-top: 16px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; font-size: 0.8rem; font-weight: 600; color: var(--text-dim, #8d8d95); background: transparent; border: 1px solid var(--border, #383b46); border-radius: 999px; }
.spd-reset:hover { color: var(--highlight, #ff3355); border-color: var(--highlight, #ff3355); }

.spd-ui button:focus-visible, .spd-ui input:focus-visible { outline: 2px solid var(--highlight, #ff3355); outline-offset: 2px; }
@media (max-width: 520px) { .spd-dock { right: 14px; bottom: 16px; } }

/* ---------- quick-look cards + filter picker ---------- */
.spd-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px 0 2px; }
.spd-pcard {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px; text-align: left;
  background: var(--surface-2, #24262f); border: 1px solid var(--border, #383b46); border-radius: 12px; color: var(--text, #f2f2f0);
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.spd-pcard i { flex: none; width: 28px; height: 28px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18), 0 0 12px rgba(0,0,0,0.35); }
.spd-pcard b { display: block; font-size: 0.82rem; font-weight: 700; line-height: 1.15; }
.spd-pcard small { display: block; font-size: 0.68rem; color: var(--text-dim, #8d8d95); margin-top: 2px; line-height: 1.2; }
.spd-pcard:hover { border-color: var(--text-dim, #8d8d95); transform: translateY(-1px); }
.spd-pcard[aria-pressed="true"] { border-color: var(--highlight, #ff3355); background: color-mix(in srgb, var(--highlight, #ff3355) 12%, var(--surface-2, #24262f)); }
.spd-pcard[aria-pressed="true"] b { color: var(--highlight, #ff3355); }
.spd-custom { margin: 6px 0 0; font-family: "JetBrains Mono", monospace; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; }

.spd-fgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px 0 2px; }
.spd-fcard {
  display: flex; flex-direction: column; gap: 6px; padding: 6px 6px 7px; text-align: center;
  background: var(--surface-2, #24262f); border: 1px solid var(--border, #383b46); border-radius: 10px; color: var(--text-dim, #8d8d95);
  transition: border-color .2s ease, color .2s ease, transform .2s ease;
}
.spd-fcard i { display: block; height: 28px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14); }
.spd-fcard span { font-size: 0.68rem; font-weight: 700; line-height: 1.1; }
.spd-fcard:hover { color: var(--text, #f2f2f0); transform: translateY(-1px); }
.spd-fcard[aria-pressed="true"] { border-color: var(--highlight, #ff3355); color: var(--highlight, #ff3355); }

/* ---------- vision filter overlay ---------- */
.spd-filter { position: fixed; inset: 0; z-index: 149; pointer-events: none; overflow: hidden; }
.spd-filter.lens {
  -webkit-mask-image: radial-gradient(circle at var(--lx, 50%) var(--ly, 50%), #000 0, #000 calc(var(--lr, 240px) * 0.68), transparent var(--lr, 240px));
  mask-image: radial-gradient(circle at var(--lx, 50%) var(--ly, 50%), #000 0, #000 calc(var(--lr, 240px) * 0.68), transparent var(--lr, 240px));
}
.spd-filter.scan::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px); }

/* Acid: the whole picture's hue spins forever */
@keyframes spd-hue {
  from { -webkit-backdrop-filter: hue-rotate(0deg) saturate(2.6) contrast(1.2); backdrop-filter: hue-rotate(0deg) saturate(2.6) contrast(1.2); }
  to { -webkit-backdrop-filter: hue-rotate(360deg) saturate(2.6) contrast(1.2); backdrop-filter: hue-rotate(360deg) saturate(2.6) contrast(1.2); }
}
.spd-filter.fx-acid { animation: spd-hue 4s linear infinite; }

/* Glitch: jittering cyan / magenta tear bands */
@keyframes spd-glitch {
  0% { transform: translate(0, 0); background-position: 0 0; }
  16% { transform: translate(-9px, 0); background-position: 0 38px; }
  33% { transform: translate(7px, 0); background-position: 0 -26px; }
  50% { transform: translate(-4px, 0); background-position: 0 71px; }
  66% { transform: translate(11px, 0); background-position: 0 12px; }
  83% { transform: translate(-6px, 0); background-position: 0 -54px; }
  100% { transform: translate(0, 0); background-position: 0 0; }
}
.spd-filter.fx-glitch::before {
  content: ""; position: absolute; top: 0; bottom: 0; left: -14px; right: -14px; mix-blend-mode: screen;
  background: repeating-linear-gradient(0deg, transparent 0 14px, rgba(0,255,240,0.24) 14px 17px, transparent 17px 37px, rgba(255,0,110,0.22) 37px 39px, transparent 39px 70px);
  animation: spd-glitch 0.55s steps(1) infinite;
}

/* Matrix: digital rain streaks */
@keyframes spd-rain { from { background-position: 0 0, 0 0; } to { background-position: 0 0, 0 160px; } }
.spd-filter.fx-matrix::before {
  content: ""; position: absolute; inset: 0;
  background:
    repeating-linear-gradient(90deg, transparent 0 11px, rgba(0,255,80,0.2) 11px 12px),
    repeating-linear-gradient(0deg, transparent 0 40px, rgba(0,255,110,0.2) 40px 54px);
  background-size: auto, 100% 160px; animation: spd-rain 1.1s linear infinite;
}

/* VHS: flicker and a rolling tracking bar */
@keyframes spd-flick { 0%, 100% { opacity: 1; } 50% { opacity: 0.92; } }
@keyframes spd-track { from { transform: translateY(-20vh); } to { transform: translateY(115vh); } }
.spd-filter.fx-vhs { animation: spd-flick 0.14s steps(2) infinite; }
.spd-filter.fx-vhs::before {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 14vh;
  background: linear-gradient(transparent, rgba(255,255,255,0.14), transparent); animation: spd-track 4.5s linear infinite;
}
`;

/* ======================================================================
 *  4. SETTINGS PANEL + MOUNT
 * ==================================================================== */
const SPIDER_ICON = (size) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<ellipse cx="12" cy="15" rx="3.5" ry="4.6" fill="currentColor" fill-opacity="0.18"/><circle cx="12" cy="8.4" r="2.1"/>' +
  '<path d="M10 8.6 6 5.4 3 6.4M9.7 10.3 5 9.9 2.4 12.2M9.6 13.2 4.6 14.2 3 17.8M9.9 16 6.6 18.2 5.6 21.6"/>' +
  '<path d="M14 8.6 18 5.4 21 6.4M14.3 10.3 19 9.9 21.6 12.2M14.4 13.2 19.4 14.2 21 17.8M14.1 16 17.4 18.2 18.4 21.6"/></svg>';

const esc = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let current = null;

function injectStyle() {
  if (document.getElementById("spd-style")) return;
  const el = document.createElement("style");
  el.id = "spd-style";
  el.textContent = SPIDER_CSS;
  document.head.appendChild(el);
}

/**
 * mountSpider(options?) -> { update, get, reset, preset, open, close, destroy }
 *
 * options.panel         show the spider settings button + panel (default true)
 * options.defaults      override any DEFAULT_SETTINGS key (e.g. { palette: "cyan" })
 * options.storageKey    localStorage key for the visitor's saved settings
 * options.textSelector  CSS selector for the text the spider's Text FX may touch
 * options.persist       save settings in localStorage (default true)
 */
export function mountSpider(options) {
  options = options || {};
  const noop = () => {};
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { update: noop, get: () => ({ ...DEFAULT_SETTINGS }), reset: noop, preset: noop, open: noop, close: noop, destroy: noop };
  }
  if (current) current.destroy();
  injectStyle();

  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const BASE = Object.assign({}, DEFAULT_SETTINGS, reduce ? { chaos: 20, speed: 30, frenzy: 35 } : {}, options.defaults || {});
  const KEY = options.storageKey || "spider-walker";
  const persist = options.persist !== false;
  let S = Object.assign({}, BASE);
  if (persist) { try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* ignore */ } }

  const canvas = document.createElement("canvas");
  canvas.className = "spd-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const engine = createSpiderEngine(canvas, S, { textSelector: options.textSelector });

  let mode = "roaming", isOpen = false, tab = "spider", dock = null;
  engine.onMode((m) => { mode = m; const el = dock && dock.querySelector(".spd-mode"); if (el) el.textContent = S.enabled ? m : "off"; });

  function save() { if (persist) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } } }
  function set(patch) { S = Object.assign({}, S, patch); save(); engine.update(patch); render(); }

  function control(c) {
    let h = "";
    if (c.t === "label") return '<div class="spd-label">' + esc(c.text) + "</div>";
    if (c.t === "note") return '<p class="spd-note">' + esc(c.text) + "</p>";
    if (c.t === "toggle")
      return '<button type="button" class="spd-row spd-toggle" role="switch" aria-checked="' + !!S[c.key] + '" data-tog="' + c.key + '"><span><b>' + esc(c.label) + "</b>" +
        (c.hint ? "<small>" + esc(c.hint) + "</small>" : "") + '</span><i class="spd-switch ' + (S[c.key] ? "on" : "") + '"></i></button>';
    if (c.t === "slider")
      return '<label class="spd-row spd-slider"><span class="spd-slider-head"><b>' + esc(c.label) + "</b><output>" + S[c.key] + (c.unit || "") +
        '</output></span><input type="range" min="' + c.min + '" max="' + c.max + '" value="' + S[c.key] + '" data-sld="' + c.key + '" data-unit="' + (c.unit || "") + '"></label>';
    if (c.t === "seg") {
      h = '<div class="spd-seg">';
      c.options.forEach((o) => { h += '<button type="button" aria-pressed="' + (S[c.key] === o[0]) + '" data-k="' + c.key + '" data-v="' + o[0] + '">' + esc(o[1]) + "</button>"; });
      return h + "</div>";
    }
    if (c.t === "filters") {
      h = '<div class="spd-fgrid">';
      Object.keys(FILTERS).forEach((k) => {
        h += '<button type="button" class="spd-fcard" aria-pressed="' + (S[c.key] === k) + '" data-k="' + c.key + '" data-v="' + k + '"><i style="background:' + FILTERS[k].swatch + '"></i><span>' + esc(FILTERS[k].label) + "</span></button>";
      });
      return h + "</div>";
    }
    if (c.t === "palette") {
      h = '<div class="spd-pals">';
      PALETTE_OPTIONS.forEach((p) => { h += '<button type="button" class="spd-pal" style="background:' + p.bg + '" aria-pressed="' + (S.palette === p.id) + '" title="' + esc(p.label) + '" aria-label="' + esc(p.label) + '" data-k="palette" data-v="' + p.id + '"></button>'; });
      return h + "</div>";
    }
    if (c.t === "presets") {
      const act = activePreset(S);
      h = '<div class="spd-presets">';
      PRESETS.forEach((p) => { h += '<button type="button" class="spd-pcard" aria-pressed="' + (act === p.id) + '" data-preset="' + p.id + '"><i style="background:' + p.swatch + '"></i><span><b>' + esc(p.label) + "</b><small>" + esc(p.hint) + "</small></span></button>"; });
      h += "</div>";
      if (!act) h += '<p class="spd-note spd-custom">Custom mix</p>';
      return h;
    }
    return "";
  }

  function render() {
    if (!dock) return;
    const b = dock.querySelector(".spd-body"), scroll = b ? b.scrollTop : 0;
    const cur = TABS.filter((t) => t.id === tab)[0] || TABS[0];
    dock.innerHTML =
      (isOpen
        ? '<div class="spd-panel" role="dialog" aria-label="Spider settings"><div class="spd-head"><div><span class="spd-title">Spider</span><span class="spd-mode">' + (S.enabled ? mode : "off") +
          '</span></div><button type="button" class="spd-x" id="spdClose" aria-label="Close spider settings">&#10005;</button></div>' +
          '<div class="spd-master"><button type="button" class="spd-row spd-toggle" role="switch" aria-checked="' + !!S.enabled + '" data-tog="enabled"><span><b>Spider</b><small>Turn everything on or off</small></span><i class="spd-switch ' + (S.enabled ? "on" : "") + '"></i></button></div>' +
          '<div class="spd-tabs" role="tablist">' + TABS.map((t) => '<button type="button" role="tab" class="spd-tab" aria-selected="' + (tab === t.id) + '" data-tab="' + t.id + '">' + esc(t.label) + "</button>").join("") + "</div>" +
          '<div class="spd-body"><div class="' + (S.enabled ? "" : "spd-disabled") + '">' + cur.controls.map(control).join("") + '</div><button type="button" class="spd-reset" id="spdReset">&#8634; Reset everything</button></div></div>'
        : "") +
      '<button type="button" class="spd-fab ' + (isOpen ? "open " : "") + (S.enabled ? "" : "off") + '" id="spdFab" aria-label="Spider settings" aria-expanded="' + isOpen + '" title="Spider settings">' + SPIDER_ICON(22) + "</button>";
    const nb = dock.querySelector(".spd-body");
    if (nb) nb.scrollTop = scroll;
  }

  function onClick(e) {
    const t = e.target.closest && e.target.closest("button");
    if (!t) return;
    if (t.id === "spdFab") { isOpen = !isOpen; render(); }
    else if (t.id === "spdClose") { isOpen = false; render(); }
    else if (t.id === "spdReset") set(Object.assign({}, BASE));
    else if (t.dataset.tab) { tab = t.dataset.tab; render(); }
    else if (t.dataset.preset) { const pr = PRESETS.filter((p) => p.id === t.dataset.preset)[0]; set(Object.assign({}, BASE, pr.values, { enabled: true })); }
    else if (t.dataset.tog) { const o = {}; o[t.dataset.tog] = !S[t.dataset.tog]; set(o); }
    else if (t.dataset.k) { const q = {}; q[t.dataset.k] = t.dataset.v; set(q); }
  }
  function onInput(e) {
    const k = e.target.dataset && e.target.dataset.sld;
    if (!k) return;
    const p = {}; p[k] = +e.target.value;
    S = Object.assign({}, S, p); engine.update(p); save();
    e.target.closest("label").querySelector("output").textContent = S[k] + (e.target.dataset.unit || "");
  }
  function onKey(e) { if (e.key === "Escape" && isOpen) { isOpen = false; render(); } }

  if (options.panel !== false) {
    dock = document.createElement("div");
    dock.className = "spd-ui spd-dock";
    document.body.appendChild(dock);
    dock.addEventListener("click", onClick);
    dock.addEventListener("input", onInput);
    window.addEventListener("keydown", onKey);
    render();
  }

  const api = {
    update: (patch) => set(patch),
    get: () => Object.assign({}, S),
    reset: () => set(Object.assign({}, BASE)),
    preset: (id) => { const pr = PRESETS.filter((p) => p.id === id)[0]; if (pr) set(Object.assign({}, BASE, pr.values, { enabled: true })); },
    open: () => { if (dock) { isOpen = true; render(); } },
    close: () => { if (dock) { isOpen = false; render(); } },
    destroy: () => {
      window.removeEventListener("keydown", onKey);
      engine.destroy();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (dock && dock.parentNode) dock.parentNode.removeChild(dock);
      const st = document.getElementById("spd-style");
      if (st && st.parentNode) st.parentNode.removeChild(st);
      if (current === api) current = null;
    },
  };
  current = api;
  return api;
}

export default mountSpider;

export { DEFAULT_SETTINGS, PRESETS, FILTERS, createSpiderEngine };
