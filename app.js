// ═══════════════════════════════════════════════════════════
// SL AVGÅNGSTAVLA - MULTI-DISPLAY SYSTEM MED THEMES
// Stöd för: classic (CSS), sci-fi
// VERSION: 3.0.0 - API-optimerad med cache/proxy
// ═══════════════════════════════════════════════════════════

console.log('🚀 SL Avgångstavla v3.0.0 laddad:', new Date().toLocaleTimeString());

// Globala variabler
let config = null;
let tavlor = []; // Array av tavlor med egna managers
let currentDeviations = [];

// ═══════════════════════════════════════════════════════════
// KONFIGURATION
// ═══════════════════════════════════════════════════════════

async function loadConfig() {
    try {
        // Använd config som redan laddats av index.html
        if (window.configData) {
            config = {
                display: window.configData.display,
                deviations: window.configData.deviations,
                styling: window.configData.styling,
                departuresTable: window.configData.departuresTable || { maxDepartures: 10 }
            };
        } else {
            // Fallback om window.configData inte finns
            const response = await fetch('config.json');
            const data = await response.json();
            config = {
                display: data.display,
                deviations: data.deviations,
                styling: data.styling,
                departuresTable: data.departuresTable || { maxDepartures: 10 }
            };
        }
        
        console.log('Config laddad:', config);
        return config;
    } catch (error) {
        console.error('Kunde inte ladda config.json:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════
// LINJE-CACHE SYSTEM
// Bygger upp en cache över tid för att fånga natt/helgtrafik
// ═══════════════════════════════════════════════════════════

const LINES_CACHE_KEY = 'sl_lines_cache';
const LINES_CACHE_EXPIRY_DAYS = 7; // Ta bort linjer som inte setts på 7 dagar

function getLinesCache() {
    try {
        const cached = localStorage.getItem(LINES_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch (e) {
        console.error('Fel vid läsning av linje-cache:', e);
        return {};
    }
}

function saveLinesCache(cache) {
    try {
        localStorage.setItem(LINES_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.error('Fel vid sparning av linje-cache:', e);
    }
}

function updateLinesCache(siteId, departures) {
    if (!departures || departures.length === 0) return;
    
    const cache = getLinesCache();
    const now = Date.now();
    const expiryMs = LINES_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    // Initiera station-cache om den saknas
    if (!cache[siteId]) {
        cache[siteId] = { lines: {}, lastUpdated: now };
    }
    
    // Extrahera linjer från avgångar
    departures.forEach(dep => {
        const mode = dep.line?.transport_mode;
        const designation = dep.line?.designation;
        const lineName = dep.line?.name || dep.direction || dep.destination;
        
        if (designation && mode) {
            const key = `${mode}-${designation}`;
            cache[siteId].lines[key] = {
                designation,
                name: lineName,
                transport_mode: mode,
                lastSeen: now
            };
        }
    });
    
    // Rensa gamla linjer som inte setts på 7 dagar
    const linesToRemove = [];
    Object.entries(cache[siteId].lines).forEach(([key, line]) => {
        if (now - line.lastSeen > expiryMs) {
            linesToRemove.push(key);
        }
    });
    
    if (linesToRemove.length > 0) {
        linesToRemove.forEach(key => delete cache[siteId].lines[key]);
        console.log(`🧹 Rensade ${linesToRemove.length} gamla linjer från cache för station ${siteId}`);
    }
    
    cache[siteId].lastUpdated = now;
    saveLinesCache(cache);
    
    const lineCount = Object.keys(cache[siteId].lines).length;
    console.log(`📦 Linje-cache uppdaterad för station ${siteId}: ${lineCount} linjer totalt`);
}

function getCachedLines(siteId) {
    const cache = getLinesCache();
    const stationCache = cache[siteId];
    
    if (!stationCache || !stationCache.lines) {
        return [];
    }
    
    // Konvertera till array och sortera
    return Object.values(stationCache.lines).sort((a, b) => {
        if (a.transport_mode !== b.transport_mode) {
            return a.transport_mode.localeCompare(b.transport_mode);
        }
        const numA = parseInt(a.designation);
        const numB = parseInt(b.designation);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.designation.localeCompare(b.designation);
    });
}

// Exponera för station-search.js
window.getLinesCache = getLinesCache;
window.getCachedLines = getCachedLines;
window.updateLinesCache = updateLinesCache;  // FAS 2: Exponera för settings.js

/**
 * Förhämta linjer för en station (används vid station-sökning i settings)
 * Gör ett API-anrop direkt för att få data även om station aldrig visats
 */
async function preloadStationCache(siteId) {
    console.log(`🔄 Förhämtar linjer för station ${siteId}...`);
    
    try {
        // Anropa departures-endpoint (startar polling + returnerar data)
        const response = await fetch(`/api/departures/${siteId}`);
        
        if (!response.ok) {
            console.error(`❌ Kunde inte förhämta station ${siteId}: ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        
        // Uppdatera client-cache med linjer från datan
        if (data.departures && data.departures.length > 0) {
            updateLinesCache(siteId, data.departures);
            console.log(`✅ Station ${siteId} förhämtad och cachad`);
            return true;
        } else {
            console.log(`⚠️ Station ${siteId} har inga avgångar just nu`);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Fel vid förhämtning av station ${siteId}:`, error);
        return false;
    }
}

// Exponera för station-search.js
window.preloadStationCache = preloadStationCache;


// ═══════════════════════════════════════════════════════════
// DISPLAY MANAGER - Hanterar CSS-baserade skyltar
// ═══════════════════════════════════════════════════════════

class DisplayManager {
    constructor(displayConfig, containerId) {
        this.config = displayConfig;
        
        // PAKET 2: Migrera gamla display-configs till ny struktur
        if (this.config.lineFilter !== undefined && !this.config.lines) {
            this.config.lines = [];
            if (this.config.lineFilter || this.config.direction) {
                this.config.lines.push({
                    lineFilter: this.config.lineFilter || null,
                    direction: this.config.direction || null
                });
            }
            delete this.config.lineFilter;
            delete this.config.direction;
            delete this.config.transportMode;
            delete this.config.lineDesignation;
        }
        this.containerId = containerId;
        this.departures = [];
        this.scrollingDepartures = [];
        this.deviationIndex = 0;
        this.lastDeviationTime = 0;
        this.showingDeviation = false;
        this.deviationTimeout = null;
        
        // GOLDEN EXAMPLE: Skapa DisplayRenderer instans
        this.renderer = new DisplayRenderer(containerId);
    }
    
    
    buildLineFilter(transportMode, lineDesignation) {
        if (transportMode && lineDesignation) {
            return `${transportMode}-${lineDesignation}`;
        } else if (transportMode) {
            return `${transportMode}-*`;
        }
        return null;
    }
    
    // ═══════════════════════════════════════════════════════════
    // FILTERERA AVGÅNGAR MED A/B-LOGIK
    // ═══════════════════════════════════════════════════════════


    filterDepartures(allDepartures) {
        let filtered = allDepartures;
        
        // PAKET 2: Hantera både gamla (single) och nya (multi) configs
        // Gamla: this.config.transportMode, this.config.lineDesignation, this.config.direction
        // Nya: this.config.lines = [{lineFilter, direction}, ...]
        
        // Om nya strukturen (lines array) finns
        if (this.config.lines && Array.isArray(this.config.lines) && this.config.lines.length > 0) {
            // Filtrera för ALLA linjer i arrayen
            const allFilteredDepartures = [];
            
            this.config.lines.forEach(line => {
                if (!line.lineFilter) {
                    // Ingen linje vald = alla linjer
                    allFilteredDepartures.push(...allDepartures);
                    return;
                }
                
                let lineFiltered = allDepartures;
                
                // Hantera lineFilter (MODE-DESIGNATION eller MODE-*)
                if (line.lineFilter.endsWith('-*')) {
                    // Alla av ett trafikslag (t.ex. "BUS-*")
                    const mode = line.lineFilter.replace('-*', '');
                    lineFiltered = lineFiltered.filter(d =>
                        d.line?.transport_mode === mode
                    );
                } else {
                    // Specifik linje (t.ex. "BUS-30")
                    const [mode, designation] = line.lineFilter.split('-');
                    lineFiltered = lineFiltered.filter(d =>
                        d.line?.transport_mode === mode &&
                        d.line?.designation === designation
                    );
                }
                
                // Filtrera riktning
                if (line.direction && line.direction !== 'null') {
                    if (line.direction === 'A' || line.direction === 'B') {
                        // A/B riktning
                        const destinationMap = {};
                        lineFiltered.forEach(dep => {
                            const dest = dep.destination || dep.direction || 'OKÄND';
                            if (!destinationMap[dest]) {
                                destinationMap[dest] = [];
                            }
                            destinationMap[dest].push(dep);
                        });
                        
                        const sortedDestinations = Object.keys(destinationMap).sort();
                        if (sortedDestinations.length > 0) {
                            const targetDest = line.direction === 'A' 
                                ? sortedDestinations[0]
                                : (sortedDestinations[1] || sortedDestinations[0]);
                            lineFiltered = destinationMap[targetDest] || [];
                        }
                    } else {
                        // Specifik destination
                        lineFiltered = lineFiltered.filter(d => 
                            (d.destination || d.direction) === line.direction
                        );
                    }
                }
                
                // Lägg till filtrerade avgångar
                allFilteredDepartures.push(...lineFiltered);
            });
            
            // SORTERA: Multi-linje ska visa tidigaste avgången först!
            return allFilteredDepartures.sort((a, b) => {
                return new Date(a.expected) - new Date(b.expected);
            });
        }
        
        // FALLBACK: Gamla strukturen (bakåtkompatibilitet)
        // STEG 1: Filtrera transportMode
        if (this.config.transportMode) {
            filtered = filtered.filter(d =>
                d.line?.transport_mode === this.config.transportMode
            );
        }

        // STEG 2: Filtrera lineDesignation
        if (this.config.lineDesignation) {
            filtered = filtered.filter(d =>
                d.line?.designation === this.config.lineDesignation
            );
        }
        
        // STEG 3: Om direction är null eller undefined, returnera allt
        if (this.config.direction === null || this.config.direction === undefined) {
            return filtered;
        }
        
        // STEG 4: Gruppera på destination
        const destinationMap = {};
        
        filtered.forEach(dep => {
            const dest = dep.destination || dep.direction || 'OKÄND';
            if (!destinationMap[dest]) {
                destinationMap[dest] = [];
            }
            destinationMap[dest].push(dep);
        });
        
        // STEG 5: Sortera destinationer alfabetiskt
        const sortedDestinations = Object.keys(destinationMap).sort();
        
        if (sortedDestinations.length === 0) {
            return [];
        }
        
        // STEG 6: Välj destination baserat på A/B
        let targetDestination;
        
        if (this.config.direction === 'A') {
            // A = första destinationen alfabetiskt
            targetDestination = sortedDestinations[0];
        } else if (this.config.direction === 'B') {
            // B = andra destinationen alfabetiskt
            targetDestination = sortedDestinations[1] || sortedDestinations[0];
        } else {
            // Okänd direction, visa allt
            return filtered;
        }
        
        // STEG 7: Returnera bara avgångar till vald destination
        return destinationMap[targetDestination] || [];
    }

    
    formatTime(expectedTime) {
        const now = new Date();
        const departure = new Date(expectedTime);
        const diffMs = departure - now;
        const diffMin = Math.floor(diffMs / 60000);
        
        if (diffMin <= 0) {
            return 'Nu';
        } else if (diffMin < 10) {
            return `${diffMin} min`;
        } else {
            const hours = departure.getHours().toString().padStart(2, '0');
            const minutes = departure.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }
    }
    
    updateMainDeparture() {
        const departure = this.departures[0];
        
        if (!departure) {
            // Ingen avgång - visa placeholder
            const mainDiv = document.querySelector(`#${this.containerId} .main-departure`);
            if (mainDiv) {
                mainDiv.innerHTML = `
                    <div class="left-section">
                        <span class="line-number">--</span>
                        <div class="destination-viewport">
                            <span class="destination-text">INGA AVGÅNGAR</span>
                        </div>
                    </div>
                    <span class="time">--</span>
                `;
            }
            return;
        }
        
        // GOLDEN EXAMPLE: Delegera till DisplayRenderer
        this.renderer.renderMainDeparture(departure);
    }
    
    updateScrollingDepartures() {
        const scrollContent = document.querySelector(`#${this.containerId} .scroll-content`);
        if (!scrollContent) return;
        
        const now = Date.now();
        
        // Om vi redan visar en störning, fortsätt visa den tills timern går ut
        if (this.showingDeviation) {
            // Inget att göra - timern hanterar återgång till avgångar
            return;
        }
        
        // Kolla om det är dags att visa en störning
        const timeSinceLastDeviation = now - this.lastDeviationTime;
        const shouldShowDeviation = config.deviations.enabled && 
                                   currentDeviations.length > 0 &&
                                   timeSinceLastDeviation >= config.deviations.displayInterval;
        
        if (shouldShowDeviation) {
            // Starta visning av störning
            this.showingDeviation = true;
            this.lastDeviationTime = now;
            
            // Visa störningen
            scrollContent.innerHTML = `⚠ ${currentDeviations[this.deviationIndex % currentDeviations.length].message}`;
            this.deviationIndex++;
            
            // Sätt timer för att återgå till avgångar efter X sekunder
            if (this.deviationTimeout) {
                clearTimeout(this.deviationTimeout);
            }
            
            this.deviationTimeout = setTimeout(() => {
                this.showingDeviation = false;
                // Rendera avgångar igen
                this.renderer.renderScrollingDepartures(this.scrollingDepartures);
            }, config.deviations.displayDuration);
            
            console.log(`⚠️ Visar störning i ${config.deviations.displayDuration}ms, nästa visning om ${config.deviations.displayInterval}ms`);
        } else {
            // Visa normala avgångar
            this.renderer.renderScrollingDepartures(this.scrollingDepartures);
        }
    }
    
    update(allDepartures) {
        this.departures = this.filterDepartures(allDepartures);
        
        if (this.departures.length > 0) {
            this.scrollingDepartures = this.departures.slice(1, this.config.maxScrollingDepartures + 1);
        } else {
            this.scrollingDepartures = [];
        }
        
        this.updateMainDeparture();
        this.updateScrollingDepartures();
    }
}

// ═══════════════════════════════════════════════════════════
// API INTEGRATION
// ═══════════════════════════════════════════════════════════

async function fetchDepartures(siteId) {
    try {
        const url = `/api/departures/${siteId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Uppdatera linje-cache med varje hämtning
        if (data && data.departures) {
            updateLinesCache(siteId, data.departures);
        }
        
        return data;
    } catch (error) {
        console.error('Fel vid hämtning av avgångar:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════
// AVGÅNGSTABELL
// ═══════════════════════════════════════════════════════════

function updateDeparturesTable(allDepartures, tavlaIndex = 0, tableLineFilter = null) {
    const tbody = document.querySelector(`#tavla-${tavlaIndex} .tavla-departures-tbody`);
    
    if (!tbody) {
        console.warn(`Kunde inte hitta tbody för tavla ${tavlaIndex}`);
        return;
    }
    
    if (!allDepartures || allDepartures.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Inga avgångar tillgängliga</td></tr>';
        return;
    }
    
    // Filtrera avgångar om tableLineFilter är satt
    let filteredDepartures = allDepartures;
    if (tableLineFilter && typeof tableLineFilter === 'object' && Object.keys(tableLineFilter).length > 0) {
        filteredDepartures = allDepartures.filter(dep => {
            const mode = dep.line?.transport_mode || 'UNKNOWN';
            const designation = dep.line?.designation || '';
            const lineKey = `${mode}-${designation}`;
            const destination = dep.destination || dep.direction;
            
            // Om linjen inte finns i filter, visa inte
            if (!tableLineFilter.hasOwnProperty(lineKey)) {
                return false;
            }
            
            const directionFilter = tableLineFilter[lineKey];
            
            // "both" = visa båda riktningar
            if (directionFilter === 'both') {
                return true;
            }
            
            // Specifik riktning = matcha destination
            return destination === directionFilter;
        });
        console.log(`📊 Tavla ${tavlaIndex}: Filtrerar tabell med riktningar - ${filteredDepartures.length}/${allDepartures.length} avgångar matchar filter`);
    }
    
    // Läs antal från config (default 10)
    const maxDepartures = config.departuresTable?.maxDepartures || 10;
    const departuresToShow = filteredDepartures.slice(0, maxDepartures);
    
    // Bygg HTML för faktiska avgångar
    let html = departuresToShow.map(dep => {
        const lineNumber = dep.line?.designation || '--';
        const destination = dep.destination || dep.direction || 'Okänd';
        const time = formatTableTime(dep.expected);
        const transportMode = dep.line?.transport_mode || 'UNKNOWN';
        const trafficIcon = getTrafficIcon(transportMode);
        
        return `
            <tr>
                <td><span class="table-line">${lineNumber}</span></td>
                <td>
                    <span class="traffic-icon">
                        <span class="traffic-top ${trafficIcon.class}"></span>
                        <span class="traffic-letter">${trafficIcon.symbol}</span>
                        <span class="traffic-bottom"></span>
                    </span>
                </td>
                <td>${destination}</td>
                <td class="table-time">${time}</td>
            </tr>
        `;
    }).join('');
    
    // Fyll ut med tomma rader till maxDepartures
    const emptyRows = maxDepartures - departuresToShow.length;
    for (let i = 0; i < emptyRows; i++) {
        html += `
            <tr class="empty-row">
                <td colspan="4" style="color: #E6F6FC; user-select: none;">—</td>
            </tr>
        `;
    }
    
    tbody.innerHTML = html;
    
    console.log(`📊 Tavla ${tavlaIndex}: Visar ${departuresToShow.length} avgångar (${emptyRows} tomma rader, totalt: ${maxDepartures})`);
}

function getTrafficIcon(transportMode) {
    const icons = {
        'METRO': { symbol: 'T', class: 'traffic-metro' },
        'BUS': { symbol: 'B', class: 'traffic-bus' },
        'TRAIN': { symbol: 'J', class: 'traffic-train' },
        'TRAM': { symbol: 'S', class: 'traffic-tram' },
        'SHIP': { symbol: 'F', class: 'traffic-ship' },
        'FERRY': { symbol: 'F', class: 'traffic-ship' }
    };
    
    return icons[transportMode] || { symbol: '?', class: 'traffic-unknown' };
}

function formatTableTime(expectedTime) {
    const now = new Date();
    const departure = new Date(expectedTime);
    const diffMs = departure - now;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin <= 0) {
        return 'Nu';
    } else if (diffMin < 10) {
        return `${diffMin} min`;
    } else {
        const hours = departure.getHours().toString().padStart(2, '0');
        const minutes = departure.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}

// ═══════════════════════════════════════════════════════════
// UPPDATERINGSLOOP
// ═══════════════════════════════════════════════════════════

async function updateAllDisplays() {
    if (!config) return;
    
    // Uppdatera varje tavla separat
    for (let tavlaIndex = 0; tavlaIndex < tavlor.length; tavlaIndex++) {
        const tavla = tavlor[tavlaIndex];
        const data = await fetchDepartures(tavla.station.siteId);
        
        if (!data || !data.departures) {
            console.error(`Ingen data för tavla ${tavlaIndex} (${tavla.station.name})`);
            continue;
        }
        
        const allDepartures = data.departures.sort((a, b) => {
            return new Date(a.expected) - new Date(b.expected);
        });
        
        if (data.stop_deviations) {
            currentDeviations = data.stop_deviations;
        }
        
        // Uppdatera CSS-baserade displays för denna tavla
        tavla.displayManagers.forEach(manager => {
            manager.update(allDepartures);
        });
        
        // Uppdatera avgångstabell för denna tavla (med eventuellt linjefilter)
        const tableLineFilter = tavla.tableLineFilter || null;
        updateDeparturesTable(allDepartures, tavlaIndex, tableLineFilter);
    }
}

// ═══════════════════════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════════════════════

function applyTheme(theme) {
    const body = document.body;
    
    // Ta bort alla tema-klasser
    body.classList.remove('theme-classic', 'theme-sci-fi', 'theme-e-ink', 'theme-retro-terminal', 'theme-sl-modern', 'theme-sl-modern-2', 'theme-art-deco-1920');
    
    // Lägg till valt tema
    const validThemes = ['classic', 'sci-fi', 'e-ink', 'retro-terminal', 'sl-modern', 'sl-modern-2', 'art-deco-1920'];
    const themeNames = {
        'classic': 'Classic CSS LED',
        'sci-fi': 'Sci-Fi Futuristic',
        'e-ink': 'E-Ink (grå)',
        'retro-terminal': 'Retro Terminal (grön)',
        'sl-modern': 'SL Modern (blå)',
        'sl-modern-2': 'SL Modern 2 (vit)',
        'art-deco-1920': 'Art Deco 1920'
    };
    
    if (validThemes.includes(theme)) {
        body.classList.add(`theme-${theme}`);
        console.log(`🎨 Theme: ${themeNames[theme]}`);
    } else {
        body.classList.add('theme-classic');
        console.log('🎨 Theme: Classic CSS LED (default)');
    }
}

function applyCustomStyling() {
    if (!config.styling) return;
    
    if (config.styling.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', config.styling.primaryColor);
    }
    
    if (config.styling.backgroundColor) {
        document.documentElement.style.setProperty('--background-color', config.styling.backgroundColor);
    }
}


// ═══════════════════════════════════════════════════════════
// MANUELL NATT-REFRESH FUNKTIONALITET
// ═══════════════════════════════════════════════════════════

let lastManualRefresh = 0;
const COOLDOWN_MS = 10 * 1000; // 10 sekunder

/**
 * Visa/dölj refresh-knapp baserat på tid (01:00-05:00)
 */
function updateRefreshButtonVisibility() {
    const hour = new Date().getHours();
    const isNight = hour >= 1 && hour < 5;
    const btn = document.getElementById('manual-refresh-btn');
    const timestamp = document.getElementById('update-timestamp');
    
    if (btn) {
        btn.style.display = isNight ? 'inline-flex' : 'none';
    }
    
    // Visa timestamp bara nattetid
    if (timestamp) {
        timestamp.style.display = isNight ? 'block' : 'none';
    }
}

/**
 * Visa notifikation
 */
function showNotification(message = 'Avgångar uppdaterade!', duration = 2500) {
    const notification = document.getElementById('update-notification');
    if (!notification) return;
    
    // Uppdatera text
    const textEl = notification.querySelector('.notification-text');
    if (textEl) {
        textEl.textContent = message;
    }
    
    // Visa
    notification.classList.add('show');
    
    // Dölj efter duration
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

/**
 * Uppdatera timestamp
 */
function updateTimestamp() {
    const timestampEl = document.getElementById('timestamp-text');
    if (!timestampEl) return;
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    timestampEl.textContent = `${hours}:${minutes}:${seconds}`;
}

/**
 * Manuell refresh med cooldown
 */
async function manualRefresh() {
    const btn = document.getElementById('manual-refresh-btn');
    if (!btn) return;
    
    // Kolla cooldown
    const now = Date.now();
    const timeSinceLastRefresh = now - lastManualRefresh;
    
    if (timeSinceLastRefresh < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastRefresh) / 1000);
        showNotification(`⏱️ Vänta ${remainingSeconds}s innan nästa uppdatering`, 2000);
        return;
    }
    
    // Disable + spinner
    btn.disabled = true;
    btn.classList.add('spinning');
    
    console.log('🔄 Manuell uppdatering startad...');
    
    try {
        // Tvinga ny hämtning för alla displays
        await updateAllDisplays();
        
        // Uppdatera timestamp
        lastManualRefresh = now;
        updateTimestamp();
        
        // Visa notifikation
        showNotification('✅ Avgångar uppdaterade!', 2500);
        
        console.log('✅ Manuell uppdatering klar');
        
    } catch (error) {
        console.error('❌ Manuell uppdatering misslyckades:', error);
        showNotification('❌ Uppdatering misslyckades', 2500);
        
    } finally {
        // Enable + ta bort spinner (efter liten delay för UX)
        setTimeout(() => {
            btn.disabled = false;
            btn.classList.remove('spinning');
        }, 500);
    }
}

/**
 * Initiera manuell refresh-funktionalitet
 */
function initManualRefresh() {
    // Event listener för knapp
    const btn = document.getElementById('manual-refresh-btn');
    if (btn) {
        btn.addEventListener('click', manualRefresh);
        console.log('✅ Manuell refresh-knapp initierad');
    }
    
    // Initial visibility check
    updateRefreshButtonVisibility();
    
    // Kolla varje minut om knappen ska visas/döljas
    setInterval(updateRefreshButtonVisibility, 60 * 1000);
    
    // Uppdatera timestamp varje sekund när den visas
    setInterval(() => {
        const timestamp = document.getElementById('update-timestamp');
        if (timestamp && timestamp.style.display !== 'none') {
            updateTimestamp();
        }
    }, 1000);
}


// ═══════════════════════════════════════════════════════════
// iOS SCROLL FIX - Kontrollerad animation-start
// ═══════════════════════════════════════════════════════════

function startScrollAnimations() {
    // Aktivera alla scroll-animationer
    document.querySelectorAll('.scroll-content').forEach(el => {
        el.classList.add('is-scrolling');
    });
    console.log('🎬 Scroll-animationer startade (iOS-safe)');
}

function initScrollSafe() {
    // iOS Safari throttlar animationer vid page load
    // Dubbel requestAnimationFrame + timeout = vänta tills rendering är stabil
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setTimeout(startScrollAnimations, 300);
        });
    });
}

// Hantera visibility change (app-switch, sleep/wake)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Starta om animationer när användaren återvänder till sidan
        startScrollAnimations();
    }
});

// ═══════════════════════════════════════════════════════════
// INITIERING
// ═══════════════════════════════════════════════════════════

async function init() {
    console.log('Initierar SL Multi-Display Avgångstavla...');
    
    await loadConfig();
    if (!config) {
        console.error('Kunde inte ladda konfiguration');
        return;
    }
    
    // Hämta tavlor från window (skapat av index.html)
    const tavlorConfig = window.tavlorConfig || [];
    
    if (tavlorConfig.length === 0) {
        console.error('Inga tavlor konfigurerade');
        return;
    }
    
    const theme = config.display?.theme || 'classic';
    applyTheme(theme);
    applyCustomStyling();
    
    // SCROLL FIX: Responsiv hastighet - snabbare på mobil för samma visuella effekt
    if (config.display && config.display.scrollSpeed) {
        let speed = config.display.scrollSpeed;
        
        // På mobil/tablet: använd 70% av hastigheten för samma visuella känsla
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            speed = speed * 0.7;  // Snabbare scroll på smalare skärmar
        }
        
        document.documentElement.style.setProperty('--scroll-speed', `${speed}s`);
        console.log(`⚡ Scroll-hastighet satt till: ${config.display.scrollSpeed}s (visuell: ${speed}s${isMobile ? ' - mobil' : ''})`);
    } else {
        console.warn('⚠️ config.display.scrollSpeed saknas - använder CSS default (20s)');
    }
    
    // Skapa managers för varje tavla
    tavlorConfig.forEach((tavlaConfig, tavlaIndex) => {
        const tavlaData = {
            station: tavlaConfig.station,
            tableLineFilter: tavlaConfig.tableLineFilter || null,
            displayManagers: []
        };
        
        // Skapa display managers för denna tavla
        tavlaConfig.displays.forEach((displayConfig, displayIndex) => {
            const containerId = `tavla-${tavlaIndex}-display-${displayIndex}`;
            const manager = new DisplayManager(displayConfig, containerId);
            tavlaData.displayManagers.push(manager);
        });
        
        tavlor.push(tavlaData);
    });
    
    await updateAllDisplays();
    
    setInterval(updateAllDisplays, config.display.updateInterval);
    
    // iOS FIX: Starta scroll-animationer kontrollerat
    initScrollSafe();
    
    // NATT-REFRESH: Initiera manuell uppdatering
    initManualRefresh();
    
    const totalDisplays = tavlor.reduce((sum, t) => sum + t.displayManagers.length, 0);
    console.log(`✅ ${tavlor.length} tavla(r) startad!`);
    console.log(`📊 Totalt antal skyltar: ${totalDisplays}`);
    console.log(`📊 Tabellrader per tavla: ${config.departuresTable?.maxDepartures || 10}`);
    console.log(`📦 Linje-cache aktiverad (byggs upp över 24h för nattrafik)`);
}

// SCROLL FIX: Uppdatera scroll-hastighet vid resize (rotation, desktop resize)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (config && config.display && config.display.scrollSpeed) {
            let speed = config.display.scrollSpeed;
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                speed = speed * 0.7;
            }
            document.documentElement.style.setProperty('--scroll-speed', `${speed}s`);
            console.log(`🔄 Scroll-hastighet uppdaterad efter resize: ${speed}s${isMobile ? ' (mobil)' : ''}`);
        }
    }, 250);  // Debounce 250ms
});


window.addEventListener('DOMContentLoaded', init);
