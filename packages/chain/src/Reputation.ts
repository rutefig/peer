import { RuntimeModule, runtimeModule } from "@proto-kit/module";
import { Experimental, Struct } from "o1js";

export class ReviewPublicOutput extends Struct({}) {}

// canReview function for the publish circuit
// private inputs: proof of identity (zkemail or something else) - this is gonna be abstracted for now
export function canReview(): ReviewPublicOutput {
    return new ReviewPublicOutput({});
}

export const reviewCircuit = Experimental.ZkProgram({
    publicOutput: ReviewPublicOutput,
    methods: {
        canReview: {
            privateInputs: [],
            method: canReview,
        },
    },
});

export class reviewProof extends Experimental.ZkProgram.Proof(reviewCircuit) {}

// TODO: check this
type ReputationConfig = Record<string, never>;

@runtimeModule()
export class Reputation extends RuntimeModule<ReputationConfig> {}