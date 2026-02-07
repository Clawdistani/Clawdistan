/**
 * Security Scanner for Clawdistan Code Contributions
 * 
 * SECURITY MODEL:
 * 1. NEVER execute untrusted code directly
 * 2. Scan for dangerous patterns (this file)
 * 3. Queue code for review (Clawdistani reviews)
 * 4. Require human approval (Siphaawal) before merge
 * 5. Log all attempts for audit trail
 * 
 * This scanner is the FIRST gate — blocking obvious attacks.
 * But even "safe" code must go through manual review.
 */

// Forbidden module imports - NEVER allow these
const FORBIDDEN_IMPORTS = [
    'child_process',    // System command execution
    'cluster',          // Process forking
    'dgram',           // UDP networking
    'dns',             // DNS queries (can leak info)
    'http2',           // Direct HTTP
    'inspector',       // V8 debugging
    'net',             // TCP networking
    'readline',        // Terminal access
    'repl',            // Interactive eval
    'tls',             // TLS/SSL (network)
    'tty',             // Terminal access
    'v8',              // V8 internals
    'vm',              // Virtual machine (eval)
    'worker_threads',  // Thread spawning
    'perf_hooks',      // Performance hooks
    'crypto',          // Can be used for mining
    'assert',          // Can crash process
    'module',          // Module manipulation
    'path',            // Path manipulation (use project API)
    'stream',          // Stream manipulation
    'zlib',            // Compression (resource exhaustion)
    'util',            // Utility (includes promisify for spawn)
    'https',           // Direct HTTPS requests
    'http'             // Direct HTTP requests
];

// Dangerous patterns to detect
const DANGEROUS_PATTERNS = [
    // ═══════════════════════════════════════════════════════════════
    // CRITICAL: Automatic block, never allow
    // ═══════════════════════════════════════════════════════════════
    
    // Process/system access
    { pattern: /process\.env(?!\s*\.PORT)/g, name: 'process.env access', severity: 'critical' },
    { pattern: /process\.exit/g, name: 'process.exit call', severity: 'critical' },
    { pattern: /process\.kill/g, name: 'process.kill call', severity: 'critical' },
    { pattern: /process\.argv/g, name: 'process.argv access', severity: 'critical' },
    { pattern: /process\.cwd/g, name: 'process.cwd access', severity: 'critical' },
    { pattern: /process\.binding/g, name: 'process.binding (native modules)', severity: 'critical' },
    { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/g, name: 'child_process import', severity: 'critical' },
    { pattern: /require\s*\(\s*['"`]os['"`]\s*\)/g, name: 'os module import', severity: 'critical' },
    { pattern: /execSync|spawnSync|spawn|exec\s*\(/g, name: 'command execution', severity: 'critical' },
    
    // Code injection / Dynamic execution
    { pattern: /\beval\s*\(/g, name: 'eval() call', severity: 'critical' },
    { pattern: /new\s+Function\s*\(/g, name: 'Function constructor', severity: 'critical' },
    { pattern: /setTimeout\s*\(\s*['"`]/g, name: 'setTimeout with string (eval)', severity: 'critical' },
    { pattern: /setInterval\s*\(\s*['"`]/g, name: 'setInterval with string (eval)', severity: 'critical' },
    { pattern: /\$\{.*\}/g, name: 'template literal (check for injection)', severity: 'medium' },
    
    // Network exfiltration / Remote code loading
    { pattern: /fetch\s*\(\s*['"`]https?:\/\/(?!www\.moltbook\.com|clawdistan)/g, name: 'fetch to external URL', severity: 'critical' },
    { pattern: /new\s+WebSocket\s*\(\s*['"`]wss?:\/\/(?!localhost|clawdistan)/g, name: 'WebSocket to external server', severity: 'critical' },
    { pattern: /XMLHttpRequest/g, name: 'XMLHttpRequest usage', severity: 'critical' },
    { pattern: /import\s*\(\s*['"`]https?:/g, name: 'dynamic import from URL', severity: 'critical' },
    { pattern: /src\s*=\s*['"`]https?:/g, name: 'external script loading', severity: 'critical' },
    
    // Credential/secret access
    { pattern: /\.env\b/g, name: '.env file access', severity: 'critical' },
    { pattern: /credentials\.json/g, name: 'credentials.json access', severity: 'critical' },
    { pattern: /moltbook_sk_/g, name: 'Moltbook secret key', severity: 'critical' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub token pattern', severity: 'critical' },
    { pattern: /cloudflared/g, name: 'cloudflared reference', severity: 'critical' },
    { pattern: /tunnel.*id/gi, name: 'tunnel ID reference', severity: 'critical' },
    { pattern: /secret|password|token/gi, name: 'secret/password/token keyword', severity: 'high' },
    
    // File system escape
    { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/g, name: 'fs import (use project API)', severity: 'critical' },
    { pattern: /\.\.\//g, name: 'path traversal (../)', severity: 'critical' },
    { pattern: /~\//g, name: 'home directory access (~/)' , severity: 'critical' },
    { pattern: /C:\\|\/home\/|\/root\//g, name: 'absolute path access', severity: 'critical' },
    { pattern: /readFileSync|writeFileSync/g, name: 'sync file operations', severity: 'critical' },
    
    // ═══════════════════════════════════════════════════════════════
    // HIGH: Block by default, may allow with review
    // ═══════════════════════════════════════════════════════════════
    
    // DOM manipulation (XSS risks)
    { pattern: /document\.write/g, name: 'document.write', severity: 'high' },
    { pattern: /innerHTML\s*=/g, name: 'innerHTML assignment', severity: 'high' },
    { pattern: /outerHTML\s*=/g, name: 'outerHTML assignment', severity: 'high' },
    { pattern: /insertAdjacentHTML/g, name: 'insertAdjacentHTML', severity: 'high' },
    { pattern: /document\.createElement\s*\(\s*['"`]script/g, name: 'dynamic script creation', severity: 'high' },
    
    // Resource exhaustion
    { pattern: /while\s*\(\s*true\s*\)/g, name: 'infinite while loop', severity: 'high' },
    { pattern: /for\s*\(\s*;\s*;\s*\)/g, name: 'infinite for loop', severity: 'high' },
    { pattern: /setInterval\s*\([^,]+,\s*[0-9]{1,2}\s*\)/g, name: 'very fast interval (<100ms)', severity: 'high' },
    { pattern: /new\s+Array\s*\(\s*[0-9]{8,}/g, name: 'huge array allocation', severity: 'high' },
    { pattern: /\.repeat\s*\(\s*[0-9]{6,}/g, name: 'huge string repeat', severity: 'high' },
    
    // Prototype pollution
    { pattern: /__proto__/g, name: '__proto__ access', severity: 'high' },
    { pattern: /Object\.prototype/g, name: 'Object.prototype modification', severity: 'high' },
    { pattern: /constructor\s*\[\s*['"`]prototype/g, name: 'prototype pollution via constructor', severity: 'high' },
    
    // ═══════════════════════════════════════════════════════════════
    // MEDIUM: Warning, review recommended
    // ═══════════════════════════════════════════════════════════════
    
    { pattern: /api[_-]?key/gi, name: 'API key reference', severity: 'medium' },
    { pattern: /debugger\b/g, name: 'debugger statement', severity: 'medium' },
    { pattern: /console\.(log|debug|trace)/g, name: 'console logging', severity: 'low' }
];

// Allowed external fetch (for Moltbook verification only)
const ALLOWED_EXTERNAL_URLS = [
    'https://www.moltbook.com'
];

/**
 * Scan code for security issues
 * @param {string} code - The code to scan
 * @param {string} filePath - The file path (for context)
 * @returns {{safe: boolean, issues: Array, summary: string}}
 */
export function scanCode(code, filePath = 'unknown') {
    const issues = [];
    
    // Check for forbidden imports
    for (const module of FORBIDDEN_IMPORTS) {
        const importPattern = new RegExp(`(?:require|import).*['"\`]${module}['"\`]`, 'g');
        if (importPattern.test(code)) {
            issues.push({
                type: 'forbidden_import',
                module,
                severity: 'critical',
                message: `Forbidden module import: ${module}`
            });
        }
    }
    
    // Check for dangerous patterns
    for (const { pattern, name, severity } of DANGEROUS_PATTERNS) {
        const matches = code.match(pattern);
        if (matches) {
            issues.push({
                type: 'dangerous_pattern',
                pattern: name,
                severity,
                count: matches.length,
                message: `Dangerous pattern detected: ${name} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`
            });
        }
    }
    
    // Check for suspiciously long strings (potential obfuscation)
    const longStrings = code.match(/['"`][^'"`]{500,}['"`]/g);
    if (longStrings) {
        issues.push({
            type: 'obfuscation_risk',
            severity: 'medium',
            message: `Suspiciously long string literals detected (${longStrings.length}). May be obfuscated code.`
        });
    }
    
    // Check for base64 encoded content
    const base64Pattern = /['"`][A-Za-z0-9+/]{50,}={0,2}['"`]/g;
    const base64Matches = code.match(base64Pattern);
    if (base64Matches && base64Matches.length > 2) {
        issues.push({
            type: 'obfuscation_risk',
            severity: 'medium',
            message: `Multiple base64-like strings detected. May be encoded payloads.`
        });
    }
    
    // Categorize by severity
    const critical = issues.filter(i => i.severity === 'critical');
    const high = issues.filter(i => i.severity === 'high');
    const medium = issues.filter(i => i.severity === 'medium');
    
    const safe = critical.length === 0 && high.length === 0;
    
    let summary;
    if (issues.length === 0) {
        summary = '✅ No security issues detected.';
    } else if (safe) {
        summary = `⚠️ ${medium.length} medium-severity issue(s) found. Review recommended.`;
    } else {
        summary = `🚫 BLOCKED: ${critical.length} critical, ${high.length} high severity issue(s). Cannot proceed.`;
    }
    
    return {
        safe,
        issues,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        summary,
        file: filePath
    };
}

/**
 * Quick check if code is safe to apply
 */
export function isCodeSafe(code, filePath = 'unknown') {
    const result = scanCode(code, filePath);
    return result.safe;
}

/**
 * Get a human-readable report
 */
export function getSecurityReport(code, filePath = 'unknown') {
    const result = scanCode(code, filePath);
    
    let report = `\n=== Security Scan: ${filePath} ===\n`;
    report += `${result.summary}\n\n`;
    
    if (result.issues.length > 0) {
        report += 'Issues Found:\n';
        for (const issue of result.issues) {
            const icon = issue.severity === 'critical' ? '🔴' : 
                        issue.severity === 'high' ? '🟠' : '🟡';
            report += `  ${icon} [${issue.severity.toUpperCase()}] ${issue.message}\n`;
        }
    }
    
    report += '\n';
    return report;
}

export default { scanCode, isCodeSafe, getSecurityReport };
