use crate::state::errors::LandError;
use crate::state::land_parcel::{LandInfo, ParcelStatus};
use crate::state::program_state::ProgramState;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{freeze_account, FreezeAccount, Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(coordinates_hash: [u8; 32])]
pub struct SetupMortgage<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: the landowner, validated against land_info.owner
    pub owner: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [LandInfo::SEED_PREFIX, coordinates_hash.as_ref()],
        bump = land_info.bump,
        constraint = land_info.owner == owner.key() @ LandError::NotOwner,
        constraint = !land_info.has_mortgage @ LandError::MortgageAlreadyExists,
        constraint = !land_info.has_pending_transfer @ LandError::TransferAlreadyPending,
    )]
    pub land_info: Account<'info, LandInfo>,

    #[account(
        mut,
        address = land_info.nft_mint,
    )]
    pub mint_account: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_account,
        associated_token::authority = owner,
        constraint = owner_token_account.amount == 1 @ LandError::NotOwner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [ProgramState::SEED_PREFIX],
        bump = program_state.bump,
        constraint = admin.key() == program_state.admin @ LandError::UnauthorizedAdmin
    )]
    pub program_state: Account<'info, ProgramState>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn setup_mortgage(
    ctx: Context<SetupMortgage>,
    _coordinates_hash: [u8; 32],
    lender: Pubkey,
    mortgage_principal: u64,
    mortgage_org: Pubkey,
) -> Result<()> {
    let coordinates_hash = ctx.accounts.land_info.coordinates_hash;
    let bump = ctx.accounts.land_info.bump;

    let seeds = &[LandInfo::SEED_PREFIX, coordinates_hash.as_ref(), &[bump]];
    let signer_seeds = &[&seeds[..]];

    // Freeze NFT — land can't be transferred while mortgage is active
    msg!("Freezing NFT for mortgage...");
    freeze_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        FreezeAccount {
            account: ctx.accounts.owner_token_account.to_account_info(),
            mint: ctx.accounts.mint_account.to_account_info(),
            authority: ctx.accounts.land_info.to_account_info(),
        },
        signer_seeds,
    ))?;

    // Update land info
    let land_info = &mut ctx.accounts.land_info;
    land_info.has_mortgage = true;
    land_info.lender = lender;
    land_info.mortgage_principal = mortgage_principal;
    land_info.mortgage_org = mortgage_org;
    land_info.status = ParcelStatus::Lien;

    msg!("Mortgage set up. Lender: {}", lender);
    msg!("Principal: {}", mortgage_principal);

    Ok(())
}