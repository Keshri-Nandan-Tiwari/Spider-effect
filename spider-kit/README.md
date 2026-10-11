# Spider Walker — drop-in kit

One file, zero dependencies. Works in React, Vue, Next.js, plain HTML — anything.

## Install (copy-paste)
1. Copy `spider.js` into your project (e.g. `src/spider.js`).
2. Use it:

**React / Vite / Next.js** — also copy `SpiderWalker.jsx`, then once in your app:
```jsx
import SpiderWalker from "./SpiderWalker";
// inside your root component:
<SpiderWalker />
```

**Any other setup**
```js
import mountSpider from "./spider.js";
mountSpider();
```

**Plain HTML**
```html
<script type="module">
  import mountSpider from "./spider.js";
  mountSpider();
</script>
```

## What you get
- Spider that follows the cursor / your finger (or roams free), click or tap to pounce
- Silk trail, glow aura, web particles, sparks, spotlight darkness, silk threads to words
- Text FX: nearby words flip, glitch, scramble, float
- 14 vision filters (Night vision, Heat, Neon, Cyber, Vapor, Acid, Glitch, Matrix, VHS,
  Blood moon, Noir, X-ray, Invert) as a lens around the spider or over the whole page
- 5 colour palettes (Match theme, Cyan, Toxic green, Magma, Rainbow)
- 6 quick looks: Default, Calm, Crazy, Cyber, Horror, Stealth
- Spider-icon settings button (bottom-right): visitors can switch every effect on/off;
  choices are remembered in the browser

## Options
```js
mountSpider({
  panel: true,                    // show the settings button + panel
  defaults: { palette: "cyan" },  // override any default (see DEFAULT_SETTINGS in spider.js)
  storageKey: "spider-walker",    // localStorage key
  persist: true,                  // remember visitor's choices
  textSelector: "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption", // text Text-FX may touch
});
```
Returns `{ update(patch), get(), reset(), preset(id), open(), close(), destroy() }`.
Example: `spider.update({ filter: "matrix", lights: 40 })`.

Default settings: chaos 50%, size 60%, speed 50%, leg frenzy 50%, darkness 0%,
web particles off, vision filter off, colour "Match theme".

## Notes
- **Colour:** "Match theme" reads your site's `--highlight` CSS variable (falls back to red).
  The panel also uses `--surface`, `--surface-2`, `--border`, `--text`, `--text-dim`, `--bg`
  if you define them, and has dark fallbacks if you don't.
- **Never touch an element:** add `data-spider-ignore` to it.
- **Text FX and React:** it temporarily wraps words of the matched text in `<span>`s and puts
  them back when switched off. If a specific dynamic text ever errors, add `data-spider-ignore`
  to it or narrow `textSelector`.
- **Layers:** filter overlay z-index 149, spider canvas 150, settings dock 210. Change them
  in the CSS block inside `spider.js` if they clash.
- **Next.js:** `mountSpider` is SSR-safe (does nothing on the server).
- `spider-logo.svg` is the spider icon as a standalone file (usable as a favicon or logo).

## Demo
Open `demo/index.html` in a browser to see the spider on a plain page (no build step).
`demo/spider.iife.js` is the same code bundled as a classic script, for quick tests.
