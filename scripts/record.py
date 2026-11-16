#!/usr/bin/env python3
"""Records a part of the Herdr window as a GIF, for the docs.

  record.py shoot <dir> <ms>                    shots of the window for <ms>
  record.py gif <dir> <x,y,w,h> <out.gif> [speed] [width] [hold_ms] [from_ms] [to_ms]

`shoot` runs `herdr-app shot` back to back (about 30 to 40 a second) and keeps each
frame's time. `gif` scales every frame to 1660 px wide (shots come at 1x or 2x),
crops it to x,y,w,h, drops
frames that did not change, and plays the rest `speed` times faster than
recorded, between `from_ms` and `to_ms`. Record with shared "g.motion.scale" at 4, give speed 4, and every
step keeps its real length. Needs ffmpeg.
"""
import hashlib, json, os, subprocess, sys, time


def shoot(out, ms):
    os.makedirs(out, exist_ok=True)
    times, start, i = [], time.monotonic(), 0
    while (now := time.monotonic()) - start < ms / 1000:
        path = os.path.join(out, f"f{i:04d}.png")
        subprocess.run(["herdr-app", "shot", path], check=True, capture_output=True)
        times.append(now - start)
        i += 1
    times.append(time.monotonic() - start)
    json.dump(times, open(os.path.join(out, "times.json"), "w"))
    print(f"{i} frames in {times[-1]:.1f}s")


def gif(src, box, out, speed=1.0, width=640, hold=0, start=0, stop=None):
    x, y, w, h = box
    crop = os.path.join(src, "crop")
    os.makedirs(crop, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(src, "f%04d.png"),
                    "-vf", f"scale=1660:-1:flags=area,crop={w}:{h}:{x}:{y}", os.path.join(crop, "c%04d.png")], check=True)
    times = json.load(open(os.path.join(src, "times.json")))
    frames = sorted(f for f in os.listdir(crop) if f.endswith(".png"))
    kept, last = [], None
    for i, f in enumerate(frames):
        if times[i] < start / 1000 or (stop is not None and times[i] > stop / 1000):
            continue
        digest = hashlib.md5(open(os.path.join(crop, f), "rb").read()).hexdigest()
        if digest != last:
            kept.append([f, times[i]])
            last = digest
    lines = []
    for n, (f, t) in enumerate(kept):
        end = kept[n + 1][1] if n + 1 < len(kept) else (stop / 1000 if stop is not None else times[-1])
        d = max((end - t) / speed, 0.02)
        if n + 1 == len(kept):
            d += hold / 1000
        lines += [f"file '{os.path.join(crop, f)}'", f"duration {d:.3f}"]
    lines.append(f"file '{os.path.join(crop, kept[-1][0])}'")
    listing = os.path.join(src, "list.txt")
    open(listing, "w").write("\n".join(lines) + "\n")
    graph = (f"scale={width}:-1:flags=lanczos,split[a][b];"
             "[a]palettegen=max_colors=32:stats_mode=full[p];[b][p]paletteuse=dither=none")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing,
                    "-filter_complex", graph, "-fps_mode", "vfr", "-loop", "0", out], check=True)
    print(f"{out}: {len(kept)} of {len(frames)} frames, {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    cmd, *a = sys.argv[1:]
    if cmd == "shoot":
        shoot(a[0], int(a[1]))
    else:
        box = [int(v) for v in a[1].split(",")]
        gif(a[0], box, a[2], float(a[3]) if len(a) > 3 else 1.0,
            int(a[4]) if len(a) > 4 else 640, int(a[5]) if len(a) > 5 else 0,
            int(a[6]) if len(a) > 6 else 0, int(a[7]) if len(a) > 7 else None)
