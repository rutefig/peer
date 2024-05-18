import { RuntimeModule, runtimeMethod, state } from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Bool, CircuitString, Experimental, Field, MerkleMapWitness, Nullifier, Poseidon, Struct, UInt64 } from "o1js";
import { Balances } from "@proto-kit/library";
import { inject } from 'tsyringe';

///////////////////////////////////////////////////////
////////////////// Publication Proof //////////////////
///////////////////////////////////////////////////////
export class PublicationPublicOutput extends Struct({
    root: Field,
    nullifier: Field,
}) { }

// canPublish function for the publish circuit
// private inputs: proof of identity (zkemail or something else) - this is gonna be abstracted for now
export function canPublish(witness: MerkleMapWitness, nullifier: Nullifier): PublicationPublicOutput {
    // verify identity proof


    const key = Poseidon.hash(nullifier.getPublicKey().toFields());
    const [computedRoot, computedKey] = witness.computeRootAndKey(
        Bool(true).toField()
    );

    // has reputation already? maybe here is an if
    // if this assertion is ok, otherwise we will just update the merkle tree with its key
    computedKey.assertEquals(key);


    // returns the publication 
    return new PublicationPublicOutput({
        root: computedRoot,
        nullifier: key,
    });
}

export const publishCircuit = Experimental.ZkProgram({
    // publicInput: idProof,
    publicOutput: PublicationPublicOutput,
    methods: {
        canPublish: {
            privateInputs: [MerkleMapWitness, Nullifier],
            method: canPublish,
        },
    },
});

export class PublishProof extends Experimental.ZkProgram.Proof(publishCircuit) { }

///////////////////////////////////////////////////////
////////////////// Review Proof //////////////////
///////////////////////////////////////////////////////
// canReview function for the publish circuit
// private inputs: proof of identity (zkemail or something else) - this is gonna be abstracted for now
export class ReviewPublicOutput extends Struct({}) { }

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

export class reviewProof extends Experimental.ZkProgram.Proof(reviewCircuit) { }

type ZKPeerConfig = Record<string, never>;

export class Publication extends Struct({
    content: CircuitString,
    timestamp: UInt64,
    score: UInt64
}) { }

export class ZKPeer extends RuntimeModule<ZKPeerConfig> {
    @state() public commitment = State.from<Field>(Field);
    // the nullifier will map the pseudo-user to the key of his publications
    @state() public nullifiers = StateMap.from<Field, UInt64>(Field, UInt64);
    @state() public reputations = StateMap.from<UInt64, UInt64>(
        UInt64,
        UInt64
    );
    @state() public publications = StateMap.from<UInt64, Publication>(
        UInt64,
        Publication
    );

    public constructor(@inject("Balances") private balances: Balances) {
        super();
    }

    @runtimeMethod()
    public setCommitment(commitment: Field) {
        this.commitment.set(commitment);
    }

    @runtimeMethod()
    public publish(publishProof: PublishProof) {
        publishProof.verify();
        const commitment = this.commitment.get();

        assert(
            publishProof.publicOutput.root.equals(commitment.value),
            "Publish proof does not contain the correct commitment"
        );


    }

    @runtimeMethod()
    public review() { }
}
