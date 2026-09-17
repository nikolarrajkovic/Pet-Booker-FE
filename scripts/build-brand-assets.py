"""Derive every shipped brand asset from the three source logos in `assets/`.

Run: `python scripts/build-brand-assets.py` (needs `pillow` and `numpy`).

## Why this is a script and not three hand-cropped PNGs

The three files the designer handed over — `logo_pB_full`, `logo_pB_letters_only`,
`logo_pB_small_calendar` — are 1254x1254 **opaque** squares (PNG colour type 2, no alpha) with
150-350px of white padding baked in. Nothing can sit on the green brand band or a dark-mode
card in that state: it renders as a white tile with a logo in it. Every asset the app actually
loads is therefore a derivative, and deriving them in code means a redraw of a source file is
one command away from being shipped everywhere, instead of a manual re-crop per output.

## The one non-obvious bit: the logos contain white *inside* the artwork

The dog's face inside the `p`, the cat's face inside the `B` and the calendar's card interior
are all white fills. A global "white -> transparent" key would punch straight through them and
leave the mark with holes. `to_transparent` instead flood-fills inward from the four corners,
so only white that is **connected to the border** is removed and enclosed white survives.

The flood stops just short of the antialiased rim (those pixels are white/green blends, outside
its tolerance), which would leave a bright halo once the mark sits on green. The ring just
outside the flood therefore gets a soft alpha recovered from how far each pixel is from white.
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BRAND = os.path.join(ASSETS, "brand")

SRC_CALENDAR = os.path.join(ASSETS, "logo_pB_small_calendar.png")
SRC_MONOGRAM = os.path.join(ASSETS, "logo_pB_letters_only.png")
SRC_LOCKUP = os.path.join(ASSETS, "logo_pB_full.png")

WHITE = (255, 255, 255, 255)
# Magenta cannot occur in this artwork, so it is safe to use as the flood's marker colour.
SENTINEL = (255, 0, 255)


def to_transparent(path: str, flood_thresh: int = 32, rim: int = 7, gain_floor: int = 40):
    """Drop the border-connected white background, keeping white enclosed by the artwork."""
    im = Image.open(path).convert("RGB")
    w, h = im.size

    flood = im.copy()
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(flood, xy, SENTINEL, thresh=flood_thresh)

    arr = np.asarray(flood, dtype=np.int16)
    outside = (arr[:, :, 0] == 255) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 255)

    # Dilating the background mask gives the antialiased ring the flood refused to enter.
    mask_img = Image.fromarray((outside * 255).astype(np.uint8), "L")
    dilated = np.asarray(mask_img.filter(ImageFilter.MaxFilter(rim)), dtype=np.uint8) > 127
    ring = dilated & ~outside

    src = np.asarray(im, dtype=np.float32)
    # A ring pixel is `a * art + (1 - a) * white`; its distance from white recovers `a`.
    recovered = np.clip((255.0 - src.min(axis=2)) / (255.0 - gain_floor), 0.0, 1.0) * 255.0

    alpha = np.full((h, w), 255.0, dtype=np.float32)
    alpha[ring] = recovered[ring]
    alpha[outside] = 0.0

    return Image.fromarray(np.dstack([src, alpha]).astype(np.uint8), "RGBA"), outside


def trim(im: Image.Image, threshold: int = 8) -> Image.Image:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.where(a > threshold)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fit(art: Image.Image, size: int, coverage: float, bg=None) -> Image.Image:
    """Centre `art` on a `size` square, scaled so its long edge is `coverage` of the canvas."""
    target = size * coverage
    scale = min(target / art.width, target / art.height)
    r = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    canvas.paste(r, ((size - r.width) // 2, (size - r.height) // 2), r)
    return canvas


def rounded(im: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    """Clip to a rounded square — for the favicon plate, which is its own tiny app icon."""
    r = int(min(im.size) * radius_ratio)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, fill=255)
    out = im.copy()
    out.putalpha(Image.fromarray(np.minimum(np.asarray(im)[:, :, 3], np.asarray(mask))))
    return out


def silhouette(art: Image.Image, outside: np.ndarray) -> Image.Image:
    """A white-on-transparent stencil for the Android notification tray.

    Android throws away every colour in a notification icon and renders the alpha channel as a
    flat white mask, so shipping the app icon there produces a white blob. Keeping the enclosed
    pet faces *transparent* is what makes the monogram still read as `pB` with a dog and a cat
    in it rather than as two solid letters.
    """
    rgba = np.asarray(art).copy()
    near_white = rgba[:, :, :3].min(axis=2) > 200
    enclosed_white = near_white & ~outside
    alpha = rgba[:, :, 3].astype(np.float32)
    alpha[enclosed_white] = 0.0
    out = np.zeros_like(rgba)
    out[:, :, 0:3] = 255
    out[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def save(im: Image.Image, path: str, opaque: bool = False) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if opaque:
        flat = Image.new("RGB", im.size, (255, 255, 255))
        flat.paste(im, mask=im.split()[3])
        flat.save(path)
    else:
        im.save(path)
    print(f"  {os.path.relpath(path, ROOT)}  {im.size[0]}x{im.size[1]}")


def main() -> None:
    calendar_rgba, calendar_outside = to_transparent(SRC_CALENDAR)
    monogram_rgba, monogram_outside = to_transparent(SRC_MONOGRAM)
    lockup_rgba, _ = to_transparent(SRC_LOCKUP)

    calendar = trim(calendar_rgba)
    monogram = trim(monogram_rgba)
    lockup = trim(lockup_rgba)

    print("In-app marks:")
    # Used by AuthLayout, SideNav and the Home header. A little padding so the mark never
    # touches the edge of a chip that rounds its corners.
    save(fit(calendar, 512, 0.94), os.path.join(BRAND, "logo-mark.png"))
    save(fit(monogram, 512, 0.94), os.path.join(BRAND, "logo-monogram.png"))
    save(fit(lockup, 768, 0.94), os.path.join(BRAND, "logo-lockup.png"))

    print("Native assets:")
    # Store icon: opaque, because iOS rejects an alpha channel here and composites nothing.
    save(fit(calendar, 1024, 0.78, bg=WHITE), os.path.join(ASSETS, "icon.png"), opaque=True)
    # Android adaptive foreground: the launcher crops to a shape of its choosing and only the
    # central 66% is guaranteed to survive, so the mark stays inside it.
    save(fit(calendar, 1024, 0.62), os.path.join(ASSETS, "adaptive-icon.png"))
    # Browser tab: the monogram, because the calendar's frame eats the letters below ~32px.
    save(rounded(fit(monogram, 256, 0.80, bg=WHITE)), os.path.join(ASSETS, "favicon.png"))
    # Launch screen: `contain` fits the whole square to the narrow edge, so this coverage is
    # what the lockup measures against the screen's width on a phone.
    save(fit(lockup, 1284, 0.46), os.path.join(ASSETS, "splash.png"))
    save(fit(silhouette(monogram_rgba, monogram_outside), 192, 0.78),
         os.path.join(ASSETS, "notification-icon.png"))


if __name__ == "__main__":
    main()
