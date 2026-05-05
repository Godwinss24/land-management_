use anchor_lang::prelude::*;
pub mod instructions;
pub mod state;

use instructions::*;
use state::land_parcel::ParcelStatus;
use {
    anchor_lang::prelude::*,
    anchor_spl::{
        metadata::{
            create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
            CreateMetadataAccountsV3, Metadata,
        },
        token::{Mint, MintTo, Token},
    },
};

declare_id!("GLQRLagJYyfpPSyYkhmhgrGLqDPKjV26q4GzAQ9t8zMF");

#[program]
pub mod land_smart_contracts {
    use anchor_spl::token::{
        mint_to, set_authority, spl_token::instruction::AuthorityType, SetAuthority,
    };

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn register_land(
        ctx: Context<RegisterLand>,
        coordinates_hash: [u8; 32],
        owner: Pubkey,
        status: ParcelStatus,
        token_name: String,
        token_symbol: String,
        land_uri: String,
    ) -> Result<()> {
        msg!("Initializing PDA address...");

        let bump = ctx.bumps.land_info;

        // Scope mutable borrow of land_info to initialization only
        {
            let land_info = &mut ctx.accounts.land_info;

            land_info.coordinates_hash = coordinates_hash;
            land_info.owner = owner;
            land_info.status = status;
            land_info.pending_owner = Pubkey::default();
            land_info.transfer_initiated_at = 0;
            land_info.has_pending_transfer = false;
            land_info.has_mortgage = false;
            land_info.lender = Pubkey::default();
            land_info.mortgage_principal = 0;
            land_info.mortgage_org = Pubkey::default();
            land_info.bump = bump;
            land_info.nft_mint = ctx.accounts.mint_account.key();
        }

        // Create seeds using input coordinates_hash (matches stored value)
        let seeds = &[
            state::land_parcel::LandInfo::SEED_PREFIX,
            coordinates_hash.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        msg!("Creating metadata account...");
        msg!(
            "Metadata account address: {}",
            &ctx.accounts.metadata_account.key()
        );

        // Cross Program Invocation (CPI)
        // Invoking the create_metadata_account_v3 instruction on the token metadata program
        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata_account.to_account_info(),
                    mint: ctx.accounts.mint_account.to_account_info(),
                    mint_authority: ctx.accounts.land_info.to_account_info(),
                    update_authority: ctx.accounts.land_info.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            DataV2 {
                name: token_name,
                symbol: token_symbol,
                uri: land_uri, // JSON pointing to land details
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            true, // Is mutable
            true, // Update authority is signer
            None, // Collection details
        )?;

        msg!("Token mint created successfully.");

        msg!("Minting NFT to owner...");
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint_account.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.land_info.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // Remove mint authority permanently
        msg!("Removing mint authority...");
        set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    account_or_mint: ctx.accounts.mint_account.to_account_info(),
                    current_authority: ctx.accounts.land_info.to_account_info(),
                },
                signer_seeds,
            ),
            AuthorityType::MintTokens,
            None,
        )?;
        Ok(())
    }

    pub fn initiate_transfer(ctx: Context<InitiateTransfer>) -> Result<()> {
        instructions::initiate_transfer::initiate_transfer(ctx)
    }

    pub fn approve_transfer(ctx: Context<ApproveTransfer>) -> Result<()> {
        instructions::approve_transfer::approve_transfer(ctx)
    }

    pub fn setup_mortgage(
        ctx: Context<SetupMortgage>,
        lender: Pubkey,
        mortgage_principal: u64,
        mortgage_org: Pubkey,
    ) -> Result<()> {
        instructions::setup_mortgage::setup_mortgage(ctx, lender, mortgage_principal, mortgage_org)
    }

    pub fn settle_mortgage(ctx: Context<SettleMortgage>) -> Result<()> {
        instructions::settle_mortgage::settle_mortgage(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
