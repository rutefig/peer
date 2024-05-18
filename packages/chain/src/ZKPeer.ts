import { RuntimeModule, runtimeMethod, state } from "@proto-kit/module";
import { State, StateMap } from "@proto-kit/protocol";
import { Bool, Field, UInt64 } from "o1js";
import { Publications } from "./Publication";
import { Balances } from "@proto-kit/library";
import { inject } from 'tsyringe';

type ZKPeerConfig = Record<string, never>;

export class ZKPeer extends RuntimeModule<ZKPeerConfig> {
    @state() public commitment = State.from<Field>(Field);
    // the nullifier will map the pseudo-user to the root of his hash tree of publications
    @state() public nullifiers = StateMap.from<Field, UInt64>(Field, UInt64);

    public constructor(@inject("Balances") private balances: Balances) {
        super();
    }

    @runtimeMethod()
    public setCommitment(commitment: Field) {
        this.commitment.set(commitment);
    }

    @runtimeMethod()
    public publish() {}

    @runtimeMethod()
    public review() {}
}
