// Opens g-prompt to rename the focused tab (F2 / Shift+F2 in the goksen layout),
// in place of Herdr's built-in rename prompt. Closes itself at once.

import { View, div } from "gpui-kit";
import { spaces, focused, props, closeOverlay, openOverlay, checking } from "herdr";

export default class Rename extends View {
  init() {
    const self = props()?.overlay;
    if (self) closeOverlay(self);
    if (checking()) return;
    const f = focused();
    const space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    const target = "tab" === "space" ? space : (space?.tabs ?? []).find((c) => c.id === f?.tab) ?? (space?.tabs ?? []).find((c) => c.active);
    if (!target) return;
    openOverlay({ frame: "none", mod: "g-prompt", kind: "dialog", width: 420, height: 240,
      props: { title: "rename tab", value: target.named ? target.name : "", command: { name: "tab.rename", args: { id: target.id } } } });
  }
  render() { return div(); }
}
