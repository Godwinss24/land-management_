use crate::state::errors::LandError;
use crate::state::land_parcel::LandInfo;
use crate::state::program_state::ProgramState;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::Metadata,
    token::TokenAccount,
    token::{Mint, Token},
};

#[derive(Accounts)]
#[instruction(coordinates_hash: [u8; 32])]
pub struct RegisterLand<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: doc comment explaining why no checks through types are necessary.
    pub owner: UncheckedAccount<'info>,

    #[account(
        init,
        space = 8 + LandInfo::INIT_SPACE,
        payer = admin,
        seeds = [
            LandInfo::SEED_PREFIX,
            coordinates_hash.as_ref(),
        ],
        bump,
    )]
    pub land_info: Account<'info, LandInfo>,

    /// CHECK: Validate address by deriving pda
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint_account.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        mint::decimals = 0,
        mint::authority = land_info.key(),
        mint::freeze_authority = land_info.key()
    )]
    pub mint_account: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = mint_account,
        associated_token::authority = owner,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [ProgramState::SEED_PREFIX],
        bump = program_state.bump,
        constraint = admin.key() == program_state.admin @ LandError::UnauthorizedAdmin
    )]
    pub program_state: Account<'info, ProgramState>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub token_metadata_program: Program<'info, Metadata>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// pub fn register_land(
//     ctx: Context<RegisterLand>,
//     coordinates_hash: [u8; 32],
//     owner: Pubkey,
//     status: ParcelStatus,
// ) -> Result<()> {
//     let land_info = &mut ctx.accounts.land_info;

//     land_info.coordinates_hash = coordinates_hash;
//     land_info.owner = owner;
//     land_info.status = status;
//     land_info.pending_owner = Pubkey::default();
//     land_info.transfer_initiated_at = 0;
//     land_info.has_pending_transfer = false;
//     land_info.has_mortgage = false;
//     land_info.lender = Pubkey::default();
//     land_info.mortgage_principal = 0;
//     land_info.mortgage_org = Pubkey::default();
//     land_info.bump = ctx.bumps.land_info;
//     land_info.nft_mint = ctx.accounts.mint_account.key();

//     Ok(())
// }
