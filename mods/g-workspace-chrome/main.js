import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout, exec } from "herdr";
import { Motion } from "./motion.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

export default class WorkspaceChrome extends View {
  // macOS Reduce motion, read once a minute and kept in shared "g.motion"
  // ("reduce" | "full") so every goksen mod holds its motion still the
  // same way the site does under prefers-reduced-motion.
  init(_props, cx) {
    this.m = new Motion();
    if (props()?.footer) return;
    cx.timer.after(200, (cx2) => this.m.dissolve("brand", "Herdr", cx2 ?? cx));
    const read = async () => {
      const r = await exec("defaults", ["read", "com.apple.Accessibility", "ReduceMotionEnabled"]).catch(() => null);
      const next = r && r.code === 0 && r.stdout.trim() === "1" ? "reduce" : "full";
      if (shared("g.motion") !== next) setShared("g.motion", next);
    };
    cx.spawn(read);
    cx.timer.every(60000, (cx2) => { cx2.spawn(read); });
  }
  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(0).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    if (props()?.footer) {
      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().rounded(0)
        .when(collapsed, el => el.relative().w(32).px(0).justify_center().tooltip(label))
        .text_color(dim ? t.dim : t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_hover((h, cx) => { if (h) this.m.glitch(`row-${id}`, label, cx); })
        .on_click(action).child(svg(`mods/g-workspace-chrome/${icon}.svg`).size(14))
        .when(!collapsed, el => el.child(this.m.text(`row-${id}`, label)));
      const ready = div().size(6).rounded(0).bg(t.accent);
      return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).px(8).pt(4).pb(8).text_size(13)
        .when(collapsed, el => el.px(0).items_center())
        .child(row("settings", "settings", "Settings", false, () => run("mod.open", { name: "g-settings" }))
          .when(Boolean(updates().app.ready), el => el.child(collapsed ? ready.absolute().top(5).right(6) : ready)))
        .child(row("machine", "plus", "Add machine", true, () => run("mod.open", { name: "g-machine-add" })));
    }
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(8).items_center().child(image("frame/welcome/herdr.png").size(20).rounded(0)).child(div().font_medium().text_color(t.foreground).child(this.m.text("brand", "Herdr")))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/g-workspace-chrome/search.svg").size(15), () => run("mod.open", { name: "g-picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/g-workspace-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
