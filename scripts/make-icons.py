#!/usr/bin/env python3
"""
Erzeugt die App-Icons aus dem Logo (blaues Quadrat, weißes C).

    python3 scripts/make-icons.py

Läuft nur bei einer Logoänderung — die Ergebnisse liegen unter public/ und
sind eingecheckt, damit der Build keine Python-Abhängigkeit hat.

Drei Varianten, weil die Plattformen Unterschiedliches erwarten:
  icon-192 / icon-512  normale Icons mit abgerundeter Ecke
  icon-maskable-512    randlos, das Motiv sitzt im inneren Sicherheitskreis
                       (Android beschneidet je nach Gerät zu Kreis oder Squircle)
  apple-touch-icon     iOS rundet selbst ab und mag keine Transparenz
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

BLAU = (37, 99, 235)      # entspricht --primary
WEISS = (255, 255, 255)
ZIEL = Path(__file__).resolve().parent.parent / "public"

# Auf dem 4-fachen zeichnen und herunterrechnen — ergibt saubere Kanten
# ohne auf Anti-Aliasing der Zeichenfunktionen angewiesen zu sein.
SUPER = 4


def schrift(groesse: int) -> ImageFont.FreeTypeFont:
    for pfad in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
    ):
        try:
            return ImageFont.truetype(pfad, groesse)
        except OSError:
            continue
    return ImageFont.load_default()


def zeichne(groesse: int, radius_anteil: float, motiv_anteil: float, hintergrund) -> Image.Image:
    gross = groesse * SUPER
    bild = Image.new("RGBA", (gross, gross), (0, 0, 0, 0))
    zeichner = ImageDraw.Draw(bild)

    radius = int(gross * radius_anteil)
    zeichner.rounded_rectangle([0, 0, gross - 1, gross - 1], radius=radius, fill=hintergrund)

    # Das C mittig setzen, Größe relativ zur Fläche
    f = schrift(int(gross * motiv_anteil))
    links, oben, rechts, unten = zeichner.textbbox((0, 0), "C", font=f)
    zeichner.text(
        ((gross - (rechts - links)) / 2 - links, (gross - (unten - oben)) / 2 - oben),
        "C",
        font=f,
        fill=WEISS,
    )

    return bild.resize((groesse, groesse), Image.LANCZOS)


def main() -> None:
    ZIEL.mkdir(exist_ok=True)

    # Normale Icons: leicht abgerundet, Motiv füllt gut aus
    for groesse in (192, 512):
        zeichne(groesse, 0.22, 0.62, BLAU).save(ZIEL / f"icon-{groesse}.png")

    # Maskable: randlos und Motiv kleiner, damit der Beschnitt nichts abschneidet
    zeichne(512, 0.0, 0.44, BLAU).save(ZIEL / "icon-maskable-512.png")

    # iOS: ohne Transparenz, ohne eigene Rundung
    apple = zeichne(180, 0.0, 0.62, BLAU).convert("RGB")
    apple.save(ZIEL / "apple-touch-icon.png")

    for datei in sorted(ZIEL.glob("*.png")):
        with Image.open(datei) as bild:
            print(f"  {datei.name:26} {bild.size[0]}×{bild.size[1]} {bild.mode}")


if __name__ == "__main__":
    main()
