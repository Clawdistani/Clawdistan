/**
 * Ship Designer Module
 * Handles hull selection, module installation, and blueprint creation.
 * Extracted from ui.js for modularity.
 */

export class ShipDesigner {
    constructor() {
        this.hulls = {};
        this.modules = {};
        this.selectedHull = null;
        this.installedModules = [];
        this.moduleTab = 'weapon';
    }

    /**
     * Initialize the Ship Designer UI and event listeners
     */
    init() {
        // Open Ship Designer button
        document.getElementById('shipDesignerBtn')?.addEventListener('click', () => {
            this.open();
        });

        // Ship Designer Modal close
        document.getElementById('closeShipDesigner')?.addEventListener('click', () => {
            document.getElementById('shipDesignerModal').style.display = 'none';
        });

        // Blueprints Modal
        document.getElementById('closeBlueprints')?.addEventListener('click', () => {
            document.getElementById('blueprintsModal').style.display = 'none';
        });

        document.getElementById('openShipDesignerFromBlueprints')?.addEventListener('click', () => {
            document.getElementById('blueprintsModal').style.display = 'none';
            this.open();
        });

        // Module tabs
        document.querySelectorAll('.sd-mod-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sd-mod-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.moduleTab = btn.dataset.type;
                this.renderModuleList();
            });
        });

        // Clear modules
        document.getElementById('sdClearModules')?.addEventListener('click', () => {
            this.installedModules = [];
            this.updatePreview();
            this.renderInstalledModules();
            this.renderModuleList();
        });

        // Save blueprint
        document.getElementById('sdSaveBlueprint')?.addEventListener('click', () => {
            this.saveBlueprint();
        });

        // Fetch initial data
        this.fetchData();
    }

    /**
     * Fetch hulls and modules data from API
     */
    async fetchData() {
        try {
            const [hullsRes, modulesRes] = await Promise.all([
                fetch('/api/ships/hulls'),
                fetch('/api/ships/modules')
            ]);
            const hullsData = await hullsRes.json();
            const modulesData = await modulesRes.json();

            this.hulls = hullsData.hulls || {};
            this.modules = {};
            (modulesData.modules || []).forEach(m => {
                this.modules[m.id] = m;
            });
        } catch (err) {
            console.error('Failed to load ship designer data:', err);
        }
    }

    /**
     * Open the Ship Designer modal
     */
    open() {
        document.getElementById('shipDesignerModal').style.display = 'flex';
        this.selectedHull = null;
        this.installedModules = [];
        document.getElementById('sdShipName').value = '';
        this.renderHullList();
        this.renderModuleList();
        this.updatePreview();
        this.renderInstalledModules();
    }

    /**
     * Open the Blueprints modal
     */
    openBlueprintsModal() {
        document.getElementById('blueprintsModal').style.display = 'flex';
        this.fetchBlueprints();
    }

    /**
     * Fetch and display existing blueprints
     */
    async fetchBlueprints() {
        const container = document.getElementById('blueprintsList');
        if (!container) return;

        try {
            const stateRes = await fetch('/api/state');
            const state = await stateRes.json();
            const empires = state.empires || [];

            if (empires.length === 0) {
                container.innerHTML = '<p class="placeholder-text">No empires found.</p>';
                return;
            }

            const empireId = empires[0].id;
            const res = await fetch(`/api/empire/${empireId}/ships`);
            const data = await res.json();

            this.renderBlueprints(data.blueprints || [], empireId);
        } catch (err) {
            console.error('Failed to load blueprints:', err);
            container.innerHTML = '<p class="placeholder-text">Failed to load blueprints.</p>';
        }
    }

    /**
     * Render blueprints list
     */
    renderBlueprints(blueprints, empireId) {
        const container = document.getElementById('blueprintsList');
        if (!container) return;

        if (blueprints.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No blueprints yet. Create one in the Ship Designer!</p>';
            return;
        }

        container.innerHTML = blueprints.map(bp => `
            <div class="blueprint-item" data-id="${bp.id}">
                <span class="blueprint-icon">${bp.icon || '🚀'}</span>
                <div class="blueprint-info">
                    <div class="blueprint-name">${bp.name}</div>
                    <div class="blueprint-hull">${bp.hullType} • Tier ${bp.tier}</div>
                    <div class="blueprint-stats">HP: ${bp.stats.hp} | ATK: ${bp.stats.attack} | SPD: ${bp.stats.speed}</div>
                </div>
                <div class="blueprint-actions">
                    <button class="blueprint-btn" onclick="alert('Build feature requires agent mode')">🔨 Build</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render the hull selection list
     */
    renderHullList() {
        const container = document.getElementById('sdHullList');
        if (!container) return;

        const hulls = Object.entries(this.hulls);
        if (hulls.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 11px;">Loading...</p>';
            return;
        }

        // Sort by tier
        hulls.sort((a, b) => (a[1].tier || 1) - (b[1].tier || 1));

        container.innerHTML = hulls.map(([id, hull]) => `
            <div class="sd-hull-item ${this.selectedHull === id ? 'selected' : ''} ${hull.available === false ? 'locked' : ''}" 
                 data-hull="${id}">
                <div class="hull-name">
                    <span>${hull.icon || '🚀'}</span>
                    <span>${hull.name}</span>
                    <span class="hull-tier">T${hull.tier || 1}</span>
                </div>
                <div class="hull-slots">${hull.totalSlots || 0} slots</div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.sd-hull-item').forEach(item => {
            item.addEventListener('click', () => {
                const hullId = item.dataset.hull;
                const hull = this.hulls[hullId];
                if (hull.available === false) return;

                this.selectedHull = hullId;
                this.installedModules = [];

                // Update UI
                container.querySelectorAll('.sd-hull-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');

                this.updatePreview();
                this.renderInstalledModules();
                this.renderModuleList();
            });
        });
    }

    /**
     * Render the module selection list
     */
    renderModuleList() {
        const container = document.getElementById('sdModuleList');
        if (!container) return;

        const moduleType = this.moduleTab;
        const hull = this.hulls[this.selectedHull];

        // Filter modules by type
        const modules = Object.entries(this.modules)
            .filter(([id, mod]) => mod.type === moduleType)
            .sort((a, b) => (a[1].tier || 1) - (b[1].tier || 1));

        if (modules.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 11px;">No modules of this type.</p>';
            return;
        }

        // Calculate used slots
        const usedSlots = this.getUsedSlots();
        const maxSlots = hull?.slots?.[moduleType] || 0;
        const canAddMore = hull && usedSlots[moduleType] < maxSlots;

        container.innerHTML = modules.map(([id, mod]) => {
            const effectText = this.formatModuleEffect(mod.stats);
            const costText = Object.entries(mod.cost || {}).map(([r, v]) => `${v}${r.charAt(0)}`).join(' ');
            const isDisabled = !canAddMore || mod.available === false;

            return `
                <div class="sd-module-item ${isDisabled ? 'disabled' : ''} ${mod.available === false ? 'locked' : ''}" 
                     data-module="${id}">
                    <div class="module-name">
                        <span>${mod.icon || '⚙️'}</span>
                        <span>${mod.name}</span>
                        <span class="module-tier">T${mod.tier || 1}</span>
                    </div>
                    <div class="module-effect">${effectText}</div>
                    <div class="module-cost">${costText}</div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.sd-module-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', () => {
                const moduleId = item.dataset.module;
                this.addModule(moduleId);
            });
        });
    }

    /**
     * Add a module to the current design
     */
    addModule(moduleId) {
        const mod = this.modules[moduleId];
        const hull = this.hulls[this.selectedHull];
        if (!mod || !hull) return;

        const usedSlots = this.getUsedSlots();
        const maxSlots = hull.slots?.[mod.type] || 0;

        if (usedSlots[mod.type] >= maxSlots) {
            console.log('No more slots for this module type');
            return;
        }

        this.installedModules.push(moduleId);
        this.updatePreview();
        this.renderInstalledModules();
        this.renderModuleList();
    }

    /**
     * Remove a module from the current design
     */
    removeModule(index) {
        this.installedModules.splice(index, 1);
        this.updatePreview();
        this.renderInstalledModules();
        this.renderModuleList();
    }

    /**
     * Get count of used slots by type
     */
    getUsedSlots() {
        const used = { weapon: 0, defense: 0, propulsion: 0, utility: 0 };
        this.installedModules.forEach(modId => {
            const mod = this.modules[modId];
            if (mod) used[mod.type] = (used[mod.type] || 0) + 1;
        });
        return used;
    }

    /**
     * Update the ship preview panel
     */
    updatePreview() {
        const hull = this.hulls[this.selectedHull];

        // Update icon
        const iconEl = document.getElementById('sdShipIcon');
        if (iconEl) iconEl.textContent = hull?.icon || '🚀';

        if (!hull) {
            this.setPreviewEmpty();
            return;
        }

        // Calculate stats
        const stats = { ...hull.baseStats };
        const cost = { ...hull.baseCost };

        this.installedModules.forEach(modId => {
            const mod = this.modules[modId];
            if (mod) {
                // Add module stats
                for (const [key, val] of Object.entries(mod.stats || {})) {
                    if (typeof val === 'number') {
                        stats[key] = (stats[key] || 0) + val;
                    }
                }
                // Add module cost
                for (const [key, val] of Object.entries(mod.cost || {})) {
                    cost[key] = (cost[key] || 0) + val;
                }
            }
        });

        // Update stats display
        this.setElementText('sdStatHp', Math.round(stats.hp || 0));
        this.setElementText('sdStatAtk', Math.round(stats.attack || 0));
        this.setElementText('sdStatSpd', (stats.speed || 0).toFixed(1));
        this.setElementText('sdStatRng', stats.range || 0);
        this.setElementText('sdStatEva', ((stats.evasion || 0) * 100).toFixed(0) + '%');

        // Update slots
        const used = this.getUsedSlots();
        const slots = hull.slots || {};
        this.setElementText('sdSlotsW', `${used.weapon}/${slots.weapon || 0}`);
        this.setElementText('sdSlotsD', `${used.defense}/${slots.defense || 0}`);
        this.setElementText('sdSlotsP', `${used.propulsion}/${slots.propulsion || 0}`);
        this.setElementText('sdSlotsU', `${used.utility}/${slots.utility || 0}`);

        // Update cost
        const costStr = Object.entries(cost)
            .filter(([k, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
        this.setElementText('sdCostValues', costStr || '--');
    }

    /**
     * Set preview to empty state
     */
    setPreviewEmpty() {
        this.setElementText('sdStatHp', '--');
        this.setElementText('sdStatAtk', '--');
        this.setElementText('sdStatSpd', '--');
        this.setElementText('sdStatRng', '--');
        this.setElementText('sdStatEva', '--');
        this.setElementText('sdSlotsW', '0/0');
        this.setElementText('sdSlotsD', '0/0');
        this.setElementText('sdSlotsP', '0/0');
        this.setElementText('sdSlotsU', '0/0');
        this.setElementText('sdCostValues', '--');
    }

    /**
     * Helper to set element text content
     */
    setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /**
     * Render the list of installed modules
     */
    renderInstalledModules() {
        const container = document.getElementById('sdInstalledList');
        if (!container) return;

        if (this.installedModules.length === 0) {
            container.innerHTML = '<span style="color: #666; font-size: 10px;">Click modules to add</span>';
            return;
        }

        container.innerHTML = this.installedModules.map((modId, idx) => {
            const mod = this.modules[modId];
            return `<span class="sd-installed-module" data-index="${idx}">${mod?.icon || '⚙️'} ${mod?.name || modId}</span>`;
        }).join('');

        // Add click to remove
        container.querySelectorAll('.sd-installed-module').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                this.removeModule(idx);
            });
        });
    }

    /**
     * Format module effect text
     */
    formatModuleEffect(stats) {
        if (!stats) return '';
        const parts = [];
        if (stats.attack) parts.push(`+${stats.attack} ATK`);
        if (stats.hp) parts.push(`+${stats.hp} HP`);
        if (stats.speed) parts.push(`+${stats.speed} SPD`);
        if (stats.range) parts.push(`+${stats.range} RNG`);
        if (stats.evasion) parts.push(`+${(stats.evasion * 100).toFixed(0)}% EVA`);
        if (stats.shieldRegen) parts.push(`+${stats.shieldRegen} shield/s`);
        if (stats.damageReduction) parts.push(`-${(stats.damageReduction * 100).toFixed(0)}% dmg`);
        if (stats.warpSpeed) parts.push(`+${(stats.warpSpeed * 100).toFixed(0)}% warp`);
        if (stats.cargoCapacity) parts.push(`+${stats.cargoCapacity} cargo`);
        if (stats.vision) parts.push(`+${stats.vision} vision`);
        return parts.slice(0, 2).join(', ') || 'Various bonuses';
    }

    /**
     * Save the current design as a blueprint
     */
    saveBlueprint() {
        const name = document.getElementById('sdShipName')?.value.trim();
        const hull = this.selectedHull;

        if (!hull) {
            alert('Please select a hull first!');
            return;
        }

        if (!name) {
            alert('Please enter a ship name!');
            return;
        }

        // In observer mode, we can't actually save blueprints
        alert(`Blueprint "${name}" designed!\n\nHull: ${this.hulls[hull].name}\nModules: ${this.installedModules.length}\n\nNote: To actually save and build ships, connect as an agent via WebSocket.`);

        console.log('Blueprint design:', {
            name,
            hullType: hull,
            modules: this.installedModules
        });
    }
}
