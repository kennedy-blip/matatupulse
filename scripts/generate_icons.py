"""Generate the MatatuPulse launcher/PWA icons from one vector-like drawing routine.

Run with:  python3 scripts/generate_icons.py
Requires Pillow (development only; generated PNGs are committed to the repo).
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
PUBLIC = ROOT / "public"
SIZE = 1024

DARK = (22, 12, 2, 255)
AMBER = (251, 191, 36)
ORANGE = (245, 158, 11)
VIOLET = (124, 58, 237)


def gradient_background(size):
    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            t = (x / size * 0.55 + y / size * 0.45)
            if t < 0.55:
                local = t / 0.55
                color = tuple(int(AMBER[i] + (ORANGE[i] - AMBER[i]) * local) for i in range(3))
            else:
                local = (t - 0.55) / 0.45
                color = tuple(int(ORANGE[i] + (VIOLET[i] - ORANGE[i]) * local) for i in range(3))
            pixels[x, y] = (*color, 255)
    return image


def draw_mark(draw, size, scale=1.0):
    cx, cy = size / 2, size / 2
    s = size * scale

    def box(l, t, r, b):
        return (
            cx + (l - 0.5) * s, cy + (t - 0.5) * s,
            cx + (r - 0.5) * s, cy + (b - 0.5) * s,
        )

    stroke = max(2, int(size * 0.022 * scale))
    # Bus body and roof.
    draw.rounded_rectangle(box(0.24, 0.36, 0.76, 0.70), radius=int(s * 0.07), fill=DARK)
    draw.polygon([
        (cx + (0.30 - 0.5) * s, cy + (0.36 - 0.5) * s),
        (cx + (0.36 - 0.5) * s, cy + (0.22 - 0.5) * s),
        (cx + (0.64 - 0.5) * s, cy + (0.22 - 0.5) * s),
        (cx + (0.70 - 0.5) * s, cy + (0.36 - 0.5) * s),
    ], fill=DARK)
    draw.rounded_rectangle(box(0.34, 0.26, 0.66, 0.32), radius=int(s * 0.018), fill=(255, 255, 255, 210))
    draw.line([(cx + (0.27 - 0.5) * s, cy + (0.53 - 0.5) * s),
               (cx + (0.73 - 0.5) * s, cy + (0.53 - 0.5) * s)], fill=(255, 255, 255, 235), width=stroke)
    # Pulse trace across the body — the "Pulse" in MatatuPulse.
    draw.line([
        (cx + (0.29 - 0.5) * s, cy + (0.60 - 0.5) * s),
        (cx + (0.39 - 0.5) * s, cy + (0.60 - 0.5) * s),
        (cx + (0.44 - 0.5) * s, cy + (0.55 - 0.5) * s),
        (cx + (0.49 - 0.5) * s, cy + (0.65 - 0.5) * s),
        (cx + (0.54 - 0.5) * s, cy + (0.57 - 0.5) * s),
        (cx + (0.59 - 0.5) * s, cy + (0.60 - 0.5) * s),
        (cx + (0.71 - 0.5) * s, cy + (0.60 - 0.5) * s),
    ], fill=(255, 255, 255, 255), width=max(2, int(size * 0.012 * scale)), joint="curve")
    for x in (0.35, 0.65):
        draw.ellipse(box(x - 0.07, 0.65, x + 0.07, 0.79), fill=DARK)
        draw.ellipse(box(x - 0.032, 0.682, x + 0.032, 0.748), fill=(255, 255, 255, 235))


def make_legacy(size):
    image = gradient_background(size)
    draw = ImageDraw.Draw(image)
    draw_mark(draw, size)
    return image


def make_round(size):
    image = make_legacy(size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    image.putalpha(mask)
    return image


def make_foreground(size):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw_mark(draw, size, scale=0.62)
    return image


def make_splash(width, height):
    image = Image.new("RGBA", (width, height), (9, 10, 15, 255))
    draw = ImageDraw.Draw(image)
    # Subtle amber/violet glow behind the mark.
    glow_size = min(width, height) // 2
    glow = Image.new("RGBA", (glow_size, glow_size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for step in range(36):
        radius = glow_size // 2 - step * (glow_size // 80)
        if radius <= 0:
            break
        alpha = int(11 - step * 0.26)
        color = (245, 158, 11, max(0, alpha))
        gd.ellipse(
            (glow_size // 2 - radius, glow_size // 2 - radius,
             glow_size // 2 + radius, glow_size // 2 + radius),
            outline=color, width=max(1, glow_size // 80),
        )
    image.alpha_composite(glow, ((width - glow_size) // 2, (height - glow_size) // 2))
    mark_size = min(width, height) // 3
    mark = gradient_background(mark_size)
    md = ImageDraw.Draw(mark)
    draw_mark(md, mark_size)
    image.alpha_composite(mark, ((width - mark_size) // 2, (height - mark_size) // 2))
    return image.convert("RGB")


def save_all():
    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for folder, target in densities.items():
        destination = RES / f"mipmap-{folder}"
        destination.mkdir(parents=True, exist_ok=True)
        make_legacy(target).save(destination / "ic_launcher.png")
        make_round(target).save(destination / "ic_launcher_round.png")
        make_foreground(target).save(destination / "ic_launcher_foreground.png")

    background = RES / "values" / "ic_launcher_background.xml"
    background.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources>\n'
        '    <color name="ic_launcher_background">#F59E0B</color>\n'
        '</resources>\n',
        encoding="utf-8",
    )

    splashes = {
        "drawable": (320, 480),
        "drawable-port-mdpi": (320, 480),
        "drawable-port-hdpi": (480, 800),
        "drawable-port-xhdpi": (720, 1280),
        "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
        "drawable-land-mdpi": (480, 320),
        "drawable-land-hdpi": (800, 480),
        "drawable-land-xhdpi": (1280, 720),
        "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
    }
    for folder, (width, height) in splashes.items():
        destination = RES / folder
        destination.mkdir(parents=True, exist_ok=True)
        make_splash(width, height).save(destination / "splash.png")

    PUBLIC.mkdir(exist_ok=True)
    make_legacy(512).save(PUBLIC / "matatupulse-icon-512.png")
    make_legacy(192).save(PUBLIC / "matatupulse-icon-192.png")
    print("Launcher icons and PWA icons generated.")


if __name__ == "__main__":
    save_all()
