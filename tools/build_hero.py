#!/usr/bin/env python3
"""The landing visual: two of the team's own photographs joined into one
landscape frame, the lab on the left and the market booth on the right, with a
feathered seam where they meet. Scaled and cropped only; nothing inside either
photograph is altered."""
import subprocess, pathlib
SRC = pathlib.Path("/Users/timmylin/Documents/Claude/Projects/Releaf_Wiki/wiki/human-practices")
OUT = pathlib.Path(__file__).resolve().parents[1] / "assets/img/human-practices"
TMP = pathlib.Path("/private/tmp/claude-501/-Users-timmylin-Documents-Claude-Projects-Releaf-Wiki/c7a26da6-cf6f-486b-a940-3c1ea9a09570/scratchpad")

W, H = 2400, 1000        # the finished frame
PANEL = 1400             # each photograph is cropped to this width
SEAM = 140               # how much of the right panel is feathered over the left
LEFT_X = 0
RIGHT_X = W - PANEL

def run(*a): subprocess.run([str(x) for x in a], check=True)

# 1. crop each photograph to the panel size
run("magick", SRC / "1stVisual1.png", "-auto-orient", "-resize", "%dx%d^" % (PANEL, H),
    "-gravity", "center", "-extent", "%dx%d" % (PANEL, H), TMP / "hero-left.png")
run("magick", SRC / "1stVisual2.jpg", "-auto-orient", "-resize", "%dx%d^" % (PANEL, H),
    "-gravity", "east", "-extent", "%dx%d" % (PANEL, H), TMP / "hero-right.png")

# 2. a left-to-right alpha ramp across the seam, opaque for the rest
run("magick", "-size", "%dx%d" % (H, SEAM), "gradient:black-white", "-rotate", "90",
    TMP / "ramp.png")
run("magick", TMP / "ramp.png", "-gravity", "west",
    "-background", "white", "-extent", "%dx%d" % (PANEL, H), TMP / "mask.png")
run("magick", TMP / "hero-right.png", TMP / "mask.png",
    "-alpha", "off", "-compose", "CopyOpacity", "-composite", TMP / "hero-right-a.png")

# 3. lay the right panel over the left one, and darken the join a little so the
#    seam reads as a deliberate fold rather than as two photographs bleeding
run("magick", "-size", "%dx%d" % (W, H), "xc:#0c231a",
    TMP / "hero-left.png", "-geometry", "+%d+0" % LEFT_X, "-composite",
    TMP / "hero-right-a.png", "-geometry", "+%d+0" % RIGHT_X, "-composite",
    TMP / "hero-joined.png")
run("magick", "-size", "%dx%d" % (H, SEAM), "gradient:black-none", "-rotate", "90",
    TMP / "fold-a.png")
run("magick", TMP / "fold-a.png", "-flop", TMP / "fold-b.png")
run("magick", TMP / "fold-a.png", TMP / "fold-b.png", "+append", TMP / "fold.png")
run("magick", TMP / "hero-joined.png",
    "(", TMP / "fold.png", "-alpha", "on", "-channel", "A", "-evaluate", "multiply", "0.30", "+channel", ")",
    "-geometry", "+%d+0" % (RIGHT_X - SEAM // 2), "-composite", TMP / "hero-full.png")

# 4. the two sizes the page asks for
for width in (2400, 1400):
    png = TMP / ("hero-%d.png" % width)
    run("magick", TMP / "hero-full.png", "-resize", "%dx" % width, "-strip", png)
    run("cwebp", "-quiet", "-q", "84", png, "-o", OUT / ("hero-ihp-%d.webp" % width))
run("magick", TMP / "hero-1400.png", "-quality", "82", "-strip", OUT / "hero-ihp-1400.jpg")
print("hero done")
