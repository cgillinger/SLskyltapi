// ═══════════════════════════════════════════════════════════
// SL API CACHE/PROXY SERVER + RESROBOT INTEGRATION
// VERSION: 2.0.0 (senaste ändring: 2025-01-13)
// Ansvar: Centraliserad polling mot SL, ResRobot rate limiting
// ═══════════════════════════════════════════════════════════

import express from 'express';
import { setTimeout as sleep } from 'timers/promises';
import { config } from 'dotenv';
import { normalizeResRobotDeparture } from './resrobot_normalizer.js';

// Ladda .env
config();

// ═══════════════════════════════════════════════════════════
// KONFIGURATION
// ═══════════════════════════════════════════════════════════

const CONFIG = {
    port: 8200,
    slApiBase: 'https://transport.integration.sl.se/v1',
    resrobotApiBase: 'https://api.resrobot.se/v2.1',
    resrobotApiKey: process.env.RESROBOT_API_KEY,
    
    // Cache TTL (millisekunder)
    cacheTTL: 90 * 1000, // 90 sekunder
    
    // Polling intervaller (millisekunder)
    polling: {
        immediate: 30 * 1000,
        normal: 60 * 1000,
        idle: 3 * 60 * 1000,
        night: 7 * 60 * 1000
    },
    
    // Natt-timmar (svensk tid)
    nightHours: { start: 1, end: 5 },
    
    // ResRobot Rate Limiting (MULTI-CLIENT SAFE)
    resrobot: {
        maxCallsPerDay: parseInt(process.env.RESROBOT_MAX_CALLS_PER_DAY) || 25000,
        rateLimitWindow: parseInt(process.env.RESROBOT_RATE_LIMIT_WINDOW) || 86400000
    }
};

// ═══════════════════════════════════════════════════════════
// RESROBOT RATE LIMITER (MULTI-CLIENT SAFE - SERVER-SIDE)
// ═══════════════════════════════════════════════════════════

class ResRobotRateLimiter {
    constructor(maxCalls, windowMs) {
        this.maxCalls = maxCalls;
        this.windowMs = windowMs;
        this.windowStart = Date.now();
        this.callCount = 0;
        
        console.log(`🔒 ResRobot rate limiter: ${maxCalls} calls/${windowMs/1000}s (${windowMs/86400000} dagar)`);
    }
    
    /**
     * Kontrollera om anrop tillåts (MULTI-CLIENT SAFE)
     */
    canMakeCall() {
        const now = Date.now();
        
        // Reset window om tiden gått ut
        if (now - this.windowStart >= this.windowMs) {
            console.log(`🔄 ResRobot rate limit window reset (${this.callCount} calls gjorda)`);
            this.windowStart = now;
            this.callCount = 0;
        }
        
        return this.callCount < this.maxCalls;
    }
    
    /**
     * Registrera ett anrop (MULTI-CLIENT SAFE)
     */
    recordCall() {
        this.callCount++;
        const remaining = this.maxCalls - this.callCount;
        const percentUsed = Math.round((this.callCount / this.maxCalls) * 100);
        
        console.log(`📞 ResRobot call #${this.callCount}/${this.maxCalls} (${remaining} kvar, ${percentUsed}% använt)`);
        
        // Varningar vid 80% och 90%
        if (percentUsed === 80) {
            console.warn(`⚠️ ResRobot quota 80% använd! (${remaining} calls kvar)`);
        } else if (percentUsed === 90) {
            console.warn(`🚨 ResRobot quota 90% använd! (${remaining} calls kvar)`);
        }
    }
    
    /**
     * Hämta quota-status för UI
     */
    getQuotaStatus() {
        const now = Date.now();
        const windowAge = now - this.windowStart;
        const windowRemaining = this.windowMs - windowAge;
        
        return {
            callsUsed: this.callCount,
            callsRemaining: this.maxCalls - this.callCount,
            callsTotal: this.maxCalls,
            percentUsed: Math.round((this.callCount / this.maxCalls) * 100),
            windowRemainingMs: windowRemaining,
            windowRemainingHours: Math.round(windowRemaining / 3600000)
        };
    }
}

// Global rate limiter (SHARED across ALL clients)
const resrobotRateLimiter = new ResRobotRateLimiter(
    CONFIG.resrobot.maxCallsPerDay,
    CONFIG.resrobot.rateLimitWindow
);

// ═══════════════════════════════════════════════════════════
// CACHE MANAGER
// ═══════════════════════════════════════════════════════════

class CacheManager {
    constructor() {
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
// ═══════════════════════════════════════════════════════════

class PollingManager {
    constructor(cacheManager) {
        this.cache = cacheManager;
        this.pollers = new Map();
    }
    
    getPollingInterval(data) {
        const hour = new Date().getHours();
        if (hour >= CONFIG.nightHours.start && hour < CONFIG.nightHours.end) {
            console.log(`🌙 Natt-läge (${hour}:00) → ${CONFIG.polling.night/1000}s intervall`);
            return CONFIG.polling.night;
        }
        
        if (!data?.departures || data.departures.length === 0) {
            console.log(`⏸️  Inga avgångar → ${CONFIG.polling.idle/1000}s intervall`);
            return CONFIG.polling.idle;
        }
        
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
    
    async fetchFromSL(siteId) {
        const url = `${CONFIG.slApiBase}/sites/${siteId}/departures`;
        
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
    
    async startPolling(siteId) {
        if (this.pollers.has(siteId) && this.pollers.get(siteId).active) {
            console.log(`ℹ️  Polling redan aktiv för siteId=${siteId}`);
            return;
        }
        
        console.log(`🚀 Startar polling för siteId=${siteId}`);
        
        const poller = {
            active: true,
            timeout: null
        };
        this.pollers.set(siteId, poller);
        
        await this.pollOnce(siteId);
    }
    
    async pollOnce(siteId) {
        const poller = this.pollers.get(siteId);
        
        if (!poller || !poller.active) {
            console.log(`⏹️  Polling stoppad för siteId=${siteId}`);
            return;
        }
        
        try {
            const data = await this.fetchFromSL(siteId);
            this.cache.set(siteId, data);
            
            const interval = this.getPollingInterval(data);
            
            poller.timeout = setTimeout(() => {
                this.pollOnce(siteId);
            }, interval);
            
        } catch (error) {
            this.cache.setError(siteId, error);
            
            const retryInterval = 2 * 60 * 1000;
            console.log(`🔄 Försöker igen om ${retryInterval/1000}s för siteId=${siteId}`);
            
            poller.timeout = setTimeout(() => {
                this.pollOnce(siteId);
            }, retryInterval);
        }
    }
    
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

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Servera statiska filer
app.use(express.static('.', {
    setHeaders: (res, path) => {
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
 * SL avgångar (befintlig endpoint)
 */
app.get('/api/departures/:siteId', async (req, res) => {
    const { siteId } = req.params;
    
    console.log(`📡 Request: /api/departures/${siteId}`);
    
    if (!pollingManager.pollers.has(siteId) || !pollingManager.pollers.get(siteId).active) {
        console.log(`🔄 Startar ny polling för siteId=${siteId}`);
        pollingManager.startPolling(siteId);
        
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
    
    res.json({
        ...cached.data,
        _cache: {
            timestamp: cached.timestamp,
            age: Math.round((Date.now() - cached.timestamp) / 1000)
        }
    });
});

/**
 * GET /api/resrobot/departures/:stopId
 * ResRobot avgångar med rate limiting
 */
app.get('/api/resrobot/departures/:stopId', async (req, res) => {
    const { stopId } = req.params;
    
    console.log(`🚂 ResRobot Request: stopId=${stopId}`);
    
    // Kontrollera API-nyckel
    if (!CONFIG.resrobotApiKey || CONFIG.resrobotApiKey === 'your_api_key_here') {
        return res.status(503).json({
            error: 'ResRobot API-nyckel saknas',
            message: 'Konfigurera RESROBOT_API_KEY i .env'
        });
    }
    
    // Kontrollera rate limit (MULTI-CLIENT SAFE)
    if (!resrobotRateLimiter.canMakeCall()) {
        const quota = resrobotRateLimiter.getQuotaStatus();
        console.error(`🚨 ResRobot rate limit nådd! (${quota.callsUsed}/${quota.callsTotal})`);
        
        return res.status(429).json({
            error: 'ResRobot rate limit nådd',
            quota: quota,
            message: `Försök igen om ${quota.windowRemainingHours}h`
        });
    }
    
    try {
        // Anropa ResRobot API
        const url = `${CONFIG.resrobotApiBase}/departureBoard?id=${stopId}&format=json&key=${CONFIG.resrobotApiKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`ResRobot HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Registrera anrop (MULTI-CLIENT SAFE)
        resrobotRateLimiter.recordCall();
        
        // Normalisera avgångar till SL-format
        const normalizedDepartures = (data.Departure || []).map(dep => {
            try {
                return normalizeResRobotDeparture(dep);
            } catch (err) {
                console.error(`⚠️ Kunde inte normalisera ResRobot-avgång:`, err);
                return null;
            }
        }).filter(Boolean);
        
        console.log(`✅ ResRobot: ${normalizedDepartures.length} avgångar normaliserade`);
        
        res.json({
            departures: normalizedDepartures,
            _source: 'resrobot',
            _quota: resrobotRateLimiter.getQuotaStatus()
        });
        
    } catch (error) {
        console.error(`❌ ResRobot error:`, error);
        res.status(500).json({
            error: error.message,
            _quota: resrobotRateLimiter.getQuotaStatus()
        });
    }
});

/**
 * GET /api/resrobot/quota
 * ResRobot quota status för UI
 */
app.get('/api/resrobot/quota', (req, res) => {
    res.json(resrobotRateLimiter.getQuotaStatus());
});

/**
 * GET /api/status
 * Debugging endpoint
 */
app.get('/api/status', (req, res) => {
    res.json({
        config: {
            port: CONFIG.port,
            cacheTTL: CONFIG.cacheTTL / 1000,
            polling: {
                immediate: CONFIG.polling.immediate / 1000,
                normal: CONFIG.polling.normal / 1000,
                idle: CONFIG.polling.idle / 1000,
                night: CONFIG.polling.night / 1000
            }
        },
        cache: cache.getStats(),
        pollers: pollingManager.getStatus(),
        resrobot: resrobotRateLimiter.getQuotaStatus(),
        uptime: process.uptime()
    });
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (req, res) => {
    res.json({
        name: 'SL API Cache/Proxy + ResRobot',
        version: '2.0.0',
        endpoints: {
            sl_departures: '/api/departures/:siteId',
            resrobot_departures: '/api/resrobot/departures/:stopId',
            resrobot_quota: '/api/resrobot/quota',
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
    console.log('🚀 SL + RESROBOT API CACHE/PROXY SERVER');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📡 Port: ${CONFIG.port}`);
    console.log(`💾 Cache TTL: ${CONFIG.cacheTTL / 1000}s`);
    console.log(`🔒 ResRobot rate limit: ${CONFIG.resrobot.maxCallsPerDay} calls/dag`);
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
    console.log(`   SL: http://localhost:${CONFIG.port}/api/departures/:siteId`);
    console.log(`   ResRobot: http://localhost:${CONFIG.port}/api/resrobot/departures/:stopId`);
    console.log(`   Quota: http://localhost:${CONFIG.port}/api/resrobot/quota`);
    console.log(`   Status: http://localhost:${CONFIG.port}/api/status`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    // Varning om API-nyckel saknas
    if (!CONFIG.resrobotApiKey || CONFIG.resrobotApiKey === 'your_api_key_here') {
        console.warn('⚠️  VARNING: ResRobot API-nyckel saknas!');
        console.warn('   Konfigurera RESROBOT_API_KEY i .env för att aktivera ResRobot.');
        console.warn('');
    }
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
