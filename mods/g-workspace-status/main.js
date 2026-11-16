import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys } from "herdr";
import { Motion, cursor } from "./motion.js";

// The Boot log runs once per app session, not on each reload of the bar.
let booted = false;

export default class WorkspaceStatus extends View {
  // Boot log: once per session the bar types what the window holds, ends at
  // the cursor, which blinks five times; then the bar cuts to its status.
  init(_props, cx) {
    this.m = new Motion();
    if (booted) return;
    booted = true;
    // At a cold start the spaces arrive a moment after the bar: wait for
    // them (at most 1.5 s), so the log never types "0 spaces".
    let waited = 0;
    const start = (c) => {
      if (!spaces().length && waited < 1500) { waited += 100; c.timer.after(100, (c2) => start(c2 ?? c)); return; }
      const list = agents();
      const lines = [`herdr ${spaces().length} ${spaces().length === 1 ? "space" : "spaces"}`, `${list.length} ${list.length === 1 ? "agent" : "agents"}`, this.hint(theme())];
      this.bootText = lines.join("  ·  ");
      this.m.boot("boot", lines, c);
    };
    start(cx);
  }

  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = (keys().find((k) => k.section === "layout:goksen" && k.action === "mod.open:g-palette") ?? keys().find((k) => k.section === "global" && k.action === "app.palette"));
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    const typing = this.m.running("boot") || this.m.running("boot:cursor");
    if (typing) {
      const text = this.m.running("boot") ? this.m.text("boot", "") : this.bootText;
      return h_flex().size_full().px(14).gap(2).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
        .child(div().child(text)).child(cursor(t, this.m.running("boot:cursor")));
    }
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/g-workspace-chrome/${icon}.svg`).size(13)).child(text);
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .child(h_flex().gap(6).items_center().child(div().size(6).rounded(0).bg(t.dim)).child(`${list.length} ${list.length === 1 ? "agent" : "agents"}`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().flex_1())
      .child(div().id("palette").text_color(t.dim).on_hover((h, cx) => { if (h) this.m.glitch("hint", this.hint(t), cx); }).on_click(() => run("mod.open", { name: "g-palette" })).child(this.m.text("hint", this.hint(t))));
  }
}
