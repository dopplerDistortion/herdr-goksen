// Settings in the goksen.ing look: the layout, the theme and the zoom, all
// through app commands. Machines, keyboard, alerts, updates and privacy stay
// in Herdr's own settings, one click away ("All settings").

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { layouts, layout, settings, run, props, closeOverlay, theme, exec, appHome, shared } from "herdr";
import { Motion } from "./motion.js";

const BUILT_IN = ["goksen-ing", "graphite", "ink", "moss", "paper"];

// Build runs on the first open of a session only; later opens show at once.
let built = false;

export default class Settings extends View {
  init(_props, cx) {
    this.m = new Motion();
    this.m.dissolve("title", "Settings", cx);
    this.started = false;
    this.themes = BUILT_IN;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      const listed = await exec("ls", [`${appHome()}/themes`]).catch(() => null);
      const files = (listed?.stdout ?? "").split("\n").filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)).filter((n) => !layouts().includes(n));
      this.themes = [...BUILT_IN, ...files].filter((v, i, a) => a.indexOf(v) === i);
      cx.notify();
    });
  }

  close() {
    const id = props()?.overlay;
    if (id) closeOverlay(id);
  }

  // Build: the first render starts it, once the parts and their sources are known.
  sources(themes, zoom) {
    const sel = (on) => (on ? ' aria-pressed="true"' : "");
    const current = shared("layout");
    return [
      ['<section class="panel" id="g-settings">', '  <header>Settings</header>', '  <div id="layout">…</div>', '  <div id="theme">…</div>', '  <div id="zoom">…</div>', '  <footer>…</footer>', "</section>"],
      ['<div id="layout">', "  <label>LAYOUT</label>", ...layouts().map((l) => `  <button${sel(l === current)}>${l}</button>`), "</div>"],
      ['<div id="theme">', "  <label>THEME</label>", ...themes.map((th) => `  <button>${th}</button>`), "</div>"],
      ['<div id="zoom">', "  <label>ZOOM</label>", "  <button>−</button>", `  <span>${zoom}%</span>`, "  <button>+</button>", "  <button>Reset</button>", "</div>"],
      ["<footer>", "  <button>All settings</button>", '  <button class="primary">Done</button>', "</footer>"],
    ];
  }

  render(cx) {
    const t = theme();
    const current = shared("layout");
    const root = layout() ?? {};
    const shownTheme = typeof root.theme === "string" ? root.theme : root.theme?.dark;
    const zoom = Math.round((settings().zoom ?? 1) * 100);

    const label = (text) => div().pt(14).pb(6).text_size(11).text_color(t.muted).child(text);
    const choice = (id, text, on, action) => h_flex().id(id).h(30).px(10).items_center().cursor_pointer()
      .when(on, (el) => el.bg(t.foreground).text_color(t.background))
      .when(!on, (el) => el.text_color(t.foreground).hover((s) => s.bg(t.hover)))
      .on_click(action)
      .child(div().flex_1().child(text))
      .when(on, (el) => el.child(div().text_size(11).child("ON")));
    if (!this.started) {
      this.started = true;
      if (built) return this.render(cx);
      built = true;
      const sources = this.sources(this.themes, zoom);
      // Hidden until the build's first step, so the finished dialog never flashes first.
      this.waiting = true;
      cx.timer.after(1, (cx2) => { this.waiting = false; this.m.build("build", sources, cx2 ?? cx); });
    }
    // A part shows its source while it writes, hides until its turn, and
    // shows itself once built. Part 0 is the frame.
    const b = this.m.building("build");
    const layer = (lines, pad) => div().absolute().top(0).left(0).right(0).bottom(0).bg(t.popover).px(pad[0]).py(pad[1])
      .flex().flex_col().text_size(11).text_color(t.muted).children(lines.map((l) => div().child(l.replace(/ /g, "\u00a0"))));
    const part = (n, el) => div().relative().child(el.when(Boolean(b) && b.part <= n, (x) => x.invisible()))
      .when(Boolean(b) && b.part === n, (x) => x.child(layer(b.lines, [8, 4])))
      .when(Boolean(b) && b.part < n, (x) => x.invisible());
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(12).items_center().cursor_pointer()
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.background)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12).font_medium()
      .hover((s) => s.bg(primary ? t.ansi2 : t.raised))
      .on_click(action).child(text);

    const body = v_flex()
      .id("g-settings")
      .track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { this.close(); cx.stop_propagation(); } })
      .size_full()
      .min_h(0)
      .p(18)
      .bg(t.popover)
      .border_1()
      .border_color(t.border)
      .text_size(12.5)
      .text_color(t.foreground)
      .child(h_flex().items_center().when(b?.part === 0, (x) => x.invisible())
        .child(div().flex_1().text_size(15).font_medium().child(this.m.text("title", "Settings")))
        .child(div().id("st-esc").px(6).py(2).text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.close()).child("ESC")))
      .child(div().mt(12).h(1).bg(t.border))
      .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar()
        .child(part(1, v_flex().child(label("LAYOUT"))
          .children(layouts().map((l) => choice(`st-layout-${l}`, l, l === current, () => run("layout.switch", { name: l }))))))
        .child(part(2, v_flex().child(label("THEME"))
          .children(this.themes.map((th) => choice(`st-theme-${th}`, th, th === shownTheme, () => run("app.theme", { name: th }))))))
        .child(part(3, v_flex().child(label("ZOOM"))
          .child(h_flex().gap(8).items_center()
            .child(button("st-zoom-out", "−", false, () => run("app.zoom_out")))
            .child(div().w(48).child(`${zoom}%`))
            .child(button("st-zoom-in", "+", false, () => run("app.zoom_in")))
            .child(button("st-zoom-reset", "Reset", false, () => run("app.zoom_reset")))))))
      .child(div().h(1).bg(t.border))
      .child(part(4, h_flex().pt(14).gap(8).justify_end()
        .child(button("st-all", "All settings", false, () => { this.close(); run("app.settings"); }))
        .child(button("st-done", "Done", true, () => this.close()))));
    // While the frame writes, its source covers the whole dialog.
    return div().relative().size_full().when(Boolean(this.waiting), (x) => x.invisible()).child(body)
      .when(b?.part === 0, (x) => x.child(layer(b.lines, [24, 12])));
  }
}
