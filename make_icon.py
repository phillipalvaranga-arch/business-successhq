#!/usr/bin/env python3
"""Draw a gold trophy and upward arrow on navy, in all required icon sizes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)

NAVY_TOP = (14, 36, 68)
NAVY_BOT = (7, 18, 36)
GOLD = (214, 174, 54)
GOLD_LT = (242, 216, 120)
GOLD_DK = (156, 114, 24)
GOLD_HI = (255, 240, 190)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def bg_gradient(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        r = lerp(NAVY_TOP[0], NAVY_BOT[0], t)
        g = lerp(NAVY_TOP[1], NAVY_BOT[1], t)
        b = lerp(NAVY_TOP[2], NAVY_BOT[2], t)
        for x in range(size):
            cx, cy = size * 0.48, size * 0.36
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / size
            k = max(0.0, 1.0 - d * 1.4)
            px[x, y] = (
                min(255, r + int(28 * k)),
                min(255, g + int(32 * k)),
                min(255, b + int(40 * k)),
                255,
            )
    return img


def shadow_circle(base, cx, cy, r, blur, alpha=90, offset=(0, 0)):
    s = base.size[0]
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ox, oy = offset
    d.ellipse((cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy), fill=(0, 0, 0, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base, layer)


def poly(d, pts, fill, outline=None, width=1):
    d.polygon(pts, fill=fill, outline=outline)
    if outline and width > 1:
        d.line(pts + [pts[0]], fill=outline, width=width, joint="curve")


def draw_trophy_and_arrow(d, s, inset=0.14):
    # Layout: trophy slightly left of center, bold upward arrow on the right.
    cx = s * 0.38
    top = s * inset
    bot = s * (1 - inset)
    h = bot - top

    # --- Trophy ---
    cup_top = top + h * 0.08
    cup_bot = top + h * 0.50
    rim_w = s * 0.28
    base_w = s * 0.13
    stem_w = s * 0.055
    stem_top = cup_bot
    stem_bot = top + h * 0.70
    plinth_top = stem_bot
    plinth_bot = top + h * 0.86

    # Cup body (flared bowl)
    cup = [
        (cx - rim_w, cup_top + h * 0.04),
        (cx - rim_w * 0.92, cup_top),
        (cx + rim_w * 0.92, cup_top),
        (cx + rim_w, cup_top + h * 0.04),
        (cx + base_w, cup_bot),
        (cx - base_w, cup_bot),
    ]
    # soft drop under trophy
    # drawn by caller on another layer if needed

    poly(d, cup, GOLD, GOLD_DK, max(1, s // 180))

    # Inner bowl (darker gold)
    inner_inset_x = rim_w * 0.16
    inner = [
        (cx - rim_w + inner_inset_x, cup_top + h * 0.07),
        (cx - rim_w * 0.78, cup_top + h * 0.035),
        (cx + rim_w * 0.78, cup_top + h * 0.035),
        (cx + rim_w - inner_inset_x, cup_top + h * 0.07),
        (cx + base_w * 0.72, cup_bot - h * 0.04),
        (cx - base_w * 0.72, cup_bot - h * 0.04),
    ]
    poly(d, inner, (196, 148, 36))

    # Highlight streak on left of cup
    hi = [
        (cx - rim_w * 0.78, cup_top + h * 0.06),
        (cx - rim_w * 0.55, cup_top + h * 0.055),
        (cx - base_w * 0.15, cup_bot - h * 0.05),
        (cx - base_w * 0.55, cup_bot - h * 0.05),
    ]
    poly(d, hi, GOLD_LT)

    # Rim
    rim_h = h * 0.055
    d.rounded_rectangle(
        (cx - rim_w - s * 0.01, cup_top - rim_h * 0.2, cx + rim_w + s * 0.01, cup_top + rim_h),
        radius=max(2, int(s * 0.02)),
        fill=GOLD_LT,
        outline=GOLD_DK,
        width=max(1, s // 200),
    )
    # rim shine
    d.arc(
        (cx - rim_w * 0.7, cup_top - rim_h * 0.05, cx + rim_w * 0.15, cup_top + rim_h * 0.7),
        start=200,
        end=340,
        fill=GOLD_HI,
        width=max(2, s // 90),
    )

    # Handles
    hw = max(3, int(s * 0.028))
    # left handle
    d.arc(
        (cx - rim_w - s * 0.11, cup_top + h * 0.02, cx - rim_w + s * 0.08, cup_bot - h * 0.02),
        start=70,
        end=290,
        fill=GOLD,
        width=hw,
    )
    d.arc(
        (cx - rim_w - s * 0.11 + 1, cup_top + h * 0.02, cx - rim_w + s * 0.08 + 1, cup_bot - h * 0.02),
        start=80,
        end=280,
        fill=GOLD_LT,
        width=max(1, hw // 3),
    )
    # right handle omitted so the upward arrow stays clear

    # Stem
    d.rounded_rectangle(
        (cx - stem_w, stem_top - 1, cx + stem_w, stem_bot + 1),
        radius=max(1, int(s * 0.01)),
        fill=GOLD,
        outline=GOLD_DK,
        width=max(1, s // 220),
    )
    # stem highlight
    d.rectangle(
        (cx - stem_w + 2, stem_top + 2, cx - stem_w * 0.25, stem_bot - 2),
        fill=GOLD_LT,
    )

    # Knop (small ring above plinth)
    knop_r = stem_w * 1.15
    ky = stem_bot - (stem_bot - stem_top) * 0.08
    d.ellipse((cx - knop_r, ky - knop_r * 0.55, cx + knop_r, ky + knop_r * 0.55), fill=GOLD_LT, outline=GOLD_DK)

    # Plinth / base (two steps)
    p1 = s * 0.13
    p2 = s * 0.18
    mid = (plinth_top + plinth_bot) / 2
    poly(
        d,
        [
            (cx - p1, plinth_top),
            (cx + p1, plinth_top),
            (cx + p1 * 1.08, mid),
            (cx - p1 * 1.08, mid),
        ],
        GOLD,
        GOLD_DK,
        max(1, s // 220),
    )
    d.rounded_rectangle(
        (cx - p2, mid - 1, cx + p2, plinth_bot),
        radius=max(2, int(s * 0.015)),
        fill=GOLD_LT,
        outline=GOLD_DK,
        width=max(1, s // 220),
    )
    # base shine
    d.arc(
        (cx - p2 * 0.7, mid, cx + p2 * 0.15, plinth_bot - 2),
        start=200,
        end=340,
        fill=GOLD_HI,
        width=max(2, s // 120),
    )

    # --- Upward arrow (right side) ---
    ax = s * 0.78
    a_bot = plinth_bot - h * 0.02
    a_top = cup_top - h * 0.02
    shaft_w = s * 0.048
    head_w = s * 0.115
    head_h = h * 0.22
    head_base = a_top + head_h

    # shaft
    shaft = [
        (ax - shaft_w, head_base - 2),
        (ax + shaft_w, head_base - 2),
        (ax + shaft_w, a_bot),
        (ax - shaft_w, a_bot),
    ]
    poly(d, shaft, GOLD, GOLD_DK, max(1, s // 200))
    # shaft highlight
    poly(
        d,
        [
            (ax - shaft_w + 2, head_base),
            (ax - shaft_w * 0.15, head_base),
            (ax - shaft_w * 0.15, a_bot - 2),
            (ax - shaft_w + 2, a_bot - 2),
        ],
        GOLD_LT,
    )

    # arrow head (solid triangle)
    head = [
        (ax, a_top),
        (ax + head_w, head_base),
        (ax - head_w, head_base),
    ]
    poly(d, head, GOLD_LT, GOLD_DK, max(1, s // 180))
    # tip highlight
    tip = [
        (ax, a_top + s * 0.01),
        (ax + head_w * 0.45, head_base - head_h * 0.25),
        (ax, a_top + head_h * 0.5),
        (ax - head_w * 0.25, head_base - head_h * 0.35),
    ]
    poly(d, tip, GOLD_HI)


def render(size, maskable=False):
    img = bg_gradient(size)
    # Soft ground shadow under the mark
    img = shadow_circle(
        img,
        cx=size * 0.50,
        cy=size * 0.78,
        r=size * 0.28,
        blur=max(2, size // 18),
        alpha=90,
        offset=(0, int(size * 0.02)),
    )
    d = ImageDraw.Draw(img)
    inset = 0.18 if maskable else 0.13
    draw_trophy_and_arrow(d, size, inset=inset)
    return img


def main():
    master = render(1024, maskable=False)
    maskable = render(1024, maskable=True)

    def save(img, path, size=None):
        out = img.resize((size, size), Image.Resampling.LANCZOS) if size else img
        out.save(path, "PNG")
        print(f"wrote {path} {out.size}")

    save(master, ICONS / "icon-512.png", 512)
    save(master, ICONS / "icon-192.png", 192)
    save(master, ICONS / "apple-touch-icon.png", 180)
    save(master, ICONS / "favicon.png", 32)
    save(maskable, ICONS / "maskable-512.png", 512)
    save(master, ROOT / "icon-512.png", 512)

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_path = ROOT / "icon.ico"
    master.save(ico_path, format="ICO", sizes=[(n, n) for n in ico_sizes])
    (ICONS / "icon.ico").write_bytes(ico_path.read_bytes())
    print(f"wrote {ico_path} bytes={ico_path.stat().st_size}")

    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Business SuccessHQ">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e2444"/>
      <stop offset="1" stop-color="#071224"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2d878"/>
      <stop offset="1" stop-color="#c9a227"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <path d="M120 150h210c8 0 16 8 14 20L320 270h-90L206 170c-2-12 6-20 14-20z" fill="url(#gold)"/>
  <rect x="200" y="148" width="230" height="28" rx="10" fill="#f2d878"/>
  <path d="M152 200c-40 10-58 70-18 110" fill="none" stroke="#d6ae36" stroke-width="16"/>
  <path d="M298 200c40 10 58 70 18 110" fill="none" stroke="#d6ae36" stroke-width="16"/>
  <rect x="214" y="270" width="36" height="90" rx="6" fill="url(#gold)"/>
  <rect x="170" y="350" width="124" height="36" rx="8" fill="#f2d878"/>
  <path d="M390 110 L460 210 H420 V390 H360 V210 H320 Z" fill="url(#gold)"/>
</svg>
'''
    (ICONS / "icon.svg").write_text(svg)
    print("wrote icons/icon.svg")


if __name__ == "__main__":
    main()
