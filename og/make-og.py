#!/usr/bin/env python3
"""Vorschaubilder (Open Graph, 1200 × 630) für Social Media und Blog-Vorschauen.

Erzeugt aus den Daten der Seite:
  og/umfragen.png  – Leitzahl Bund, Vergleich zur Bundestagswahl, Zeitverlauf (aus data.json)
  og/partei.png    – Bundestagswahlergebnisse seit 1998 (aus partei.json)

Braucht Pillow (`pip install pillow`) und ist deshalb, wie icons/make-icons.py, keine
Abhängigkeit der Website und nicht von update.py (das nur die Standardbibliothek nutzt).
Die Schriften (IBM Plex, SIL Open Font License) liegen in og/fonts, damit das Bild
überall gleich aussieht.

    python3 og/make-og.py

Die Leitzahl folgt derselben Rangfolge wie die Seite: Wahltrend, sonst Ø der neuesten
Umfrage je Institut. Einen veralteten Wahltrend hat update.py zu diesem Zeitpunkt
bereits verworfen.
"""
import json
import os
from datetime import date, datetime, timedelta

from PIL import Image, ImageDraw, ImageFont

HIER = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HIER)
SITE = "kaffeeundkommiss.github.io/spd-monitor"

W, H = 1200, 630
SS = 2  # Supersampling: doppelt zeichnen, dann verkleinern -> glatte Kanten
DUNKEL = "#171A21"
PAPIER = "#F5F6F2"
WEISS = "#FFFFFF"
SPDROT = "#E3000F"
BLAU = "#1E4FD8"
ROT = "#C8322B"
GRAU = "#8A909C"
LINIE = "#2A2F3A"


def schrift(name, groesse):
    return ImageFont.truetype(os.path.join(HIER, "fonts", name), groesse * SS)


SANS = lambda g: schrift("IBMPlexSans-Regular.ttf", g)
HALB = lambda g: schrift("IBMPlexSans-SemiBold.ttf", g)
FETT = lambda g: schrift("IBMPlexSans-Bold.ttf", g)
MONO = lambda g: schrift("IBMPlexMono-SemiBold.ttf", g)


def fmt(v):
    return f"{v:.1f}".replace(".", ",")


def dfmt(iso):
    return datetime.strptime(iso[:10], "%Y-%m-%d").strftime("%d.%m.%Y")


class Leinwand:
    """Koordinaten in 1200er-Pixeln, intern mit Supersampling gezeichnet."""

    def __init__(self):
        self.img = Image.new("RGB", (W * SS, H * SS), DUNKEL)
        self.d = ImageDraw.Draw(self.img)

    def rect(self, x0, y0, x1, y1, fill, r=0):
        self.d.rounded_rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], radius=r * SS, fill=fill)

    def line(self, pts, fill, w=1):
        self.d.line([(x * SS, y * SS) for x, y in pts], fill=fill, width=int(w * SS), joint="curve")

    def text(self, x, y, txt, font, fill, anchor="la"):
        self.d.text((x * SS, y * SS), txt, font=font, fill=fill, anchor=anchor)

    def breite(self, txt, font):
        return self.d.textlength(txt, font=font) / SS

    def gestrichelt(self, x0, x1, y, fill, w=2, strich=10, luecke=7):
        x = x0
        while x < x1:
            self.line([(x, y), (min(x + strich, x1), y)], fill, w)
            x += strich + luecke

    def kopf(self, untertitel):
        # Logo wie icons/icon.svg: drei weiße Balken unter gestrichelter Linie auf Rot.
        self.rect(60, 52, 116, 108, SPDROT, 13)
        for bx, by, bw, bh in [(22, 58, 16, 40), (46, 44, 16, 54), (70, 64, 16, 34)]:
            s = 56 / 120
            self.rect(60 + bx * s, 52 + by * s, 60 + (bx + bw) * s, 52 + (by + bh) * s, WEISS, 2)
        self.gestrichelt(60 + 14 * 56 / 120, 60 + 106 * 56 / 120, 52 + 50 * 56 / 120, WEISS, 2.4, 4, 3)
        self.text(136, 58, "SPD-Monitor", FETT(30), WEISS)
        self.text(136, 94, untertitel, SANS(20), GRAU)

    def fuss(self, quelle):
        self.line([(60, 560), (1140, 560)], LINIE, 1)
        self.text(60, 590, quelle, SANS(19), GRAU, "lm")
        self.text(1140, 590, SITE, MONO(19), "#FF8A80", "rm")

    def speichern(self, pfad):
        self.img.resize((W, H), Image.LANCZOS).save(pfad, optimize=True)
        print("Vorschaubild geschrieben:", os.path.relpath(pfad, ROOT))


def leitzahl(bund):
    t = bund.get("wahltrend") or {}
    if t.get("wert") is not None:
        return "Wahltrend", t["wert"], t.get("delta"), t.get("stand")
    rows = (bund.get("umfragen") or {}).get("rows") or []
    if rows:
        neueste = max(r["datum"] for r in rows)
        return "Ø neueste Umfragen", sum(r["wert"] for r in rows) / len(rows), None, neueste
    return "Keine Daten", None, None, None


def mittel_14(rows, tage=90, stichtag=None):
    """Wie gleitendesMittel() der Seite: je Umfragetag Ø der letzten 14 Tage."""
    stichtag = stichtag or date.today()
    ab = stichtag - timedelta(days=tage)
    pkt = sorted((datetime.strptime(r["datum"], "%Y-%m-%d").date(), float(r["wert"]))
                 for r in rows if r.get("datum") and r.get("wert") is not None)
    pkt = [p for p in pkt if ab <= p[0] <= stichtag]
    out = []
    for t in sorted({p[0] for p in pkt}):
        drin = [v for d, v in pkt if d <= t and (t - d).days <= 14]
        out.append((t, sum(drin) / len(drin)))
    return out, ab, stichtag


def bild_umfragen(data, pfad):
    bund = next(e for e in data["ebenen"] if e["id"] == "bund")
    art, wert, delta, stand = leitzahl(bund)
    c = Leinwand()
    c.kopf("Umfragewerte der SPD · Bund und Länder")

    c.text(60, 168, ("Bundestagswahl · " + art).upper(), HALB(20), GRAU)
    num = "–" if wert is None else fmt(wert)
    c.text(56, 196, num, MONO(150), WEISS)
    nx = 56 + c.breite(num, MONO(150))
    c.text(nx + 6, 300, "%", MONO(64), WEISS)
    if delta is not None:
        f = "#7FA0FF" if delta >= 0 else "#FF8A80"
        # Dreieck selbst zeichnen: IBM Plex Mono hat kein ▲/▼.
        sp = [(nx + 72, 296), (nx + 92, 296), (nx + 82, 278)] if delta >= 0 else \
             [(nx + 72, 280), (nx + 92, 280), (nx + 82, 298)]
        c.d.polygon([(x * SS, y * SS) for x, y in sp], fill=f)
        c.text(nx + 102, 268, fmt(abs(delta)), MONO(30), f)
        c.text(nx + 70, 312, "zur Vorwoche", SANS(18), GRAU)

    # Vergleich zur letzten Bundestagswahl, Wortlaut wie vergleichText() der Seite.
    ref = bund.get("vorwahl") or {}
    rw = ref.get("wert")
    if wert is not None and rw is not None:
        diff = wert - rw
        wahl = f"Wahl {ref.get('jahr', '')}"
        if abs(diff) < 0.05:
            lage = f"gleichauf mit der {wahl} ({fmt(rw)} %)"
        elif diff > 0:
            lage = f"{fmt(diff)} Punkte über der {wahl} ({fmt(rw)} %)"
        else:
            lage = f"{fmt(-diff)} Punkte unter der {wahl} ({fmt(rw)} %)"
        bw = c.breite(lage, HALB(22)) + 52
        c.rect(60, 382, 60 + bw, 426, "#2B1C1F", 22)
        c.d.ellipse([(80 * SS), (398 * SS), (92 * SS), (410 * SS)], fill=SPDROT)
        c.text(102, 404, lage, HALB(22), WEISS, "lm")

    # Balken 0–50 %, letzte Wahl gestrichelt
    x0, x1, y = 60, 520, 470
    c.rect(x0, y, x1, y + 18, LINIE, 9)
    if wert is not None:
        c.rect(x0, y, x0 + (x1 - x0) * min(max(wert, 0), 50) / 50, y + 18, SPDROT, 9)
    if rw is not None:
        hx = x0 + (x1 - x0) * rw / 50
        c.line([(hx, y - 12), (hx, y + 30)], WEISS, 3)
    for v in (0, 10, 20, 30, 40, 50):
        c.text(x0 + (x1 - x0) * v / 50, y + 46, f"{v} %", MONO(15), GRAU, "mm")

    # Zeitverlauf rechts
    erstellt = datetime.fromisoformat(data["erstellt"]).date() if data.get("erstellt") else date.today()
    linie, ab, bis = mittel_14(((bund.get("verlauf") or {}).get("rows") or []), stichtag=erstellt)
    gx0, gx1, gy0, gy1 = 640, 1140, 190, 500
    c.rect(gx0 - 20, gy0 - 50, gx1 + 20, gy1 + 30, "#1E222B", 16)
    c.text(gx0, gy0 - 22, "14-Tage-Mittel, letzte 90 Tage", HALB(18), GRAU, "lm")
    werte = [v for _, v in linie] + ([rw] if rw is not None else [])
    ymin = max(0, int(min(werte or [0])) - 2)
    ymax = max(ymin + 4, int(max(werte or [4])) + 2)
    X = lambda d: gx0 + (d - ab).days / max(1, (bis - ab).days) * (gx1 - gx0 - 60)
    Y = lambda v: gy1 - (v - ymin) / (ymax - ymin) * (gy1 - gy0 - 20)
    for v in range(ymin, ymax + 1, 2):
        c.line([(gx0, Y(v)), (gx1 - 60, Y(v))], "#2A2F3A", 1)
        c.text(gx0 - 8, Y(v), f"{v}", MONO(13), GRAU, "rm")
    if rw is not None:
        c.gestrichelt(gx0, gx1 - 60, Y(rw), GRAU, 2)
        c.text(gx0 + 4, Y(rw) - 16, f"Wahl {ref.get('jahr', '')}: {fmt(rw)} %", HALB(15), GRAU, "lm")
    if len(linie) >= 2:
        c.line([(X(t), Y(v)) for t, v in linie], WEISS, 3.5)
        t, v = linie[-1]
        c.text(X(t) + 10, Y(v), fmt(v) + " %", MONO(20), WEISS, "lm")

    c.fuss(f"Quelle: dawum.de (ODbL) · Stand {dfmt(stand) if stand else 'unbekannt'}")
    c.speichern(pfad)


def bild_partei(partei, pfad):
    c = Leinwand()
    c.kopf("Die SPD auf Bundesebene")
    wahlen = partei["wahlen"]
    erste, letzte = wahlen[0], wahlen[-1]
    c.text(60, 168, f"BUNDESTAGSWAHLEN {erste['jahr']}–{letzte['jahr']} · ZWEITSTIMMEN", HALB(20), GRAU)
    beste = max(wahlen, key=lambda w: w["ergebnis"])
    c.text(60, 214, f"Bestes Ergebnis {fmt(beste['ergebnis'])} % ({beste['jahr']})", HALB(26), WEISS)
    c.text(60, 254, f"Zuletzt {fmt(letzte['ergebnis'])} % ({letzte['jahr']})", HALB(26), "#FF8A80")
    reg = sum(1 for w in wahlen if w["rolle"] == "Regierung")
    c.text(60, 294, f"Danach in Regierung: {reg} von {len(wahlen)}", SANS(22), GRAU)
    vors = next((v for v in partei.get("vorsitzende", []) if not v.get("ende")), None)
    if vors:
        c.text(60, 334, f"Vorsitz seit {dfmt(vors['beginn'])}: {vors['name']}", SANS(22), GRAU)

    gx0, gx1, gy0, gy1 = 560, 1140, 170, 510
    ymax = max(16, -(-max(w["ergebnis"] for w in wahlen) // 10) * 10)
    Y = lambda v: gy1 - v / ymax * (gy1 - gy0)
    schritt = (gx1 - gx0) / len(wahlen)
    farbe = {"Regierung": SPDROT, "Opposition": "#9AA0AA", "Nicht im Bundestag": "#7A1E14"}
    for i, w in enumerate(wahlen):
        bx = gx0 + i * schritt + schritt * 0.18
        c.rect(bx, Y(w["ergebnis"]), bx + schritt * 0.64, gy1, farbe.get(w["rolle"], GRAU), 4)
        mx, my = bx + schritt * 0.32, Y(w["ergebnis"]) - 16
        c.rect(mx - 24, my - 12, mx + 24, my + 12, DUNKEL, 4)
        c.text(mx, my, fmt(w["ergebnis"]), MONO(17), WEISS, "mm")
        c.text(mx, gy1 + 22, str(w["jahr"]), MONO(16), GRAU, "mm")

    lx = 60
    rollen = {w["rolle"] for w in wahlen}
    for name, f in [(n, f) for n, f in farbe.items() if n in rollen]:
        c.rect(lx, 452, lx + 16, 468, f, 3)
        c.text(lx + 24, 460, name, SANS(18), GRAU, "lm")
        lx += 24 + c.breite(name, SANS(18)) + 28

    c.fuss(f"Quelle: Bundeswahlleiterin · Stand {dfmt(partei['stand'])}")
    c.speichern(pfad)


def main():
    with open(os.path.join(ROOT, "data.json"), encoding="utf-8") as f:
        data = json.load(f)
    with open(os.path.join(ROOT, "partei.json"), encoding="utf-8") as f:
        partei = json.load(f)
    bild_umfragen(data, os.path.join(HIER, "umfragen.png"))
    bild_partei(partei, os.path.join(HIER, "partei.png"))


if __name__ == "__main__":
    main()
