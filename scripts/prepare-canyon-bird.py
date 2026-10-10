#!/usr/bin/env python3
"""Extract the small painted bird and repair only its original silhouette."""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "门/f0d98c03ee3b35347a7c7112138c18eb.jpg"
OUTPUT = ROOT / "assets/canyon"
RECT = (479, 857, 60, 77)


def dilate(mask, radius):
    image = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(image.filter(ImageFilter.MaxFilter(radius * 2 + 1))) > 0


def main():
    source = Image.open(SOURCE).convert("RGB")
    left, top, width, height = RECT
    crop = source.crop((left, top, left + width, top + height))
    pixels = np.asarray(crop).astype(np.float64)
    red, green, blue = pixels.transpose(2, 0, 1)
    core = (red > 175) & (green > 180) & (blue > 155)
    yy, xx = np.indices(core.shape)
    core &= (xx > 9) & (xx < 46) & (yy > 12) & (yy < 58)
    if not core.any():
        raise RuntimeError("Bird was not found in the expected source rectangle")

    # Inpaint a tight silhouette from surrounding original dark stone pixels.
    support = dilate(core, 3)
    ring = dilate(support, 2) & ~support
    repaired = pixels.copy()
    repaired[support] = np.median(pixels[ring], axis=0)
    for _ in range(1600):
        neighbors = (
            np.roll(repaired, 1, axis=0)
            + np.roll(repaired, -1, axis=0)
            + np.roll(repaired, 1, axis=1)
            + np.roll(repaired, -1, axis=1)
        ) * 0.25
        repaired[support] = neighbors[support]

    foreground = np.percentile(pixels[core], 97, axis=0)
    channel_alpha = (pixels - repaired) / np.maximum(foreground - repaired, 1)
    alpha = np.clip(np.min(channel_alpha, axis=2), 0, 1) * support
    alpha[alpha < 0.025] = 0
    colors = repaired + (pixels - repaired) / np.maximum(alpha[..., None], 0.025)
    colors = np.clip(colors, 0, 255)
    sprite = np.dstack((colors, alpha * 255)).astype(np.uint8)
    sprite[alpha == 0] = 0

    patch_alpha = np.asarray(
        Image.fromarray((support * 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(0.55)
        )
    ).astype(np.float64) / 255
    patch_alpha[dilate(core, 1)] = 1
    patch = np.dstack((repaired, patch_alpha * 255)).astype(np.uint8)
    patch[patch_alpha == 0] = 0

    OUTPUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sprite).save(OUTPUT / "tower-bird.png")
    Image.fromarray(patch).save(OUTPUT / "tower-bird-background.png")

    weight = alpha.sum()
    center = [float((xx * alpha).sum() / weight), float((yy * alpha).sum() / weight)]
    print(json.dumps({
        "source": str(SOURCE.relative_to(ROOT)),
        "sourceSize": list(source.size),
        "rectPixels": list(RECT),
        "rectPercent": [left / source.width * 100, top / source.height * 100,
                        width / source.width * 100, height / source.height * 100],
        "spriteCenterPixels": center,
        "spriteCenterSourcePercent": [(left + center[0]) / source.width * 100,
                                      (top + center[1]) / source.height * 100],
        "files": ["assets/canyon/tower-bird.png", "assets/canyon/tower-bird-background.png"]
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
