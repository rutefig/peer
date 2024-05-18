interface ScoreElement {
    reputation: number;
    vote: number;
}

export function sumOfIndices(reputations: ScoreElement[]): { sumOfPositives: number, sumOfNegatives: number } {
    // Sort the array in descending order based on score
    const sortedreputations = reputations.slice().sort((a, b) => b.reputation - a.reputation);

    let sumOfPositives = 0;
    let sumOfNegatives = 0;

    for (let i = 0; i < sortedreputations.length; i++) {
        if (sortedreputations[i].vote === 1) {
            sumOfPositives += i;
        } else if (sortedreputations[i].vote === -1) {
            sumOfNegatives += i;
        }
    }

    return { sumOfPositives, sumOfNegatives };
}
