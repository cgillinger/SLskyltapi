// ═══════════════════════════════════════════════════════════
// DISPLAY RENDERER - Fixed Scroll Implementation
//
// Ansvar: Rendera SL-skyltar med korrekt scroll-logik
// FIX: Använder getBoundingClientRect() för korrekt mätning
// ═══════════════════════════════════════════════════════════

class DisplayRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.canvas = null;

        // Scroll-hantering med avbrytbarhet
        this.scrollRunId = 0;
        this.activeAnimations = [];

        // State för att undvika "random" timing pga omrender
        this.lastMainKey = null;
        this.lastShouldScroll = false;
        this.isScrolling = false;
    }

    stopScroll() {
        this.scrollRunId += 1;
        this.isScrolling = false;

        for (const anim of this.activeAnimations) {
            try {
                anim.cancel();
            } catch (e) {
                // Animation redan avslutad
            }
        }
        this.activeAnimations = [];
    }

    /**
     * Mät faktisk rendererad bredd av text med KORREKT font-size
     * Hämtar computed style från DOM för att få rätt storlek efter CSS-skalning
     */
    measureTextWidth(text, element) {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
        }

        // Hämta FAKTISK computed font från elementet
        let fontSize = '28px';
        let fontFamily = 'VT323, monospace';
        let fontWeight = '700';

        if (element) {
            const computed = window.getComputedStyle(element);
            fontSize = computed.fontSize;
            fontFamily = computed.fontFamily;
            fontWeight = computed.fontWeight;
        }

        const context = this.canvas.getContext('2d');
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        const width = context.measureText(text).width;
        
        console.log(`📏 measureTextWidth: "${text}" @ ${fontSize} = ${width.toFixed(0)}px`);
        return width;
    }

    /**
     * Avgör om text behöver scrollas
     * Använder getBoundingClientRect() för FAKTISK rendererad bredd
     * Trigger: Text > 82% av viewport (ger 18% marginal)
     */
    needsScroll(text, viewportElement) {
        if (!viewportElement) return false;

        // getBoundingClientRect ger FAKTISK rendererad storlek (efter flex-shrink etc)
        const viewportRect = viewportElement.getBoundingClientRect();
        const viewportWidth = viewportRect.width;

        // Hämta text-element för att få korrekt font
        const textElement = viewportElement.querySelector('.destination-text');
        const textWidth = this.measureTextWidth(text, textElement);

        // Scrolla om texten är bredare än 82% av viewport (18% marginal)
        const threshold = viewportWidth * 0.82;
        const shouldScroll = textWidth > threshold;

        console.log(`🔍 needsScroll: text=${textWidth.toFixed(0)}px, viewport=${viewportWidth.toFixed(0)}px, threshold=${threshold.toFixed(0)}px → ${shouldScroll ? 'SCROLL' : 'STATIC'}`);

        return shouldScroll;
    }

    /**
     * Beräkna scroll-distans baserat på faktisk rendererad storlek
     */
    calculateScrollDistance(text, viewportElement) {
        const viewportRect = viewportElement.getBoundingClientRect();
        const viewportWidth = viewportRect.width;
        
        const textElement = viewportElement.querySelector('.destination-text');
        const textWidth = this.measureTextWidth(text, textElement);

        // Negativ distance = scrolla vänster
        // Lägg på 40px marginal så slutet syns tydligt (ökad från 10px)
        const scrollDistance = -(textWidth - viewportWidth + 40);

        console.log(`📐 Scroll distance: text=${textWidth.toFixed(0)}px, viewport=${viewportWidth.toFixed(0)}px, distance=${scrollDistance.toFixed(0)}px`);
        return scrollDistance;
    }

    computeDurationMs(distancePx, pxPerSecond) {
        const seconds = Math.abs(distancePx) / pxPerSecond;
        return Math.max(1500, Math.round(seconds * 1000));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatTime(expected) {
        if (!expected) return '--';
        const departure = new Date(expected);
        const now = new Date();
        const diffMin = Math.round((departure - now) / 60000);

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

    /**
     * Idempotent render - uppdaterar bara tid om samma destination
     */
    renderMainDeparture(departure) {
        const container = document.querySelector(`#${this.containerId} .main-departure`);
        if (!container) return;

        const lineNumber = departure.line?.designation || '--';
        const destination = (departure.destination || departure.direction || 'Okänd').toUpperCase();
        const time = this.formatTime(departure.expected);
        const timeClass = time === 'Nu' ? 'blink' : '';

        const mainKey = `${lineNumber}|${destination}`;

        // SAMMA huvudrad: uppdatera ENDAST tiden
        const existingDestEl = container.querySelector('.destination-text');
        const existingLineEl = container.querySelector('.line-number');
        const existingTimeEl = container.querySelector('.time');
        const viewportElement = container.querySelector('.destination-viewport');

        if (existingDestEl && existingLineEl && existingTimeEl && this.lastMainKey === mainKey) {
            existingTimeEl.textContent = time;
            existingTimeEl.classList.toggle('blink', time === 'Nu');

            const shouldScroll = this.needsScroll(destination, viewportElement);

            if (shouldScroll && !this.isScrolling) {
                this.lastShouldScroll = true;
                this.triggerScrollCycle(destination, viewportElement);
            } else if (!shouldScroll && this.isScrolling) {
                this.lastShouldScroll = false;
                this.stopScroll();
            }

            return;
        }

        // NY huvudrad: stoppa gammal scroll och bygg om DOM
        this.stopScroll();

        const transportMode = departure.line?.transport_mode || '';
        
        container.innerHTML = `
            <div class="left-section">
                <span class="line-number" data-line="${lineNumber}" data-mode="${transportMode}">${lineNumber}</span>
                <div class="destination-viewport">
                    <span class="destination-text" data-destination="${destination}">${destination}</span>
                </div>
            </div>
            <span class="time ${timeClass}">${time}</span>
        `;

        this.lastMainKey = mainKey;

        // Vänta på DOM-render innan mätning
        requestAnimationFrame(() => {
            const newViewport = container.querySelector('.destination-viewport');
            const shouldScroll = this.needsScroll(destination, newViewport);
            this.lastShouldScroll = shouldScroll;

            console.log(`📊 "${destination}": ${shouldScroll ? 'SCROLL' : 'STATIC'}`);

            if (shouldScroll) {
                this.triggerScrollCycle(destination, newViewport);
            }
        });
    }

    async animateTo(element, transform, duration) {
        const animation = element.animate(
            [
                { transform: getComputedStyle(element).transform },
                { transform }
            ],
            {
                duration,
                easing: 'linear',
                fill: 'forwards'
            }
        );

        this.activeAnimations.push(animation);
        await animation.finished;
    }

    async triggerScrollCycle(destination, viewportElement) {
        const runId = this.scrollRunId;
        this.isScrolling = true;

        const destElement = viewportElement.querySelector('.destination-text');
        if (!destElement) return;

        const distance = this.calculateScrollDistance(destination, viewportElement);
        
        // Endast scrolla om distance är negativ (text större än viewport)
        if (distance >= 0) {
            console.log(`⏭️ Scroll avbruten: text passar i viewport (distance=${distance.toFixed(0)}px)`);
            this.isScrolling = false;
            return;
        }

        const timing = {
            initialPause: 2000,
            endPause: 1500,
            cyclePause: 1000,
            pxPerSecond: 40
        };

        // Override från config.json (valfritt)
        const cfgTiming = (window.configData && window.configData.display && window.configData.display.scrollTiming) || null;
        if (cfgTiming) {
            timing.initialPause = Number.isFinite(cfgTiming.initialPause) ? cfgTiming.initialPause : timing.initialPause;
            timing.endPause = Number.isFinite(cfgTiming.endPause) ? cfgTiming.endPause : timing.endPause;
            timing.cyclePause = Number.isFinite(cfgTiming.cyclePause) ? cfgTiming.cyclePause : timing.cyclePause;
            timing.pxPerSecond = Number.isFinite(cfgTiming.pxPerSecond) ? cfgTiming.pxPerSecond : timing.pxPerSecond;
        }

        const travelMs = this.computeDurationMs(distance, timing.pxPerSecond);
        console.log(`🎬 Scroll-cykel #${runId}: "${destination}" (${distance.toFixed(0)}px @ ${travelMs}ms)`);

        try {
            while (runId === this.scrollRunId) {
                if (!destElement.isConnected) {
                    console.log(`⚠️ Scroll #${runId} avbruten: element ej i DOM`);
                    return;
                }

                // Vänta innan scroll börjar (visa början av texten)
                await this.sleep(timing.initialPause);
                if (runId !== this.scrollRunId) return;

                // Scrolla till slutet
                await this.animateTo(destElement, `translateX(${distance}px)`, travelMs);
                if (runId !== this.scrollRunId) return;

                // Vänta vid slutet (visa slutet av texten)
                await this.sleep(timing.endPause);
                if (runId !== this.scrollRunId) return;

                // Scrolla tillbaka till början
                await this.animateTo(destElement, 'translateX(0)', travelMs);
                if (runId !== this.scrollRunId) return;

                // Vänta innan nästa cykel
                if (timing.cyclePause > 0) {
                    await this.sleep(timing.cyclePause);
                    if (runId !== this.scrollRunId) return;
                }
            }
        } catch (error) {
            console.error(`❌ Scroll #${runId} error:`, error);
        } finally {
            this.activeAnimations = this.activeAnimations.filter(a => a.playState === 'running');
            console.log(`🏁 Scroll #${runId} avslutad`);
        }
    }

    /**
     * Rendera scrollande avgångar
     * FIX: "Nu" blinkar för att indikera flera samtidiga avgångar
     */
    renderScrollingDepartures(departures) {
        const container = document.querySelector(`#${this.containerId} .scroll-content`);
        if (!container) return;

        let html = '';

        departures.forEach((dep, index) => {
            const lineNumber = dep.line?.designation || '--';
            const destination = dep.destination || dep.direction || 'Okänd';
            const time = this.formatTime(dep.expected);
            const timeClass = time === 'Nu' ? 'blink' : '';

            html += `
                <span class="scroll-item">
                    <span class="scroll-line-number">${lineNumber}</span>
                    ${destination} <span class="${timeClass}">${time}</span>
                </span>
            `;

            if (index < departures.length - 1) {
                html += '<span class="scroll-separator"></span>';
            }
        });

        container.innerHTML = html + html;
    }
}
