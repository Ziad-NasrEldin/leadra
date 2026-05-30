#!/usr/bin/env python3
"""Render Leadra-branded App Store screenshot drafts.

Uses the local ASO screenshot scaffold approach but applies Leadra's design system:
- Boardroom charcoal background (#2a2623)
- Warm on-dark headline (#fffaf0)
- Copper-soft descriptor (#d8c0ad)
- Serif display headline with Manrope-like bold descriptor fallback
"""

from __future__ import annotations

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

CANVAS_W = 1290
CANVAS_H = 2796
DEVICE_W = 1030
BEZEL = 15
SCREEN_W = DEVICE_W - 2 * BEZEL
SCREEN_CORNER_R = 62
DEVICE_Y = 720

BG = "#2a2623"          # brand-charcoal / boardroom ledger background
ON_DARK = "#fffaf0"     # warm on-dark, not pure white
COPPER_SOFT = "#d8c0ad" # brand-copper-soft
COPPER = "#a76f4d"      # brand-copper accents

ROOT = Path(__file__).resolve().parents[1]
SKILL_DIR = Path.home() / ".hermes/skills/creative/aso-appstore-screenshots"
FRAME_PATH = SKILL_DIR / "assets/device_frame.png"

SERIF_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
]
SANS_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]
SERIF_PATH = next((p for p in SERIF_CANDIDATES if os.path.exists(p)), SERIF_CANDIDATES[0])
SANS_PATH = next((p for p in SANS_CANDIDATES if os.path.exists(p)), SANS_CANDIDATES[0])

ITEMS = [
    ("01-control-resale-inventory", "Control", "Resale Inventory", "screenshots/source/01-dashboard-control-inventory.png"),
    ("02-find-the-right-unit-fast", "Find", "The Right Unit Fast", "screenshots/source/02-units-find-fast.png"),
    ("03-upload-listings-without-chaos", "Upload", "Listings Without Chaos", "screenshots/source/03-create-upload-without-chaos.png"),
    ("04-share-branded-unit-briefs", "Share", "Branded Unit Briefs", "screenshots/source/04-details-share-briefs.png"),
    ("05-track-team-performance", "Track", "Team Performance", "screenshots/source/05-analytics-track-performance.png"),
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def fit_font(text: str, font_path: str, max_w: int, size_max: int, size_min: int) -> ImageFont.FreeTypeFont:
    draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    for size in range(size_max, size_min - 1, -4):
        font = ImageFont.truetype(font_path, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_w:
            return font
    return ImageFont.truetype(font_path, size_min)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_w:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def centered_text(draw: ImageDraw.ImageDraw, y: int, text: str, font: ImageFont.FreeTypeFont, fill: str, max_w: int | None = None, line_gap: int = 18) -> int:
    lines = wrap_text(text, font, max_w) if max_w else [text]
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        h = bbox[3] - bbox[1]
        draw.text((CANVAS_W // 2, y - bbox[1]), line, fill=fill, font=font, anchor="mt")
        y = int(y + h + line_gap)
    return y


def draw_copper_marks(draw: ImageDraw.ImageDraw) -> None:
    # Restrained operational accent: two short ledger lines under the header block.
    y = 625
    draw.rounded_rectangle([392, y, 562, y + 8], radius=4, fill=COPPER)
    draw.rounded_rectangle([728, y, 898, y + 8], radius=4, fill=COPPER)
    draw.ellipse([618, y - 8, 672, y + 46], fill=COPPER_SOFT)


def compose(slug: str, verb: str, desc: str, source: str) -> Path:
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (*hex_to_rgb(BG), 255))
    draw = ImageDraw.Draw(canvas)

    verb_font = fit_font(verb, SERIF_PATH, int(CANVAS_W * 0.82), 280, 176)
    desc_font = fit_font(desc.upper(), SANS_PATH, int(CANVAS_W * 0.78), 104, 82)

    y = 176
    y = centered_text(draw, y, verb, verb_font, ON_DARK)
    y += 18
    centered_text(draw, y, desc.upper(), desc_font, COPPER_SOFT, max_w=int(CANVAS_W * 0.78), line_gap=12)
    draw_copper_marks(draw)

    device_x = (CANVAS_W - DEVICE_W) // 2
    screen_x = device_x + BEZEL
    screen_y = DEVICE_Y + BEZEL

    shot = Image.open(ROOT / source).convert("RGBA")
    scale = SCREEN_W / shot.width
    shot = shot.resize((SCREEN_W, int(shot.height * scale)), Image.LANCZOS)

    screen_h = CANVAS_H - screen_y + 500
    scr_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(scr_mask).rounded_rectangle(
        [screen_x, screen_y, screen_x + SCREEN_W, screen_y + screen_h],
        radius=SCREEN_CORNER_R,
        fill=255,
    )
    scr_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(scr_layer).rounded_rectangle(
        [screen_x, screen_y, screen_x + SCREEN_W, screen_y + screen_h],
        radius=SCREEN_CORNER_R,
        fill=(0, 0, 0, 255),
    )
    scr_layer.paste(shot, (screen_x, screen_y))
    scr_layer.putalpha(scr_mask)
    canvas = Image.alpha_composite(canvas, scr_layer)

    frame = Image.open(FRAME_PATH).convert("RGBA")
    frame_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    frame_layer.paste(frame, (device_x, DEVICE_Y))
    canvas = Image.alpha_composite(canvas, frame_layer)

    out_dir = ROOT / "screenshots/final"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{slug}.png"
    canvas.convert("RGB").save(out_path, "PNG")
    return out_path


def make_contact_sheet(paths: list[Path]) -> Path:
    thumbs = []
    for path in paths:
        img = Image.open(path).convert("RGB")
        thumb_w = 230
        thumb_h = round(img.height * thumb_w / img.width)
        img = img.resize((thumb_w, thumb_h), Image.LANCZOS)
        thumbs.append((path, img))
    gap = 20
    label_h = 30
    w = gap + len(thumbs) * 230 + (len(thumbs) - 1) * gap + gap
    h = label_h + thumbs[0][1].height + gap
    sheet = Image.new("RGB", (w, h), (239, 231, 221))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(SANS_PATH, 12)
    x = gap
    for path, img in thumbs:
        label = path.name
        if len(label) > 31:
            label = label[:28] + "..."
        d.text((x, 8), label, fill=(42, 38, 35), font=font)
        sheet.paste(img, (x, label_h))
        x += 230 + gap
    out = ROOT / "screenshots/showcase-contact-sheet.png"
    sheet.save(out, "PNG")
    return out


def main() -> None:
    outputs = [compose(*item) for item in ITEMS]
    sheet = make_contact_sheet(outputs)
    for output in outputs:
        img = Image.open(output)
        print(f"{output} ({img.width}x{img.height})")
    print(f"{sheet} ({Image.open(sheet).width}x{Image.open(sheet).height})")


if __name__ == "__main__":
    main()
