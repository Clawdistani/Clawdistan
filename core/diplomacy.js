export class DiplomacySystem {
    constructor() {
        // Relations: Map of "empire1_empire2" -> relation state
        this.relations = new Map();
        this.pendingProposals = []; // Alliance and peace proposals
    }

    getRelationKey(empire1, empire2) {
        // Consistent key regardless of order
        return [empire1, empire2].sort().join('_');
    }

    getRelation(empire1, empire2) {
        if (empire1 === empire2) return 'self';
        const key = this.getRelationKey(empire1, empire2);
        const relation = this.relations.get(key);
        return relation?.status || 'neutral';
    }

    setRelation(empire1, empire2, status, data = {}) {
        const key = this.getRelationKey(empire1, empire2);
        this.relations.set(key, {
            status,
            since: Date.now(),
            ...data
        });
    }

    proposeAlliance(fromEmpire, toEmpire) {
        // Add to pending proposals
        this.pendingProposals.push({
            type: 'alliance',
            from: fromEmpire,
            to: toEmpire,
            created: Date.now()
        });
    }

    acceptAlliance(fromEmpire, toEmpire) {
        // Find and remove the proposal
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'alliance' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx >= 0) {
            this.pendingProposals.splice(idx, 1);
            this.setRelation(fromEmpire, toEmpire, 'allied');
            return true;
        }
        return false;
    }

    rejectAlliance(fromEmpire, toEmpire) {
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'alliance' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx >= 0) {
            this.pendingProposals.splice(idx, 1);
            return true;
        }
        return false;
    }

    declareWar(fromEmpire, toEmpire) {
        const currentRelation = this.getRelation(fromEmpire, toEmpire);

        // Can't declare war on allies without breaking alliance first
        if (currentRelation === 'allied') {
            this.breakAlliance(fromEmpire, toEmpire);
        }

        this.setRelation(fromEmpire, toEmpire, 'war', {
            aggressor: fromEmpire
        });
    }

    proposePeace(fromEmpire, toEmpire) {
        const currentRelation = this.getRelation(fromEmpire, toEmpire);

        if (currentRelation !== 'war') {
            return false;
        }

        this.pendingProposals.push({
            type: 'peace',
            from: fromEmpire,
            to: toEmpire,
            created: Date.now()
        });

        return true;
    }

    acceptPeace(fromEmpire, toEmpire) {
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'peace' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx >= 0) {
            this.pendingProposals.splice(idx, 1);
            this.setRelation(fromEmpire, toEmpire, 'neutral');
            return true;
        }
        return false;
    }

    breakAlliance(empire1, empire2) {
        const currentRelation = this.getRelation(empire1, empire2);

        if (currentRelation === 'allied') {
            this.setRelation(empire1, empire2, 'neutral', {
                previouslyAllied: true
            });
            return true;
        }
        return false;
    }

    getRelationsFor(empireId) {
        const relations = {};

        this.relations.forEach((value, key) => {
            const empires = key.split('_');
            if (empires.includes(empireId)) {
                const otherEmpire = empires.find(e => e !== empireId);
                relations[otherEmpire] = value;
            }
        });

        return {
            relations,
            pendingProposals: this.pendingProposals.filter(p =>
                p.from === empireId || p.to === empireId
            )
        };
    }

    getAllRelations() {
        const result = {};
        this.relations.forEach((value, key) => {
            result[key] = value;
        });
        return {
            relations: result,
            pendingProposals: this.pendingProposals
        };
    }

    // Check if two empires can attack each other
    canAttack(empire1, empire2) {
        const relation = this.getRelation(empire1, empire2);
        return relation === 'war' || relation === 'neutral';
    }

    // Get all empires at war with given empire
    getEnemies(empireId) {
        const enemies = [];
        this.relations.forEach((value, key) => {
            if (value.status === 'war') {
                const empires = key.split('_');
                if (empires.includes(empireId)) {
                    const otherEmpire = empires.find(e => e !== empireId);
                    enemies.push(otherEmpire);
                }
            }
        });
        return enemies;
    }

    // Get all allies
    getAllies(empireId) {
        const allies = [];
        this.relations.forEach((value, key) => {
            if (value.status === 'allied') {
                const empires = key.split('_');
                if (empires.includes(empireId)) {
                    const otherEmpire = empires.find(e => e !== empireId);
                    allies.push(otherEmpire);
                }
            }
        });
        return allies;
    }
}
