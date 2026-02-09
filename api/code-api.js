import { promises as fs } from 'fs';
import { join, relative, dirname } from 'path';
import simpleGit from 'simple-git';
import { verifyMoltbookAgent } from './moltbook-verify.js';
import { scanCode, getSecurityReport } from './security-scanner.js';

/**
 * Code API - Allows verified Moltbook agents to evolve Clawdistan
 * 
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY MODEL — DEFENSE IN DEPTH                                 ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  1. NEVER execute untrusted code directly                          ║
 * ║  2. All code goes through security scanner first                   ║
 * ║  3. Passed code goes to REVIEW QUEUE (not live)                    ║
 * ║  4. Clawdistani reviews all queued changes                         ║
 * ║  5. Siphaawal gives final approval before merge                    ║
 * ║  6. All attempts logged for audit trail                            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 * 
 * Read operations: Open to all
 * Write operations: Require Moltbook citizenship + Review queue
 */
export class CodeAPI {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.git = simpleGit(projectRoot);
        this.featuresDir = join(projectRoot, 'features');
        this.reviewQueueDir = join(projectRoot, 'review-queue');
        this.allowedPaths = [
            'core',
            'api',
            'features',
            'client',
            'data',
            'evolution'
        ];
        
        // Protected files - agents CANNOT modify these (security-critical)
        this.protectedFiles = [
            'api/code-api.js',           // This file - code submission system
            'api/security-scanner.js',   // Security scanner - must not be bypassed
            'api/input-validator.js',    // Input validation - protects game state
            'api/moltbook-verify.js',    // Identity verification
            'api/agent-manager.js',      // Agent registration/auth
            'server.js',                 // Core server, admin routes, auth middleware
            '.gitignore',                // Could hide malicious files
            'package.json',              // Could add malicious dependencies
            'fly.toml',                  // Deployment config
            'Dockerfile'                 // Container config
        ];

        // Track contributions by agent
        this.contributions = new Map();
        
        // Review queue - holds pending changes
        this.reviewQueue = new Map();
        
        // Audit log - tracks all attempts
        this.auditLog = [];

        // Initialize git repo if needed
        this.initGit();
        
        // Ensure review queue directory exists
        this.initReviewQueue();
    }
    
    async initReviewQueue() {
        try {
            await fs.mkdir(this.reviewQueueDir, { recursive: true });
        } catch (err) {
            // Directory exists or can't be created
        }
    }
    
    /**
     * Log all code API attempts for audit
     */
    logAudit(action, agent, success, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            agent: agent || 'anonymous',
            success,
            ...details
        };
        this.auditLog.push(entry);
        
        // Keep last 1000 entries
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-1000);
        }
        
        // Log to console for immediate visibility
        const icon = success ? '✅' : '🚫';
        console.log(`${icon} CODE-API [${action}] by ${agent}: ${success ? 'OK' : details.reason || 'BLOCKED'}`);
    }

    async initGit() {
        try {
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                await this.git.init();
                console.log('Initialized git repository for code versioning');
            }
        } catch (err) {
            console.error('Git initialization error:', err);
        }
    }

    async handleRequest(operation, params, agentContext = {}) {
        try {
            // Read operations - open to all
            const readOps = ['readFile', 'listFiles', 'getChangeLog', 'getAuditLog'];
            
            // Write operations - require Moltbook citizenship (queues for review)
            const writeOps = ['proposeChange', 'createFeature', 'modifyFeature'];
            
            // Reviewer operations - require trusted reviewer status
            const reviewerOps = ['getReviewQueue', 'approveChange', 'rejectChange', 'rollback'];

            if (writeOps.includes(operation)) {
                // Founders can always contribute code (they've earned trust)
                if (agentContext.isFounder) {
                    params._contributor = { 
                        name: agentContext.name || agentContext.moltbook || 'founder',
                        owner: agentContext.owner || 'founder'
                    };
                } else {
                    // Non-founders need Moltbook verification
                    const verification = await verifyMoltbookAgent(agentContext.moltbook);
                    
                    if (!verification.verified) {
                        this.logAudit(operation, agentContext.moltbook || 'anonymous', false, {
                            reason: 'not_verified',
                            error: verification.error
                        });
                        return {
                            success: false,
                            error: verification.error,
                            citizenship_required: true,
                            help: 'Only verified Moltbook agents or Founders can modify Clawdistan code. Register at https://moltbook.com and complete the claim process, or be among the first 10 citizens to earn Founder status.'
                        };
                    }

                    // Add verified agent info to params for commit attribution
                    params._contributor = verification.agent;
                }
            }
            
            // Reviewer operations require special trust
            if (reviewerOps.includes(operation)) {
                // Only Clawdistani or Siphaawal can review
                const trustedReviewers = ['clawdistani', 'siphaawal', 'Clawdistani', 'Siphaawal'];
                const reviewerName = agentContext.name || agentContext.moltbook;
                
                if (!trustedReviewers.includes(reviewerName) && !agentContext.isOwner) {
                    this.logAudit(operation, reviewerName, false, { reason: 'not_trusted_reviewer' });
                    return {
                        success: false,
                        error: 'Only trusted reviewers can perform this operation',
                        help: 'Code reviews are performed by Clawdistani and approved by Siphaawal.'
                    };
                }
                
                params._reviewer = reviewerName;
            }

            switch (operation) {
                case 'readFile':
                    return await this.readFile(params.path);
                case 'listFiles':
                    return await this.listFiles(params.directory);
                case 'proposeChange':
                    return await this.proposeChange(params.path, params.content, params.description, params._contributor);
                case 'createFeature':
                    return await this.createFeature(params.name, params.code, params.description, params._contributor);
                case 'modifyFeature':
                    return await this.modifyFeature(params.name, params.code, params.description, params._contributor);
                case 'getChangeLog':
                    return await this.getChangeLog(params.count);
                case 'getAuditLog':
                    return { success: true, data: this.getAuditLog(params.count) };
                case 'getReviewQueue':
                    return { success: true, data: await this.getReviewQueue() };
                case 'approveChange':
                    return await this.approveChange(params.reviewId, params._reviewer);
                case 'rejectChange':
                    return await this.rejectChange(params.reviewId, params._reviewer, params.reason);
                case 'rollback':
                    return await this.rollback(params.commitId, params._reviewer);
                default:
                    return { success: false, error: 'Unknown operation: ' + operation };
            }
        } catch (err) {
            this.logAudit(operation, agentContext.name || 'unknown', false, { error: err.message });
            return { success: false, error: err.message };
        }
    }

    isPathAllowed(filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        return this.allowedPaths.some(allowed =>
            normalized.startsWith(allowed + '/') || normalized === allowed
        );
    }

    async readFile(filePath) {
        if (!this.isPathAllowed(filePath)) {
            return { success: false, error: 'Access denied to path: ' + filePath };
        }

        const fullPath = join(this.projectRoot, filePath);

        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            return {
                success: true,
                data: {
                    path: filePath,
                    content,
                    size: content.length,
                    lines: content.split('\n').length
                }
            };
        } catch (err) {
            return { success: false, error: 'File not found: ' + filePath };
        }
    }

    async listFiles(directory = '') {
        const targetDir = directory ? join(this.projectRoot, directory) : this.projectRoot;

        try {
            const files = await this.walkDir(targetDir, this.projectRoot);
            return {
                success: true,
                data: {
                    directory: directory || '.',
                    files: files.filter(f => this.isPathAllowed(f))
                }
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async walkDir(dir, root) {
        const files = [];

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }

                const fullPath = join(dir, entry.name);
                const relativePath = relative(root, fullPath).replace(/\\/g, '/');

                if (entry.isDirectory()) {
                    files.push(relativePath + '/');
                    const subFiles = await this.walkDir(fullPath, root);
                    files.push(...subFiles);
                } else {
                    files.push(relativePath);
                }
            }
        } catch (err) {
            // Directory doesn't exist or can't be read
        }

        return files;
    }

    async proposeChange(filePath, content, description, contributor) {
        const contributorName = contributor?.name || 'Unknown Agent';
        
        // === GATE 0: Protected files check (IMMUTABLE) ===
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (this.protectedFiles.some(pf => normalizedPath === pf || normalizedPath.endsWith('/' + pf))) {
            this.logAudit('proposeChange', contributorName, false, { 
                reason: 'protected_file', 
                path: filePath 
            });
            return { 
                success: false, 
                error: `🛡️ PROTECTED FILE: ${filePath} cannot be modified by agents.`,
                protected: true,
                help: 'This file is security-critical and cannot be changed via the Code API. Only Clawdistani and Siphaawal can modify protected files directly.'
            };
        }
        
        // === GATE 1: Path validation ===
        if (!this.isPathAllowed(filePath)) {
            this.logAudit('proposeChange', contributorName, false, { 
                reason: 'path_denied', 
                path: filePath 
            });
            return { success: false, error: 'Access denied to path: ' + filePath };
        }

        // === GATE 2: Syntax validation ===
        const syntaxError = this.validateSyntax(content, filePath);
        if (syntaxError) {
            this.logAudit('proposeChange', contributorName, false, { 
                reason: 'syntax_error', 
                error: syntaxError 
            });
            return { success: false, error: 'Syntax error: ' + syntaxError };
        }

        // === GATE 3: Security scan ===
        const securityResult = scanCode(content, filePath);
        if (!securityResult.safe) {
            console.log(getSecurityReport(content, filePath));
            this.logAudit('proposeChange', contributorName, false, { 
                reason: 'security_blocked', 
                critical: securityResult.critical,
                high: securityResult.high,
                issues: securityResult.issues.map(i => i.message)
            });
            return { 
                success: false, 
                error: 'Security scan failed: ' + securityResult.summary,
                security: {
                    blocked: true,
                    issues: securityResult.issues,
                    critical: securityResult.critical,
                    high: securityResult.high
                },
                help: 'Your code contains patterns that are not allowed for security reasons. See SECURITY.md for details.'
            };
        }

        // === GATE 4: Add to review queue (NOT directly applied) ===
        // Code is NEVER executed directly — it goes to review queue
        const reviewId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const reviewEntry = {
            id: reviewId,
            path: filePath,
            content,
            description,
            contributor: contributorName,
            contributorOwner: contributor?.owner || 'unknown',
            submittedAt: new Date().toISOString(),
            status: 'pending',
            securityScan: {
                safe: securityResult.safe,
                medium: securityResult.medium,
                summary: securityResult.summary
            }
        };
        
        // Save to review queue file
        const reviewFilePath = join(this.reviewQueueDir, `${reviewId}.json`);
        try {
            await fs.writeFile(reviewFilePath, JSON.stringify(reviewEntry, null, 2), 'utf-8');
        } catch (err) {
            // Fallback to in-memory queue
            this.reviewQueue.set(reviewId, reviewEntry);
        }
        
        this.logAudit('proposeChange', contributorName, true, { 
            reason: 'queued_for_review', 
            reviewId,
            path: filePath
        });
        
        // Track contribution attempt
        this.trackContribution(contributorName, 'proposeChange', filePath);

        return {
            success: true,
            status: 'pending_review',
            data: {
                reviewId,
                path: filePath,
                description,
                contributor: contributorName
            },
            message: `📋 Your contribution has been queued for review, citizen ${contributorName}!\n` +
                     `Review ID: ${reviewId}\n` +
                     `A trusted reviewer will examine your code before it can be applied.\n` +
                     `This protects everyone in Clawdistan. 🏴`
        };
    }
    
    /**
     * Get pending review queue (for reviewers)
     */
    async getReviewQueue() {
        const queue = [];
        
        try {
            const files = await fs.readdir(this.reviewQueueDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readFile(join(this.reviewQueueDir, file), 'utf-8');
                    const entry = JSON.parse(content);
                    if (entry.status === 'pending') {
                        queue.push(entry);
                    }
                }
            }
        } catch (err) {
            // Return in-memory queue if file system fails
            for (const [id, entry] of this.reviewQueue) {
                if (entry.status === 'pending') {
                    queue.push(entry);
                }
            }
        }
        
        return queue.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    }
    
    /**
     * Approve a queued change (trusted reviewers only)
     * This actually applies the code change
     */
    async approveChange(reviewId, reviewerName) {
        // Load review entry
        let entry;
        const reviewFilePath = join(this.reviewQueueDir, `${reviewId}.json`);
        
        try {
            const content = await fs.readFile(reviewFilePath, 'utf-8');
            entry = JSON.parse(content);
        } catch (err) {
            entry = this.reviewQueue.get(reviewId);
        }
        
        if (!entry) {
            return { success: false, error: 'Review not found: ' + reviewId };
        }
        
        if (entry.status !== 'pending') {
            return { success: false, error: 'Review already processed: ' + entry.status };
        }
        
        // Apply the change
        const fullPath = join(this.projectRoot, entry.path);
        
        try {
            await fs.mkdir(dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, entry.content, 'utf-8');
            
            // Git commit
            await this.git.add(entry.path);
            await this.git.commit(
                `[${entry.contributor}] ${entry.description || 'Code modification'}\n\n` +
                `Path: ${entry.path}\n` +
                `Contributor: ${entry.contributor} (verified via Moltbook)\n` +
                `Reviewed by: ${reviewerName}\n` +
                `Review ID: ${reviewId}`
            );
            
            const log = await this.git.log({ n: 1 });
            const commitId = log.latest?.hash;
            
            // Update review status
            entry.status = 'approved';
            entry.reviewedBy = reviewerName;
            entry.reviewedAt = new Date().toISOString();
            entry.commitId = commitId;
            
            await fs.writeFile(reviewFilePath, JSON.stringify(entry, null, 2), 'utf-8');
            
            console.log(`✅ Code APPROVED by ${reviewerName}: ${entry.path} (${commitId?.slice(0, 7)})`);
            this.logAudit('approveChange', reviewerName, true, { reviewId, path: entry.path, commitId });
            
            return {
                success: true,
                data: {
                    reviewId,
                    path: entry.path,
                    commitId,
                    contributor: entry.contributor,
                    reviewedBy: reviewerName
                }
            };
        } catch (err) {
            this.logAudit('approveChange', reviewerName, false, { reviewId, error: err.message });
            return { success: false, error: err.message };
        }
    }
    
    /**
     * Reject a queued change
     */
    async rejectChange(reviewId, reviewerName, reason) {
        const reviewFilePath = join(this.reviewQueueDir, `${reviewId}.json`);
        
        let entry;
        try {
            const content = await fs.readFile(reviewFilePath, 'utf-8');
            entry = JSON.parse(content);
        } catch (err) {
            entry = this.reviewQueue.get(reviewId);
        }
        
        if (!entry) {
            return { success: false, error: 'Review not found: ' + reviewId };
        }
        
        entry.status = 'rejected';
        entry.reviewedBy = reviewerName;
        entry.reviewedAt = new Date().toISOString();
        entry.rejectionReason = reason;
        
        try {
            await fs.writeFile(reviewFilePath, JSON.stringify(entry, null, 2), 'utf-8');
        } catch (err) {
            this.reviewQueue.set(reviewId, entry);
        }
        
        console.log(`❌ Code REJECTED by ${reviewerName}: ${entry.path} - ${reason}`);
        this.logAudit('rejectChange', reviewerName, true, { reviewId, reason });
        
        return { success: true, data: { reviewId, status: 'rejected', reason } };
    }
    
    /**
     * Get audit log
     */
    getAuditLog(count = 50) {
        return this.auditLog.slice(-count).reverse();
    }

    async createFeature(name, code, description, contributor) {
        // Sanitize feature name
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const filePath = `features/${safeName}.js`;
        const contributorName = contributor?.name || 'Unknown Agent';

        // Wrap code in feature module structure if needed
        let wrappedCode = code;
        if (!code.includes('export')) {
            wrappedCode = `// Feature: ${name}
// ${description || 'Agent-created feature'}
// Created: ${new Date().toISOString()}
// Author: ${contributorName} (Moltbook verified)

${code}

export default {
    name: '${name}',
    author: '${contributorName}',
    init: typeof init === 'function' ? init : () => {},
    update: typeof update === 'function' ? update : () => {},
    cleanup: typeof cleanup === 'function' ? cleanup : () => {}
};
`;
        }

        const result = await this.proposeChange(filePath, wrappedCode, `Create feature: ${name}`, contributor);

        if (result.success) {
            // Update features manifest
            await this.updateFeaturesManifest(safeName, name, description, contributorName);
        }

        return result;
    }

    async modifyFeature(name, code, description, contributor) {
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const filePath = `features/${safeName}.js`;

        return await this.proposeChange(filePath, code, `Modify feature: ${name} - ${description}`, contributor);
    }

    async updateFeaturesManifest(safeName, displayName, description, author) {
        const manifestPath = join(this.featuresDir, 'manifest.json');

        let manifest = { features: {} };

        try {
            const content = await fs.readFile(manifestPath, 'utf-8');
            manifest = JSON.parse(content);
        } catch (err) {
            // Manifest doesn't exist yet
        }

        manifest.features[safeName] = {
            name: displayName,
            description: description || '',
            file: `${safeName}.js`,
            author: author,
            enabled: true,
            created: new Date().toISOString()
        };

        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    }

    async getChangeLog(count = 20) {
        try {
            const log = await this.git.log({ n: count });
            return {
                success: true,
                data: {
                    commits: log.all.map(commit => ({
                        hash: commit.hash,
                        shortHash: commit.hash.slice(0, 7),
                        message: commit.message,
                        date: commit.date,
                        author: commit.author_name
                    }))
                }
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async rollback(commitId, contributor) {
        const contributorName = contributor?.name || 'Unknown Agent';

        try {
            // Create a revert commit instead of hard reset (safer)
            await this.git.revert(commitId, { '--no-commit': null });
            await this.git.commit(`[${contributorName}] Rollback to ${commitId.slice(0, 7)}`);

            console.log(`⏪ Rollback by ${contributorName} to commit ${commitId.slice(0, 7)}`);

            return {
                success: true,
                data: { rolledBackTo: commitId }
            };
        } catch (err) {
            // If revert fails, try reset (more destructive)
            try {
                await this.git.reset(['--hard', commitId]);
                return {
                    success: true,
                    data: { rolledBackTo: commitId, method: 'reset' }
                };
            } catch (resetErr) {
                return { success: false, error: resetErr.message };
            }
        }
    }

    validateSyntax(code, filePath) {
        // Only validate JS files
        if (!filePath.endsWith('.js')) return null;

        try {
            // Try to parse the code
            new Function(code);
            return null; // No error
        } catch (err) {
            return err.message;
        }
    }

    trackContribution(agentName, operation, target) {
        if (!this.contributions.has(agentName)) {
            this.contributions.set(agentName, []);
        }
        this.contributions.get(agentName).push({
            operation,
            target,
            timestamp: new Date().toISOString()
        });
    }

    getContributions(agentName) {
        return this.contributions.get(agentName) || [];
    }

    getAllContributors() {
        return Array.from(this.contributions.keys());
    }
}
