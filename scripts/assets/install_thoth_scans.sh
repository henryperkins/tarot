#!/bin/bash
# Install confirmed Thoth card scans to replace placeholders

set -e

SOURCE_DIR="public/images/thoth-scans"
TARGET_DIR="public/images/cards/thoth"
BACKUP_DIR="public/images/cards/thoth-placeholders-backup"

echo "Installing authentic Thoth card scans..."
echo "========================================"

# Create backup of placeholders
echo ""
echo "1. Backing up current placeholders..."
mkdir -p "$BACKUP_DIR"
cp -r "$TARGET_DIR"/*.png "$BACKUP_DIR/" 2>/dev/null || true
echo "   ✓ Placeholders backed up to $BACKUP_DIR"

# Copy and convert confirmed Thoth scans
echo ""
echo "2. Installing 15 confirmed Thoth scans..."

# Function to copy and convert JPG to PNG
install_card() {
    local source=$1
    local target=$2
    local name=$3

    if [ -f "$SOURCE_DIR/$source" ]; then
        # Convert JPG to PNG using ImageMagick or fall back to direct copy
        if command -v convert &> /dev/null; then
            convert "$SOURCE_DIR/$source" "$TARGET_DIR/$target"
        else
            # If ImageMagick not available, use Python PIL
            python3 -c "
from PIL import Image
img = Image.open('$SOURCE_DIR/$source')
img.save('$TARGET_DIR/$target', 'PNG')
"
        fi
        echo "   ✓ $name"
    else
        echo "   ✗ Missing: $source"
    fi
}

# Install confirmed cards
install_card "thoth_0436_card_01.jpg" "thoth_major_01_the-magus.png" "The Magus (I)"
install_card "thoth_0436_card_02.jpg" "thoth_major_07_the-chariot.png" "The Chariot (VII)"
install_card "thoth_0436_card_03.jpg" "thoth_major_11_lust.png" "Lust (XI)"
install_card "thoth_0436_card_04.jpg" "thoth_major_12_the-hanged-man.png" "The Hanged Man (XII)"
install_card "thoth_0436_card_05.jpg" "thoth_major_16_the-tower.png" "The Tower (XVI)"

install_card "thoth_0437_card_01.jpg" "thoth_major_04_the-emperor.png" "The Emperor (IV)"
install_card "thoth_0437_card_02.jpg" "thoth_major_03_the-empress.png" "The Empress (III)"
install_card "thoth_0437_card_03.jpg" "thoth_major_05_the-hierophant.png" "The Hierophant (V)"
install_card "thoth_0437_card_04.jpg" "thoth_major_06_the-lovers.png" "The Lovers (VI)"
install_card "thoth_0437_card_05.jpg" "thoth_major_10_fortune.png" "Fortune (X)"

install_card "thoth_0438_card_01.jpg" "thoth_major_17_the-star.png" "The Star (XVII)"
install_card "thoth_0438_card_02.jpg" "thoth_major_19_the-sun.png" "The Sun (XIX)"
install_card "thoth_0438_card_03.jpg" "thoth_major_21_the-universe.png" "The Universe (XXI)"
install_card "thoth_0438_card_04.jpg" "thoth_major_20_the-aeon.png" "The Aeon (XX)"
install_card "thoth_0438_card_05.jpg" "thoth_major_14_art.png" "Art (XIV)"

echo ""
echo "========================================"
echo "✓ Installed 15 authentic Thoth Major Arcana scans"
echo ""
echo "Remaining cards still using placeholders:"
echo "  Major Arcana: 7 cards (0, 2, 8, 9, 13, 15, 18)"
echo "    - The Fool (0)"
echo "    - The Priestess (2)"
echo "    - Adjustment (8)"
echo "    - The Hermit (9)"
echo "    - Death (13)"
echo "    - The Devil (15)"
echo "    - The Moon (18)"
echo ""
echo "  Minor Arcana: All 56 cards still use placeholders"
echo ""
echo "Note: IMG_0440 cards not installed due to labeling discrepancies"
echo "      (says 'THE HIGH PRIESTESS' and 'TEMPERANCE' instead of"
echo "       Thoth names 'THE PRIESTESS' and 'ART')"
