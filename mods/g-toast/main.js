// How notifications look. Anything can post one with notify({ title, body,
// level, icon, action }); replace this mod to restyle them all. Click to
// run its action (e.g. go to the agent) and dismiss it.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, settings } from "herdr";
import { Motion, cutStyle } from "./motion.js";

const DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };

export default class Toast extends View {
  // Feed: the toast comes up from the bottom edge in four steps; its title
  // dissolves in; an error toast is a Fault and makes a Hard cut after it.
  init(_props, cx) {
    this.m = new Motion();
    this.h = 0;
    const p = props() ?? {};
    this.m.feed("feed", cx);
    if (p.title) this.m.dissolve("title", p.title, cx);
    if (p.level === "error") cx.timer.after(200, (cx2) => this.m.cut("cut", cx2 ?? cx));
  }

  render(cx) {
    const t = theme();
    const off = this.m.feedOffset("feed");
    const zoom = settings().zoom ?? 1;
    return div().size_full().bg(t.popover).border_1().border_color(t.border).overflow_hidden()
      .on_size_change((size, cx) => { const h = size.height / zoom; if (Math.abs(h - this.h) > 1) { this.h = h; cx.notify(); } })
      .child(div().relative().size_full().top(Math.round(off * this.h)).when(off === 1 && !this.h, (el) => el.invisible()).child(this._render(cx)));
  }
  _render(cx) {
    const t = theme();
    const p = props() ?? {};
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    const row = h_flex()
      .id("toast")
      .size_full()
      .px(18)
      .gap(12)
      .items_center()
      .bg(t.popover)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(p.icon ? image(p.icon).w(18).h(18).flex_none() : div().size(8).rounded(0).flex_none().bg(t[DOT[p.level] ?? "accent"]))
      .child(
        v_flex()
          .flex_1()
          .overflow_hidden()
          .child(div().truncate().font_medium().text_size(13).text_color(t.foreground).child(login ? `${login[1]} needs a login: run` : this.m.text("title", p.title ?? "")))
          .when(!login && Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(t.muted).child(p.body ?? "")))
          .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().tooltip(command).text_size(12).text_color(t.muted).child(command))
            .child(div().id("toast-login-copy").flex_none().px(6).py(3).rounded(0).bg(t.raised)
              .text_size(12).text_color(t.foreground).cursor_pointer().hover(s => s.bg(t.hover))
              .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
              .child(this.copied ? "Copied" : "Copy")))),
      );
    return cutStyle(row, this.m.phase("cut"), t, this.h || 64);
  }
}
