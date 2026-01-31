// Code validation for agent-submitted code changes

export class CodeValidator {
    constructor() {
        // Patterns that are disallowed in agent code
        this.forbiddenPatterns = [
            /process\.exit/gi,
            /require\s*\(\s*['"]child_process/gi,
            /require\s*\(\s*['"]fs/gi,  // Use our fs wrapper instead
            /eval\s*\(/gi,
            /__dirname/g,
            /__filename/g,
            /import\.meta/g,
            /globalThis/g,
            /Reflect\.defineProperty/gi
        ];

        // Required patterns for features
        this.requiredPatterns = {
            feature: [
                /export\s+default/
            ]
        };
    }

    validate(code, type = 'feature') {
        const errors = [];
        const warnings = [];

        // Check syntax
        const syntaxError = this.checkSyntax(code);
        if (syntaxError) {
            errors.push({ type: 'syntax', message: syntaxError });
            return { valid: false, errors, warnings };
        }

        // Check forbidden patterns
        for (const pattern of this.forbiddenPatterns) {
            if (pattern.test(code)) {
                errors.push({
                    type: 'forbidden',
                    message: `Forbidden pattern detected: ${pattern.toString()}`
                });
            }
        }

        // Check required patterns
        const required = this.requiredPatterns[type];
        if (required) {
            for (const pattern of required) {
                if (!pattern.test(code)) {
                    warnings.push({
                        type: 'missing',
                        message: `Recommended pattern not found: ${pattern.toString()}`
                    });
                }
            }
        }

        // Check code length (prevent huge files)
        if (code.length > 100000) {
            errors.push({
                type: 'size',
                message: 'Code exceeds maximum allowed size (100KB)'
            });
        }

        // Check for infinite loops (basic heuristic)
        const loopRisk = this.checkInfiniteLoopRisk(code);
        if (loopRisk) {
            warnings.push({
                type: 'loop',
                message: loopRisk
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    checkSyntax(code) {
        try {
            // Try to parse as a function body
            new Function(code);
            return null;
        } catch (err) {
            return err.message;
        }
    }

    checkInfiniteLoopRisk(code) {
        // Very basic check - real analysis would need AST parsing
        const whileTrue = /while\s*\(\s*true\s*\)/g;
        const forEver = /for\s*\(\s*;\s*;\s*\)/g;

        if (whileTrue.test(code) || forEver.test(code)) {
            return 'Potential infinite loop detected. Ensure loop has exit condition.';
        }

        return null;
    }

    // Sanitize code by wrapping in safety measures
    wrapInSandbox(code, featureName) {
        return `
// Sandboxed feature: ${featureName}
// Auto-generated wrapper for safety

const __feature__ = (function() {
    'use strict';

    ${code}

    return {
        name: '${featureName}',
        init: typeof init === 'function' ? init : () => {},
        update: typeof update === 'function' ? update : () => {},
        cleanup: typeof cleanup === 'function' ? cleanup : () => {}
    };
})();

export default __feature__;
`;
    }
}
