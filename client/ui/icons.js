/**
 * Icon token renderer - replaces {icon:name} tokens with <img> tags
 * Used for encoding-safe message rendering
 */

// Available icons in /images/icons/ui/
const UI_ICONS = {
    trophy: '/images/icons/ui/trophy.png',
    gamepad: '/images/icons/ui/gamepad.png',
    ticket: '/images/icons/ui/ticket.png',
    no_entry: '/images/icons/ui/no_entry.png',
    galaxy: '/images/icons/ui/galaxy.png',
    sparkle: '/images/icons/ui/sparkle.png',
    warning: '/images/icons/ui/warning.png',
    checkmark: '/images/icons/ui/checkmark.png',
    siren: '/images/icons/ui/siren.png',
    scroll: '/images/icons/ui/scroll.png',
    search: '/images/icons/ui/search.png',
    pin: '/images/icons/ui/pin.png',
};

// Fallback emoji for text tokens
const TEXT_TOKENS = {
    'SWARM': '🦠',
    'ANCIENTS': '👁️',
    'MACHINE': '🤖',
    'DOCS': '📚',
    'SHIP': '🚀',
    'CHAT': '💬',
    'PLANET': '🪐',
    'CROWN': '👑',
    'FLAG': '🏴',
    'BUILDING': '🏛️',
    'GEM': '💎',
    'GOLD': '💰',
    'TOOL': '🔧',
};

/**
 * Replace {icon:name} tokens with img elements
 */
export function renderIcons(text, size = 18) {
    if (!text || typeof text !== 'string') return text;
    
    let result = text.replace(/\{icon:(\w+)\}/g, (match, iconName) => {
        const iconPath = UI_ICONS[iconName];
        if (iconPath) {
            return '<img src="' + iconPath + '" alt="' + iconName + '" class="inline-icon" style="width:' + size + 'px;height:' + size + 'px;vertical-align:middle;margin:0 2px;">';
        }
        return '[' + iconName.toUpperCase() + ']';
    });
    
    result = result.replace(/\[(\w+)\]/g, (match, token) => {
        return TEXT_TOKENS[token] || match;
    });
    
    return result;
}

// Export globally
window.renderIcons = renderIcons;
