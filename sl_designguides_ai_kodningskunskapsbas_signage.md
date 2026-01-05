# SL Designguides – strukturerad kunskapsbas för AI‑kodare (Signage)

*Källa: SL Designmanual 1 – Visuell identitet (ca 30 sidor)*

Detta dokument är en **extraherad, normaliserad och kodvänlig tolkning** av SL:s designmanual, anpassad för att användas som **kunskapsbas / system‑prompt** för en AI som ska generera eller validera SL‑signage (digital eller fysisk).

---

## 1. Grundprinciper (Brand rules)

### 1.1 Varumärkets kärna
- SL:s visuella identitet ska vara:
  - Konsekvent
  - Funktionell
  - Neutral men tydlig
  - Informationsdriven (aldrig dekorativ)
- Designen ska **underordna sig läsbarhet och orienterbarhet**.

**AI‑regel:**
> Prioritera läsbarhet, kontrast och konsekvens framför estetik.

---

## 2. Grundelement (obligatoriska byggblock)

Alla SL‑ytor består av följande element i strikt hierarki:

1. Logotyp
2. Spårgrafik (linjer)
3. Text
4. Färg
5. Bild (valfritt, sekundärt)

**AI‑regel:**
> Om något måste tas bort: bild → dekoration → sekundär färg. Aldrig logotyp, text eller spårgrafik.

---

## 3. Logotyp (SL‑märket)

### 3.1 Grunddefinition
- Ursprung: SL‑logotyp från 1977
- Består av:
  - Cirkulär form
  - Koncentriska linjer
  - Bokstäverna “SL”

### 3.2 Tillåtna versioner
- Färg (SL‑blå på vit)
- Vit på mörk bakgrund
- Svart på vit bakgrund

### 3.3 Förbjudet
- Ändra proportioner
- Rota
- Lägga till effekter
- Placera för nära andra objekt

### 3.4 Frizon
- Minsta fria yta = höjden av bokstaven **S** i logotypen

**AI‑regel:**
> Logotypen får aldrig skalas fritt – endast proportionellt.

---

## 4. Spårgrafik (SL‑linjer)

### 4.1 Funktion
- Är ett **orienterande element**, inte dekoration
- Binder ihop layouten horisontellt

### 4.2 Utförande
- Alltid horisontell
- Standardtjocklek enligt grid
- Färg:
  - SL‑blå (primärt)
  - Vit eller svart vid kontrastbehov

### 4.3 Placering
- Aldrig över text
- Aldrig diagonalt
- Får brytas av bild

**AI‑regel:**
> Spårgrafik används som strukturell separator – aldrig som ram eller prydnad.

---

## 5. Färgsystem

### 5.1 Primära färger

| Namn | Hex | Användning |
|----|----|----|
| SL‑Blå | #00A3E0 (≈) | Basfärg, bakgrund, linjer |
| SL‑Ljusblå | #E6F6FC | Sekundära ytor |
| Svart | #000000 | Text |
| SL‑Grå | #A6A6A6 | Sekundär text |
| Vit | #FFFFFF | Bakgrund |

### 5.2 Sekundära färger
- Används för:
  - Trafikslag
  - Markeringar
  - Undantag

Exempel:
- Röd: varning
- Grön: tillgänglighet
- Orange: tillfällig info

**AI‑regel:**
> Primär information får endast använda primär färgskala.

---

## 6. Typografi

### 6.1 Huvudtypsnitt (SL Gothic)

| Variant | Användning |
|------|-----------|
| SL Gothic Text | Brödtext |
| SL Gothic Timetable | Tidtabeller |
| SL Gothic Signage | Skyltar, hållplatser |

### 6.2 Fallback (digitalt)
- Arial
- Verdana

### 6.3 Grundregler
- Ingen kursiv i skyltning
- Versaler endast för linjebeteckningar
- Alltid vänsterställd text

**AI‑regel:**
> Om SL Gothic saknas → använd Arial Regular, aldrig Bold som standard.

---

## 7. Trafikslagssymboler

| Symbol | Betydelse |
|-----|---------|
| B | Buss |
| T | Tunnelbana |
| J | Pendeltåg |
| L | Lokalbanor |
| S | Spårväg |
| F | Färja |

- Alltid placerade före linjenummer
- Alltid samma storlek inom samma skylt

---

## 8. Grid & layoutsystem

### 8.1 Grid
- All design bygger på ett fast rutnät
- Spårgrafik ligger alltid på gridlinje
- Textblock alignas strikt

### 8.2 Format
- Anpassat för:
  - A‑format (A0–A6)
  - Liggande & stående

**AI‑regel:**
> Inga fria marginaler – allt ska förhålla sig till grid.

---

## 9. Bilder

### 9.1 Användning
- Alltid sekundär
- Aldrig bakom text
- Får brytas av spårgrafik

### 9.2 Stil
- Dokumentär
- Ingen filterbehandling
- Naturligt ljus

---

## 10. Kontrast & tillgänglighet

- Minsta kontrast text/bakgrund: hög
- Vit text endast på mörk bakgrund
- Ingen text på bild

**AI‑regel:**
> Om tveksam kontrast → välj svart text på vit bakgrund.

---

## 11. Relaxed Mode – regelverk för privat signage (SL-inspirerat)

Detta läge är avsett för **privat bruk** där målet är att uppnå ett starkt SL-intryck utan att kräva full varumärkes- eller juridisk exakthet.

### 11.1 Grundprincip för Relaxed Mode
- Följ **visuella principer**, inte exakta originalfiler
- Konsekvens > pixelperfektion
- Tydlighet > formell korrekthet

**Relaxed-regel:**
> Om en lösning *känns* som SL för en van resenär är den tillräckligt korrekt.

---

## 12. Trafikslagssymboler (Relaxed Mode – rekommenderad konstruktion)

### 12.1 Analys av originalsymbolerna
Originalsymbolerna (B, L, J, S, T) består av tre tydliga komponenter:

1. En **versal bokstav** i neutral grotesk
2. En **övre färgbalk** (trafikslagsspecifik)
3. En **undre neutral balk** (grå)

Det finns **ingen unik logotypform** i bokstaven i sig. Det är helheten och proportionerna som skapar igenkänning.

**Slutsats:**
> Ja – symbolerna kan återskapas mycket trovärdigt med rätt typsnitt + färgbalkar.

---

### 12.2 Rekommenderat typsnitt (Relaxed)

Du behöver ett typsnitt som:
- Är sans serif
- Har raka avslut
- Inte är för geometriskt (undvik Futura-känsla)

**Bra kandidater:**
- Arial Bold (mycket nära)
- Helvetica / Helvetica Now
- Inter SemiBold
- Source Sans 3 Bold

**Undvik:**
- Rounded fonts
- Humanistiska typsnitt (t.ex. Frutiger)

---

### 12.3 Proportioner (viktigare än font)

Rekommenderad symbolkonstruktion:

- Total höjd: 1.0
- Övre färgbalk: 0.15
- Bokstavsyta: 0.55
- Undre grå balk: 0.15
- Mellanrum optiskt centrerat

Bokstaven ska vara **optiskt centrerad**, inte matematiskt.

---

### 12.4 Färger (Relaxed toleranser)

| Trafikslag | Rekommenderad färg |
|---------|------------------|
| Buss | Röd / mörkröd |
| Tunnelbana | Blå |
| Pendeltåg | Grå eller mörkgrå |
| Spårväg | Grå |
| Lokalbana | Grå |
| Alternativ linje | Grön / Orange |

- Undre balk: alltid neutral grå
- Bokstav: alltid svart eller mycket mörk grå

---

### 12.5 Vad som absolut måste hållas

Även i relaxed mode:
- Samma symbolstorlek inom samma skylt
- Samma typsnitt för alla trafikslag
- Samma balkhöjd överallt

**Relaxed-regel:**
> Avvik aldrig inkonsekvent – avvik systematiskt.

---

## 13. Maskinläsbara regler (Relaxed Mode)

```json
{
  "mode": "relaxed",
  "traffic_symbols": {
    "construction": "letter + top_bar + bottom_bar",
    "font": "sans-serif-bold",
    "exact_font_required": false,
    "color_tolerance": "medium"
  },
  "branding": {
    "logo_optional": true,
    "sl_feel_required": true
  }
}
```

---

## 14. Sammanfattning för AI-generering

- Trafikslagssymboler **behöver inte vara originalfiler**
- Ett korrekt konstruerat system ger 90–95 % igenkänning
- Det är **arkitekturen**, inte detaljerna, som signalerar SL

---

*Detta relaxed-regelverk är avsiktligt tolerant men strikt konsekvent.*