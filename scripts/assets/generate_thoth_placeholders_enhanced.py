#!/usr/bin/env python3
"""
Generate enhanced stylised placeholder images for the Thoth (Crowley/Harris) deck.

The real artwork is still under copyright in many jurisdictions, so this script
creates abstract cards with Thoth-specific titles, suit colours, and keywords,
enhanced with astrological symbols, Hebrew letters, and Art Deco gradients to
improve CLIP vision recognition accuracy.
"""

from __future__ import annotations

import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Canvas configuration
WIDTH = 480
HEIGHT = 800
MARGIN = 32
TITLE_BAND = 90
KEYWORD_ZONE = 160

OUT_DIR = Path("public/images/cards/thoth")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    """
    Attempt to load the requested font family. Fall back to DejaVuSans which is
    available on the GitHub runners and Codespaces base images.
    """
    search_paths = [
        f"/usr/share/fonts/truetype/dejavu/{name}.ttf",
        f"/usr/share/fonts/truetype/{name}.ttf",
        f"/System/Library/Fonts/{name}.ttc",
    ]
    for path in search_paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


TITLE_FONT = load_font("DejaVuSans-Bold", 42)
SUBTITLE_FONT = load_font("DejaVuSans", 26)
KEYWORD_FONT = load_font("DejaVuSans", 22)
SYMBOL_FONT = load_font("DejaVuSans", 64)


# Hebrew letters for Major Arcana (Unicode)
HEBREW_LETTERS = {
    0: "א",   # Aleph
    1: "ב",   # Beth
    2: "ג",   # Gimel
    3: "ד",   # Daleth
    4: "צ",   # Tzaddi
    5: "ו",   # Vav
    6: "ז",   # Zain
    7: "ח",   # Cheth
    8: "ל",   # Lamed
    9: "י",   # Yod
    10: "כ",  # Kaph
    11: "ט",  # Teth
    12: "מ",  # Mem
    13: "נ",  # Nun
    14: "ס",  # Samekh
    15: "ע",  # Ayin
    16: "פ",  # Pe
    17: "ה",  # He (Star uses Tzaddi in some systems)
    18: "ק",  # Qoph
    19: "ר",  # Resh
    20: "ש",  # Shin
    21: "ת",  # Tau
}

# Astrological/Elemental symbols (Unicode)
ASTRO_SYMBOLS = {
    "Aries": "♈", "Taurus": "♉", "Gemini": "♊", "Cancer": "♋",
    "Leo": "♌", "Virgo": "♍", "Libra": "♎", "Scorpio": "♏",
    "Sagittarius": "♐", "Capricorn": "♑", "Aquarius": "♒", "Pisces": "♓",
    "Sun": "☉", "Moon": "☽", "Mercury": "☿", "Venus": "♀",
    "Mars": "♂", "Jupiter": "♃", "Saturn": "♄",
    "Air": "🜁", "Water": "🜄", "Fire": "🜂", "Earth": "🜃",
}

THOTH_MAJOR_TITLES = {
    0: ("The Fool", "Aleph • Air", "Air"),
    1: ("The Magus", "Beth • Mercury", "Mercury"),
    2: ("The Priestess", "Gimel • Moon", "Moon"),
    3: ("The Empress", "Daleth • Venus", "Venus"),
    4: ("The Emperor", "Tzaddi • Aries", "Aries"),
    5: ("The Hierophant", "Vav • Taurus", "Taurus"),
    6: ("The Lovers", "Zain • Gemini", "Gemini"),
    7: ("The Chariot", "Cheth • Cancer", "Cancer"),
    8: ("Adjustment", "Lamed • Libra", "Libra"),
    9: ("The Hermit", "Yod • Virgo", "Virgo"),
    10: ("Fortune", "Kaph • Jupiter", "Jupiter"),
    11: ("Lust", "Teth • Leo", "Leo"),
    12: ("The Hanged Man", "Mem • Water", "Water"),
    13: ("Death", "Nun • Scorpio", "Scorpio"),
    14: ("Art", "Samekh • Sagittarius", "Sagittarius"),
    15: ("The Devil", "Ayin • Capricorn", "Capricorn"),
    16: ("The Tower", "Pe • Mars", "Mars"),
    17: ("The Star", "Tzaddi • Aquarius", "Aquarius"),
    18: ("The Moon", "Qoph • Pisces", "Pisces"),
    19: ("The Sun", "Resh • Sun", "Sun"),
    20: ("The Aeon", "Shin • Fire/Spirit", "Fire"),
    21: ("The Universe", "Tau • Saturn/Earth", "Saturn"),
}

THOTH_MINOR_TITLES = {
    "Wands": {
        1: "Root of Fire", 2: "Dominion", 3: "Virtue", 4: "Completion", 5: "Strife",
        6: "Victory", 7: "Valour", 8: "Swiftness", 9: "Strength", 10: "Oppression",
    },
    "Cups": {
        1: "Root of Water", 2: "Love", 3: "Abundance", 4: "Luxury", 5: "Disappointment",
        6: "Pleasure", 7: "Debauch", 8: "Indolence", 9: "Happiness", 10: "Satiety",
    },
    "Swords": {
        1: "Root of Air", 2: "Peace", 3: "Sorrow", 4: "Truce", 5: "Defeat",
        6: "Science", 7: "Futility", 8: "Interference", 9: "Cruelty", 10: "Ruin",
    },
    "Pentacles": {
        1: "Root of Earth", 2: "Change", 3: "Works", 4: "Power", 5: "Worry",
        6: "Success", 7: "Failure", 8: "Prudence", 9: "Gain", 10: "Wealth",
    },
}

# Enhanced Art Deco color palettes per suit
SUIT_COLOURS = {
    "major": {
        "base": [(29, 27, 42), (73, 60, 123), (94, 80, 150)],  # Deep indigo gradient
        "accent": [(233, 213, 255), (186, 148, 255), (147, 112, 219)],  # Violet-lavender
        "glow": (233, 213, 255),
    },
    "Wands": {
        "base": [(52, 19, 8), (115, 46, 16), (217, 119, 6)],  # Fire ombre
        "accent": [(251, 191, 36), (252, 211, 77), (254, 243, 199)],  # Gold gradient
        "glow": (251, 191, 36),
    },
    "Cups": {
        "base": [(4, 47, 46), (13, 148, 136), (45, 212, 191)],  # Teal depths
        "accent": [(153, 246, 228), (94, 234, 212), (20, 184, 166)],  # Aqua shimmer
        "glow": (153, 246, 228),
    },
    "Swords": {
        "base": [(15, 23, 42), (30, 58, 138), (59, 130, 246)],  # Blue steel
        "accent": [(191, 219, 254), (147, 197, 253), (96, 165, 250)],  # Sky blue
        "glow": (191, 219, 254),
    },
    "Pentacles": {
        "base": [(26, 31, 22), (63, 98, 18), (132, 204, 22)],  # Earth green
        "accent": [(217, 249, 157), (190, 242, 100), (163, 230, 53)],  # Lime radiance
        "glow": (217, 249, 157),
    },
}

SUIT_ALIASES = {
    "Pentacles": "Disks",
    "Wands": "Wands",
    "Cups": "Cups",
    "Swords": "Swords",
}

COURT_ALIASES = {
    "Page": "Princess",
    "Knight": "Prince",
    "Queen": "Queen",
    "King": "Knight",
}

RANK_LABELS = {
    1: "Ace", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
    6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
}

# Element symbols for Minor Arcana
SUIT_ELEMENTS = {
    "Wands": "Fire",
    "Cups": "Water",
    "Swords": "Air",
    "Pentacles": "Earth",
}


def slugify(value: str) -> str:
    return (
        value.lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("'", "")
        .replace(".", "")
    )


def draw_gradient_background(draw: ImageDraw.ImageDraw, width: int, height: int, colors: list):
    """Draw a vertical gradient using the color list."""
    num_colors = len(colors)
    if num_colors < 2:
        return

    segment_height = height // (num_colors - 1)

    for i in range(num_colors - 1):
        r1, g1, b1 = colors[i]
        r2, g2, b2 = colors[i + 1]

        for y in range(segment_height):
            progress = y / segment_height
            r = int(r1 + (r2 - r1) * progress)
            g = int(g1 + (g2 - g1) * progress)
            b = int(b1 + (b2 - b1) * progress)

            y_pos = i * segment_height + y
            if y_pos < height:
                draw.line([(0, y_pos), (width, y_pos)], fill=(r, g, b))


def draw_geometric_motifs(draw: ImageDraw.ImageDraw, width: int, height: int, accent_colors: list, suit: str):
    """Draw Art Deco geometric patterns inspired by Thoth deck."""
    accent = accent_colors[1] if len(accent_colors) > 1 else accent_colors[0]

    # Central mandala-like circles
    center_x, center_y = width // 2, height // 2

    # Outer circle
    draw.ellipse(
        [center_x - 140, center_y - 140, center_x + 140, center_y + 140],
        outline=accent,
        width=3,
    )

    # Middle circle
    draw.ellipse(
        [center_x - 100, center_y - 100, center_x + 100, center_y + 100],
        outline=accent,
        width=2,
    )

    # Inner circle
    draw.ellipse(
        [center_x - 60, center_y - 60, center_x + 60, center_y + 60],
        outline=accent,
        width=2,
    )

    # Radiating lines (8 directions)
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        x1 = center_x + 70 * math.cos(rad)
        y1 = center_y + 70 * math.sin(rad)
        x2 = center_x + 130 * math.cos(rad)
        y2 = center_y + 130 * math.sin(rad)
        draw.line([(x1, y1), (x2, y2)], fill=accent, width=2)

    # Corner triangles (Art Deco style)
    triangle_size = 40
    for corner in [(0, 0), (width - triangle_size, 0), (0, height - triangle_size), (width - triangle_size, height - triangle_size)]:
        x, y = corner
        if x == 0 and y == 0:  # Top-left
            draw.polygon([(x, y), (x + triangle_size, y), (x, y + triangle_size)], outline=accent, width=2)
        elif x > 0 and y == 0:  # Top-right
            draw.polygon([(x + triangle_size, y), (x + triangle_size, y + triangle_size), (x, y)], outline=accent, width=2)
        elif x == 0 and y > 0:  # Bottom-left
            draw.polygon([(x, y + triangle_size), (x + triangle_size, y + triangle_size), (x, y)], outline=accent, width=2)
        else:  # Bottom-right
            draw.polygon([(x + triangle_size, y + triangle_size), (x, y + triangle_size), (x + triangle_size, y)], outline=accent, width=2)


def draw_text_block(draw: ImageDraw.ImageDraw, text: str, box, font, fill):
    """Render wrapped text inside the bounding box."""
    x0, y0, x1, y1 = box
    width = x1 - x0
    lines = []
    if not text:
        return
    for paragraph in text.splitlines():
        wrapped = textwrap.wrap(paragraph, width=max(1, width // (font.size // 2)))
        lines.extend(wrapped if wrapped else [""])
    total_height = sum(font.getbbox(line)[3] for line in lines) + (len(lines) - 1) * 4
    current_y = y0 + max(0, (y1 - y0 - total_height) // 2)
    for line in lines:
        bbox = font.getbbox(line)
        text_width = bbox[2]
        draw.text(
            (x0 + (width - text_width) / 2, current_y),
            line,
            font=font,
            fill=fill,
        )
        current_y += bbox[3] + 4


def render_card(
    filename: Path,
    title: str,
    subtitle: str,
    keyword: str,
    suit: str,
    hebrew_letter: str = None,
    astro_symbol: str = None,
):
    """Render enhanced Thoth-style card with gradients and symbols."""
    colors = SUIT_COLOURS[suit]
    base_gradient = colors["base"]
    accent_gradient = colors["accent"]
    glow_color = colors["glow"]

    # Create base image with gradient
    image = Image.new("RGB", (WIDTH, HEIGHT), base_gradient[0])
    draw = ImageDraw.Draw(image)

    # Draw gradient background
    draw_gradient_background(draw, WIDTH, HEIGHT, base_gradient)

    # Draw geometric Art Deco motifs
    draw_geometric_motifs(draw, WIDTH, HEIGHT, accent_gradient, suit)

    # Title band with gradient
    title_gradient = Image.new("RGB", (WIDTH, TITLE_BAND), accent_gradient[0])
    title_draw = ImageDraw.Draw(title_gradient)
    draw_gradient_background(title_draw, WIDTH, TITLE_BAND, accent_gradient)
    image.paste(title_gradient, (0, 0))

    # Draw title
    draw_text_block(
        draw,
        title.upper(),
        (MARGIN, 12, WIDTH - MARGIN, TITLE_BAND - 6),
        TITLE_FONT,
        "#1a1a2e",
    )

    # Hebrew letter (top-left corner) for Major Arcana
    if hebrew_letter:
        draw.text(
            (MARGIN - 8, TITLE_BAND + 20),
            hebrew_letter,
            font=SYMBOL_FONT,
            fill=glow_color,
        )

    # Astrological symbol (top-right corner)
    if astro_symbol:
        symbol_bbox = SYMBOL_FONT.getbbox(astro_symbol)
        symbol_width = symbol_bbox[2] - symbol_bbox[0]
        draw.text(
            (WIDTH - MARGIN - symbol_width + 8, TITLE_BAND + 20),
            astro_symbol,
            font=SYMBOL_FONT,
            fill=glow_color,
        )

    # Subtitle
    draw_text_block(
        draw,
        subtitle,
        (MARGIN, TITLE_BAND + 95, WIDTH - MARGIN, TITLE_BAND + 150),
        SUBTITLE_FONT,
        glow_color,
    )

    # Keywords zone with border
    keyword_y = HEIGHT - KEYWORD_ZONE - MARGIN
    draw.rectangle(
        [MARGIN, keyword_y, WIDTH - MARGIN, HEIGHT - MARGIN],
        outline=accent_gradient[1],
        width=4,
    )

    # Inner glow effect
    draw.rectangle(
        [MARGIN + 4, keyword_y + 4, WIDTH - MARGIN - 4, HEIGHT - MARGIN - 4],
        outline=accent_gradient[0],
        width=2,
    )

    draw_text_block(
        draw,
        keyword,
        (
            MARGIN + 15,
            keyword_y + 15,
            WIDTH - MARGIN - 15,
            HEIGHT - MARGIN - 15,
        ),
        KEYWORD_FONT,
        "#e0f2fe",
    )

    # Add subtle texture overlay for Art Deco feel
    # (optional: could add noise or pattern here)

    image.save(filename, format="PNG", optimize=True)
    print(f"Generated: {filename.name}")


def build_major_cards():
    """Generate all 22 Major Arcana cards."""
    for number, (title, subtitle, astro_key) in THOTH_MAJOR_TITLES.items():
        slug = slugify(title)
        path = OUT_DIR / f"thoth_major_{number:02d}_{slug}.png"

        hebrew = HEBREW_LETTERS.get(number, "")
        astro = ASTRO_SYMBOLS.get(astro_key, "")

        render_card(
            path,
            title,
            subtitle,
            "Major Arcana • Path of Initiation",
            "major",
            hebrew_letter=hebrew,
            astro_symbol=astro,
        )


def build_minor_cards():
    """Generate all 56 Minor Arcana cards."""
    for suit, titles in THOTH_MINOR_TITLES.items():
        suit_alias = SUIT_ALIASES[suit]
        element = SUIT_ELEMENTS[suit]
        element_symbol = ASTRO_SYMBOLS.get(element, "")

        # Numbered cards (1-10)
        for rank_value in range(1, 11):
            title = titles[rank_value]
            rank_label = RANK_LABELS[rank_value]
            subtitle = f"{rank_label} of {suit_alias}"
            slug = slugify(f"{rank_label}-{suit_alias}-{title}")
            path = OUT_DIR / f"thoth_{suit_alias.lower()}_{rank_value:02d}_{slug}.png"

            render_card(
                path,
                title,
                subtitle,
                f"{title} • {suit_alias} • {element}",
                suit,
                astro_symbol=element_symbol,
            )

        # Court cards (11-14)
        for rank_value, base_rank in zip(range(11, 15), ["Page", "Knight", "Queen", "King"]):
            alias = COURT_ALIASES[base_rank]
            subtitle = f"{alias} of {suit_alias}"
            slug = slugify(f"{alias}-{suit_alias}")
            path = OUT_DIR / f"thoth_{suit_alias.lower()}_{rank_value:02d}_{slug}.png"

            render_card(
                path,
                alias,
                subtitle,
                f"Court of {suit_alias} • {element}",
                suit,
                astro_symbol=element_symbol,
            )


def main():
    """Generate all 78 enhanced Thoth placeholder cards."""
    print("Generating enhanced Thoth placeholder cards...")
    print("=" * 60)

    build_major_cards()
    build_minor_cards()

    total = len(list(OUT_DIR.glob("*.png")))
    print("=" * 60)
    print(f"✓ Generated {total} enhanced Thoth placeholder cards")
    print(f"✓ Output directory: {OUT_DIR}")
    print("\nEnhancements:")
    print("  • Art Deco gradients (3-color per suit)")
    print("  • Hebrew letters (Major Arcana)")
    print("  • Astrological symbols (all cards)")
    print("  • Geometric mandalas and radiating patterns")
    print("  • Corner triangle motifs")
    print("  • Enhanced color palettes matching Thoth aesthetic")


if __name__ == "__main__":
    main()
