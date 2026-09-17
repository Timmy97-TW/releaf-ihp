#!/usr/bin/env python3
"""Square avatar crops of the people we met. Scaled and cropped only."""
import subprocess, pathlib, sys
S = pathlib.Path("/private/tmp/claude-501/-Users-timmylin-Documents-Claude-Projects-Releaf-Wiki/c7a26da6-cf6f-486b-a940-3c1ea9a09570/scratchpad/faces")
OUT = pathlib.Path(__file__).resolve().parents[1] / "assets/img/human-practices"
# slug: (file, x0, y0, x1, y1) as fractions of the source
F = {
 "face-lin":       ("lin.png",       .647, .020, .762, .330),
 "face-brophy":    ("brophy.png",    .645, .030, .800, .245),
 "face-sattely":   ("sattely.png",   .8176,.132, .9031,.215),
 "face-endy":      ("endy.png",      .800, .415, .980, .545),
 "face-worldveg":  ("worldveg.png",  .720, .050, .980, .330),
 "face-cheng":     ("cheng.jpg",     .255, .195, .385, .420),
 "face-chen":      ("chen.jpg",      .340, .260, .560, .660),
 "face-chang":     ("chang.jpg",     .440, .340, .525, .600),
 "face-mschen":    ("mschen.jpg",    .150, .200, .390, .560),
 "face-kyle":      ("kyle.jpg",      .330, .340, .470, .550),
 "face-huang":     ("huang.jpg",     .740, .220, .880, .480),
 "face-yeshealth": ("yeshealth.jpg", .395, .470, .465, .600),
}
def run(slug, f, x0, y0, x1, y1, size=360):
    src = S / f
    w, h = map(int, subprocess.run(["magick", str(src), "-auto-orient", "-format", "%w %h", "info:"],
                                   capture_output=True, text=True).stdout.split())
    bx, by = x0 * w, y0 * h
    bw, bh = (x1 - x0) * w, (y1 - y0) * h
    side = max(bw, bh)
    cx, cy = bx + bw / 2, by + bh / 2
    x = max(0, min(w - side, cx - side / 2))
    y = max(0, min(h - side, cy - side / 2))
    tmp = OUT / (slug + ".tmp.png")
    subprocess.run(["magick", str(src), "-auto-orient", "-crop", "%dx%d+%d+%d" % (side, side, x, y), "+repage",
                    "-resize", "%dx%d^" % (size, size), "-gravity", "center",
                    "-extent", "%dx%d" % (size, size), "-strip", str(tmp)], check=True)
    subprocess.run(["cwebp", "-quiet", "-q", "82", str(tmp), "-o", str(OUT / (slug + ".webp"))], check=True)
    tmp.unlink()
for slug, args in F.items():
    if not (S / args[0]).exists():
        print("MISSING", args[0], file=sys.stderr); continue
    run(slug, *args)
print("faces done")
