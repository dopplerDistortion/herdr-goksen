// The goksen.ing motion system for Herdr mods, ported from the site's
// src/lib/motion.ts and the motion block of globals.css (GOK-30).
//
// Every effect is a hard cut: a few timed phases, each one redraw, never a
// tween. Endless marks (busy, scan, cursor) run natively with .frames().
// Under macOS Reduce motion (shared "g.motion" === "reduce", written by
// g-workspace-chrome) no effect runs and every mark holds still.
//
// Source of truth: ~/.config/herdr-app/goksen-motion/motion.js. Mods cannot
// import across mod folders, so sync.sh copies this file into each g-* mod
// that uses it. Edit it here, then run sync.sh.

import { div } from "gpui-kit";
import { shared } from "herdr";

/** The --motion-* tokens, in ms. */
export const MS = { boot: 1200, cursor: 1000, glitch: 240, dissolve: 300, fault: 400, step: 40, row: 28 };

export const BLOCKS = "█▓▒░▚▞▖▘";
export const SCAN = ["▖", "▘", "▝", "▗"];
const NBSP = "\u00a0";
const MIN_GAP = 333;
const GLITCH_FRAMES = 4;
const MAX_STEP_ROWS = 12;

/** ASCII only, so Geist Mono draws every one. */
export const EMOTES = [
  "(x_x)", "(o_O)", "(>_<)", "(;_;)", "(-_-)", "(@_@)", "(T_T)", "(O_O;)", "(._.)", "(=_=)",
  "(+_+)", "(?_?)", "[x_x]", "(^_^;)", "\\(o_o)/", "\\_(o_o)_/", "(>o_o)>", "<(o_o<)", "D:", ":-/",
];

export function reduced() {
  return shared("g.motion") === "reduce";
}

/** Swaps about a third of the non-space characters for block glyphs. */
export function corrupt(text) {
  return Array.from(text, (c) => (!/\s/.test(c) && Math.random() < 1 / 3 ? BLOCKS[Math.floor(Math.random() * BLOCKS.length)] : c)).join("");
}

/** A random permutation of 0…n-1 (Fisher–Yates). */
export function shuffle(n) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function between([min, max]) {
  return Math.round(min + Math.random() * (max - min));
}

/** Rows of block glyphs, each from its own column; spaces let the panel show. */
export function noise(rows, columns) {
  return Array.from({ length: rows }, () => {
    const start = Math.floor(Math.random() * columns * 0.5);
    const end = start + Math.ceil(Math.random() * (columns - start));
    return Array.from({ length: end }, (_, i) => (i < start || Math.random() < 0.2 ? NBSP : BLOCKS[Math.floor(Math.random() * BLOCKS.length)])).join("");
  });
}

// Aftershock kinds: how often each comes up, how long it runs, how often it
// shows an Emote. The quiet time before one is longer than a second and than
// any Aftershock, so no second holds more than two flashes (WCAG 2.3.1).
const KINDS = {
  tear: { weight: 3, ms: [240, 420], emote: 0.5 },
  scan: { weight: 2, ms: [300, 450], emote: 0.5 },
  noise: { weight: 3, ms: [240, 400], emote: 0.6 },
  slice: { weight: 3, ms: [200, 320], emote: 0.35 },
  jolt: { weight: 2, ms: [160, 280], emote: 0 },
  takeover: { weight: 1, ms: [480, 640], emote: 1 },
};
const WAIT = [1400, 5200];
const FIRST_WAIT = [2200, 3600];
const SHOCK_FRAMES = 3;

function nextShock(previous) {
  const kinds = Object.keys(KINDS).filter((k) => k !== previous);
  let pick = Math.random() * kinds.reduce((sum, k) => sum + KINDS[k].weight, 0);
  const kind = kinds.find((k) => (pick -= KINDS[k].weight) < 0) ?? kinds[kinds.length - 1];
  const emote = Math.random() < KINDS[kind].emote;
  return {
    kind,
    wait: between(previous === null ? FIRST_WAIT : WAIT),
    ms: between(KINDS[kind].ms),
    top: between([4, 88]),
    band: between(emote ? [28, 56] : [6, 48]),
    shift: between([3, 14]) * (Math.random() < 0.5 ? -1 : 1),
    x: between([0, 60]),
    cut: between([25, 75]),
    emote,
  };
}

/**
 * One per view. Plays one-shot effects as timed phases (each phase is one
 * redraw) and keeps their state for render to read.
 */
export class Motion {
  constructor() {
    /** Multiplies every step's duration: 1 in the UI, 4 in the specimen's slow mode. */
    this.scale = 1;
    this.fx = new Map();
    this.last = new Map();
    this.deck = [];
  }

  /**
   * Runs phases 0…n-1, `durations[i]` ms each, then ends (phase -1). Each
   * step's timer comes from the cx the step before was given, never a kept
   * one; a run past its end time counts as ended, so a lost step can't
   * leave an effect stuck.
   */
  play(key, durations, cx, data = {}) {
    if (reduced() || !durations.length) return false;
    durations = durations.map((d) => d * this.scale);
    const total = durations.reduce((a, b) => a + b, 0);
    const run = { phase: 0, data, end: Date.now() + total + 250 };
    this.fx.set(key, run);
    const next = (i, c) =>
      c.timer.after(durations[i], (c2) => {
        const cc = c2 ?? c;
        if (this.fx.get(key) !== run) return;
        if (i + 1 >= durations.length) this.fx.delete(key);
        else {
          run.phase = i + 1;
          next(i + 1, cc);
        }
        cc.notify();
      });
    next(0, cx);
    cx.notify();
    return true;
  }

  get(key) {
    const r = this.fx.get(key);
    if (r && r.end && Date.now() > r.end) {
      this.fx.delete(key);
      return undefined;
    }
    return r;
  }

  phase(key) {
    return this.get(key)?.phase ?? -1;
  }

  data(key) {
    return this.get(key)?.data;
  }

  running(key) {
    return Boolean(this.get(key));
  }

  stop(key) {
    this.fx.delete(key);
  }

  // Glitch: the text runs through corrupt frames for --motion-glitch, at most
  // three runs a second.
  glitch(key, text, cx) {
    const now = Date.now();
    if (now - (this.last.get(key) ?? 0) < MIN_GAP || this.running(key)) return;
    this.last.set(key, now);
    const frames = Array.from({ length: GLITCH_FRAMES }, () => corrupt(text));
    this.play(key, Array(GLITCH_FRAMES).fill(MS.glitch / GLITCH_FRAMES), cx, { frames });
  }

  // Dissolve: the characters settle in random order over --motion-dissolve;
  // a no-break space holds each unsettled place.
  dissolve(key, text, cx) {
    const chars = Array.from(text);
    const order = shuffle(chars.length);
    const n = Math.max(1, Math.min(8, chars.length));
    const frames = Array.from({ length: n }, (_, k) => {
      const due = Math.floor((k / n) * chars.length);
      const settled = new Set(order.slice(0, due));
      return chars.map((c, i) => (/\s/.test(c) || settled.has(i) ? c : NBSP)).join("");
    });
    this.play(key, Array(n).fill(MS.dissolve / n), cx, { frames });
  }

  /** The text as an effect shows it now: a glitch or dissolve frame, else the text. */
  text(key, text) {
    const r = this.get(key);
    return r?.data?.frames ? r.data.frames[r.phase] ?? text : text;
  }

  // Hard cut (a Fault): to signal, a tear down, clear, a tear up, then the
  // Fault state; the 0/20/35/55/75 % keyframes of motion-cut over 400 ms.
  cut(key, cx) {
    this.play(key, [80, 60, 80, 80, 100], cx);
  }

  // Step: rows of a list or menu appear one by one, one row step apart.
  step(key, count, cx) {
    const n = Math.min(count, MAX_STEP_ROWS);
    if (n > 1) this.play(key, Array(n).fill(MS.row), cx, { n });
  }

  shown(key, i) {
    const r = this.get(key);
    if (!r) return true;
    return i <= r.phase || (r.phase >= r.data.n - 1);
  }

  // Feed: a sheet comes up from the bottom edge in four motion steps.
  feed(key, cx) {
    this.play(key, Array(4).fill(MS.step), cx);
  }

  /** How far a fed sheet still sits below its place, 0…1. */
  feedOffset(key) {
    const p = this.phase(key);
    return p < 0 ? 0 : (4 - p) / 4;
  }

  // Boot log: lines typed a few characters a step within --motion-boot,
  // then the cursor blinks five times.
  boot(key, lines, cx) {
    const text = lines.join("  ·  ");
    const steps = Math.min(24, Math.max(4, Math.ceil(text.length / 3)));
    const frames = Array.from({ length: steps }, (_, k) => text.slice(0, Math.ceil(((k + 1) / steps) * text.length)));
    if (this.play(key, Array(steps).fill(MS.boot / steps), cx, { frames })) {
      cx.timer.after(MS.boot * this.scale, (cx2) => this.play(`${key}:cursor`, [MS.cursor * 5 / this.scale], cx2 ?? cx));
    }
  }

  // Build: the frame writes its source line by line, holds it three steps and
  // cuts to the frame; then each part does the same in its own box.
  build(key, sources, cx) {
    const durations = [];
    const plan = [];
    sources.forEach((lines, part) => {
      const write = Math.min(Math.max(lines.length * (MS.step / 2), MS.step * 4), MS.step * 10);
      const per = write / Math.max(lines.length, 1);
      lines.forEach((_, line) => { durations.push(per); plan.push({ part, line }); });
      for (let h = 0; h < 3; h++) { durations.push(MS.step); plan.push({ part, line: lines.length - 1 }); }
    });
    this.play(key, durations, cx, { plan, sources });
  }

  /** Where a Build is: which part writes (0 is the frame) and how many lines show. */
  building(key) {
    const r = this.get(key);
    if (!r) return null;
    const { part, line } = r.data.plan[r.phase];
    return { part, lines: r.data.sources[part].slice(0, line + 1) };
  }

  // Aftershocks: after the Hard cut on a Fault that fills its surface, a
  // random kind with new numbers after a random wait, again and again, until
  // stopShocks. Each one is three frames.
  aftershocks(key, cx) {
    if (this.fx.has(`${key}:loop`)) return;
    const loop = { previous: null };
    this.fx.set(`${key}:loop`, loop);
    const schedule = (cx) => {
      const shock = nextShock(loop.previous);
      loop.previous = shock.kind;
      cx.timer.after(shock.wait, (cx2) => {
        if (this.fx.get(`${key}:loop`) !== loop) return;
        const c = cx2 ?? cx;
        if (reduced()) return schedule(c);
        shock.emoteText = shock.emote ? this.emote() : null;
        shock.noise = noise(1 + Math.floor(Math.random() * 2), 48);
        shock.titleFrames = Array.from({ length: SHOCK_FRAMES }, () => null);
        shock.emoteFrame = Math.floor(Math.random() * SHOCK_FRAMES);
        this.play(key, Array(SHOCK_FRAMES).fill(shock.ms / SHOCK_FRAMES), c, { shock });
        c.timer.after(shock.ms, (cx3) => { if (this.fx.get(`${key}:loop`) === loop) schedule(cx3 ?? c); });
      });
    };
    schedule(cx);
  }

  stopShocks(key) {
    this.fx.delete(`${key}:loop`);
    this.fx.delete(key);
  }

  /** The Aftershock playing now, with its frame, or null. */
  shock(key) {
    const r = this.get(key);
    return r?.data?.shock ? { ...r.data.shock, frame: r.phase } : null;
  }

  /** Deals the Emotes in random order: every one before any comes again. */
  emote() {
    if (!this.deck.length) this.deck = shuffle(EMOTES.length).map((i) => EMOTES[i]);
    return this.deck.pop();
  }
}

// ---- Drawing helpers: each takes the theme and returns gpui elements. ----

/** Busy: the amber square that blinks, 500 ms on, 500 ms off. */
export function busy(t) {
  const el = div().w(12).flex_none().flex().justify_center().text_size(11).text_color(t.working);
  return reduced() ? el.child("■") : el.frames(["■", " "], MS.cursor / 2).child("■");
}

/** Scan: the quarter block turns one corner every four motion steps while it searches. */
export function scan(t, color) {
  const el = div().w(12).flex_none().flex().justify_center().text_size(11).text_color(color ?? t.foreground);
  return reduced() ? el.child(SCAN[0]) : el.frames(SCAN, MS.step * 4).child(SCAN[0]);
}

/** The text cursor; it blinks while `blinking`, then holds. */
export function cursor(t, blinking) {
  const el = div().flex_none().text_color(t.foreground);
  return blinking && !reduced() ? el.frames(["▌", " "], MS.cursor / 2).child("▌") : el.child("▌");
}

/**
 * Applies a Hard cut phase to an element of height `h`: full signal, a tear
 * shifted right over the top half, clear, a tear shifted left over the bottom
 * half, clear. `solid`: the element is red at rest.
 */
export function cutStyle(el, phase, t, h, solid = false) {
  // A part that is red at rest (a "needs you" badge) shows its red frame
  // between the tears, so the cut reads against its own fill.
  if (solid && phase === 2) return el.bg(t.popover).text_color(t.blocked).border_1().border_color(t.blocked);
  if (phase === 0) return el.bg(t.blocked).text_color(t.background);
  if (phase === 1) return el.relative().left(6).child(div().absolute().left(0).right(0).top(0).h(Math.ceil(h * 0.52)).bg(t.blocked));
  if (phase === 3) return el.relative().left(-6).child(div().absolute().left(0).right(0).bottom(0).h(Math.ceil(h * 0.48)).bg(t.blocked));
  return el;
}

/** The overlay an Aftershock draws on a panel `w`×`h` px: a band, a bar or noise. */
export function shockLayer(t, s, w, h) {
  if (!s) return null;
  const top = Math.round((s.top / 100) * Math.max(h - s.band, 0));
  const emote = s.emoteText;
  if (s.kind === "tear" || s.kind === "scan") {
    const fill = s.kind === "tear" ? t.blocked : t.foreground;
    return div().absolute().left(0).right(0).top(top).h(s.band).bg(fill).flex().items_center()
      .pl(Math.round((s.x / 100) * w)).text_size(12).text_color(t.background).child(emote ?? "");
  }
  if (s.kind === "noise") {
    return div().absolute().left(0).right(0).top(top).flex().flex_col().text_size(12).text_color(t.foreground)
      .children(s.noise.map((row) => div().child(row)))
      .when(Boolean(emote), (el) => el.child(div().pl(Math.round((s.x / 100) * w)).child(emote)));
  }
  return div();
}

/** A panel's title as an Aftershock shows it (slice and takeover). */
export function shockTitle(text, s) {
  if (!s) return text;
  if (s.kind === "takeover" && s.emoteText) return s.emoteText;
  if (s.kind === "slice") return s.emoteText && s.frame === s.emoteFrame ? s.emoteText : corrupt(text);
  return text;
}

/** A panel's line as an Aftershock shows it (jolt). */
export function shockLine(text, s) {
  return s && s.kind === "jolt" ? corrupt(text) : text;
}

/** How far the panel drops (jolt) or the title shifts (slice), in px. */
export function shockShift(s) {
  return s && (s.kind === "jolt" || s.kind === "slice") ? s.shift : 0;
}

/**
 * A bone focus ring 2 px wide and 2 px clear of the element (Focus snap): it
 * lands 2 px further out and closes in one motion step. The ring is drawn
 * over a fixed 6 px pad (2 px ring, 2 px clear, 2 px for the landing step),
 * so nothing around it moves.
 */
export function ring(el, t, on, snapping, grow = false) {
  const out = snapping ? 0 : 2;
  return div().relative().when(grow, (w) => w.flex_1().min_w(0)).when(!grow, (w) => w.flex_none()).p(6).child(el)
    .when(on, (w) => w.child(div().absolute().top(out).left(out).right(out).bottom(out).border_2().border_color(t.foreground)));
}
