// import { TestingAppChain } from "@proto-kit/sdk";
// import { PrivateKey } from "o1js";
// import { ZKPeer } from "../src/ZKPeer"
// import { Balances } from "../src/balances";
// import { log } from "@proto-kit/common";
// import { BalancesKey, TokenId, UInt64 } from "@proto-kit/library";

// log.setLevel("ERROR");

// describe("ZKPeer", () => {
//     it("demonstrates how peer works", async () =>{
//         const appChain = TestingAppChain.fromRuntime({
//             ZKPeer
//           });
        
//           appChain.configurePartial({
//             Runtime: {
//                 Balances: {},
//                 ZKPeer: {},
//             },
//           });

//           await appChain.start();

//           const zkpeer = appChain.runtime.resolve("ZKPeer");

//           const tx1 = await appChain.transaction(alice, () => {
//             zkpeer.review(reviewProof, publicationId, score);
//           });

//     },1_000_000);
// }

// )

import { TestingAppChain } from "@proto-kit/sdk";
import { PrivateKey, Field, UInt64 } from "o1js";
import { Balances } from "@proto-kit/library";
import { log } from "@proto-kit/common";
import { ZKPeer, PublishProof, ReviewProof, Publication } from "../src/zkpeer";
import { MerkleMapWitness, Nullifier, Poseidon } from "o1js";

log.setLevel("ERROR");

describe("zkpeer", () => {
  it("should correctly handle publishing a publication", async () => {
    const appChain = TestingAppChain.fromRuntime({
      ZKPeer,
      Balances,
    });

    const totalSupply = UInt64.from(10000);
    const initialCommitment = Field(1);
    const nullifier = new Nullifier(PrivateKey.random());
    const witness = new MerkleMapWitness([initialCommitment]);

    appChain.configurePartial({
      Runtime: {
        Balances: {
          totalSupply,
        },
        ZKPeer: {
          commitment: initialCommitment,
        },
      },
    });

    await appChain.start();

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();
    appChain.setSigner(alicePrivateKey);

    const zkPeer = appChain.runtime.resolve("ZKPeer");

    const publication = new Publication({
      content: "Test Content",
      timestamp: UInt64.from(Date.now()),
      score: UInt64.zero,
    });

    const publishProof = PublishProof.generate({
      witness,
      nullifier,
    });

    const tx = await appChain.transaction(alice, () => {
      zkPeer.publish(publishProof, publication);
    });

    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();

    const publicationId = Poseidon.hash([
      publishProof.publicOutput.nullifier,
      Field(publication.timestamp.toString()),
      Field(publication.content.toString()),
    ]);

    const storedPublication = await appChain.query.runtime.ZKPeer.publications.get(
      publicationId
    );

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(storedPublication?.content.toString()).toBe("Test Content");
  }, 1_000_000);

  it("should correctly handle reviewing a publication", async () => {
    const appChain = TestingAppChain.fromRuntime({
      ZKPeer,
      Balances,
    });

    const totalSupply = UInt64.from(10000);
    const initialCommitment = Field(1);
    const nullifier = new Nullifier(PrivateKey.random());
    const witness = new MerkleMapWitness([initialCommitment]);

    appChain.configurePartial({
      Runtime: {
        Balances: {
          totalSupply,
        },
        ZKPeer: {
          commitment: initialCommitment,
        },
      },
    });

    await appChain.start();

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();
    appChain.setSigner(alicePrivateKey);

    const zkPeer = appChain.runtime.resolve("ZKPeer");

    const publication = new Publication({
      content: "Test Content",
      timestamp: UInt64.from(Date.now()),
      score: UInt64.zero,
    });

    const publishProof = PublishProof.generate({
      witness,
      nullifier,
    });

    let tx = await appChain.transaction(alice, () => {
      zkPeer.publish(publishProof, publication);
    });

    await tx.sign();
    await tx.send();

    await appChain.produceBlock();

    const publicationId = Poseidon.hash([
      publishProof.publicOutput.nullifier,
      Field(publication.timestamp.toString()),
      Field(publication.content.toString()),
    ]);

    const reviewProof = ReviewProof.generate({
      witness,
      nullifier,
    });

    tx = await appChain.transaction(alice, () => {
      zkPeer.review(reviewProof, publicationId, UInt64.from(5));
    });

    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();

    const updatedPublication = await appChain.query.runtime.ZKPeer.publications.get(
      publicationId
    );

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(updatedPublication?.score.toBigInt()).toBeGreaterThan(0n);
  }, 1_000_000);
});
