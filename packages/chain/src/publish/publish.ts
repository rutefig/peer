import { RuntimeModule, runtimeMethod, runtimeModule, state } from "@proto-kit/module";
import { State, StateMap } from "@proto-kit/protocol";
import { Bool, Experimental, Field, MerkleMapWitness, Nullifier, Poseidon, Provable, PublicKey, Struct } from "o1js";
import { Publication, PublicationId } from "./publications";

type PublishConfig = Record<string, never>;

export class PublishPublicOutput extends Struct({
    root: Field,
    nullifier: Field,
    publicationId: Field,
}) { }

export const message: Field[] = [Field(0)];     // TODO: randomise message

export function canPublish(
    witness: MerkleMapWitness,
    nullifier: Nullifier,
): PublishPublicOutput {
    const key = Poseidon.hash(nullifier.getPublicKey().toFields());
    const [computedRoot, computedKey] = witness.computeRootAndKey(
        Bool(true).toField()
    );
    computedKey.assertEquals(key);

    nullifier.verify(message);

    // create an id for the publication
    const publicationId = Poseidon.hash([
        computedKey,
        nullifier.key(),
    ]);

    return new PublishPublicOutput({
        root: computedRoot,
        nullifier: nullifier.key(),
        publicationId,
    });
}

export const publish = Experimental.ZkProgram({
    publicOutput: PublishPublicOutput,
    methods: {
        canPublish: {
            privateInputs: [MerkleMapWitness, Nullifier],
            method: canPublish,
        },
    },
});

export class PublishProof extends Experimental.ZkProgram.Proof(publish) { }

@runtimeModule()
export class Publish extends RuntimeModule<PublishConfig> {
    // commitment to the publications merkle tree
    @state() public commitment = State.from<Field>(Field);
    @state() public publications = StateMap.from(PublicKey, Provable.Array(Publication, 8));

    @runtimeMethod()
    public setCommitment(commitment: Field) {
        this.commitment.set(commitment);
    }

    @runtimeMethod()
    public publish(publishProof: PublishProof) {
        // check if the publisher is legit to publish - verify the proof
        publishProof.verify();
        const commitment = this.commitment.get();

        // get the commitment
    }
}