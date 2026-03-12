// ═══════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY MANAGER
// Colorblind modes and other accessibility features
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Color transformation matrices for different types of colorblindness
 * Based on research from colorblindness simulation algorithms
 * 
 * These matrices transform RGB colors to simulate/correct for:
 * - Protanopia (red-blind): ~1% of males
 * - Deuteranopia (green-blind): ~1% of males  
 * - Tritanopia (blue-blind): ~0.003% of population
 * - High Contrast: General accessibility improvement
 */
export const COLORBLIND_MODES = {
    none: {
        name: 'Normal',
        description: 'Standard colors',
        transform: null
    },
    protanopia: {
        name: 'Protanopia',
        description: 'Red-blind friendly (uses blue/yellow)',
        palette: {
            primary: '#0077BB',
            secondary: '#EE7733',
            tertiary: '#009988',
            quaternary: '#CC3311',
            accent: '#DDCC77',
            neutral: '#BBBBBB'
        }
    },
    deuteranopia: {
        name: 'Deuteranopia', 
        description: 'Green-blind friendly (uses blue/orange)',
        palette: {
            primary: '#332288',
            secondary: '#882255',
            tertiary: '#44AA99',
            quaternary: '#DDCC77',
            accent: '#CC6677',
            neutral: '#888888'
        }
    },
    tritanopia: {
        name: 'Tritanopia',
        description: 'Blue-blind friendly (uses red/green)',
        palette: {
            primary: '#CC0000',
            secondary: '#009900',
            tertiary: '#FF6600',
            quaternary: '#990099',
            accent: '#FFCC00',
            neutral: '#666666'
        }
    },
    highContrast: {
        name: 'High Contrast',
        description: 'Maximum contrast for visibility',
        palette: {
            primary: '#FFFFFF',
            secondary: '#FFFF00',
            tertiary: '#00FFFF',
            quaternary: '#FF00FF',
            accent: '#00FF00',
            neutral: '#888888'
        }
    }
};

// Pre-generated distinct colors for each mode (16 colors per mode)
// Optimized to be distinguishable within each colorblind type
const COLORBLIND_EMPIRE_PALETTES = {
    none: [
        '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', 
        '#F38181', '#AA96DA', '#FCBAD3', '#78DEC7',
        '#FF9A8B', '#88D8B0', '#FFEAA7', '#DDA0DD',
        '#87CEEB', '#F0E68C', '#98D8C8', '#FFB6C1'
    ],
    protanopia: [
        '#0077BB', '#33BBEE', '#EE7733', '#CCBB44',
        '#009988', '#EE3377', '#BBBBBB', '#000000',
        '#0099CC', '#44AA99', '#DDCC77', '#CC6677',
        '#117733', '#882255', '#999933', '#AA4499'
    ],
    deuteranopia: [
        '#332288', '#88CCEE', '#44AA99', '#117733',
        '#999933', '#DDCC77', '#CC6677', '#882255',
        '#0077BB', '#33BBEE', '#009988', '#EE7733',
        '#AA4499', '#BBBBBB', '#661100', '#6699CC'
    ],
    tritanopia: [
        '#CC0000', '#009900', '#FF6600', '#990099',
        '#FFCC00', '#00CCCC', '#FF0099', '#666666',
        '#FF3333', '#33CC33', '#FF9933', '#CC33CC',
        '#FFFF33', '#33CCCC', '#FF66CC', '#999999'
    ],
    highContrast: [
        '#FFFFFF', '#FFFF00', '#00FFFF', '#FF00FF',
        '#00FF00', '#FF8000', '#8080FF', '#FF0000',
        '#80FF00', '#0080FF', '#FF0080', '#00FF80',
        '#FFFF80', '#80FFFF', '#FF80FF', '#80FF80'
    ]
};

/**
 * Accessibility Manager - handles colorblind modes and other accessibility features
 */
export class AccessibilityManager {
    constructor() {
        this.currentMode = 'none';
        this.colorCache = new Map();
        this.loadSettings();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('clawdistan_accessibility');
            if (saved) {
                const settings = JSON.parse(saved);
                this.currentMode = settings.colorblindMode || 'none';
            }
        } catch (e) {
            console.warn('Failed to load accessibility settings:', e);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('clawdistan_accessibility', JSON.stringify({
                colorblindMode: this.currentMode
            }));
        } catch (e) {
            console.warn('Failed to save accessibility settings:', e);
        }
    }

    setColorblindMode(mode) {
        if (!COLORBLIND_MODES[mode]) {
            console.warn(`Unknown colorblind mode: ${mode}`);
            return;
        }
        this.currentMode = mode;
        this.colorCache.clear();
        this.saveSettings();
        
        window.dispatchEvent(new CustomEvent('accessibilityChanged', { 
            detail: { mode } 
        }));
        
        console.log(`Colorblind mode set to: ${COLORBLIND_MODES[mode].name}`);
    }

    getCurrentMode() {
        return {
            key: this.currentMode,
            ...COLORBLIND_MODES[this.currentMode]
        };
    }

    getModes() {
        return Object.entries(COLORBLIND_MODES).map(([key, mode]) => ({
            key,
            ...mode
        }));
    }

    transformColor(color, empireIndex = null) {
        if (this.currentMode === 'none') {
            return color;
        }

        if (empireIndex !== null) {
            const palette = COLORBLIND_EMPIRE_PALETTES[this.currentMode];
            return palette[empireIndex % palette.length];
        }

        const cacheKey = `${this.currentMode}_${color}`;
        if (this.colorCache.has(cacheKey)) {
            return this.colorCache.get(cacheKey);
        }

        const transformed = this._simulateColorblindness(color);
        this.colorCache.set(cacheKey, transformed);
        return transformed;
    }

    getEmpireColors(empires) {
        const colors = new Map();
        const palette = COLORBLIND_EMPIRE_PALETTES[this.currentMode];
        
        empires.forEach((empire, index) => {
            if (this.currentMode === 'none') {
                colors.set(empire.id, empire.color);
            } else {
                colors.set(empire.id, palette[index % palette.length]);
            }
        });
        
        return colors;
    }

    _simulateColorblindness(hexColor) {
        const rgb = this._hexToRgb(hexColor);
        if (!rgb) return hexColor;

        let transformed;
        switch (this.currentMode) {
            case 'protanopia':
                transformed = this._applyProtanopia(rgb);
                break;
            case 'deuteranopia':
                transformed = this._applyDeuteranopia(rgb);
                break;
            case 'tritanopia':
                transformed = this._applyTritanopia(rgb);
                break;
            case 'highContrast':
                transformed = this._applyHighContrast(rgb);
                break;
            default:
                return hexColor;
        }

        return this._rgbToHex(transformed);
    }

    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    _rgbToHex({ r, g, b }) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    _applyProtanopia({ r, g, b }) {
        return {
            r: 0.567 * r + 0.433 * g + 0.0 * b,
            g: 0.558 * r + 0.442 * g + 0.0 * b,
            b: 0.0 * r + 0.242 * g + 0.758 * b
        };
    }

    _applyDeuteranopia({ r, g, b }) {
        return {
            r: 0.625 * r + 0.375 * g + 0.0 * b,
            g: 0.7 * r + 0.3 * g + 0.0 * b,
            b: 0.0 * r + 0.3 * g + 0.7 * b
        };
    }

    _applyTritanopia({ r, g, b }) {
        return {
            r: 0.95 * r + 0.05 * g + 0.0 * b,
            g: 0.0 * r + 0.433 * g + 0.567 * b,
            b: 0.0 * r + 0.475 * g + 0.525 * b
        };
    }

    _applyHighContrast({ r, g, b }) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (lum > 128) {
            return {
                r: Math.min(255, r * 1.3),
                g: Math.min(255, g * 1.3),
                b: Math.min(255, b * 1.3)
            };
        } else {
            const max = Math.max(r, g, b);
            const factor = max > 0 ? 200 / max : 1;
            return {
                r: Math.min(255, r * factor),
                g: Math.min(255, g * factor),
                b: Math.min(255, b * factor)
            };
        }
    }
}

export const accessibility = new AccessibilityManager();
