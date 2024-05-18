import { RuntimeModule, runtimeMethod, state } from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Bool, Experimental, Field, MerkleMapWitness, Nullifier, Poseidon, Struct, UInt64 } from "o1js";
import { Publications } from "./Publication";
import { Balances } from "@proto-kit/library";
import { inject } from 'tsyringe';
import { Reputation } from "./Reputation";

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

type ZKPeerConfig = Record<string, never>;

export class ZKPeer extends RuntimeModule<ZKPeerConfig> {
    @state() public commitment = State.from<Field>(Field);
    // the nullifier will map the pseudo-user to the root of his hash tree of publications
    @state() public nullifiers = StateMap.from<Field, UInt64>(Field, UInt64);

    public constructor(
        @inject("Balances") private balances: Balances,
        @inject("Publications") private publications: Publications,
        @inject("Reputation") private reputation: Reputation
    ) {
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


        this.publications.add()
    }

    @runtimeMethod()
    public review() { }
}
