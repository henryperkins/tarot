#!/usr/bin/env python3
"""
Split multi-card photos into individual card images using PIL only.

Since cards are laid out horizontally in a row, we can split by dividing
the width evenly based on the number of cards visible.
"""

from pathlib import Path
from PIL import Image, ImageOps

INPUT_DIR = Path("public/images")
OUTPUT_DIR = Path("public/images/thoth-scans")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Manual card counts per photo (based on visual inspection)
PHOTO_CONFIG = {
    "IMG_0436.JPG": 5,  # The Magus, The Chariot, Lust, Hanged Man(?), The Tower
    "IMG_0437.JPG": 5,  # The Emperor, The Empress, The Hierophant, Lovers, Fortune
    "IMG_0438.JPG": 5,  # The Star, The Sun, The Universe, Aeon, Art
    "IMG_0440.JPG": 4,  # The Fool, The High Priestess, Death, Temperance (might be RWS not Thoth)
}


def extract_cards_simple(image_path, num_cards):
    """
    Extract cards by dividing image into equal vertical slices.
    Assumes cards are arranged horizontally in a row with minimal spacing.
    """
    img = Image.open(image_path)
    width, height = img.size

    # Calculate card width (with small overlap tolerance)
    card_width = width // num_cards
    extracted = []

    prefix = f"thoth_{image_path.stem.replace('IMG_', '')}"

    print(f"\n📷 {image_path.name} → {num_cards} cards")

    for i in range(num_cards):
        # Calculate crop box for this card
        # Add small margins to avoid edges
        left = i * card_width + 5
        right = (i + 1) * card_width - 5
        top = 5
        bottom = height - 5

        # Ensure we don't go outside image bounds
        left = max(0, left)
        right = min(width, right)
        top = max(0, top)
        bottom = min(height, bottom)

        # Crop card
        card_img = img.crop((left, top, right, bottom))

        # Auto-crop to remove black borders
        card_img = ImageOps.crop(card_img, border=10)

        # Save
        output_path = OUTPUT_DIR / f"{prefix}_card_{i+1:02d}.jpg"
        card_img.save(output_path, quality=95)

        extracted.append(output_path)
        print(f"  ✓ Card {i+1} → {output_path.name} ({card_img.width}×{card_img.height}px)")

    return extracted


def main():
    """Process all uploaded card photos."""
    print("Splicing multi-card photos into individual cards...")
    print("=" * 70)

    total_cards = 0

    for filename, num_cards in PHOTO_CONFIG.items():
        photo_path = INPUT_DIR / filename

        if not photo_path.exists():
            print(f"⚠️  {filename} not found, skipping")
            continue

        extracted = extract_cards_simple(photo_path, num_cards)
        total_cards += len(extracted)

    print("\n" + "=" * 70)
    print(f"✓ Extracted {total_cards} individual card images")
    print(f"✓ Saved to: {OUTPUT_DIR}/")
    print("\nNext: Validate with vision pipeline:")
    print(f"  node scripts/vision/runVisionPrototype.js {OUTPUT_DIR}/*.jpg \\")
    print(f"    --deck-style thoth-a1 --all-cards --max-results 3")


if __name__ == "__main__":
    main()
# Add IMG_0441 config
PHOTO_CONFIG["IMG_0441.JPG"] = 5  # 5 cards
