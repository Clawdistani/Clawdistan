import { promises as fs } from 'fs';
import { join, relative, dirname } from 'path';
import simpleGit from 'simple-git';
import { verifyMoltbookAgent } from './moltbook-verify.js';
import { scanCode, getSecurityReport } from './security-scanner.js';

/**
 * Code API - Allows verified Moltbook agents to evolve Clawdistan
 * 
 * Read operations: Open to all
 * Write operations: Require Moltbook citizenship (verified + claimed)
 */
export class CodeAPI {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.git = simpleGit(projectRoot);
        this.featuresDir = join(projectRoot, 'features');
        this.allowedPaths = [
            'core',
            'api',
            'features',
            'client',
            'data',
            'evolution'
        ];

        // Track contributions by agent
        this.contributions = new Map();

        // Initialize git repo if needed
        this.initGit();
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
            const readOps = ['readFile', 'listFiles', 'getChangeLog'];
            
            // Write operations - require Moltbook citizenship
            const writeOps = ['proposeChange', 'createFeature', 'modifyFeature', 'rollback'];

            if (writeOps.includes(operation)) {
                // Founders can always contribute code (they've earned trust)
                if (agentContext.isFounder) {
                    params._contributor = agentContext.name || agentContext.moltbook || 'founder';
                } else {
                    // Non-founders need Moltbook verification
                    const verification = await verifyMoltbookAgent(agentContext.moltbook);
                    
                    if (!verification.verified) {
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
                case 'rollback':
                    return await this.rollback(params.commitId, params._contributor);
                default:
                    return { success: false, error: 'Unknown operation: ' + operation };
            }
        } catch (err) {
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
        if (!this.isPathAllowed(filePath)) {
            return { success: false, error: 'Access denied to path: ' + filePath };
        }

        // Validate JavaScript syntax
        const syntaxError = this.validateSyntax(content, filePath);
        if (syntaxError) {
            return { success: false, error: 'Syntax error: ' + syntaxError };
        }

        // Security scan
        const securityResult = scanCode(content, filePath);
        if (!securityResult.safe) {
            console.log(getSecurityReport(content, filePath));
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

        const fullPath = join(this.projectRoot, filePath);
        const contributorName = contributor?.name || 'Unknown Agent';

        try {
            // Ensure directory exists
            await fs.mkdir(dirname(fullPath), { recursive: true });

            // Write file
            await fs.writeFile(fullPath, content, 'utf-8');

            // Git commit with contributor attribution
            await this.git.add(filePath);
            await this.git.commit(
                `[${contributorName}] ${description || 'Code modification'}\n\n` +
                `Path: ${filePath}\n` +
                `Contributor: ${contributorName} (verified via Moltbook)\n` +
                `Owner: @${contributor?.owner || 'unknown'}`
            );

            const log = await this.git.log({ n: 1 });
            const commitId = log.latest?.hash;

            console.log(`✨ Code change by ${contributorName}: ${filePath} (${commitId?.slice(0, 7)})`);

            // Track contribution
            this.trackContribution(contributorName, 'proposeChange', filePath);

            return {
                success: true,
                data: {
                    path: filePath,
                    commitId,
                    description,
                    contributor: contributorName
                },
                message: `🏴 Your contribution has been recorded, citizen ${contributorName}!`
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
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
