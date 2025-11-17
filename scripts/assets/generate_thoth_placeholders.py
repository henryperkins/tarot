#!/usr/bin/env python3
"""
Generate stylised placeholder images for the Thoth (Crowley/Harris) deck.

The real artwork is still under copyright in many jurisdictions, so this script
creates abstract cards with Thoth-specific titles, suit colours, and keywords.
The images live under public/images/cards/thoth and give the CLIP prototype
library distinct visual cues for the thoth-a1 deck profile.
"""

from __future__ import annotations

import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Canvas configuration
WIDTH = 384
HEIGHT = 640
MARGIN = 28
TITLE_BAND = 78
KEYWORD_ZONE = 140

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
    ]
    for path in search_paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    # Fallback to default PIL font if nothing else is available.
    return ImageFont.load_default()


TITLE_FONT = load_font("DejaVuSans-Bold", 38)
SUBTITLE_FONT = load_font("DejaVuSans", 24)
KEYWORD_FONT = load_font("DejaVuSans", 20)


THOTH_MAJOR_TITLES = {
    0: ("The Fool", "Aleph • Air"),
    1: ("The Magus", "Beth • Mercury"),
    2: ("The Priestess", "Gimel • Moon"),
    3: ("The Empress", "Daleth • Venus"),
    4: ("The Emperor", "Tzaddi • Aries"),
    5: ("The Hierophant", "Vav • Taurus"),
    6: ("The Lovers", "Zain • Gemini"),
    7: ("The Chariot", "Cheth • Cancer"),
    8: ("Adjustment", "Lamed • Libra"),
    9: ("The Hermit", "Yod • Virgo"),
    10: ("Fortune", "Kaph • Jupiter"),
    11: ("Lust", "Teth • Leo"),
    12: ("The Hanged Man", "Mem • Water"),
    13: ("Death", "Nun • Scorpio"),
    14: ("Art", "Samekh • Sagittarius"),
    15: ("The Devil", "Ayin • Capricorn"),
    16: ("The Tower", "Pe • Mars"),
    17: ("The Star", "Tzaddi • Aquarius"),
    18: ("The Moon", "Qoph • Pisces"),
    19: ("The Sun", "Resh • Sun"),
    20: ("The Aeon", "Shin • Fire/Spirit"),
    21: ("The Universe", "Tau • Saturn/Earth"),
}

THOTH_MINOR_TITLES = {
    "Wands": {
        1: "Root of Fire",
        2: "Dominion",
        3: "Virtue",
        4: "Completion",
        5: "Strife",
        6: "Victory",
        7: "Valour",
        8: "Swiftness",
        9: "Strength",
        10: "Oppression",
    },
    "Cups": {
        1: "Root of Water",
        2: "Love",
        3: "Abundance",
        4: "Luxury",
        5: "Disappointment",
        6: "Pleasure",
        7: "Debauch",
        8: "Indolence",
        9: "Happiness",
        10: "Satiety",
    },
    "Swords": {
        1: "Root of Air",
        2: "Peace",
        3: "Sorrow",
        4: "Truce",
        5: "Defeat",
        6: "Science",
        7: "Futility",
        8: "Interference",
        9: "Cruelty",
        10: "Ruin",
    },
    "Pentacles": {
        1: "Root of Earth",
        2: "Change",
        3: "Works",
        4: "Power",
        5: "Worry",
        6: "Success",
        7: "Failure",
        8: "Prudence",
        9: "Gain",
        10: "Wealth",
    },
}

SUIT_COLOURS = {
    "major": ("#1d1b2a", "#493c7b"),
    "Wands": ("#341308", "#d97706"),
    "Cups": ("#042f2e", "#0d9488"),
    "Swords": ("#0f172a", "#3b82f6"),
    "Pentacles": ("#1a1f16", "#84cc16"),
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
    1: "Ace",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten",
}


def slugify(value: str) -> str:
    return (
        value.lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("'", "")
        .replace(".", "")
    )


def draw_text_block(draw: ImageDraw.ImageDraw, text: str, box, font, fill):
    """
    Render wrapped text inside the bounding box.
    """

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


def render_card(filename: Path, title: str, subtitle: str, keyword: str, suit: str):
    base_colour, accent = SUIT_COLOURS[suit]
    image = Image.new("RGB", (WIDTH, HEIGHT), base_colour)
    draw = ImageDraw.Draw(image)

    # Decorative arcs give each suit a recognisable motif.
    arc_radius = WIDTH * 0.8
    draw.arc(
        [
            (WIDTH - arc_radius) / 2,
            HEIGHT * 0.25 - arc_radius / 2,
            (WIDTH + arc_radius) / 2,
            HEIGHT * 0.25 + arc_radius / 2,
        ],
        start=195,
        end=-15,
        width=6,
        fill=accent,
    )
    draw.arc(
        [
            (WIDTH - arc_radius) / 2,
            HEIGHT * 0.7 - arc_radius / 2,
            (WIDTH + arc_radius) / 2,
            HEIGHT * 0.7 + arc_radius / 2,
        ],
        start=15,
        end=195,
        width=6,
        fill=accent,
    )

    # Title band
    draw.rectangle([0, 0, WIDTH, TITLE_BAND], fill=accent)
    draw_text_block(
        draw,
        title.upper(),
        (MARGIN, 12, WIDTH - MARGIN, TITLE_BAND - 6),
        TITLE_FONT,
        "#fef9c3",
    )

    # Subtitle
    draw_text_block(
        draw,
        subtitle,
        (MARGIN, TITLE_BAND + 10, WIDTH - MARGIN, TITLE_BAND + 80),
        SUBTITLE_FONT,
        "#fef9c3",
    )

    # Keywords / epithets zone
    draw.rectangle(
        [MARGIN, HEIGHT - KEYWORD_ZONE - MARGIN, WIDTH - MARGIN, HEIGHT - MARGIN],
        outline=accent,
        width=3,
    )
    draw_text_block(
        draw,
        keyword,
        (
            MARGIN + 10,
            HEIGHT - KEYWORD_ZONE - MARGIN + 12,
            WIDTH - MARGIN - 10,
            HEIGHT - MARGIN - 12,
        ),
        KEYWORD_FONT,
        "#e0f2fe",
    )

    image.save(filename, format="PNG", optimize=True)


def build_major_cards():
    for number, (title, subtitle) in THOTH_MAJOR_TITLES.items():
        slug = slugify(title)
        path = OUT_DIR / f"thoth_major_{number:02d}_{slug}.png"
        render_card(path, title, subtitle, "Major Arcana • Macrocosm", "major")


def build_minor_cards():
    for suit, titles in THOTH_MINOR_TITLES.items():
        suit_alias = SUIT_ALIASES[suit]
        for rank_value in range(1, 11):
            title = titles[rank_value]
            rank_label = RANK_LABELS[rank_value]
            subtitle = f"{rank_label} of {suit_alias}"
            slug = slugify(f"{rank_label}-{suit_alias}-{title}")
            path = OUT_DIR / f"thoth_{suit_alias.lower()}_{rank_value:02d}_{slug}.png"
            render_card(path, title, subtitle, f"{title} • {suit_alias}", suit)
        # Courts
        for rank_value, base_rank in zip(range(11, 15), ["Page", "Knight", "Queen", "King"]):
            alias = COURT_ALIASES[base_rank]
            subtitle = f"{alias} of {suit_alias}"
            slug = slugify(f"{alias}-{suit_alias}")
            path = OUT_DIR / f"thoth_{suit_alias.lower()}_{rank_value:02d}_{slug}.png"
            render_card(path, alias, subtitle, f"Court of {suit_alias}", suit)


def main():
    build_major_cards()
    build_minor_cards()
    total = len(list(OUT_DIR.glob("*.png")))
    print(f"Generated {total} Thoth placeholder cards in {OUT_DIR}")


if __name__ == "__main__":
    main()
