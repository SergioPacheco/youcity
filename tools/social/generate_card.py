"""YouCity announcement cards — brand identity for feed and story.

Feed: 1080×1350 (4:5) · Story: 1080×1920 (9:16).
Background: a real city photo (Wikipedia, see ``city_image.py``) with a
discreet text overlay; dark gradient fallback when no photo exists.
All text comes from the catalog; no marketing claim is invented. There
is no button or clickable element on the artwork — the Facebook image
is not clickable by region.
"""

from __future__ import annotations

import dataclasses
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

from .utils import city_modes, display_city_name, display_country_name, radio_count, total_videos

FEED_SIZE = (1080, 1350)
STORY_SIZE = (1080, 1920)

ROOT_DIR = Path(__file__).resolve().parents[2]
LOGO_LOCKUP = ROOT_DIR / "assets" / "logo-youcity.png"
LOGO_HEIGHT = 140
_lockup_cache: Image.Image | None = None
_lockup_failed = False

DARK_DEEP = "#111411"
DARK = "#1F2A22"
LIME = "#D7FF43"
WHITE = "#FFFFFF"
LIGHT = "#C9D4CC"
MUTED = "#8A978D"
STRIKE = "#64748B"


@dataclasses.dataclass(frozen=True)
class Palette:
    """Colors of a theme. Claro/premium only change the palette; spotlight changes the layout."""
    bg_top: str
    bg_bottom: str
    brand_a: str
    brand_b: str
    accent: str
    text: str
    subtext: str
    muted: str
    panel_bg: str
    panel_text: str
    badge_bg: str
    badge_text: str
    sub: str


PALETTES = {
    "premium": Palette(
        bg_top=DARK_DEEP, bg_bottom=DARK,
        brand_a=WHITE, brand_b=LIME, accent=LIME,
        text=WHITE, subtext=LIGHT, muted=MUTED,
        panel_bg=WHITE, panel_text=DARK_DEEP,
        badge_bg=LIME, badge_text=DARK_DEEP, sub=LIGHT,
    ),
    "claro": Palette(
        bg_top="#FFFFFF", bg_bottom="#DFE7DE",
        brand_a=DARK_DEEP, brand_b="#3F7A2E", accent="#3F7A2E",
        text=DARK_DEEP, subtext="#33463A", muted=MUTED,
        panel_bg=DARK_DEEP, panel_text=WHITE,
        badge_bg="#3F7A2E", badge_text=WHITE, sub="#4A5A4F",
    ),
    # Spotlight uses the dark base; the difference is the layout (giant ride count).
    "spotlight": Palette(
        bg_top=DARK_DEEP, bg_bottom=DARK,
        brand_a=WHITE, brand_b=LIME, accent=LIME,
        text=WHITE, subtext=LIGHT, muted=MUTED,
        panel_bg=WHITE, panel_text=DARK_DEEP,
        badge_bg=LIME, badge_text=DARK_DEEP, sub=LIGHT,
    ),
}


def palette_for(theme: str) -> Palette:
    return PALETTES.get(theme) or PALETTES["premium"]

MARGIN = 64
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")


def font(size: int, bold: bool = False, serif: bool = False):
    candidates = []
    if serif:
        candidates.append("DejaVuSerif-Bold.ttf" if bold else "DejaVuSerif.ttf")
    else:
        candidates.append("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    for name in candidates:
        try:
            return ImageFont.truetype(str(FONT_DIR / name), size)
        except OSError:
            continue
    return ImageFont.load_default()


def text_width(draw: ImageDraw.ImageDraw, text: str, selected: ImageFont.ImageFont) -> int:
    return int(draw.textlength(text, font=selected))


def fit_font(text: str, max_width: int, initial: int, bold: bool = False,
             serif: bool = False, minimum: int = 28):
    size = initial
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    while size > minimum:
        selected = font(size, bold, serif)
        if probe.textlength(text, font=selected) <= max_width:
            return selected
        size -= 4
    return font(minimum, bold, serif)


def wrap_lines(text: str, max_width: int, size: int, bold: bool = False,
               serif: bool = False, max_lines: int = 2, minimum: int = 48) -> tuple[list[str], object]:
    """One line whenever it fits (shrinking down to 72 or `minimum`); else
    2 balanced lines without leaving '· country' orphaned on line two."""
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    floor_single = max(72, minimum)
    current = size
    while current >= floor_single:
        selected = font(current, bold, serif)
        if probe.textlength(text, font=selected) <= max_width:
            return [text], selected
        current -= 6
    # Short texts shrink a bit more on 1 line instead of breaking.
    if len(text) <= 20:
        selected = _shrink_single(probe, text, max_width, bold, serif, 60)[1]
        if probe.textlength(text, font=selected) <= max_width:
            return [text], selected
    selected = font(current, bold, serif)
    if probe.textlength(text, font=selected) <= max_width:
        return [text], selected
    words = text.split()
    if len(words) < 2 or max_lines < 2:
        return _shrink_single(probe, text, max_width, bold, serif, minimum)
    best: list[str] | None = None
    best_score = float("inf")
    for split in range(1, len(words)):
        lines = [" ".join(words[:split]), " ".join(words[split:])]
        if all(probe.textlength(line, font=selected) <= max_width for line in lines):
            penalty = max(len(line) for line in lines)
            if lines[1].startswith("·") or len(lines[1]) < 4:
                penalty += 1000
            if penalty < best_score:
                best, best_score = lines, penalty
    if best:
        return best, selected
    return _shrink_single(probe, text, max_width, bold, serif, minimum)


def _shrink_single(probe: ImageDraw.ImageDraw, text: str, max_width: int,
                   bold: bool, serif: bool, minimum: int) -> tuple[list[str], object]:
    current = 64
    while current >= minimum:
        selected = font(current, bold, serif)
        if probe.textlength(text, font=selected) <= max_width:
            return [text], selected
        current -= 4
    selected = font(minimum, bold, serif)
    truncated = text
    while truncated and probe.textlength(truncated + "…", font=selected) > max_width:
        truncated = truncated[:-1]
    return [truncated + "…" if truncated != text else text], selected


def draw_tracked(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str,
                 selected: ImageFont.ImageFont, fill: str, tracking: int = 8) -> int:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=selected, fill=fill)
        x += draw.textlength(char, font=selected) + tracking
    return int(x - xy[0] - tracking)


def offer_texts(city: dict) -> dict:
    """All card texts, derived exclusively from the catalog."""
    from .utils import mode_keys

    name = display_city_name(city) or "Unknown city"
    country = display_country_name(city) or "Unknown country"
    modes = city_modes(city)
    keys = mode_keys(city)
    videos = total_videos(city)
    stations = radio_count(city)
    ride_word = "ride" if videos == 1 else "rides"
    facts: list[tuple[str, str]] = []
    if modes:
        facts.append(("play", " · ".join(modes)))
    if stations > 0:
        facts.append(("radio", f"{stations} local station" if stations == 1 else f"{stations} local stations"))
    facts.append(("globe", country))
    return {
        "tipo": country.upper(),
        "cidade_uf": name,
        "bairro": " · ".join(modes),
        "preco": f"{videos} {ride_word.upper()}",
        "sub": "With local radio" if stations else "Virtual city ride",
        "badge": "BEACH RIDE" if "beach_walk" in keys else "",
        "hero": str(len(modes)),
        "modalidade": country,
        "facts": facts[:3],
    }


def load_background(size: tuple[int, int], palette: Palette) -> Image.Image:
    """Vertical gradient in the theme palette."""
    width, height = size
    base = Image.new("RGB", size, palette.bg_top)
    draw = ImageDraw.Draw(base)
    top_color = Image.new("RGB", (1, 1), palette.bg_top).getpixel((0, 0))
    bottom_color = Image.new("RGB", (1, 1), palette.bg_bottom).getpixel((0, 0))
    for y in range(height):
        ratio = y / max(1, height - 1)
        draw.line([(0, y), (width, y)],
                  fill=tuple(int(a + (b - a) * ratio) for a, b in zip(top_color, bottom_color)))
    return base


def draw_brand(draw: ImageDraw.ImageDraw, x: int, y: int, palette: Palette, size: int = 78) -> None:
    selected = font(size, True)
    draw.text((x, y), "You", font=selected, fill=palette.brand_a)
    draw.text((x + draw.textlength("You", font=selected), y), "City", font=selected, fill=palette.brand_b)


def icon_globe(draw: ImageDraw.ImageDraw, x: int, y: int, s: int, color: str, width: int = 3) -> None:
    draw.ellipse((x, y, x + s, y + s), outline=color, width=width)
    draw.ellipse((x + s * 0.28, y, x + s * 0.72, y + s), outline=color, width=width)
    draw.line([(x, y + s / 2), (x + s, y + s / 2)], fill=color, width=width)


def icon_play(draw: ImageDraw.ImageDraw, x: int, y: int, s: int, color: str, width: int = 4) -> None:
    draw.rounded_rectangle((x, y + s * 0.05, x + s * 0.95, y + s), radius=10, outline=color, width=width)
    draw.polygon([(x + s * 0.38, y + s * 0.28), (x + s * 0.38, y + s * 0.77),
                  (x + s * 0.72, y + s * 0.52)], fill=color)


def icon_radio(draw: ImageDraw.ImageDraw, x: int, y: int, s: int, color: str, width: int = 4) -> None:
    cx, cy = x + s / 2, y + s * 0.72
    draw.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=color)
    draw.arc((cx - s * 0.28, cy - s * 0.28, cx + s * 0.28, cy + s * 0.28),
             start=200, end=340, fill=color, width=width)
    draw.arc((cx - s * 0.48, cy - s * 0.48, cx + s * 0.48, cy + s * 0.48),
             start=200, end=340, fill=color, width=width)


ICONS = {"globe": icon_globe, "play": icon_play, "radio": icon_radio}


def draw_offer_badge(draw: ImageDraw.ImageDraw, x: int, y: int, palette: Palette) -> int:
    """Pill 'VIRTUAL RIDE': accent outline, transparent fill. Not a button."""
    label = "VIRTUAL RIDE"
    selected = font(34, True)
    label_w = text_width(draw, label, selected)
    icon_s = 40
    gap = 18
    pad_x, pad_y = 34, 22
    height = max(icon_s, 48) + pad_y * 2
    width = pad_x + icon_s + gap + label_w + pad_x
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, outline=palette.accent, width=3)
    icon_play(draw, x + pad_x, y + (height - icon_s) // 2, icon_s, palette.accent)
    draw.text((x + pad_x + icon_s + gap, y + height // 2), label, font=selected, fill=palette.accent, anchor="lm")
    return int(y + height)


def draw_location(draw: ImageDraw.ImageDraw, x: int, y: int, texts: dict,
                  max_width: int, palette: Palette, title_size: int = 108) -> int:
    cursor = y
    draw_tracked(draw, (x, cursor), texts["tipo"], font(38, True), palette.accent, tracking=10)
    cursor += 38 + 30
    lines, title_font = wrap_lines(texts["cidade_uf"], max_width, title_size, bold=True, serif=True)
    for line in lines:
        draw.text((x, cursor), line, font=title_font, fill=palette.text)
        cursor += title_font.size + 8
    cursor += 12
    if texts["bairro"]:
        mode_lines, mode_font = wrap_lines(texts["bairro"], max_width, 44, minimum=30)
        for line in mode_lines:
            draw.text((x, cursor), line, font=mode_font, fill=palette.subtext)
            cursor += mode_font.size + 8
        cursor += 18
    else:
        cursor += 6
    draw.line([(x, cursor), (x + 72, cursor)], fill=palette.accent, width=5)
    return cursor + 26


def draw_spotlight_hero(draw: ImageDraw.ImageDraw, x: int, y: int, texts: dict,
                        max_width: int, palette: Palette, initial: int = 250) -> int:
    """Giant ride count as the protagonist (spotlight theme)."""
    hero_font = fit_font(texts["hero"], max_width, initial, bold=True, minimum=120)
    draw.text((x, y), texts["hero"], font=hero_font, fill=palette.accent)
    cursor = y + hero_font.size + 6
    caption_font = font(40, True)
    draw.text((x, cursor), "WAYS TO EXPLORE", font=caption_font, fill=palette.text)
    return cursor + caption_font.size + 28


def draw_price_panel(image: Image.Image, x: int, top: int, width: int,
                     texts: dict, palette: Palette, show_badge: bool = True) -> int:
    draw = ImageDraw.Draw(image)
    pad = 48
    inner = width - pad * 2
    badge_h = 80 if (show_badge and texts["badge"]) else 0
    big_font = fit_font(texts["preco"], inner, 128, bold=True)
    sub_h = 60 if texts["sub"] else 0
    content = pad + (badge_h + 24 if badge_h else 0) + big_font.size + 12 + sub_h + pad - 16
    draw.rounded_rectangle((x, top, x + width, top + content), radius=42, fill=palette.panel_bg)
    y = top + pad
    if badge_h:
        badge_font = font(44, True)
        badge_w = text_width(draw, texts["badge"], badge_font) + 60
        draw.rounded_rectangle((x + pad, y, x + pad + badge_w, y + badge_h), radius=26, fill=palette.badge_bg)
        draw.text((x + pad + 30, y + badge_h // 2), texts["badge"], font=badge_font, fill=palette.badge_text, anchor="lm")
        y += badge_h + 24
    draw.text((x + pad, y), texts["preco"], font=big_font, fill=palette.panel_text)
    y += big_font.size + 12
    if texts["sub"]:
        draw.text((x + pad, y), texts["sub"], font=font(46), fill=palette.subtext if palette.panel_bg == palette.bg_top else palette.muted)
    return int(top + content)


def draw_city_facts(draw: ImageDraw.ImageDraw, x: int, y: int,
                    facts: list[tuple[str, str]], max_y: int, palette: Palette) -> int:
    """Factual lines with linear icons; only what fits above the footer (never overlaps)."""
    cursor = y
    fact_font = font(36)
    for kind, text in facts:
        if cursor + 70 > max_y:
            break
        icon_s = 44
        ICONS[kind](draw, x, cursor, icon_s, palette.accent)
        draw.text((x + icon_s + 26, cursor + icon_s // 2), text, font=fact_font, fill=palette.subtext, anchor="lm")
        cursor += icon_s + 26
    return cursor


def draw_footer(draw: ImageDraw.ImageDraw, width: int, y: int, country: str, palette: Palette) -> None:
    """Editorial footer with an accent rule. Address information, not a button."""
    draw.line([(MARGIN, y), (width - MARGIN, y)], fill=palette.accent, width=3)
    row_y = y + 52
    icon_s = 46
    globe_x = width - MARGIN - icon_s
    draw.text((MARGIN, row_y), "Explore", font=font(40), fill=palette.text, anchor="lm")
    explore_w = text_width(draw, "Explore", font(40))
    site_font = font(40, True)
    site = "youcity.app"
    draw.text((MARGIN + explore_w + 16, row_y), site, font=site_font, fill=palette.accent, anchor="lm")
    cursor = MARGIN + explore_w + 16 + text_width(draw, site, site_font) + 28
    if country:
        draw.text((cursor, row_y), "|", font=font(40), fill=palette.muted, anchor="lm")
        cursor += text_width(draw, "|", font(40)) + 28
        avail = globe_x - 28 - cursor
        if avail < 200 and len(country) > 20:
            country = country[:18].rstrip() + "…"
            avail = globe_x - 28 - cursor
        country_font = fit_font(country, max(avail, 60), 40)
        draw.text((cursor, row_y), country, font=country_font, fill=palette.subtext, anchor="lm")
    icon_globe(draw, globe_x, row_y - icon_s // 2, icon_s, palette.accent)


def spotlight_sizes(texts: dict, zone: int) -> tuple[int, int]:
    """Smaller hero/title when the city name + modes need two lines each,
    so feed content never collides with the fixed footer."""
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    long_title = probe.textlength(texts["cidade_uf"], font=font(84, True, True)) > zone
    long_modes = probe.textlength(texts["bairro"], font=font(44)) > zone
    if long_title and long_modes:
        return 160, 68
    if long_title or long_modes:
        return 180, 72
    return 210, 76


def generate_feed_card(city: dict, output: Path, theme: str = "premium",
                       photo: Path | str | None = None, credit: str = "") -> Path:
    if photo:
        rendered = render_photo_card(city, FEED_SIZE, theme, photo, credit)
        if rendered is not None:
            output.parent.mkdir(parents=True, exist_ok=True)
            rendered.save(output, format="PNG", optimize=True)
            return output
    palette = palette_for(theme)
    width, height = FEED_SIZE
    texts = offer_texts(city)
    image = load_background(FEED_SIZE, palette).convert("RGBA")
    draw = ImageDraw.Draw(image)
    zone = 640

    if theme == "claro":
        # Light background: drawn dark wordmark keeps contrast.
        draw_brand(draw, MARGIN, 88, palette, 78)
        badge_bottom = draw_offer_badge(draw, MARGIN, 200, palette)
    else:
        try:
            logo_bottom = paste_lockup(image, MARGIN, 88, LOGO_HEIGHT - 20)
            draw = ImageDraw.Draw(image)
        except OSError:
            draw_brand(draw, MARGIN, 88, palette, 78)
            logo_bottom = 88 + 78
        badge_bottom = draw_offer_badge(draw, MARGIN, logo_bottom + 26, palette)
    if theme == "spotlight":
        hero_initial, title_size = spotlight_sizes(texts, zone)
        cursor = draw_spotlight_hero(draw, MARGIN, badge_bottom + 40, texts, zone, palette, initial=hero_initial)
        cursor = draw_location(draw, MARGIN, cursor + 8, texts, zone, palette, title_size=title_size)
        panel_bottom = draw_price_panel(image, MARGIN, cursor + 26, zone, texts, palette, show_badge=False)
    else:
        cursor = draw_location(draw, MARGIN, badge_bottom + 44, texts, zone, palette)
        panel_bottom = draw_price_panel(image, MARGIN, cursor + 30, zone, texts, palette)
    draw = ImageDraw.Draw(image)
    draw_city_facts(draw, MARGIN, panel_bottom + 32, texts["facts"], height - 132 - 24, palette)
    draw_footer(draw, width, height - 132, texts["modalidade"], palette)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output, format="PNG", optimize=True)
    return output


def generate_story_card(city: dict, output: Path, theme: str = "premium",
                        photo: Path | str | None = None, credit: str = "") -> Path:
    if photo:
        rendered = render_photo_card(city, STORY_SIZE, theme, photo, credit)
        if rendered is not None:
            output.parent.mkdir(parents=True, exist_ok=True)
            rendered.save(output, format="PNG", optimize=True)
            return output
    palette = palette_for(theme)
    width, height = STORY_SIZE
    texts = offer_texts(city)
    image = load_background(STORY_SIZE, palette)
    # Side veil guarantees legibility; uses the theme background color.
    base_rgb = Image.new("RGB", (1, 1), palette.bg_top).getpixel((0, 0))
    scrim = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    veil = ImageDraw.Draw(scrim)
    for x in range(int(width * 0.78)):
        alpha = int(150 * (1 - x / (width * 0.78)))
        veil.line([(x, 0), (x, height)], fill=(*base_rgb, alpha))
    image = Image.alpha_composite(image.convert("RGBA"), scrim).convert("RGB")
    draw = ImageDraw.Draw(image)

    if theme == "claro":
        draw_brand(draw, MARGIN, 120, palette, 78)
        badge_bottom = draw_offer_badge(draw, MARGIN, 232, palette)
    else:
        image = image.convert("RGBA")
        try:
            logo_bottom = paste_lockup(image, MARGIN, 120, LOGO_HEIGHT - 20)
        except OSError:
            logo_bottom = 0
        if not logo_bottom:
            draw = ImageDraw.Draw(image)
            draw_brand(draw, MARGIN, 120, palette, 78)
            logo_bottom = 120 + 78
        draw = ImageDraw.Draw(image)
        badge_bottom = draw_offer_badge(draw, MARGIN, logo_bottom + 26, palette)
        image = image.convert("RGB")
        draw = ImageDraw.Draw(image)
    if theme == "spotlight":
        cursor = draw_spotlight_hero(draw, MARGIN, badge_bottom + 44, texts, width - MARGIN * 2, palette)
        cursor = draw_location(draw, MARGIN, cursor + 8, texts, width - MARGIN * 2, palette, title_size=84)
        panel_bottom = draw_price_panel(image, MARGIN, cursor + 32, width - MARGIN * 2, texts, palette, show_badge=False)
    else:
        cursor = draw_location(draw, MARGIN, badge_bottom + 48, texts, width - MARGIN * 2, palette)
        panel_bottom = draw_price_panel(image, MARGIN, cursor + 36, width - MARGIN * 2, texts, palette)
    draw = ImageDraw.Draw(image)
    draw_city_facts(draw, MARGIN, panel_bottom + 48, texts["facts"], height - 320 - 30, palette)
    draw_footer(draw, width, height - 320, texts["modalidade"], palette)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="PNG", optimize=True)
    return output


def generate_preview_cards(city: dict, output_dir: Path, prefix: str,
                           photo: Path | str | None = None, credit: str = "") -> list[Path]:
    """Render one feed card per eligible theme (visual approval matrix)."""
    from .templates import THEMES, eligible_themes

    wanted = [theme for theme in THEMES if theme in eligible_themes(city)] or ["premium"]
    paths = []
    for theme in wanted:
        paths.append(generate_feed_card(city, output_dir / f"{prefix}_preview_{theme}.png", theme, photo, credit))
    return paths


def generate_card(city: dict, score: float, output: Path, theme: str = "premium",
                  photo: Path | str | None = None, credit: str = "") -> Path:
    """Publisher compatibility: render the feed version in the given theme."""
    return generate_feed_card(city, output, theme, photo, credit)


# ---------------------------------------------------------------------------
# Photo cards: real city photo with a discreet text overlay.
# ---------------------------------------------------------------------------

def _load_lockup() -> Image.Image | None:
    """Official horizontal lockup (dark-background variant), trimmed."""
    global _lockup_cache, _lockup_failed
    if _lockup_cache is not None:
        return _lockup_cache
    if _lockup_failed:
        return None
    try:
        logo = Image.open(LOGO_LOCKUP).convert("RGBA")
        box = logo.getbbox()
        if box:
            logo = logo.crop(box)
        _lockup_cache = logo
        return logo
    except OSError:
        _lockup_failed = True
        return None


def paste_lockup(image: Image.Image, x: int, y: int, height_px: int = LOGO_HEIGHT) -> int:
    """Paste the official lockup with a soft drop shadow. Returns bottom y.

    Raises OSError when the asset is missing — callers fall back to the
    drawn wordmark.
    """
    logo = _load_lockup()
    if logo is None:
        raise OSError(f"logo missing: {LOGO_LOCKUP}")
    scale = height_px / logo.height
    resized = logo.resize((max(1, int(logo.width * scale)), height_px), Image.LANCZOS)
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    black = Image.new("RGBA", resized.size, (0, 0, 0, 255))
    black.putalpha(resized.split()[3].point(lambda a: int(a * 0.55)))
    shadow.alpha_composite(black, (x + 4, y + 5))
    shadow = shadow.filter(ImageFilter.GaussianBlur(height_px * 0.04))
    image.alpha_composite(shadow)
    image.alpha_composite(resized, (x, y))
    return int(y + height_px)


def render_photo_card(city: dict, size: tuple[int, int], theme: str,
                      photo: Path | str, credit: str = "") -> Image.Image | None:
    """Full-bleed photo card. Returns None when the photo can't be used."""
    try:
        base = Image.open(photo).convert("RGB")
    except OSError:
        return None
    width, height = size
    scale = max(width / base.width, height / base.height)
    resized = base.resize((int(base.width * scale) + 1, int(base.height * scale) + 1), Image.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    image = resized.crop((left, top, left + width, top + height)).convert("RGBA")

    story = height > 1500
    metrics = {
        "brand_y": 120 if story else 84,
        "pill_y": 232 if story else 196,
        "footer_y": height - 320 if story else height - 132,
        "title0": 120 if story else 108,
        "zone": width - MARGIN * 2,
    }
    _photo_scrims(image, width, height)
    draw = ImageDraw.Draw(image)
    texts = offer_texts(city)

    try:
        logo_bottom = paste_lockup(image, MARGIN, metrics["brand_y"])
        draw = ImageDraw.Draw(image)
    except OSError:
        _photo_brand(draw, MARGIN, metrics["brand_y"])
        logo_bottom = metrics["brand_y"] + 78
    _photo_pill(draw, MARGIN, logo_bottom + 26)
    if theme == "spotlight":
        _photo_spotlight(draw, width, height, texts, metrics)
    elif theme == "claro":
        _photo_claro_block(image, draw, width, texts, metrics)
    else:
        _photo_bottom_block(draw, width, texts, metrics)
    _photo_footer(draw, width, texts, metrics, credit)
    return image.convert("RGB")


def _photo_scrims(image: Image.Image, width: int, height: int) -> None:
    """Bottom-heavy scrim for text + light top scrim for the brand."""
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    veil = ImageDraw.Draw(overlay)
    top_h = 360
    for y in range(top_h):
        veil.line([(0, y), (width, y)], fill=(8, 12, 10, int(130 * (1 - y / top_h))))
    start = int(height * 0.38)
    for y in range(start, height):
        ratio = (y - start) / max(1, height - 1 - start)
        veil.line([(0, y), (width, y)], fill=(8, 12, 10, int(30 + 185 * ratio * ratio)))
    image.alpha_composite(overlay)


def _ptext(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str,
           selected: ImageFont.ImageFont, fill: tuple, anchor: str = "la") -> None:
    draw.text((xy[0] + 3, xy[1] + 3), text, font=selected, fill=(0, 0, 0, 220), anchor=anchor)
    draw.text(xy, text, font=selected, fill=fill, anchor=anchor)


def _tracked_size(draw: ImageDraw.ImageDraw, text: str,
                  selected: ImageFont.ImageFont, tracking: int = 10) -> int:
    total = sum(draw.textlength(char, font=selected) + tracking for char in text)
    return int(total - tracking) if text else 0


def _photo_brand(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 78) -> None:
    selected = font(size, True)
    _ptext(draw, (x, y), "You", selected, (255, 255, 255, 255))
    _ptext(draw, (x + draw.textlength("You", font=selected), y), "City",
           selected, (*Image.new("RGB", (1, 1), LIME).getpixel((0, 0)), 255))


def _photo_pill(draw: ImageDraw.ImageDraw, x: int, y: int) -> int:
    """Frosted dark pill: translucent fill + lime outline. Not a button."""
    label = "VIRTUAL RIDE"
    selected = font(32, True)
    label_w = text_width(draw, label, selected)
    pad_x, pad_y = 30, 20
    height = 44 + pad_y * 2
    width = pad_x + label_w + pad_x
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=(8, 12, 10, 170))
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2,
                           outline=(*Image.new("RGB", (1, 1), LIME).getpixel((0, 0)), 255), width=3)
    _ptext(draw, (x + pad_x, y + height // 2), label, selected,
           (*Image.new("RGB", (1, 1), LIME).getpixel((0, 0)), 255), anchor="lm")
    return int(y + height)


def _photo_bottom_block(draw: ImageDraw.ImageDraw, width: int, texts: dict, metrics: dict) -> None:
    """Premium: bottom-left stack on the scrim (country, city, modes, facts)."""
    zone = metrics["zone"]
    country_font = font(38, True)
    city_lines, city_font = wrap_lines(texts["cidade_uf"], zone, metrics["title0"], bold=True, serif=True)
    mode_lines, mode_font = wrap_lines(texts["bairro"], zone, 44, minimum=30)
    fact_lines = _photo_fact_lines(texts)
    block = (38 + 30) + sum(city_font.size + 8 for _ in city_lines) + 12
    block += sum(mode_font.size + 8 for _ in mode_lines) + 18
    fact_space = 0
    if block + 2 * 62 + 20 < 640:
        fact_space = len(fact_lines) * 62
    top = metrics["footer_y"] - 28 - block - fact_space
    cursor = top
    _tracked(draw, (MARGIN, cursor), texts["tipo"], country_font, metrics)
    cursor += 38 + 30
    for line in city_lines:
        _ptext(draw, (MARGIN, cursor), line, city_font, (255, 255, 255, 255))
        cursor += city_font.size + 8
    cursor += 12
    for line in mode_lines:
        _ptext(draw, (MARGIN, cursor), line, mode_font, (201, 212, 204, 255))
        cursor += mode_font.size + 8
    cursor += 18
    if fact_space:
        _photo_facts(draw, MARGIN, cursor, fact_lines)


def _tracked(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str,
             selected: ImageFont.ImageFont, metrics: dict, center: int = 0) -> None:
    lime = (*Image.new("RGB", (1, 1), LIME).getpixel((0, 0)), 255)
    if center:
        x = center - _tracked_size(draw, text, selected) // 2
    else:
        x = xy[0]
    y = xy[1]
    for char in text:
        _ptext(draw, (x, y), char, selected, lime)
        x += draw.textlength(char, font=selected) + 10


def _photo_fact_lines(texts: dict) -> list[tuple[str, str]]:
    lines: list[tuple[str, str]] = []
    try:
        videos = int(str(texts["preco"]).split()[0])
    except (ValueError, IndexError):
        videos = 0
    if videos > 0:
        lines.append(("play", f"{videos} rides to explore"))
    if "local radio" in texts["sub"].lower():
        lines.append(("radio", texts["sub"]))
    return lines[:2]


def _photo_facts(draw: ImageDraw.ImageDraw, x: int, y: int, facts: list[tuple[str, str]]) -> None:
    cursor = y
    for kind, text in facts:
        ICONS[kind](draw, x, cursor, 40, "#D7FF43")
        _ptext(draw, (x + 66, cursor + 20), text, font(36), (201, 212, 204, 255), anchor="lm")
        cursor += 62


def _photo_spotlight(draw: ImageDraw.ImageDraw, width: int, height: int,
                     texts: dict, metrics: dict) -> None:
    """Spotlight: centered composition, giant city name, no facts."""
    zone = metrics["zone"]
    center = width // 2
    middle = int(height * 0.47)
    country_font = font(40, True)
    city_lines, city_font = wrap_lines(texts["cidade_uf"], zone, 150, bold=True, serif=True)
    mode_lines, mode_font = wrap_lines(texts["bairro"], zone, 44, minimum=30)
    block = (40 + 34) + sum(city_font.size + 10 for _ in city_lines) + 14
    block += sum(mode_font.size + 8 for _ in mode_lines)
    cursor = middle - block // 2
    _tracked(draw, (0, cursor), texts["tipo"], country_font, metrics, center=center)
    cursor += 40 + 34
    for line in city_lines:
        _ptext(draw, (center, cursor), line, city_font, (255, 255, 255, 255), anchor="ma")
        cursor += city_font.size + 10
    cursor += 14
    for line in mode_lines:
        _ptext(draw, (center, cursor), line, mode_font, (201, 212, 204, 255), anchor="ma")
        cursor += mode_font.size + 8


def _photo_claro_block(image: Image.Image, draw: ImageDraw.ImageDraw,
                       width: int, texts: dict, metrics: dict) -> None:
    """Claro: frosted light panel with dark text over the photo."""
    zone = metrics["zone"] - 88
    country_font = font(36, True)
    city_lines, city_font = wrap_lines(texts["cidade_uf"], zone, metrics["title0"] - 12, bold=True, serif=True)
    mode_lines, mode_font = wrap_lines(texts["bairro"], zone, 42, minimum=30)
    dark = (17, 20, 17, 255)
    gray = (51, 70, 58, 255)
    green = (*Image.new("RGB", (1, 1), "#3F7A2E").getpixel((0, 0)), 255)
    inner = (36 + 28) + sum(city_font.size + 8 for _ in city_lines) + 10
    inner += sum(mode_font.size + 8 for _ in mode_lines)
    pad = 44
    panel_h = inner + pad * 2
    panel_top = metrics["footer_y"] - 28 - panel_h
    panel = Image.new("RGBA", image.size, (0, 0, 0, 0))
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle((MARGIN, panel_top, width - MARGIN, panel_top + panel_h),
                                 radius=42, fill=(255, 255, 255, 232))
    image.alpha_composite(panel)
    draw = ImageDraw.Draw(image)
    cursor = panel_top + pad
    x = MARGIN + pad
    _tracked_dark(draw, (x, cursor), texts["tipo"], country_font, green)
    cursor += 36 + 28
    for line in city_lines:
        draw.text((x, cursor), line, font=city_font, fill=dark)
        cursor += city_font.size + 8
    cursor += 10
    for line in mode_lines:
        draw.text((x, cursor), line, font=mode_font, fill=gray)
        cursor += mode_font.size + 8


def _tracked_dark(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str,
                  selected: ImageFont.ImageFont, fill: tuple) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=selected, fill=fill)
        x += draw.textlength(char, font=selected) + 10


def _photo_footer(draw: ImageDraw.ImageDraw, width: int, texts: dict,
                  metrics: dict, credit: str) -> None:
    """Editorial footer: site on the left, photo credit on the right.

    Always light text: the bottom scrim darkens the photo behind it.
    """
    lime_rgb = Image.new("RGB", (1, 1), LIME).getpixel((0, 0))
    fy = metrics["footer_y"]
    draw.line([(MARGIN, fy), (width - MARGIN, fy)], fill=LIME, width=3)
    row_y = fy + 52
    site_font = font(40, True)
    small = font(40)
    _ptext(draw, (MARGIN, row_y), "Explore", small, (255, 255, 255, 255), anchor="lm")
    explore_w = text_width(draw, "Explore", small)
    _ptext(draw, (MARGIN + explore_w + 16, row_y), "youcity.app", site_font,
           (*lime_rgb, 255), anchor="lm")
    site_w = text_width(draw, "youcity.app", site_font)
    credit_text = _short_credit(credit, draw, width - MARGIN - (MARGIN + explore_w + 16 + site_w + 40) - MARGIN)
    if credit_text:
        _ptext(draw, (width - MARGIN, row_y), credit_text, font(24),
               (255, 255, 255, 190), anchor="rm")


def _short_credit(credit: str, draw: ImageDraw.ImageDraw, max_width: int) -> str:
    full = f"Photo: {credit}".strip()
    if not full or max_width < 120:
        return ""
    selected = font(24)
    if draw.textlength(full, font=selected) <= max_width:
        return full
    # Truncate at a word boundary so the credit never ends mid-word.
    words = full.split(" ")
    text = ""
    for word in words:
        candidate = f"{text} {word}".strip()
        if draw.textlength(candidate + " …", font=selected) > max_width:
            break
        text = candidate
    if not text or text == full:
        return text
    return text + " …"
