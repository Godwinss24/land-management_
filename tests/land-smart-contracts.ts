import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { LandSmartContracts } from "../target/types/land_smart_contracts";
import * as crypto from "crypto";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";

const currentOwner = Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(fs.readFileSync("tests/keypairs/current-owner.json", "utf8"))
  )
);

const newOwner = Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(fs.readFileSync("tests/keypairs/new-owner.json", "utf8"))
  )
);

describe("Land Smart Contracts: PDA", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = (provider.wallet as anchor.Wallet).payer;
  const program = anchor.workspace
    .landSmartContracts as anchor.Program<LandSmartContracts>;

  const metadata = {
    name: "Solana Gold",
    symbol: "GOLDSOL",
    uri: "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json",
  };

  // Helper — random coordinates hash so PDA is always fresh
  function randomCoordinatesHash(): Buffer {
    return crypto.randomBytes(32);
  }

  // Helper — hash from coordinates array (matches backend logic)
  function coordinatesToHash(coordinates: number[][]): Buffer {
    return crypto
      .createHash("sha256")
      .update(coordinates.flat().join(","))
      .digest();
  }

  // -------------------------------------------------------
  it("Register a new land parcel", async () => {
    const mintKeypair = new Keypair();
    const coordinatesHash = randomCoordinatesHash();

    const [landPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("land"), coordinatesHash],
      program.programId
    );

    await program.methods
      .registerLand(
        Array.from(coordinatesHash),
        payer.publicKey,
        { active: {} },
        metadata.name,
        metadata.symbol,
        metadata.uri
      )
      .accounts({
        payer: payer.publicKey,
        mintAccount: mintKeypair.publicKey,
        owner: payer.publicKey,
      })
      .signers([mintKeypair])
      .rpc();

    const landInfo = await program.account.landInfo.fetch(landPDA);
    console.log("Registered land:", JSON.stringify(landInfo));

    assert.deepEqual(Array.from(landInfo.coordinatesHash), Array.from(coordinatesHash));
    assert.equal(landInfo.owner.toBase58(), payer.publicKey.toBase58());
    assert.deepEqual(landInfo.status, { active: {} });
    assert.equal(landInfo.transferInitiatedAt.toNumber(), 0);
    assert.equal(landInfo.hasPendingTransfer, false);
    assert.equal(landInfo.hasMortgage, false);
    assert.equal(landInfo.mortgagePrincipal.toNumber(), 0);
  });

  // -------------------------------------------------------
  it("Initiate and approve land transfer", async () => {
    const mintKeypair = new Keypair();
    const coordinatesHash = coordinatesToHash([
      [6.522244, 3.3792],
      [6.5288254, 3.3802],
      [6.5264, 3.3812],
      [6.522274, 3.38254],
    ]);

    const [landPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("land"), coordinatesHash],
      program.programId
    );

    // Step 1: Register land — currentOwner is payer and owner
    await program.methods
      .registerLand(
        Array.from(coordinatesHash),
        currentOwner.publicKey,
        { active: {} },
        metadata.name,
        metadata.symbol,
        metadata.uri
      )
      .accounts({
        payer: currentOwner.publicKey,
        mintAccount: mintKeypair.publicKey,
        owner: currentOwner.publicKey,
      })
      .signers([mintKeypair, currentOwner])
      .rpc();

    const landInfoBefore = await program.account.landInfo.fetch(landPDA);
    console.log("Owner before transfer:", landInfoBefore.owner.toBase58());
    assert.equal(landInfoBefore.owner.toBase58(), currentOwner.publicKey.toBase58());
    assert.equal(landInfoBefore.hasPendingTransfer, false);

    // Step 2: Current owner initiates transfer
    await program.methods
      .initiateTransfer()
      .accountsPartial({
        currentOwner: currentOwner.publicKey,
        newOwner: newOwner.publicKey,
        landInfo: landPDA,
        mintAccount: landInfoBefore.nftMint,
      })
      .signers([currentOwner])
      .rpc();

    const landInfoPending = await program.account.landInfo.fetch(landPDA);
    console.log("Pending owner:", landInfoPending.pendingOwner.toBase58());
    assert.equal(landInfoPending.hasPendingTransfer, true);
    assert.equal(
      landInfoPending.pendingOwner.toBase58(),
      newOwner.publicKey.toBase58()
    );
    assert.ok(landInfoPending.transferInitiatedAt.toNumber() > 0);

    // Step 3: Admin approves transfer
    await program.methods
      .approveTransfer()
      .accountsPartial({
        admin: payer.publicKey,
        currentOwner: currentOwner.publicKey,
        newOwner: newOwner.publicKey,
        landInfo: landPDA,
        mintAccount: landInfoBefore.nftMint,
      })
      .signers([payer])
      .rpc();

    const landInfoAfter = await program.account.landInfo.fetch(landPDA);
    console.log("Owner after transfer:", landInfoAfter.owner.toBase58());
    assert.equal(landInfoAfter.owner.toBase58(), newOwner.publicKey.toBase58());
    assert.equal(landInfoAfter.hasPendingTransfer, false);
    assert.equal(
      landInfoAfter.pendingOwner.toBase58(),
      PublicKey.default.toBase58()
    );
    assert.equal(landInfoAfter.transferInitiatedAt.toNumber(), 0);

    // Step 4: Verify NFT is in new owner's ATA
    const newOwnerATA = getAssociatedTokenAddressSync(
      landInfoBefore.nftMint,
      newOwner.publicKey
    );
    const newTokenBalance =
      await provider.connection.getTokenAccountBalance(newOwnerATA);
    assert.equal(newTokenBalance.value.uiAmount, 1);

    // Step 5: Verify old owner no longer holds NFT
    const oldOwnerATA = getAssociatedTokenAddressSync(
      landInfoBefore.nftMint,
      currentOwner.publicKey
    );
    const oldTokenBalance =
      await provider.connection.getTokenAccountBalance(oldOwnerATA);
    assert.equal(oldTokenBalance.value.uiAmount, 0);
  });

  // -------------------------------------------------------
  it("Setup and settle mortgage", async () => {
    const mintKeypair = new Keypair();
    const coordinatesHash = coordinatesToHash([
      [4.98156, 7.0498],
      [4.8166, 7.0508],
      [4.8176, 7.0518],
      [4.8186, 7.0528],
    ]);

    const [landPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("land"), coordinatesHash],
      program.programId
    );

    // Step 1: Register land — payer is owner
    await program.methods
      .registerLand(
        Array.from(coordinatesHash),
        payer.publicKey,
        { active: {} },
        metadata.name,
        metadata.symbol,
        metadata.uri
      )
      .accounts({
        payer: payer.publicKey,
        mintAccount: mintKeypair.publicKey,
        owner: payer.publicKey,
      })
      .signers([mintKeypair])
      .rpc();

    const landInfoBefore = await program.account.landInfo.fetch(landPDA);
    assert.equal(landInfoBefore.hasMortgage, false);
    assert.deepEqual(landInfoBefore.status, { active: {} });

    // Step 2: Admin sets up mortgage
    const lender = Keypair.generate().publicKey;
    const mortgageOrg = Keypair.generate().publicKey;
    const mortgagePrincipal = new anchor.BN(5_000_000); // 5 SOL in lamports

    await program.methods
      .setupMortgage(lender, mortgagePrincipal, mortgageOrg)
      .accountsPartial({
        admin: payer.publicKey,
        owner: payer.publicKey,
        landInfo: landPDA,
        mintAccount: landInfoBefore.nftMint,
      })
      .signers([payer])
      .rpc();

    const landInfoMortgaged = await program.account.landInfo.fetch(landPDA);
    console.log("Mortgaged land:", JSON.stringify(landInfoMortgaged));
    assert.equal(landInfoMortgaged.hasMortgage, true);
    assert.deepEqual(landInfoMortgaged.status, { lien: {} });
    assert.equal(landInfoMortgaged.lender.toBase58(), lender.toBase58());
    assert.equal(landInfoMortgaged.mortgageOrg.toBase58(), mortgageOrg.toBase58());
    assert.equal(
      landInfoMortgaged.mortgagePrincipal.toNumber(),
      mortgagePrincipal.toNumber()
    );

    // Step 3: Verify land cannot be transferred while mortgaged
    try {
      await program.methods
        .initiateTransfer()
        .accountsPartial({
          currentOwner: payer.publicKey,
          newOwner: newOwner.publicKey,
          landInfo: landPDA,
          mintAccount: landInfoBefore.nftMint,
        })
        .signers([payer])
        .rpc();
      assert.fail("Should have thrown LandHasMortgage error");
    } catch (err: any) {
      assert.include(err.message, "LandHasMortgage");
      console.log("Correctly blocked transfer on mortgaged land");
    }

    // Step 4: Admin settles mortgage
    await program.methods
      .settleMortgage()
      .accountsPartial({
        admin: payer.publicKey,
        owner: payer.publicKey,
        landInfo: landPDA,
        mintAccount: landInfoBefore.nftMint,
      })
      .signers([payer])
      .rpc();

    const landInfoSettled = await program.account.landInfo.fetch(landPDA);
    console.log("Settled land:", JSON.stringify(landInfoSettled));
    assert.equal(landInfoSettled.hasMortgage, false);
    assert.deepEqual(landInfoSettled.status, { active: {} });
    assert.equal(
      landInfoSettled.lender.toBase58(),
      PublicKey.default.toBase58()
    );
    assert.equal(
      landInfoSettled.mortgageOrg.toBase58(),
      PublicKey.default.toBase58()
    );
    assert.equal(landInfoSettled.mortgagePrincipal.toNumber(), 0);
  });

  // -------------------------------------------------------
  it("Fail to register same land twice", async () => {
    const mintKeypair1 = new Keypair();
    const mintKeypair2 = new Keypair();
    const coordinatesHash = randomCoordinatesHash();

    const [landPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("land"), coordinatesHash],
      program.programId
    );

    // First registration — should succeed
    await program.methods
      .registerLand(
        Array.from(coordinatesHash),
        payer.publicKey,
        { active: {} },
        metadata.name,
        metadata.symbol,
        metadata.uri
      )
      .accounts({
        payer: payer.publicKey,
        mintAccount: mintKeypair1.publicKey,
        owner: payer.publicKey,
      })
      .signers([mintKeypair1])
      .rpc();

    // Second registration with same coordinates — should fail
    try {
      await program.methods
        .registerLand(
          Array.from(coordinatesHash),
          payer.publicKey,
          { active: {} },
          metadata.name,
          metadata.symbol,
          metadata.uri
        )
        .accounts({
          payer: payer.publicKey,
          mintAccount: mintKeypair2.publicKey,
          owner: payer.publicKey,
        })
        .signers([mintKeypair2])
        .rpc();
      assert.fail("Should have thrown already in use error");
    } catch (err: any) {
      assert.exists(err);
      console.log("Correctly blocked duplicate land registration");
    }
  });
});