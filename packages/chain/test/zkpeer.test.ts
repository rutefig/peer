import "reflect-metadata";
import { TestingAppChain } from "@proto-kit/sdk";
import { ZKPeer, PublishProof, ReviewProof, Publication, PublicationPublicOutput, ReviewPublicOutput, canPublish, canReview } from "../src/ZKPeer";
import { Field, PrivateKey, Nullifier, MerkleMap, Poseidon, Bool, UInt64, CircuitString } from "o1js";
import { Balances } from "@proto-kit/library";
import { Pickles } from "o1js/dist/node/snarky";
import { dummyBase64Proof } from "o1js/dist/node/lib/proof_system";

describe("ZKPeer", () => {
    let appChain: ReturnType<
        typeof TestingAppChain.fromRuntime<{ ZKPeer: typeof ZKPeer }>
    >;
    let zkPeer: ZKPeer;

    const aliceKey = PrivateKey.random();
    const alice = aliceKey.toPublicKey();
    const bobKey = PrivateKey.random();
    const bob = bobKey.toPublicKey();

    const map = new MerkleMap();
    const aliceKeyHash = Poseidon.hash(alice.toFields());
    const bobKeyHash = Poseidon.hash(bob.toFields());
    map.set(aliceKeyHash, Bool(true).toField());
    map.set(bobKeyHash, Bool(true).toField());

    const aliceWitness = map.getWitness(aliceKeyHash);
    const bobWitness = map.getWitness(bobKeyHash);

    async function mockPublishProof(publicOutput: PublicationPublicOutput): Promise<PublishProof> {
        const [, proof] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);
        return new PublishProof({
            proof: proof,
            maxProofsVerified: 2,
            publicInput: undefined,
            publicOutput,
        });
    }

    async function mockReviewProof(publicOutput: ReviewPublicOutput): Promise<ReviewProof> {
        const [, proof] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);
        return new ReviewProof({
            proof: proof,
            maxProofsVerified: 2,
            publicInput: undefined,
            publicOutput,
        });
    }

    beforeAll(async () => {
        appChain = TestingAppChain.fromRuntime({
            ZKPeer,
        });
        await appChain.configurePartial({
            Runtime: {
                ZKPeer: {},
                Balances: {},
            },
        });
        await appChain.start();

        appChain.setSigner(aliceKey);

        zkPeer = appChain.runtime.resolve("ZKPeer");
    });

    it("should set the commitment", async () => {
        const tx = await appChain.transaction(alice, () => {
            zkPeer.setCommitment(map.getRoot());
        });

        await tx.sign();
        await tx.send();

        await appChain.produceBlock();

        const commitment = await appChain.query.runtime.ZKPeer.commitment.get();

        expect(commitment?.toBigInt()).toBe(map.getRoot().toBigInt());
    });

    it("should publish a paper", async () => {
        const nullifier = Nullifier.fromJSON(Nullifier.createTestNullifier([], aliceKey));
        const publishProof = await mockPublishProof(canPublish(aliceWitness, nullifier));
        const publication = new Publication({
            content: CircuitString.fromString('Test Content'),
            timestamp: UInt64.from(Date.now()),
            score: UInt64.zero,
        });

        const tx = await appChain.transaction(alice, () => {
            zkPeer.publish(publishProof, publication);
        });

        await tx.sign();
        await tx.send();

        await appChain.produceBlock();

        const publicationId = Poseidon.hash([publishProof.publicOutput.nullifier, ...publication.timestamp.toFields()]);
        const storedPublication = await appChain.query.runtime.ZKPeer.publications.get(publicationId);

        expect(storedPublication).toBeTruthy();
        expect(storedPublication).toEqual(publication);
    });

    it("should review a paper and update scores", async () => {
        const nullifier = Nullifier.fromJSON(Nullifier.createTestNullifier([], aliceKey));
        const publishProof = await mockPublishProof(canPublish(aliceWitness, nullifier));
        const publication = new Publication({
            content: CircuitString.fromString('Test Content'),
            timestamp: UInt64.from(Date.now()),
            score: UInt64.zero,
        });

        const publishTx = await appChain.transaction(alice, () => {
            zkPeer.publish(publishProof, publication);
        });

        await publishTx.sign();
        await publishTx.send();

        await appChain.produceBlock();

        const publicationId = Poseidon.hash([publishProof.publicOutput.nullifier, ...publication.timestamp.toFields()]);

        const reviewerNullifier = Nullifier.fromJSON(Nullifier.createTestNullifier([], bobKey));
        const reviewProof = await mockReviewProof(canReview(bobWitness, reviewerNullifier));

        // Setting initial reputation for the reviewer
        await zkPeer.reputations.set(reviewProof.publicOutput.nullifier, UInt64.from(5));

        const reviewTx = await appChain.transaction(bob, () => {
            zkPeer.review(reviewProof, publicationId, UInt64.from(10));
        });

        await reviewTx.sign();
        await reviewTx.send();

        await appChain.produceBlock();

        const updatedPublication = (await appChain.query.runtime.ZKPeer.publications.get(publicationId));
        const expectedScore = publication.score.add(UInt64.from(60)); // 10 * 6 (5 + 1 initial reputation increment)

        expect(updatedPublication).toBeTruthy();
        expect(updatedPublication?.score).toEqual(expectedScore);

        // Validate updated author reputation
        const authorReputation = (await appChain.query.runtime.ZKPeer.reputations.get(publishProof.publicOutput.nullifier));
        expect(authorReputation).toEqual(UInt64.from(1)); // Initial reputation incremented

        // Validate updated reviewer reputation
        const reviewerReputation = (await appChain.query.runtime.ZKPeer.reputations.get(reviewProof.publicOutput.nullifier));
        expect(reviewerReputation).toEqual(UInt64.from(6)); // Initial reputation 5 + 1
    });
});