// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SETTINGS MANAGER - DEL 1
// Core funktionalitet, modal, BIOS-stil ändringshantering
// VERSION: 3.2.0 - Med cache-proxy integration och nattlinjemeddelande
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class SettingsManager {
    constructor() {
        this.modal = document.getElementById('settings-modal');
        this.currentConfig = null;
        this.originalConfig = null;
        
        // BIOS-stil ändringslogg
        this.pendingChanges = [];
        
        // Destination-cache per linje
        this.destinationCache = {};
        
        this.init();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ÄNDRINGSLOGG-SYSTEM (BIOS-stil)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    logChange(type, description, details = {}) {
        this.pendingChanges.push({
            type,           // 'add', 'remove', 'modify'
            description,    // Mänskligt läsbar beskrivning
            details,        // Extra data för undo
            timestamp: Date.now()
        });
        console.log(`ðŸ“ Ändring loggad: ${type} - ${description}`);
    }

    clearChanges() {
        this.pendingChanges = [];
    }

    hasChanges() {
        return this.pendingChanges.length > 0;
    }

    getChangesSummary() {
        if (!this.hasChanges()) return null;
        
        const summary = {
            added: [],
            removed: [],
            modified: []
        };
        
        this.pendingChanges.forEach(change => {
            if (change.type === 'add') summary.added.push(change.description);
            else if (change.type === 'remove') summary.removed.push(change.description);
            else if (change.type === 'modify') summary.modified.push(change.description);
        });
        
        return summary;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // INITIALIZATION
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    init() {
        // Modal controls
        document.getElementById('settings-hamburger').addEventListener('click', () => this.open());
        document.getElementById('settings-close').addEventListener('click', () => this.handleClose());
        document.getElementById('save-settings-btn').addEventListener('click', () => this.save());
        document.getElementById('cancel-settings-btn').addEventListener('click', () => this.handleCancel());
        
        // Overlay click triggers cancel
        this.modal.querySelector('.settings-overlay').addEventListener('click', () => this.handleCancel());
        
        // Touch-stöd för tooltips
        this.initTooltipTouch();
        
        // Preset buttons för uppdateringsfrekvens
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                document.getElementById('setting-update-interval').value = value;
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.logChange('modify', `Uppdateringsfrekvens: ${value}s`);
            });
        });
        
        // Orientation change
        document.getElementById('setting-orientation').addEventListener('change', (e) => {
            const modeField = document.getElementById('mode-field');
            modeField.style.display = e.target.value === 'horizontal' ? 'block' : 'none';
            this.logChange('modify', `Layout: ${e.target.value}`);
        });
        
        // Deviations checkbox
        document.getElementById('setting-deviations-enabled').addEventListener('change', (e) => {
            const durationField = document.getElementById('deviation-duration-field');
            const intervalField = document.getElementById('deviation-interval-field');
            const isEnabled = e.target.checked;
            durationField.style.display = isEnabled ? 'block' : 'none';
            intervalField.style.display = isEnabled ? 'block' : 'none';
            this.logChange('modify', `Störningar: ${e.target.checked ? 'på' : 'av'}`);
        });
        
        // Add tavla button
        document.getElementById('add-tavla-btn').addEventListener('click', () => this.addTavla());
        
        // Export/Import (nu i avancerade inställningar)
        document.getElementById('export-config-btn').addEventListener('click', () => this.export());
        document.getElementById('import-config-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        document.getElementById('import-file-input').addEventListener('change', (e) => this.import(e));
        
        console.log('âœ… SettingsManager v3.2 initierad (med cache-proxy)');
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // TOUCH-STÖD FÖR TOOLTIPS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    initTooltipTouch() {
        // Delegerad event-hantering för alla info-badges
        document.addEventListener('click', (e) => {
            const badge = e.target.closest('.info-badge');
            
            if (badge) {
                e.preventDefault();
                e.stopPropagation();
                this.showTooltip(badge);
            } else {
                // Klick utanför - stäng alla tooltips
                this.hideAllTooltips();
            }
        });
        
        // Stäng tooltip vid scroll
        this.modal.querySelector('.settings-content').addEventListener('scroll', () => {
            this.hideAllTooltips();
        });
    }
    
    showTooltip(badge) {
        // Stäng eventuell öppen tooltip först
        this.hideAllTooltips();
        
        // Läs från data-tooltip (aldrig title - undviker browser tooltip)
        const text = badge.dataset.tooltip;
        if (!text) return;
        
        // Skapa tooltip-element
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-popup';
        tooltip.textContent = text;
        
        // Lägg till i DOM
        document.body.appendChild(tooltip);
        
        // Mät tooltip efter att den lagts till
        const badgeRect = badge.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Beräkna position - försök vänster, annars under
        let left, top;
        const spaceLeft = badgeRect.left;
        const spaceBelow = window.innerHeight - badgeRect.bottom;
        
        if (spaceLeft > tooltipRect.width + 20) {
            // Visa till vänster
            left = badgeRect.left - tooltipRect.width - 12;
            top = badgeRect.top + (badgeRect.height / 2) - (tooltipRect.height / 2);
            tooltip.classList.add('tooltip-left');
        } else if (spaceBelow > tooltipRect.height + 20) {
            // Visa under
            left = badgeRect.left + (badgeRect.width / 2) - (tooltipRect.width / 2);
            top = badgeRect.bottom + 10;
            tooltip.classList.add('tooltip-below');
        } else {
            // Visa ovanför
            left = badgeRect.left + (badgeRect.width / 2) - (tooltipRect.width / 2);
            top = badgeRect.top - tooltipRect.height - 10;
            tooltip.classList.add('tooltip-above');
        }
        
        // Begränsa till viewport
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        
        // Markera badge som aktiv
        badge.classList.add('tooltip-active');
    }
    
    hideAllTooltips() {
        document.querySelectorAll('.tooltip-popup').forEach(t => t.remove());
        document.querySelectorAll('.info-badge.tooltip-active').forEach(b => b.classList.remove('tooltip-active'));
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // MODAL CONTROL
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    async open() {
        await this.loadCurrentConfig();
        
        // Spara djup kopia för BIOS-stil återställning
        this.originalConfig = JSON.parse(JSON.stringify(this.currentConfig));
        this.clearChanges();
        
        // Hämta destinationer för alla tavlor
        await this.refreshAllTavlorData();
        
        this.populateForm();
        
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    handleClose() {
        // Samma som cancel om det finns ändringar
        if (this.hasChanges()) {
            this.handleCancel();
        } else {
            this.close();
        }
    }

    handleCancel() {
        if (!this.hasChanges()) {
            this.close();
            return;
        }
        
        // Visa bekräftelse-dialog med ändringssammanfattning
        this.showCancelConfirmation();
    }

    showCancelConfirmation() {
        const summary = this.getChangesSummary();
        
        let summaryHtml = '<ul style="text-align: left; margin: 15px 0;">';
        
        if (summary.removed.length > 0) {
            summary.removed.forEach(item => {
                summaryHtml += `<li style="color: #E74C3C;">ðŸ—‘ï¸ Borttagen: ${item}</li>`;
            });
        }
        if (summary.added.length > 0) {
            summary.added.forEach(item => {
                summaryHtml += `<li style="color: #27AE60;">âž• Ny: ${item}</li>`;
            });
        }
        if (summary.modified.length > 0) {
            summary.modified.forEach(item => {
                summaryHtml += `<li style="color: #F39C12;">✏️ Ändrad: ${item}</li>`;
            });
        }
        
        summaryHtml += '</ul>';
        
        // Skapa modal
        const confirmModal = document.createElement('div');
        confirmModal.className = 'confirm-modal-overlay';
        confirmModal.innerHTML = `
            <div class="confirm-modal">
                <h3>⚠️ï¸ Ångra ändringar?</h3>
                <p>Följande ändringar kommer kastas:</p>
                ${summaryHtml}
                <div class="confirm-buttons">
                    <button class="btn-confirm-yes">Ja, ångra allt</button>
                    <button class="btn-confirm-no">Nej, fortsätt redigera</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        // Event handlers
        confirmModal.querySelector('.btn-confirm-yes').addEventListener('click', () => {
            confirmModal.remove();
            this.restoreOriginal();
            this.close();
        });
        
        confirmModal.querySelector('.btn-confirm-no').addEventListener('click', () => {
            confirmModal.remove();
        });
        
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
            }
        });
    }

    restoreOriginal() {
        // Återställ till original config (BIOS-stil)
        this.currentConfig = JSON.parse(JSON.stringify(this.originalConfig));
        this.clearChanges();
        console.log('â†©ï¸ Config återställd till original');
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.clearChanges();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DATA LOADING
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    async loadCurrentConfig() {
        const saved = localStorage.getItem('sl_tavla_config');
        
        if (saved) {
            this.currentConfig = JSON.parse(saved);
            console.log('âœ… Config från localStorage');
        } else {
            try {
                const response = await fetch('config.json');
                const data = await response.json();
                
                this.currentConfig = {
                    layout: data.layout || { orientation: 'horizontal', mode: 'fixed' },
                    display: data.display || { theme: 'classic', updateInterval: 30000, scrollSpeed: 8.8 },
                    deviations: data.deviations || { enabled: true, displayDuration: 10000, displayInterval: 30000 },
                    departuresTable: data.departuresTable || { maxDepartures: 10 },
                    tavlor: data.tavlor || []
                };
                console.log('âœ… Config från config.json');
            } catch (error) {
                console.error('âŒ Kunde inte ladda config:', error);
                this.currentConfig = this.getDefaultConfig();
            }
        }
        
        // Initiera _availableLines och _destinations för alla tavlor
        // OCH rekonstruera lineFilter från transportMode/lineDesignation
        this.currentConfig.tavlor.forEach(tavla => {
            if (!tavla._availableLines) tavla._availableLines = [];
            if (!tavla._destinations) tavla._destinations = {};
            
            // Rekonstruera lineFilter för varje display
            tavla.displays.forEach(display => {
                if (display.lineFilter === undefined) {
                    if (display.transportMode && display.lineDesignation) {
                        display.lineFilter = `${display.transportMode}-${display.lineDesignation}`;
                    } else if (display.transportMode) {
                        display.lineFilter = `${display.transportMode}-*`;
                    } else {
                        display.lineFilter = null;
                    }
                }
            });
        });
    }

    getDefaultConfig() {
        return {
            layout: { orientation: 'horizontal', mode: 'fixed' },
            display: { theme: 'classic', updateInterval: 30000, scrollSpeed: 8.8 },
            deviations: { enabled: true, displayDuration: 10000, displayInterval: 30000 },
            departuresTable: { maxDepartures: 10 },
            tavlor: []
        };
    }

    async refreshAllTavlorData() {
        const promises = this.currentConfig.tavlor
            .filter(tavla => tavla.station.siteId)
            .map(async (tavla) => {
                try {
                    const data = await this.fetchStationData(tavla.station.siteId);
                    tavla._availableLines = data.lines;
                    tavla._destinations = data.destinations;
                    console.log(`ðŸ”„ ${tavla.station.name}: ${data.lines.length} linjer, destinationer hämtade`);
                } catch (err) {
                    console.error(`âŒ Fel för ${tavla.station.name}:`, err);
                }
            });
        
        await Promise.all(promises);
    }

    async fetchStationData(siteId) {
        // Hämta avgångar via cache-proxy och extrahera linjer + destinationer
        // FÖRBÄTTRAD: Retry-logik för att hantera natt-scenario
        
        let data = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts && !data) {
            try {
                console.log(`ðŸ”„ Hämtar data för station ${siteId} (försök ${attempts + 1}/${maxAttempts})...`);
                
                const url = `/api/departures/${siteId}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const result = await response.json();
                
                // Kolla om vi fick data
                if (result.departures && result.departures.length > 0) {
                    data = result;
                    console.log(`âœ… Fick ${result.departures.length} avgångar för station ${siteId}`);
                } else if (result.error) {
                    console.warn(`⚠️ï¸ API-fel: ${result.error}`);
                    // Retry
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`ðŸ”„ Väntar 2s innan retry...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } else {
                    // Inga avgångar just nu (kan vara normalt på natten)
                    console.log(`⚠️ï¸ Inga avgångar för station ${siteId} just nu`);
                    data = result; // Använd tom data
                }
                
            } catch (error) {
                console.error(`âŒ Fel vid hämtning av station ${siteId}:`, error);
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`ðŸ”„ Väntar 2s innan retry...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        // Om vi inte fick någon data alls efter retries
        if (!data) {
            console.error(`âŒ Kunde inte hämta data för station ${siteId} efter ${maxAttempts} försök`);
            return { lines: [], destinations: {} };
        }
        
        // FAS 2: Uppdatera linje-cache så den finns direkt i settings
        if (data && data.departures && typeof window.updateLinesCache === 'function') {
            window.updateLinesCache(siteId, data.departures);
        }
        
        const linesMap = new Map();
        const destinationsMap = {}; // lineKey -> Set of destinations
        
        if (data.departures) {
            data.departures.forEach(dep => {
                const mode = dep.line?.transport_mode;
                const designation = dep.line?.designation;
                const destination = dep.destination || dep.direction;
                const lineName = dep.line?.name || destination;
                
                if (designation && mode) {
                    const lineKey = `${mode}-${designation}`;
                    
                    // Lägg till linje
                    if (!linesMap.has(lineKey)) {
                        linesMap.set(lineKey, {
                            designation,
                            name: lineName,
                            transport_mode: mode,
                            isLive: true
                        });
                    }
                    
                    // Lägg till destination
                    if (!destinationsMap[lineKey]) {
                        destinationsMap[lineKey] = new Set();
                    }
                    if (destination) {
                        destinationsMap[lineKey].add(destination);
                    }
                }
            });
        }
        
        // Konvertera destinations Sets till sorterade arrays
        const destinations = {};
        Object.keys(destinationsMap).forEach(key => {
            destinations[key] = Array.from(destinationsMap[key]).sort();
        });
        
        // Mergea med cache för att inkludera nattrafik
        const cachedLines = window.getCachedLines ? window.getCachedLines(siteId) : [];
        cachedLines.forEach(line => {
            const key = `${line.transport_mode}-${line.designation}`;
            if (!linesMap.has(key)) {
                linesMap.set(key, { ...line, isLive: false });
            }
        });
        
        return {
            lines: Array.from(linesMap.values()).sort((a, b) => {
                if (a.transport_mode !== b.transport_mode) {
                    return a.transport_mode.localeCompare(b.transport_mode);
                }
                const numA = parseInt(a.designation);
                const numB = parseInt(b.designation);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.designation.localeCompare(b.designation);
            }),
            destinations
        };
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // FORM POPULATION
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    populateForm() {
        const config = this.currentConfig;
        
        // FAS 2: Migration - sätt _createdAt på gamla tavlor som saknar det
        if (config.tavlor) {
            config.tavlor.forEach(tavla => {
                if (!tavla._createdAt) {
                    // Gamla tavlor får timestamp = nu (de är äldre än 24h så ingen varning visas)
                    tavla._createdAt = Date.now() - (25 * 60 * 60 * 1000);  // 25h sedan
                }
            });

        // PAKET 2: Migrera gamla display-strukturer till multi-linje
        if (config.tavlor) {
            config.tavlor.forEach(tavla => {
                if (tavla.displays) {
                    tavla.displays.forEach(display => {
                        // Om gamla strukturen (lineFilter/direction) finns
                        if (display.lineFilter !== undefined && !display.lines) {
                            // Migrera till ny struktur
                            display.lines = [];
                            if (display.lineFilter || display.direction) {
                                display.lines.push({
                                    lineFilter: display.lineFilter || null,
                                    direction: display.direction || null
                                });
                            }
                            // Ta bort gamla fält
                            delete display.lineFilter;
                            delete display.direction;
                        }
                        // Om lines inte finns alls (helt ny skylt)
                        if (!display.lines) {
                            display.lines = [];
                        }
                    });
                }
            });
        }

        }
        
        
        // Layout
        document.getElementById('setting-orientation').value = config.layout.orientation;
        document.getElementById('setting-mode').value = config.layout.mode;
        document.getElementById('mode-field').style.display = 
            config.layout.orientation === 'horizontal' ? 'block' : 'none';
        
        // Display
        document.getElementById('setting-theme').value = config.display.theme;
        document.getElementById('setting-scroll-speed').value = config.display.scrollSpeed;
        
        const updateIntervalSeconds = Math.round(config.display.updateInterval / 1000);
        document.getElementById('setting-update-interval').value = updateIntervalSeconds;
        
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value == updateIntervalSeconds);
        });
        
        // Deviations
        document.getElementById('setting-deviations-enabled').checked = config.deviations.enabled;
        const deviationDurationSeconds = Math.round((config.deviations.displayDuration || 10000) / 1000);
        const deviationIntervalSeconds = Math.round((config.deviations.displayInterval || 30000) / 1000);
        document.getElementById('setting-deviation-duration').value = deviationDurationSeconds;
        document.getElementById('setting-deviation-interval').value = deviationIntervalSeconds;
        document.getElementById('deviation-duration-field').style.display = 
            config.deviations.enabled ? 'block' : 'none';
        document.getElementById('deviation-interval-field').style.display = 
            config.deviations.enabled ? 'block' : 'none';
        
        // Departures table
        document.getElementById('setting-max-departures').value = config.departuresTable.maxDepartures;
        
        // Tavlor
        this.renderTavlor();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // HÄR SLUTAR DEL 1
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
}

console.log('âœ… SettingsManager DEL 1 laddad');
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SETTINGS MANAGER - DEL 2
// Tavlor, skyltar, kombinerad linje-dropdown, save/export
// VERSION: 3.0.0 - Omdesignad UX
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// HÄR BÖRJAR DEL 2

const TRANSPORT_MODE_NAMES = {
    'METRO': { name: 'Tunnelbana', icon: 'ðŸš‡' },
    'BUS': { name: 'Buss', icon: 'ðŸšŒ' },
    'TRAIN': { name: 'Pendeltåg', icon: 'ðŸš†' },
    'TRAM': { name: 'Spårvagn', icon: '🚊' },
    'SHIP': { name: 'Båt', icon: 'â›´ï¸' }
};

SettingsManager.prototype.renderTavlor = function() {
    const tavlorList = document.getElementById('tavlor-list');
    tavlorList.innerHTML = '';
    
    if (this.currentConfig.tavlor.length === 0) {
        tavlorList.innerHTML = `
            <div class="empty-state">
                <p>ðŸš‰ Inga tavlor ännu</p>
                <p class="empty-hint">Klicka "Lägg till tavla" för att börja</p>
            </div>
        `;
        return;
    }
    
    this.currentConfig.tavlor.forEach((tavla, index) => {
        // DEFAULT: Alla tavlor kollapsade
        if (tavla._collapsed === undefined) {
            tavla._collapsed = true;
        }
        const tavlaEl = this.createTavlaElement(tavla, index);
        tavlorList.appendChild(tavlaEl);
    });
};

SettingsManager.prototype.createTavlaElement = function(tavla, index) {
    const div = document.createElement('div');
    div.className = 'tavla-card';
    div.dataset.index = index;
    
    const stationName = tavla.station.name || 'Välj station';
    const displayCount = tavla.displays.length;
    const isExpanded = !tavla._collapsed;
    
    // Hämta cache-info om station är vald
    // FAS 2: Hämta cache-info MEN visa bara första 24h efter tavlan skapades
    let cacheInfoHtml = '';
    
    // Kontrollera tavla-ålder (visa bara om < 24h gammal)
    const tavlaAge = tavla._createdAt ? (Date.now() - tavla._createdAt) / (1000 * 60 * 60) : 999;
    const showCacheInfo = tavlaAge < 24;  // Visa bara första 24h
    
    // Hantera olika states: loading, error, eller cache-info
    if (tavla._loadingLines) {
        cacheInfoHtml = `
            <div class="cache-info-box" style="background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%); border-left-color: #ffc107;">
                <span class="cache-info-icon">â³</span>
                <span class="cache-info-text">Hämtar tillgängliga linjer för ${tavla.station.name}...</span>
            </div>
        `;
    } else if (tavla._loadingError) {
        cacheInfoHtml = `
            <div class="cache-info-box" style="background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%); border-left-color: #dc3545;">
                <span class="cache-info-icon">âŒ</span>
                <span class="cache-info-text">Kunde inte hämta linjer. Försök igen eller välj en annan station.</span>
            </div>
        `;
    } else if (showCacheInfo && tavla.station.siteId && typeof window.stationSearch !== 'undefined') {
        const cacheInfo = window.stationSearch.getLinesCacheInfo(tavla.station.siteId);
        if (cacheInfo && cacheInfo.message) {
            cacheInfoHtml = `
                <div class="cache-info-box">
                    <span class="cache-info-icon">ðŸ’¾</span>
                    <span class="cache-info-text">${cacheInfo.message}</span>
                </div>
            `;
        }
    }

    
    div.innerHTML = `
        <div class="tavla-header" data-action="toggle">
            <div class="tavla-title">
                <span class="collapse-icon">${isExpanded ? 'â–¼' : 'â–¶'}</span>
                <span class="tavla-name">Tavla ${index + 1}: ${stationName}</span>
                <span class="tavla-badge">${displayCount} skylt${displayCount !== 1 ? 'ar' : ''}</span>
            </div>
            <button class="btn-icon btn-delete-tavla" title="Ta bort tavla" ${this.currentConfig.tavlor.length === 1 ? 'disabled' : ''}>ðŸ—‘ï¸</button>
        </div>
        
        <div class="tavla-body" style="display: ${isExpanded ? 'block' : 'none'}">
            <!-- Station -->
            <div class="setting-group station-group">
                <label class="setting-label">
                    ðŸ” Station
                    <span class="info-badge" data-tooltip="Välj vilken station denna tavla visar avgångar från">i</span>
                </label>
                <div class="station-search-wrapper">
                    <input type="text" class="station-search-input" placeholder="Sök station..." value="${tavla.station.name || ''}">
                    <input type="hidden" class="station-id-input" value="${tavla.station.siteId || ''}">
                </div>
                ${cacheInfoHtml}
            </div>
            
            <!-- Tabellfilter (direkt under station) -->
            <div class="setting-group table-filter-group" style="display: ${tavla.station.siteId ? 'block' : 'none'}">
                <label class="setting-label">
                    ðŸ“Š Linjer i avgångstabellen
                    <span class="info-badge" data-tooltip="Välj vilka linjer som visas i tabellen under skyltarna">i</span>
                </label>
                <div class="table-filter-compact"></div>
            </div>
            
            <!-- Skyltar -->
            <div class="setting-group skyltar-group" style="display: ${tavla.station.siteId ? 'block' : 'none'}">
                <div class="setting-group-header">
                    <h4>ðŸ“º Skyltar</h4>
                    <span class="group-description">En skylt = en LED-display för specifik linje/riktning</span>
                </div>
                <div class="skyltar-list"></div>
                <button class="btn-add-skylt">+ Lägg till skylt</button>
            </div>
            
            <!-- Meddelande om ingen station vald -->
            <div class="no-station-msg" style="display: ${tavla.station.siteId ? 'none' : 'block'}">
                <p>ðŸ‘† Välj en station ovan för att fortsätta</p>
            </div>
        </div>
    `;
    
    // Event: Toggle collapse
    div.querySelector('.tavla-header').addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-tavla')) return;
        
        tavla._collapsed = !tavla._collapsed;
        const body = div.querySelector('.tavla-body');
        const icon = div.querySelector('.collapse-icon');
        body.style.display = tavla._collapsed ? 'none' : 'block';
        icon.textContent = tavla._collapsed ? 'â–¶' : 'â–¼';
    });
    
    // Event: Delete tavla
    div.querySelector('.btn-delete-tavla').addEventListener('click', () => {
        if (this.currentConfig.tavlor.length <= 1) return;
        
        this.logChange('remove', `Tavla ${index + 1}: ${stationName}`);
        this.currentConfig.tavlor.splice(index, 1);
        this.renderTavlor();
    });
    
    // Event: Station search
    const searchInput = div.querySelector('.station-search-input');
    const idInput = div.querySelector('.station-id-input');
    
    window.stationSearch.createAutocomplete(searchInput, async (station) => {
        const oldName = tavla.station.name;
        
        idInput.value = station.id;
        tavla.station.siteId = station.id;
        tavla.station.name = station.name;
        
        // Rensa displays vid stationsbyte
        if (oldName && oldName !== station.name && tavla.displays.length > 0) {
            this.logChange('modify', `Tavla ${index + 1}: Bytte station (${oldName} â†’ ${station.name}), skyltar rensade`);
            tavla.displays = [];
        } else {
            this.logChange('modify', `Tavla ${index + 1}: Station vald (${station.name})`);
        }
        
        // Visa loading-indikator
        tavla._loadingLines = true;
        this.renderTavlor();
        
        try {
            // Hämta data för nya stationen
            const data = await this.fetchStationData(station.id);
            tavla._availableLines = data.lines;
            tavla._destinations = data.destinations;
            tavla._loadingLines = false;
        } catch (error) {
            console.error(`âŒ Fel vid hämtning av linjer för ${station.name}:`, error);
            tavla._loadingLines = false;
            tavla._loadingError = true;
        }
        
        // Re-render denna tavla
        this.renderTavlor();
    });
    
    // Render skyltar
    const skyltarList = div.querySelector('.skyltar-list');
    if (tavla.station.siteId) {
        tavla.displays.forEach((display, displayIndex) => {
            const skyltEl = this.createDisplayElement(display, tavla, index, displayIndex);
            skyltarList.appendChild(skyltEl);
        });
        
        if (tavla.displays.length === 0) {
            skyltarList.innerHTML = '<p class="empty-hint">Inga skyltar - lägg till en nedan</p>';
        }
    }
    
    // Event: Add skylt
    div.querySelector('.btn-add-skylt').addEventListener('click', () => {
        tavla.displays.push({
            lines: [],  // PAKET 2: Array av {lineFilter, direction}
            maxScrollingDepartures: 3,
            _collapsed: false  // Nya skyltar expanderade
        });
        this.logChange('add', `Skylt på ${tavla.station.name}`);
        this.renderTavlor();
    });
    
    // Render table filter
    const filterContainer = div.querySelector('.table-filter-compact');
    if (tavla.station.siteId) {
        this.renderTableFilterCompact(tavla, index, filterContainer);
    }
    
    return div;
};

SettingsManager.prototype.createDisplayElement = function(display, tavla, tavlaIndex, displayIndex) {
    const div = document.createElement('div');
    
    // DEFAULT: Skyltar kollapsade
    if (display._collapsed === undefined) {
        display._collapsed = true;
    }
    const isExpanded = !display._collapsed;
    
    div.className = `skylt-card${display._collapsed ? ' collapsed' : ''}`;
    
    // PAKET 2: Säkerställ lines array finns
    if (!display.lines) {
        display.lines = [];
    }
    
    // Generera skylt-namn baserat på lines
    const skyltName = this.generateSkyltName(display, tavla);
    
    // Skapa HTML för skylten
    div.innerHTML = `
        <div class="skylt-header" data-action="toggle">
            <div class="skylt-title">
                <span class="collapse-icon">${isExpanded ? 'â–¼' : 'â–¶'}</span>
                <span class="skylt-label">ðŸ“º Skylt ${displayIndex + 1}:</span>
                <span class="skylt-name">${skyltName}</span>
            </div>
            <button class="btn-icon btn-delete-skylt" title="Ta bort skylt">ðŸ—‘ï¸</button>
        </div>
        
        <div class="skylt-body" style="display: ${isExpanded ? 'block' : 'none'}">
            <div class="lines-container"></div>
            
            <button class="btn-add-line" ${display.lines.length >= 5 ? 'disabled' : ''} title="${display.lines.length >= 5 ? 'Max 5 linjer per skylt' : 'Lägg till linje'}">
                <span class="btn-icon">+</span>
                <span>Lägg till linje</span>
                ${display.lines.length >= 5 ? ' (max 5)' : ''}
            </button>
            
            <div class="setting-row" style="margin-top: 1rem;">
                <label class="setting-label-small">
                    Scroll-avgångar (gemensamt för alla linjer)
                    <span class="info-badge" data-tooltip="Hur många avgångar som visas samtidigt (mixat från alla linjer)">i</span>
                </label>
                <input type="number" class="skylt-scroll-input" min="1" max="10" value="${display.maxScrollingDepartures || 3}">
            </div>
        </div>
    `;
    
    // Rendera alla linjer
    const linesContainer = div.querySelector('.lines-container');
    display.lines.forEach((line, lineIndex) => {
        const lineElement = this.createLineElement(line, lineIndex, tavla, display);
        linesContainer.appendChild(lineElement);
    });
    
    // Event: Toggle collapse
    div.querySelector('.skylt-header').addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-skylt')) return;
        
        display._collapsed = !display._collapsed;
        div.classList.toggle('collapsed', display._collapsed);
        const body = div.querySelector('.skylt-body');
        const icon = div.querySelector('.collapse-icon');
        body.style.display = display._collapsed ? 'none' : 'block';
        icon.textContent = display._collapsed ? 'â–¶' : 'â–¼';
    });
    
    // Event: Delete skylt
    div.querySelector('.btn-delete-skylt').addEventListener('click', () => {
        this.logChange('remove', `Skylt: ${skyltName}`);
        tavla.displays.splice(displayIndex, 1);
        this.renderTavlor();
    });
    
    // Event: Add line
    div.querySelector('.btn-add-line').addEventListener('click', () => {
        if (display.lines.length >= 5) {
            alert('Max 5 linjer per skylt');
            return;
        }
        
        display.lines.push({
            lineFilter: null,
            direction: null
        });
        this.logChange('add', `Linje på skylt ${displayIndex + 1}`);
        this.renderTavlor();
    });
    
    // Event: Scroll count change
    div.querySelector('.skylt-scroll-input').addEventListener('change', (e) => {
        display.maxScrollingDepartures = parseInt(e.target.value) || 3;
        this.logChange('modify', `Scroll-avgångar: ${display.maxScrollingDepartures}`);
    });
    
    return div;
};

// PAKET 2: Ny funktion för att skapa linje-element
SettingsManager.prototype.createLineElement = function(line, lineIndex, tavla, display) {
    const div = document.createElement('div');
    div.className = 'line-row';
    
    // Bygg dropdown-options
    const lineOptions = this.buildLineDropdownOptions(tavla._availableLines || []);
    const directionOptions = this.buildDirectionOptions(line.lineFilter, tavla._destinations || {});
    
    div.innerHTML = `
        <div class="line-row-header">
            <span class="line-row-label">Linje ${lineIndex + 1}</span>
        </div>
        
        <div class="setting-row">
            <label class="setting-label-small">
                Linje
                <span class="info-badge" data-tooltip="Välj vilken linje som visas. 'Alla X' visar alla av ett trafikslag.">i</span>
            </label>
            <select class="line-filter-select">
                ${lineOptions}
            </select>
        </div>
        
        <div class="setting-row">
            <label class="setting-label-small">
                Riktning
                <span class="info-badge" data-tooltip="Välj vilken riktning/slutstation som visas">i</span>
            </label>
            <div class="direction-row">
                <select class="line-direction-select">
                    ${directionOptions}
                </select>
                <button class="btn-icon btn-delete-line" title="Ta bort linje">ðŸ—‘ï¸</button>
            </div>
        </div>
        
        ${lineIndex < display.lines.length - 1 ? '<div class="line-separator"></div>' : ''}
    `;
    
    // Set current values
    const lineSelect = div.querySelector('.line-filter-select');
    const dirSelect = div.querySelector('.line-direction-select');
    
    lineSelect.value = line.lineFilter || '';
    dirSelect.value = line.direction || '';
    
    // Event: Line change
    lineSelect.addEventListener('change', (e) => {
        line.lineFilter = e.target.value || null;
        
        // Uppdatera riktning-dropdown
        dirSelect.innerHTML = this.buildDirectionOptions(line.lineFilter, tavla._destinations || {});
        dirSelect.value = '';
        line.direction = null;
        
        this.logChange('modify', `Linje ${lineIndex + 1} ändrad`);
        
        // Uppdatera skylt-namn i headern
        const skyltCard = div.closest('.skylt-card');
        if (skyltCard) {
            const nameSpan = skyltCard.querySelector('.skylt-name');
            if (nameSpan) {
                nameSpan.textContent = this.generateSkyltName(display, tavla);
            }
        }
    });
    
    // Event: Direction change
    dirSelect.addEventListener('change', (e) => {
        line.direction = e.target.value || null;
        this.logChange('modify', `Riktning ${lineIndex + 1} ändrad`);
        
        // Uppdatera skylt-namn i headern
        const skyltCard = div.closest('.skylt-card');
        if (skyltCard) {
            const nameSpan = skyltCard.querySelector('.skylt-name');
            if (nameSpan) {
                nameSpan.textContent = this.generateSkyltName(display, tavla);
            }
        }
    });
    
    // Event: Delete line
    div.querySelector('.btn-delete-line').addEventListener('click', () => {
        if (display.lines.length === 1) {
            alert('En skylt måste ha minst en linje');
            return;
        }
        
        this.logChange('remove', `Linje ${lineIndex + 1} borttagen`);
        display.lines.splice(lineIndex, 1);
        this.renderTavlor();
    });
    
    return div;
};


SettingsManager.prototype.buildLineDropdownOptions = function(lines) {
    let html = '<option value="">Alla linjer</option>';
    
    // Gruppera per trafikslag
    const byMode = {};
    lines.forEach(line => {
        const mode = line.transport_mode;
        if (!byMode[mode]) byMode[mode] = [];
        byMode[mode].push(line);
    });
    
    // Lägg till "Alla X" per trafikslag
    const modes = Object.keys(byMode).sort();
    if (modes.length > 0) {
        html += '<optgroup label="Per trafikslag">';
        modes.forEach(mode => {
            const info = TRANSPORT_MODE_NAMES[mode] || { name: mode, icon: 'ðŸš' };
            const count = byMode[mode].length;
            html += `<option value="${mode}-*">${info.icon} Alla ${info.name.toLowerCase()} (${count} st)</option>`;
        });
        html += '</optgroup>';
    }
    
    // Enskilda linjer per trafikslag
    modes.forEach(mode => {
        const info = TRANSPORT_MODE_NAMES[mode] || { name: mode, icon: 'ðŸš' };
        const modeLines = byMode[mode].sort((a, b) => {
            const numA = parseInt(a.designation);
            const numB = parseInt(b.designation);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.designation.localeCompare(b.designation);
        });
        
        html += `<optgroup label="${info.icon} ${info.name}">`;
        modeLines.forEach(line => {
            const marker = line.isLive ? 'â—' : 'â—‹';
            html += `<option value="${mode}-${line.designation}">${marker} ${line.designation} ${line.name || ''}</option>`;
        });
        html += '</optgroup>';
    });
    
    return html;
};

SettingsManager.prototype.buildDirectionOptions = function(lineFilter, destinations) {
    let html = '<option value="">Båda riktningar</option>';
    
    if (!lineFilter || lineFilter.endsWith('-*')) {
        // Kan inte visa specifika destinationer för "alla" eller "alla av trafikslag"
        html += '<option value="A">A (första alfabetiskt)</option>';
        html += '<option value="B">B (andra alfabetiskt)</option>';
        return html;
    }
    
    // Hämta destinationer för specifik linje
    const lineDestinations = destinations[lineFilter];
    
    if (lineDestinations && lineDestinations.length > 0) {
        // Sortera alfabetiskt (A = första, B = andra)
        const sorted = [...lineDestinations].sort();
        
        if (sorted.length >= 1) {
            html += `<option value="A">â†’ ${sorted[0]}</option>`;
        }
        if (sorted.length >= 2) {
            html += `<option value="B">â†’ ${sorted[1]}</option>`;
        }
        // Om fler än 2 destinationer (ovanligt), visa dem också
        for (let i = 2; i < sorted.length; i++) {
            html += `<option value="${sorted[i]}">â†’ ${sorted[i]}</option>`;
        }
    } else {
        // Fallback om inga destinationer hittades
        html += '<option value="A">A (första alfabetiskt)</option>';
        html += '<option value="B">B (andra alfabetiskt)</option>';
    }
    
    return html;
};

SettingsManager.prototype.generateSkyltName = function(display, tavla) {
    // PAKET 2: Hantera flera linjer
    if (!display.lines || display.lines.length === 0) {
        return 'Ingen linje vald';
    }
    
    // Om bara en linje - visa som förut
    if (display.lines.length === 1) {
        const line = display.lines[0];
        const lineFilter = line.lineFilter;
        const direction = line.direction;
        
        // PRIORITET 1: Om destination är vald, visa den först
        if (direction) {
            // Specifik destination (inte A/B)
            if (direction !== 'A' && direction !== 'B') {
                if (lineFilter && !lineFilter.endsWith('-*')) {
                    const [mode, designation] = lineFilter.split('-');
                    const info = TRANSPORT_MODE_NAMES[mode] || { icon: 'ðŸš' };
                    return `${info.icon} ${designation} â†’ ${direction}`;
                }
                return `â†’ ${direction}`;
            }
            
            // A/B-riktning - hämta faktisk destination
            if (lineFilter && tavla._destinations) {
                const destKey = lineFilter.endsWith('-*') ? null : lineFilter;
                
                if (destKey && tavla._destinations[destKey]) {
                    const dests = [...tavla._destinations[destKey]].sort();
                    const dest = direction === 'A' ? dests[0] : dests[1];
                    if (dest) {
                        const [mode, designation] = lineFilter.split('-');
                        const info = TRANSPORT_MODE_NAMES[mode] || { icon: 'ðŸš' };
                        return `${info.icon} ${designation} â†’ ${dest}`;
                    }
                }
            }
            
            // Fallback för A/B utan känd destination
            const dirLabel = direction === 'A' ? 'riktning A' : 'riktning B';
            if (lineFilter && lineFilter.endsWith('-*')) {
                const mode = lineFilter.replace('-*', '');
                const info = TRANSPORT_MODE_NAMES[mode] || { name: mode };
                return `Alla ${info.name.toLowerCase()} (${dirLabel})`;
            }
            if (lineFilter) {
                const [mode, designation] = lineFilter.split('-');
                const info = TRANSPORT_MODE_NAMES[mode] || { icon: 'ðŸš' };
                return `${info.icon} ${designation} (${dirLabel})`;
            }
        }
        
        // PRIORITET 2: Om ingen destination men lineFilter finns
        if (lineFilter) {
            if (lineFilter.endsWith('-*')) {
                // "Alla X"
                const mode = lineFilter.replace('-*', '');
                const info = TRANSPORT_MODE_NAMES[mode] || { name: mode };
                return `Alla ${info.name.toLowerCase()}`;
            } else {
                // Specifik linje
                const [mode, designation] = lineFilter.split('-');
                const info = TRANSPORT_MODE_NAMES[mode] || { icon: 'ðŸš' };
                return `${info.icon} ${designation}`;
            }
        }
        
        // Fallback
        return 'Alla linjer';
    }
    
    // Flera linjer - sammanfatta
    const lineDesignations = [];
    let totalDirections = 0;
    
    display.lines.forEach(line => {
        if (line.lineFilter && !line.lineFilter.endsWith('-*')) {
            const [mode, designation] = line.lineFilter.split('-');
            lineDesignations.push(designation);
        }
        if (line.direction) {
            totalDirections++;
        }
    });
    
    if (lineDesignations.length > 0) {
        // Visa linjebeteckningar
        const lineList = lineDesignations.slice(0, 3).join(', ');
        const moreCount = lineDesignations.length - 3;
        
        let result = lineList;
        if (moreCount > 0) {
            result += ` +${moreCount} till`;
        }
        
        // Lägg till riktningsinfo
        if (totalDirections > 0) {
            result += ` â†’ ${totalDirections} riktning${totalDirections !== 1 ? 'ar' : ''}`;
        }
        
        return result;
    }
    
    // Bara "Alla X" val
    return `${display.lines.length} linjer`;
};


SettingsManager.prototype.renderTableFilterCompact = function(tavla, tavlaIndex, container) {
    const lines = tavla._availableLines || [];
    
    if (lines.length === 0) {
        container.innerHTML = '<p class="empty-hint">Inga linjer tillgängliga</p>';
        return;
    }
    
    // Räkna valda
    const allKeys = lines.map(l => `${l.transport_mode}-${l.designation}`);
    const filter = tavla.tableLineFilter;
    
    // Hantera både object och null
    const selectedCount = filter ? Object.keys(filter).length : allKeys.length;
    const showingAll = !filter || Object.keys(filter).length === 0 || Object.keys(filter).length === allKeys.length;
    
    container.innerHTML = `
        <div class="filter-summary">
            <span class="filter-count">${showingAll ? 'Alla linjer' : `${selectedCount} av ${allKeys.length} linjer`}</span>
            <button class="btn-small btn-edit-filter">Ändra</button>
        </div>
        <div class="filter-detail" style="display: none;"></div>
    `;
    
    // Event: Expandera filter
    container.querySelector('.btn-edit-filter').addEventListener('click', () => {
        const detail = container.querySelector('.filter-detail');
        const isVisible = detail.style.display !== 'none';
        
        if (isVisible) {
            detail.style.display = 'none';
        } else {
            this.renderTableFilterDetail(tavla, tavlaIndex, detail, lines);
            detail.style.display = 'block';
        }
    });
};

SettingsManager.prototype.renderTableFilterDetail = function(tavla, tavlaIndex, container, lines) {
    // Gruppera per trafikslag
    const byMode = {};
    lines.forEach(line => {
        const mode = line.transport_mode;
        if (!byMode[mode]) byMode[mode] = [];
        byMode[mode].push(line);
    });
    
    const destinations = tavla._destinations || {};
    
    let html = `
        <div class="filter-buttons">
            <button class="btn-small btn-select-all">Välj alla</button>
            <button class="btn-small btn-select-none">Avmarkera alla</button>
        </div>
        <div class="filter-grid-with-directions">
    `;
    
    Object.keys(byMode).sort().forEach(mode => {
        const info = TRANSPORT_MODE_NAMES[mode] || { name: mode, icon: 'ðŸš' };
        const modeLines = byMode[mode].sort((a, b) => {
            const numA = parseInt(a.designation);
            const numB = parseInt(b.designation);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.designation.localeCompare(b.designation);
        });
        
        html += `<div class="filter-mode-group-with-directions">
            <strong>${info.icon} ${info.name}</strong>`;
        
        modeLines.forEach(line => {
            const key = `${mode}-${line.designation}`;
            const lineDestinations = destinations[key] || [];
            
            // Nuvarande filter
            const currentFilter = tavla.tableLineFilter || {};
            const isChecked = currentFilter.hasOwnProperty(key);
            const currentDirection = isChecked ? currentFilter[key] : 'both';
            
            // Bygg dropdown options
            let directionOptions = '<option value="both">Båda riktningar</option>';
            if (lineDestinations.length > 0) {
                directionOptions += '<option disabled>â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€</option>';
                lineDestinations.forEach(dest => {
                    const selected = currentDirection === dest ? 'selected' : '';
                    directionOptions += `<option value="${dest}" ${selected}>â†’ ${dest}</option>`;
                });
            }
            
            html += `
                <label class="filter-line-with-direction">
                    <input type="checkbox" data-key="${key}" ${isChecked ? 'checked' : ''}>
                    <span class="line-number">${line.designation}</span>
                    <select class="direction-select" data-key="${key}" ${!isChecked ? 'disabled' : ''}>
                        ${directionOptions}
                    </select>
                </label>
            `;
        });
        
        html += '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Event handlers
    const updateFilter = () => {
        const newFilter = {};
        
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            const key = cb.dataset.key;
            const select = container.querySelector(`select[data-key="${key}"]`);
            const direction = select ? select.value : 'both';
            newFilter[key] = direction;
        });
        
        // Om alla linjer valda med "both", sätt till null
        const allKeys = lines.map(l => `${l.transport_mode}-${l.designation}`);
        const allSelected = Object.keys(newFilter).length === allKeys.length;
        const allBoth = allSelected && Object.values(newFilter).every(v => v === 'both');
        
        tavla.tableLineFilter = (allBoth || Object.keys(newFilter).length === 0) ? null : newFilter;
        
        // Uppdatera summary
        const filterGroup = container.closest('.table-filter-group');
        const summary = filterGroup.querySelector('.filter-count');
        const count = Object.keys(newFilter).length;
        summary.textContent = !tavla.tableLineFilter ? 'Alla linjer' : `${count} av ${allKeys.length} linjer`;
    };
    
    // Checkbox change - enable/disable dropdown
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const key = e.target.dataset.key;
            const select = container.querySelector(`select[data-key="${key}"]`);
            if (select) {
                select.disabled = !e.target.checked;
            }
            updateFilter();
        });
    });
    
    // Dropdown change
    container.querySelectorAll('.direction-select').forEach(select => {
        select.addEventListener('change', updateFilter);
    });
    
    // Select all/none buttons
    container.querySelector('.btn-select-all').addEventListener('click', () => {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
            const select = container.querySelector(`select[data-key="${cb.dataset.key}"]`);
            if (select) select.disabled = false;
        });
        updateFilter();
    });
    
    container.querySelector('.btn-select-none').addEventListener('click', () => {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            const select = container.querySelector(`select[data-key="${cb.dataset.key}"]`);
            if (select) {
                select.disabled = true;
                select.value = 'both';
            }
        });
        updateFilter();
    });
};

SettingsManager.prototype.addTavla = function() {
    this.currentConfig.tavlor.push({
        station: { siteId: '', name: '' },
        displays: [],
        tableLineFilter: null,
        _availableLines: [],
        _destinations: {},
        _collapsed: false,
        _createdAt: Date.now(),  // FAS 2: Timestamp när tavlan skapades
    });
    this.logChange('add', `Ny tavla`);
    this.renderTavlor();
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SAVE & EXPORT/IMPORT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

SettingsManager.prototype.collectFormData = function() {
    // Samla värden från formulär till currentConfig
    this.currentConfig.layout.orientation = document.getElementById('setting-orientation').value;
    this.currentConfig.layout.mode = document.getElementById('setting-mode').value;
    this.currentConfig.display.theme = document.getElementById('setting-theme').value;
    this.currentConfig.display.scrollSpeed = parseFloat(document.getElementById('setting-scroll-speed').value);
    this.currentConfig.display.updateInterval = parseInt(document.getElementById('setting-update-interval').value) * 1000;
    this.currentConfig.deviations.enabled = document.getElementById('setting-deviations-enabled').checked;
    this.currentConfig.deviations.displayDuration = parseInt(document.getElementById('setting-deviation-duration').value) * 1000;
    this.currentConfig.deviations.displayInterval = parseInt(document.getElementById('setting-deviation-interval').value) * 1000;
    this.currentConfig.departuresTable.maxDepartures = parseInt(document.getElementById('setting-max-departures').value);
};

SettingsManager.prototype.validate = function() {
    const errors = [];
    
    this.currentConfig.tavlor.forEach((tavla, i) => {
        if (!tavla.station.siteId || !tavla.station.name) {
            errors.push(`Tavla ${i + 1}: Station måste väljas`);
        }
    });
    
    return errors;
};

SettingsManager.prototype.cleanConfigForSave = function(config) {
    // Ta bort temporära fält som börjar med _
    const clean = JSON.parse(JSON.stringify(config));
    
    clean.tavlor.forEach(tavla => {
        delete tavla._availableLines;
        delete tavla._destinations;
        delete tavla._collapsed;
        
        // Konvertera nya lineFilter till gammalt format för bakåtkompatibilitet
        tavla.displays.forEach(display => {
            if (display.lineFilter) {
                if (display.lineFilter.endsWith('-*')) {
                    // "MODE-*" -> transportMode utan lineDesignation
                    display.transportMode = display.lineFilter.replace('-*', '');
                    display.lineDesignation = null;
                } else {
                    // "MODE-LINE" -> båda
                    const [mode, line] = display.lineFilter.split('-');
                    display.transportMode = mode;
                    display.lineDesignation = line;
                }
            } else {
                display.transportMode = null;
                display.lineDesignation = null;
            }
            delete display.lineFilter;
        });
    });
    
    return clean;
};

SettingsManager.prototype.save = function() {
    this.collectFormData();
    
    const errors = this.validate();
    if (errors.length > 0) {
        alert('⚠️ï¸ Fel i inställningar:\n\n' + errors.join('\n'));
        return;
    }
    
    // Rensa och spara
    const cleanConfig = this.cleanConfigForSave(this.currentConfig);
    localStorage.setItem('sl_tavla_config', JSON.stringify(cleanConfig));
    
    console.log('âœ… Config sparad');
    this.close();
    
    alert('âœ… Inställningar sparade! Sidan laddas om...');
    location.reload();
};

SettingsManager.prototype.export = function() {
    this.collectFormData();
    const cleanConfig = this.cleanConfigForSave(this.currentConfig);
    
    const blob = new Blob([JSON.stringify(cleanConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `sl_tavla_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    console.log('âœ… Config exporterad');
};

SettingsManager.prototype.import = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const config = JSON.parse(event.target.result);
            
            if (!config.tavlor || !config.display || !config.layout) {
                throw new Error('Ogiltig config-struktur');
            }
            
            this.currentConfig = config;
            this.logChange('modify', 'Config importerad');
            this.populateForm();
            
            alert('âœ… Konfiguration importerad! Granska och spara för att aktivera.');
        } catch (error) {
            alert('âŒ Kunde inte importera: ' + error.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HÄR SLUTAR DEL 2
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Initiera global instans
window.settingsManager = new SettingsManager();
console.log('âœ… SettingsManager DEL 2 laddad - Redo!');
