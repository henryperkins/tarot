#!/usr/bin/env python3
"""
Split multi-card photos into individual card images.

Detects card boundaries automatically and extracts each card as a separate file.
"""

from pathlib import Path
import cv2
import numpy as np
from PIL import Image

INPUT_DIR = Path("public/images")
OUTPUT_DIR = Path("public/images/thoth-scans")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def find_cards_in_image(image_path):
    """
    Detect individual cards in a multi-card photo using contour detection.
    Returns list of bounding boxes (x, y, w, h) for each card.
    """
    # Read image
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"❌ Could not read {image_path}")
        return []

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply threshold to get binary image
    _, binary = cv2.threshold(gray, 60, 255, cv2.THRESH_BINARY)

    # Find contours
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Filter contours by area and aspect ratio (cards should be rectangular)
    card_boxes = []
    img_area = img.shape[0] * img.shape[1]

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        aspect_ratio = h / w if w > 0 else 0

        # Cards should be:
        # - Reasonably large (at least 5% of image)
        # - Vertical rectangles (aspect ratio ~1.5-2.0)
        # - Not too small or too large
        if (area > img_area * 0.05 and
            area < img_area * 0.95 and
            1.3 < aspect_ratio < 2.2):
            card_boxes.append((x, y, w, h))

    # Sort by x-coordinate (left to right)
    card_boxes.sort(key=lambda box: box[0])

    return img, card_boxes


def extract_cards(image_path, output_prefix):
    """Extract individual cards from a multi-card photo."""
    img, card_boxes = find_cards_in_image(image_path)

    if not card_boxes:
        print(f"⚠️  No cards detected in {image_path.name}")
        return []

    extracted = []

    for i, (x, y, w, h) in enumerate(card_boxes):
        # Add small padding
        padding = 5
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(img.shape[1], x + w + padding)
        y2 = min(img.shape[0], y + h + padding)

        # Extract card region
        card_img = img[y1:y2, x1:x2]

        # Convert BGR to RGB for PIL
        card_rgb = cv2.cvtColor(card_img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(card_rgb)

        # Save with indexed name
        output_path = OUTPUT_DIR / f"{output_prefix}_card_{i+1:02d}.jpg"
        pil_img.save(output_path, quality=95)

        extracted.append(output_path)
        print(f"  ✓ Extracted card {i+1} → {output_path.name}")

    return extracted


def main():
    """Process all uploaded card photos."""
    print("Splicing multi-card photos into individual cards...")
    print("=" * 60)

    # Find all JPG files in public/images (excluding cards/ subdirectory)
    photo_files = sorted(INPUT_DIR.glob("IMG_*.JPG"))

    if not photo_files:
        print("❌ No IMG_*.JPG files found in public/images/")
        return

    total_cards = 0

    for photo_path in photo_files:
        print(f"\n📷 Processing: {photo_path.name}")

        # Use filename as prefix (e.g., IMG_0436 → thoth_0436)
        prefix = f"thoth_{photo_path.stem.replace('IMG_', '')}"

        extracted = extract_cards(photo_path, prefix)
        total_cards += len(extracted)

    print("\n" + "=" * 60)
    print(f"✓ Extracted {total_cards} individual cards")
    print(f"✓ Saved to: {OUTPUT_DIR}")
    print("\nNext step: Run vision validation on extracted cards:")
    print(f"  node scripts/vision/runVisionPrototype.js {OUTPUT_DIR}/*.jpg --deck-style thoth-a1 --all-cards")


if __name__ == "__main__":
    main()
