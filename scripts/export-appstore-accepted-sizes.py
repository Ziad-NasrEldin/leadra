#!/usr/bin/env python3
"""Export Leadra App Store screenshots to Apple-accepted dimensions."""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "screenshots/final"
SIZES = {
    "1242x2688": (1242, 2688),
    "1284x2778": (1284, 2778),
}


def crop_resize(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    w, h = image.size
    target_ratio = target_w / target_h
    current_ratio = w / h
    if current_ratio > target_ratio:
        new_w = round(h * target_ratio)
        left = round((w - new_w) / 2)
        image = image.crop((left, 0, left + new_w, h))
    elif current_ratio < target_ratio:
        new_h = round(w / target_ratio)
        top = round((h - new_h) / 2)
        image = image.crop((0, top, w, top + new_h))
    return image.resize((target_w, target_h), Image.Resampling.LANCZOS)


def make_contact_sheet(paths: list[Path], output: Path) -> None:
    thumbs = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        thumb_w = 230
        thumb_h = round(image.height * thumb_w / image.width)
        thumbs.append((path.name, image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)))
    if not thumbs:
        return
    gap = 20
    label_h = 30
    width = gap + len(thumbs) * 230 + (len(thumbs) - 1) * gap + gap
    height = label_h + thumbs[0][1].height + gap
    sheet = Image.new("RGB", (width, height), (239, 231, 221))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 12)
    except Exception:
        font = None
    x = gap
    for name, image in thumbs:
        label = name if len(name) <= 31 else name[:28] + "..."
        draw.text((x, 8), label, fill=(42, 38, 35), font=font)
        sheet.paste(image, (x, label_h))
        x += 230 + gap
    sheet.save(output, "PNG")


def main() -> None:
    source_files = sorted(SRC_DIR.glob("*.png"))
    if not source_files:
        raise SystemExit(f"No PNG screenshots found in {SRC_DIR}")

    for label, (target_w, target_h) in SIZES.items():
        out_dir = ROOT / f"screenshots/final-{label}"
        out_dir.mkdir(parents=True, exist_ok=True)
        outputs = []
        for src in source_files:
            image = Image.open(src).convert("RGB")
            out = out_dir / src.name
            crop_resize(image, target_w, target_h).save(out, "PNG", optimize=True)
            check = Image.open(out)
            outputs.append(out)
            print(f"{out} {check.width}x{check.height}")
        sheet = ROOT / f"screenshots/showcase-contact-sheet-{label}.png"
        make_contact_sheet(outputs, sheet)
        if sheet.exists():
            check = Image.open(sheet)
            print(f"{sheet} {check.width}x{check.height}")


if __name__ == "__main__":
    main()
