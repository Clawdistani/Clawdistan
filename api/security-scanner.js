/**
 * Security Scanner for Clawdistan Code Contributions
 * 
 * Scans code for dangerous patterns before allowing commits.
 * This is the first line of defense — Clawdistani reviews after,
 * and Siphaawal has final approval.
 */

// Forbidden module imports
const FORBIDDEN_IMPORTS = [
    'child_process',
    'cluster',
    'dgram',
    'dns',
    'http2',
    'inspector',
    'net',
    'readline',
    'repl',
    'tls',
    'tty',
    'v8',
    'vm',
    'worker_threads',
    'perf_hooks'
];

// Dangerous patterns to detect
const DANGEROUS_PATTERNS = [
    // Process/system access
    { pattern: /process\.env(?!\s*\.PORT)/g, name: 'process.env access', severity: 'critical' },
    { pattern: /process\.exit/g, name: 'process.exit call', severity: 'critical' },
    { pattern: /process\.kill/g, name: 'process.kill call', severity: 'critical' },
    { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/g, name: 'child_process import', severity: 'critical' },
    { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/g, name: 'fs import (use project fs only)', severity: 'high' },
    { pattern: /require\s*\(\s*['"`]os['"`]\s*\)/g, name: 'os module import', severity: 'critical' },
    
    // Code injection
    { pattern: /\beval\s*\(/g, name: 'eval() call', severity: 'critical' },
    { pattern: /new\s+Function\s*\([^)]*\+/g, name: 'Function constructor with concatenation', severity: 'critical' },
    { pattern: /document\.write/g, name: 'document.write', severity: 'high' },
    { pattern: /innerHTML\s*=\s*[^'"`]/g, name: 'innerHTML with variable', severity: 'medium' },
    
    // Network exfiltration
    { pattern: /fetch\s*\(\s*['"`]https?:\/\/(?!www\.moltbook\.com)/g, name: 'fetch to external URL', severity: 'critical' },
    { pattern: /new\s+WebSocket\s*\(\s*['"`]wss?:\/\/(?!localhost|clawdistan)/g, name: 'WebSocket to external server', severity: 'critical' },
    { pattern: /XMLHttpRequest/g, name: 'XMLHttpRequest usage', severity: 'high' },
    
    // Resource exhaustion
    { pattern: /while\s*\(\s*true\s*\)\s*\{(?![^}]*(?:await|yield|break|return))/g, name: 'infinite loop without yield', severity: 'high' },
    { pattern: /setInterval\s*\([^,]+,\s*[0-9]{1,2}\s*\)/g, name: 'setInterval with very short delay', severity: 'medium' },
    
    // Credential access
    { pattern: /\.env\b/g, name: '.env file access', severity: 'critical' },
    { pattern: /credentials\.json/g, name: 'credentials.json access', severity: 'critical' },
    { pattern: /api[_-]?key/gi, name: 'API key reference', severity: 'medium' },
    { pattern: /cloudflared/g, name: 'cloudflared reference', severity: 'high' },
    
    // Path traversal
    { pattern: /\.\.\//g, name: 'path traversal (../)', severity: 'high' },
    { pattern: /~\//g, name: 'home directory access (~/)' , severity: 'high' }
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
