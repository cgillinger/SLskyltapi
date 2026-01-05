# Projektcanvas – Konvertering av SL-tavla till Synology SPK (DSM 7, x86_64)

## 1. Projektmål (Objective)

**Primärt mål**  
Konvertera den befintliga SL‑tavleappen till ett **installerbart Synology DSM‑paket (.spk)** som:

- Installeras via **Package Center**
- Är synlig som **DSM‑applikation (ikon i huvudmenyn)**
- Exponerar webb‑UI via **Web Station / Application Portal**
- Kräver **ingen omskrivning av befintlig frontend‑logik**
- Är fullt kompatibel med **DSM 7.x**
- Är **endast avsett för x86_64‑arkitektur**

**Sekundärt mål**  
Göra appen **port‑agnostisk**, så att användaren kan ändra extern port i DSM utan kodändringar.

---

## 2. Befintlig applikation (Input)

### Arkitektur
- Statisk webbapplikation
- Ingen backend‑server
- Ingen build‑process
- All logik körs i webbläsaren

### Ingående filer (ska återanvändas oförändrade)
- `index.html`
- `app.js`
- `display-renderer.js`
- `settings.js`
- `station-search.js`
- `styles.css`
- `settings.css`
- `config.json`

### Datakällor
- SL Transport API (HTTPS, publik)
- `localStorage` (persistens)

---

## 3. Målplattform (Target Environment)

### DSM‑krav
- DSM 7.1+ / 7.2+
- Web Station installerad
- NGINX (standard)

### CPU‑arkitektur
- **x86_64 (enda målarkitektur)**

Inget ARM‑stöd ska implementeras. Ingen multi‑arch‑logik ska förekomma.

---

## 4. Grundläggande arkitekturprinciper (obligatoriska)

1. **Ingen egen serverprocess**
2. **Ingen port öppnas av appen**
3. **Alla portar hanteras av DSM**
4. **Appen ska fungera bakom reverse proxy**
5. **Frontend ska vara helt port‑agnostisk**

Dessa principer följer Synologys DSM‑säkerhetsmodell och Package SDK.

---

## 5. AI:ns huvudsakliga ansvar

### A. Skapa korrekt SPK‑struktur (DSM SDK‑kompatibel)

```
sl-tavla/
├── INFO
├── PACKAGE_ICON.PNG
├── scripts/
│   ├── preinst
│   ├── postinst
│   ├── preuninst
│   └── postuninst
└── package.tgz
    └── web/
        └── sl-tavla/
            ├── index.html
            ├── *.js
            ├── *.css
            └── config.json
```

Strukturen följer **DSM Package Developer Guide – Package Structure**.

---

### B. INFO‑fil (DSM SDK – obligatoriska fält)

INFO‑filen ska utformas enligt **DSM Package Specification** och innehålla:

- `package` – unikt paketnamn (gemener)
- `version` – semver‑kompatibel versionssträng
- `arch` – **x86_64**
- `displayname` – visningsnamn i DSM
- `description` – kort beskrivning
- `maintainer`
- `depends` – minst `WebStation`
- `adminurl` – relativ URL till webb‑UI

Exempel:
```ini
package="sl-tavla"
version="1.0.0"
arch="x86_64"
displayname="SL Avgångstavla"
description="Digital SL‑avgångstavla"
maintainer="User"
depends="WebStation"
adminurl="/sl-tavla/"
```

Regler enligt SDK:
- `adminurl` används av DSM för att öppna webb‑UI
- Paketet får **inte** exponera egna portar

---

### C. Installations‑ och avinstallationsscript (DSM SDK)

Shell‑script ska implementeras enligt **Package Lifecycle Scripts** i SDK:

#### `preinst`
- Verifiera DSM‑version
- Verifiera att Web Station finns installerad

#### `postinst`
- Extrahera `package.tgz`
- Kopiera webbapp till:
  ```
  /var/services/web/sl-tavla
  ```
- Sätta ägare och rättigheter (`http:http`)

#### `preuninst` / `postuninst`
- Rensa installerade filer
- Lämna inga processer, portar eller regler kvar

🚫 Script får **inte**:
- öppna portar
- manipulera brandvägg
- konfigurera reverse proxy
- starta bakgrundstjänster

---

## 6. Port‑hantering (DSM‑korrekt modell)

### 6.1 Arkitektonisk sanning (enligt SDK)

- Appen är statisk
- Appen kan **inte** lyssna på port
- Port hanteras av:
  - DSM Web Station
  - Application Portal
  - DSM Reverse Proxy

All port‑konfiguration sker **utanför paketet**.

---

### 6.2 Frontend‑krav (SDK‑förenligt)

Frontend ska vara **helt port‑agnostisk**.

AI:n ska verifiera att:
- ❌ Inga hårdkodade portar eller hosts förekommer
- ✔️ Endast relativa paths eller `window.location` används

---

### 6.3 Obligatorisk frontend‑anpassning

Inför en central URL‑resolver:

```js
function getBaseUrl() {
  return window.location.origin;
}
```

Alla interna URL:er ska byggas relativt:

```js
fetch(`${getBaseUrl()}/sl-tavla/config.json`);
```

Detta uppfyller DSM‑krav för reverse proxy och portändring.

---

### 6.4 Ny inställning: Extern åtkomstport (informativ)

#### Definition
- Informativ
- Dokumenterande
- Påverkar **inte** DSM eller nätverk

#### Datamodell
```json
"display": {
  "externalPort": 8088
}
```

#### Tillåtna användningar
1. Visa korrekt åtkomst‑URL i UI
2. Ingå vid export av config
3. Användas i README / installationsinfo

---

### 6.5 URL‑generering

```js
const port = config.display.externalPort;
const host = window.location.hostname;
const protocol = window.location.protocol;

const url =
  port === 80 || port === 443
    ? `${protocol}//${host}`
    : `${protocol}//${host}:${port}`;
```

---

## 7. DSM SDK‑kunskap som AI:n förutsätts följa

Denna projektplan förutsätter att AI:n följer följande delar av **DSM Developer Guide**:

- Package Structure
- INFO file specification
- Package lifecycle scripts (preinst/postinst)
- Web applications in DSM
- Application Portal (`adminurl`)
- DSM security model (ingen port‑ eller brandväggsmanipulation)

All avvikelse från dessa delar är **fel**.

---

## 8. Förbud & skyddsregler

AI:n får **inte**:
- introducera Node.js eller Python‑backend
- starta server på egen port
- manipulera `iptables`
- ändra SL‑API‑logik
- bryta bakåtkompatibilitet
- införa ARM eller multi‑arch‑logik

---

## 9. Leverabler

AI:n ska leverera:

1. 📦 Färdig `.spk` (x86_64)
2. 📄 README:
   - installationskrav
   - DSM‑styrd port‑hantering
   - åtkomst‑URL
3. 🧪 Testchecklista:
   - installation
   - DSM‑ikon
   - reverse proxy‑test
   - avinstallation

---

## 10. Acceptanskriterier

Projektet är godkänt när:

- SPK installeras utan varningar
- Appen öppnas via DSM‑ikon
- Appen fungerar oavsett extern port
- Inga hårdkodade URL:er finns
- Reverse proxy kan ändras utan kodändring
- Avinstallation lämnar inget kvar

---

## 11. Rekommenderad arbetsordning för AI

1. Läs DSM SDK‑avsnitt enligt punkt 7
2. Validera frontend‑URL‑strategi
3. Skapa SPK‑struktur
4. Generera INFO
5. Implementera lifecycle‑scripts
6. Paketera `.spk`
7. Validera mot DSM‑policy

---

### Slutlig princip

**Appen ändrar aldrig port.**  
**DSM äger nätverket – appen äger presentationen.**

