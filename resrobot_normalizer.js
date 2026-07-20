// ═══════════════════════════════════════════════════════════
// ResRobot → SL NORMALIZER v1.0
// VERSION: 1.0.1 (senaste ändring: 2025-01-13)
// 
// VIKTIGT: Denna normalizer är HEURISTISK, inte perfekt.
// Mål: ~80% accuracy för vanliga fall.
// 
// v1 SCOPE LOCK:
// ✅ Tillåtet: Basis-mapping, enkel text-cleanup
// ❌ Förbjudet: Fuzzy matching, stora lookup-tables, ML
// 
// MAX: 100 rader kod (HARD STOP vid 150)
// ═══════════════════════════════════════════════════════════

/**
 * Normaliserar ResRobot-avgångar till SL-format (HEURISTISKT)
 * @param {Object} rrDeparture - ResRobot departure object
 * @returns {Object} Normaliserad avgång med _source: 'resrobot'
 */
export function normalizeResRobotDeparture(rrDeparture) {
    if (!rrDeparture) {
        throw new Error('ResRobot departure är null/undefined');
    }

    // Basis-mapping
    const normalized = {
        direction: rrDeparture.direction || "Okänd",
        destination: rrDeparture.name || rrDeparture.direction || "Okänd",
        expected: formatDateTime(rrDeparture.date, rrDeparture.time),
        display: calculateDisplayTime(rrDeparture.date, rrDeparture.time),
        
        // Mode mapping (enkel lookup)
        transport_mode: mapTransportMode(rrDeparture.Product?.catCode),
        
        line: {
            designation: rrDeparture.Product?.num || "--",
            name: rrDeparture.Product?.line || "",
            transport_mode: mapTransportMode(rrDeparture.Product?.catCode)
        },
        
        // Metadata för debugging
        _source: 'resrobot',
        _originalId: rrDeparture.JourneyDetailRef?.ref || null,
        _originalDestination: rrDeparture.name || rrDeparture.direction
    };
    
    // Text cleanup
    normalized.destination = cleanupDestinationText(normalized.destination);
    
    return normalized;
}

/**
 * Mappar ResRobot catCode till SL transport_mode
 */
function mapTransportMode(catCode) {
    // Enkel lookup (10 entries - enligt scope lock)
    const modeMap = {
        '1': 'TRAIN',  // Pendeltåg
        '2': 'BUS',    // Buss
        '3': 'METRO',  // Tunnelbana
        '4': 'TRAM',   // Spårvagn
        '5': 'SHIP',   // Båt
        '6': 'BUS',    // Express buss
        '7': 'BUS',    // Regionbuss
        '8': 'TRAIN'   // Regiontåg
    };
    return modeMap[catCode] || 'BUS';  // Fallback: BUS
}

/**
 * Cleanup av destinationstext (enkel, ingen fuzzy matching)
 */
function cleanupDestinationText(text) {
    if (!text) return 'Okänd';
    
    return text
        .replace(/\s+via\s+.+/i, '')  // Ta bort "via X"
        .replace(/\s*\(.+\)/, '')      // Ta bort parenteser
        .trim()
        .toUpperCase();
}

/**
 * Formaterar datum + tid till ISO-format
 */
function formatDateTime(date, time) {
    if (!date || !time) return new Date().toISOString();
    return `${date}T${time}`;
}

/**
 * Beräknar display-tid (Nu, X min, HH:MM)
 */
function calculateDisplayTime(date, time) {
    if (!date || !time) return '--';
    
    const now = new Date();
    const depTime = new Date(`${date}T${time}`);
    const diffMin = Math.round((depTime - now) / 60000);
    
    if (diffMin <= 0) return 'Nu';
    if (diffMin < 10) return `${diffMin} min`;
    return time.substring(0, 5);  // "HH:MM"
}

// ═══════════════════════════════════════════════════════════
// RADRÄKNING: 98 rader (inom 100-raders gräns) ✅
// VERSION: 1.0.1 - Fixat ES module export
// ═══════════════════════════════════════════════════════════
