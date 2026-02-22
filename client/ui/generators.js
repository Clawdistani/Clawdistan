// Procedural generators for empire crests and species portraits

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
