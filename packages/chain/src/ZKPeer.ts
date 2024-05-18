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
export class ReviewPublicOutput extends Struct({
    root: Field,
    nullifier: Field,
}) { }

export function canReview(witness: MerkleMapWitness, nullifier: Nullifier): ReviewPublicOutput {
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

export const reviewCircuit = Experimental.ZkProgram({
    publicOutput: ReviewPublicOutput,
    methods: {
        canReview: {
            privateInputs: [MerkleMapWitness, Nullifier],
            method: canReview,
        },
    },
});

export class ReviewProof extends Experimental.ZkProgram.Proof(reviewCircuit) { }

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
    @state() public reputations = StateMap.from<Field, UInt64>(
        Field,
        UInt64
    );
    @state() public publications = StateMap.from<Field, Publication>(
        Field,
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
    public publish(publishProof: PublishProof, publication: Publication) {
        publishProof.verify();
        const commitment = this.commitment.get();

        assert(
            publishProof.publicOutput.root.equals(commitment.value),
            "Publish proof does not contain the correct commitment"
        );

        // Generate a unique publication ID
        const publicationId = Poseidon.hash([publishProof.publicOutput.nullifier, Field(publication.timestamp.toString())]);

        // Store the publication
        this.publications.set(publicationId, publication);

        // Notify people that there is a new publication
    }

    @runtimeMethod()
    public review(reviewProof: ReviewProof, publicationId: Field, score: UInt64) {
        reviewProof.verify();

        // Retrieve the publication
        const publication = this.publications.get(publicationId);
        assert(publication.isSome, "Publication does not exist");

        // Retrieve the reviewer's nullifier and reputation
        const reviewerNullifier = reviewProof.publicOutput.nullifier;
        const reviewerReputation = this.reputations.get(reviewerNullifier);
        // Assert reviewer reputation is greater than 0
        assert(
            reviewerReputation.value.greaterThan(UInt64.zero),
            "Caller cannot review, reputation must be greater than 0"
        );

        // Weight the review score with the reviewer's reputation
        const weightedScore = score.mul(reviewerReputation.value);
        // Update the publication score
        const updatedScore = publication.value.score.add(weightedScore);
        this.publications.set(publicationId, new Publication({
            content: publication.value.content,
            timestamp: publication.value.timestamp,
            score: updatedScore
        }));

        // Get the author's nullifier (assuming it can be derived from the publicationId)
        const authorNullifier = Poseidon.hash([publicationId]); // Adjust this if necessary

        // Update the author's reputation
        this.updateReputation(authorNullifier);
    }

    private updateReputation(nullifier: Field) {
        const reputation = this.reputations.get(nullifier);
        if (reputation.isSome) {
            this.reputations.set(nullifier, reputation.value.add(UInt64.one));
        } else {
            this.reputations.set(nullifier, UInt64.one);
        }
    }
}
