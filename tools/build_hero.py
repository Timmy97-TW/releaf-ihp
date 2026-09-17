#!/usr/bin/env python3
"""The landing visual: two of the team's own photographs side by side in one
landscape frame, the lab on the left and the market booth on the right, with a
straight cut between them. Scaled and cropped only; nothing inside either
photograph is altered."""
import subprocess, pathlib
SRC = pathlib.Path("/Users/timmylin/Documents/Claude/Projects/Releaf_Wiki/wiki/human-practices")
OUT = pathlib.Path(__file__).resolve().parents[1] / "assets/img/human-practices"
TMP = pathlib.Path("/private/tmp/claude-501/-Users-timmylin-Documents-Claude-Projects-Releaf-Wiki/c7a26da6-cf6f-486b-a940-3c1ea9a09570/scratchpad")

W, H = 2400, 1000     # the finished frame
GAP = 6               # a white line between the two photographs
PANEL = (W - GAP) // 2

def run(*a): subprocess.run([str(x) for x in a], check=True)

run("magick", SRC / "1stVisual1.png", "-auto-orient", "-resize", "%dx%d^" % (PANEL, H),
    "-gravity", "center", "-extent", "%dx%d" % (PANEL, H), TMP / "hero-left.png")
run("magick", SRC / "1stVisual2.jpg", "-auto-orient", "-resize", "%dx%d^" % (PANEL, H),
    "-gravity", "center", "-extent", "%dx%d" % (PANEL, H), TMP / "hero-right.png")
run("magick", "-size", "%dx%d" % (W, H), "xc:white",
    TMP / "hero-left.png", "-geometry", "+0+0", "-composite",
    TMP / "hero-right.png", "-geometry", "+%d+0" % (PANEL + GAP), "-composite",
    TMP / "hero-full.png")
for width in (2400, 1400):
    png = TMP / ("hero-%d.png" % width)
    run("magick", TMP / "hero-full.png", "-resize", "%dx" % width, "-strip", png)
    run("cwebp", "-quiet", "-q", "84", png, "-o", OUT / ("hero-ihp-%d.webp" % width))
run("magick", TMP / "hero-1400.png", "-quality", "82", "-strip", OUT / "hero-ihp-1400.jpg")
print("hero done")
