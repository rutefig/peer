import { RuntimeModule, runtimeModule, state } from "@proto-kit/module";
import { StateMap } from "@proto-kit/protocol";
import { Experimental, Struct, UInt64 } from "o1js";

// TODO: check this
type ReputationConfig = Record<string, never>;

@runtimeModule()
export class Reputation extends RuntimeModule<ReputationConfig> {
    @state() public reputations = StateMap.from<UInt64, UInt64>(
        UInt64,
        UInt64
    );

    add() {}
}