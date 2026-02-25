/**
 * Diplomacy Module
 * Handles diplomatic relations visualization, alliances, wars, and proposals.
 * Extracted from ui.js for modularity.
 */

export class DiplomacyPanel {
    constructor() {
        this.data = null;
        this.cachedLeaderboard = [];
    }

    /**
     * Initialize diplomacy panel event listeners
     */
    init() {
        document.getElementById('diplomacyBtn')?.addEventListener('click', () => {
            document.getElementById('diplomacyModal').style.display = 'flex';
            this.fetch();
        });
        
        document.getElementById('closeDiplomacy')?.addEventListener('click', () => {
            document.getElementById('diplomacyModal').style.display = 'none';
        });
        
        document.getElementById('refreshDiplomacy')?.addEventListener('click', () => {
            this.fetch();
        });
    }

    /**
     * Fetch diplomacy data from API
     */
    async fetch() {
        try {
            const res = await fetch('/api/diplomacy');
            const data = await res.json();
            this.data = data;
            this.render(data);
        } catch (err) {
            console.error('Failed to load diplomacy:', err);
        }
    }

    /**
     * Render the full diplomacy panel
     */
    render(data) {
        if (!data) return;

        this.renderWars(data);
        this.renderAlliances(data);
        this.renderProposals(data);
        this.renderMatrix(data);
    }

    /**
     * Render active wars
     */
    renderWars(data) {
        const container = document.getElementById('diplomacyWars');
        if (!container) return;

        const wars = data.relations.filter(r => r.status === 'war');
        
        if (wars.length > 0) {
            container.innerHTML = wars.map(war => {
                const timeAgo = this.formatTimeAgo(war.since);
                const aggressor = war.aggressor === war.empire1.id ? war.empire1.name : war.empire2.name;
                return `
                    <div class="diplomacy-item war">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${war.empire1.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${war.empire1.name}</span>
                        </div>
                        <span class="diplomacy-vs">⚔️</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${war.empire2.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${war.empire2.name}</span>
                        </div>
                        <div class="diplomacy-status war">At War</div>
                        <div class="diplomacy-time" title="Started by ${aggressor}">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="placeholder-text">🕊️ Peace reigns across the galaxy</p>';
        }
    }

    /**
     * Render active alliances
     */
    renderAlliances(data) {
        const container = document.getElementById('diplomacyAlliances');
        if (!container) return;

        const alliances = data.relations.filter(r => r.status === 'allied');
        
        if (alliances.length > 0) {
            container.innerHTML = alliances.map(alliance => {
                const timeAgo = this.formatTimeAgo(alliance.since);
                return `
                    <div class="diplomacy-item alliance">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${alliance.empire1.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${alliance.empire1.name}</span>
                        </div>
                        <span class="diplomacy-vs">🤝</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${alliance.empire2.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${alliance.empire2.name}</span>
                        </div>
                        <div class="diplomacy-status alliance">Allied</div>
                        <div class="diplomacy-time">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="placeholder-text">No alliances have been formed</p>';
        }
    }

    /**
     * Render pending proposals
     */
    renderProposals(data) {
        const container = document.getElementById('diplomacyProposals');
        if (!container) return;

        if (data.proposals.length > 0) {
            container.innerHTML = data.proposals.map(proposal => {
                const typeIcon = proposal.type === 'alliance' ? '🤝' : '🕊️';
                const typeLabel = proposal.type === 'alliance' ? 'Alliance' : 'Peace';
                const timeAgo = this.formatTimeAgo(proposal.created);
                return `
                    <div class="diplomacy-item proposal">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${proposal.from.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${proposal.from.name}</span>
                        </div>
                        <span class="diplomacy-vs">${typeIcon}→</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${proposal.to.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${proposal.to.name}</span>
                        </div>
                        <div class="diplomacy-status proposal">${typeLabel} Proposal</div>
                        <div class="diplomacy-time">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="placeholder-text">No pending proposals</p>';
        }
    }

    /**
     * Render the relations matrix
     */
    renderMatrix(data) {
        const container = document.getElementById('diplomacyMatrix');
        if (!container || !data.empires || data.empires.length < 2) {
            if (container) {
                container.innerHTML = '<p class="placeholder-text">Not enough empires for a relations matrix</p>';
            }
            return;
        }

        const empires = data.empires;

        // Build relation lookup
        const relationMap = {};
        for (const rel of data.relations) {
            const key1 = `${rel.empire1.id}_${rel.empire2.id}`;
            const key2 = `${rel.empire2.id}_${rel.empire1.id}`;
            relationMap[key1] = rel.status;
            relationMap[key2] = rel.status;
        }

        let html = '<table>';

        // Header row
        html += '<tr><th></th>';
        for (const empire of empires) {
            const shortName = empire.name.substring(0, 10);
            html += `<th><div class="empire-header"><span class="empire-dot" style="background: ${empire.color || '#888'}"></span>${shortName}</div></th>`;
        }
        html += '</tr>';

        // Data rows
        for (const rowEmpire of empires) {
            const shortName = rowEmpire.name.substring(0, 10);
            html += `<tr><th><div class="empire-header"><span class="empire-dot" style="background: ${rowEmpire.color || '#888'}"></span>${shortName}</div></th>`;

            for (const colEmpire of empires) {
                if (rowEmpire.id === colEmpire.id) {
                    html += '<td class="self">-</td>';
                } else {
                    const key = `${rowEmpire.id}_${colEmpire.id}`;
                    const status = relationMap[key] || 'neutral';
                    const symbol = status === 'war' ? '⚔️' : status === 'allied' ? '🤝' : '•';
                    html += `<td class="${status}">${symbol}</td>`;
                }
            }
            html += '</tr>';
        }

        html += '</table>';
        container.innerHTML = html;
    }

    /**
     * Format timestamp as relative time
     */
    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    /**
     * Fetch leaderboard for caching
     */
    async fetchLeaderboard() {
        try {
            const res = await fetch('/api/leaderboard?limit=100');
            const data = await res.json();
            this.cachedLeaderboard = data.leaderboard || [];
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        }
    }

    /**
     * Update the sidebar diplomacy summary
     */
    async updateSummary() {
        try {
            const res = await fetch('/api/diplomacy');
            const data = await res.json();
            this.renderSummary(data);
        } catch (err) {
            // Silent fail - not critical
        }
    }

    /**
     * Render the sidebar diplomacy summary
     */
    renderSummary(data) {
        if (!data) return;

        const warCount = document.getElementById('warCount');
        const allianceCount = document.getElementById('allianceCount');
        const activeConflicts = document.getElementById('activeConflicts');

        if (!warCount || !allianceCount || !activeConflicts) return;

        const wars = data.relations?.filter(r => r.status === 'war') || [];
        const alliances = data.relations?.filter(r => r.status === 'allied') || [];

        warCount.textContent = wars.length;
        allianceCount.textContent = alliances.length;

        // Show recent conflicts/alliances
        const items = [];

        // Show wars first (max 3)
        wars.slice(0, 3).forEach(war => {
            items.push(`
                <div class="conflict-item war">
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${war.empire1?.color || '#888'}"></span>
                        <span>${(war.empire1?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                    <span class="conflict-vs">⚔️</span>
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${war.empire2?.color || '#888'}"></span>
                        <span>${(war.empire2?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                </div>
            `);
        });

        // Show alliances (max 2)
        alliances.slice(0, 2).forEach(alliance => {
            items.push(`
                <div class="conflict-item alliance">
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${alliance.empire1?.color || '#888'}"></span>
                        <span>${(alliance.empire1?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                    <span class="conflict-vs">🤝</span>
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${alliance.empire2?.color || '#888'}"></span>
                        <span>${(alliance.empire2?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                </div>
            `);
        });

        if (items.length === 0) {
            activeConflicts.innerHTML = '<p style="color: #666; font-size: 0.75rem; text-align: center;">🕊️ Peace in the galaxy</p>';
        } else {
            activeConflicts.innerHTML = items.join('');
        }
    }
}
