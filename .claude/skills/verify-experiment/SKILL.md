---
name: verify-experiment
description: >-
  Verify an experiment's real behavior in a browser via the Playwright MCP -
  for canvas/WebGL/animation experiments where you must confirm it actually
  renders, evolves, and responds (not just compiles). Use when the user says
  "verify in the browser", "check it renders", "is it actually animating",
  "test the canvas/sim", "use playwright to look at it", or reports bad visual
  behavior. Captures this repo's gotchas: the dev-server base path, reading GPU
  pixels instead of trusting screenshots, and frame-counting a paused-looking sim.
---

# Verify an experiment in the browser (Playwright MCP)

Most experiments here are canvas/WebGL sims. `tsc`/lint/build prove they
*compile*; they do not prove the thing renders, evolves, or reacts. When
behavior is in question, drive the real app with the Playwright MCP and
**measure**, do not eyeball.

The Playwright MCP tools are deferred - load them first with
`ToolSearch` (e.g. `select:` the ones you need): `browser_navigate`,
`browser_take_screenshot`, `browser_run_code_unsafe`, `browser_console_messages`,
`browser_click`, `browser_snapshot`.

## Prerequisites

- The **dev server is the user's** - never run `npm run dev` (see CLAUDE.md). It
  is normally already running on **`http://localhost:5173`**. If navigation
  fails, ask the user to start it using an AskUserQuestion prompt rather than 
  starting it yourself.
- Do not self-verify visually by default elsewhere (the user does visual checks).
  This skill applies when the user explicitly asks for browser verification.

## Gotcha 1: the base path (this wastes a step every time)

Vite is configured with `base: /archive-of-experiments/`. A route URL **without**
that prefix returns a "The server is configured with a public base URL of
/archive-of-experiments/ - did you mean..." stub, not the app. Always navigate to:

```
http://localhost:5173/archive-of-experiments/experiments/<id>
```

(e.g. `.../experiments/reaction-diffusion`). If unsure of the prefix, read `base`
in [vite.config.ts](../../../vite.config.ts) first.

## Gotcha 2: screenshots lie about motion; measure pixels instead

A screenshot of a frozen sim and an evolving sim look identical frame to frame.
For anything animated, use `browser_run_code_unsafe` + `page.evaluate` to read the
canvas and compute numbers. Key recipes (adapt the selector/metric):

```js
// Is the field actually changing? Read GL pixels twice, compare.
async (page) => {
  const grab = () => page.evaluate(() => {
    const c = document.querySelector('canvas.rd-canvas');
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
    const px = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, nz = 0;
    for (let i = 0; i < px.length; i += 4) { const b = px[i]+px[i+1]+px[i+2]; sum += b; if (b > 30) nz++; }
    return { sum, coverage: nz / (c.width*c.height) };
  });
  const a = await grab(); await page.waitForTimeout(1500); const b = await grab();
  return JSON.stringify({ changed: a.sum !== b.sum, a, b });
}
```

```js
// Is the rAF loop even running? Count frames over 1s. (A "paused-looking" sim
// with running:true but a dead loop is a real bug class.)
async (page) => page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; (performance.now()-t0 < 1000) ? requestAnimationFrame(tick) : res(n); };
  requestAnimationFrame(tick);
}))
```

```js
// Scrape an in-app debug panel for telemetry (these experiments expose one).
async (page) => page.evaluate(() =>
  [...document.querySelectorAll('.rd-dbg-row')].map(r => r.textContent))
```

`preserveDrawingBuffer: true` matters - without it `readPixels` on the default
framebuffer returns blank after compositing. (These canvases already set it.)

## Gotcha 3: open the in-app debug panel

Canvas experiments expose a copy-back **debug panel** (collapsible, closed by
default) with the ground-truth state (e.g. RD reports `steps`, `delta`, `active`,
`fps`, `grid`, `float`). Read those rows directly (recipe above) - they often
answer the question without any pixel math. `steps` climbing + `delta`≈0 =
converged/stuck-but-stepping; `steps` frozen = dead loop.

## Gotcha 4: seeding is random - test across reloads

Sims seed with `Math.random()`, so one load is not representative. To judge
reliability (or chase variance bugs), `browser_navigate` to reload 2-3 times and
compare the metric. A preset that fills 80% one load and 9% the next is a
seeding-variance bug, not success.

## Driving interactions

- Presets / buttons: `page.getByRole('button', { name, exact: false }).first().click()`.
- Brush / drag: `page.mouse.move(x,y)` -> `mouse.down()` -> stepped `mouse.move` ->
  `mouse.up()`, with small `waitForTimeout` between moves; read the canvas rect via
  `getBoundingClientRect()` for coordinates.
- Let sims settle: `waitForTimeout(4000-6000)` (they run thousands of steps/sec).

## Screenshots & artifacts

- `browser_take_screenshot` with a relative `filename` saves under the **current
  working directory** (repo root) - then `Read` that path to view it. Snapshots
  and console logs land in `.playwright-mcp/`.
- Clean up stray screenshots from the repo root when done (`rm rd-*.png`).
- Console: a `favicon.ico` 404 and an SPA route 404 are benign noise here.

## Meta-lesson: the live app is the oracle

An offline CPU model (e.g. a reference port for a smoke test) is great for fast,
deterministic trend-finding, but it can diverge from the live GPU path on
marginal cases - float32-vs-float16 precision, a hard-disc model vs a soft shader
splat, grid size. When the model and the browser disagree, **trust the browser**
and reconcile the model to it.
