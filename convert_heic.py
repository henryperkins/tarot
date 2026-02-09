#!/usr/bin/env python3
"""Convert HEIC image to PNG/JPEG using Pillow and pillow-heif."""

import sys
from pathlib import Path

try:
    from PIL import Image
    from pillow_heif import register_heif_opener
except ImportError as e:
    print(f"Error: Missing required package: {e}")
    print("Install with: pip install pillow pillow-heif")
    sys.exit(1)

# Register HEIF opener with Pillow
register_heif_opener()

def convert_heic(input_path, output_format='PNG'):
    """Convert HEIC file to specified format."""
    input_file = Path(input_path)

    if not input_file.exists():
        print(f"Error: File not found: {input_file}")
        return False

    # Create output filename
    output_file = input_file.with_suffix(f'.{output_format.lower()}')

    try:
        print(f"Converting {input_file.name}...")

        # Open and convert the image
        with Image.open(input_file) as img:
            # Convert to RGB if necessary (HEIC might have different color modes)
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')

            # Save in the new format
            img.save(output_file, format=output_format, quality=95)

        print(f"✓ Converted successfully!")
        print(f"  Input:  {input_file} ({input_file.stat().st_size / 1024:.1f} KB)")
        print(f"  Output: {output_file} ({output_file.stat().st_size / 1024:.1f} KB)")
        print(f"  Size:   {img.size[0]} x {img.size[1]} pixels")

        return True

    except Exception as e:
        print(f"Error during conversion: {e}")
        return False

if __name__ == "__main__":
    input_path = "/home/azureuser/tarot/Tableu.heic"

    # You can change the output format here: 'PNG', 'JPEG', 'WEBP', etc.
    output_format = 'PNG'

    convert_heic(input_path, output_format)
