#!/usr/bin/env python3
"""Render Leadra-branded iPad App Store screenshots at 2048x2732."""

from __future__ import annotations
from pathlib import Path
import shutil, zipfile
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "screenshots/ipad/source"
OUT_DIR = ROOT / "screenshots/ipad/APPLE_UPLOAD_2048x2732_BRANDED_JPG_ONLY"
CANVAS_W, CANVAS_H = 2048, 2732
BG = "#2a2623"
ON_DARK = "#fffaf0"
COPPER_SOFT = "#d8c0ad"
COPPER = "#a76f4d"
SERIF = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

ITEMS = [
    ("01-dashboard-control-inventory", "Control", "Resale Inventory"),
    ("02-units-find-fast", "Find", "The Right Unit Fast"),
    ("03-create-upload-without-chaos", "Upload", "Listings Without Chaos"),
    ("04-details-share-briefs", "Share", "Branded Unit Briefs"),
    ("05-analytics-track-performance", "Track", "Team Performance"),
]

def rgb(hex_value: str) -> tuple[int, int, int]:
    h = hex_value.lstrip("#")
    return int(h[:2], 16), int(h[2:4], 16), int(h[4:], 16)

def fit(text: str, font_path: str, max_w: int, max_size: int, min_size: int) -> ImageFont.FreeTypeFont:
    draw = ImageDraw.Draw(Image.new("RGB", (1,1)))
    for size in range(max_size, min_size - 1, -4):
        font = ImageFont.truetype(font_path, size)
        box = draw.textbbox((0,0), text, font=font)
        if box[2] - box[0] <= max_w:
            return font
    return ImageFont.truetype(font_path, min_size)

def center(draw: ImageDraw.ImageDraw, y: int, text: str, font: ImageFont.FreeTypeFont, fill: str) -> int:
    box = draw.textbbox((0,0), text, font=font)
    draw.text((CANVAS_W//2, y - box[1]), text, anchor="mt", font=font, fill=fill)
    return int(y + (box[3] - box[1]))

def rounded_mask(size: tuple[int,int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,size[0],size[1]), radius=radius, fill=255)
    return mask

def render(slug: str, verb: str, desc: str) -> Path:
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), rgb(BG))
    d = ImageDraw.Draw(canvas)
    verb_font = fit(verb, SERIF, 1200, 245, 160)
    desc_font = fit(desc.upper(), SANS, 1120, 82, 62)
    y = 110
    y = center(d, y, verb, verb_font, ON_DARK) + 22
    center(d, y, desc.upper(), desc_font, COPPER_SOFT)
    mark_y = 420
    d.rounded_rectangle([830, mark_y, 930, mark_y+8], radius=4, fill=COPPER)
    d.ellipse([1016, mark_y-8, 1068, mark_y+44], fill=COPPER_SOFT)
    d.rounded_rectangle([1154, mark_y, 1254, mark_y+8], radius=4, fill=COPPER)

    src = Image.open(SRC_DIR / f"{slug}.png").convert("RGB")
    frame_w = 1740
    inner_pad = 26
    inner_w = frame_w - inner_pad*2
    inner_h = round(src.height * inner_w / src.width)
    frame_h = inner_h + inner_pad*2
    frame_x = (CANVAS_W - frame_w)//2
    frame_y = 540

    shadow = Image.new("RGBA", (frame_w+90, frame_h+90), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([45,45,45+frame_w,45+frame_h], radius=56, fill=(0,0,0,120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas.paste(shadow, (frame_x-45, frame_y-25), shadow)

    frame = Image.new("RGB", (frame_w, frame_h), (13,13,15))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0,0,frame_w-1,frame_h-1], radius=58, fill=(13,13,15), outline=(216,192,173), width=3)
    app = src.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
    mask = rounded_mask((inner_w, inner_h), 36)
    frame.paste(app, (inner_pad, inner_pad), mask)
    frame_mask = rounded_mask((frame_w, frame_h), 58)
    canvas.paste(frame, (frame_x, frame_y), frame_mask)

    out = OUT_DIR / f"{slug}.jpg"
    canvas.save(out, "JPEG", quality=95, subsampling=0, optimize=True, progressive=False)
    return out

def main() -> None:
    if OUT_DIR.exists(): shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    outputs = [render(*item) for item in ITEMS]
    for p in outputs:
        im = Image.open(p)
        print(f"{p} {im.width}x{im.height}")
    zip_path = ROOT / "screenshots/ipad/APPLE_UPLOAD_2048x2732_BRANDED_JPG_ONLY.zip"
    if zip_path.exists(): zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for p in outputs: z.write(p, arcname=p.name)
    print(f"ZIP {zip_path}")

if __name__ == "__main__":
    main()
