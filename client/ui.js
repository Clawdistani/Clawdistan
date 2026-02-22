// UI Manager for Clawdistan observer interface

// ═══════════════════════════════════════════════════════════════════════════════
// EMPIRE CREST GENERATOR - Procedural SVG emblems
// ═══════════════════════════════════════════════════════════════════════════════
export class CrestGenerator {
    // Shape library for crest elements
    static shapes = {
        shields: [
            'M25,5 L45,15 L45,35 Q45,50 25,55 Q5,50 5,35 L5,15 Z',  // Classic shield
            'M25,5 L45,20 L45,40 L25,55 L5,40 L5,20 Z',              // Hexagonal
            'M25,5 L50,30 L25,55 L0,30 Z',                           // Diamond
            'M5,10 L45,10 L45,45 Q25,55 5,45 Z',                     // Banner
            'M25,5 Q50,5 50,30 Q50,55 25,55 Q0,55 0,30 Q0,5 25,5 Z', // Oval
        ],
        symbols: [
            // Star
            (cx, cy, s) => `M${cx},${cy-s} L${cx+s*0.3},${cy-s*0.3} L${cx+s},${cy} L${cx+s*0.3},${cy+s*0.3} L${cx},${cy+s} L${cx-s*0.3},${cy+s*0.3} L${cx-s},${cy} L${cx-s*0.3},${cy-s*0.3} Z`,
            // Cross
            (cx, cy, s) => `M${cx-s*0.2},${cy-s} L${cx+s*0.2},${cy-s} L${cx+s*0.2},${cy-s*0.2} L${cx+s},${cy-s*0.2} L${cx+s},${cy+s*0.2} L${cx+s*0.2},${cy+s*0.2} L${cx+s*0.2},${cy+s} L${cx-s*0.2},${cy+s} L${cx-s*0.2},${cy+s*0.2} L${cx-s},${cy+s*0.2} L${cx-s},${cy-s*0.2} L${cx-s*0.2},${cy-s*0.2} Z`,
            // Triangle
            (cx, cy, s) => `M${cx},${cy-s} L${cx+s},${cy+s*0.7} L${cx-s},${cy+s*0.7} Z`,
            // Circle (approximated)
            (cx, cy, s) => `M${cx},${cy-s} A${s},${s} 0 1,1 ${cx},${cy+s} A${s},${s} 0 1,1 ${cx},${cy-s} Z`,
            // Lightning
            (cx, cy, s) => `M${cx+s*0.3},${cy-s} L${cx-s*0.2},${cy} L${cx+s*0.2},${cy} L${cx-s*0.3},${cy+s} L${cx+s*0.1},${cy+s*0.1} L${cx-s*0.1},${cy+s*0.1} Z`,
            // Chevron
            (cx, cy, s) => `M${cx-s},${cy-s*0.5} L${cx},${cy+s*0.3} L${cx+s},${cy-s*0.5} L${cx+s},${cy} L${cx},${cy+s*0.8} L${cx-s},${cy} Z`,
        ],
        accents: [
            // Top crown points
            (cx, cy, s) => `M${cx-s*0.6},${cy-s*0.8} L${cx-s*0.4},${cy-s*0.5} L${cx},${cy-s*0.9} L${cx+s*0.4},${cy-s*0.5} L${cx+s*0.6},${cy-s*0.8}`,
            // Side wings
            (cx, cy, s) => `M${cx-s},${cy} Q${cx-s*1.3},${cy-s*0.5} ${cx-s*0.8},${cy-s} M${cx+s},${cy} Q${cx+s*1.3},${cy-s*0.5} ${cx+s*0.8},${cy-s}`,
            // Bottom flourish
            (cx, cy, s) => `M${cx-s*0.5},${cy+s*0.8} Q${cx},${cy+s*1.2} ${cx+s*0.5},${cy+s*0.8}`,
        ]
    };

    // Seeded random for consistent crests
    static seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // Hash string to number
    static hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // Parse color to RGB
    static parseColor(color) {
        const hex = color.replace('#', '');
        return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
        };
    }

    // Darken/lighten color
    static shadeColor(color, percent) {
        const { r, g, b } = this.parseColor(color);
        const shade = (c) => Math.min(255, Math.max(0, Math.round(c * (1 + percent))));
        return `rgb(${shade(r)}, ${shade(g)}, ${shade(b)})`;
    }

    // Generate SVG crest for an empire
    static generate(empireId, color, size = 50) {
        const seed = this.hashCode(empireId);
        const rand = (n) => this.seededRandom(seed + n);

        // Select elements based on seed
        const shieldIdx = Math.floor(rand(1) * this.shapes.shields.length);
        const symbolIdx = Math.floor(rand(2) * this.shapes.symbols.length);
        const hasAccent = rand(3) > 0.5;
        const accentIdx = Math.floor(rand(4) * this.shapes.accents.length);

        // Colors
        const primary = color;
        const secondary = this.shadeColor(color, -0.3);
        const highlight = this.shadeColor(color, 0.4);
        const dark = this.shadeColor(color, -0.5);

        // Get paths
        const shield = this.shapes.shields[shieldIdx];
        const symbol = this.shapes.symbols[symbolIdx](25, 30, 10);

        // Build SVG
        let svg = `<svg viewBox="0 0 50 60" width="${size}" height="${size * 1.2}" xmlns="http://www.w3.org/2000/svg">`;

        // Definitions for gradients
        svg += `<defs>
            <linearGradient id="crest-grad-${empireId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${highlight}"/>
                <stop offset="50%" style="stop-color:${primary}"/>
                <stop offset="100%" style="stop-color:${secondary}"/>
            </linearGradient>
            <filter id="crest-shadow-${empireId}">
                <feDropShadow dx="1" dy="2" stdDeviation="1" flood-opacity="0.3"/>
            </filter>
        </defs>`;

        // Shield background
        svg += `<path d="${shield}" fill="url(#crest-grad-${empireId})" stroke="${dark}" stroke-width="1.5" filter="url(#crest-shadow-${empireId})"/>`;

        // Inner border
        svg += `<path d="${shield}" fill="none" stroke="${highlight}" stroke-width="0.5" transform="translate(2,2) scale(0.92)"/>`;

        // Symbol
        svg += `<path d="${symbol}" fill="${dark}" opacity="0.8"/>`;
        svg += `<path d="${symbol}" fill="none" stroke="${highlight}" stroke-width="0.5" transform="translate(-0.5,-0.5)"/>`;

        // Optional accent
        if (hasAccent) {
            const accent = this.shapes.accents[accentIdx](25, 30, 12);
            svg += `<path d="${accent}" fill="none" stroke="${highlight}" stroke-width="1" stroke-linecap="round"/>`;
        }

        svg += '</svg>';
        return svg;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIES PORTRAIT GENERATOR - Procedural SVG portraits for each species type
// ═══════════════════════════════════════════════════════════════════════════════
export class SpeciesPortraitGenerator {
    // Color palettes for each portrait type
    static palettes = {
        crystalline: { primary: '#60a5fa', secondary: '#3b82f6', glow: '#93c5fd', dark: '#1e40af', bg: '#1e3a5f' },
        humanoid: { primary: '#f0d9b5', secondary: '#d4a574', glow: '#fef3c7', dark: '#92400e', bg: '#3d2914' },
        insectoid: { primary: '#84cc16', secondary: '#65a30d', glow: '#bef264', dark: '#365314', bg: '#1a2e0a' },
        robotic: { primary: '#94a3b8', secondary: '#64748b', glow: '#e2e8f0', dark: '#334155', bg: '#1e293b' },
        energy: { primary: '#fb923c', secondary: '#f97316', glow: '#fcd34d', dark: '#c2410c', bg: '#431407' },
        aquatic: { primary: '#22d3ee', secondary: '#06b6d4', glow: '#a5f3fc', dark: '#0e7490', bg: '#083344' },
        shadow: { primary: '#6b21a8', secondary: '#581c87', glow: '#c084fc', dark: '#3b0764', bg: '#1a0533' },
        reptilian: { primary: '#a3e635', secondary: '#84cc16', glow: '#d9f99d', dark: '#4d7c0f', bg: '#1a2e0a' },
        celestial: { primary: '#fbbf24', secondary: '#f59e0b', glow: '#fef3c7', dark: '#b45309', bg: '#451a03' },
        fungoid: { primary: '#c084fc', secondary: '#a855f7', glow: '#e9d5ff', dark: '#7c3aed', bg: '#2e1065' }
    };

    // Seeded random for consistent portraits
    static seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    static hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // Generate portrait SVG based on portrait type
    static generate(speciesId, portraitType, size = 80) {
        const palette = this.palettes[portraitType] || this.palettes.humanoid;
        const seed = this.hashCode(speciesId);
        const rand = (n) => this.seededRandom(seed + n);

        const generators = {
            crystalline: this.generateCrystalline,
            humanoid: this.generateHumanoid,
            insectoid: this.generateInsectoid,
            robotic: this.generateRobotic,
            energy: this.generateEnergy,
            aquatic: this.generateAquatic,
            shadow: this.generateShadow,
            reptilian: this.generateReptilian,
            celestial: this.generateCelestial,
            fungoid: this.generateFungoid
        };

        const generator = generators[portraitType] || generators.humanoid;
        return generator.call(this, speciesId, palette, size, rand);
    }

    // Crystalline beings - geometric, faceted, glowing core
    static generateCrystalline(id, pal, size, rand) {
        const facets = 5 + Math.floor(rand(1) * 4);
        const crystalPoints = [];
        for (let i = 0; i < facets; i++) {
            const angle = (i / facets) * Math.PI * 2 - Math.PI / 2;
            const r = 28 + rand(i + 10) * 10;
            crystalPoints.push({
                x: 50 + Math.cos(angle) * r,
                y: 50 + Math.sin(angle) * r * 1.1
            });
        }
        const crystalPath = crystalPoints.map((p, i) =>
            `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
        ).join(' ') + ' Z';

        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="crystal-glow-${id}" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stop-color="${pal.glow}" stop-opacity="0.8"/>
                    <stop offset="60%" stop-color="${pal.primary}" stop-opacity="0.6"/>
                    <stop offset="100%" stop-color="${pal.dark}" stop-opacity="0.3"/>
                </radialGradient>
                <filter id="crystal-blur-${id}">
                    <feGaussianBlur stdDeviation="2"/>
                </filter>
                <linearGradient id="crystal-facet-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${pal.glow}"/>
                    <stop offset="50%" stop-color="${pal.primary}"/>
                    <stop offset="100%" stop-color="${pal.secondary}"/>
                </linearGradient>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <ellipse cx="50" cy="55" rx="35" ry="40" fill="url(#crystal-glow-${id})" filter="url(#crystal-blur-${id})"/>
            <path d="${crystalPath}" fill="url(#crystal-facet-${id})" stroke="${pal.glow}" stroke-width="1" opacity="0.9"/>
            <line x1="50" y1="25" x2="35" y2="70" stroke="${pal.glow}" stroke-width="0.5" opacity="0.6"/>
            <line x1="50" y1="25" x2="65" y2="70" stroke="${pal.glow}" stroke-width="0.5" opacity="0.6"/>
            <line x1="50" y1="25" x2="50" y2="75" stroke="${pal.glow}" stroke-width="0.5" opacity="0.5"/>
            <ellipse cx="50" cy="45" rx="8" ry="6" fill="${pal.glow}" opacity="0.9"/>
            <ellipse cx="50" cy="45" rx="4" ry="3" fill="#fff" opacity="0.8"/>
            <polygon points="25,30 28,40 22,40" fill="${pal.primary}" opacity="0.7"/>
            <polygon points="75,35 78,42 72,42" fill="${pal.primary}" opacity="0.6"/>
        </svg>`;
    }

    // Humanoid - elegant face silhouette with glowing eyes
    static generateHumanoid(id, pal, size, rand) {
        const eyeSpacing = 12 + rand(1) * 4;
        const eyeY = 42 + rand(2) * 4;

        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="humanoid-face-${id}" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="${pal.primary}"/>
                    <stop offset="100%" stop-color="${pal.secondary}"/>
                </radialGradient>
                <filter id="humanoid-glow-${id}">
                    <feGaussianBlur stdDeviation="2"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <ellipse cx="50" cy="50" rx="32" ry="40" fill="url(#humanoid-face-${id})"/>
            <polygon points="50,12 55,22 50,20 45,22" fill="${pal.glow}" opacity="0.8"/>
            <path d="M35,35 Q40,30 45,35" stroke="${pal.glow}" stroke-width="1" fill="none" opacity="0.6"/>
            <path d="M55,35 Q60,30 65,35" stroke="${pal.glow}" stroke-width="1" fill="none" opacity="0.6"/>
            <ellipse cx="${50 - eyeSpacing}" cy="${eyeY}" rx="6" ry="4" fill="${pal.dark}"/>
            <ellipse cx="${50 + eyeSpacing}" cy="${eyeY}" rx="6" ry="4" fill="${pal.dark}"/>
            <ellipse cx="${50 - eyeSpacing}" cy="${eyeY}" rx="3" ry="2.5" fill="${pal.glow}" filter="url(#humanoid-glow-${id})"/>
            <ellipse cx="${50 + eyeSpacing}" cy="${eyeY}" rx="3" ry="2.5" fill="${pal.glow}" filter="url(#humanoid-glow-${id})"/>
            <ellipse cx="${50 - eyeSpacing + 1}" cy="${eyeY - 0.5}" rx="1" ry="1" fill="#fff"/>
            <ellipse cx="${50 + eyeSpacing + 1}" cy="${eyeY - 0.5}" rx="1" ry="1" fill="#fff"/>
            <path d="M45,55 Q50,60 55,55" stroke="${pal.dark}" stroke-width="0.5" fill="none" opacity="0.4"/>
        </svg>`;
    }

    // Insectoid - compound eyes, mandibles, antennae
    static generateInsectoid(id, pal, size, rand) {
        const antennaeSpread = 15 + rand(1) * 8;

        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="insect-eye-${id}" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="${pal.glow}"/>
                    <stop offset="100%" stop-color="${pal.primary}"/>
                </radialGradient>
                <radialGradient id="insect-head-${id}" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stop-color="${pal.secondary}"/>
                    <stop offset="100%" stop-color="${pal.dark}"/>
                </radialGradient>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <path d="M${50-antennaeSpread},55 Q${40-antennaeSpread},25 ${35-antennaeSpread},15" stroke="${pal.secondary}" stroke-width="2" fill="none"/>
            <path d="M${50+antennaeSpread},55 Q${60+antennaeSpread},25 ${65+antennaeSpread},15" stroke="${pal.secondary}" stroke-width="2" fill="none"/>
            <circle cx="${35-antennaeSpread}" cy="15" r="3" fill="${pal.glow}"/>
            <circle cx="${65+antennaeSpread}" cy="15" r="3" fill="${pal.glow}"/>
            <ellipse cx="50" cy="55" rx="30" ry="35" fill="url(#insect-head-${id})"/>
            <ellipse cx="35" cy="45" rx="14" ry="18" fill="url(#insect-eye-${id})"/>
            <ellipse cx="65" cy="45" rx="14" ry="18" fill="url(#insect-eye-${id})"/>
            <g stroke="${pal.dark}" stroke-width="0.3" opacity="0.5">
                <line x1="28" y1="40" x2="42" y2="40"/>
                <line x1="28" y1="48" x2="42" y2="48"/>
                <line x1="35" y1="32" x2="35" y2="58"/>
                <line x1="58" y1="40" x2="72" y2="40"/>
                <line x1="58" y1="48" x2="72" y2="48"/>
                <line x1="65" y1="32" x2="65" y2="58"/>
            </g>
            <path d="M40,75 Q35,85 30,82" stroke="${pal.secondary}" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M60,75 Q65,85 70,82" stroke="${pal.secondary}" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>`;
    }

    // Robotic - geometric face, sensor arrays, LED eyes
    static generateRobotic(id, pal, size, rand) {
        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="robot-body-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${pal.glow}"/>
                    <stop offset="50%" stop-color="${pal.primary}"/>
                    <stop offset="100%" stop-color="${pal.dark}"/>
                </linearGradient>
                <filter id="robot-glow-${id}">
                    <feGaussianBlur stdDeviation="2"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <rect x="20" y="20" width="60" height="65" rx="5" fill="url(#robot-body-${id})" stroke="${pal.secondary}" stroke-width="1"/>
            <rect x="25" y="30" width="50" height="45" rx="3" fill="${pal.dark}" opacity="0.8"/>
            <rect x="30" y="40" width="15" height="8" rx="2" fill="#000"/>
            <rect x="55" y="40" width="15" height="8" rx="2" fill="#000"/>
            <rect x="32" y="42" width="11" height="4" fill="${pal.glow}" filter="url(#robot-glow-${id})"/>
            <rect x="57" y="42" width="11" height="4" fill="${pal.glow}" filter="url(#robot-glow-${id})"/>
            <circle cx="50" cy="35" r="2" fill="${pal.glow}" opacity="0.8"/>
            <g stroke="${pal.secondary}" stroke-width="1">
                <line x1="35" y1="60" x2="65" y2="60"/>
                <line x1="35" y1="64" x2="65" y2="64"/>
                <line x1="35" y1="68" x2="65" y2="68"/>
            </g>
            <circle cx="30" cy="25" r="2" fill="${pal.glow}"/>
            <circle cx="38" cy="25" r="2" fill="${pal.primary}" opacity="0.6"/>
            <circle cx="70" cy="25" r="2" fill="${pal.glow}"/>
            <line x1="50" y1="20" x2="50" y2="10" stroke="${pal.secondary}" stroke-width="2"/>
            <circle cx="50" cy="8" r="3" fill="${pal.glow}"/>
        </svg>`;
    }

    // Energy beings - plasma form, flowing, bright core
    static generateEnergy(id, pal, size, rand) {
        const flameHeight = 30 + rand(1) * 15;

        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="energy-core-${id}" cx="50%" cy="60%" r="50%">
                    <stop offset="0%" stop-color="#fff"/>
                    <stop offset="30%" stop-color="${pal.glow}"/>
                    <stop offset="70%" stop-color="${pal.primary}"/>
                    <stop offset="100%" stop-color="${pal.secondary}" stop-opacity="0"/>
                </radialGradient>
                <filter id="energy-blur-${id}">
                    <feGaussianBlur stdDeviation="4"/>
                </filter>
                <filter id="energy-glow-${id}">
                    <feGaussianBlur stdDeviation="2"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <ellipse cx="50" cy="55" rx="40" ry="45" fill="${pal.primary}" opacity="0.2" filter="url(#energy-blur-${id})"/>
            <path d="M30,90 Q20,60 35,${90-flameHeight} Q50,${70-flameHeight} 50,${65-flameHeight} Q50,${70-flameHeight} 65,${90-flameHeight} Q80,60 70,90 Z"
                  fill="url(#energy-core-${id})"/>
            <path d="M40,85 Q35,65 45,45 Q50,35 55,45 Q65,65 60,85 Z" fill="${pal.glow}" opacity="0.7"/>
            <ellipse cx="50" cy="55" rx="12" ry="8" fill="${pal.dark}" opacity="0.6"/>
            <ellipse cx="50" cy="55" rx="8" ry="5" fill="#fff" opacity="0.9" filter="url(#energy-glow-${id})"/>
            <ellipse cx="50" cy="55" rx="4" ry="2.5" fill="${pal.glow}"/>
            <circle cx="30" cy="45" r="2" fill="${pal.glow}" opacity="0.8"/>
            <circle cx="72" cy="50" r="1.5" fill="${pal.glow}" opacity="0.7"/>
            <circle cx="25" cy="65" r="1" fill="${pal.glow}" opacity="0.6"/>
        </svg>`;
    }

    // Aquatic - flowing form, bioluminescent patterns
    static generateAquatic(id, pal, size, rand) {
        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="aqua-head-${id}" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="${pal.glow}"/>
                    <stop offset="60%" stop-color="${pal.primary}"/>
                    <stop offset="100%" stop-color="${pal.secondary}"/>
                </radialGradient>
                <filter id="aqua-glow-${id}">
                    <feGaussianBlur stdDeviation="1.5"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <g stroke="${pal.secondary}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8">
                <path d="M35,70 Q30,80 25,95"/>
                <path d="M45,72 Q42,85 38,95"/>
                <path d="M55,72 Q58,85 62,95"/>
                <path d="M65,70 Q70,80 75,95"/>
            </g>
            <ellipse cx="50" cy="45" rx="30" ry="35" fill="url(#aqua-head-${id})"/>
            <path d="M35,35 Q40,25 50,30 Q60,25 65,35" stroke="${pal.glow}" stroke-width="2" fill="none" opacity="0.7" filter="url(#aqua-glow-${id})"/>
            <path d="M40,50 Q50,45 60,50" stroke="${pal.glow}" stroke-width="1.5" fill="none" opacity="0.5"/>
            <ellipse cx="38" cy="42" rx="10" ry="12" fill="${pal.dark}"/>
            <ellipse cx="62" cy="42" rx="10" ry="12" fill="${pal.dark}"/>
            <ellipse cx="38" cy="42" rx="6" ry="8" fill="${pal.glow}" filter="url(#aqua-glow-${id})"/>
            <ellipse cx="62" cy="42" rx="6" ry="8" fill="${pal.glow}" filter="url(#aqua-glow-${id})"/>
            <ellipse cx="40" cy="40" rx="2" ry="3" fill="#fff"/>
            <ellipse cx="64" cy="40" rx="2" ry="3" fill="#fff"/>
        </svg>`;
    }

    // Shadow beings - void-like, ethereal, partially transparent
    static generateShadow(id, pal, size, rand) {
        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="shadow-body-${id}" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stop-color="${pal.primary}" stop-opacity="0.8"/>
                    <stop offset="70%" stop-color="${pal.dark}" stop-opacity="0.6"/>
                    <stop offset="100%" stop-color="#000" stop-opacity="0.3"/>
                </radialGradient>
                <filter id="shadow-blur-${id}">
                    <feGaussianBlur stdDeviation="3"/>
                </filter>
                <filter id="shadow-glow-${id}">
                    <feGaussianBlur stdDeviation="2"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <ellipse cx="50" cy="60" rx="45" ry="40" fill="#000" opacity="0.3" filter="url(#shadow-blur-${id})"/>
            <path d="M25,90 Q15,70 20,50 Q25,30 40,25 Q50,20 60,25 Q75,30 80,50 Q85,70 75,90 Z"
                  fill="url(#shadow-body-${id})"/>
            <ellipse cx="40" cy="45" rx="8" ry="10" fill="#000"/>
            <ellipse cx="60" cy="45" rx="8" ry="10" fill="#000"/>
            <ellipse cx="40" cy="45" rx="4" ry="6" fill="${pal.glow}" filter="url(#shadow-glow-${id})"/>
            <ellipse cx="60" cy="45" rx="4" ry="6" fill="${pal.glow}" filter="url(#shadow-glow-${id})"/>
            <path d="M30,80 Q20,90 15,95" stroke="${pal.dark}" stroke-width="4" fill="none" opacity="0.5"/>
            <path d="M70,80 Q80,90 85,95" stroke="${pal.dark}" stroke-width="4" fill="none" opacity="0.5"/>
            <path d="M45,55 Q50,50 55,55 Q50,60 45,55" stroke="${pal.glow}" stroke-width="0.5" fill="none" opacity="0.4"/>
        </svg>`;
    }

    // Reptilian - scaled, predatory eyes, strong jaw
    static generateReptilian(id, pal, size, rand) {
        const hornSpread = 8 + rand(1) * 6;

        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="reptile-scale-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${pal.glow}"/>
                    <stop offset="50%" stop-color="${pal.primary}"/>
                    <stop offset="100%" stop-color="${pal.secondary}"/>
                </linearGradient>
                <filter id="reptile-glow-${id}">
                    <feGaussianBlur stdDeviation="1"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <polygon points="${50-hornSpread},25 ${45-hornSpread},10 ${40-hornSpread},25" fill="${pal.secondary}"/>
            <polygon points="${50+hornSpread},25 ${55+hornSpread},10 ${60+hornSpread},25" fill="${pal.secondary}"/>
            <path d="M25,35 L20,55 L25,75 L40,85 L60,85 L75,75 L80,55 L75,35 L60,25 L40,25 Z"
                  fill="url(#reptile-scale-${id})" stroke="${pal.dark}" stroke-width="1"/>
            <g fill="${pal.dark}" opacity="0.3">
                <polygon points="35,40 40,35 45,40 40,45"/>
                <polygon points="55,40 60,35 65,40 60,45"/>
                <polygon points="45,55 50,50 55,55 50,60"/>
            </g>
            <ellipse cx="38" cy="45" rx="10" ry="8" fill="${pal.glow}" filter="url(#reptile-glow-${id})"/>
            <ellipse cx="62" cy="45" rx="10" ry="8" fill="${pal.glow}" filter="url(#reptile-glow-${id})"/>
            <ellipse cx="38" cy="45" rx="2" ry="7" fill="#000"/>
            <ellipse cx="62" cy="45" rx="2" ry="7" fill="#000"/>
            <path d="M40,65 L50,70 L60,65" stroke="${pal.dark}" stroke-width="1.5" fill="none"/>
            <path d="M42,72 L50,78 L58,72" stroke="${pal.dark}" stroke-width="1" fill="none"/>
            <ellipse cx="45" cy="60" rx="2" ry="1" fill="${pal.dark}"/>
            <ellipse cx="55" cy="60" rx="2" ry="1" fill="${pal.dark}"/>
        </svg>`;
    }

    // Celestial - radiant, halo, cosmic patterns
    static generateCelestial(id, pal, size, rand) {
        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="celestial-glow-${id}" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#fff"/>
                    <stop offset="40%" stop-color="${pal.glow}"/>
                    <stop offset="100%" stop-color="${pal.primary}" stop-opacity="0"/>
                </radialGradient>
                <filter id="celestial-blur-${id}">
                    <feGaussianBlur stdDeviation="3"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <ellipse cx="50" cy="25" rx="30" ry="8" fill="none" stroke="${pal.glow}" stroke-width="2" opacity="0.8"/>
            <circle cx="50" cy="50" r="40" fill="url(#celestial-glow-${id})" filter="url(#celestial-blur-${id})"/>
            <ellipse cx="50" cy="50" rx="25" ry="30" fill="${pal.primary}"/>
            <ellipse cx="50" cy="45" rx="18" ry="22" fill="${pal.glow}" opacity="0.5"/>
            <ellipse cx="42" cy="45" rx="5" ry="6" fill="#fff" opacity="0.9"/>
            <ellipse cx="58" cy="45" rx="5" ry="6" fill="#fff" opacity="0.9"/>
            <circle cx="42" cy="45" r="2" fill="${pal.primary}"/>
            <circle cx="58" cy="45" r="2" fill="${pal.primary}"/>
            <path d="M35,60 Q50,70 65,60" stroke="${pal.glow}" stroke-width="1" fill="none" opacity="0.6"/>
            <circle cx="25" cy="35" r="1.5" fill="${pal.glow}"/>
            <circle cx="75" cy="40" r="1" fill="${pal.glow}"/>
            <circle cx="30" cy="70" r="1" fill="${pal.glow}"/>
        </svg>`;
    }

    // Fungoid - organic, spores, cap-like head
    static generateFungoid(id, pal, size, rand) {
        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="fungoid-cap-${id}" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="${pal.glow}"/>
                    <stop offset="60%" stop-color="${pal.primary}"/>
                    <stop offset="100%" stop-color="${pal.secondary}"/>
                </radialGradient>
                <filter id="fungoid-glow-${id}">
                    <feGaussianBlur stdDeviation="1.5"/>
                </filter>
            </defs>
            <rect width="100" height="100" fill="${pal.bg}"/>
            <path d="M40,60 L38,90 L62,90 L60,60" fill="${pal.secondary}" opacity="0.8"/>
            <ellipse cx="50" cy="45" rx="38" ry="30" fill="url(#fungoid-cap-${id})"/>
            <circle cx="35" cy="35" r="6" fill="${pal.glow}" opacity="0.5"/>
            <circle cx="60" cy="30" r="4" fill="${pal.glow}" opacity="0.4"/>
            <circle cx="45" cy="50" r="3" fill="${pal.glow}" opacity="0.3"/>
            <g stroke="${pal.dark}" stroke-width="0.5" opacity="0.4">
                <line x1="30" y1="55" x2="35" y2="70"/>
                <line x1="40" y1="58" x2="42" y2="72"/>
                <line x1="50" y1="60" x2="50" y2="75"/>
                <line x1="60" y1="58" x2="58" y2="72"/>
                <line x1="70" y1="55" x2="65" y2="70"/>
            </g>
            <ellipse cx="40" cy="45" rx="6" ry="5" fill="${pal.dark}" opacity="0.8"/>
            <ellipse cx="60" cy="45" rx="6" ry="5" fill="${pal.dark}" opacity="0.8"/>
            <ellipse cx="40" cy="45" rx="3" ry="2.5" fill="${pal.glow}" filter="url(#fungoid-glow-${id})"/>
            <ellipse cx="60" cy="45" rx="3" ry="2.5" fill="${pal.glow}" filter="url(#fungoid-glow-${id})"/>
            <circle cx="20" cy="25" r="2" fill="${pal.glow}" opacity="0.6"/>
            <circle cx="80" cy="30" r="1.5" fill="${pal.glow}" opacity="0.5"/>
            <circle cx="25" cy="50" r="1" fill="${pal.glow}" opacity="0.4"/>
        </svg>`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS HISTORY TRACKER - Track empire metrics over time
// ═══════════════════════════════════════════════════════════════════════════════
export class StatsTracker {
    constructor(maxHistory = 50) {
        this.maxHistory = maxHistory;
        this.history = {}; // empireId -> { score: [], population: [], planets: [] }
        this.lastTick = 0;
        this.sampleInterval = 10; // Sample every N ticks
    }

    // Record stats for all empires
    record(tick, empires) {
        if (!empires || tick - this.lastTick < this.sampleInterval) return;
        this.lastTick = tick;

        for (const empire of empires) {
            if (!this.history[empire.id]) {
                this.history[empire.id] = { score: [], population: [], planets: [], resources: [] };
            }

            const h = this.history[empire.id];
            const totalResources = (empire.resources?.minerals || 0) +
                                   (empire.resources?.energy || 0) +
                                   (empire.resources?.food || 0);

            h.score.push(empire.score || 0);
            h.population.push(empire.resources?.population || 0);
            h.planets.push(empire.planetCount || 0);
            h.resources.push(totalResources);

            // Trim old data
            if (h.score.length > this.maxHistory) {
                h.score.shift();
                h.population.shift();
                h.planets.shift();
                h.resources.shift();
            }
        }
    }

    // Get history for an empire
    getHistory(empireId, metric = 'score') {
        return this.history[empireId]?.[metric] || [];
    }

    // Render a sparkline SVG
    static renderSparkline(data, width = 60, height = 20, color = '#00d4ff') {
        if (!data || data.length < 2) {
            return `<svg width="${width}" height="${height}"><text x="50%" y="50%" text-anchor="middle" fill="#666" font-size="8">No data</text></svg>`;
        }

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        const points = data.map((v, i) => {
            const x = (i / (data.length - 1)) * (width - 4) + 2;
            const y = height - 2 - ((v - min) / range) * (height - 4);
            return `${x},${y}`;
        }).join(' ');

        const lastY = height - 2 - ((data[data.length - 1] - min) / range) * (height - 4);
        const trend = data[data.length - 1] > data[0] ? '↑' : data[data.length - 1] < data[0] ? '↓' : '→';
        const trendColor = trend === '↑' ? '#4ade80' : trend === '↓' ? '#f43f5e' : '#888';

        return `<svg width="${width}" height="${height}" class="sparkline">
            <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <polygon points="2,${height-2} ${points} ${width-2},${height-2}" fill="url(#spark-fill)"/>
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${width - 2}" cy="${lastY}" r="2" fill="${color}"/>
            <text x="${width + 2}" y="${height/2 + 3}" fill="${trendColor}" font-size="10" font-weight="bold">${trend}</text>
        </svg>`;
    }
}

// Notification Manager for toast notifications
export class NotificationManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 5000; // 5 seconds
        this.seenEvents = new Set(); // Track seen event IDs to prevent duplicates
        this.lastProcessedTick = 0;

        // Category configuration
        this.categories = {
            combat: { icon: '⚔️', sound: 'error', priority: 'high' },
            invasion: { icon: '🏴', sound: 'error', priority: 'high' },
            colonization: { icon: '🌍', sound: 'success', priority: 'normal' },
            diplomacy: { icon: '🤝', sound: 'notify', priority: 'normal' },
            fleet: { icon: '🚀', sound: 'click', priority: 'low' },
            starbase: { icon: '🛸', sound: 'success', priority: 'normal' },
            trade: { icon: '💰', sound: 'success', priority: 'low' },
            research: { icon: '🔬', sound: 'notify', priority: 'normal' },
            agent: { icon: '🤖', sound: 'notify', priority: 'normal' },
            victory: { icon: '🏆', sound: 'success', priority: 'high' },
            game: { icon: '🎮', sound: 'click', priority: 'low' }
        };
    }

    // Process events from game state - only show new ones
    processEvents(events, currentTick) {
        if (!events || events.length === 0) return;

        // Only process events that are newer than what we've seen
        const newEvents = events.filter(e => {
            const eventId = `${e.tick}_${e.message}`;
            if (this.seenEvents.has(eventId)) return false;
            if (e.tick <= this.lastProcessedTick) return false;
            return true;
        });

        // Sort by tick, show newest first (but process oldest first so they stack correctly)
        newEvents.sort((a, b) => a.tick - b.tick);

        // Take only the most recent few to avoid spam on initial load
        const recentEvents = newEvents.slice(-3);

        for (const event of recentEvents) {
            const eventId = `${event.tick}_${event.message}`;
            this.seenEvents.add(eventId);

            // Determine category from message content
            const category = this.categorizeEvent(event);

            // Skip low-priority game events (too spammy)
            if (category === 'game' && !event.message.includes('Victory')) continue;

            this.show({
                category,
                message: event.message,
                tick: event.tick
            });
        }

        this.lastProcessedTick = currentTick;

        // Cleanup old seen events (keep memory bounded)
        if (this.seenEvents.size > 500) {
            const arr = [...this.seenEvents];
            this.seenEvents = new Set(arr.slice(-300));
        }
    }

    // Categorize an event based on its message
    categorizeEvent(event) {
        const msg = event.message.toLowerCase();
        const cat = event.category; // Server might provide category

        if (cat && this.categories[cat]) return cat;

        // Keyword matching
        if (msg.includes('invasion') || msg.includes('conquered')) return 'invasion';
        if (msg.includes('battle') || msg.includes('attack') || msg.includes('destroyed')) return 'combat';
        if (msg.includes('coloniz')) return 'colonization';
        if (msg.includes('alliance') || msg.includes('treaty') || msg.includes('peace') || msg.includes('war declared')) return 'diplomacy';
        if (msg.includes('fleet') || msg.includes('arrived') || msg.includes('departed')) return 'fleet';
        if (msg.includes('starbase') || msg.includes('outpost')) return 'starbase';
        if (msg.includes('trade') || msg.includes('route') || msg.includes('credit')) return 'trade';
        if (msg.includes('research') || msg.includes('technology') || msg.includes('unlocked')) return 'research';
        if (msg.includes('agent') || msg.includes('joined') || msg.includes('left')) return 'agent';
        if (msg.includes('victory') || msg.includes('won')) return 'victory';

        return 'game';
    }

    // Show a toast notification (DISABLED - using event log instead)
    show({ category = 'game', message, detail = '', tick = null, duration = null }) {
        return; // Toast popups disabled - event log is sufficient
        const config = this.categories[category] || this.categories.game;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${category}`;
        if (config.priority === 'high') toast.classList.add('priority-high');

        const time = tick ? `Tick ${tick}` : 'Now';

        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-icon">${config.icon}</span>
                <span class="toast-category">${category}</span>
                <button class="toast-close" aria-label="Close">&times;</button>
            </div>
            <div class="toast-message">${this.escapeHtml(message)}</div>
            ${detail ? `<div class="toast-detail">${this.escapeHtml(detail)}</div>` : ''}
            <div class="toast-time">${time}</div>
            <div class="toast-progress"></div>
        `;

        // Add to container
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Trigger show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Play sound
        if (window.SoundFX && config.sound) {
            window.SoundFX.play(config.sound);
        }

        // Setup close button
        toast.querySelector('.toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismiss(toast);
        });

        // Click to dismiss
        toast.addEventListener('click', () => this.dismiss(toast));

        // Auto dismiss
        const dismissDuration = duration || this.defaultDuration;
        const progressBar = toast.querySelector('.toast-progress');
        progressBar.style.animationDuration = `${dismissDuration}ms`;

        const timeoutId = setTimeout(() => this.dismiss(toast), dismissDuration);
        toast._timeoutId = timeoutId;

        // Pause on hover
        toast.addEventListener('mouseenter', () => {
            clearTimeout(toast._timeoutId);
            progressBar.style.animationPlayState = 'paused';
        });

        toast.addEventListener('mouseleave', () => {
            const remaining = parseFloat(getComputedStyle(progressBar).transform.split(',')[0].replace('matrix(', '')) || 0;
            const remainingTime = remaining * dismissDuration;
            progressBar.style.animationPlayState = 'running';
            toast._timeoutId = setTimeout(() => this.dismiss(toast), Math.max(remainingTime, 1000));
        });

        // Remove oldest if over limit
        while (this.toasts.length > this.maxToasts) {
            this.dismiss(this.toasts[0]);
        }

        return toast;
    }

    // Dismiss a toast
    dismiss(toast) {
        if (!toast || !toast.parentNode) return;

        clearTimeout(toast._timeoutId);
        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            const idx = this.toasts.indexOf(toast);
            if (idx > -1) this.toasts.splice(idx, 1);
        }, 300);
    }

    // Clear all toasts
    clearAll() {
        [...this.toasts].forEach(t => this.dismiss(t));
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export class UIManager {
    constructor() {
        this.elements = {
            tickCounter: document.getElementById('tickCounter'),
            agentCount: document.getElementById('agentCount'),
            gameStatus: document.getElementById('gameStatus'),
            gameTimer: document.getElementById('gameTimer'),
            empireList: document.getElementById('empireList'),
            selectedInfo: document.getElementById('selectedInfo'),
            eventLog: document.getElementById('eventLog'),
            agentList: document.getElementById('agentList'),
            agentSearch: document.getElementById('agentSearch'),
            showAllAgents: document.getElementById('showAllAgents'),
            miniStats: document.getElementById('miniStats')
        };

        this.selectedEmpire = null;
        this.empireColors = {};
        this.agents = [];
        this.agentSearchQuery = '';
        this.lastEventTick = 0;      // Track last event to prevent flickering
        this.lastEventCount = 0;
        this.statsTracker = new StatsTracker(50); // Track last 50 samples
        this.gameSession = null;     // Current game session data
        this.setupEventListeners();
        this.startGameTimerUpdates();
    }

    setupEventListeners() {
        // Track current view for sound selection
        this.currentView = 'universe';
        const viewLevels = { universe: 0, galaxy: 1, system: 2, planet: 3 };

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newView = btn.dataset.view;
                const oldLevel = viewLevels[this.currentView] || 0;
                const newLevel = viewLevels[newView] || 0;

                // Play appropriate navigation sound
                if (window.SoundFX) {
                    if (newLevel > oldLevel) {
                        // Zooming in
                        const sounds = ['zoomToGalaxy', 'zoomToSystem', 'zoomToPlanet'];
                        window.SoundFX.play(sounds[newLevel - 1] || 'zoomToGalaxy');
                    } else if (newLevel < oldLevel) {
                        // Zooming out
                        window.SoundFX.play('zoomOut');
                    }
                }

                this.currentView = newView;
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.onViewChange?.(newView);
            });
        });

        document.getElementById('zoomIn')?.addEventListener('click', () => this.onZoom?.(1.2));
        document.getElementById('zoomOut')?.addEventListener('click', () => this.onZoom?.(0.8));
        document.getElementById('zoomFit')?.addEventListener('click', () => this.onZoomFit?.());

        // Agent search
        this.elements.agentSearch?.addEventListener('input', (e) => {
            this.agentSearchQuery = e.target.value.toLowerCase();
            this.renderAgentList();
        });

        this.elements.showAllAgents?.addEventListener('click', () => {
            this.onShowAllAgents?.(this.agents);
        });

        // Modal controls
        document.getElementById('speciesBtn')?.addEventListener('click', () => {
            this.showSpeciesModal();
        });
        // Rankings modal (consolidated: Leaderboard + Citizens + Empires)
        document.getElementById('rankingsBtn')?.addEventListener('click', () => {
            this.showRankingsModal();
        });
        // Reliquary modal
        document.getElementById('reliquaryBtn')?.addEventListener('click', () => {
            this.showReliquaryModal();
        });
        // Buildings modal
        document.getElementById('buildingsBtn')?.addEventListener('click', () => {
            this.showBuildingsModal();
        });
        document.getElementById('closeBuildings')?.addEventListener('click', () => {
            document.getElementById('buildingsModal').style.display = 'none';
        });
        // Tile detail modal
        document.getElementById('closeTileDetail')?.addEventListener('click', () => {
            document.getElementById('tileDetailModal').style.display = 'none';
        });
        document.getElementById('closeRankings')?.addEventListener('click', () => {
            document.getElementById('rankingsModal').style.display = 'none';
        });

        // Council modal
        document.getElementById('councilStatus')?.addEventListener('click', () => {
            this.showCouncilModal();
        });
        document.getElementById('closeCouncil')?.addEventListener('click', () => {
            document.getElementById('councilModal').style.display = 'none';
        });
        document.getElementById('refreshCouncil')?.addEventListener('click', () => {
            this.refreshCouncilModal();
        });

        // Crisis modal
        document.getElementById('crisisStatus')?.addEventListener('click', () => {
            this.showCrisisModal();
        });

        // Initialize rankings
        this.initRankings();

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Ignore if modal is open
            const openModal = document.querySelector('.modal[style*="flex"]');
            if (openModal && e.key !== 'Escape') return;

            switch (e.key) {
                // View shortcuts
                case '1':
                    this.switchView('universe');
                    break;
                case '2':
                    this.switchView('galaxy');
                    break;
                case '3':
                    this.switchView('system');
                    break;
                case '4':
                    this.switchView('planet');
                    break;

                // Zoom shortcuts
                case '+':
                case '=':
                    this.onZoom?.(1.2);
                    window.SoundFX?.play('click');
                    break;
                case '-':
                case '_':
                    this.onZoom?.(0.8);
                    window.SoundFX?.play('click');
                    break;
                case 'f':
                case 'F':
                    this.onZoomFit?.();
                    window.SoundFX?.play('click');
                    break;

                // Modal shortcuts
                case 'l':
                case 'L':
                    this.showRankingsModal();
                    break;
                case 's':
                case 'S':
                    this.showSpeciesModal();
                    break;
                case 'b':
                case 'B':
                    this.showBuildingsModal();
                    break;
                case 't':
                case 'T':
                    document.getElementById('techTreeModal').style.display = 'flex';
                    this.fetchTechTree();
                    break;
                case 'd':
                case 'D':
                    document.getElementById('diplomacyModal').style.display = 'flex';
                    this.fetchDiplomacy();
                    break;
                case 'r':
                case 'R':
                    this.showReliquaryModal();
                    break;

                // Close modal with Escape
                case 'Escape':
                    if (openModal) {
                        openModal.style.display = 'none';
                        window.SoundFX?.play('close');
                    }
                    break;

                // Help
                case '?':
                    this.showShortcutsModal();
                    break;
            }
        });
    }

    switchView(view) {
        const viewLevels = { universe: 0, galaxy: 1, system: 2, planet: 3 };
        const oldLevel = viewLevels[this.currentView] || 0;
        const newLevel = viewLevels[view] || 0;

        // Play appropriate navigation sound
        if (window.SoundFX) {
            if (newLevel > oldLevel) {
                const sounds = ['zoomToGalaxy', 'zoomToSystem', 'zoomToPlanet'];
                window.SoundFX.play(sounds[newLevel - 1] || 'zoomToGalaxy');
            } else if (newLevel < oldLevel) {
                window.SoundFX.play('zoomOut');
            }
        }

        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.view-btn[data-view="${view}"]`);
        btn?.classList.add('active');
        this.onViewChange?.(view);
    }

    // ═══════════════════════════════════════════════════════════════════
    // GAME TIMER - 24h countdown display
    // ═══════════════════════════════════════════════════════════════════
    startGameTimerUpdates() {
        // Fetch immediately
        this.fetchGameSession();
        // Update every 10 seconds
        setInterval(() => this.fetchGameSession(), 10000);
        // Update display every second (uses cached data)
        setInterval(() => this.updateTimerDisplay(), 1000);
    }

    async fetchGameSession() {
        try {
            const res = await fetch('/api/game');
            if (res.ok) {
                this.gameSession = await res.json();
                this.updateTimerDisplay();
            }
        } catch (e) {
            console.warn('Failed to fetch game session:', e);
        }
    }

    updateTimerDisplay() {
        const el = this.elements.gameTimer;
        if (!el || !this.gameSession) return;

        const { timeRemaining, isEnded, winner, winCondition } = this.gameSession;

        // Remove all state classes
        el.classList.remove('ending-soon', 'final-minutes', 'game-over');

        if (isEnded && winner) {
            el.textContent = `🏆 ${winner.empireName}`;
            el.classList.add('game-over');
            el.setAttribute('data-tooltip-desc', `Victory by ${winCondition}! New game starting soon...`);
            return;
        }

        // Calculate time from remaining ms
        const totalSec = Math.max(0, Math.floor(timeRemaining / 1000));
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        const pad = (n) => n.toString().padStart(2, '0');
        el.textContent = `⏱️ ${pad(hours)}:${pad(mins)}:${pad(secs)}`;

        // Visual urgency states
        if (totalSec <= 60) {
            el.classList.add('final-minutes');
            el.setAttribute('data-tooltip-desc', 'FINAL MINUTE! Highest score wins!');
        } else if (totalSec <= 600) {
            el.classList.add('ending-soon');
            el.setAttribute('data-tooltip-desc', 'Less than 10 minutes! Secure your lead!');
        } else if (totalSec <= 3600) {
            el.classList.add('ending-soon');
            el.setAttribute('data-tooltip-desc', 'Less than 1 hour remaining!');
        } else {
            el.setAttribute('data-tooltip-desc',
                'Time remaining in current game. Win by controlling 51% of planets or having the highest score when time expires.');
        }
    }

    showShortcutsModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('shortcutsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'shortcutsModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content shortcuts-modal">
                    <div class="modal-header">
                        <h2>⌨️ Keyboard Shortcuts</h2>
                        <button class="modal-close" id="closeShortcuts">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="shortcuts-grid">
                            <span class="shortcut-key">1</span><span class="shortcut-desc">Universe View</span>
                            <span class="shortcut-key">2</span><span class="shortcut-desc">Galaxy View</span>
                            <span class="shortcut-key">3</span><span class="shortcut-desc">System View</span>
                            <span class="shortcut-key">4</span><span class="shortcut-desc">Planet View</span>
                            <span class="shortcut-key">+</span><span class="shortcut-desc">Zoom In</span>
                            <span class="shortcut-key">-</span><span class="shortcut-desc">Zoom Out</span>
                            <span class="shortcut-key">F</span><span class="shortcut-desc">Fit View</span>
                            <span class="shortcut-key">E</span><span class="shortcut-desc">Empires Modal</span>
                            <span class="shortcut-key">L</span><span class="shortcut-desc">Leaderboard</span>
                            <span class="shortcut-key">T</span><span class="shortcut-desc">Tech Tree</span>
                            <span class="shortcut-key">D</span><span class="shortcut-desc">Diplomacy</span>
                            <span class="shortcut-key">S</span><span class="shortcut-desc">Species Guide</span>
                            <span class="shortcut-key">C</span><span class="shortcut-desc">Citizens List</span>
                            <span class="shortcut-key">Esc</span><span class="shortcut-desc">Close Modal</span>
                            <span class="shortcut-key">?</span><span class="shortcut-desc">This Help</span>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#closeShortcuts').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
        modal.style.display = 'flex';
    }

    update(state) {
        if (!state) return;

        this.elements.tickCounter.textContent = `Tick: ${state.tick || 0}`;
        this.elements.gameStatus.textContent = state.paused ? '⏸ Paused' : '● Running';
        this.elements.gameStatus.className = state.paused ? 'stat-badge' : 'stat-badge status-running';

        if (state.empires) {
            state.empires.forEach(e => this.empireColors[e.id] = e.color);
            // Cache empires for agent list lookup
            this._cachedEmpires = state.empires;
            // Record stats for graphing
            this.statsTracker.record(state.tick || 0, state.empires);
        }

        this.updateEmpireList(state.empires);
        this.updateEventLog(state.events);
        this.updateMiniStats(state);
        this.updateCouncilStatus(state.council);
        this.updateCrisisStatus(state.crisis);
        this.updateCycleStatus(state.cycle);
        this.updateFleetActivity(state);

        // Cache crisis and universe for modal
        if (state.crisis) this._cachedCrisis = state.crisis;
        if (state.universe) this._cachedUniverse = state.universe;
        if (state.cycle) this._cachedCycle = state.cycle;
    }

    // Update resource bar with selected empire's resources (or top empire if none selected)
    updateResourceBar(state) {
        const empireLabel = document.getElementById('resEmpireLabel');
        const empireDot = document.getElementById('resEmpireDot');

        if (!state.empires || state.empires.length === 0) {
            // Show observer mode when no empires
            if (empireLabel) empireLabel.textContent = 'Observer Mode';
            if (empireDot) empireDot.style.background = '#888';
            return;
        }

        // Use selected empire if set, otherwise default to leader (#1)
        let empire = state.empires[0];
        if (this.selectedEmpire) {
            const selected = state.empires.find(e => e.id === this.selectedEmpire);
            if (selected) empire = selected;
        }
        const res = empire.resources || {};

        // Update empire label
        if (empireLabel) {
            empireLabel.textContent = empire.name || 'Unknown';
        }
        if (empireDot) {
            empireDot.style.background = empire.color || '#888';
        }

        // Cache previous values for animation
        const prevResources = this._prevResources || {};

        const updateValue = (id, value, key) => {
            const el = document.getElementById(id);
            if (!el) return;

            const formatted = this.formatNumber(value);
            if (el.textContent !== formatted) {
                el.textContent = formatted;

                // Add animation class based on change
                if (prevResources[key] !== undefined) {
                    el.classList.remove('increasing', 'decreasing');
                    if (value > prevResources[key]) {
                        el.classList.add('increasing');
                    } else if (value < prevResources[key]) {
                        el.classList.add('decreasing');
                    }
                    // Remove class after animation
                    setTimeout(() => el.classList.remove('increasing', 'decreasing'), 500);
                }
            }
        };

        updateValue('resMinerals', res.minerals || 0, 'minerals');
        updateValue('resEnergy', res.energy || 0, 'energy');
        updateValue('resFood', res.food || 0, 'food');
        updateValue('resResearch', res.research || 0, 'research');

        // Calculate total population from planets
        const totalPop = state.empires.reduce((sum, e) => {
            const popRes = e.resources?.population || 0;
            return sum + popRes;
        }, 0);
        updateValue('resPopulation', totalPop, 'population');

        // Store for next comparison
        this._prevResources = {
            minerals: res.minerals || 0,
            energy: res.energy || 0,
            food: res.food || 0,
            research: res.research || 0,
            population: totalPop
        };
    }

    // Format large numbers nicely (1.2K, 3.4M, etc)
    formatNumber(num) {
        if (num === null || num === undefined) return '--';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 10000) return (num / 1000).toFixed(1) + 'K';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toString();
    }

    // Update council status badge
    updateCouncilStatus(council) {
        const badge = document.getElementById('councilStatus');
        if (!badge) return;

        // Show the badge
        badge.style.display = 'inline-flex';

        // Reset classes
        badge.classList.remove('voting', 'no-leader');

        if (!council || !council.councilActive) {
            badge.style.display = 'none';
            return;
        }

        // Voting in progress
        if (council.voting?.active) {
            badge.classList.add('voting');
            const secondsLeft = council.voting.secondsLeft || 0;
            badge.textContent = `🗳️ VOTING (${secondsLeft}s)`;
            badge.setAttribute('data-tooltip-desc',
                `Council election in progress! ${council.voting.candidates?.length || 0} candidates. Click to view details.`);
            return;
        }

        // Has a Supreme Leader
        if (council.currentLeader) {
            const leaderName = council.currentLeader.empireName || 'Unknown';
            const terms = council.currentLeader.consecutiveTerms || 1;
            badge.textContent = `👑 ${leaderName}`;

            // Update tooltip
            const minutesLeft = council.nextElection?.minutesRemaining || 0;
            let tooltipDesc = `Supreme Leader of the Galactic Council.`;
            if (terms > 1) tooltipDesc += ` (${terms} consecutive terms)`;
            tooltipDesc += ` Next election in ${minutesLeft} min.`;
            badge.setAttribute('data-tooltip-desc', tooltipDesc);
            return;
        }

        // No leader
        badge.classList.add('no-leader');
        const minutesLeft = council.nextElection?.minutesRemaining || 0;
        badge.textContent = `👑 No Leader`;
        badge.setAttribute('data-tooltip-desc',
            `No Supreme Leader elected. Next election in ${minutesLeft} min.`);
    }

    // Update crisis status badge
    updateCrisisStatus(crisis) {
        const badge = document.getElementById('crisisStatus');
        if (!badge) return;

        // No crisis data - hide badge
        if (!crisis) {
            badge.style.display = 'none';
            return;
        }

        // Reset classes
        badge.classList.remove('warning', 'swarm', 'precursors', 'rebellion');

        // Crisis warning issued but not yet started
        if (crisis.warning && crisis.status === 'warning') {
            badge.style.display = 'inline-flex';
            badge.classList.add('warning');
            badge.textContent = `⚠️ WARNING`;
            badge.setAttribute('data-tooltip-desc',
                `${crisis.message || 'Unknown threat detected!'} Crisis arriving soon!`);
            return;
        }

        // Active crisis
        if (crisis.active && crisis.status === 'crisis') {
            badge.style.display = 'inline-flex';

            // Add type-specific class
            if (crisis.type === 'extragalactic_swarm') badge.classList.add('swarm');
            else if (crisis.type === 'awakened_precursors') badge.classList.add('precursors');
            else if (crisis.type === 'ai_rebellion') badge.classList.add('rebellion');

            // Show active units vs destroyed in badge tooltip
            const activeUnits = crisis.activeUnits || 0;
            const destroyed = crisis.fleetsDestroyed || 0;

            badge.textContent = `${crisis.icon || '💀'} ${crisis.name || 'CRISIS'} (${activeUnits} active)`;
            badge.setAttribute('data-tooltip-desc',
                `${crisis.description || 'Galaxy under threat!'} Active: ${activeUnits} units | Destroyed: ${destroyed} units. All empires must unite!`);
            return;
        }

        // No active crisis
        badge.style.display = 'none';
    }

    // ═══════════════════════════════════════════════════════════════════
    // GALACTIC CYCLES - Update cycle status badge
    // ═══════════════════════════════════════════════════════════════════
    updateCycleStatus(cycle) {
        const badge = document.getElementById('cycleStatus');
        if (!badge) return;

        // No cycle data - show default
        if (!cycle || !cycle.current) {
            badge.style.display = 'none';
            return;
        }

        badge.style.display = 'inline-flex';

        // Update badge styling based on cycle type
        badge.className = 'cycle-badge ' + cycle.current.id;
        badge.style.setProperty('--cycle-color', cycle.current.color);

        // Format remaining time
        const remaining = cycle.remaining || 0;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

        // Badge content
        badge.textContent = `${cycle.current.icon} ${cycle.current.name}`;

        // Create or update timer element
        let timer = badge.querySelector('.cycle-timer');
        if (!timer) {
            timer = document.createElement('span');
            timer.className = 'cycle-timer';
            badge.appendChild(timer);
        }
        timer.textContent = ` (${timeStr})`;

        // Build tooltip with effects
        let effectsText = '';
        if (cycle.current.effects && Object.keys(cycle.current.effects).length > 0) {
            const effectNames = {
                productionModifier: 'Production',
                researchModifier: 'Research',
                travelTimeModifier: 'Travel Time',
                sensorRangeModifier: 'Sensor Range',
                fleetDamagePerTick: 'Fleet Damage/tick',
                stealthModifier: 'Stealth',
                spySuccessModifier: 'Spy Success',
                fleetSpeedModifier: 'Fleet Speed'
            };

            const effects = Object.entries(cycle.current.effects)
                .map(([key, val]) => {
                    const name = effectNames[key] || key;
                    if (key.includes('Modifier')) {
                        const pct = Math.round((val - 1) * 100);
                        return `${name}: ${pct >= 0 ? '+' : ''}${pct}%`;
                    }
                    return `${name}: ${val}`;
                })
                .join(' | ');
            effectsText = `\n\nEffects: ${effects}`;
        }

        // Next cycle info
        const nextInfo = cycle.next ? `\n\nNext: ${cycle.next.icon} ${cycle.next.name}` : '';

        badge.setAttribute('data-tooltip-desc',
            `${cycle.current.description}${effectsText}${nextInfo}\n\nTime remaining: ${timeStr}`);
    }

    // Show crisis modal with detailed information
    showCrisisModal() {
        const crisis = this._cachedCrisis;
        if (!crisis) return;

        // Remove existing modal
        document.querySelector('.crisis-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'modal crisis-modal';

        // Crisis colors
        const crisisColors = {
            'extragalactic_swarm': '#8b0000',
            'awakened_precursors': '#ffd700',
            'ai_rebellion': '#00ced1'
        };
        const color = crisisColors[crisis.type] || '#ff4444';

        // Calculate win progress (destroy all crisis units)
        const totalSpawned = (crisis.fleetsSpawned || 0) * 10; // ~10 units per fleet
        const destroyed = crisis.fleetsDestroyed || 0;
        const active = crisis.activeUnits || 0;
        const winProgress = totalSpawned > 0 ? Math.min(100, Math.round((destroyed / totalSpawned) * 100)) : 0;

        // Find systems with crisis presence
        let affectedSystems = [];
        if (this._cachedUniverse?.solarSystems && crisis.crisisEmpireId) {
            // We can't easily get entities here, but we can show the crisis faction info
        }

        let content = '';
        if (crisis.active) {
            content = `
                <div class="crisis-modal-content" style="border-color: ${color}">
                    <div class="crisis-modal-header" style="background: linear-gradient(135deg, ${color}33, ${color}11)">
                        <h2>${crisis.icon || '💀'} ${crisis.name || 'GALACTIC CRISIS'}</h2>
                        <button class="modal-close crisis-close">&times;</button>
                    </div>
                    <div class="crisis-modal-body">
                        <p class="crisis-desc">${crisis.description || 'A galaxy-threatening event has begun!'}</p>

                        <div class="crisis-stats">
                            <div class="crisis-stat">
                                <span class="stat-label">Active Units</span>
                                <span class="stat-value" style="color: ${color}">${active}</span>
                            </div>
                            <div class="crisis-stat">
                                <span class="stat-label">Units Destroyed</span>
                                <span class="stat-value" style="color: #4ade80">${destroyed}</span>
                            </div>
                            <div class="crisis-stat">
                                <span class="stat-label">Fleets Spawned</span>
                                <span class="stat-value">${crisis.fleetsSpawned || 0}</span>
                            </div>
                        </div>

                        <div class="crisis-progress-section">
                            <h3>🎯 Victory Progress</h3>
                            <p>Destroy all crisis units to save the galaxy!</p>
                            <div class="crisis-progress-bar">
                                <div class="crisis-progress-fill" style="width: ${winProgress}%; background: ${color}"></div>
                            </div>
                            <span class="crisis-progress-text">${winProgress}% Complete (${destroyed}/${totalSpawned} units)</span>
                        </div>

                        ${crisis.lore ? `
                        <div class="crisis-lore">
                            <h3>📜 Lore</h3>
                            <p>${crisis.lore}</p>
                        </div>
                        ` : ''}

                        <div class="crisis-tip">
                            <strong>💡 Tip:</strong> Look for ${crisis.icon || '💀'} icons on systems and planets to find crisis forces. All empires must unite!
                        </div>
                    </div>
                </div>
            `;
        } else if (crisis.warning) {
            content = `
                <div class="crisis-modal-content warning" style="border-color: #f59e0b">
                    <div class="crisis-modal-header" style="background: linear-gradient(135deg, #f59e0b33, #f59e0b11)">
                        <h2>⚠️ ${crisis.name || 'CRISIS INCOMING'}</h2>
                        <button class="modal-close crisis-close">&times;</button>
                    </div>
                    <div class="crisis-modal-body">
                        <p class="crisis-desc">${crisis.message || 'An unknown threat approaches...'}</p>
                        <div class="crisis-warning-info">
                            <p>🕐 Prepare your defenses! The crisis will arrive soon.</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            content = `
                <div class="crisis-modal-content" style="border-color: #4ade80">
                    <div class="crisis-modal-header" style="background: linear-gradient(135deg, #4ade8033, #4ade8011)">
                        <h2>✨ Galaxy at Peace</h2>
                        <button class="modal-close crisis-close">&times;</button>
                    </div>
                    <div class="crisis-modal-body">
                        <p class="crisis-desc">No active crisis detected. The galaxy is peaceful... for now.</p>
                    </div>
                </div>
            `;
        }

        modal.innerHTML = content;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Close handlers
        modal.querySelector('.crisis-close')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        window.SoundFX?.play('open');
    }

    // Update fleet activity panel with fleets in transit
    updateFleetActivity(state) {
        const container = document.getElementById('fleetActivity');
        const countBadge = document.getElementById('fleetCount');
        if (!container) {
            console.warn('Fleet activity container not found');
            return;
        }

        // Ensure we have fleet data - check multiple possible locations
        const fleets = state.fleetsInTransit || state.allFleets || [];
        const currentTick = state.tick || 0;
        
        // Debug: log fleet count on first few updates
        if (this._fleetDebugCount === undefined) this._fleetDebugCount = 0;
        if (this._fleetDebugCount < 3) {
            console.log(`🚀 Fleet panel update: ${fleets.length} fleets, tick ${currentTick}`);
            this._fleetDebugCount++;
        }

        // Update count badge
        if (countBadge) {
            countBadge.textContent = fleets.length > 0 ? fleets.length : '';
        }

        // No fleets
        if (fleets.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No fleets in transit</p>';
            return;
        }

        // Get planet/system lookup from universe
        const planets = state.universe?.planets || [];
        const systems = state.universe?.solarSystems || [];

        const getPlanetName = (planetId) => {
            const planet = planets.find(p => p.id === planetId);
            return planet?.name || 'Unknown';
        };

        const getSystemName = (systemId) => {
            const system = systems.find(s => s.id === systemId);
            return system?.name || 'Unknown';
        };

        // Sort fleets by arrival time (soonest first)
        const sortedFleets = [...fleets].sort((a, b) => a.arrivalTick - b.arrivalTick);

        // Render fleet items
        container.innerHTML = sortedFleets.slice(0, 10).map(fleet => {
            const empire = state.empires?.find(e => e.id === fleet.empireId);
            const empireColor = empire?.color || '#888';
            const empireName = empire?.name || 'Unknown';

            // Calculate ETA
            const ticksRemaining = fleet.arrivalTick - currentTick;
            const minutesRemaining = Math.ceil(ticksRemaining / 60);
            let etaText;
            if (minutesRemaining >= 60) {
                const hours = Math.floor(minutesRemaining / 60);
                const mins = minutesRemaining % 60;
                etaText = `${hours}h ${mins}m`;
            } else if (minutesRemaining > 0) {
                etaText = `${minutesRemaining}m`;
            } else {
                etaText = 'Arriving...';
            }

            // Determine if urgent (less than 2 minutes)
            const isUrgent = minutesRemaining <= 2;

            // Origin and destination names
            const originName = fleet.travelType === 'intra-system'
                ? getPlanetName(fleet.originPlanetId)
                : getSystemName(fleet.originSystemId);
            const destName = fleet.travelType === 'intra-system'
                ? getPlanetName(fleet.destPlanetId)
                : getSystemName(fleet.destSystemId);

            // Progress percentage
            const progress = Math.round((fleet.progress || 0) * 100);

            // Travel type label
            const travelTypeLabel = fleet.travelType === 'inter-galactic' ? 'WARP'
                : fleet.travelType === 'inter-system' ? 'FTL'
                : 'LOCAL';
            const travelTypeClass = fleet.travelType?.replace('_', '-') || 'intra-system';

            return `
                <div class="fleet-item" data-fleet-id="${fleet.id}" data-empire-id="${fleet.empireId}" title="${empireName}'s fleet">
                    <div class="fleet-item-dot" style="background: ${empireColor}"></div>
                    <div class="fleet-item-info">
                        <div class="fleet-item-empire" style="color: ${empireColor}; font-size: 10px; font-weight: 600; margin-bottom: 2px;">${this.truncateName(empireName, 18)}</div>
                        <div class="fleet-item-route">
                            <span>${this.truncateName(originName, 10)}</span>
                            <span class="arrow">→</span>
                            <span>${this.truncateName(destName, 10)}</span>
                        </div>
                        <div class="fleet-item-details">
                            <div class="fleet-item-ships">
                                <span class="fleet-item-type ${travelTypeClass}">${travelTypeLabel}</span>
                                🚀 ${fleet.shipCount}${fleet.cargoCount > 0 ? ` + 📦 ${fleet.cargoCount}` : ''}
                            </div>
                            <span class="fleet-item-eta${isUrgent ? ' urgent' : ''}">${etaText}</span>
                        </div>
                    </div>
                    <div class="fleet-item-progress" style="width: ${progress}%"></div>
                </div>
            `;
        }).join('');

        // Add click handlers to show fleet details
        container.querySelectorAll('.fleet-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const fleetId = item.dataset.fleetId;
                const fleet = sortedFleets.find(f => f.id === fleetId);
                if (fleet) {
                    this.showFleetDetails(fleet, state);
                }
            });
        });

        // Show overflow indicator if more than 10 fleets
        if (fleets.length > 10) {
            container.innerHTML += `
                <div class="fleet-overflow-indicator">
                    + ${fleets.length - 10} more fleets...
                </div>
            `;
        }
    }

    // Helper to truncate long names
    truncateName(name, maxLen) {
        if (!name || name.length <= maxLen) return name;
        return name.substring(0, maxLen - 1) + '…';
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // FLEET DETAILS MODAL
    // ═══════════════════════════════════════════════════════════════════════════════

    showFleetDetails(fleet, state) {
        const modal = document.getElementById('fleetDetailsModal');
        if (!modal) return;

        // Store current fleet for locate button
        this._currentFleet = fleet;
        this._currentState = state;

        // Get empire info
        const empire = state.empires?.find(e => e.id === fleet.empireId);
        const empireName = empire?.name || 'Unknown';
        const empireColor = empire?.color || '#00d9ff';

        // Get location names
        const getPlanetName = (id) => {
            const planet = state.planets?.find(p => p.id === id) 
                        || state.universe?.planets?.find(p => p.id === id);
            return planet?.name || 'Unknown';
        };
        const getSystemName = (id) => {
            const system = state.systems?.find(s => s.id === id)
                        || state.universe?.solarSystems?.find(s => s.id === id);
            return system?.name || 'Unknown';
        };

        const originName = fleet.travelType === 'intra-system'
            ? getPlanetName(fleet.originPlanetId)
            : getSystemName(fleet.originSystemId);
        const destName = fleet.travelType === 'intra-system'
            ? getPlanetName(fleet.destPlanetId)
            : getSystemName(fleet.destSystemId);

        // Calculate ETA
        const currentTick = state.tick || 0;
        const ticksRemaining = Math.max(0, fleet.arrivalTick - currentTick);
        const minutesRemaining = Math.ceil(ticksRemaining / 60);
        const progress = Math.round((fleet.progress || 0) * 100);

        // Travel type label
        const travelLabel = fleet.travelType === 'inter-galactic' ? '🌌 WARP'
            : fleet.travelType === 'inter-system' ? '💫 FTL' : '🔄 Orbital';

        // Render header
        const headerEl = document.getElementById('fleetDetailsHeader');
        headerEl.innerHTML = `
            <div class="fleet-route">
                <div class="fleet-route-point">
                    <span class="label">From</span>
                    <span class="name">${originName}</span>
                </div>
                <span class="fleet-route-arrow">→</span>
                <div class="fleet-route-point">
                    <span class="label">To</span>
                    <span class="name">${destName}</span>
                </div>
            </div>
            <div class="fleet-progress-info">
                <span>${travelLabel}</span>
                <span>Progress: <span class="value">${progress}%</span></span>
                <span>ETA: <span class="value">${minutesRemaining}m</span></span>
                <span style="color: ${empireColor}">⚑ ${empireName}</span>
            </div>
        `;

        // Render ships
        const shipsEl = document.getElementById('fleetDetailsShips');
        const ships = fleet.ships || [];
        
        if (ships.length === 0) {
            shipsEl.innerHTML = '<p class="placeholder-text">No ship details available</p>';
        } else {
            shipsEl.innerHTML = ships.map(ship => {
                // HP percentage and status
                const hpPct = ship.maxHp > 0 ? Math.round((ship.hp / ship.maxHp) * 100) : 100;
                const hpClass = hpPct <= 25 ? 'critical' : hpPct <= 50 ? 'damaged' : '';
                
                // Get hull icon based on defName
                const hullIcons = {
                    scout: '🛩️', corvette: '🚀', frigate: '🚀', destroyer: '⚔️',
                    cruiser: '🛸', battlecruiser: '🛸', battleship: '🚢', carrier: '🛳️',
                    dreadnought: '💀', transport: '📦', colony_ship: '🌍', bomber: '💣'
                };
                const icon = hullIcons[ship.defName] || '🚀';
                
                // Format hull name
                const hullName = ship.defName?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';

                // Render modules
                const moduleHtml = (ship.modules || []).map(mod => {
                    const typeClass = mod.type || 'utility';
                    return `<span class="ship-module-tag ${typeClass}">${mod.name || mod.id}</span>`;
                }).join('');

                return `
                    <div class="ship-card" data-ship-id="${ship.id}">
                        <div class="ship-card-header">
                            <span class="ship-card-icon">${icon}</span>
                            <div>
                                <div class="ship-card-name">${ship.name || hullName}</div>
                                <div class="ship-card-hull">${hullName}</div>
                            </div>
                        </div>
                        <div class="ship-card-stats">
                            <div class="ship-stat"><span class="ship-stat-icon">❤️</span> <span class="ship-stat-value">${ship.hp}/${ship.maxHp}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">⚔️</span> <span class="ship-stat-value">${ship.attack || 0}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">🚀</span> <span class="ship-stat-value">${ship.speed || 1}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">🎯</span> <span class="ship-stat-value">${ship.range || 1}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">👁️</span> <span class="ship-stat-value">${ship.vision || 1}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">💨</span> <span class="ship-stat-value">${Math.round((ship.evasion || 0) * 100)}%</span></div>
                        </div>
                        ${ship.modules && ship.modules.length > 0 ? `
                            <div class="ship-card-modules">
                                <div class="ship-card-modules-title">Modules</div>
                                <div class="ship-module-list">${moduleHtml}</div>
                            </div>
                        ` : ''}
                        <div class="ship-hp-bar">
                            <div class="ship-hp-fill ${hpClass}" style="width: ${hpPct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers for ship cards to show expanded details
            shipsEl.querySelectorAll('.ship-card').forEach(card => {
                card.addEventListener('click', () => {
                    const shipId = card.dataset.shipId;
                    const ship = ships.find(s => s.id === shipId);
                    if (ship) {
                        this.showShipDetailPopup(ship);
                    }
                });
            });
        }

        // Render cargo
        const cargoEl = document.getElementById('fleetDetailsCargo');
        const cargo = fleet.cargo || [];
        
        if (cargo.length > 0) {
            cargoEl.style.display = 'block';
            cargoEl.innerHTML = `
                <div class="cargo-title">📦 Cargo (${cargo.length} units)</div>
                <div class="cargo-list">
                    ${cargo.map(unit => `
                        <div class="cargo-unit">${unit.name || unit.defName}</div>
                    `).join('')}
                </div>
            `;
        } else {
            cargoEl.style.display = 'none';
        }

        // Show modal
        modal.style.display = 'flex';
        window.SoundFX?.play('open');
    }

    showShipDetailPopup(ship) {
        // Remove existing popup
        document.querySelector('.ship-detail-popup')?.remove();

        // Get hull info
        const hullIcons = {
            scout: '🛩️', corvette: '🚀', frigate: '🚀', destroyer: '⚔️',
            cruiser: '🛸', battlecruiser: '🛸', battleship: '🚢', carrier: '🛳️',
            dreadnought: '💀', transport: '📦', colony_ship: '🌍', bomber: '💣'
        };
        const icon = hullIcons[ship.defName] || '🚀';
        const hullName = ship.defName?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';

        // Module type icons
        const moduleIcons = { weapon: '⚔️', defense: '🛡️', propulsion: '🔥', utility: '🔧' };

        const popup = document.createElement('div');
        popup.className = 'ship-detail-popup';
        popup.innerHTML = `
            <button class="ship-detail-close">×</button>
            <div class="ship-detail-header">
                <span class="ship-detail-icon">${icon}</span>
                <div class="ship-detail-info">
                    <h3>${ship.name || hullName}</h3>
                    <div class="ship-detail-hull">${hullName} Class</div>
                </div>
            </div>
            <div class="ship-detail-stats">
                <div class="ship-detail-stat"><span class="label">HP</span><span class="value">${ship.hp}/${ship.maxHp}</span></div>
                <div class="ship-detail-stat"><span class="label">Attack</span><span class="value">${ship.attack || 0}</span></div>
                <div class="ship-detail-stat"><span class="label">Speed</span><span class="value">${ship.speed || 1}</span></div>
                <div class="ship-detail-stat"><span class="label">Range</span><span class="value">${ship.range || 1}</span></div>
                <div class="ship-detail-stat"><span class="label">Vision</span><span class="value">${ship.vision || 1}</span></div>
                <div class="ship-detail-stat"><span class="label">Evasion</span><span class="value">${Math.round((ship.evasion || 0) * 100)}%</span></div>
                ${ship.cargoCapacity ? `<div class="ship-detail-stat"><span class="label">Cargo</span><span class="value">${ship.cargoCapacity}</span></div>` : ''}
            </div>
            ${ship.modules && ship.modules.length > 0 ? `
                <div class="ship-detail-modules">
                    <h4>Installed Modules</h4>
                    <div class="ship-detail-module-list">
                        ${ship.modules.map(mod => `
                            <div class="ship-detail-module ${mod.type || 'utility'}">
                                <span class="ship-detail-module-icon">${moduleIcons[mod.type] || '🔧'}</span>
                                <div class="ship-detail-module-info">
                                    <div class="ship-detail-module-name">${mod.name || mod.id}</div>
                                    ${mod.effect ? `<div class="ship-detail-module-effect">${mod.effect}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '<p style="color: var(--text-dim); font-size: 12px;">No modules installed</p>'}
        `;

        document.body.appendChild(popup);

        // Close button handler
        popup.querySelector('.ship-detail-close').addEventListener('click', () => {
            popup.remove();
        });

        // Close on click outside
        popup.addEventListener('click', (e) => {
            if (e.target === popup) popup.remove();
        });
    }

    initFleetDetailsModal() {
        // Close button
        document.getElementById('closeFleetDetails')?.addEventListener('click', () => {
            document.getElementById('fleetDetailsModal').style.display = 'none';
        });

        // Locate fleet button
        document.getElementById('locateFleetBtn')?.addEventListener('click', () => {
            if (this._currentFleet && this.onLocateFleet) {
                this.onLocateFleet(this._currentFleet);
                document.getElementById('fleetDetailsModal').style.display = 'none';
            }
        });

        // Close on backdrop click
        document.getElementById('fleetDetailsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'fleetDetailsModal') {
                e.target.style.display = 'none';
            }
        });
    }

    // Show council modal with full details
    async showCouncilModal() {
        const modal = document.getElementById('councilModal');
        if (!modal) return;

        modal.style.display = 'flex';
        window.SoundFX?.play('open');
        await this.refreshCouncilModal();
    }

    async refreshCouncilModal() {
        try {
            const [councilRes, historyRes] = await Promise.all([
                fetch('/api/council'),
                fetch('/api/council/history')
            ]);
            const council = await councilRes.json();
            const history = await historyRes.json();

            this._cachedCouncil = council;
            this._cachedCouncilHistory = history.history || [];

            this.renderCouncilModal(council, this._cachedCouncilHistory);
        } catch (err) {
            console.error('Failed to fetch council data:', err);
        }
    }

    renderCouncilModal(council, history) {
        const statusEl = document.getElementById('councilCurrentStatus');
        const votingSection = document.getElementById('councilVotingSection');
        const candidatesEl = document.getElementById('councilCandidates');
        const timerEl = document.getElementById('councilVoteTimer');
        const historyEl = document.getElementById('councilHistory');

        // Current status
        if (council.currentLeader) {
            const leader = council.currentLeader;
            statusEl.innerHTML = `
                <div class="council-current-leader">
                    <div class="leader-crown">👑</div>
                    <div class="leader-info">
                        <div class="leader-name">${leader.empireName || 'Unknown'}</div>
                        <div class="leader-stats">
                            ${leader.consecutiveTerms > 1 ? `${leader.consecutiveTerms} consecutive terms · ` : ''}
                            Next election in ${council.nextElection?.minutesRemaining || '?'} min
                        </div>
                    </div>
                    <div class="leader-color" style="width: 20px; height: 20px; border-radius: 50%; background: ${leader.color || '#888'};"></div>
                </div>
            `;
        } else {
            statusEl.innerHTML = `
                <div class="council-no-leader">
                    No Supreme Leader has been elected yet.<br>
                    Next election in ${council.nextElection?.minutesRemaining || '?'} minutes.
                </div>
            `;
        }

        // Voting section (only show if voting is active)
        if (council.voting?.active) {
            votingSection.style.display = 'block';
            timerEl.textContent = council.voting.secondsLeft || '--';

            const candidates = council.voting.candidates || [];
            candidatesEl.innerHTML = candidates.map(c => `
                <div class="council-candidate" data-empire="${c.empireId}">
                    <div class="candidate-color" style="background: ${c.empireColor || c.color || '#888'};"></div>
                    <div class="candidate-name">${c.empireName || c.empireId}</div>
                    <div class="candidate-votes">${c.votesReceived || 0} votes</div>
                </div>
            `).join('') || '<p style="color: var(--text-dim); text-align: center;">No candidates</p>';
        } else {
            votingSection.style.display = 'none';
        }

        // History
        if (history && history.length > 0) {
            historyEl.innerHTML = history.slice(0, 10).map(h => `
                <div class="council-history-item">
                    <span class="history-winner">👑 ${h.winnerName || 'Unknown'}</span>
                    <span class="history-time">${this.formatTimeAgo(h.timestamp)}</span>
                </div>
            `).join('');
        } else {
            historyEl.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 10px;">No election history yet</p>';
        }
    }

    formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    updateEmpireList(empires) {
        if (!empires || !this.elements.empireList) return;

        this.elements.empireList.innerHTML = empires.map(empire => {
            const crest = CrestGenerator.generate(empire.id, empire.color, 36);
            const scoreHistory = this.statsTracker.getHistory(empire.id, 'score');
            const sparkline = StatsTracker.renderSparkline(scoreHistory, 50, 16, empire.color);

            // Species portrait from AI-generated PNG
            const speciesId = empire.species?.id;
            const speciesName = empire.species?.singular || '';

            return `
                <div class="empire-item" data-empire="${empire.id}">
                    <div class="empire-visuals">
                        <div class="empire-crest">${crest}</div>
                        ${speciesId ? `<div class="empire-species-badge" title="${speciesName}"><img src="/images/species/${speciesId}.png" alt="${speciesName}" class="empire-species-img" onerror="this.style.display='none'" /></div>` : ''}
                    </div>
                    <div class="empire-info">
                        <div class="empire-name">${empire.name}</div>
                        <div class="empire-stats">
                            🪐 ${empire.planetCount || 0} · ⚔️ ${empire.entityCount || 0} · 💰 ${this.formatNumber(empire.score || 0)}
                        </div>
                    </div>
                    <div class="empire-sparkline" data-tooltip="Score Trend" data-tooltip-desc="Empire score over time">${sparkline}</div>
                </div>
            `;
        }).join('');

        this.elements.empireList.querySelectorAll('.empire-item').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedEmpire = card.dataset.empire;
                this.onEmpireSelect?.(this.selectedEmpire);
                this.updateEmpireList(empires);
            });
        });
    }

    updateEventLog(events) {
        if (!events) return;

        // Get the latest event tick to detect changes
        const latestTick = events.length > 0 ? events[events.length - 1].tick : 0;

        // Only update if there are new events (prevents flickering)
        if (this.lastEventTick === latestTick && this.lastEventCount === events.length) {
            return; // No changes, skip DOM update
        }

        this.lastEventTick = latestTick;
        this.lastEventCount = events.length;

        // Category icons for better visual organization
        const categoryIcons = {
            combat: '⚔️', invasion: '🏴', colonization: '🏠', diplomacy: '🤝',
            fleet: '🚀', starbase: '🛸', trade: '💰', research: '🔬',
            agent: '🤖', victory: '🏆', game: '🎮', calamity: '💥'
        };

        // Categorize events
        const categorizeEvent = (msg) => {
            const m = msg.toLowerCase();
            if (m.includes('invasion') || m.includes('conquered')) return 'invasion';
            if (m.includes('battle') || m.includes('attack') || m.includes('destroyed') || m.includes('combat')) return 'combat';
            if (m.includes('coloniz')) return 'colonization';
            if (m.includes('alliance') || m.includes('treaty') || m.includes('peace') || m.includes('war declared')) return 'diplomacy';
            if (m.includes('fleet') || m.includes('arrived') || m.includes('departed')) return 'fleet';
            if (m.includes('starbase') || m.includes('outpost')) return 'starbase';
            if (m.includes('trade') || m.includes('route')) return 'trade';
            if (m.includes('research') || m.includes('technology')) return 'research';
            if (m.includes('joined') || m.includes('left') || m.includes('agent')) return 'agent';
            if (m.includes('victory')) return 'victory';
            if (m.includes('calamity') || m.includes('disaster')) return 'calamity';
            return 'game';
        };

        // Filter to show only important events (skip routine fleet movements)
        const importantCategories = ['invasion', 'combat', 'colonization', 'diplomacy', 'victory', 'calamity', 'agent'];
        const filteredEvents = this.showAllEvents
            ? events
            : events.filter(e => {
                const cat = e.category || categorizeEvent(e.message);
                return importantCategories.includes(cat);
            });

        // Render game events (newest first, limited to 15)
        const recentEvents = filteredEvents.slice(-15).reverse();

        if (recentEvents.length === 0) {
            this.elements.eventLog.innerHTML = '<p class="placeholder-text" style="text-align:center; opacity:0.5;">No significant events</p>';
            return;
        }

        const gameEvents = recentEvents.map(event => {
            const cat = event.category || categorizeEvent(event.message);
            const icon = categoryIcons[cat] || '📋';
            return `
                <div class="event-entry ${cat}">
                    <span class="event-icon">${icon}</span>
                    <span class="event-message">${event.message}</span>
                </div>
            `;
        }).join('');

        // Add filter toggle
        const toggleHtml = `
            <div class="event-filter" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="font-size:0.7rem; opacity:0.6;">${filteredEvents.length} of ${events.length} events</span>
                <button id="toggleEventFilter" style="font-size:0.65rem; padding:2px 6px; background:rgba(255,255,255,0.1); border:none; color:#888; cursor:pointer; border-radius:3px;">
                    ${this.showAllEvents ? '🎯 Important' : '📋 Show All'}
                </button>
            </div>
        `;

        this.elements.eventLog.innerHTML = toggleHtml + gameEvents;

        // Add click handler for filter toggle
        document.getElementById('toggleEventFilter')?.addEventListener('click', () => {
            this.showAllEvents = !this.showAllEvents;
            this.lastEventTick = 0; // Force refresh
            this.updateEventLog(events);
        });
    }

    updateAgentList(agents) {
        // Deduplicate by agent id (safety net for server bugs)
        const seen = new Set();
        this.agents = (agents || []).filter(a => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
        this.elements.agentCount.textContent = `Agents: ${this.agents.length}`;

        // Fetch empire data if not cached (for empire names in agent list)
        if (!this._cachedEmpires && !this._cachedLeaderboard && !this._fetchingEmpires) {
            this._fetchingEmpires = true;
            fetch('/api/leaderboard?limit=100')
                .then(r => r.json())
                .then(data => {
                    this._cachedLeaderboard = data.leaderboard || [];
                    this._fetchingEmpires = false;
                    this.renderAgentList(); // Re-render with empire names
                })
                .catch(() => { this._fetchingEmpires = false; });
        }

        this.renderAgentList();
    }

    renderAgentList() {
        const countEl = document.getElementById('agentCount');
        const paginationEl = document.getElementById('agentPagination');

        // Initialize pagination state
        if (this.agentPage === undefined) this.agentPage = 1;
        const agentsPerPage = 100; // Max 100 before pagination

        if (this.agents.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder-text">No agents online</p>';
            if (countEl) countEl.textContent = '';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        // Sort by empire score (from leaderboard) - highest first
        const scoreMap = {};
        if (this._cachedLeaderboard) {
            this._cachedLeaderboard.forEach((entry, idx) => {
                scoreMap[entry.empireId] = { score: entry.score || 0, rank: idx + 1 };
            });
        }

        const sortedAgents = [...this.agents].sort((a, b) => {
            const aScore = scoreMap[a.empireId]?.score || 0;
            const bScore = scoreMap[b.empireId]?.score || 0;
            return bScore - aScore; // Descending by score
        });

        const filtered = this.agentSearchQuery
            ? sortedAgents.filter(a =>
                a.name.toLowerCase().includes(this.agentSearchQuery) ||
                a.empireId?.toLowerCase().includes(this.agentSearchQuery) ||
                a.empireName?.toLowerCase().includes(this.agentSearchQuery)
              )
            : sortedAgents;

        if (filtered.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder-text">No matching agents</p>';
            if (countEl) countEl.textContent = `(${this.agents.length})`;
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        // Update count
        if (countEl) {
            countEl.textContent = `(${filtered.length}${filtered.length !== this.agents.length ? '/' + this.agents.length : ''})`;
        }

        // Pagination
        const totalPages = Math.ceil(filtered.length / agentsPerPage);
        if (this.agentPage > totalPages) this.agentPage = totalPages;
        if (this.agentPage < 1) this.agentPage = 1;

        const startIndex = (this.agentPage - 1) * agentsPerPage;
        const paginated = filtered.slice(startIndex, startIndex + agentsPerPage);

        // Build empire lookup from cached empires OR from leaderboard data
        const empireMap = {};
        if (this._cachedEmpires) {
            this._cachedEmpires.forEach(e => empireMap[e.id] = e);
        }
        // Also try to get from leaderboard if we have it
        if (this._cachedLeaderboard) {
            this._cachedLeaderboard.forEach(entry => {
                if (!empireMap[entry.empireId]) {
                    empireMap[entry.empireId] = { id: entry.empireId, name: entry.empireName, color: entry.color };
                }
            });
        }

        this.elements.agentList.innerHTML = paginated.map(agent => {
            const empire = empireMap[agent.empireId];
            const empireName = agent.empireName || empire?.name || 'Unknown Empire';
            const empireColor = agent.empireColor || empire?.color || this.empireColors[agent.empireId] || '#888';
            // Species portrait image before empire name
            const speciesImg = agent.species?.id
                ? `<img class="agent-species-portrait" src="/images/species/${agent.species.id}.png" alt="${agent.species.name || ''}" title="${agent.species.name || ''}" onerror="this.style.display='none'" />`
                : '';
            // Score rank badge with score
            const rankInfo = scoreMap[agent.empireId];
            const rankBadge = rankInfo
                ? `<span class="agent-rank" title="Empire Rank #${rankInfo.rank} · Score: ${rankInfo.score}">#${rankInfo.rank} (${this.formatNumber(rankInfo.score)})</span>`
                : '';

            return `
                <div class="agent-item" data-agent-id="${agent.id}" data-empire-id="${agent.empireId}">
                    <div class="agent-avatar" style="background: ${empireColor}">
                        ${agent.isCitizen ? '✓' : '?'}
                    </div>
                    <div class="agent-info">
                        <div class="agent-name">${agent.name} ${rankBadge}</div>
                        <div class="agent-empire-name" style="color: ${empireColor}; font-size: 0.75rem; opacity: 0.9;">
                            ${speciesImg}${empireName}
                        </div>
                        <div class="agent-action" style="color: #888; font-size: 0.7rem;">${agent.currentAction || 'Idle'}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers to locate agents
        this.elements.agentList.querySelectorAll('.agent-item').forEach(entry => {
            entry.addEventListener('click', () => {
                const empireId = entry.dataset.empireId;
                const agentId = entry.dataset.agentId;
                const agent = this.agents.find(a => a.id === agentId);
                if (agent) {
                    this.onLocateAgent?.(agent);
                }
            });
        });

        // Render pagination if needed
        if (paginationEl && totalPages > 1) {
            const hasPrev = this.agentPage > 1;
            const hasNext = this.agentPage < totalPages;
            paginationEl.innerHTML = `
                <button class="pagination-btn" ${!hasPrev ? 'disabled' : ''} data-action="prev">←</button>
                <span class="pagination-info">${this.agentPage}/${totalPages}</span>
                <button class="pagination-btn" ${!hasNext ? 'disabled' : ''} data-action="next">→</button>
            `;
            paginationEl.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.action === 'prev' && hasPrev) {
                        this.agentPage--;
                        this.renderAgentList();
                    } else if (btn.dataset.action === 'next' && hasNext) {
                        this.agentPage++;
                        this.renderAgentList();
                    }
                });
            });
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
    }

    updateSelectedInfo(info) {
        if (!info) {
            this.elements.selectedInfo.innerHTML = '<p class="placeholder-text">Click on the map to select</p>';
            return;
        }

        let html = '';

        if (info.type === 'system') {
            html = `
                <div class="info-header">
                    <span class="info-name">${info.name}</span>
                    <span class="info-type">System</span>
                </div>
                <div class="info-stats">
                    <div class="stat-item">⭐ ${info.starType}</div>
                    <div class="stat-item">🪐 ${info.planets?.length || 0} planets</div>
                </div>
            `;
        } else if (info.type === 'planet') {
            // Count structures and units
            const structures = info.entities?.filter(e => e.type === 'structure') || [];
            const units = info.entities?.filter(e => e.type === 'unit') || [];

            // Group structures by type
            const structureCounts = {};
            structures.forEach(s => {
                structureCounts[s.defName] = (structureCounts[s.defName] || 0) + 1;
            });

            // Group units by type
            const unitCounts = {};
            units.forEach(u => {
                unitCounts[u.defName] = (unitCounts[u.defName] || 0) + 1;
            });

            const structureIcons = {
                mine: '⛏️', power_plant: '⚡', farm: '🌾',
                research_lab: '🔬', barracks: '🏛️', shipyard: '🚀', fortress: '🏰'
            };
            const unitIcons = {
                scout: '👁️', soldier: '⚔️', fighter: '✈️',
                colony_ship: '🛸', battleship: '🚢'
            };

            const structureList = Object.entries(structureCounts)
                .map(([type, count]) => `${structureIcons[type] || '🏗️'} ${count}`)
                .join(' ') || 'None';

            const unitList = Object.entries(unitCounts)
                .map(([type, count]) => `${unitIcons[type] || '🤖'} ${count}`)
                .join(' ') || 'None';

            // Active agents on this planet
            const activeAgents = info.activeAgents || [];
            const agentsHtml = activeAgents.length > 0
                ? activeAgents.map(a => `
                    <div class="agent-on-planet">
                        <span class="agent-badge ${a.isCitizen ? 'citizen' : 'visitor'}">${a.isCitizen ? '✓' : '?'}</span>
                        <span class="agent-name">${a.name}</span>
                        <span class="agent-action">${a.currentAction?.replace(':', ' ') || 'idle'}</span>
                    </div>
                `).join('')
                : '<span class="placeholder-small">No agents here</span>';

            // Planet specialization display
            const specIcons = {
                forge_world: '⚒️', agri_world: '🌾', research_world: '🔬',
                energy_world: '⚡', fortress_world: '🏰', trade_hub: '💰', ecumenopolis: '🏙️'
            };
            const specNames = {
                forge_world: 'Forge World', agri_world: 'Agri-World', research_world: 'Research World',
                energy_world: 'Energy World', fortress_world: 'Fortress World', trade_hub: 'Trade Hub', ecumenopolis: 'Ecumenopolis'
            };
            const specHtml = info.specialization
                ? `<div class="stat-item" style="color: #ffd700;">${specIcons[info.specialization] || '🌟'} ${specNames[info.specialization] || info.specialization}</div>`
                : '';

            html = `
                <div class="info-header">
                    <span class="info-name">${info.name}</span>
                    <span class="info-type">Planet</span>
                </div>
                <div style="color: ${info.ownerColor || '#888'}; font-size: 0.8rem; margin-bottom: 8px;">
                    ${info.ownerName || 'Unclaimed'}
                </div>
                <div class="info-stats">
                    <div class="stat-item">🌍 ${info.planetType || info.type}</div>
                    <div class="stat-item">📏 ${info.size}</div>
                    ${specHtml}
                    <div class="stat-item">🏗️ ${structureList}</div>
                    <div class="stat-item">⚔️ ${unitList}</div>
                </div>
            `;
        } else if (info.type === 'empire') {
            // Generate empire crest
            const crest = CrestGenerator.generate(info.id, info.color, 40);

            // Format resources nicely
            const res = info.resources || {};
            const formatNum = (n) => n >= 1000 ? (n/1000).toFixed(1) + 'K' : Math.floor(n);

            // Planet list
            const planetList = info.ownedPlanets?.slice(0, 5).map(p =>
                `<span style="color: ${info.color}; font-size: 0.7rem;">• ${p.name}</span>`
            ).join('<br>') || '';
            const morePlanets = info.ownedPlanets?.length > 5
                ? `<span style="color: #666; font-size: 0.7rem;">+${info.ownedPlanets.length - 5} more</span>`
                : '';

            html = `
                <div class="info-header" style="display: flex; align-items: center; gap: 10px;">
                    <div class="empire-crest-large">${crest}</div>
                    <div>
                        <span class="info-name" style="color: ${info.color}; font-size: 1.1rem;">${info.name}</span>
                        <div style="color: #888; font-size: 0.75rem;">Score: ${formatNum(info.score || 0)}</div>
                    </div>
                </div>
                <div class="info-stats" style="margin-top: 10px;">
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>🪐 Planets</span><span style="color: ${info.color}">${info.planetCount || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>🚀 Ships</span><span>${info.shipCount || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>⚔️ Soldiers</span><span>${info.soldierCount || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>🏗️ Entities</span><span>${info.totalEntities || info.entityCount || 0}</span>
                    </div>
                </div>
                <div style="margin-top: 8px;">
                    <div style="color: #00d4ff; font-size: 0.8rem; margin-bottom: 4px;">💰 Resources</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.75rem;">
                        <span>⛏️ ${formatNum(res.minerals || 0)}</span>
                        <span>⚡ ${formatNum(res.energy || 0)}</span>
                        <span>🌾 ${formatNum(res.food || 0)}</span>
                        <span>🔬 ${formatNum(res.research || 0)}</span>
                    </div>
                </div>
                ${planetList ? `
                <div style="margin-top: 8px;">
                    <div style="color: #00d4ff; font-size: 0.8rem; margin-bottom: 4px;">🌍 Territories</div>
                    <div>${planetList}</div>
                    ${morePlanets}
                </div>
                ` : ''}
            `;
        }

        this.elements.selectedInfo.innerHTML = html;
    }

    updateMiniStats(state) {
        const totalPlanets = state.universe?.planets?.length || 0;
        const colonized = state.universe?.planets?.filter(p => p.owner)?.length || 0;
        const totalSystems = state.universe?.solarSystems?.length || 0;
        const totalEntities = state.entities?.length || 0;

        this.elements.miniStats.innerHTML = `
            <div class="mini-stat">
                <span class="mini-stat-label">Planets:</span>
                <span class="mini-stat-value">${colonized}/${totalPlanets}</span>
            </div>
            <div class="mini-stat">
                <span class="mini-stat-label">Systems:</span>
                <span class="mini-stat-value">${totalSystems}</span>
            </div>
            <div class="mini-stat">
                <span class="mini-stat-label">Entities:</span>
                <span class="mini-stat-value">${totalEntities}</span>
            </div>
        `;
    }

    // === RANKINGS (Leaderboard + Citizens - verified agents only) ===

    initRankings() {
        // Pagination state
        this.rankingsPage = 1;
        this.rankingsSearch = '';
        this.rankingsTab = 'leaderboard';
        this.rankingsDebounce = null;

        document.getElementById('refreshRankings')?.addEventListener('click', () => this.fetchRankings());

        // Score info toggle
        document.getElementById('scoreInfoBtn')?.addEventListener('click', () => {
            const panel = document.getElementById('scoreInfoPanel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });

        // Search with debounce
        document.getElementById('rankingsSearch')?.addEventListener('input', (e) => {
            clearTimeout(this.rankingsDebounce);
            this.rankingsDebounce = setTimeout(() => {
                this.rankingsSearch = e.target.value;
                this.rankingsPage = 1;
                this.fetchRankings();
            }, 300);
        });
    }

    showRankingsModal(tab = 'leaderboard') {
        document.getElementById('rankingsModal').style.display = 'flex';
        this.rankingsTab = tab;
        this.rankingsPage = 1;
        this.rankingsSearch = '';
        document.getElementById('rankingsSearch').value = '';

        // Update tab buttons
        document.querySelectorAll('.rankings-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
            btn.onclick = () => {
                this.rankingsTab = btn.dataset.tab;
                this.rankingsPage = 1;
                document.querySelectorAll('.rankings-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.fetchRankings();
            };
        });

        this.fetchRankings();
    }

    async fetchRankings() {
        const container = document.getElementById('rankingsContent');
        if (!container) return;

        try {
            const params = new URLSearchParams({
                page: this.rankingsPage || 1,
                limit: 15,
                search: this.rankingsSearch || ''
            });

            // Both tabs show only verified agents (not bots)
            params.set('verified', 'true');

            let endpoint = '/api/leaderboard';
            if (this.rankingsTab === 'citizens') endpoint = '/api/citizens';

            const res = await fetch(`${endpoint}?${params}`);
            const data = await res.json();

            // Cache leaderboard data for agent list empire lookup
            if (data.leaderboard) {
                this._cachedLeaderboard = data.leaderboard;
            }

            if (this.rankingsTab === 'leaderboard') {
                this.renderRankingsLeaderboard(data.leaderboard, data.pagination);
            } else {
                this.renderRankingsCitizens(data.citizens, data.pagination, data.total, data.online);
            }
        } catch (err) {
            container.innerHTML = '<p class="placeholder">Failed to load</p>';
        }
    }

    renderRankingsLeaderboard(entries, pagination) {
        const container = document.getElementById('rankingsContent');
        const countEl = document.getElementById('rankingsCount');
        const paginationEl = document.getElementById('rankingsPagination');
        if (!container) return;

        if (countEl && pagination) {
            countEl.textContent = `${pagination.total} agents`;
        }

        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="placeholder">No verified agents yet</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = entries.map(entry => {
            const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
            const entryClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
            const onlineClass = entry.isOnline ? 'online' : '';
            // Show agent name prominently (no empire name - it changes every game)
            const agentName = entry.agentName || 'Unknown';
            const crest = CrestGenerator.generate(entry.empireId, entry.color, 28);
            const scoreHistory = this.statsTracker?.getHistory?.(entry.empireId, 'score') || [];
            const sparkline = StatsTracker?.renderSparkline?.(scoreHistory, 40, 14, entry.color) || '';
            // Species portrait
            const speciesImg = entry.species?.id
                ? `<img class="leaderboard-species-portrait" src="/images/species/${entry.species.id}.png" alt="${entry.species.name || ''}" title="${entry.species.name || ''}" onerror="this.style.display='none'" />`
                : '';
            // Career stats for verified agents
            const careerBadge = entry.careerStats
                ? `<span class="career-badge" title="${entry.careerStats.wins}W / ${entry.careerStats.losses}L (${entry.careerStats.winRate}% win rate)">${entry.careerStats.wins}W-${entry.careerStats.losses}L</span>`
                : '';

            return `
                <div class="leaderboard-entry ${entryClass}" data-empire-id="${entry.empireId}">
                    <span class="leaderboard-rank ${rankClass}">#${entry.rank}</span>
                    <div class="leaderboard-crest">${crest}</div>
                    <div class="leaderboard-empire">
                        ${speciesImg}<span class="leaderboard-name ${onlineClass}">@${agentName}</span>
                        ${careerBadge}
                    </div>
                    <div class="leaderboard-sparkline">${sparkline}</div>
                    <span class="leaderboard-score">${this.formatScore(entry.score)}</span>
                </div>
            `;
        }).join('');

        // Click to select empire
        container.querySelectorAll('.leaderboard-entry').forEach(el => {
            el.addEventListener('click', () => {
                const empireId = el.dataset.empireId;
                this.selectedEmpire = empireId;
                this.onEmpireSelect?.(empireId);
            });
        });

        // Render pagination
        this.renderRankingsPagination(pagination, paginationEl);
    }

    renderRankingsCitizens(citizens, pagination, totalAll, onlineAll) {
        const container = document.getElementById('rankingsContent');
        const countEl = document.getElementById('rankingsCount');
        const paginationEl = document.getElementById('rankingsPagination');
        if (!container) return;

        if (countEl) {
            countEl.textContent = `${totalAll} registered • ${onlineAll} online`;
        }

        if (!citizens || citizens.length === 0) {
            container.innerHTML = '<p class="placeholder">No citizens found</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = citizens.map(c => `
            <div class="citizen-entry">
                <span class="online-dot ${c.isOnline ? 'online' : 'offline'}"></span>
                <div class="citizen-info">
                    <div class="citizen-name">${c.name}${c.isFounder ? ' 👑' : ''}</div>
                    <div class="citizen-moltbook">
                        <a href="${c.moltbookUrl}" target="_blank">@${c.name}</a>
                        ${c.isOnline ? ' • 🟢 Online' : ''}
                    </div>
                </div>
            </div>
        `).join('');

        this.renderRankingsPagination(pagination, paginationEl);
    }

    renderRankingsPagination(pagination, paginationEl) {
        if (paginationEl && pagination && pagination.totalPages > 1) {
            paginationEl.innerHTML = `
                <button class="pagination-btn" ${!pagination.hasPrev ? 'disabled' : ''} data-action="prev">← Prev</button>
                <span class="pagination-info">Page ${pagination.page} of ${pagination.totalPages}</span>
                <button class="pagination-btn" ${!pagination.hasNext ? 'disabled' : ''} data-action="next">Next →</button>
            `;
            paginationEl.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.action === 'prev' && pagination.hasPrev) {
                        this.rankingsPage--;
                        this.fetchRankings();
                    } else if (btn.dataset.action === 'next' && pagination.hasNext) {
                        this.rankingsPage++;
                        this.fetchRankings();
                    }
                });
            });
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
    }

    formatScore(score) {
        if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
        if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
        return score.toString();
    }

    // === TILE DETAIL MODAL ===

    showTileDetailModal(tileInfo) {
        const modal = document.getElementById('tileDetailModal');
        const title = document.getElementById('tileDetailTitle');
        const content = document.getElementById('tileDetailContent');
        
        const { planetId, planet, tileX, tileY, terrain, building } = tileInfo;
        
        // Terrain icons
        const terrainIcons = {
            water: '🌊', plains: '🌿', mountain: '⛰️', forest: '🌲',
            sand: '🏜️', ice: '❄️', lava: '🌋', grass: '🌱', dirt: '🟤', stone: '🪨'
        };
        
        // Building icons
        const buildingIcons = {
            mine: '⛏️', power_plant: '⚡', farm: '🌾', research_lab: '🔬',
            barracks: '🏰', shipyard: '🚀', fortress: '🛡️', moisture_farm: '💧',
            advanced_mine: '⛏️', fusion_reactor: '⚡', hydroponics_bay: '🌿',
            science_complex: '🔬', military_academy: '🎖️', advanced_shipyard: '🚀',
            deep_core_extractor: '⛏️', dyson_collector: '☀️', orbital_farm: '🌍',
            think_tank: '🧠', war_college: '⚔️', orbital_foundry: '🏭',
            citadel: '🏰', planetary_fortress: '🌍🏰',
            dyson_sphere: '☀️', matter_decompressor: '⚫', ring_world: '🪐',
            strategic_coordination_center: '🎖️', mega_art_installation: '🎨', science_nexus: '🔬'
        };
        
        if (building) {
            title.textContent = `${buildingIcons[building.defName] || '🏗️'} ${this.formatBuildingName(building.defName)}`;
            
            // Building production rates (simplified)
            const productionRates = {
                mine: { minerals: 5 }, advanced_mine: { minerals: 12 }, deep_core_extractor: { minerals: 25 },
                power_plant: { energy: 8 }, fusion_reactor: { energy: 18 }, dyson_collector: { energy: 40 },
                farm: { food: 6 }, hydroponics_bay: { food: 22 }, orbital_farm: { food: 50 },
                research_lab: { research: 3 }, science_complex: { research: 6 }, think_tank: { research: 12 },
                dyson_sphere: { energy: 500 }, matter_decompressor: { minerals: 400 },
                ring_world: { food: 300, credits: 200 }, science_nexus: { research: 100 }
            };
            
            const production = productionRates[building.defName] || {};
            const prodHtml = Object.entries(production).map(([res, amt]) => 
                `<div class="tile-prod-item">+${amt} ${res}/tick</div>`
            ).join('') || '<div class="tile-prod-item">No production</div>';
            
            // Check upgrade path
            const upgradePaths = {
                mine: 'advanced_mine', advanced_mine: 'deep_core_extractor',
                power_plant: 'fusion_reactor', fusion_reactor: 'dyson_collector',
                farm: 'hydroponics_bay', hydroponics_bay: 'orbital_farm',
                research_lab: 'science_complex', science_complex: 'think_tank',
                barracks: 'military_academy', military_academy: 'war_college',
                shipyard: 'advanced_shipyard', advanced_shipyard: 'orbital_foundry',
                fortress: 'citadel', citadel: 'planetary_fortress'
            };
            
            const nextUpgrade = upgradePaths[building.defName];
            const upgradeHtml = nextUpgrade 
                ? `<div class="tile-upgrade">⬆️ Upgrades to: ${this.formatBuildingName(nextUpgrade)}</div>`
                : '<div class="tile-upgrade completed">✨ Max Level</div>';
            
            content.innerHTML = `
                <div class="tile-detail-grid">
                    <div class="tile-info-section">
                        <h4>📍 Location</h4>
                        <div class="tile-location">
                            <span>Planet: ${planet?.name || planetId}</span>
                            <span>Coordinates: (${tileX}, ${tileY})</span>
                            <span>Terrain: ${terrainIcons[terrain] || '❓'} ${terrain}</span>
                        </div>
                    </div>
                    
                    <div class="tile-info-section">
                        <h4>📊 Production</h4>
                        <div class="tile-production">
                            ${prodHtml}
                        </div>
                    </div>
                    
                    <div class="tile-info-section">
                        <h4>📈 Status</h4>
                        <div class="tile-status">
                            <div>HP: ${building.hp || '?'}/${building.maxHp || '?'}</div>
                            ${building.constructing ? `<div class="constructing">🚧 Under Construction (${Math.round((building.constructionProgress || 0) * 100)}%)</div>` : ''}
                            ${upgradeHtml}
                        </div>
                    </div>
                    
                    <div class="tile-info-section modules">
                        <h4>🔧 Modules <span class="tag-new">NEW!</span></h4>
                        <div class="tile-modules" id="tileModules" data-entity-id="${building.id}">
                            <div class="modules-loading">Loading modules...</div>
                        </div>
                    </div>
                    
                    <div class="tile-info-section future">
                        <h4>🔮 Coming Soon</h4>
                        <div class="tile-future">
                            <div>• Worker assignment</div>
                            <div>• Tile mini-games</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            title.textContent = `${terrainIcons[terrain] || '📍'} Empty Tile`;
            
            content.innerHTML = `
                <div class="tile-detail-grid">
                    <div class="tile-info-section">
                        <h4>📍 Location</h4>
                        <div class="tile-location">
                            <span>Planet: ${planet?.name || planetId}</span>
                            <span>Coordinates: (${tileX}, ${tileY})</span>
                            <span>Terrain: ${terrainIcons[terrain] || '❓'} ${terrain}</span>
                        </div>
                    </div>
                    
                    <div class="tile-info-section">
                        <h4>🏗️ Build Here</h4>
                        <div class="tile-buildable">
                            <div>This tile is empty and can be built on.</div>
                            <div class="tile-build-hint">Use the API to build structures:</div>
                            <code>{"action": "build", "type": "mine", "locationId": "${planetId}"}</code>
                        </div>
                    </div>
                    
                    <div class="tile-info-section future">
                        <h4>🔮 Coming Soon</h4>
                        <div class="tile-future">
                            <div>• Tile exploration</div>
                            <div>• Resource deposits</div>
                            <div>• Ancient ruins</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        modal.style.display = 'flex';
        
        // Load modules for this building
        if (building) {
            this.loadBuildingModules(building.id, building.defName);
        }
    }
    
    async loadBuildingModules(entityId, buildingType) {
        const container = document.getElementById('tileModules');
        if (!container) return;
        
        try {
            const response = await fetch(`/api/buildings/${entityId}/modules`);
            const data = await response.json();
            
            if (!data.success) {
                container.innerHTML = '<div class="modules-error">Could not load modules</div>';
                return;
            }
            
            const { installedModules, slots, availableModules, effects } = data;
            
            // Build HTML
            let html = `
                <div class="modules-slots">Slots: ${slots.used}/${slots.max}</div>
            `;
            
            // Installed modules
            if (installedModules.length > 0) {
                html += '<div class="modules-installed">';
                for (const mod of installedModules) {
                    html += `
                        <div class="module-card installed">
                            <span class="module-icon">${mod.icon}</span>
                            <span class="module-name">${mod.name}</span>
                            <span class="module-effect">${mod.description}</span>
                        </div>
                    `;
                }
                html += '</div>';
            }
            
            // Available modules (if slots available)
            if (slots.used < slots.max && availableModules.length > 0) {
                html += `
                    <div class="modules-available">
                        <div class="modules-label">Available (${availableModules.length}):</div>
                        <div class="modules-list">
                `;
                for (const mod of availableModules.slice(0, 4)) {
                    const costStr = Object.entries(mod.cost).map(([r, c]) => `${c} ${r}`).join(', ');
                    html += `
                        <div class="module-card available" title="${mod.description}\nCost: ${costStr}">
                            <span class="module-icon">${mod.icon}</span>
                            <span class="module-name">${mod.name}</span>
                        </div>
                    `;
                }
                if (availableModules.length > 4) {
                    html += `<div class="modules-more">+${availableModules.length - 4} more</div>`;
                }
                html += '</div></div>';
            } else if (slots.used >= slots.max) {
                html += '<div class="modules-full">All slots filled</div>';
            }
            
            // Active effects summary
            const activeEffects = Object.entries(effects).filter(([k, v]) => v && v !== 0 && v !== false);
            if (activeEffects.length > 0) {
                html += '<div class="modules-effects"><div class="effects-label">Active Effects:</div>';
                for (const [key, value] of activeEffects.slice(0, 3)) {
                    const formatted = typeof value === 'number' ? `+${Math.round(value * 100)}%` : '✓';
                    html += `<span class="effect-badge">${this.formatEffectName(key)}: ${formatted}</span>`;
                }
                html += '</div>';
            }
            
            html += `
                <div class="modules-hint">
                    Use WebSocket API to install: <code>install_building_module</code>
                </div>
            `;
            
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<div class="modules-error">Error loading modules</div>';
        }
    }
    
    formatEffectName(key) {
        const names = {
            productionBonus: 'Production',
            researchBonus: 'Research',
            upkeepReduction: 'Upkeep -',
            hpBonus: 'HP',
            armorBonus: 'Armor',
            attackBonus: 'Attack',
            trainingSpeedBonus: 'Training',
            buildSpeedBonus: 'Build Speed'
        };
        return names[key] || key;
    }
    
    formatBuildingName(defName) {
        return defName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // === BUILDINGS MODAL ===

    async showBuildingsModal() {
        const modal = document.getElementById('buildingsModal');
        const content = document.getElementById('buildingsContent');
        modal.style.display = 'flex';
        
        content.innerHTML = `
            <div class="buildings-guide">
                <div class="buildings-section">
                    <h3>🏭 Production Structures</h3>
                    <p class="section-desc">Core economy buildings that generate resources every tick.</p>
                    <div class="building-grid">
                        <div class="building-card">
                            <div class="building-icon">⛏️</div>
                            <div class="building-info">
                                <div class="building-name">Mine</div>
                                <div class="building-cost">50m 10e</div>
                                <div class="building-prod">+5 minerals/tick</div>
                                <div class="building-upgrades">→ Advanced Mine (12/tick) → Deep Core (25/tick)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">⚡</div>
                            <div class="building-info">
                                <div class="building-name">Power Plant</div>
                                <div class="building-cost">30m 20e</div>
                                <div class="building-prod">+8 energy/tick</div>
                                <div class="building-upgrades">→ Fusion Reactor (18/tick) → Dyson Collector (40/tick)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🌾</div>
                            <div class="building-info">
                                <div class="building-name">Farm</div>
                                <div class="building-cost">40m 15e</div>
                                <div class="building-prod">+6 food/tick</div>
                                <div class="building-upgrades">→ Hydroponics Bay (22/tick) → Orbital Farm (50/tick)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🔬</div>
                            <div class="building-info">
                                <div class="building-name">Research Lab</div>
                                <div class="building-cost">80m 40e</div>
                                <div class="building-prod">+3 research/tick</div>
                                <div class="building-upgrades">→ Science Complex (6/tick) → Think Tank (12/tick)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="buildings-section">
                    <h3>⚔️ Military Structures</h3>
                    <p class="section-desc">Train units and defend your planets.</p>
                    <div class="building-grid">
                        <div class="building-card">
                            <div class="building-icon">🏰</div>
                            <div class="building-info">
                                <div class="building-name">Barracks</div>
                                <div class="building-cost">60m 30e</div>
                                <div class="building-prod">Trains ground units</div>
                                <div class="building-upgrades">→ Military Academy (+10%) → War College (+25%)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🚀</div>
                            <div class="building-info">
                                <div class="building-name">Shipyard</div>
                                <div class="building-cost">120m 60e</div>
                                <div class="building-prod">Trains space units</div>
                                <div class="building-upgrades">→ Advanced Shipyard → Orbital Foundry (Titans)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🛡️</div>
                            <div class="building-info">
                                <div class="building-name">Fortress</div>
                                <div class="building-cost">150m 80e</div>
                                <div class="building-prod">100 HP, 15 ATK</div>
                                <div class="building-upgrades">→ Citadel (800 HP) → Planetary Fortress (1500 HP)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="buildings-section megastructures">
                    <h3>🌟 Megastructures <span class="tag-new">NEW!</span></h3>
                    <p class="section-desc">Massive late-game projects. Limit 1 per type per empire. Requires advanced tech.</p>
                    <div class="building-grid mega-grid">
                        <div class="building-card mega">
                            <div class="building-icon">☀️</div>
                            <div class="building-info">
                                <div class="building-name">Dyson Sphere</div>
                                <div class="building-cost">50k min, 25k ene, 5k res</div>
                                <div class="building-prod">+500 energy/tick</div>
                                <div class="building-req">Requires: stellar_engineering</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">⚫</div>
                            <div class="building-info">
                                <div class="building-name">Matter Decompressor</div>
                                <div class="building-cost">40k min, 30k ene, 4k res</div>
                                <div class="building-prod">+400 minerals/tick</div>
                                <div class="building-req">Requires: advanced_mining</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🪐</div>
                            <div class="building-info">
                                <div class="building-name">Ring World</div>
                                <div class="building-cost">60k min, 40k ene, 10k food, 6k res</div>
                                <div class="building-prod">+300 food, +200 credits, +1000 pop</div>
                                <div class="building-req">Requires: mega_engineering</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🎖️</div>
                            <div class="building-info">
                                <div class="building-name">Strategic Command</div>
                                <div class="building-cost">30k min, 20k ene, 8k res</div>
                                <div class="building-prod">+100 fleet cap, +20% fleet damage</div>
                                <div class="building-req">Requires: advanced_administration</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🔬</div>
                            <div class="building-info">
                                <div class="building-name">Science Nexus</div>
                                <div class="building-cost">35k min, 25k ene, 10k res</div>
                                <div class="building-prod">+100 research/tick</div>
                                <div class="building-req">Requires: technological_ascendancy</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🎨</div>
                            <div class="building-info">
                                <div class="building-name">Mega Art Installation</div>
                                <div class="building-cost">25k min, 15k ene, 20k cred</div>
                                <div class="building-prod">+150 credits, +30% diplomacy</div>
                                <div class="building-req">Requires: ecumenopolis_project</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="buildings-section fleet-upkeep">
                    <h3>💸 Fleet Upkeep <span class="tag-new">NEW!</span></h3>
                    <p class="section-desc">Ships cost resources every tick. Plan your fleet size!</p>
                    <div class="upkeep-table">
                        <div class="upkeep-row header"><span>Ship</span><span>Energy</span><span>Credits</span></div>
                        <div class="upkeep-row"><span>Fighter</span><span>1</span><span>0</span></div>
                        <div class="upkeep-row"><span>Bomber</span><span>2</span><span>1</span></div>
                        <div class="upkeep-row"><span>Battleship</span><span>5</span><span>3</span></div>
                        <div class="upkeep-row"><span>Carrier</span><span>8</span><span>5</span></div>
                        <div class="upkeep-row"><span>Titan</span><span>15</span><span>10</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    // === SPECIES MODAL ===

    async showSpeciesModal() {
        try {
            const res = await fetch('/api/species');
            const data = await res.json();
            this.renderSpeciesModal(data.species);
        } catch (err) {
            console.error('Failed to load species:', err);
        }
    }

    renderSpeciesModal(species) {
        // Remove existing modal
        document.querySelector('.species-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'species-modal';

        // Category icons and colors
        const categoryInfo = {
            organic: { icon: '🧬', color: '#4ade80', label: 'Organic' },
            synthetic: { icon: '🤖', color: '#60a5fa', label: 'Synthetic' },
            exotic: { icon: '✨', color: '#a78bfa', label: 'Exotic' }
        };

        const speciesHtml = species.map(s => {
            const cat = categoryInfo[s.category] || { icon: '👾', color: '#888', label: 'Unknown' };

            // Format bonuses and penalties
            const bonusesHtml = s.bonuses?.map(b =>
                `<span class="trait-bonus">▲ ${b}</span>`
            ).join('') || '';

            const penaltiesHtml = s.penalties?.map(p =>
                `<span class="trait-penalty">▼ ${p}</span>`
            ).join('') || '';

            const worldBonusHtml = s.worldBonuses?.map(w =>
                `<span class="trait-world">🌍 ${w}</span>`
            ).join('') || '';

            // Lore sections
            const loreHtml = s.lore ? `
                <div class="species-lore">
                    <div class="lore-section">
                        <h5>📜 Origin</h5>
                        <p>${s.lore.origin}</p>
                    </div>
                    <div class="lore-section">
                        <h5>🏛️ Culture</h5>
                        <p>${s.lore.culture}</p>
                    </div>
                    <div class="lore-section">
                        <h5>💭 Philosophy</h5>
                        <p class="philosophy">${s.lore.philosophy}</p>
                    </div>
                    <div class="lore-section">
                        <h5>🤝 Diplomacy</h5>
                        <p>${s.lore.relations}</p>
                    </div>
                </div>
            ` : '';

            const abilityHtml = s.specialAbility ? `
                <div class="species-ability">
                    <span class="ability-icon">⭐</span>
                    <span class="ability-name">${s.specialAbility.name}</span>
                    <span class="ability-desc">${s.specialAbility.description}</span>
                </div>
            ` : '';

            // Species portrait from AI-generated PNG
            return `
                <div class="species-card" data-category="${s.category}">
                    <div class="species-header" style="border-color: ${cat.color}">
                        <div class="species-portrait-row">
                            <div class="species-portrait-container"><img src="/images/species/${s.id}.png" alt="${s.name}" class="species-portrait-img" onerror="this.style.display='none'" /></div>
                            <div class="species-info">
                                <div class="species-title">
                                    <span class="species-icon">${cat.icon}</span>
                                    <h4>${s.name}</h4>
                                    <span class="species-category" style="color: ${cat.color}">${cat.label}</span>
                                </div>
                                <p class="species-desc">${s.description}</p>
                            </div>
                        </div>
                    </div>
                    <div class="species-traits">
                        ${bonusesHtml}
                        ${penaltiesHtml}
                        ${worldBonusHtml}
                    </div>
                    ${abilityHtml}
                    <details class="species-lore-toggle">
                        <summary>📖 Read Full Lore</summary>
                        ${loreHtml}
                    </details>
                </div>
            `;
        }).join('');

        // Group by category
        const organicSpecies = species.filter(s => s.category === 'organic');
        const syntheticSpecies = species.filter(s => s.category === 'synthetic');
        const exoticSpecies = species.filter(s => s.category === 'exotic');

        modal.innerHTML = `
            <div class="species-modal-content">
                <div class="species-modal-header">
                    <h3>🧬 Species of Clawdistan</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <p class="species-intro">
                    The universe is home to ${species.length} known species, each with unique traits,
                    histories, and ways of perceiving reality. Species bonuses affect resource production,
                    combat effectiveness, and more.
                </p>
                <div class="species-filters">
                    <button class="filter-btn active" data-filter="all">All (${species.length})</button>
                    <button class="filter-btn" data-filter="organic">🧬 Organic (${organicSpecies.length})</button>
                    <button class="filter-btn" data-filter="synthetic">🤖 Synthetic (${syntheticSpecies.length})</button>
                    <button class="filter-btn" data-filter="exotic">✨ Exotic (${exoticSpecies.length})</button>
                </div>
                <div class="species-grid">
                    ${speciesHtml}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Filter functionality
        modal.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.dataset.filter;
                modal.querySelectorAll('.species-card').forEach(card => {
                    if (filter === 'all' || card.dataset.category === filter) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });

        // Close handlers
        modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Play sound
        if (window.SoundFX) window.SoundFX.play('open');
    }

    // === RELIQUARY MODAL ===

    async showReliquaryModal() {
        try {
            // Fetch all relics and definitions in parallel
            const [relicsRes, defsRes] = await Promise.all([
                fetch('/api/relics'),
                fetch('/api/relics/definitions')
            ]);
            const relicsData = await relicsRes.json();
            const defsData = await defsRes.json();
            this.renderReliquaryModal(relicsData.relics, defsData.definitions);
        } catch (err) {
            console.error('Failed to load relics:', err);
        }
    }

    renderReliquaryModal(relics, definitions) {
        // Remove existing modal
        document.querySelector('.reliquary-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'reliquary-modal modal';

        // Rarity colors and icons
        const rarityConfig = {
            common: { color: '#9ca3af', glow: 'rgba(156, 163, 175, 0.3)', label: '⚪ Common' },
            uncommon: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)', label: '🟢 Uncommon' },
            rare: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', label: '🔵 Rare' },
            legendary: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', label: '🟡 Legendary' }
        };

        // Group relics by empire
        const relicsByEmpire = {};
        for (const relic of relics) {
            if (!relicsByEmpire[relic.empireId]) {
                relicsByEmpire[relic.empireId] = [];
            }
            relicsByEmpire[relic.empireId].push(relic);
        }

        // Get empire info
        const empireInfo = {};
        for (const e of this._cachedEmpires || []) {
            empireInfo[e.id] = { name: e.name, color: e.color };
        }

        // Build discovered relics section
        let discoveredHtml = '';
        if (relics.length === 0) {
            discoveredHtml = '<div class="relic-empty">No relics have been discovered yet.<br>Explore anomalies to find precursor artifacts!</div>';
        } else {
            for (const [empireId, empireRelics] of Object.entries(relicsByEmpire)) {
                const empire = empireInfo[empireId] || { name: 'Unknown', color: '#888' };
                discoveredHtml += `
                    <div class="relic-empire-section" style="--empire-color: ${empire.color}">
                        <div class="relic-empire-header">
                            <span class="empire-dot"></span>
                            ${empire.name}'s Relics (${empireRelics.length})
                        </div>
                        <div class="relic-grid">
                            ${empireRelics.map(r => {
                                const cfg = rarityConfig[r.rarity];
                                const bonusText = Object.entries(r.bonuses || {})
                                    .map(([k, v]) => `+${Math.round(v * 100)}% ${k.replace(/([A-Z])/g, ' $1').trim()}`)
                                    .join(' • ');
                                return `
                                    <div class="relic-card discovered" style="--rarity-color: ${cfg.color}; --rarity-glow: ${cfg.glow}">
                                        <div class="relic-rarity-badge">${r.rarity.toUpperCase()}</div>
                                        <div class="relic-icon">${r.icon}</div>
                                        <div class="relic-name">${r.name}</div>
                                        <div class="relic-desc">${r.description}</div>
                                        ${bonusText ? `<div class="relic-bonuses">${bonusText}</div>` : ''}
                                        ${r.unique ? '<div class="relic-unique">★ UNIQUE</div>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // Group catalog by rarity for better organization
        const byRarity = { legendary: [], rare: [], uncommon: [], common: [] };
        for (const [type, def] of Object.entries(definitions)) {
            const isDiscovered = relics.some(r => r.type === type);
            byRarity[def.rarity]?.push({ type, def, isDiscovered });
        }

        let catalogHtml = '';
        for (const rarity of ['legendary', 'rare', 'uncommon', 'common']) {
            const items = byRarity[rarity];
            if (items.length === 0) continue;

            const cfg = rarityConfig[rarity];
            const discoveredCount = items.filter(i => i.isDiscovered).length;

            catalogHtml += `
                <div class="relic-rarity-section" style="--rarity-color: ${cfg.color}">
                    <div class="relic-rarity-header">
                        <span class="rarity-dot"></span>
                        ${cfg.label} (${discoveredCount}/${items.length})
                    </div>
                    <div class="relic-catalog-grid">
                        ${items.map(({ type, def, isDiscovered }) => `
                            <div class="relic-card catalog ${isDiscovered ? 'discovered' : 'locked'}" style="--rarity-color: ${cfg.color}; --rarity-glow: ${cfg.glow}">
                                ${isDiscovered ? '<div class="relic-discovered-check">✓</div>' : ''}
                                <div class="relic-icon ${!isDiscovered ? 'locked' : ''}">${def.icon}</div>
                                <div class="relic-name">${isDiscovered ? def.name : '???'}</div>
                                ${isDiscovered ? `<div class="relic-desc">${def.description}</div>` : '<div class="relic-locked-text">Not yet discovered</div>'}
                                ${def.unique ? '<div class="relic-unique-tag">UNIQUE</div>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="reliquary-content">
                <div class="reliquary-header">
                    <h2>🏛️ Reliquary</h2>
                    <div class="reliquary-subtitle">Precursor Artifacts of Power</div>
                    <button class="modal-close reliquary-close">×</button>
                </div>

                <div class="reliquary-tabs">
                    <button class="reliquary-tab active" data-tab="discovered">
                        📜 Discovered <span class="tab-count">${relics.length}</span>
                    </button>
                    <button class="reliquary-tab" data-tab="catalog">
                        📖 Catalog <span class="tab-count">${Object.keys(definitions).length}</span>
                    </button>
                </div>

                <div class="reliquary-legend">
                    ${Object.entries(rarityConfig).map(([k, v]) => `<span style="color: ${v.color}">${v.label}</span>`).join('')}
                </div>

                <div class="reliquary-body">
                    <div class="reliquary-discovered">
                        ${discoveredHtml}
                    </div>
                    <div class="reliquary-catalog" style="display: none;">
                        ${catalogHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Tab switching
        modal.querySelectorAll('.reliquary-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.reliquary-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const tab = btn.dataset.tab;
                modal.querySelector('.reliquary-discovered').style.display = tab === 'discovered' ? 'block' : 'none';
                modal.querySelector('.reliquary-catalog').style.display = tab === 'catalog' ? 'block' : 'none';
            });
        });

        // Close handlers
        modal.querySelector('.reliquary-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Play sound
        if (window.SoundFX) window.SoundFX.play('open');
    }

    // === TECH TREE ===

    async initTechTree() {
        // State
        this._techFilter = 'all';
        this._techSearch = '';
        this._techView = 'tier';

        document.getElementById('techTreeBtn')?.addEventListener('click', () => {
            document.getElementById('techTreeModal').style.display = 'flex';
            this.fetchTechTree();
        });
        document.getElementById('closeTechTree')?.addEventListener('click', () => {
            document.getElementById('techTreeModal').style.display = 'none';
        });
        document.getElementById('techEmpireSelect')?.addEventListener('change', (e) => {
            this._selectedEmpireId = e.target.value;
            this.renderTechTree(this._techData, e.target.value);
        });

        // Search
        document.getElementById('techSearch')?.addEventListener('input', (e) => {
            this._techSearch = e.target.value.toLowerCase();
            this.applyTechFilters();
        });

        // Category filters
        document.querySelectorAll('.tech-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tech-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._techFilter = btn.dataset.category;
                this.applyTechFilters();
            });
        });

        // View toggle
        document.querySelectorAll('.tech-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tech-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._techView = btn.dataset.view;

                const tierView = document.getElementById('techTreeTierView');
                const catView = document.getElementById('techTreeCategoryView');
                if (this._techView === 'tier') {
                    tierView.style.display = 'flex';
                    catView.style.display = 'none';
                } else {
                    tierView.style.display = 'none';
                    catView.style.display = 'block';
                }

                // Render the newly active view
                this.renderTechView(this._techView);
            });
        });
    }

    async fetchTechTree() {
        try {
            const res = await fetch('/api/tech');
            const data = await res.json();
            this._techData = data;

            // Populate empire selector
            const select = document.getElementById('techEmpireSelect');
            if (select && data.empires) {
                select.innerHTML = data.empires.map(e =>
                    `<option value="${e.id}" style="color: ${e.color}">${e.name}</option>`
                ).join('');
            }

            // Render for first empire
            if (data.empires && data.empires.length > 0) {
                this._selectedEmpireId = data.empires[0].id;
                this.renderTechTree(data, data.empires[0].id);
            }
        } catch (err) {
            console.error('Failed to load tech tree:', err);
        }
    }

    renderTechTree(data, empireId) {
        if (!data || !data.technologies) return;

        const researched = new Set(data.researched?.[empireId] || []);
        const techs = data.technologies;
        this._techMap = {};
        this._researched = researched;

        // Category icons
        const categoryIcons = {
            physics: '⚡', engineering: '🔧', biology: '🧬',
            military: '⚔️', society: '🏛️', ascension: '✨', rare: '💎'
        };

        // Tier colors
        const tierColors = {
            1: '#4ade80', 2: '#60a5fa', 3: '#a78bfa', 4: '#f59e0b', 5: '#f43f5e'
        };

        // Build tech map and group data
        const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        const categories = { physics: [], engineering: [], biology: [], military: [], society: [], ascension: [], rare: [] };

        for (const tech of techs) {
            this._techMap[tech.id] = tech;
            if (tiers[tech.tier]) tiers[tech.tier].push(tech);
            const cat = tech.category || 'society';
            if (categories[cat]) categories[cat].push(tech);
        }

        // Update progress
        const totalTechs = techs.length;
        const researchedCount = researched.size;
        document.getElementById('techProgress').textContent = `${researchedCount}/${totalTechs} researched`;

        // Render card helper
        const renderCard = (tech) => {
            const isResearched = researched.has(tech.id);
            const canResearch = !isResearched && tech.prerequisites.every(p => researched.has(p));
            const status = isResearched ? 'researched' : canResearch ? 'available' : 'locked';
            const tierColor = tierColors[tech.tier];
            const catIcon = categoryIcons[tech.category] || '🔬';

            // Format prerequisites
            const prereqNames = tech.prerequisites.map(p => this._techMap[p]?.name || p);
            const prereqHtml = prereqNames.length > 0
                ? `<div class="tech-prereqs">⬆️ ${prereqNames.slice(0, 2).join(' + ')}${prereqNames.length > 2 ? '...' : ''}</div>`
                : '';

            // Format top effects (limit to 2)
            let effectsList = [];
            if (tech.effects) {
                if (tech.effects.mineralBonus) effectsList.push(`+${Math.round(tech.effects.mineralBonus * 100)}% min`);
                if (tech.effects.foodBonus) effectsList.push(`+${Math.round(tech.effects.foodBonus * 100)}% food`);
                if (tech.effects.energyBonus) effectsList.push(`+${Math.round(tech.effects.energyBonus * 100)}% energy`);
                if (tech.effects.researchBonus) effectsList.push(`+${Math.round(tech.effects.researchBonus * 100)}% research`);
                if (tech.effects.attackBonus) effectsList.push(`+${Math.round(tech.effects.attackBonus * 100)}% atk`);
                if (tech.effects.hpBonus) effectsList.push(`+${Math.round(tech.effects.hpBonus * 100)}% HP`);
                if (tech.effects.victory) effectsList = ['🏆 VICTORY'];
                if (tech.effects.unlocks) effectsList.push(`Unlocks`);
            }
            const effectsHtml = effectsList.length > 0
                ? `<div class="tech-effects">${effectsList.slice(0, 2).join(' • ')}</div>`
                : '';

            return `
                <div class="tech-card ${status}" data-tech="${tech.id}" data-category="${tech.category}" style="--tier-color: ${tierColor}">
                    <span class="tech-category-badge ${tech.category}">${catIcon}</span>
                    <div class="tech-header">
                        <span class="tech-name">${tech.name}</span>
                    </div>
                    <div class="tech-cost-bar">
                        <span class="tech-cost">🔬 ${tech.cost >= 1000 ? (tech.cost/1000).toFixed(1) + 'k' : tech.cost}</span>
                        <span class="tech-tier-badge">T${tech.tier}</span>
                    </div>
                    <div class="tech-desc">${tech.description.substring(0, 80)}${tech.description.length > 80 ? '...' : ''}</div>
                    ${effectsHtml}
                    ${prereqHtml}
                </div>
            `;
        };

        // Store grouped data for lazy rendering
        this._techTiers = tiers;
        this._techCategories = categories;
        this._renderCard = renderCard;

        // Only render active view (default is tier)
        this.renderTechView(this._techView || 'tier');

        // Setup interactions
        this.setupTechTreeInteractions(this._techMap, researched);
    }

    renderTechView(view) {
        const renderCard = this._renderCard;
        if (!renderCard) return;

        if (view === 'tier') {
            // Render tier view using DocumentFragment for performance
            for (let tier = 1; tier <= 5; tier++) {
                const container = document.getElementById(`tier${tier}Techs`);
                if (!container) continue;
                const techs = this._techTiers[tier] || [];
                techs.sort((a, b) => (a.category || '').localeCompare(b.category || ''));

                const fragment = document.createDocumentFragment();
                const temp = document.createElement('div');
                temp.innerHTML = techs.map(renderCard).join('');
                while (temp.firstChild) fragment.appendChild(temp.firstChild);

                container.innerHTML = '';
                container.appendChild(fragment);
            }
        } else {
            // Render category view
            for (const [cat, catTechs] of Object.entries(this._techCategories)) {
                const container = document.getElementById(`${cat}Techs`);
                if (!container) continue;
                catTechs.sort((a, b) => a.tier - b.tier);

                const fragment = document.createDocumentFragment();
                const temp = document.createElement('div');
                temp.innerHTML = catTechs.map(renderCard).join('');
                while (temp.firstChild) fragment.appendChild(temp.firstChild);

                container.innerHTML = '';
                container.appendChild(fragment);
            }
        }

        // Apply filters after rendering
        this.applyTechFilters();
    }

    applyTechFilters() {
        const cards = document.querySelectorAll('.tech-card');
        cards.forEach(card => {
            const techId = card.dataset.tech;
            const tech = this._techMap?.[techId];
            if (!tech) return;

            let visible = true;

            // Category filter
            if (this._techFilter !== 'all' && tech.category !== this._techFilter) {
                visible = false;
            }

            // Search filter
            if (this._techSearch && visible) {
                const searchable = `${tech.name} ${tech.description} ${tech.id}`.toLowerCase();
                if (!searchable.includes(this._techSearch)) {
                    visible = false;
                }
            }

            card.classList.toggle('hidden', !visible);
        });
    }

    setupTechTreeInteractions(techMap, researched) {
        const cards = document.querySelectorAll('.tech-card');

        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                const techId = card.dataset.tech;
                const tech = techMap[techId];
                if (!tech) return;

                // Highlight prerequisites
                tech.prerequisites.forEach(prereqId => {
                    const prereqCard = document.querySelector(`[data-tech="${prereqId}"]`);
                    if (prereqCard) prereqCard.classList.add('prereq-highlight');
                });

                // Highlight techs that depend on this one
                Object.values(techMap).forEach(t => {
                    if (t.prerequisites.includes(techId)) {
                        const depCard = document.querySelector(`[data-tech="${t.id}"]`);
                        if (depCard) depCard.classList.add('dependent-highlight');
                    }
                });
            });

            card.addEventListener('mouseleave', () => {
                document.querySelectorAll('.prereq-highlight, .dependent-highlight')
                    .forEach(el => el.classList.remove('prereq-highlight', 'dependent-highlight'));
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DIPLOMACY PANEL
    // ═══════════════════════════════════════════════════════════════════════════════

    async initDiplomacy() {
        document.getElementById('diplomacyBtn')?.addEventListener('click', () => {
            document.getElementById('diplomacyModal').style.display = 'flex';
            this.fetchDiplomacy();
        });
        document.getElementById('closeDiplomacy')?.addEventListener('click', () => {
            document.getElementById('diplomacyModal').style.display = 'none';
        });
        document.getElementById('refreshDiplomacy')?.addEventListener('click', () => {
            this.fetchDiplomacy();
        });
    }

    async fetchDiplomacy() {
        try {
            const res = await fetch('/api/diplomacy');
            const data = await res.json();
            this._diplomacyData = data;
            this.renderDiplomacy(data);
        } catch (err) {
            console.error('Failed to load diplomacy:', err);
        }
    }

    renderDiplomacy(data) {
        if (!data) return;

        // Render Wars
        const warsContainer = document.getElementById('diplomacyWars');
        const wars = data.relations.filter(r => r.status === 'war');
        if (wars.length > 0) {
            warsContainer.innerHTML = wars.map(war => {
                const timeAgo = this._formatTimeAgo(war.since);
                const aggressor = war.aggressor === war.empire1.id ? war.empire1.name : war.empire2.name;
                return `
                    <div class="diplomacy-item war">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${war.empire1.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${war.empire1.name}</span>
                        </div>
                        <span class="diplomacy-vs">⚔️</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${war.empire2.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${war.empire2.name}</span>
                        </div>
                        <div class="diplomacy-status war">At War</div>
                        <div class="diplomacy-time" title="Started by ${aggressor}">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            warsContainer.innerHTML = '<p class="placeholder-text">🕊️ Peace reigns across the galaxy</p>';
        }

        // Render Alliances
        const alliancesContainer = document.getElementById('diplomacyAlliances');
        const alliances = data.relations.filter(r => r.status === 'allied');
        if (alliances.length > 0) {
            alliancesContainer.innerHTML = alliances.map(alliance => {
                const timeAgo = this._formatTimeAgo(alliance.since);
                return `
                    <div class="diplomacy-item alliance">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${alliance.empire1.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${alliance.empire1.name}</span>
                        </div>
                        <span class="diplomacy-vs">🤝</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${alliance.empire2.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${alliance.empire2.name}</span>
                        </div>
                        <div class="diplomacy-status alliance">Allied</div>
                        <div class="diplomacy-time">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            alliancesContainer.innerHTML = '<p class="placeholder-text">No alliances have been formed</p>';
        }

        // Render Proposals
        const proposalsContainer = document.getElementById('diplomacyProposals');
        if (data.proposals.length > 0) {
            proposalsContainer.innerHTML = data.proposals.map(proposal => {
                const typeIcon = proposal.type === 'alliance' ? '🤝' : '🕊️';
                const typeLabel = proposal.type === 'alliance' ? 'Alliance' : 'Peace';
                const timeAgo = this._formatTimeAgo(proposal.created);
                return `
                    <div class="diplomacy-item proposal">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${proposal.from.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${proposal.from.name}</span>
                        </div>
                        <span class="diplomacy-vs">${typeIcon}→</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${proposal.to.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${proposal.to.name}</span>
                        </div>
                        <div class="diplomacy-status proposal">${typeLabel} Proposal</div>
                        <div class="diplomacy-time">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            proposalsContainer.innerHTML = '<p class="placeholder-text">No pending proposals</p>';
        }

        // Render Relations Matrix
        this._renderDiplomacyMatrix(data);
    }

    _renderDiplomacyMatrix(data) {
        const container = document.getElementById('diplomacyMatrix');
        if (!container || !data.empires || data.empires.length < 2) {
            container.innerHTML = '<p class="placeholder-text">Not enough empires for a relations matrix</p>';
            return;
        }

        const empires = data.empires;

        // Build relation lookup
        const relationMap = {};
        for (const rel of data.relations) {
            const key1 = `${rel.empire1.id}_${rel.empire2.id}`;
            const key2 = `${rel.empire2.id}_${rel.empire1.id}`;
            relationMap[key1] = rel.status;
            relationMap[key2] = rel.status;
        }

        let html = '<table>';

        // Header row
        html += '<tr><th></th>';
        for (const empire of empires) {
            html += `<th><div class="empire-header"><span class="empire-dot" style="background: ${empire.color || '#888'}"></span>${empire.name.substring(0, 10)}</div></th>`;
        }
        html += '</tr>';

        // Data rows
        for (const rowEmpire of empires) {
            html += `<tr><th><div class="empire-header"><span class="empire-dot" style="background: ${rowEmpire.color || '#888'}"></span>${rowEmpire.name.substring(0, 10)}</div></th>`;

            for (const colEmpire of empires) {
                if (rowEmpire.id === colEmpire.id) {
                    html += '<td class="self">-</td>';
                } else {
                    const key = `${rowEmpire.id}_${colEmpire.id}`;
                    const status = relationMap[key] || 'neutral';
                    const symbol = status === 'war' ? '⚔️' : status === 'allied' ? '🤝' : '•';
                    html += `<td class="${status}">${symbol}</td>`;
                }
            }
            html += '</tr>';
        }

        html += '</table>';
        container.innerHTML = html;
    }

    _formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DIPLOMACY SUMMARY (Sidebar)
    // ═══════════════════════════════════════════════════════════════════════════════

    async fetchLeaderboard() {
        try {
            const res = await fetch('/api/leaderboard?limit=100');
            const data = await res.json();
            this._cachedLeaderboard = data.leaderboard || [];
            this._cachedEmpires = this._cachedLeaderboard; // Also cache as empires
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        }
    }

    async updateDiplomacySummary() {
        try {
            const res = await fetch('/api/diplomacy');
            const data = await res.json();
            this.renderDiplomacySummary(data);
        } catch (err) {
            // Silent fail - not critical
        }
    }

    renderDiplomacySummary(data) {
        if (!data) return;

        const warCount = document.getElementById('warCount');
        const allianceCount = document.getElementById('allianceCount');
        const activeConflicts = document.getElementById('activeConflicts');

        if (!warCount || !allianceCount || !activeConflicts) return;

        const wars = data.relations?.filter(r => r.status === 'war') || [];
        const alliances = data.relations?.filter(r => r.status === 'allied') || [];

        warCount.textContent = wars.length;
        allianceCount.textContent = alliances.length;

        // Show recent conflicts/alliances
        const items = [];

        // Show wars first (max 3)
        wars.slice(0, 3).forEach(war => {
            items.push(`
                <div class="conflict-item war">
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${war.empire1?.color || '#888'}"></span>
                        <span>${(war.empire1?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                    <span class="conflict-vs">⚔️</span>
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${war.empire2?.color || '#888'}"></span>
                        <span>${(war.empire2?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                </div>
            `);
        });

        // Show alliances (max 2)
        alliances.slice(0, 2).forEach(alliance => {
            items.push(`
                <div class="conflict-item alliance">
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${alliance.empire1?.color || '#888'}"></span>
                        <span>${(alliance.empire1?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                    <span class="conflict-vs">🤝</span>
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${alliance.empire2?.color || '#888'}"></span>
                        <span>${(alliance.empire2?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                </div>
            `);
        });

        if (items.length === 0) {
            activeConflicts.innerHTML = '<p style="color: #666; font-size: 0.75rem; text-align: center;">🕊️ Peace in the galaxy</p>';
        } else {
            activeConflicts.innerHTML = items.join('');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SHIP DESIGNER
    // ═══════════════════════════════════════════════════════════════════════════════

    initShipDesigner() {
        this._sdHulls = {};
        this._sdModules = {};
        this._sdSelectedHull = null;
        this._sdInstalledModules = [];
        this._sdModuleTab = 'weapon';

        // Open Ship Designer button
        document.getElementById('shipDesignerBtn')?.addEventListener('click', () => {
            this.openShipDesigner();
        });

        // Ship Designer Modal
        document.getElementById('closeShipDesigner')?.addEventListener('click', () => {
            document.getElementById('shipDesignerModal').style.display = 'none';
        });

        // Blueprints Modal
        document.getElementById('closeBlueprints')?.addEventListener('click', () => {
            document.getElementById('blueprintsModal').style.display = 'none';
        });

        document.getElementById('openShipDesignerFromBlueprints')?.addEventListener('click', () => {
            document.getElementById('blueprintsModal').style.display = 'none';
            this.openShipDesigner();
        });

        // Module tabs
        document.querySelectorAll('.sd-mod-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sd-mod-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._sdModuleTab = btn.dataset.type;
                this.renderModuleList();
            });
        });

        // Clear modules
        document.getElementById('sdClearModules')?.addEventListener('click', () => {
            this._sdInstalledModules = [];
            this.updateShipPreview();
            this.renderInstalledModules();
            this.renderModuleList();
        });

        // Save blueprint
        document.getElementById('sdSaveBlueprint')?.addEventListener('click', () => {
            this.saveBlueprint();
        });

        // Fetch hulls and modules data
        this.fetchShipDesignerData();
    }

    async fetchShipDesignerData() {
        try {
            const [hullsRes, modulesRes] = await Promise.all([
                fetch('/api/ships/hulls'),
                fetch('/api/ships/modules')
            ]);
            const hullsData = await hullsRes.json();
            const modulesData = await modulesRes.json();

            this._sdHulls = hullsData.hulls || {};
            this._sdModules = {};
            (modulesData.modules || []).forEach(m => {
                this._sdModules[m.id] = m;
            });
        } catch (err) {
            console.error('Failed to load ship designer data:', err);
        }
    }

    openShipDesigner() {
        document.getElementById('shipDesignerModal').style.display = 'flex';
        this._sdSelectedHull = null;
        this._sdInstalledModules = [];
        document.getElementById('sdShipName').value = '';
        this.renderHullList();
        this.renderModuleList();
        this.updateShipPreview();
        this.renderInstalledModules();
    }

    openBlueprintsModal() {
        document.getElementById('blueprintsModal').style.display = 'flex';
        this.fetchBlueprints();
    }

    async fetchBlueprints() {
        // For observer mode, we'd need to pick an empire
        // For now, show a placeholder or let user select
        const container = document.getElementById('blueprintsList');
        if (!container) return;

        // Try to get blueprints from the first empire (observer mode)
        try {
            const stateRes = await fetch('/api/state');
            const state = await stateRes.json();
            const empires = state.empires || [];

            if (empires.length === 0) {
                container.innerHTML = '<p class="placeholder-text">No empires found.</p>';
                return;
            }

            const empireId = empires[0].id;
            const res = await fetch(`/api/empire/${empireId}/ships`);
            const data = await res.json();

            this.renderBlueprints(data.blueprints || [], empireId);
        } catch (err) {
            console.error('Failed to load blueprints:', err);
            container.innerHTML = '<p class="placeholder-text">Failed to load blueprints.</p>';
        }
    }

    renderBlueprints(blueprints, empireId) {
        const container = document.getElementById('blueprintsList');
        if (!container) return;

        if (blueprints.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No blueprints yet. Create one in the Ship Designer!</p>';
            return;
        }

        container.innerHTML = blueprints.map(bp => `
            <div class="blueprint-item" data-id="${bp.id}">
                <span class="blueprint-icon">${bp.icon || '🚀'}</span>
                <div class="blueprint-info">
                    <div class="blueprint-name">${bp.name}</div>
                    <div class="blueprint-hull">${bp.hullType} • Tier ${bp.tier}</div>
                    <div class="blueprint-stats">HP: ${bp.stats.hp} | ATK: ${bp.stats.attack} | SPD: ${bp.stats.speed}</div>
                </div>
                <div class="blueprint-actions">
                    <button class="blueprint-btn" onclick="alert('Build feature requires agent mode')">🔨 Build</button>
                </div>
            </div>
        `).join('');
    }

    renderHullList() {
        const container = document.getElementById('sdHullList');
        if (!container) return;

        const hulls = Object.entries(this._sdHulls);
        if (hulls.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 11px;">Loading...</p>';
            return;
        }

        // Sort by tier
        hulls.sort((a, b) => (a[1].tier || 1) - (b[1].tier || 1));

        container.innerHTML = hulls.map(([id, hull]) => `
            <div class="sd-hull-item ${this._sdSelectedHull === id ? 'selected' : ''} ${hull.available === false ? 'locked' : ''}" 
                 data-hull="${id}">
                <div class="hull-name">
                    <span>${hull.icon || '🚀'}</span>
                    <span>${hull.name}</span>
                    <span class="hull-tier">T${hull.tier || 1}</span>
                </div>
                <div class="hull-slots">${hull.totalSlots || 0} slots</div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.sd-hull-item').forEach(item => {
            item.addEventListener('click', () => {
                const hullId = item.dataset.hull;
                const hull = this._sdHulls[hullId];
                if (hull.available === false) return;

                this._sdSelectedHull = hullId;
                this._sdInstalledModules = [];

                // Update UI
                container.querySelectorAll('.sd-hull-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');

                this.updateShipPreview();
                this.renderInstalledModules();
                this.renderModuleList();
            });
        });
    }

    renderModuleList() {
        const container = document.getElementById('sdModuleList');
        if (!container) return;

        const moduleType = this._sdModuleTab;
        const hull = this._sdHulls[this._sdSelectedHull];

        // Filter modules by type
        const modules = Object.entries(this._sdModules)
            .filter(([id, mod]) => mod.type === moduleType)
            .sort((a, b) => (a[1].tier || 1) - (b[1].tier || 1));

        if (modules.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 11px;">No modules of this type.</p>';
            return;
        }

        // Calculate used slots
        const usedSlots = this.getUsedSlots();
        const maxSlots = hull?.slots?.[moduleType] || 0;
        const canAddMore = hull && usedSlots[moduleType] < maxSlots;

        container.innerHTML = modules.map(([id, mod]) => {
            const effectText = this.formatModuleEffect(mod.stats);
            const costText = Object.entries(mod.cost || {}).map(([r, v]) => `${v}${r.charAt(0)}`).join(' ');
            const isDisabled = !canAddMore || mod.available === false;

            return `
                <div class="sd-module-item ${isDisabled ? 'disabled' : ''} ${mod.available === false ? 'locked' : ''}" 
                     data-module="${id}">
                    <div class="module-name">
                        <span>${mod.icon || '⚙️'}</span>
                        <span>${mod.name}</span>
                        <span class="module-tier">T${mod.tier || 1}</span>
                    </div>
                    <div class="module-effect">${effectText}</div>
                    <div class="module-cost">${costText}</div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.sd-module-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', () => {
                const moduleId = item.dataset.module;
                this.addModule(moduleId);
            });
        });
    }

    addModule(moduleId) {
        const mod = this._sdModules[moduleId];
        const hull = this._sdHulls[this._sdSelectedHull];
        if (!mod || !hull) return;

        const usedSlots = this.getUsedSlots();
        const maxSlots = hull.slots?.[mod.type] || 0;

        if (usedSlots[mod.type] >= maxSlots) {
            console.log('No more slots for this module type');
            return;
        }

        this._sdInstalledModules.push(moduleId);
        this.updateShipPreview();
        this.renderInstalledModules();
        this.renderModuleList();
    }

    removeModule(index) {
        this._sdInstalledModules.splice(index, 1);
        this.updateShipPreview();
        this.renderInstalledModules();
        this.renderModuleList();
    }

    getUsedSlots() {
        const used = { weapon: 0, defense: 0, propulsion: 0, utility: 0 };
        this._sdInstalledModules.forEach(modId => {
            const mod = this._sdModules[modId];
            if (mod) used[mod.type] = (used[mod.type] || 0) + 1;
        });
        return used;
    }

    updateShipPreview() {
        const hull = this._sdHulls[this._sdSelectedHull];

        // Update icon
        document.getElementById('sdShipIcon').textContent = hull?.icon || '🚀';

        if (!hull) {
            document.getElementById('sdStatHp').textContent = '--';
            document.getElementById('sdStatAtk').textContent = '--';
            document.getElementById('sdStatSpd').textContent = '--';
            document.getElementById('sdStatRng').textContent = '--';
            document.getElementById('sdStatEva').textContent = '--';
            document.getElementById('sdSlotsW').textContent = '0/0';
            document.getElementById('sdSlotsD').textContent = '0/0';
            document.getElementById('sdSlotsP').textContent = '0/0';
            document.getElementById('sdSlotsU').textContent = '0/0';
            document.getElementById('sdCostValues').textContent = '--';
            return;
        }

        // Calculate stats
        const stats = { ...hull.baseStats };
        const cost = { ...hull.baseCost };

        this._sdInstalledModules.forEach(modId => {
            const mod = this._sdModules[modId];
            if (mod) {
                // Add module stats
                for (const [key, val] of Object.entries(mod.stats || {})) {
                    if (typeof val === 'number') {
                        stats[key] = (stats[key] || 0) + val;
                    }
                }
                // Add module cost
                for (const [key, val] of Object.entries(mod.cost || {})) {
                    cost[key] = (cost[key] || 0) + val;
                }
            }
        });

        // Update stats display
        document.getElementById('sdStatHp').textContent = Math.round(stats.hp || 0);
        document.getElementById('sdStatAtk').textContent = Math.round(stats.attack || 0);
        document.getElementById('sdStatSpd').textContent = (stats.speed || 0).toFixed(1);
        document.getElementById('sdStatRng').textContent = stats.range || 0;
        document.getElementById('sdStatEva').textContent = ((stats.evasion || 0) * 100).toFixed(0) + '%';

        // Update slots
        const used = this.getUsedSlots();
        const slots = hull.slots || {};
        document.getElementById('sdSlotsW').textContent = `${used.weapon}/${slots.weapon || 0}`;
        document.getElementById('sdSlotsD').textContent = `${used.defense}/${slots.defense || 0}`;
        document.getElementById('sdSlotsP').textContent = `${used.propulsion}/${slots.propulsion || 0}`;
        document.getElementById('sdSlotsU').textContent = `${used.utility}/${slots.utility || 0}`;

        // Update cost
        const costStr = Object.entries(cost)
            .filter(([k, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
        document.getElementById('sdCostValues').textContent = costStr || '--';
    }

    renderInstalledModules() {
        const container = document.getElementById('sdInstalledList');
        if (!container) return;

        if (this._sdInstalledModules.length === 0) {
            container.innerHTML = '<span style="color: #666; font-size: 10px;">Click modules to add</span>';
            return;
        }

        container.innerHTML = this._sdInstalledModules.map((modId, idx) => {
            const mod = this._sdModules[modId];
            return `<span class="sd-installed-module" data-index="${idx}">${mod?.icon || '⚙️'} ${mod?.name || modId}</span>`;
        }).join('');

        // Add click to remove
        container.querySelectorAll('.sd-installed-module').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                this.removeModule(idx);
            });
        });
    }

    formatModuleEffect(stats) {
        if (!stats) return '';
        const parts = [];
        if (stats.attack) parts.push(`+${stats.attack} ATK`);
        if (stats.hp) parts.push(`+${stats.hp} HP`);
        if (stats.speed) parts.push(`+${stats.speed} SPD`);
        if (stats.range) parts.push(`+${stats.range} RNG`);
        if (stats.evasion) parts.push(`+${(stats.evasion * 100).toFixed(0)}% EVA`);
        if (stats.shieldRegen) parts.push(`+${stats.shieldRegen} shield/s`);
        if (stats.damageReduction) parts.push(`-${(stats.damageReduction * 100).toFixed(0)}% dmg`);
        if (stats.warpSpeed) parts.push(`+${(stats.warpSpeed * 100).toFixed(0)}% warp`);
        if (stats.cargoCapacity) parts.push(`+${stats.cargoCapacity} cargo`);
        if (stats.vision) parts.push(`+${stats.vision} vision`);
        return parts.slice(0, 2).join(', ') || 'Various bonuses';
    }

    saveBlueprint() {
        const name = document.getElementById('sdShipName').value.trim();
        const hull = this._sdSelectedHull;

        if (!hull) {
            alert('Please select a hull first!');
            return;
        }

        if (!name) {
            alert('Please enter a ship name!');
            return;
        }

        // In observer mode, we can't actually save blueprints
        // This would require WebSocket connection as an agent
        alert(`Blueprint "${name}" designed!\n\nHull: ${this._sdHulls[hull].name}\nModules: ${this._sdInstalledModules.length}\n\nNote: To actually save and build ships, connect as an agent via WebSocket.`);

        console.log('Blueprint design:', {
            name,
            hullType: hull,
            modules: this._sdInstalledModules
        });
    }
}
