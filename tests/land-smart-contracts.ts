import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { LandSmartContracts } from "../target/types/land_smart_contracts";
import * as crypto from "crypto";
import { ASSOCIATED_TOKEN_PROGRAM_ID, ExtensionType, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";
import { TOKEN_2022_PROGRAM_ID, getMint, getExtensionTypes } from "@solana/spl-token";

const admin = Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(fs.readFileSync("tests/keypairs/admin-keypair.json", "utf8"))
  )
);

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
  console.log(admin.publicKey.toBase58())

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .landSmartContracts as anchor.Program<LandSmartContracts>;

  // Derive program_state PDA
  const [programStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("program_state")],
    program.programId
  );

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
  // Initialize program state before all tests
  before(async () => {
    // Airdrop SOL to admin for transaction fees
    // const airdropSig = await provider.connection.requestAirdrop(
    //   admin.publicKey,
    //   2 * anchor.web3.LAMPORTS_PER_SOL
    // );
    // await provider.connection.confirmTransaction(airdropSig);

    // Initialize program state with admin
    try {
      await program.methods
        .initialize()
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
      console.log("Program initialized. Admin:", admin.publicKey.toBase58());
    } catch (err: any) {
      // Program state might already be initialized
      console.log("Program state already initialized or error:", err.message);
    }
  });

  // it("Register a new citizen", async () => {
  //   try {
  //     const citizenWallet = Keypair.generate();
  //     const sbtMintKeypair = new Keypair();

  //     const [citizenPDA] = PublicKey.findProgramAddressSync(
  //       [Buffer.from("nigeria_land"), citizenWallet.publicKey.toBuffer()],
  //       program.programId
  //     );

  //     const citizenATA = getAssociatedTokenAddressSync(
  //       sbtMintKeypair.publicKey,
  //       citizenWallet.publicKey,
  //       undefined,
  //       TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  //     );

  //     const tx = await program.methods
  //       .registerCitizen(citizenATA)
  //       .accountsPartial({
  //         mintAccount: sbtMintKeypair.publicKey,
  //         payer: admin.publicKey,
  //         citizenWallet: citizenWallet.publicKey,
  //         tokenProgram: TOKEN_2022_PROGRAM_ID
  //       })
  //       .signers([admin, sbtMintKeypair])
  //       .rpc();

  //     const txDetails = await provider.connection.getTransaction(tx, {
  //       commitment: "confirmed",
  //       maxSupportedTransactionVersion: 0,
  //     });
  //     if (txDetails?.meta?.logMessages) {
  //       console.log("Register new Citizen Transaction Logs:");
  //       txDetails.meta.logMessages.forEach((log) => console.log(log));
  //     }
  //     console.log("Citizen registered. PDA:", citizenPDA.toBase58());
  //   } catch (err: any) {
  //     console.error("Transaction failed!");
  //     if (err?.logs) {
  //       console.error("Error Logs:");
  //       err.logs.forEach((log: any) => console.error(log));
  //     }
  //     throw err;
  //   }
  // });

  // // it("Verify SBT mint is non-transferable by checking account data", async () => {
  // //   const citizenWallet = Keypair.generate();
  // //   const sbtMintKeypair = new Keypair();

  // //   const [citizenPDA] = PublicKey.findProgramAddressSync(
  // //     [Buffer.from("nigeria land"), citizenWallet.publicKey.toBuffer()],
  // //     program.programId
  // //   );




  // //   const citizenATA = getAssociatedTokenAddressSync(
  // //     sbtMintKeypair.publicKey,
  // //     citizenWallet.publicKey,
  // //     undefined,
  // //     TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  // //   );

  // //   // Register the citizen (creates SBT mint with NonTransferable extension)
  // //   await program.methods
  // //     .registerCitizen(citizenATA)
  // //     .accounts({
  // //       mintAccount: sbtMintKeypair.publicKey,
  // //       payer: admin.publicKey,
  // //       citizenWallet: citizenWallet.publicKey,
  // //     })
  // //     .signers([admin, sbtMintKeypair])
  // //     .rpc();

  // //   // Fetch the mint account data
  // //   const mintAccountInfo = await provider.connection.getAccountInfo(sbtMintKeypair.publicKey);
  // //   assert.exists(mintAccountInfo, "Mint account should exist");
  // //   assert.equal(mintAccountInfo?.owner.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58());
  // //   console.log(`Mint owner: ${mintAccountInfo?.owner.toBase58()} \nToken Program: ${TOKEN_2022_PROGRAM_ID}`)

  // //   console.log("======================================================")

  // //   const connection = new Connection("https://api.devnet.solana.com")
  // //   // console.log(connection.getBalance(admin.publicKey))
  // //   const mint = await getMint(connection, sbtMintKeypair.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);


  // //   const extensions = getExtensionTypes(mint.tlvData);

  // //   console.log(extensions)
  // //   console.log(ExtensionType.NonTransferable)

  // // });

  // // -------------------------------------------------------
  // it("Register a new land parcel", async () => {
  //   const mintKeypair = new Keypair();
  //   const coordinatesHash = randomCoordinatesHash();

  //   const [landPDA] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("land"), coordinatesHash],
  //     program.programId
  //   );

  //   const tx = await program.methods
  //     .registerLand(
  //       Array.from(coordinatesHash),
  //       admin.publicKey,
  //       { active: {} },
  //       metadata.name,
  //       metadata.symbol,
  //       metadata.uri
  //     )
  //     .accounts({
  //       admin: admin.publicKey,
  //       mintAccount: mintKeypair.publicKey,
  //       owner: admin.publicKey,
  //     })
  //     .signers([mintKeypair, admin])
  //     .rpc();


  //   const txDetails = await provider.connection.getTransaction(tx, {
  //     commitment: "confirmed",
  //     maxSupportedTransactionVersion: 0,
  //   });
  //   if (txDetails?.meta?.logMessages) {
  //     console.log("Register new Citizen Transaction Logs:");
  //     txDetails.meta.logMessages.forEach((log) => console.log(log));
  //   }

  //   // const landInfo = await program.account.landInfo.fetch(landPDA);
  //   // console.log("Registered land:", JSON.stringify(landInfo));

  //   // assert.deepEqual(Array.from(landInfo.coordinatesHash), Array.from(coordinatesHash));
  //   // assert.equal(landInfo.owner.toBase58(), admin.publicKey.toBase58());
  //   // assert.deepEqual(landInfo.status, { active: {} });
  //   // assert.equal(landInfo.transferInitiatedAt.toNumber(), 0);
  //   // assert.equal(landInfo.hasPendingTransfer, false);
  //   // assert.equal(landInfo.hasMortgage, false);
  //   // assert.equal(landInfo.mortgagePrincipal.toNumber(), 0);
  // });

  // // // -------------------------------------------------------
  // it("Initiate and approve land transfer", async () => {
  //   const mintKeypair = new Keypair();
  //   const coordinatesHash = randomCoordinatesHash();

  //   const [landPDA] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("land"), coordinatesHash],
  //     program.programId
  //   );

  //   // Step 1: Register land — admin is payer and owner
  //   await program.methods
  //     .registerLand(
  //       Array.from(coordinatesHash),
  //       currentOwner.publicKey,
  //       { active: {} },
  //       metadata.name,
  //       metadata.symbol,
  //       metadata.uri
  //     )
  //     .accounts({
  //       admin: admin.publicKey,
  //       mintAccount: mintKeypair.publicKey,
  //       owner: currentOwner.publicKey,
  //     })
  //     .signers([mintKeypair, admin])
  //     .rpc();

  //   const landInfoBefore = await program.account.landInfo.fetch(landPDA);
  //   console.log("Owner before transfer:", landInfoBefore.owner.toBase58());
  //   assert.equal(landInfoBefore.owner.toBase58(), currentOwner.publicKey.toBase58());
  //   assert.equal(landInfoBefore.hasPendingTransfer, false);

  //   // Step 2: Admin initiates transfer (currentOwner must sign for token approval)
  //   const initializeTx = await program.methods
  //     .initiateTransfer(Array.from(coordinatesHash))
  //     .accountsPartial({
  //       admin: admin.publicKey,
  //       currentOwner: currentOwner.publicKey,
  //       newOwner: newOwner.publicKey,
  //       landInfo: landPDA,
  //       mintAccount: landInfoBefore.nftMint,
  //       programState: programStatePDA,
  //     })
  //     .signers([admin, currentOwner])
  //     .rpc();


  //   const txDetails = await provider.connection.getTransaction(initializeTx, {
  //     commitment: "confirmed",
  //     maxSupportedTransactionVersion: 0,
  //   });
  //   if (txDetails?.meta?.logMessages) {
  //     console.log("Initiate land transfer Transaction Logs:");
  //     txDetails.meta.logMessages.forEach((log) => console.log(log));
  //   }

  //   const landInfoPending = await program.account.landInfo.fetch(landPDA);
  //   console.log("Pending owner:", landInfoPending.pendingOwner.toBase58());
  //   assert.equal(landInfoPending.hasPendingTransfer, true);
  //   assert.equal(
  //     landInfoPending.pendingOwner.toBase58(),
  //     newOwner.publicKey.toBase58()
  //   );
  //   assert.ok(landInfoPending.transferInitiatedAt.toNumber() > 0);

  //   // Step 3: Admin approves transfer
  //   const approveTx = await program.methods
  //     .approveTransfer(Array.from(coordinatesHash))
  //     .accountsPartial({
  //       admin: admin.publicKey,
  //       currentOwner: currentOwner.publicKey,
  //       newOwner: newOwner.publicKey,
  //       landInfo: landPDA,
  //       mintAccount: landInfoBefore.nftMint,
  //       programState: programStatePDA,
  //     })
  //     .signers([admin])
  //     .rpc();


  //   const txDetailsII = await provider.connection.getTransaction(approveTx, {
  //     commitment: "confirmed",
  //     maxSupportedTransactionVersion: 0,
  //   });
  //   if (txDetailsII?.meta?.logMessages) {
  //     console.log("Approve land transfer Transaction Logs:");
  //     txDetailsII.meta.logMessages.forEach((log) => console.log(log));
  //   }

  //   const landInfoAfter = await program.account.landInfo.fetch(landPDA);
  //   console.log("Owner after transfer:", landInfoAfter.owner.toBase58());
  //   assert.equal(landInfoAfter.owner.toBase58(), newOwner.publicKey.toBase58());
  //   assert.equal(landInfoAfter.hasPendingTransfer, false);
  //   assert.equal(
  //     landInfoAfter.pendingOwner.toBase58(),
  //     PublicKey.default.toBase58()
  //   );
  //   assert.equal(landInfoAfter.transferInitiatedAt.toNumber(), 0);

  //   // Step 4: Verify NFT is in new owner's ATA
  //   const newOwnerATA = getAssociatedTokenAddressSync(
  //     landInfoBefore.nftMint,
  //     newOwner.publicKey
  //   );
  //   const newTokenBalance =
  //     await provider.connection.getTokenAccountBalance(newOwnerATA);
  //   assert.equal(newTokenBalance.value.uiAmount, 1);

  //   // Step 5: Verify old owner no longer holds NFT
  //   const oldOwnerATA = getAssociatedTokenAddressSync(
  //     landInfoBefore.nftMint,
  //     currentOwner.publicKey
  //   );
  //   const oldTokenBalance =
  //     await provider.connection.getTokenAccountBalance(oldOwnerATA);
  //   assert.equal(oldTokenBalance.value.uiAmount, 0);
  // });

  // // -------------------------------------------------------
  // it("Setup and settle mortgage", async () => {
  //   const mintKeypair = new Keypair();
  //   const coordinatesHash = randomCoordinatesHash();

  //   const [landPDA] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("land"), coordinatesHash],
  //     program.programId
  //   );

  //   // Step 1: Register land — admin is payer and owner
  //   const setupTx = await program.methods
  //     .registerLand(
  //       Array.from(coordinatesHash),
  //       currentOwner.publicKey,
  //       { active: {} },
  //       metadata.name,
  //       metadata.symbol,
  //       metadata.uri
  //     )
  //     .accounts({
  //       admin: admin.publicKey,
  //       mintAccount: mintKeypair.publicKey,
  //       owner: currentOwner.publicKey,
  //     })
  //     .signers([mintKeypair, admin])
  //     .rpc();

      
  //     const txDetails = await provider.connection.getTransaction(setupTx, {
  //       commitment: "confirmed",
  //       maxSupportedTransactionVersion: 0,
  //     });
  //     if (txDetails?.meta?.logMessages) {
  //       console.log("Setup Transaction Logs:");
  //       txDetails.meta.logMessages.forEach((log) => console.log(log));
  //     }

  //   const landInfoBefore = await program.account.landInfo.fetch(landPDA);
  //   assert.equal(landInfoBefore.hasMortgage, false);
  //   assert.deepEqual(landInfoBefore.status, { active: {} });

  //   // Step 2: Admin sets up mortgage (PDA is freeze authority, signs via seeds)
  //   const lender = Keypair.generate().publicKey;
  //   const mortgageOrg = Keypair.generate().publicKey;
  //   const mortgagePrincipal = new anchor.BN(5_000_000); // 5 SOL in lamports

  //   await program.methods
  //     .setupMortgage(Array.from(coordinatesHash), lender, mortgagePrincipal, mortgageOrg)
  //     .accountsPartial({
  //       admin: admin.publicKey,
  //       owner: currentOwner.publicKey,
  //       landInfo: landPDA,
  //       mintAccount: landInfoBefore.nftMint,
  //       programState: programStatePDA,
  //     })
  //     .signers([admin])
  //     .rpc();

  //   const landInfoMortgaged = await program.account.landInfo.fetch(landPDA);
  //   console.log("Mortgaged land:", JSON.stringify(landInfoMortgaged));
  //   assert.equal(landInfoMortgaged.hasMortgage, true);
  //   assert.deepEqual(landInfoMortgaged.status, { lien: {} });
  //   assert.equal(landInfoMortgaged.lender.toBase58(), lender.toBase58());
  //   assert.equal(landInfoMortgaged.mortgageOrg.toBase58(), mortgageOrg.toBase58());
  //   assert.equal(
  //     landInfoMortgaged.mortgagePrincipal.toNumber(),
  //     mortgagePrincipal.toNumber()
  //   );

  //   // Step 3: Verify land cannot be transferred while mortgaged
  //   try {
  //     await program.methods
  //       .initiateTransfer(Array.from(coordinatesHash))
  //       .accountsPartial({
  //         admin: admin.publicKey,
  //         currentOwner: currentOwner.publicKey,
  //         newOwner: newOwner.publicKey,
  //         landInfo: landPDA,
  //         mintAccount: landInfoBefore.nftMint,
  //         programState: programStatePDA,
  //       })
  //       .signers([admin, currentOwner])
  //       .rpc();
  //     assert.fail("Should have thrown LandHasMortgage error");
  //   } catch (err: any) {
  //     assert.include(err.message, "LandHasMortgage");
  //     console.log("Correctly blocked transfer on mortgaged land");
  //   }

  //   // Step 4: Admin settles mortgage (PDA is freeze authority, signs via seeds)
  //   await program.methods
  //     .settleMortgage(Array.from(coordinatesHash))
  //     .accountsPartial({
  //       admin: admin.publicKey,
  //       owner: currentOwner.publicKey,
  //       landInfo: landPDA,
  //       mintAccount: landInfoBefore.nftMint,
  //       programState: programStatePDA,
  //     })
  //     .signers([admin])
  //     .rpc();

  //   const landInfoSettled = await program.account.landInfo.fetch(landPDA);
  //   console.log("Settled land:", JSON.stringify(landInfoSettled));
  //   assert.equal(landInfoSettled.hasMortgage, false);
  //   assert.deepEqual(landInfoSettled.status, { active: {} });
  //   assert.equal(
  //     landInfoSettled.lender.toBase58(),
  //     PublicKey.default.toBase58()
  //   );
  //   assert.equal(
  //     landInfoSettled.mortgageOrg.toBase58(),
  //     PublicKey.default.toBase58()
  //   );
  //   assert.equal(landInfoSettled.mortgagePrincipal.toNumber(), 0);
  // });

  // -------------------------------------------------------


  // -------------------------------------------------------
  // it("Fail to register same land twice", async () => {
  //   const mintKeypair1 = new Keypair();
  //   const mintKeypair2 = new Keypair();
  //   const coordinatesHash = randomCoordinatesHash();

  //   const [landPDA] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("land"), coordinatesHash],
  //     program.programId
  //   );

  //   // First registration — should succeed
  //   await program.methods
  //     .registerLand(
  //       Array.from(coordinatesHash),
  //       admin.publicKey,
  //       { active: {} },
  //       metadata.name,
  //       metadata.symbol,
  //       metadata.uri
  //     )
  //     .accounts({
  //       admin: admin.publicKey,
  //       mintAccount: mintKeypair1.publicKey,
  //       owner: admin.publicKey,
  //     })
  //     .signers([mintKeypair1, admin])
  //     .rpc();

  //   // Second registration with same coordinates — should fail
  //   try {
  //     await program.methods
  //       .registerLand(
  //         Array.from(coordinatesHash),
  //         admin.publicKey,
  //         { active: {} },
  //         metadata.name,
  //         metadata.symbol,
  //         metadata.uri
  //       )
  //       .accounts({
  //         admin: admin.publicKey,
  //         mintAccount: mintKeypair2.publicKey,
  //         owner: admin.publicKey,
  //       })
  //       .signers([mintKeypair2, admin])
  //       .rpc();
  //     assert.fail("Should have thrown already in use error");
  //   } catch (err: any) {
  //     assert.exists(err);
  //     console.log("Correctly blocked duplicate land registration");
  //   }
  // });

  // -------------------------------------------------------

  // -------------------------------------------------------
  it("Measure latency for core operations: register citizen, register land, setup mortgage, settle mortgage", async () => {
    // Helper to measure transaction latency, compute units, and logs
    const measureLatency = async (operation: string, txFn: () => Promise<string>) => {
      const start = Date.now();
      const tx = await txFn();
      await provider.connection.confirmTransaction(tx, "confirmed");
      const duration = Date.now() - start;

      // Fetch transaction details for compute units and logs
      const txDetails = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      const computeUnits = txDetails?.meta?.computeUnitsConsumed ?? "N/A";
      console.log(`${operation} latency: ${duration}ms | Compute Units: ${computeUnits}`);

      if (txDetails?.meta?.logMessages) {
        console.log(`--- ${operation} Logs ---`);
        txDetails.meta.logMessages.forEach((log: string) => console.log(log));
        console.log(`--- End ${operation} Logs ---`);
      }

      return tx;
    };

    // Step 1: Register Citizen
    console.log("=== Step 1: Register Citizen ===");
    const citizenWallet = Keypair.generate();
    const sbtMint = new Keypair();
    const [citizenPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("nigeria_land"), citizenWallet.publicKey.toBuffer()],
      program.programId
    );
    const citizenATA = getAssociatedTokenAddressSync(
      sbtMint.publicKey,
      citizenWallet.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await measureLatency("Register Citizen", () =>
      program.methods
        .registerCitizen(citizenATA)
        .accountsPartial({
          mintAccount: sbtMint.publicKey,
          payer: admin.publicKey,
          citizenWallet: citizenWallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([admin, sbtMint])
        .rpc()
    );

    // Step 2: Register Land
    console.log("=== Step 2: Register Land ===");
    const landMint = new Keypair();
    const coordinatesHash = randomCoordinatesHash();
    const [landPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("land"), coordinatesHash],
      program.programId
    );
    const landOwner = currentOwner;

    await measureLatency("Register Land", () =>
      program.methods
        .registerLand(
          Array.from(coordinatesHash),
          landOwner.publicKey,
          { active: {} },
          metadata.name,
          metadata.symbol,
          metadata.uri
        )
        .accounts({
          admin: admin.publicKey,
          mintAccount: landMint.publicKey,
          owner: landOwner.publicKey,
        })
        .signers([landMint, admin])
        .rpc()
    );

    // Fetch land info to retrieve NFT mint for subsequent steps
    const landInfo = await program.account.landInfo.fetch(landPDA);
    const nftMint = landInfo.nftMint;

    // Step 3: Setup Mortgage
    console.log("=== Step 3: Setup Mortgage ===");
    const lender = Keypair.generate().publicKey;
    const mortgageOrg = Keypair.generate().publicKey;
    const principal = new anchor.BN(5_000_000);

    await measureLatency("Setup Mortgage", () =>
      program.methods
        .setupMortgage(Array.from(coordinatesHash), lender, principal, mortgageOrg)
        .accountsPartial({
          admin: admin.publicKey,
          owner: landOwner.publicKey,
          landInfo: landPDA,
          mintAccount: nftMint,
          programState: programStatePDA,
        })
        .signers([admin])
        .rpc()
    );

    // Step 4: Settle Mortgage
    console.log("=== Step 4: Settle Mortgage ===");
    await measureLatency("Settle Mortgage", () =>
      program.methods
        .settleMortgage(Array.from(coordinatesHash))
        .accountsPartial({
          admin: admin.publicKey,
          owner: landOwner.publicKey,
          landInfo: landPDA,
          mintAccount: nftMint,
          programState: programStatePDA,
        })
        .signers([admin])
        .rpc()
    );
  });

  // -------------------------------------------------------

});
