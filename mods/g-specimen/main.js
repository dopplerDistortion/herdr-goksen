// The motion specimen: every goksen.ing motion effect in its own Panel with a
// PLAY button, like the site's /system motion specimen. SLOW plays each step
// four times as long, so the hard cuts can be read. Open it from the command
// palette ("Motion specimen") or `herdr-app do mod.open --name g-specimen`.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, theme, shared, setShared, settings } from "herdr";
import { Motion, busy, scan, cursor, cutStyle, shockLayer, shockTitle, shockLine, shockShift, ring, reduced } from "./motion.js";

const STEP_ROWS = ["New tab", "Split right", "Split down", "Rename tab", "Close tab"];
const BUILD_SOURCES = [
  ['<section class="panel">', "  <header>MACHINE</header>", "  <div>…</div>", "  <footer>…</footer>", "</section>"],
  ["<div>", "  <span>orb</span>", "  <span>default@127.0.0.1</span>", "</div>"],
  ["<footer>", '  <button class="primary">Connect</button>', "</footer>"],
];

export default class Specimen extends View {
  init(_props, cx) {
    this.m = new Motion();
    this.slow = false;
    this.shocking = false;
    this.focused = false;
    this.box = { w: 360, h: 110 };
    this.handle = cx.focus_handle();
    this.handle.focus();
    // Props for recording: `only` shows one panel (its label), `autoplay`
    // replays it every that many ms, `slow` starts at ×4, and `scale` sets
    // shared "g.motion.scale" to slow every goksen mod (1 clears it).
    const p = props() ?? {};
    this.only = p.only ?? null;
    this.plays = {};
    if (p.slow) { this.slow = true; this.m.scale = 4; }
    if (typeof p.scale === "number") setShared("g.motion.scale", p.scale === 1 ? null : p.scale);
    if (this.only && p.autoplay) {
      const tick = (c) => {
        this.autoplay(c);
        c.timer.after(p.autoplay, (c2) => tick(c2 ?? c));
      };
      cx.timer.after(500, (c) => tick(c ?? cx));
    }
  }

  autoplay(cx) {
    if (this.only === "AFTERSHOCK") { if (!this.shocking) this.plays.AFTERSHOCK?.(cx); return; }
    if (this.only === "FOCUS SNAP") {
      this.focused = false;
      cx.notify();
      cx.timer.after(400 * this.m.factor(), (c) => this.plays["FOCUS SNAP"]?.(c ?? cx));
      return;
    }
    this.plays[this.only]?.(cx);
  }

  close() {
    const id = props()?.overlay;
    if (id) closeOverlay(id);
  }

  setSlow(on, cx) {
    this.slow = on;
    this.m.scale = on ? 4 : 1;
    cx.notify();
  }

  render(cx) {
    const t = theme();
    const off = reduced();

    // A Panel: a framed box with a label row (micro-label, optional PLAY).
    const panel = (label, play, body, note) =>
      v_flex().flex_1().min_w(0).border_1().border_color(t.border).bg(t.background)
        .child(h_flex().h(30).px(12).items_center().border_b(1).border_color(t.border)
          .child(div().flex_1().text_size(11).text_color(t.muted).child(label))
          .when(Boolean(play), (el) => el.child(div().id(`play-${label}`).px(8).h(20).flex().items_center().border_1().border_color(t.input)
            .text_size(10.5).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.raised))
            .on_click((_e, cx) => play(cx)).child(play && play.label ? play.label : "PLAY"))))
        .child(div().relative().h(118).px(14).py(12).overflow_hidden().child(body))
        .when(Boolean(note), (el) => el.child(div().px(12).pb(8).text_size(10.5).text_color(t.muted).child(note)));
    const row2 = (a, b) => h_flex().items_start().gap(12).child(a).child(b);

    // Busy, Scan, Cursor: endless marks that run natively.
    const marks = v_flex().gap(10).text_size(12.5).text_color(t.foreground)
      .child(h_flex().gap(8).items_center().child(busy(t)).child("working: the amber square blinks"))
      .child(h_flex().gap(8).items_center().child(scan(t)).child("searching: a quarter block turns"))
      .child(h_flex().gap(2).items_center().child(div().child("ready")).child(cursor(t, true)));

    // Glitch.
    const glitchText = "goksen.ing / herdr";
    const glitch = div().id("glitch-text").text_size(22).text_color(t.foreground).cursor_pointer()
      .on_hover((h, cx) => { if (h) this.m.glitch("glitch", glitchText, cx); })
      .child(this.m.text("glitch", glitchText));
    const playGlitch = (cx) => { this.m.last.delete("glitch"); this.m.glitch("glitch", glitchText, cx); };

    // Dissolve.
    const dissolveText = "The Print Proof";
    const dissolve = div().text_size(22).text_color(t.foreground).child(this.m.text("dissolve", dissolveText));
    const playDissolve = (cx) => this.m.dissolve("dissolve", dissolveText, cx);

    // Step.
    const step = v_flex().children(STEP_ROWS.map((r, i) => h_flex().h(19).px(6).items_center().text_size(12)
      .when(i === 0, (el) => el.bg(t.foreground).text_color(t.background))
      .when(i !== 0, (el) => el.text_color(t.foreground))
      .when(!this.m.shown("step", i), (el) => el.invisible())
      .child(r)));
    const playStep = (cx) => this.m.step("step", STEP_ROWS.length, cx);

    // Feed: a sheet comes up from the bottom edge in four steps.
    const sheetH = 70;
    const feed = div().relative().h(94).overflow_hidden()
      .child(div().absolute().left(0).right(0).h(sheetH).top(94 - sheetH + Math.round(this.m.feedOffset("feed") * sheetH))
        .bg(t.popover).border_1().border_color(t.border).px(12).py(10).text_size(12).text_color(t.foreground)
        .child(h_flex().gap(8).items_center().child(div().size(8).bg(t.done)).child("Claude Code finished"))
        .child(div().pt(4).text_color(t.muted).child("~ / 1 · 4m")));
    const playFeed = (cx) => this.m.feed("feed", cx);

    // Hard cut.
    const cut = cutStyle(v_flex().h(70).px(12).justify_center().border_1().border_color(t.blocked).text_size(12.5)
      .child(div().text_color(t.blocked).child("FAULT"))
      .child(div().text_color(t.foreground).child("connection refused: orb")), this.m.phase("cut"), t, 70);
    const playCut = (cx) => this.m.cut("cut", cx);

    // Aftershocks with Emotes, after a Hard cut.
    const sh = this.shocking ? this.m.shock("shock") : null;
    const shockPanel = cutStyle(v_flex().relative().h(94).px(12).justify_center().gap(4).border_1().border_color(t.blocked)
      .top(sh?.kind === "jolt" ? Math.abs(shockShift(sh)) : 0)
      .on_size_change((size, cx) => { const z = settings().zoom ?? 1; this.box = { w: size.width / z, h: size.height / z }; })
      .child(div().relative().left(sh?.kind === "slice" ? shockShift(sh) : 0).text_size(16).text_color(t.blocked).child(shockTitle("404", sh)))
      .child(div().text_size(12).text_color(t.foreground).child(shockLine("Nothing lives at this address.", sh)))
      .when(Boolean(sh), (el) => el.child(shockLayer(t, sh, this.box.w, this.box.h))), this.m.phase("shock-cut"), t, 94);
    const toggleShocks = (cx) => {
      if (this.shocking) { this.shocking = false; this.m.stopShocks("shock"); }
      else { this.shocking = true; this.m.cut("shock-cut", cx); this.m.aftershocks("shock", cx); }
      cx.notify();
    };
    toggleShocks.label = this.shocking ? "STOP" : "START";

    // Boot log.
    const bootLines = ["herdr 3 spaces", "2 agents", "⌘⇧P commands"];
    const bootText = this.m.running("boot") ? this.m.text("boot", "") : this.m.running("boot:cursor") || this.booted ? bootLines.join("  ·  ") : "";
    const boot = h_flex().gap(1).items_center().text_size(12.5).text_color(t.muted)
      .child(div().child(bootText)).child(cursor(t, this.m.running("boot:cursor")));
    const playBoot = (cx) => { this.booted = true; this.m.boot("boot", bootLines, cx); };

    // Build: the panel writes its source, cuts to its frame, then each part.
    const b = this.m.building("build");
    const layer = (lines) => div().absolute().top(0).left(0).right(0).bottom(0).bg(t.background).px(6).py(2)
      .flex().flex_col().text_size(10.5).text_color(t.muted).children(lines.map((l) => div().child(l.replace(/ /g, " "))));
    const part = (n, el) => div().relative().child(el.when(Boolean(b) && b.part <= n, (x) => x.invisible()))
      .when(Boolean(b) && b.part === n, (x) => x.child(layer(b.lines)))
      .when(Boolean(b) && b.part < n, (x) => x.invisible());
    const build = div().relative().h(94).child(
      v_flex().size_full().border_1().border_color(t.border).when(b?.part === 0, (x) => x.invisible())
        .child(h_flex().h(22).px(8).items_center().border_b(1).border_color(t.border).text_size(10.5).text_color(t.muted).child("MACHINE"))
        .child(part(1, h_flex().px(8).h(28).gap(8).items_center().text_size(12).child(div().text_color(t.foreground).child("orb")).child(div().text_color(t.muted).child("default@127.0.0.1"))))
        .child(part(2, h_flex().px(8).justify_end().child(div().px(8).h(22).flex().items_center().bg(t.foreground).text_color(t.background).text_size(11).child("Connect")))))
      .when(b?.part === 0, (x) => x.child(layer(b.lines)));
    const playBuild = (cx) => this.m.build("build", BUILD_SOURCES, cx);

    // Focus snap: the ring lands 2 px further out, then closes in one step.
    const field = h_flex().h(32).px(10).items_center().border_1().border_color(t.input).bg(t.background).text_size(12).text_color(t.muted).child("Type a command…");
    const snap = v_flex().gap(6).child(ring(field, t, this.focused, this.m.running("snap")));
    const playSnap = (cx) => { this.focused = true; this.m.play("snap", [40], cx); };

    this.plays = { GLITCH: playGlitch, DISSOLVE: playDissolve, STEP: playStep, FEED: playFeed, "HARD CUT": playCut,
      AFTERSHOCK: toggleShocks, "BOOT LOG": playBoot, BUILD: playBuild, "FOCUS SNAP": playSnap };
    const panels = [
      panel("BUSY · SCAN · CURSOR", null, marks, "Endless marks, stepped natively."),
      panel("GLITCH", playGlitch, glitch, "Hover the text, or PLAY. At most 3 runs a second."),
      panel("DISSOLVE", playDissolve, dissolve, "Characters settle in random order, 300 ms."),
      panel("STEP", playStep, step, "Rows appear one by one, 28 ms apart."),
      panel("FEED", playFeed, feed, "A sheet comes up in 4 steps of 40 ms."),
      panel("HARD CUT", playCut, cut, "Two cuts to red with a tear, 400 ms."),
      panel("AFTERSHOCK", toggleShocks, shockPanel, "A new kind every 1.4–5.2 s, some with an Emote."),
      panel("BOOT LOG", playBoot, boot, "Types once per session, ends at the cursor."),
      panel("BUILD", playBuild, build, "Frame source, cut, then each part."),
      panel("FOCUS SNAP", playSnap, snap, "Lands 2 px out, closes in one 40 ms step."),
    ];
    const labels = ["BUSY · SCAN · CURSOR", "GLITCH", "DISSOLVE", "STEP", "FEED", "HARD CUT", "AFTERSHOCK", "BOOT LOG", "BUILD", "FOCUS SNAP"];
    const solo = this.only ? panels[labels.indexOf(this.only)] : null;
    const grid = v_flex().flex_1().min_h(0).overflow_y_scrollbar().p(18).gap(12)
      .when(Boolean(solo), (el) => el.child(h_flex().w(560).child(solo)))
      .when(!solo, (el) => el
        .child(row2(panels[0], panels[1]))
        .child(row2(panels[2], panels[3]))
        .child(row2(panels[4], panels[5]))
        .child(row2(panels[6], panels[7]))
        .child(row2(panels[8], panels[9])));

    return v_flex()
      .id("g-specimen")
      .track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { this.close(); cx.stop_propagation(); } })
      .size_full()
      .min_h(0)
      .bg(t.popover)
      .border_1()
      .border_color(t.border)
      .text_color(t.foreground)
      .child(h_flex().px(18).py(14).items_center().gap(12).border_b(1).border_color(t.border)
        .child(div().flex_1().text_size(15).font_medium().child("Motion specimen"))
        .child(div().id("slow").px(8).h(24).flex().items_center().border_1().text_size(11).cursor_pointer()
          .border_color(this.slow ? t.foreground : t.input).bg(this.slow ? t.foreground : t.popover).text_color(this.slow ? t.background : t.foreground)
          .on_click((_e, cx) => this.setSlow(!this.slow, cx)).child(this.slow ? "SLOW ×4" : "SPEED ×1"))
        .child(div().id("sp-esc").px(6).py(2).text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.close()).child("ESC")))
      .when(off, (el) => el.child(div().px(18).py(8).text_size(11.5).text_color(t.working).child("macOS Reduce motion is on: every effect holds still, as the system asks.")))
      .child(grid);
  }
}
