import "reflect-metadata"; //error handling
import { RuntimeModule, runtimeMethod, state } from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Bool, CircuitString, Experimental, Field, MerkleMapWitness, Nullifier, Poseidon, Struct, UInt64 } from "o1js";
import { Balances } from "@proto-kit/library";
import { inject, injectable } from 'tsyringe';
//import { calculateScore, calculatePercentile } from "./ReputationCalculator"
//import { sumOfIndices, ScoreElement } from "./PeerReview";

///////////////////////////////////////////////////////
////////////////// Publication Proof //////////////////
///////////////////////////////////////////////////////
export class PublicationPublicOutput extends Struct({
    root: Field,
    nullifier: Field,
}) {}

// Publication Verification
export function canPublish(witness: MerkleMapWitness, nullifier: Nullifier): PublicationPublicOutput {
    const key = Poseidon.hash(nullifier.getPublicKey().toFields());
    const [computedRoot, computedKey] = witness.computeRootAndKey(
        Bool(true).toField()
    );

    computedKey.assertEquals(key);

    return new PublicationPublicOutput({
        root: computedRoot,
        nullifier: key,
    });
}

// Publish Circuit
export const publishCircuit = Experimental.ZkProgram({
    publicOutput: PublicationPublicOutput,
    methods: {
        canPublish: {
            privateInputs: [MerkleMapWitness, Nullifier],
            method: canPublish,
        },
    },
});

export class PublishProof extends Experimental.ZkProgram.Proof(publishCircuit) {}

///////////////////////////////////////////////////////
////////////////// Review Proof //////////////////
///////////////////////////////////////////////////////
export class ReviewPublicOutput extends Struct({
    root: Field,
    nullifier: Field,
}) {}

// Review Verification
export function canReview(witness: MerkleMapWitness, nullifier: Nullifier): ReviewPublicOutput {
    const key = Poseidon.hash(nullifier.getPublicKey().toFields());
    const [computedRoot, computedKey] = witness.computeRootAndKey(
        Bool(true).toField()
    );

    computedKey.assertEquals(key);

    return new ReviewPublicOutput({
        root: computedRoot,
        nullifier: key,
    });
}

// Review Circuit
export const reviewCircuit = Experimental.ZkProgram({
    publicOutput: ReviewPublicOutput,
    methods: {
        canReview: {
            privateInputs: [MerkleMapWitness, Nullifier],
            method: canReview,
        },
    },
});

export class ReviewProof extends Experimental.ZkProgram.Proof(reviewCircuit) {}

type ZKPeerConfig = Record<string, never>;

export class Publication extends Struct({
    content: CircuitString,
    timestamp: UInt64,
    score: UInt64
}) { }

@injectable()
export class ZKPeer extends RuntimeModule<ZKPeerConfig> {
    @state() public commitment = State.from<Field>(Field);
    @state() public reputations = StateMap.from<Field, UInt64>(
        Field,
        UInt64
    );
    @state() public publications = StateMap.from<Field, Publication>(
        Field,
        Publication
    );
    @state() public publicationAuthors = StateMap.from<Field, Field>(
        Field,
        Field
    );
    @state() public userReviews = StateMap.from<Field, Bool>( // New state for tracking reviews
        Field,
        Bool
    );

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

        const publicationId = Poseidon.hash(
            [publishProof.publicOutput.nullifier, 
            ...publication.timestamp.toFields()],
        );

        this.publications.set(publicationId, publication);
        this.publicationAuthors.set(publicationId, publishProof.publicOutput.nullifier);
        this.updateReputation(publishProof.publicOutput.nullifier);
    }

    @runtimeMethod()
    public review(reviewProof: ReviewProof, publicationId: Field, score: UInt64) {
        reviewProof.verify();

        const publicationOption = this.publications.get(publicationId);
        assert(publicationOption.isSome, "Publication does not exist");

        const publication = publicationOption.value;

        const reviewerNullifier = reviewProof.publicOutput.nullifier;

        // Create a unique key for this review
        const reviewKey = Poseidon.hash([reviewerNullifier, publicationId]);

        // Check if the user has already reviewed this publication
        const hasReviewed = this.userReviews.get(reviewKey);
        assert(hasReviewed.isSome.not(), "User has already reviewed this publication");

        const reviewerReputationOption = this.reputations.get(reviewerNullifier);
        const reviewerReputation = reviewerReputationOption.isSome ? reviewerReputationOption.value : UInt64.zero;

        assert(
            reviewerReputation.greaterThan(UInt64.zero),
            "Caller cannot review, reputation must be greater than 0"
        );

        const weightedScore = score.mul(reviewerReputation.add(UInt64.one));
        const updatedScore = publication.score.add(weightedScore);
        this.publications.set(publicationId, new Publication({
            content: publication.content,
            timestamp: publication.timestamp,
            score: updatedScore
        }));

        const authorNullifierOption = this.publicationAuthors.get(publicationId);
        assert(authorNullifierOption.isSome, "Author not found for the publication");

        const authorNullifier = authorNullifierOption.value;

        // Mark this publication as reviewed by the user
        this.userReviews.set(reviewKey, Bool(true));

        this.updateReputation(authorNullifier);
        this.updateReputation(reviewerNullifier);
    }

    private updateReputation(nullifier: Field) {
        const reputationOption = this.reputations.get(nullifier);
        if (reputationOption.isSome) {
            this.reputations.set(nullifier, reputationOption.value.add(UInt64.one));
        } else {
            this.reputations.set(nullifier, UInt64.one);
        }
    }
}