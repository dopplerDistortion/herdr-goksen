// The command palette in the goksen.ing look: every app command that runs
// without arguments, every keybind (with its argument), each layout and
// theme. Type to filter, ↑/↓ and Enter to run, Esc to leave. The last five
// runs come first, kept in shared "g-palette.recent".

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { commands, keys, layouts, run, props, closeOverlay, openOverlay, spaces, theme, shared, setShared, exec, appHome } from "herdr";
import { Motion, ring } from "./motion.js";

const ROW = 32;
const HEAD = 28;
const MAX_LIST = 420;

const GROUPS = [
  ["space", "SPACE"], ["tab", "TAB"], ["pane", "PANE"], ["agent", "AGENT"],
  ["terminal", "TERMINAL"], ["layout", "LAYOUT"], ["theme", "THEME"], ["app", "APP"],
];

// "tab.new" reads "New tab", "pane.split" + "right" reads "Split pane right".
const NOUNS = ["space", "tab", "pane", "agent", "terminal", "window"];
function title(name, arg) {
  const [head, verb = name] = name.split(".");
  const words = verb.replace(/_/g, " ");
  const text = (NOUNS.includes(head) ? `${words} ${head}` : words);
  const cap = text.charAt(0).toUpperCase() + text.slice(1);
  return arg !== undefined && arg !== "" ? `${cap} ${arg}` : cap;
}

// These open Herdr's own dialogs; the palette offers the restyled ones instead.
const ROUTED = new Set(["tab.rename", "space.rename", "space.close", "app.settings"]);

function group(name) {
  const head = name.split(".")[0];
  return GROUPS.some(([g]) => g === head) ? head : "app";
}

function bound(ks, action) {
  // The layout's own bind wins over the global one, as keys.json does.
  const all = ks.filter((k) => k.action === action && (k.section === "global" || k.section === "layout:goksen"));
  const k = all.find((b) => b.section === "layout:goksen") ?? all[0];
  return k ? k.keys : "";
}

export default class Palette extends View {
  init(_props, cx) {
    this.m = new Motion();
    this.m.play("snap", [40], cx);
    this.filter = "";
    this.at = 0;
    this.scroll = 0;
    this.themes = [];
    this.input = InputState.new({ placeholder: "Type a command…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroll = 0; cx.notify(); });
    this.input.on("submit", () => this.choose((this.last ?? []).filter((r) => r.kind === "cmd")[this.at]));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
    // Step the rows the list shows at once.
    this.m.step("rows", Math.min(this.rows().length, Math.ceil(MAX_LIST / ROW)), cx);
    cx.spawn(async (cx) => {
      const listed = await exec("ls", [`${appHome()}/themes`]).catch(() => null);
      const files = (listed?.stdout ?? "").split("\n").filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)).filter((n) => !layouts().includes(n));
      this.themes = ["goksen-ing", "graphite", "ink", "moss", "paper", ...files]
        .filter((v, i, a) => a.indexOf(v) === i);
      cx.notify();
    });
  }

  items() {
    const ks = keys();
    const cmds = commands();
    const out = [];
    const seen = new Set();
    const add = (label, name, args, keyAction) => {
      const id = name + JSON.stringify(args);
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ kind: "cmd", id, label, name, args, group: group(name), key: bound(ks, keyAction ?? name) });
    };
    for (const k of ks) {
      if (k.section !== "global" && k.section !== "layout:goksen") continue;
      if (k.action.startsWith("send:") || k.action === "terminal") continue;
      const [name, arg] = k.action.split(":");
      if (name === "mod.open" || ROUTED.has(name)) continue;
      const c = cmds.find((c) => c.name === name);
      if (!c) continue;
      const first = c.args[0]?.name;
      add(title(name, arg), name, arg !== undefined && first ? { [first]: arg } : {}, k.action);
    }
    for (const c of cmds) {
      if (c.args.some((a) => a.required)) continue;
      if (c.name.startsWith("mod.") || c.name === "app.palette" || c.name === "app.help" || ROUTED.has(c.name)) continue;
      add(title(c.name), c.name, {});
    }
    add("Go to space or tab…", "mod.open", { name: "g-picker" }, "mod.open:g-picker");
    add("Keybinds", "mod.open", { name: "g-help" }, "mod.open:g-help");
    add("Rename tab", "mod.open", { name: "g-rename-tab" }, "mod.open:g-rename-tab");
    add("Rename space", "mod.open", { name: "g-rename-space" }, "mod.open:g-rename-space");
    add("Close space", "g:close-space", {});
    add("Settings", "mod.open", { name: "g-settings" }, "mod.open:g-settings");
    add("Motion specimen", "mod.open", { name: "g-specimen" });
    for (const l of layouts()) add(`Layout: ${l}`, "layout.switch", { name: l });
    for (const th of this.themes) add(`Theme: ${th}`, "app.theme", { name: th });
    for (const o of out) if (o.name === "mod.open") o.group = "app";
    for (const o of out) if (o.name === "g:close-space") o.group = "space";
    for (const o of out) if (o.name === "app.theme") o.group = "theme";
    return out;
  }

  rows() {
    const f = this.filter.trim().toLowerCase();
    const all = this.items().filter((r) => !f || r.label.toLowerCase().includes(f) || r.name.includes(f) || r.key.includes(f));
    const rows = [];
    const recent = (shared("g-palette.recent") ?? []).map((id) => all.find((r) => r.id === id)).filter(Boolean);
    if (!f && recent.length) {
      rows.push({ kind: "head", label: "RECENT" });
      recent.forEach((r) => rows.push({ ...r, recent: true }));
    }
    for (const [g, label] of GROUPS) {
      const inG = all.filter((r) => r.group === g && !(!f && recent.some((x) => x.id === r.id)));
      if (!inG.length) continue;
      rows.push({ kind: "head", label });
      inG.forEach((r) => rows.push(r));
    }
    return rows;
  }

  choose(r) {
    if (!r) return;
    const recent = [r.id, ...(shared("g-palette.recent") ?? []).filter((id) => id !== r.id)].slice(0, 5);
    setShared("g-palette.recent", recent);
    closeOverlay(props()?.overlay);
    if (r.name === "g:close-space") {
      const space = spaces().find((s) => s.active);
      if (space) openOverlay({ frame: "none", mod: "g-confirm", kind: "dialog", width: 420, height: 190, props: { title: `Close ${space.name}?`, detail: "Its terminals end.", command: { name: "space.close", args: { id: space.id, confirmed: true } } } });
      return;
    }
    run(r.name, r.args);
  }

  key(e, cx, picks) {
    const k = e.key;
    if (k === "escape") { closeOverlay(props()?.overlay); cx.stop_propagation(); return; }
    if (!picks.length) return;
    if (k === "down") this.at = (this.at + 1) % picks.length;
    else if (k === "up") this.at = (this.at + picks.length - 1) % picks.length;
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render(cx) {
    const t = theme();
    const rows = this.rows();
    this.last = rows;
    const picks = rows.filter((r) => r.kind === "cmd");
    this.at = Math.min(this.at, Math.max(0, picks.length - 1));
    const sel = picks[this.at];

    const tops = [];
    let y = 0;
    rows.forEach((r) => { tops.push(y); y += r.kind === "head" ? HEAD : ROW; });
    const total = y;
    const height = Math.min(MAX_LIST, total);
    const maxScroll = Math.max(0, total - height);
    const si = rows.indexOf(sel);
    if (si >= 0) {
      if (tops[si] < this.scroll) this.scroll = tops[si];
      if (tops[si] + ROW > this.scroll + height) this.scroll = tops[si] + ROW - height;
    }
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));

    const row = (r, i) => {
      const top = tops[i] - this.scroll;
      const h = r.kind === "head" ? HEAD : ROW;
      if (top + h <= 0 || top >= height) return null;
      const base = div().absolute().left(0).right(0).top(top).h(h).when(!this.m.shown("rows", i), (el) => el.invisible());
      if (r.kind === "head") {
        return base.flex().items_end().px(10).pb(6).text_size(11).text_color(t.muted).child(r.label);
      }
      const on = r === sel;
      return base
        .id(`pl-${i}`)
        .flex()
        .items_center()
        .px(10)
        .gap(10)
        .cursor_pointer()
        .when(on, (el) => el.bg(t.foreground).text_color(t.background))
        .when(!on, (el) => el.text_color(t.foreground).hover((s) => s.bg(t.hover)))
        .on_mouse_move((_e, cx) => { if (this.at !== picks.indexOf(r)) { this.at = picks.indexOf(r); cx.notify(); } })
        .on_click(() => this.choose(r))
        .child(div().flex_1().truncate().child(r.label))
        .when(Boolean(r.key), (el) => el.child(div().flex_none().text_size(11).text_color(on ? t.background : t.muted).child(r.key)));
    };

    return v_flex()
      .id("g-palette")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx, picks))
      .size_full()
      .min_h(0)
      .p(14)
      .gap(10)
      .bg(t.popover)
      .border_1()
      .border_color(t.border)
      .text_size(12.5)
      .child(ring(
        h_flex().h(36).flex_none().px(10).gap(8).items_center().border_1().border_color(t.input).bg(t.background)
          .child(div().text_color(t.muted).child(">"))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground))
          .child(div().text_size(11).text_color(t.muted).child("ESC")),
      t, true, this.m.running("snap")))
      .child(
        div()
          .id("pl-list")
          .relative()
          .h(height)
          .flex_none()
          .overflow_hidden()
          .on_scroll_wheel((e, cx) => {
            this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
            cx.notify();
          })
          .children(rows.map(row).filter(Boolean)),
      )
      .when(!picks.length, (el) => el.child(div().px(10).text_color(t.muted).child("No command matches.")));
  }
}
