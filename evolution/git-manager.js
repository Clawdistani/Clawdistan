import simpleGit from 'simple-git';

export class GitManager {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.git = simpleGit(projectRoot);
    }

    async init() {
        try {
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                await this.git.init();
                // Create initial commit
                await this.git.add('.');
                await this.git.commit('Initial commit - Clawdistan universe');
                console.log('Git repository initialized');
            }
            return true;
        } catch (err) {
            console.error('Git init error:', err);
            return false;
        }
    }

    async commit(message, files = ['.']) {
        try {
            await this.git.add(files);
            const result = await this.git.commit(message);
            return {
                success: true,
                commit: result.commit,
                summary: result.summary
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    }

    async getLog(count = 20) {
        try {
            const log = await this.git.log({ n: count });
            return log.all.map(entry => ({
                hash: entry.hash,
                short: entry.hash.slice(0, 7),
                message: entry.message,
                date: entry.date,
                author: entry.author_name
            }));
        } catch (err) {
            return [];
        }
    }

    async getFileHistory(filePath, count = 10) {
        try {
            const log = await this.git.log({
                file: filePath,
                n: count
            });
            return log.all;
        } catch (err) {
            return [];
        }
    }

    async getDiff(commitA, commitB) {
        try {
            const diff = await this.git.diff([commitA, commitB]);
            return diff;
        } catch (err) {
            return null;
        }
    }

    async getFileAtCommit(filePath, commitHash) {
        try {
            const content = await this.git.show([`${commitHash}:${filePath}`]);
            return content;
        } catch (err) {
            return null;
        }
    }

    async revert(commitHash) {
        try {
            await this.git.revert(commitHash, { '--no-commit': null });
            await this.git.commit(`Revert: ${commitHash.slice(0, 7)}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async reset(commitHash, hard = false) {
        try {
            const mode = hard ? '--hard' : '--soft';
            await this.git.reset([mode, commitHash]);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async createBranch(branchName) {
        try {
            await this.git.checkoutLocalBranch(branchName);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async getCurrentBranch() {
        try {
            const status = await this.git.status();
            return status.current;
        } catch (err) {
            return 'main';
        }
    }

    async getStatus() {
        try {
            const status = await this.git.status();
            return {
                branch: status.current,
                clean: status.isClean(),
                staged: status.staged,
                modified: status.modified,
                untracked: status.not_added
            };
        } catch (err) {
            return { error: err.message };
        }
    }
}
