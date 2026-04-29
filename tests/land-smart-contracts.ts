import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { LandSmartContracts } from "../target/types/land_smart_contracts";

describe("Land Smart Contracts: PDA", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.landSmartContracts as anchor.Program<LandSmartContracts>;

  const metadata = {
    name: "Solana Gold",
    symbol: "GOLDSOL",
    uri: "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json",
  };

  // Generate a fake coordinates hash for testing
  const coordinatesHash = new Uint8Array(32);
  for (let i = 2; i < 34; i++) {
    coordinatesHash[i] = i;
  }

  // PDA for the land info account
  const [landPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("land"), Buffer.from(coordinatesHash)],
    program.programId,
  );

  it("Register a new land parcel", async () => {

    const mintKeypair = new Keypair();

    await program.methods
      .registerLand(Array.from(coordinatesHash), payer.publicKey, { active: {} },
        metadata.name, metadata.symbol, metadata.uri
      )
      .accounts({
        payer: payer.publicKey,
        mintAccount: mintKeypair.publicKey, owner: payer.publicKey
      })
      .signers([mintKeypair])
      .rpc();

    const landInfo = await program.account.landInfo.fetch(landPDA);

    console.log(JSON.stringify(landInfo))

    assert.deepEqual(Array.from(landInfo.coordinatesHash), Array.from(coordinatesHash));
    assert.equal(landInfo.owner.toBase58(), payer.publicKey.toBase58());
    assert.deepEqual(landInfo.status, { active: {} });
    assert.equal(landInfo.transferInitiatedAt.toNumber(), 0);
    assert.equal(landInfo.hasPendingTransfer, false);
    assert.equal(landInfo.hasMortgage, false);
    assert.equal(landInfo.mortgagePrincipal.toNumber(), 0);
  });

  // it("Fail to register same land twice", async () => {
  //   try {
  //     await program.methods
  //       .registerLand(Array.from(coordinatesHash), payer.publicKey, { active: {} })
  //       .accounts({
  //         payer: payer.publicKey,
  //       })
  //       .rpc();
  //     assert.fail("Should have thrown an error");
  //   } catch (error) {
  //     assert.exists(error);
  //   }
  // });
});
