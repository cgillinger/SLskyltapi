// ═══════════════════════════════════════════════════════════
// STATION SEARCH - SL Transport API Integration + ResRobot v3.1
// VERSION: 3.1.0 (senaste ändring: 2026-01-13)
// Hanterar: Station-cache, autocomplete, linje-hämtning, destinations, cache-info
// NYT: ResRobot manual search för opt-in komplettering
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
            this.cache = JSON.parse(cached);
            console.log('✅ Laddade stations-cache från localStorage');
            return this.cache;
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

            // Sök
            const results = await this.searchStations(query);

            if (results.length === 0) {
                resultsContainer.innerHTML = '<div style="padding: 12px; color: var(--sl-grey); text-align: center;">Inga stationer hittades</div>';
                return;
            }

            // Visa resultat
            resultsContainer.innerHTML = results.map(station => `
                <div class="station-result-item" data-id="${station.id}" data-name="${station.name}">
                    <span class="station-result-name">${station.name}</span>
                    <span class="station-result-id">(Site ID: ${station.id})</span>
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

        // Click utanför stänger resultat
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });

        // Focus visar tidigare resultat om de finns
        inputElement.addEventListener('focus', () => {
            if (resultsContainer.children.length > 0 && inputElement.value.length >= 2) {
                resultsContainer.style.display = 'block';
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════
// RESROBOT SEARCH - Manual station mapping för opt-in komplettering
// VERSION: 1.0.0 (senaste ändring: 2026-01-13)
// Scope: Sök ResRobot-stationer, förhandsvisning, kvot-status
// ═══════════════════════════════════════════════════════════

class ResRobotSearch {
    constructor() {
        this.searchCache = new Map(); // Query → resultat
        this.previewCache = new Map(); // StopId → departures
        this.cacheExpiry = 5 * 60 * 1000; // 5 minuter
        this.apiBase = '/api/resrobot';
    }

    // ═══════════════════════════════════════════════════════════
    // STATION SEARCH (Manual, 3+ chars)
    // ═══════════════════════════════════════════════════════════

    async searchStations(query) {
        // KRAV: Minimum 3 tecken
        if (!query || query.length < 3) {
            return { error: 'Minst 3 tecken krävs för sökning', results: [] };
        }

        // Check cache först
        const cacheKey = query.toLowerCase().trim();
        const cached = this.searchCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            console.log(`📦 ResRobot cache hit: "${query}"`);
            return { results: cached.data, fromCache: true };
        }

        // Sök via API
        try {
            console.log(`🔍 ResRobot sökning: "${query}"`);
            const url = `${this.apiBase}/stops?query=${encodeURIComponent(query)}`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 429) {
                    return { error: 'API-kvot överskriden. Vänta en stund.', results: [] };
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Normaliserad struktur förväntas från backend
            const results = data.stops || [];

            // Cacha resultat
            this.searchCache.set(cacheKey, {
                data: results,
                timestamp: Date.now()
            });

            console.log(`✅ ResRobot: ${results.length} stationer hittade`);
            return { results, fromCache: false };

        } catch (error) {
            console.error('❌ ResRobot search error:', error);
            return { error: error.message, results: [] };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PREVIEW DEPARTURES (för jämförelse med SL)
    // ═══════════════════════════════════════════════════════════

    async previewDepartures(stopId, stopName) {
        if (!stopId) {
            return { error: 'StopId saknas', departures: [] };
        }

        // Check cache
        const cached = this.previewCache.get(stopId);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            console.log(`📦 ResRobot preview cache hit: ${stopName}`);
            return { departures: cached.data, fromCache: true };
        }

        // Hämta via API
        try {
            console.log(`🔍 ResRobot preview: ${stopName} (${stopId})`);
            const url = `${this.apiBase}/departures/${stopId}`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 429) {
                    return { error: 'API-kvot överskriden', departures: [] };
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const departures = data.departures || [];

            // Cacha
            this.previewCache.set(stopId, {
                data: departures,
                timestamp: Date.now()
            });

            console.log(`✅ ResRobot preview: ${departures.length} avgångar`);
            return { departures, fromCache: false };

        } catch (error) {
            console.error('❌ ResRobot preview error:', error);
            return { error: error.message, departures: [] };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // QUOTA STATUS
    // ═══════════════════════════════════════════════════════════

    async getQuotaStatus() {
        try {
            const response = await fetch(`${this.apiBase}/quota`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            return {
                used: data.used || 0,
                limit: data.limit || 25000,
                remaining: data.remaining || 25000,
                resetTime: data.resetTime || null,
                percentage: data.percentage || 0
            };

        } catch (error) {
            console.error('❌ ResRobot quota error:', error);
            return { error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CACHE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    clearCache() {
        this.searchCache.clear();
        this.previewCache.clear();
        console.log('🧹 ResRobot cache cleared');
    }

    getCacheStats() {
        return {
            searchEntries: this.searchCache.size,
            previewEntries: this.previewCache.size,
            totalEntries: this.searchCache.size + this.previewCache.size
        };
    }
}

// ═══════════════════════════════════════════════════════════
// GLOBAL INSTANCES
// ═══════════════════════════════════════════════════════════

window.stationSearch = new StationSearch();
window.resRobotSearch = new ResRobotSearch();

console.log('✅ StationSearch v3.1.0 initierad (med ResRobot v3.1 support)');
console.log('✅ ResRobotSearch v1.0.0 initierad (manual mapping)');
