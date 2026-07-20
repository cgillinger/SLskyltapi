// ═══════════════════════════════════════════════════════════
// STATION SEARCH - SL Transport API Integration
// VERSION: 3.0.0 - Med riktnings/destinations-stöd
// Hanterar: Station-cache, autocomplete, linje-hämtning, destinations, cache-info
// ═══════════════════════════════════════════════════════════

class StationSearch {
    constructor() {
        this.cache = null;
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 timmar
        this.apiUrl = 'https://transport.integration.sl.se/v1/sites';
    }

    // ═══════════════════════════════════════════════════════════
    // STATIONS CACHE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    async loadStationsCache() {
        const cached = localStorage.getItem('sl_stations_cache');
        const cacheTime = localStorage.getItem('sl_stations_cache_time');
        const now = Date.now();

        // Om cache finns och är färsk
        if (cached && cacheTime && (now - parseInt(cacheTime)) < this.cacheExpiry) {
            try {
                this.cache = JSON.parse(cached);
                console.log('✅ Laddade stations-cache från localStorage');
                return this.cache;
            } catch (e) {
                console.warn('⚠️ Trasig stations-cache — hämtar om från API');
                localStorage.removeItem('sl_stations_cache');
                localStorage.removeItem('sl_stations_cache_time');
            }
        }

        // Hämta från API
        console.log('🔄 Hämtar stations från SL API...');
        try {
            const response = await fetch(this.apiUrl);
            const data = await response.json();
            
            this.cache = data;
            localStorage.setItem('sl_stations_cache', JSON.stringify(data));
            localStorage.setItem('sl_stations_cache_time', now.toString());
            
            console.log(`✅ Hämtade ${data.length} stationer från API`);
            return data;
        } catch (error) {
            console.error('❌ Fel vid hämtning av stationer:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // STATION SEARCH
    // ═══════════════════════════════════════════════════════════

    async searchStations(query) {
        if (!this.cache) {
            await this.loadStationsCache();
        }

        if (!query || query.length < 2) {
            return [];
        }

        const searchLower = query.toLowerCase();
        
        return this.cache
            .filter(station => 
                station.name && station.name.toLowerCase().includes(searchLower)
            )
            .slice(0, 10) // Max 10 resultat
            .map(station => ({
                id: station.id,
                name: station.name,
                type: station.type || 'N/A'
            }));
    }

    // ═══════════════════════════════════════════════════════════
    // LINES CACHE HELPERS (läser från app.js cache)
    // ═══════════════════════════════════════════════════════════

    getCachedLinesForStation(siteId) {
        // Använd app.js getCachedLines om tillgänglig
        if (typeof window.getCachedLines === 'function') {
            const cached = window.getCachedLines(siteId);
            if (cached && cached.length > 0) {
                // Markera som INTE live (från cache)
                return cached.map(line => ({
                    ...line,
                    isLive: false
                }));
            }
        }
        return [];
    }

    // ═══════════════════════════════════════════════════════════
    // FETCH AVAILABLE LINES FOR STATION (CACHE + LIVE)
    // ═══════════════════════════════════════════════════════════

    async fetchAvailableLines(siteId) {
        // Steg 1: Hämta från cache (nattrafik etc)
        const cachedLines = this.getCachedLinesForStation(siteId);
        
        // Steg 2: Hämta live från API
        const liveLines = await this.fetchLiveLines(siteId);
        
        // Steg 3: Hämta destinations för alla linjer
        const destinations = await this.fetchDestinationsForLines(siteId);
        
        // Steg 4: Mergea linjer - live linjer har prioritet
        const merged = this.mergeLines(cachedLines, liveLines);
        
        console.log(`📋 Station ${siteId}: ${liveLines.length} live + ${cachedLines.length} cached = ${merged.length} totalt`);
        
        return { lines: merged, destinations };
    }

    async fetchLiveLines(siteId) {
        try {
            const url = `/api/departures/${siteId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!data.departures || data.departures.length === 0) {
                return [];
            }

            // Extrahera unika linjer med full info
            const linesMap = new Map();

            data.departures.forEach(dep => {
                const mode = dep.line?.transport_mode;
                const designation = dep.line?.designation;
                const lineName = dep.line?.name || dep.direction || dep.destination;

                if (designation && mode) {
                    const key = `${mode}-${designation}`;
                    if (!linesMap.has(key)) {
                        linesMap.set(key, {
                            designation: designation,
                            name: lineName,
                            transport_mode: mode,
                            isLive: true  // Markera som live
                        });
                    }
                }
            });

            return Array.from(linesMap.values());

        } catch (error) {
            console.error('❌ Fel vid hämtning av live-linjer:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // FETCH DESTINATIONS FOR LINES
    // ═══════════════════════════════════════════════════════════

    async fetchDestinationsForLines(siteId) {
        try {
            const url = `/api/departures/${siteId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!data.departures || data.departures.length === 0) {
                return {};
            }

            // Map: lineKey → Set av destinations
            const destinationsMap = new Map();

            data.departures.forEach(dep => {
                const mode = dep.line?.transport_mode;
                const designation = dep.line?.designation;
                const destination = dep.destination || dep.direction;

                if (designation && mode && destination) {
                    const lineKey = `${mode}-${designation}`;
                    
                    if (!destinationsMap.has(lineKey)) {
                        destinationsMap.set(lineKey, new Set());
                    }
                    
                    destinationsMap.get(lineKey).add(destination);
                }
            });

            // Konvertera till object med sorterade arrays
            const result = {};
            
            for (const [lineKey, destinationsSet] of destinationsMap.entries()) {
                // Sortera alfabetiskt för konsistent A/B-mappning
                result[lineKey] = Array.from(destinationsSet).sort();
            }

            console.log(`🧭 Destinations för station ${siteId}:`, result);
            return result;

        } catch (error) {
            console.error('❌ Fel vid hämtning av destinations:', error);
            return {};
        }
    }

    mergeLines(cachedLines, liveLines) {
        // Skapa map med cached linjer först
        const mergedMap = new Map();
        
        cachedLines.forEach(line => {
            const key = `${line.transport_mode}-${line.designation}`;
            mergedMap.set(key, { ...line, isLive: false });
        });
        
        // Överskiv/lägg till live linjer (de har prioritet)
        liveLines.forEach(line => {
            const key = `${line.transport_mode}-${line.designation}`;
            mergedMap.set(key, { ...line, isLive: true });
        });
        
        // Sortera resultatet
        return Array.from(mergedMap.values()).sort((a, b) => {
            // Sortera först på trafikslag
            if (a.transport_mode !== b.transport_mode) {
                return a.transport_mode.localeCompare(b.transport_mode);
            }
            // Sedan numeriskt på linjenummer
            const numA = parseInt(a.designation);
            const numB = parseInt(b.designation);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.designation.localeCompare(b.designation);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // CACHE INFO FÖR UI
    // ═══════════════════════════════════════════════════════════

    getLinesCacheInfo(siteId) {
        // Läs från app.js cache
        if (typeof window.getLinesCache !== 'function') {
            return { lineCount: 0, message: null };
        }
        
        const cache = window.getLinesCache();
        const stationCache = cache[siteId];
        
        if (!stationCache || !stationCache.lines) {
            return {
                lineCount: 0,
                message: '⏳ Inga linjer cachade ännu. Listan byggs upp automatiskt över tid (kan ta upp till 24 timmar för att inkludera nattrafik).'
            };
        }
        
        const lineCount = Object.keys(stationCache.lines).length;
        const lastUpdated = stationCache.lastUpdated;
        const hoursSinceUpdate = lastUpdated 
            ? Math.round((Date.now() - lastUpdated) / (1000 * 60 * 60)) 
            : 0;
        
        let message;
        if (hoursSinceUpdate < 24) {
            message = `📦 ${lineCount} linjer i cache. Listan kan vara ofullständig – vänta 24h för att fånga nattrafik och helgtrafik.`;
        } else {
            message = `✅ ${lineCount} linjer i cache (senast uppdaterad för ${hoursSinceUpdate}h sedan). Listan uppdateras löpande.`;
        }
        
        return { lineCount, hoursSinceUpdate, message };
    }

    // ═══════════════════════════════════════════════════════════
    // AUTOCOMPLETE UI
    // ═══════════════════════════════════════════════════════════

    createAutocomplete(inputElement, onSelect) {
        let resultsContainer = inputElement.nextElementSibling;
        
        // Skapa results container om den inte finns
        if (!resultsContainer || !resultsContainer.classList.contains('station-results')) {
            resultsContainer = document.createElement('div');
            resultsContainer.className = 'station-results';
            resultsContainer.style.display = 'none';
            inputElement.parentElement.appendChild(resultsContainer);
        }

        // Input event - sök när användare skriver
        inputElement.addEventListener('input', async (e) => {
            const query = e.target.value;
            
            if (query.length < 2) {
                resultsContainer.style.display = 'none';
                return;
            }

            // Visa loading
            resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center;"><span class="loading-spinner"></span></div>';
            resultsContainer.style.display = 'block';

            // Sök (try/catch: annars fastnar spinnern för evigt vid fel)
            let results;
            try {
                results = await this.searchStations(query);
            } catch (error) {
                console.error('❌ Stationssökning misslyckades:', error);
                resultsContainer.innerHTML = '<div style="padding: 12px; color: var(--sl-grey); text-align: center;">Sökningen misslyckades — försök igen</div>';
                return;
            }

            // Skydd mot out-of-order-svar: visa bara om frågan fortfarande
            // matchar det som står i fältet
            if (inputElement.value !== query) {
                return;
            }

            if (results.length === 0) {
                resultsContainer.innerHTML = '<div style="padding: 12px; color: var(--sl-grey); text-align: center;">Inga stationer hittades</div>';
                return;
            }

            // Visa resultat (escapade — namnen kommer från SL:s API)
            const esc = window.escapeHtml || (s => String(s ?? ''));
            resultsContainer.innerHTML = results.map(station => `
                <div class="station-result-item" data-id="${esc(station.id)}" data-name="${esc(station.name)}">
                    <span class="station-result-name">${esc(station.name)}</span>
                    <span class="station-result-id">(Site ID: ${esc(station.id)})</span>
                </div>
            `).join('');

            // Click handlers
            resultsContainer.querySelectorAll('.station-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const name = item.dataset.name;
                    
                    inputElement.value = name;
                    resultsContainer.style.display = 'none';
                    
                    if (onSelect) {
                        onSelect({ id, name });
                    }
                });
            });
        });

        // Click utanför stänger resultat.
        // EN delegerad lyssnare för hela dokumentet — en per anrop läckte
        // minne eftersom renderTavlor() återskapar autocompletes ofta och
        // gamla lyssnare (med döda DOM-referenser) aldrig togs bort.
        if (!StationSearch._outsideClickBound) {
            document.addEventListener('click', (e) => {
                document.querySelectorAll('.station-results').forEach(rc => {
                    const input = rc.parentElement?.querySelector('input.station-search-input');
                    if (!rc.contains(e.target) && !(input && input.contains(e.target))) {
                        rc.style.display = 'none';
                    }
                });
            });
            StationSearch._outsideClickBound = true;
        }

        // Focus visar tidigare resultat om de finns
        inputElement.addEventListener('focus', () => {
            if (resultsContainer.children.length > 0 && inputElement.value.length >= 2) {
                resultsContainer.style.display = 'block';
            }
        });
    }
}

// Global instans
window.stationSearch = new StationSearch();
console.log('✅ StationSearch v3.0 initierad (med destinations-stöd)');
