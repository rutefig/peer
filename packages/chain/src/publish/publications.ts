import { Runtime, RuntimeModule, state } from "@proto-kit/module";
import { StateMap } from "@proto-kit/protocol";
import { Field, Provable, PublicKey, Struct, UInt64 } from "o1js";

export class PublicationId extends Field { }
export class Publication extends Struct({
    author: PublicKey,
    createdAt: UInt64,
    rating: UInt64,
}) { }

export class Publications extends RuntimeModule<unknown> {
    @state() public publications = StateMap.from(
        PublicKey,
        Provable.Array(Publication, 8)
    );

    public mint(to: PublicKey, publication: Publication) {
        const publicationsOption = this.publications.get(to);
        if (publicationsOption.isSome) {
            const publications = publicationsOption.value;
            publications.push(publication);
            this.publications.set(to, publications);
        } else {
            // Handle the case where there is no value
        }
    }
}