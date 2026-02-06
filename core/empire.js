export class Empire {
    constructor({ id, name, color, homePlanet, speciesId = null }) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.homePlanet = homePlanet;
        this.speciesId = speciesId;  // Species ID for this empire
        this.founded = Date.now();
        this.defeated = false;
        this.score = 0;
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            homePlanet: this.homePlanet,
            speciesId: this.speciesId,
            founded: this.founded,
            defeated: this.defeated,
            score: this.score
        };
    }

    defeat() {
        this.defeated = true;
    }

    addScore(amount) {
        this.score += amount;
    }
}
