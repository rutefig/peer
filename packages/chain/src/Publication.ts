import { Bool, CircuitString, Experimental, Field, MerkleMapWitness, MerkleTree, Nullifier, Poseidon, Struct, UInt64 } from "o1js";
import {
    RuntimeModule,
    runtimeMethod,
    state,
    runtimeModule,
} from "@proto-kit/module";
import { State, StateMap } from "@proto-kit/protocol";
import { UInt32 } from "@proto-kit/library";


// export const id = Experimental.ZkProgram({
//     publicOutput: {
//         hasValidEmail: Bool,
//     },
//     methods: {
//       canClaim: {
//         privateInputs: [MerkleMapWitness, Nullifier],
//         method: canClaim,
//       },
//     },
//   });

// export class IdProof extends Experimental.ZkProgram.Proof();



// PublicationPublicOutput
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

// TODO: check this
type PublicationsConfig = Record<string, never>;

export class Publication extends Struct({
    content: CircuitString,
    timestamp: UInt64,
    score: UInt64
}) {}

@runtimeModule()
export class Publications extends RuntimeModule<PublicationsConfig> {
    @state() public publications = StateMap.from<UInt64, Publication>(
        UInt64,
        Publication
    );

    publish(publishProof: PublishProof) { }
}
