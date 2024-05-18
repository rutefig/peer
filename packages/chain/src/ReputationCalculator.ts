
export function calculateScore(p: number, c: number, r: number): number {
    return 3 * p + 4 * c + 3 * r;
}

export function calculatePercentile(score: number, scores: number[]): number {
    scores.sort((a, b) => a - b);
    const N = scores.length;
    const n = scores.filter(s => s <= score).length;
    return (n / N) * 100;
}
