import { promises as fs } from 'fs';
import { join, relative, dirname } from 'path';
import simpleGit from 'simple-git';

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

    async handleRequest(operation, params) {
        try {
            switch (operation) {
                case 'readFile':
                    return await this.readFile(params.path);
                case 'listFiles':
                    return await this.listFiles(params.directory);
                case 'proposeChange':
                    return await this.proposeChange(params.path, params.content, params.description);
                case 'createFeature':
                    return await this.createFeature(params.name, params.code, params.description);
                case 'modifyFeature':
                    return await this.modifyFeature(params.name, params.code, params.description);
                case 'getChangeLog':
                    return await this.getChangeLog(params.count);
                case 'rollback':
                    return await this.rollback(params.commitId);
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

    async proposeChange(filePath, content, description) {
        if (!this.isPathAllowed(filePath)) {
            return { success: false, error: 'Access denied to path: ' + filePath };
        }

        // Validate JavaScript syntax
        const syntaxError = this.validateSyntax(content, filePath);
        if (syntaxError) {
            return { success: false, error: 'Syntax error: ' + syntaxError };
        }

        const fullPath = join(this.projectRoot, filePath);

        try {
            // Ensure directory exists
            await fs.mkdir(dirname(fullPath), { recursive: true });

            // Write file
            await fs.writeFile(fullPath, content, 'utf-8');

            // Git commit
            await this.git.add(filePath);
            await this.git.commit(`[Agent] ${description || 'Code modification'}\n\nPath: ${filePath}`);

            const log = await this.git.log({ n: 1 });
            const commitId = log.latest?.hash;

            console.log(`Code change applied: ${filePath} (${commitId?.slice(0, 7)})`);

            return {
                success: true,
                data: {
                    path: filePath,
                    commitId,
                    description
                }
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async createFeature(name, code, description) {
        // Sanitize feature name
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const filePath = `features/${safeName}.js`;

        // Wrap code in feature module structure if needed
        let wrappedCode = code;
        if (!code.includes('export')) {
            wrappedCode = `// Feature: ${name}
// ${description || 'Agent-created feature'}
// Created: ${new Date().toISOString()}

${code}

export default {
    name: '${name}',
    init: typeof init === 'function' ? init : () => {},
    update: typeof update === 'function' ? update : () => {},
    cleanup: typeof cleanup === 'function' ? cleanup : () => {}
};
`;
        }

        const result = await this.proposeChange(filePath, wrappedCode, `Create feature: ${name}`);

        if (result.success) {
            // Update features manifest
            await this.updateFeaturesManifest(safeName, name, description);
        }

        return result;
    }

    async modifyFeature(name, code, description) {
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const filePath = `features/${safeName}.js`;

        return await this.proposeChange(filePath, code, `Modify feature: ${name} - ${description}`);
    }

    async updateFeaturesManifest(safeName, displayName, description) {
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

    async rollback(commitId) {
        try {
            // Create a revert commit instead of hard reset (safer)
            await this.git.revert(commitId, { '--no-commit': null });
            await this.git.commit(`[Agent] Rollback to ${commitId.slice(0, 7)}`);

            console.log(`Rolled back to commit ${commitId.slice(0, 7)}`);

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
}
