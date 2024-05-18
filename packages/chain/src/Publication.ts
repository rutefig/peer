import { Bool, CircuitString, Experimental, Field, MerkleMapWitness, MerkleTree, Nullifier, Poseidon, Struct, UInt64 } from "o1js";
import {
    RuntimeModule,
    state,
    runtimeModule,
} from "@proto-kit/module";
import { StateMap } from "@proto-kit/protocol";

// TODO: check this
type PublicationsConfig = Record<string, never>;

export class Publication extends Struct({
    content: CircuitString,
    timestamp: UInt64,
    score: UInt64
}) { }

@runtimeModule()
export class Publications extends RuntimeModule<PublicationsConfig> {
    @state() public publications = StateMap.from<UInt64, Publication>(
        UInt64,
        Publication
    );

    add() {}
}
