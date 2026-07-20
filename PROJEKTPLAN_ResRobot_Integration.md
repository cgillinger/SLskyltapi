# 🚀 PROJEKTPLAN: ResRobot Integration v3.1 - CRITICAL MULTI-CLIENT UPDATES
**Status:** FÖRSTÄRKT med kritiska säkerhetsåtgärder  
**Datum:** 2025-01-13  
**Författare:** Claude (med användarens kritiska riskanalys)

---

## 🎯 KRITISKA UPPDATERINGAR I v3.1

### ⚠️ **ARKITEKTURELL ÄNDRING: Server-Side Rate Limiting (OBLIGATORISK)**

**VARFÖR DETTA ÄR KRITISKT:**
- Appen är multi-client (flera användare kan ansluta)
- Varje användare konfigurerar egna tavlor/skyltar
- localStorage är **PER BROWSER** - fungerar INTE för server-side arkitektur
- Risk: En användare kan tömma hela kvoten för alla andra

**v3.1 LÖSNING:**
- Rate limiting flyttad till **server-side in-memory tracking** i `api_cache.js`
- Global räknare delas mellan ALLA klienter
- UI visar quota-status för transparens
- Tydlig feedback när gränsen nås

**IMPLEMENTATION:** Se Fas 1 (förstärkt)

---

### 🔒 **NORMALIZER SCOPE LOCK (HÅRDARE BEGRÄNSNINGAR)**

**VARFÖR DETTA ÄR KRITISKT:**
- Risk för "svart hål" - oändlig specialfall-hantering
- Perfekt SL-match är OMÖJLIGT (olika ID-system)
- Tid slösas på marginella förbättringar

**v3.1 SCOPE LOCK:**
- **Maxgräns: 100 rader kod** (tidigare 150)
- **Mål: ~80% accuracy** (inte 100%)
- **Dokumentation: "HEURISTISK, INTE GARANTERAT KORREKT"**

**v1 TILLÅTET:**
- Basis normaliseringar (mode, line number, direction)
- Enkel text-cleanup (trimning, case)
- Prefix/suffix removal (standard patterns)

**v1 FÖRBJUDET:**
- Fuzzy matching-algoritmer
- Stora lookup-tabeller (>100 entries)
- Machine learning / AI
- "Perfekt" match-ambitioner

**VARNINGSSIGNAL:** Om normalizer > 150 rader → STOPPA, refaktorisera

---

### 📐 **SETTINGS.JS COMPLEXITY MITIGATION**

**VARFÖR DETTA ÄR KRITISKT:**
- Fil redan stor (~1500 rader i v3)
- Nested state: tavla → skylt → resrobot
- Högsta risk för förseningar (Fas 4-5)

**v3.1 STRATEGIER:**

1. **Internal Module Separation** (trots single-file):
```javascript
// ═══════════════════════════════════════════════════════════
// MODUL: ResRobot UI Management
// ANSVAR: Endast ResRobot-specifik UI-logik
// MAX: 200 rader
// ═══════════════════════════════════════════════════════════
class ResRobotUIManager {
    constructor(settingsManager) {
        this.settings = settingsManager;
    }
    // ... ResRobot UI-specifik kod ...
}
```

2. **Extreme Naming Discipline**:
```javascript
// ❌ FEL: Vaga namn
function update() { ... }
function handle() { ... }

// ✅ RÄTT: Självförklarande namn
function updateResRobotStationSelection(tavlaIndex, stationId) { ... }
function handleResRobotPreviewButtonClick(event) { ... }
```

3. **Extensive Logging** (särskilt i början):
```javascript
console.log(`🔧 [ResRobot] Station vald: ${stationName} (${stationId}) för tavla ${tavlaIndex}`);
console.log(`📋 [ResRobot] Preview visar ${departures.length} avgångar`);
console.log(`⚠️ [ResRobot] Normalizer misslyckades: ${error.message}`);
```

---

## 📋 UPPDATERAD FASINDELNING

### **FAS 1: Backend Foundation - KRITISK MULTI-CLIENT FIX** 🔴
**Status:** Höjd prioritet - server-side rate limiting  
**Tid:** 1-2 sessioner (oförändrat)  
**Risk:** LOW → CRITICAL FIXED

#### Nya Filer

**1. `.env` (Environment Config)**
```bash
# ResRobot API Credentials
RESROBOT_API_KEY=your_api_key_here

# Rate Limiting (MULTI-CLIENT SAFE)
RESROBOT_MAX_CALLS_PER_DAY=25000
RESROBOT_RATE_LIMIT_WINDOW=86400000  # 24h i ms
```

**2. `resrobot_normalizer.js` (~100 rader) - HÅRDARE SCOPE LOCK**
```javascript
// ═══════════════════════════════════════════════════════════
// ResRobot → SL NORMALIZER v1.0
// 
// VIKTIGT: Denna normalizer är HEURISTISK, inte perfekt.
// Mål: ~80% accuracy för vanliga fall.
// 
// v1 SCOPE LOCK:
// ✅ Tillåtet: Basis-mapping, enkel text-cleanup
// ❌ Förbjudet: Fuzzy matching, stora lookup-tables, ML
// 
// MAX: 100 rader kod
// ═══════════════════════════════════════════════════════════

/**
 * Normaliserar ResRobot-avgångar till SL-format (HEURISTISKT)
 * @returns {Object} Normaliserad avgång med _source: 'resrobot'
 */
function normalizeResRobotDeparture(rrDeparture) {
    // Basis-mapping (20 rader)
    const normalized = {
        direction: rrDeparture.direction || "Okänd",
        destination: rrDeparture.name || rrDeparture.direction || "Okänd",
        expected: rrDeparture.date + "T" + rrDeparture.time,
        display: calculateDisplayTime(rrDeparture),
        
        // Mode mapping (enkel lookup, 10 entries max)
        transport_mode: mapTransportMode(rrDeparture.Product?.catCode),
        
        line: {
            designation: rrDeparture.Product?.num || "--",
            name: rrDeparture.Product?.line || "",
            transport_mode: mapTransportMode(rrDeparture.Product?.catCode)
        },
        
        // Metadata för debugging
        _source: 'resrobot',
        _originalId: rrDeparture.JourneyDetailRef?.ref || null
    };
    
    // Text cleanup (20 rader)
    normalized.destination = cleanupDestinationText(normalized.destination);
    
    return normalized;
}

// Hjälpfunktioner (max 60 rader totalt)
function mapTransportMode(catCode) {
    // Enkel lookup (10 entries)
    const modeMap = {
        '1': 'TRAIN', '2': 'BUS', '3': 'METRO',
        '4': 'TRAM', '5': 'SHIP', '6': 'BUS',
        '7': 'BUS', '8': 'TRAIN'
    };
    return modeMap[catCode] || 'BUS';
}

function cleanupDestinationText(text) {
    // Enkel cleanup (15 rader)
    return text
        .replace(/\s+via\s+.+/i, '')  // Ta bort "via X"
        .replace(/\s*\(.+\)/, '')      // Ta bort parenteser
        .trim()
        .toUpperCase();
}

function calculateDisplayTime(departure) {
    // Standard SL-format (15 rader)
    const now = new Date();
    const depTime = new Date(departure.date + "T" + departure.time);
    const diffMin = Math.round((depTime - now) / 60000);
    
    if (diffMin <= 0) return 'Nu';
    if (diffMin < 10) return `${diffMin} min`;
    return departure.time.substring(0, 5);  // "HH:MM"
}

module.exports = { normalizeResRobotDeparture };
```

**3. `resrobot_client.js` (~200 rader) - OFÖRÄNDRAT**
*(Se v3-plan för implementation)*

**4. `resrobot_adapter.js` (~150 rader) - OFÖRÄNDRAT**
*(Se v3-plan för implementation)*

#### Modifierad Fil: `api_cache.js` (+150 rader)

**KRITISK ÄNDRING: Server-Side Rate Limiting (Multi-Client Safe)**

```javascript
// ═══════════════════════════════════════════════════════════
// ResRobot Rate Limiting - MULTI-CLIENT SAFE
// 
// VARFÖR SERVER-SIDE:
// - localStorage är per-browser (fungerar EJ för multi-client)
// - Flera användare delar samma kvot
// - Global räknare måste delas mellan alla requests
// ═══════════════════════════════════════════════════════════

class ResRobotRateLimiter {
    constructor() {
        this.maxCalls = parseInt(process.env.RESROBOT_MAX_CALLS_PER_DAY) || 25000;
        this.windowMs = parseInt(process.env.RESROBOT_RATE_LIMIT_WINDOW) || 86400000;
        
        // In-memory tracking (delas mellan ALLA klienter)
        this.callCount = 0;
        this.windowStart = Date.now();
        
        console.log(`🔒 ResRobot Rate Limiter initierad: ${this.maxCalls} calls/24h (MULTI-CLIENT)`);
    }
    
    canMakeCall() {
        this.resetIfNeeded();
        return this.callCount < this.maxCalls;
    }
    
    recordCall() {
        this.resetIfNeeded();
        this.callCount++;
        
        const remaining = this.maxCalls - this.callCount;
        const percentUsed = ((this.callCount / this.maxCalls) * 100).toFixed(1);
        
        console.log(`📊 ResRobot API call #${this.callCount}/${this.maxCalls} (${percentUsed}% använt, ${remaining} kvar)`);
        
        // Varning vid 80%
        if (percentUsed >= 80 && percentUsed < 90) {
            console.warn(`⚠️ ResRobot quota 80% använd! ${remaining} calls kvar.`);
        }
        
        // Kritisk varning vid 90%
        if (percentUsed >= 90) {
            console.error(`🚨 ResRobot quota 90% använd! Endast ${remaining} calls kvar.`);
        }
    }
    
    resetIfNeeded() {
        const now = Date.now();
        if (now - this.windowStart >= this.windowMs) {
            console.log(`🔄 ResRobot quota återställd (24h förflutit)`);
            this.callCount = 0;
            this.windowStart = now;
        }
    }
    
    getStatus() {
        this.resetIfNeeded();
        return {
            used: this.callCount,
            limit: this.maxCalls,
            remaining: this.maxCalls - this.callCount,
            percentUsed: ((this.callCount / this.maxCalls) * 100).toFixed(1),
            resetAt: new Date(this.windowStart + this.windowMs).toISOString()
        };
    }
}

// Global instans (delas mellan alla requests)
const resRobotLimiter = new ResRobotRateLimiter();

// Middleware för att checka quota
function checkResRobotQuota(req, res, next) {
    if (!resRobotLimiter.canMakeCall()) {
        const status = resRobotLimiter.getStatus();
        console.error(`🚫 ResRobot quota överskriden: ${status.used}/${status.limit}`);
        
        return res.status(429).json({
            error: 'ResRobot API quota överskriden',
            status: status,
            message: `Daglig gräns (${status.limit} calls) nådd. Återställs ${new Date(status.resetAt).toLocaleString('sv-SE')}`
        });
    }
    next();
}

// Nytt endpoint: Quota Status (för UI)
app.get('/api/resrobot/status', (req, res) => {
    const status = resRobotLimiter.getStatus();
    res.json({
        quota: status,
        healthy: status.remaining > 1000  // Grönt om >1000 kvar
    });
});

// ResRobot Departures Endpoint (med rate limiting)
app.get('/api/resrobot/departures/:stopId', checkResRobotQuota, async (req, res) => {
    const { stopId } = req.params;
    
    try {
        // Fetch från ResRobot
        const departures = await fetchResRobotDepartures(stopId);
        
        // Räkna anrop EFTER framgångsrik fetch
        resRobotLimiter.recordCall();
        
        res.json({
            departures,
            _quota: resRobotLimiter.getStatus()  // Inkludera status i response
        });
        
    } catch (error) {
        console.error(`❌ ResRobot fetch error:`, error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = { resRobotLimiter, checkResRobotQuota };
```

**VIKTIGA DETALJER:**
- ✅ In-memory tracking (delas mellan alla användare)
- ✅ Middleware blockerar requests vid max
- ✅ Nytt endpoint `/api/resrobot/status` för UI
- ✅ Automatisk reset efter 24h
- ✅ Varningar vid 80% och 90%
- ✅ Quota inkluderat i response-metadata

---

### **FAS 2: ResRobot Data Integration** 🟡
**Status:** Oförändrat från v3  
**Tid:** 1-2 sessioner  
**Risk:** MEDIUM

*(Se v3-plan för detaljer)*

---

### **FAS 3: Data Merge Logic** 🟢
**Status:** Oförändrat från v3  
**Tid:** 1 session  
**Risk:** MEDIUM

*(Se v3-plan för detaljer)*

---

### **FAS 4: Settings UI Foundation** 🟡
**Status:** Oförändrat från v3  
**Tid:** 1-2 sessioner  
**Risk:** HIGH (Settings.js complexity)

*(Se v3-plan för detaljer)*

---

### **FAS 5: ResRobot Search & Selection - MED PREVIEW** 🟡
**Status:** FÖRSTÄRKT med internal modules + preview  
**Tid:** 2-3 sessioner  
**Risk:** HIGH

#### Modifierad Fil: `settings/settings.js` (+170 rader med internal modules)

**INTERN MODUL-STRUKTUR:**

```javascript
// ═══════════════════════════════════════════════════════════
// SETTINGS.JS - MODUL 1: Core Settings Manager
// ANSVAR: Grundläggande settings-hantering (OFÖRÄNDRAT)
// ═══════════════════════════════════════════════════════════
class SettingsManager {
    // ... befintlig kod ...
}

// ═══════════════════════════════════════════════════════════
// SETTINGS.JS - MODUL 2: ResRobot UI Manager (NY)
// ANSVAR: Endast ResRobot-specifik UI-logik
// MAX: 200 rader
// ═══════════════════════════════════════════════════════════
class ResRobotUIManager {
    constructor(settingsManager) {
        this.settings = settingsManager;
        this.previewCache = new Map();  // Cache för preview-data
    }
    
    /**
     * Renderar ResRobot-sektion för en tavla
     */
    renderResRobotSection(tavla, tavlaIndex, container) {
        const isEnabled = tavla.resrobot?.enabled || false;
        const selectedStop = tavla.resrobot?.stopId || null;
        const selectedStopName = tavla.resrobot?.stopName || '';
        
        const html = `
            <div class="setting-group resrobot-group">
                <div class="setting-group-header">
                    <h4>🚆 ResRobot Tidtabellsdata (Frivilligt)</h4>
                    <span class="group-description">Fyll i avgångar utanför SL:s realtidsfönster</span>
                </div>
                
                <!-- Per-Board Warning -->
                <div class="resrobot-scope-warning">
                    ⚠️ <strong>Detta gäller endast denna tavla</strong> (inte andra tavlor)
                </div>
                
                <label class="checkbox-label">
                    <input type="checkbox" class="resrobot-toggle" data-tavla="${tavlaIndex}" ${isEnabled ? 'checked' : ''}>
                    <span>Aktivera ResRobot-integration för denna tavla</span>
                </label>
                
                <div class="resrobot-config" style="display: ${isEnabled ? 'block' : 'none'}">
                    <!-- Station Search -->
                    <div class="setting-row">
                        <label>ResRobot Hållplats:</label>
                        <input type="text" 
                               class="resrobot-search" 
                               data-tavla="${tavlaIndex}"
                               placeholder="Sök hållplats i ResRobot..."
                               value="${selectedStopName}">
                    </div>
                    
                    <!-- Preview Button (visas endast om station vald) -->
                    <div class="resrobot-preview-section" style="display: ${selectedStop ? 'block' : 'none'}">
                        <button class="btn-small btn-preview-resrobot" data-tavla="${tavlaIndex}">
                            👁️ Visa exempel-avgångar (förhandsgranskning)
                        </button>
                        <div class="resrobot-preview-container"></div>
                    </div>
                    
                    <!-- Quota Status -->
                    <div class="resrobot-quota-status"></div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        this.attachEventListeners(tavlaIndex, container);
        this.updateQuotaStatus(container);
    }
    
    /**
     * Visar preview av ResRobot-avgångar (NY FUNKTION)
     */
    async showResRobotPreview(tavlaIndex) {
        const tavla = this.settings.currentConfig.tavlor[tavlaIndex];
        const stopId = tavla.resrobot?.stopId;
        
        if (!stopId) {
            console.warn('⚠️ Ingen ResRobot-station vald för preview');
            return;
        }
        
        const previewContainer = document.querySelector(`[data-tavla="${tavlaIndex}"] .resrobot-preview-container`);
        
        // Visa loading
        previewContainer.innerHTML = '<div class="loading-spinner"></div><p>Hämtar exempel-avgångar...</p>';
        
        try {
            console.log(`🔍 [ResRobot Preview] Hämtar data för stopId: ${stopId}`);
            
            const response = await fetch(`/api/resrobot/departures/${stopId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Kunde inte hämta avgångar');
            }
            
            const departures = data.departures || [];
            
            if (departures.length === 0) {
                previewContainer.innerHTML = '<p class="preview-empty">Inga avgångar hittades för denna hållplats.</p>';
                return;
            }
            
            // Visa första 5 avgångar
            const preview = departures.slice(0, 5);
            
            let html = `
                <div class="preview-success">
                    <strong>✅ Hittade ${departures.length} avgångar!</strong>
                    <p>Dessa avgångar kommer fyllas i när de ligger utanför SL:s realtidsfönster:</p>
                </div>
                <table class="preview-table">
                    <thead>
                        <tr>
                            <th>Linje</th>
                            <th>Destination</th>
                            <th>Avgång</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            preview.forEach(dep => {
                const line = dep.line?.designation || '--';
                const dest = dep.destination || 'Okänd';
                const time = dep.time?.substring(0, 5) || '--';
                
                html += `
                    <tr>
                        <td><strong>${line}</strong></td>
                        <td>${dest}</td>
                        <td>${time}</td>
                    </tr>
                `;
            });
            
            html += `
                    </tbody>
                </table>
                <div class="preview-quota">
                    <small>Quota använd: ${data._quota?.used || '?'}/${data._quota?.limit || '?'} (${data._quota?.percentUsed || '?'}%)</small>
                </div>
            `;
            
            previewContainer.innerHTML = html;
            
            // Cache preview
            this.previewCache.set(stopId, { departures, timestamp: Date.now() });
            
            console.log(`✅ [ResRobot Preview] Visade ${preview.length} avgångar`);
            
        } catch (error) {
            console.error('❌ [ResRobot Preview] Error:', error);
            previewContainer.innerHTML = `
                <div class="preview-error">
                    <strong>❌ Kunde inte hämta avgångar</strong>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
    
    /**
     * Uppdaterar quota-status i UI
     */
    async updateQuotaStatus(container) {
        const statusEl = container.querySelector('.resrobot-quota-status');
        if (!statusEl) return;
        
        try {
            const response = await fetch('/api/resrobot/status');
            const data = await response.json();
            const quota = data.quota;
            
            const percentUsed = parseFloat(quota.percentUsed);
            let statusClass = 'quota-ok';
            let statusIcon = '✅';
            
            if (percentUsed >= 90) {
                statusClass = 'quota-critical';
                statusIcon = '🚨';
            } else if (percentUsed >= 80) {
                statusClass = 'quota-warning';
                statusIcon = '⚠️';
            }
            
            statusEl.innerHTML = `
                <div class="quota-display ${statusClass}">
                    ${statusIcon} <strong>ResRobot Quota:</strong> 
                    ${quota.used}/${quota.limit} anrop (${quota.percentUsed}% använt)
                    <br>
                    <small>Återställs: ${new Date(quota.resetAt).toLocaleString('sv-SE')}</small>
                </div>
            `;
            
        } catch (error) {
            console.error('❌ Kunde inte hämta quota-status:', error);
            statusEl.innerHTML = '<p class="quota-error">Kunde inte hämta quota-status</p>';
        }
    }
    
    attachEventListeners(tavlaIndex, container) {
        // Toggle ResRobot
        container.querySelector('.resrobot-toggle')?.addEventListener('change', (e) => {
            const tavla = this.settings.currentConfig.tavlor[tavlaIndex];
            if (!tavla.resrobot) tavla.resrobot = {};
            tavla.resrobot.enabled = e.target.checked;
            
            container.querySelector('.resrobot-config').style.display = e.target.checked ? 'block' : 'none';
            
            this.settings.logChange('modify', `ResRobot ${e.target.checked ? 'aktiverat' : 'inaktiverat'} för tavla ${tavlaIndex + 1}`);
        });
        
        // Preview Button
        container.querySelector('.btn-preview-resrobot')?.addEventListener('click', () => {
            this.showResRobotPreview(tavlaIndex);
        });
        
        // ... övriga event listeners ...
    }
}

// ═══════════════════════════════════════════════════════════
// SETTINGS.JS - MODUL 3: Integration Point
// ═══════════════════════════════════════════════════════════

// Skapa ResRobot UI Manager
SettingsManager.prototype.initResRobotUI = function() {
    this.resRobotUI = new ResRobotUIManager(this);
};

// Hook in ResRobot rendering
SettingsManager.prototype.renderTavlaWithResRobot = function(tavla, index) {
    // ... befintlig tavla-rendering ...
    
    // Lägg till ResRobot-sektion
    const resrobotContainer = document.createElement('div');
    this.resRobotUI.renderResRobotSection(tavla, index, resrobotContainer);
    
    // Append till tavla
    tavlaElement.appendChild(resrobotContainer);
};
```

**NAMNGIVNINGS-EXEMPEL (Extreme Discipline):**

```javascript
// ❌ DÅLIGT: Vaga namn
function update(index) { ... }
function show() { ... }
function handleClick(e) { ... }

// ✅ BRA: Självdokumenterande
function updateResRobotStationSelectionForTavla(tavlaIndex, stationId, stationName) { ... }
function showResRobotPreviewForStop(stopId) { ... }
function handleResRobotPreviewButtonClick(event, tavlaIndex) { ... }
```

**LOGGING-EXEMPEL (Extensive från början):**

```javascript
// Varje större operation loggas
console.log(`🔧 [ResRobot] Station vald: ${stationName} (${stationId}) för tavla ${tavlaIndex}`);
console.log(`📋 [ResRobot] Preview visar ${departures.length} avgångar från ${stopName}`);
console.log(`⚠️ [ResRobot] Normalizer misslyckades för avgång ${depId}: ${error.message}`);
console.log(`✅ [ResRobot] Config sparad: ${JSON.stringify(tavla.resrobot)}`);
```

---

### **FAS 6: Config Persistence** 🟢
**Status:** Oförändrat från v3  
**Tid:** 0.5 sessioner  
**Risk:** LOW

*(Se v3-plan för detaljer)*

---

### **FAS 7: Frontend Integration** 🟡
**Status:** Oförändrat från v3  
**Tid:** 1-2 sessioner  
**Risk:** MEDIUM

*(Se v3-plan för detaljer)*

---

### **FAS 8: Testing & Debugging - MED DEBUG MODE** 🟢
**Status:** FÖRSTÄRKT med konkret debug mode  
**Tid:** 1-2 sessioner  
**Risk:** LOW

#### Debug Mode Implementation

**Aktivering:**
- Keyboard shortcut: `Ctrl+Shift+D`
- Console command: `toggleDebugMode()`

**Funktionalitet:**
```javascript
// app.js - Debug Mode
let debugModeEnabled = false;

function toggleDebugMode() {
    debugModeEnabled = !debugModeEnabled;
    document.body.classList.toggle('debug-mode', debugModeEnabled);
    
    console.log(`🐛 Debug mode: ${debugModeEnabled ? 'PÅ' : 'AV'}`);
    
    if (debugModeEnabled) {
        console.log('Debug mode visar:');
        console.log('- Källa (SL / ResRobot) för varje avgång');
        console.log('- Original ID vid hover');
        console.log('- Normaliserade värden');
    }
}

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleDebugMode();
    }
});

// Exponera globalt
window.toggleDebugMode = toggleDebugMode;
```

**CSS för Debug Mode:**
```css
/* styles.css */

/* Debug labels (döljs normalt) */
.debug-source {
    display: none;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: 8px;
}

.debug-source.sl {
    background: #00A3E0;
    color: white;
}

.debug-source.resrobot {
    background: #FF6B35;
    color: white;
}

/* Visa debug labels när debug mode är på */
body.debug-mode .debug-source {
    display: inline-block;
}

/* Hover tooltip för detaljer */
body.debug-mode tr[data-source] {
    cursor: help;
    position: relative;
}

body.debug-mode tr[data-source]:hover::after {
    content: attr(data-debug-info);
    position: absolute;
    left: 0;
    top: 100%;
    background: #2c3e50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 0.8rem;
    white-space: pre-line;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
```

**HTML Markup (från app.js):**
```javascript
function updateDeparturesTable(allDepartures, tavlaIndex) {
    // ... befintlig kod ...
    
    departures.forEach(dep => {
        const source = dep._source || 'sl';
        const debugInfo = [
            `Källa: ${source.toUpperCase()}`,
            `Original ID: ${dep._originalId || 'N/A'}`,
            `Destination (original): ${dep._originalDestination || dep.destination}`,
            `Normaliserad: ${source === 'resrobot' ? 'Ja' : 'Nej'}`
        ].join('\n');
        
        html += `
            <tr data-source="${source}" data-debug-info="${debugInfo}">
                <td>
                    <span class="table-line">${lineNumber}</span>
                    <span class="debug-source ${source}">${source.toUpperCase()}</span>
                </td>
                <td>${trafficIcon}</td>
                <td>${destination}</td>
                <td class="table-time">${time}</td>
            </tr>
        `;
    });
}
```

---

### **FAS 9: Documentation & Deployment** 🟢
**Status:** Oförändrat från v3  
**Tid:** 0.5 sessioner  
**Risk:** LOW

*(Se v3-plan för detaljer)*

---

## 📊 UPPDATERAD RISKANALYS (v3.1)

| Risk | v3 Status | v3.1 Mitigation | Ny Status |
|------|-----------|-----------------|-----------|
| **1. Normalizer Scope Creep** | HIGH | Hard lock: 100 rader max, 80% accuracy, v1 forbidden list | MEDIUM |
| **2. Rate Limiter Multi-Client** | CRITICAL | Server-side in-memory, shared quota, UI status | **LOW** ✅ |
| **3. Settings.js Complexity** | HIGH | Internal modules, extreme naming, extensive logging | HIGH (mitigated) |
| **4. Data Normalization** | MEDIUM | v1 simple, fallback strategies, lookup tables only if needed | MEDIUM |
| **5. Merge Logic** | MEDIUM | ±2 min margin, case-insensitive, extensive logging | MEDIUM |
| **6. Cascade Failure** | HIGH | Try-catch all ResRobot, SL always works, tavlor isolated | MEDIUM |

---

## 🎯 FRAMGÅNGS-KRITERIER (v3.1)

**FUNKTIONELLA KRAV:**
- [x] ResRobot-avgångar visas när SL saknar data
- [x] Normalizer klarar ~80% av vanliga fall (INTE 100%)
- [x] Merge-logik matchar korrekt destination (case-insensitive, ±2 min)
- [x] Caching fungerar korrekt (24h för tidtabeller)
- [x] **Preview visar exempel-avgångar före aktivering** ✨
- [x] **Debug mode visar källa (Ctrl+Shift+D)** ✨
- [x] **Server-side rate limiting (multi-client safe)** 🔴

**TEKNISKA KRAV:**
- [x] Normalizer max 100 rader kod 📏
- [x] Settings.js använder internal modules 📦
- [x] Extreme naming discipline genomgående 🏷️
- [x] Extensive logging från början 📝
- [x] Rate limiting i `api_cache.js` (in-memory) 🔒
- [x] UI visar quota-status tydligt 📊
- [x] Per-tavla UI-text: "Detta gäller endast denna tavla" ⚠️

**ANVÄNDARUPPLEVELSE:**
- [x] Preview minskar support-ärenden
- [x] Debug mode förenklar felsökning
- [x] Quota-status transparent
- [x] Fel isoleras per tavla (cascade prevention)
- [x] SL-data fungerar alltid (fallback)

---

## 📈 TIDSUPPSKATTNING (v3.1)

**OPTIMISTISKT SCENARIO:** 5-6 sessioner (tidigare 4-5)  
Allt fungerar första gången, inga buggar.

**REALISTISKT SCENARIO:** 7-9 sessioner (tidigare 6-8)  
Mindre justeringar i normalizer, debugging av merge-logik.

**PESSIMISTISKT SCENARIO:** 11-14 sessioner (tidigare 10-12)  
Omfattande normalizer-tweaks, Settings.js refactoring, multi-client rate limiting edge cases.

---

## 🔧 KODÄNDRINGAR SAMMANFATTNING (v3.1)

**NYA FILER:**
- `.env` (~10 rader) - API keys + rate limiting config
- `resrobot_normalizer.js` (~100 rader) - HÅRDARE SCOPE LOCK
- `resrobot_client.js` (~200 rader) - API kommunikation
- `resrobot_adapter.js` (~150 rader) - Data transformation

**MODIFIERADE FILER:**
- `api_cache.js` (+150 rader) - **Server-side rate limiting**, quota endpoint
- `index.html` (+30 rader) - Debug mode UI
- `settings/settings.js` (+170 rader) - **Internal modules**, preview functionality, extreme naming
- `settings/settings.css` (+50 rader) - ResRobot UI styling, preview, quota, debug mode
- `app.js` (+90 rader) - Merge logic, debug mode, source tracking
- `styles.css` (+40 rader) - Debug mode CSS

**TOTALT:** ~1150 rader kod (reduced från 1180 i v3)

---

## ✅ NÄSTA STEG

1. **Läs igenom v3.1-planen noggrant**
2. **Bekräfta scope locks (normalizer 100 rader, 80% accuracy)**
3. **Godkänn server-side rate limiting (kritisk för multi-client)**
4. **Start Fas 1: Backend Foundation**
   - Skapa `.env` med API key
   - Implementera `resrobot_normalizer.js` (max 100 rader)
   - Uppdatera `api_cache.js` med server-side rate limiting
   - Testa quota-endpoint

---

## 📝 SAMMANFATTNING AV v3.1 UPPDATERINGAR

**KRITISKA ÄNDRINGAR:**
1. ✅ **Server-side rate limiting** (flyttat från localStorage) - MULTI-CLIENT SAFE
2. ✅ **Hårdare normalizer scope lock** (100 rader, 80% accuracy, forbidden list)
3. ✅ **Internal modules i Settings.js** (ResRobotUIManager separation)
4. ✅ **Preview functionality** (exempel-avgångar före aktivering)
5. ✅ **Debug mode** (Ctrl+Shift+D, källa synlig, hover för detaljer)
6. ✅ **Per-tavla UI clarity** ("Detta gäller endast denna tavla")
7. ✅ **Quota-status i UI** (transparent, varningar vid 80%/90%)
8. ✅ **Extreme naming discipline** (alla funktioner självdokumenterande)
9. ✅ **Extensive logging** (alla ResRobot-operationer loggade)

**RISKMITIGERING:**
- Normalizer scope creep: HARD LOCK + forbidden list
- Multi-client rate limiting: Server-side in-memory
- Settings.js complexity: Internal modules + extreme naming

**FÖRBÄTTRAD UX:**
- Preview ger omedelbar feedback
- Debug mode förenklar support
- Quota-status transparent

---

*Ready för Fas 1 implementation när du godkänner!* 🚀
