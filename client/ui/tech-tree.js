/**
 * Tech Tree Module
 * Handles technology research visualization and interaction.
 * Extracted from ui.js for modularity.
 */

export class TechTree {
    constructor() {
        this.techFilter = 'all';
        this.techSearch = '';
        this.techView = 'tier';
        this.techData = null;
        this.techMap = {};
        this.researched = new Set();
        this.selectedEmpireId = null;
        this.techTiers = {};
        this.techCategories = {};
        this.renderCardFn = null;
    }

    /**
     * Initialize the Tech Tree UI and event listeners
     */
    init() {
        document.getElementById('techTreeBtn')?.addEventListener('click', () => {
            document.getElementById('techTreeModal').style.display = 'flex';
            this.fetch();
        });
        
        document.getElementById('closeTechTree')?.addEventListener('click', () => {
            document.getElementById('techTreeModal').style.display = 'none';
        });
        
        document.getElementById('techEmpireSelect')?.addEventListener('change', (e) => {
            this.selectedEmpireId = e.target.value;
            this.render(this.techData, e.target.value);
        });

        // Search
        document.getElementById('techSearch')?.addEventListener('input', (e) => {
            this.techSearch = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Category filters
        document.querySelectorAll('.tech-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tech-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.techFilter = btn.dataset.category;
                this.applyFilters();
            });
        });

        // View toggle
        document.querySelectorAll('.tech-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tech-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.techView = btn.dataset.view;

                const tierView = document.getElementById('techTreeTierView');
                const catView = document.getElementById('techTreeCategoryView');
                if (this.techView === 'tier') {
                    tierView.style.display = 'flex';
                    catView.style.display = 'none';
                } else {
                    tierView.style.display = 'none';
                    catView.style.display = 'block';
                }

                this.renderView(this.techView);
            });
        });
    }

    /**
     * Fetch tech tree data from API
     */
    async fetch() {
        try {
            const res = await fetch('/api/tech');
            const data = await res.json();
            this.techData = data;

            // Populate empire selector
            const select = document.getElementById('techEmpireSelect');
            if (select && data.empires) {
                select.innerHTML = data.empires.map(e =>
                    `<option value="${e.id}" style="color: ${e.color}">${e.name}</option>`
                ).join('');
            }

            // Render for first empire
            if (data.empires && data.empires.length > 0) {
                this.selectedEmpireId = data.empires[0].id;
                this.render(data, data.empires[0].id);
            }
        } catch (err) {
            console.error('Failed to load tech tree:', err);
        }
    }

    /**
     * Render the tech tree for a specific empire
     */
    render(data, empireId) {
        if (!data || !data.technologies) return;

        const researched = new Set(data.researched?.[empireId] || []);
        const techs = data.technologies;
        this.techMap = {};
        this.researched = researched;

        // Category icons
        const categoryIcons = {
            physics: '⚡', engineering: '🔧', biology: '🧬',
            military: '⚔️', society: '🏛️', ascension: '✨', rare: '💎'
        };

        // Tier colors
        const tierColors = {
            1: '#4ade80', 2: '#60a5fa', 3: '#a78bfa', 4: '#f59e0b', 5: '#f43f5e'
        };

        // Build tech map and group data
        const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        const categories = { physics: [], engineering: [], biology: [], military: [], society: [], ascension: [], rare: [] };

        for (const tech of techs) {
            this.techMap[tech.id] = tech;
            if (tiers[tech.tier]) tiers[tech.tier].push(tech);
            const cat = tech.category || 'society';
            if (categories[cat]) categories[cat].push(tech);
        }

        // Update progress
        const totalTechs = techs.length;
        const researchedCount = researched.size;
        const progressEl = document.getElementById('techProgress');
        if (progressEl) progressEl.textContent = `${researchedCount}/${totalTechs} researched`;

        // Render card helper
        const renderCard = (tech) => {
            const isResearched = researched.has(tech.id);
            const canResearch = !isResearched && tech.prerequisites.every(p => researched.has(p));
            const status = isResearched ? 'researched' : canResearch ? 'available' : 'locked';
            const tierColor = tierColors[tech.tier];
            const catIcon = categoryIcons[tech.category] || '🔬';

            // Format prerequisites
            const prereqNames = tech.prerequisites.map(p => this.techMap[p]?.name || p);
            const prereqHtml = prereqNames.length > 0
                ? `<div class="tech-prereqs">⬆️ ${prereqNames.slice(0, 2).join(' + ')}${prereqNames.length > 2 ? '...' : ''}</div>`
                : '';

            // Format top effects (limit to 2)
            let effectsList = [];
            if (tech.effects) {
                if (tech.effects.mineralBonus) effectsList.push(`+${Math.round(tech.effects.mineralBonus * 100)}% min`);
                if (tech.effects.foodBonus) effectsList.push(`+${Math.round(tech.effects.foodBonus * 100)}% food`);
                if (tech.effects.energyBonus) effectsList.push(`+${Math.round(tech.effects.energyBonus * 100)}% energy`);
                if (tech.effects.researchBonus) effectsList.push(`+${Math.round(tech.effects.researchBonus * 100)}% research`);
                if (tech.effects.attackBonus) effectsList.push(`+${Math.round(tech.effects.attackBonus * 100)}% atk`);
                if (tech.effects.hpBonus) effectsList.push(`+${Math.round(tech.effects.hpBonus * 100)}% HP`);
                if (tech.effects.victory) effectsList = ['🏆 VICTORY'];
                if (tech.effects.unlocks) effectsList.push(`Unlocks`);
            }
            const effectsHtml = effectsList.length > 0
                ? `<div class="tech-effects">${effectsList.slice(0, 2).join(' • ')}</div>`
                : '';

            return `
                <div class="tech-card ${status}" data-tech="${tech.id}" data-category="${tech.category}" style="--tier-color: ${tierColor}">
                    <span class="tech-category-badge ${tech.category}">${catIcon}</span>
                    <div class="tech-header">
                        <span class="tech-name">${tech.name}</span>
                    </div>
                    <div class="tech-cost-bar">
                        <span class="tech-cost">🔬 ${tech.cost >= 1000 ? (tech.cost/1000).toFixed(1) + 'k' : tech.cost}</span>
                        <span class="tech-tier-badge">T${tech.tier}</span>
                    </div>
                    <div class="tech-desc">${tech.description.substring(0, 80)}${tech.description.length > 80 ? '...' : ''}</div>
                    ${effectsHtml}
                    ${prereqHtml}
                </div>
            `;
        };

        // Store grouped data for lazy rendering
        this.techTiers = tiers;
        this.techCategories = categories;
        this.renderCardFn = renderCard;

        // Only render active view (default is tier)
        this.renderView(this.techView || 'tier');

        // Setup interactions
        this.setupInteractions();
    }

    /**
     * Render a specific view (tier or category)
     */
    renderView(view) {
        const renderCard = this.renderCardFn;
        if (!renderCard) return;

        if (view === 'tier') {
            // Render tier view using DocumentFragment for performance
            for (let tier = 1; tier <= 5; tier++) {
                const container = document.getElementById(`tier${tier}Techs`);
                if (!container) continue;
                const techs = this.techTiers[tier] || [];
                techs.sort((a, b) => (a.category || '').localeCompare(b.category || ''));

                const fragment = document.createDocumentFragment();
                const temp = document.createElement('div');
                temp.innerHTML = techs.map(renderCard).join('');
                while (temp.firstChild) fragment.appendChild(temp.firstChild);

                container.innerHTML = '';
                container.appendChild(fragment);
            }
        } else {
            // Render category view
            for (const [cat, catTechs] of Object.entries(this.techCategories)) {
                const container = document.getElementById(`${cat}Techs`);
                if (!container) continue;
                catTechs.sort((a, b) => a.tier - b.tier);

                const fragment = document.createDocumentFragment();
                const temp = document.createElement('div');
                temp.innerHTML = catTechs.map(renderCard).join('');
                while (temp.firstChild) fragment.appendChild(temp.firstChild);

                container.innerHTML = '';
                container.appendChild(fragment);
            }
        }

        // Apply filters after rendering
        this.applyFilters();
    }

    /**
     * Apply search and category filters
     */
    applyFilters() {
        const cards = document.querySelectorAll('.tech-card');
        cards.forEach(card => {
            const techId = card.dataset.tech;
            const tech = this.techMap?.[techId];
            if (!tech) return;

            let visible = true;

            // Category filter
            if (this.techFilter !== 'all' && tech.category !== this.techFilter) {
                visible = false;
            }

            // Search filter
            if (this.techSearch && visible) {
                const searchable = `${tech.name} ${tech.description} ${tech.id}`.toLowerCase();
                if (!searchable.includes(this.techSearch)) {
                    visible = false;
                }
            }

            card.classList.toggle('hidden', !visible);
        });
    }

    /**
     * Setup hover interactions for prerequisites/dependents
     */
    setupInteractions() {
        const cards = document.querySelectorAll('.tech-card');
        const techMap = this.techMap;

        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                const techId = card.dataset.tech;
                const tech = techMap[techId];
                if (!tech) return;

                // Highlight prerequisites
                tech.prerequisites.forEach(prereqId => {
                    const prereqCard = document.querySelector(`[data-tech="${prereqId}"]`);
                    if (prereqCard) prereqCard.classList.add('prereq-highlight');
                });

                // Highlight techs that depend on this one
                Object.values(techMap).forEach(t => {
                    if (t.prerequisites.includes(techId)) {
                        const depCard = document.querySelector(`[data-tech="${t.id}"]`);
                        if (depCard) depCard.classList.add('dependent-highlight');
                    }
                });
            });

            card.addEventListener('mouseleave', () => {
                document.querySelectorAll('.prereq-highlight, .dependent-highlight')
                    .forEach(el => el.classList.remove('prereq-highlight', 'dependent-highlight'));
            });
        });
    }
}
