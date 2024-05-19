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
}) { }

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

export const publishCircuit = Experimental.ZkProgram({
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
export class ReviewPublicOutput extends Struct({
    root: Field,
    nullifier: Field,
}) { }

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
        const publicationId = Poseidon.hash(
            [publishProof.publicOutput.nullifier, 
            ...publication.timestamp.toFields()],
        );

        // Store the publication
        this.publications.set(publicationId, publication);

        // Associate the publication with the author's nullifier
        this.publicationAuthors.set(publicationId, publishProof.publicOutput.nullifier);

        // Update author's reputation
        this.updateReputation(publishProof.publicOutput.nullifier);
    }

    @runtimeMethod()
    public review(reviewProof: ReviewProof, publicationId: Field, score: UInt64) {
        reviewProof.verify();

        // Retrieve the publication
        const publicationOption = this.publications.get(publicationId);
        assert(publicationOption.isSome, "Publication does not exist");

        const publication = publicationOption.value;

        // Retrieve the reviewer's nullifier and reputation
        const reviewerNullifier = reviewProof.publicOutput.nullifier;
        const reviewerReputationOption = this.reputations.get(reviewerNullifier);
        const reviewerReputation = reviewerReputationOption.isSome ? reviewerReputationOption.value : UInt64.zero;

        // Assert reviewer reputation is greater than 0
        assert(
            reviewerReputation.greaterThan(UInt64.zero),
            "Caller cannot review, reputation must be greater than 0"
        );

        // Weight the review score with the reviewer's reputation
        const weightedScore = score.mul(reviewerReputation.add(UInt64.one));
        // Update the publication score
        const updatedScore = publication.score.add(weightedScore);
        this.publications.set(publicationId, new Publication({
            content: publication.content,
            timestamp: publication.timestamp,
            score: updatedScore
        }));

        // Retrieve the author's nullifier
        const authorNullifierOption = this.publicationAuthors.get(publicationId);
        assert(authorNullifierOption.isSome, "Author not found for the publication");

        const authorNullifier = authorNullifierOption.value;

        // Update the author's reputation
        this.updateReputation(authorNullifier);

        // Increment the reviewer's reputation
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