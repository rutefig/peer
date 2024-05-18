import { Bool, Experimental, MerkleMapWitness, Nullifier, Poseidon, Struct } from "o1js";
import {
    RuntimeModule,
    runtimeMethod,
    state,
    runtimeModule,
  } from "@proto-kit/module";


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
export class PublicationPublicOutput extends Struct({}) { }

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
    return new PublicationPublicOutput({});
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

export class publishProof extends Experimental.ZkProgram.Proof(publishCircuit) {}

// TODO: check this
type PublicationConfig = Record<string, never>;

@runtimeModule()
export class Publication extends RuntimeModule<PublicationConfig> {}
