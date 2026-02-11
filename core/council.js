// ═══════════════════════════════════════════════════════════════════════════════
// GALACTIC COUNCIL - Periodic voting for Supreme Leader
// ═══════════════════════════════════════════════════════════════════════════════
// Inspired by Master of Orion's Galactic Council
//
// Every ELECTION_INTERVAL ticks, the council convenes. Empires vote based on
// their diplomatic weight (population + planets + influence). The elected
// Supreme Leader receives bonuses and diplomatic prestige.
// ═══════════════════════════════════════════════════════════════════════════════

export class GalacticCouncil {
    constructor() {
        // Election timing
        this.ELECTION_INTERVAL = 600;    // Every 10 minutes (600 ticks)
        this.VOTING_DURATION = 60;        // 1 minute voting period
        this.MIN_EMPIRES_FOR_COUNCIL = 2; // Need at least 2 empires
        
        // State
        this.currentLeader = null;         // Empire ID of current Supreme Leader
        this.leaderSince = null;           // Tick when elected
        this.leaderName = null;            // Cached leader name
        this.consecutiveTerms = 0;         // How many times in a row they've won
        
        // Voting state
        this.votingActive = false;
        this.votingStartTick = null;
        this.votes = new Map();            // empireId -> votedForEmpireId
        this.candidates = [];              // Eligible candidates
        
        // History
        this.electionHistory = [];         // Last 10 elections
        this.nextElectionTick = this.ELECTION_INTERVAL; // When next election happens
        
        // Supreme Leader bonuses
        this.LEADER_BONUSES = {
            diplomacy: 0.25,        // +25% faster diplomatic proposal acceptance
            influence: 0.20,        // +20% diplomatic weight in votes
            tradeBonus: 0.10,       // +10% trade income
            researchBonus: 0.05     // +5% research speed
        };
    }

    /**
     * Get council status for display
     */
    getStatus(currentTick, empires) {
        const ticksUntilElection = this.nextElectionTick - currentTick;
        const minutesUntilElection = Math.max(0, Math.ceil(ticksUntilElection / 60));
        
        // Get leader info
        let leaderInfo = null;
        if (this.currentLeader) {
            const leaderEmpire = empires.get(this.currentLeader);
            leaderInfo = {
                empireId: this.currentLeader,
                empireName: leaderEmpire?.name || 'Unknown',
                empireColor: leaderEmpire?.color || '#888',
                since: this.leaderSince,
                consecutiveTerms: this.consecutiveTerms,
                bonuses: this.LEADER_BONUSES
            };
        }
        
        // Get voting status if active
        let votingInfo = null;
        if (this.votingActive) {
            const votingTimeLeft = (this.votingStartTick + this.VOTING_DURATION) - currentTick;
            votingInfo = {
                active: true,
                secondsLeft: Math.max(0, votingTimeLeft),
                candidates: this.candidates.map(c => ({
                    empireId: c.empireId,
                    empireName: c.empireName,
                    empireColor: c.empireColor,
                    weight: c.weight,
                    votesReceived: this.countVotesFor(c.empireId)
                })),
                totalVotes: this.votes.size,
                eligibleVoters: this.candidates.length
            };
        }
        
        return {
            councilActive: empires.size >= this.MIN_EMPIRES_FOR_COUNCIL,
            currentLeader: leaderInfo,
            voting: votingInfo,
            nextElection: {
                tick: this.nextElectionTick,
                ticksRemaining: ticksUntilElection,
                minutesRemaining: minutesUntilElection
            },
            recentHistory: this.electionHistory.slice(-5)
        };
    }

    /**
     * Calculate diplomatic weight for an empire
     * Based on: population + planets * 10 + total resources / 100
     */
    calculateWeight(empire, planetCount, resourceManager) {
        const resources = resourceManager.getResources(empire.id) || {};
        const population = resources.population || 0;
        const totalResources = (resources.minerals || 0) + (resources.energy || 0) + 
                               (resources.food || 0) + (resources.research || 0) + 
                               (resources.credits || 0);
        
        let weight = population + (planetCount * 10) + Math.floor(totalResources / 100);
        
        // Incumbent bonus - current leader gets +20% influence
        if (this.currentLeader === empire.id) {
            weight = Math.floor(weight * (1 + this.LEADER_BONUSES.influence));
        }
        
        return Math.max(1, weight); // Minimum 1 vote
    }

    /**
     * Start the voting period
     */
    startVoting(currentTick, empires, getPlanetCount, resourceManager) {
        if (empires.size < this.MIN_EMPIRES_FOR_COUNCIL) {
            return { started: false, reason: 'Not enough empires for council' };
        }

        this.votingActive = true;
        this.votingStartTick = currentTick;
        this.votes.clear();
        
        // Build candidate list with weights
        this.candidates = [];
        for (const [empireId, empire] of empires) {
            const planetCount = getPlanetCount(empireId);
            const weight = this.calculateWeight(empire, planetCount, resourceManager);
            
            this.candidates.push({
                empireId,
                empireName: empire.name,
                empireColor: empire.color,
                weight,
                planetCount
            });
        }
        
        // Sort by weight descending
        this.candidates.sort((a, b) => b.weight - a.weight);
        
        return { 
            started: true, 
            candidates: this.candidates,
            votingEnds: currentTick + this.VOTING_DURATION
        };
    }

    /**
     * Cast a vote for an empire
     * @param {string} voterEmpireId - Empire casting the vote
     * @param {string} candidateEmpireId - Empire being voted for (or 'abstain')
     */
    castVote(voterEmpireId, candidateEmpireId) {
        if (!this.votingActive) {
            return { success: false, error: 'No election in progress' };
        }
        
        // Validate voter is a candidate (all empires can vote)
        const voter = this.candidates.find(c => c.empireId === voterEmpireId);
        if (!voter) {
            return { success: false, error: 'Empire not eligible to vote' };
        }
        
        // Validate candidate (can vote for self, others, or abstain)
        if (candidateEmpireId !== 'abstain') {
            const candidate = this.candidates.find(c => c.empireId === candidateEmpireId);
            if (!candidate) {
                return { success: false, error: 'Invalid candidate' };
            }
        }
        
        // Record vote (weighted by voter's diplomatic weight)
        this.votes.set(voterEmpireId, {
            votedFor: candidateEmpireId,
            weight: voter.weight
        });
        
        return { 
            success: true, 
            message: candidateEmpireId === 'abstain' 
                ? `${voter.empireName} abstained from voting` 
                : `${voter.empireName} voted for ${candidateEmpireId}`
        };
    }

    /**
     * Auto-vote for empires that haven't voted (AI empires vote for strongest ally or self)
     */
    autoVote(empireId, diplomacy) {
        if (this.votes.has(empireId)) return; // Already voted
        
        const voter = this.candidates.find(c => c.empireId === empireId);
        if (!voter) return;
        
        // Get allies
        const allies = diplomacy.getAllies(empireId);
        
        // Find strongest ally that's a candidate
        let bestAlly = null;
        let bestWeight = 0;
        
        for (const allyId of allies) {
            const allyCandidate = this.candidates.find(c => c.empireId === allyId);
            if (allyCandidate && allyCandidate.weight > bestWeight) {
                bestWeight = allyCandidate.weight;
                bestAlly = allyId;
            }
        }
        
        // Vote for strongest ally, or self if no allies
        const voteFor = bestAlly || empireId;
        this.castVote(empireId, voteFor);
    }

    /**
     * Count votes for a specific candidate
     */
    countVotesFor(empireId) {
        let totalWeight = 0;
        for (const [voterId, voteData] of this.votes) {
            if (voteData.votedFor === empireId) {
                totalWeight += voteData.weight;
            }
        }
        return totalWeight;
    }

    /**
     * Resolve the election
     */
    resolveElection(currentTick) {
        if (!this.votingActive) return null;
        
        // Count votes
        const voteCount = new Map();
        let totalVoteWeight = 0;
        
        for (const candidate of this.candidates) {
            voteCount.set(candidate.empireId, 0);
        }
        
        for (const [voterId, voteData] of this.votes) {
            if (voteData.votedFor !== 'abstain') {
                const current = voteCount.get(voteData.votedFor) || 0;
                voteCount.set(voteData.votedFor, current + voteData.weight);
                totalVoteWeight += voteData.weight;
            }
        }
        
        // Find winner
        let winner = null;
        let winnerVotes = 0;
        let runnerUp = null;
        let runnerUpVotes = 0;
        
        for (const [empireId, votes] of voteCount) {
            if (votes > winnerVotes) {
                runnerUp = winner;
                runnerUpVotes = winnerVotes;
                winner = empireId;
                winnerVotes = votes;
            } else if (votes > runnerUpVotes) {
                runnerUp = empireId;
                runnerUpVotes = votes;
            }
        }
        
        // Plurality wins (most votes) - minimum 5% of total to prevent edge cases
        // With 20 factions, even 10% is too high (top vote gets ~9%)
        const minimumThreshold = totalVoteWeight * 0.05;
        const hasWinner = winner && winnerVotes >= minimumThreshold;
        
        // Update state
        const previousLeader = this.currentLeader;
        
        if (hasWinner) {
            if (winner === this.currentLeader) {
                this.consecutiveTerms++;
            } else {
                this.consecutiveTerms = 1;
            }
            this.currentLeader = winner;
            this.leaderSince = currentTick;
            this.leaderName = this.candidates.find(c => c.empireId === winner)?.empireName || 'Unknown';
        } else {
            // No majority - leader remains or position vacant
            if (!this.currentLeader) {
                // Still no leader
            }
        }
        
        // Build election result
        const result = {
            tick: currentTick,
            timestamp: Date.now(),
            winner: hasWinner ? winner : null,
            winnerName: hasWinner ? this.leaderName : null,
            winnerVotes,
            runnerUp,
            runnerUpName: this.candidates.find(c => c.empireId === runnerUp)?.empireName || null,
            runnerUpVotes,
            totalVotes: totalVoteWeight,
            majorityReached: hasWinner,
            voteBreakdown: Object.fromEntries(voteCount),
            previousLeader,
            consecutiveTerms: this.consecutiveTerms
        };
        
        // Add to history
        this.electionHistory.push(result);
        if (this.electionHistory.length > 10) {
            this.electionHistory = this.electionHistory.slice(-10);
        }
        
        // Reset voting state
        this.votingActive = false;
        this.votingStartTick = null;
        this.votes.clear();
        
        // Schedule next election
        this.nextElectionTick = currentTick + this.ELECTION_INTERVAL;
        
        return result;
    }

    /**
     * Check if an empire is the current Supreme Leader
     */
    isSupremeLeader(empireId) {
        return this.currentLeader === empireId;
    }

    /**
     * Get bonuses for the Supreme Leader
     */
    getLeaderBonuses(empireId) {
        if (this.currentLeader !== empireId) {
            return null;
        }
        return { ...this.LEADER_BONUSES };
    }

    /**
     * Tick update - check for election timing
     */
    tick(currentTick, empires, getPlanetCount, resourceManager, diplomacy) {
        // Check if we should start voting
        if (!this.votingActive && currentTick >= this.nextElectionTick) {
            const result = this.startVoting(currentTick, empires, getPlanetCount, resourceManager);
            if (result.started) {
                return { event: 'voting_started', data: result };
            }
        }
        
        // Check if voting period ended
        if (this.votingActive && currentTick >= this.votingStartTick + this.VOTING_DURATION) {
            // Auto-vote for any empire that hasn't voted
            for (const candidate of this.candidates) {
                this.autoVote(candidate.empireId, diplomacy);
            }
            
            const result = this.resolveElection(currentTick);
            return { event: 'election_resolved', data: result };
        }
        
        return null;
    }

    /**
     * Load state from save data
     */
    loadState(saved) {
        if (!saved) return;
        
        this.currentLeader = saved.currentLeader || null;
        this.leaderSince = saved.leaderSince || null;
        this.leaderName = saved.leaderName || null;
        this.consecutiveTerms = saved.consecutiveTerms || 0;
        this.nextElectionTick = saved.nextElectionTick || this.ELECTION_INTERVAL;
        this.electionHistory = saved.electionHistory || [];
        
        // Don't load active voting state - it'll restart fresh
        this.votingActive = false;
        this.votes.clear();
        
        console.log(`   📂 Council: Leader is ${this.leaderName || 'none'}, next election at tick ${this.nextElectionTick}`);
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            currentLeader: this.currentLeader,
            leaderSince: this.leaderSince,
            leaderName: this.leaderName,
            consecutiveTerms: this.consecutiveTerms,
            nextElectionTick: this.nextElectionTick,
            electionHistory: this.electionHistory
        };
    }
}
