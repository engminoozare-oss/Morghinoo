#!/usr/bin/env python3
"""Generates the Morghinoo (مرغینو) chicken app icons.

Everything is drawn at 8x resolution with Pillow and then downsampled, which
gives us clean antialiased edges without needing an SVG rasteriser.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
S = 1024          # logical canvas
SS = 4            # supersampling factor
C = S * SS        # real canvas

CREAM      = (255, 249, 237)
CREAM_DARK = (240, 219, 184)
COMB       = (226, 63, 60)
COMB_DARK  = (196, 44, 44)
BEAK       = (247, 162, 38)
LEG        = (232, 140, 26)
INK        = (58, 40, 25)
BG_TOP     = (255, 197, 87)
BG_BOTTOM  = (240, 138, 40)


def px(v):
    """fraction of canvas -> supersampled pixels"""
    return v * C


def box(cx, cy, w, h):
    """centre + size (fractions) -> bounding box in supersampled pixels"""
    return [px(cx - w / 2), px(cy - h / 2), px(cx + w / 2), px(cy + h / 2)]


def gradient_background(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        d.point((0, y), fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((size, size), Image.NEAREST)


def draw_hen(d, shift_y=0.0, scale=1.0):
    """Draws a plump hen facing right. Coordinates are canvas fractions."""
    def b(cx, cy, w, h):
        cx = 0.5 + (cx - 0.5) * scale
        cy = 0.5 + (cy - 0.5) * scale + shift_y
        return box(cx, cy, w * scale, h * scale)

    def p(cx, cy):
        return (px(0.5 + (cx - 0.5) * scale), px(0.5 + (cy - 0.5) * scale + shift_y))

    # tail feathers (behind the body)
    d.ellipse(b(0.255, 0.470, 0.30, 0.150), fill=CREAM_DARK)
    d.ellipse(b(0.245, 0.545, 0.31, 0.140), fill=CREAM)
    d.ellipse(b(0.275, 0.625, 0.28, 0.135), fill=CREAM_DARK)

    # legs
    lw = int(px(0.028 * scale))
    for lx in (0.470, 0.590):
        d.line([p(lx, 0.760), p(lx, 0.870)], fill=LEG, width=lw)
        d.line([p(lx - 0.045, 0.870), p(lx + 0.045, 0.870)], fill=LEG, width=lw)
        d.line([p(lx, 0.870), p(lx + 0.012, 0.895)], fill=LEG, width=lw)

    # body
    d.ellipse(b(0.520, 0.610, 0.520, 0.430), fill=CREAM)
    # wing
    d.ellipse(b(0.505, 0.625, 0.300, 0.215), fill=CREAM_DARK)
    d.ellipse(b(0.545, 0.605, 0.190, 0.130), fill=CREAM)

    # neck + head
    d.ellipse(b(0.640, 0.455, 0.260, 0.290), fill=CREAM)
    d.ellipse(b(0.690, 0.360, 0.245, 0.245), fill=CREAM)

    # comb (three bumps)
    d.ellipse(b(0.640, 0.238, 0.105, 0.115), fill=COMB)
    d.ellipse(b(0.710, 0.210, 0.115, 0.130), fill=COMB)
    d.ellipse(b(0.780, 0.245, 0.100, 0.110), fill=COMB_DARK)

    # beak
    d.polygon([p(0.795, 0.360), p(0.905, 0.395), p(0.795, 0.425)], fill=BEAK)
    # wattle
    d.ellipse(b(0.795, 0.455, 0.075, 0.105), fill=COMB)

    # eye
    d.ellipse(b(0.738, 0.335, 0.062, 0.062), fill=INK)
    d.ellipse(b(0.752, 0.320, 0.022, 0.022), fill=(255, 255, 255))


def render(rounded=True, radius=0.22, pad=0.0):
    """pad>0 shrinks the hen for maskable safe-zone compliance."""
    bg = gradient_background(C, BG_TOP, BG_BOTTOM).convert("RGBA")
    d = ImageDraw.Draw(bg)
    draw_hen(d, shift_y=0.01, scale=1.0 - pad)

    if rounded:
        mask = Image.new("L", (C, C), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, C - 1, C - 1], radius=int(C * radius), fill=255)
        bg.putalpha(mask)
    return bg.resize((S, S), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    rounded = render(rounded=True)
    square = render(rounded=False, pad=0.30)          # maskable: full bleed + safe zone

    for name, img, sizes in (
        ("icon", rounded, [192, 256, 512]),
        ("icon-maskable", square, [192, 512]),
        ("apple-touch-icon", render(rounded=False), [180]),
    ):
        for s in sizes:
            path = os.path.join(OUT, f"{name}-{s}.png")
            img.resize((s, s), Image.LANCZOS).save(path, optimize=True)
            print("wrote", os.path.normpath(path))

    fav = rounded.resize((64, 64), Image.LANCZOS)
    fav.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    rounded.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "preview.png"))
    print("wrote favicon.ico + preview.png")


if __name__ == "__main__":
    main()
