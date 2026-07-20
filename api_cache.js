// ═══════════════════════════════════════════════════════════
// SL API CACHE/PROXY SERVER
// VERSION: 1.0.0
// Ansvar: Centraliserad polling mot SL, exponerar lokal cache
// ═══════════════════════════════════════════════════════════

import express from 'express';
import { setTimeout as sleep } from 'timers/promises';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

// ═══════════════════════════════════════════════════════════
// APP-VERSION
// Hash av klientfilerna, beräknas vid serverstart. Skickas med i
// varje /api/departures-svar; klienten laddar om sidan när den
// ändras (dvs. efter varje deploy/omstart med ny kod eller config).
// ═══════════════════════════════════════════════════════════

const APP_VERSION = (() => {
    const files = ['index.html', 'app.js', 'display-renderer.js', 'styles.css', 'config.json'];
    const hash = createHash('md5');
    for (const file of files) {
        try {
            hash.update(readFileSync(file));
        } catch {
            hash.update(file); // fil saknas — låt namnet ingå så hashen ändå blir stabil
        }
    }
    return hash.digest('hex').slice(0, 12);
})();

// ═══════════════════════════════════════════════════════════
// KONFIGURATION
// ═══════════════════════════════════════════════════════════

const CONFIG = {
    port: 8200,
    slApiBase: 'https://transport.integration.sl.se/v1',
    
    // Cache TTL (millisekunder)
    cacheTTL: 90 * 1000, // 90 sekunder (säkerhetsmarginal)

    // Tidsfönster framåt i minuter för avgångar (SL API:ets maxvärde är 1200)
    // Styr hur långt fram i tiden tavlan kan fyllas på med avgångar
    forecastMinutes: Math.min(1200, Math.max(1, parseInt(process.env.SL_FORECAST_MINUTES) || 180)),
    
    // Polling intervaller (millisekunder)
    polling: {
        immediate: 30 * 1000,    // Nästa avgång ≤ 10 min
        normal: 60 * 1000,       // Nästa avgång > 10 min
        idle: 3 * 60 * 1000,     // Inga avgångar
        night: 7 * 60 * 1000     // 01:00-05:00
    },
    
    // Natt-timmar (svensk tid)
    nightHours: { start: 1, end: 5 }
};

// ═══════════════════════════════════════════════════════════
// CACHE MANAGER
// Hanterar in-memory cache med TTL per siteId
// ═══════════════════════════════════════════════════════════

class CacheManager {
    constructor() {
        // Map: siteId → { data, timestamp, error }
        this.cache = new Map();
    }
    
    set(siteId, data) {
        this.cache.set(siteId, {
            data,
            timestamp: Date.now(),
            error: null
        });
        
        console.log(`💾 Cache uppdaterad: siteId=${siteId}, avgångar=${data?.departures?.length || 0}`);
    }
    
    setError(siteId, error) {
        this.cache.set(siteId, {
            data: null,
            timestamp: Date.now(),
            error: error.message
        });
        
        console.error(`❌ Cache error för siteId=${siteId}: ${error.message}`);
    }
    
    get(siteId) {
        const cached = this.cache.get(siteId);
        
        if (!cached) {
            return null;
        }
        
        // Kontrollera TTL
        const age = Date.now() - cached.timestamp;
        if (age > CONFIG.cacheTTL) {
            console.log(`⏰ Cache för siteId=${siteId} utgången (ålder: ${Math.round(age/1000)}s)`);
            return null;
        }
        
        return cached;
    }
    
    has(siteId) {
        return this.cache.has(siteId);
    }
    
    getStats() {
        const stats = [];
        
        for (const [siteId, cached] of this.cache.entries()) {
            const age = Math.round((Date.now() - cached.timestamp) / 1000);
            stats.push({
                siteId,
                age,
                departures: cached.data?.departures?.length || 0,
                hasError: !!cached.error
            });
        }
        
        return stats;
    }
}

// ═══════════════════════════════════════════════════════════
// POLLING MANAGER
// Hanterar smart polling per siteId enligt dynamiska regler
// ═══════════════════════════════════════════════════════════

class PollingManager {
    constructor(cacheManager) {
        this.cache = cacheManager;
        
        // Map: siteId → { active: boolean, timeout: NodeJS.Timeout }
        this.pollers = new Map();
    }
    
    /**
     * Bestämmer polling-intervall baserat på nästa avgång och tid på dygnet
     */
    getPollingInterval(data) {
        // Natt-logik (01:00-05:00)
        const hour = new Date().getHours();
        if (hour >= CONFIG.nightHours.start && hour < CONFIG.nightHours.end) {
            console.log(`🌙 Natt-läge (${hour}:00) → ${CONFIG.polling.night/1000}s intervall`);
            return CONFIG.polling.night;
        }
        
        // Om inga avgångar
        if (!data?.departures || data.departures.length === 0) {
            console.log(`⏸️  Inga avgångar → ${CONFIG.polling.idle/1000}s intervall`);
            return CONFIG.polling.idle;
        }
        
        // Hitta nästa avgång
        const nextDeparture = this.getNextDeparture(data.departures);
        
        if (!nextDeparture) {
            return CONFIG.polling.idle;
        }
        
        const minutesUntil = nextDeparture.minutesUntil;
        
        if (minutesUntil <= 10) {
            console.log(`⚡ Nästa avgång om ${minutesUntil} min → ${CONFIG.polling.immediate/1000}s intervall`);
            return CONFIG.polling.immediate;
        } else {
            console.log(`⏱️  Nästa avgång om ${minutesUntil} min → ${CONFIG.polling.normal/1000}s intervall`);
            return CONFIG.polling.normal;
        }
    }
    
    /**
     * Hittar nästa avgång och beräknar minuter till
     */
    getNextDeparture(departures) {
        if (!departures || departures.length === 0) {
            return null;
        }
        
        const now = new Date();
        
        for (const dep of departures) {
            if (!dep.expected) continue;
            
            const depTime = new Date(dep.expected);
            const diffMs = depTime - now;
            const diffMin = Math.round(diffMs / 60000);
            
            if (diffMin >= 0) {
                return {
                    expected: dep.expected,
                    minutesUntil: diffMin,
                    destination: dep.destination || dep.direction
                };
            }
        }
        
        return null;
    }
    
    /**
     * Hämtar data från SL API
     */
    async fetchFromSL(siteId) {
        const url = `${CONFIG.slApiBase}/sites/${siteId}/departures?forecast=${CONFIG.forecastMinutes}`;
        
        try {
            console.log(`🔄 Hämtar från SL API: siteId=${siteId}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(`Rate limit (429) - backar av`);
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error(`❌ Fel vid hämtning från SL: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Startar polling för en siteId
     */
    async startPolling(siteId) {
        // Om redan aktiv, returnera
        if (this.pollers.has(siteId) && this.pollers.get(siteId).active) {
            console.log(`ℹ️  Polling redan aktiv för siteId=${siteId}`);
            return;
        }
        
        console.log(`🚀 Startar polling för siteId=${siteId}`);
        
        // Markera som aktiv
        const poller = {
            active: true,
            timeout: null
        };
        this.pollers.set(siteId, poller);
        
        // Första hämtningen sker direkt
        await this.pollOnce(siteId);
    }
    
    /**
     * Gör EN polling-cykel
     */
    async pollOnce(siteId) {
        const poller = this.pollers.get(siteId);
        
        if (!poller || !poller.active) {
            console.log(`⏹️  Polling stoppad för siteId=${siteId}`);
            return;
        }
        
        try {
            // Hämta från SL
            const data = await this.fetchFromSL(siteId);
            
            // Uppdatera cache
            this.cache.set(siteId, data);
            
            // Beräkna nästa intervall
            const interval = this.getPollingInterval(data);
            
            // Schemalägg nästa polling
            poller.timeout = setTimeout(() => {
                this.pollOnce(siteId);
            }, interval);
            
        } catch (error) {
            // Vid fel, spara error i cache
            this.cache.setError(siteId, error);
            
            // Försök igen om 2 minuter
            const retryInterval = 2 * 60 * 1000;
            console.log(`🔄 Försöker igen om ${retryInterval/1000}s för siteId=${siteId}`);
            
            poller.timeout = setTimeout(() => {
                this.pollOnce(siteId);
            }, retryInterval);
        }
    }
    
    /**
     * Stoppar polling för en siteId
     */
    stopPolling(siteId) {
        const poller = this.pollers.get(siteId);
        
        if (!poller) {
            return;
        }
        
        console.log(`⏹️  Stoppar polling för siteId=${siteId}`);
        
        poller.active = false;
        
        if (poller.timeout) {
            clearTimeout(poller.timeout);
            poller.timeout = null;
        }
        
        this.pollers.delete(siteId);
    }
    
    /**
     * Hämtar status för alla pollers
     */
    getStatus() {
        const status = [];
        
        for (const [siteId, poller] of this.pollers.entries()) {
            const cached = this.cache.get(siteId);
            status.push({
                siteId,
                active: poller.active,
                cacheAge: cached ? Math.round((Date.now() - cached.timestamp) / 1000) : null,
                departures: cached?.data?.departures?.length || 0
            });
        }
        
        return status;
    }
}

// ═══════════════════════════════════════════════════════════
// EXPRESS SERVER
// ═══════════════════════════════════════════════════════════

const cache = new CacheManager();
const pollingManager = new PollingManager(cache);

const app = express();

// CORS för lokal utveckling
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Servera statiska filer (HTML, CSS, JS, etc)
// VIKTIGT: Denna måste komma FÖRE API-routes

app.use(express.static('.', {
    setHeaders: (res, path) => {
        // no-cache = browsern får cacha men MÅSTE revalidera (ETag → 304).
        // Utan detta heuristik-cachar mobilbrowsers gamla filer på obestämd tid.
        res.setHeader('Cache-Control', 'no-cache');
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));

/**
 * GET /api/departures/:siteId
 * Returnerar cached avgångar, startar polling om ej aktiv
 */
app.get('/api/departures/:siteId', async (req, res) => {
    const { siteId } = req.params;
    
    console.log(`📡 Request: /api/departures/${siteId}`);
    
    // Kontrollera om polling är aktiv
    if (!pollingManager.pollers.has(siteId) || !pollingManager.pollers.get(siteId).active) {
        console.log(`🔄 Startar ny polling för siteId=${siteId}`);
        pollingManager.startPolling(siteId);
        
        // Vänta lite för att få första datan (max 5 sekunder)
        let attempts = 0;
        while (attempts < 10) {
            await sleep(500);
            const cached = cache.get(siteId);
            if (cached?.data) {
                break;
            }
            attempts++;
        }
    }
    
    // Hämta från cache
    const cached = cache.get(siteId);
    
    if (!cached) {
        return res.status(503).json({
            error: 'Cache ännu inte tillgänglig',
            message: 'Försök igen om några sekunder'
        });
    }
    
    if (cached.error) {
        return res.status(500).json({
            error: cached.error,
            timestamp: cached.timestamp
        });
    }
    
    // Returnera data med metadata
    res.json({
        ...cached.data,
        _version: APP_VERSION,
        _cache: {
            timestamp: cached.timestamp,
            age: Math.round((Date.now() - cached.timestamp) / 1000)
        }
    });
});

/**
 * GET /api/status
 * Debugging endpoint för att se cache-status
 */
app.get('/api/status', (req, res) => {
    res.json({
        version: APP_VERSION,
        config: {
            port: CONFIG.port,
            cacheTTL: CONFIG.cacheTTL / 1000,
            forecastMinutes: CONFIG.forecastMinutes,
            polling: {
                immediate: CONFIG.polling.immediate / 1000,
                normal: CONFIG.polling.normal / 1000,
                idle: CONFIG.polling.idle / 1000,
                night: CONFIG.polling.night / 1000
            }
        },
        cache: cache.getStats(),
        pollers: pollingManager.getStatus(),
        uptime: process.uptime()
    });
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (req, res) => {
    res.json({
        name: 'SL API Cache/Proxy',
        version: '1.0.0',
        endpoints: {
            departures: '/api/departures/:siteId',
            status: '/api/status'
        }
    });
});

// ═══════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════

app.listen(CONFIG.port, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 SL API CACHE/PROXY SERVER');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📡 Port: ${CONFIG.port}`);
    console.log(`💾 Cache TTL: ${CONFIG.cacheTTL / 1000}s`);
    console.log(`🔭 Forecast-fönster: ${CONFIG.forecastMinutes} min`);
    console.log(`🏷️  App-version: ${APP_VERSION}`);
    console.log(`⏱️  Polling intervaller:`);
    console.log(`   - Nästa avgång ≤ 10 min: ${CONFIG.polling.immediate / 1000}s`);
    console.log(`   - Nästa avgång > 10 min: ${CONFIG.polling.normal / 1000}s`);
    console.log(`   - Inga avgångar: ${CONFIG.polling.idle / 1000}s`);
    console.log(`   - Natt (01-05): ${CONFIG.polling.night / 1000}s`);
    console.log('');
    console.log('🌐 Öppna i browser:');
    console.log(`   http://localhost:${CONFIG.port}`);
    console.log('');
    console.log('🔗 API Endpoints:');
    console.log(`   http://localhost:${CONFIG.port}/api/departures/:siteId`);
    console.log(`   http://localhost:${CONFIG.port}/api/status`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM mottagen, stänger ner...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT mottagen, stänger ner...');
    process.exit(0);
});
