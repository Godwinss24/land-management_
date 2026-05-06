use crate::state::errors::LandError;
use crate::state::land_parcel::LandInfo;
use crate::state::program_state::ProgramState;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, ThawAccount, Token, TokenAccount, Transfer, thaw_account, transfer};

pub const TRANSFER_EXPIRY_SECONDS: u64 = 7 * 24 * 60 * 60; // 7 days

#[derive(Accounts)]
#[instruction(coordinates_hash: [u8; 32])]
pub struct ApproveTransfer<'info> {
    #[account(mut)]
    pub admin: Signer<'info>, // only admin can approve

    /// CHECK: validated against land_info.owner
    pub current_owner: SystemAccount<'info>,

    /// CHECK: validated against land_info.pending_owner
    pub new_owner: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [LandInfo::SEED_PREFIX, coordinates_hash.as_ref()],
        bump = land_info.bump,
        constraint = land_info.has_pending_transfer @ LandError::NoPendingTransfer,
        constraint = land_info.owner == current_owner.key() @ LandError::NotOwner,
        constraint = land_info.pending_owner == new_owner.key() @ LandError::InvalidPendingOwner,
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
        associated_token::authority = current_owner,
        constraint = current_owner_token_account.amount == 1 @ LandError::NotOwner,
    )]
    pub current_owner_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint_account,
        associated_token::authority = new_owner,
    )]
    pub new_owner_token_account: Account<'info, TokenAccount>,

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

pub fn approve_transfer(ctx: Context<ApproveTransfer>, _coordinates_hash: [u8; 32]) -> Result<()> {
    // Extract everything needed from land_info before mutable borrow
    let bump = ctx.accounts.land_info.bump;
    let coordinates_hash = ctx.accounts.land_info.coordinates_hash;
    let transfer_initiated_at = ctx.accounts.land_info.transfer_initiated_at;

    // Check expiry using extracted value
    let clock = Clock::get()?;
    let elapsed = clock.unix_timestamp as u64 - transfer_initiated_at;
    require!(
        elapsed <= TRANSFER_EXPIRY_SECONDS,
        LandError::TransferExpired
    );

    let seeds = &[LandInfo::SEED_PREFIX, coordinates_hash.as_ref(), &[bump]];
    let signer_seeds = &[&seeds[..]];

    // All CPIs here — no mutable borrow of land_info active
    msg!("Approving PDA as delegate...");
    thaw_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        ThawAccount {
            account: ctx.accounts.current_owner_token_account.to_account_info(),
            mint: ctx.accounts.mint_account.to_account_info(),
            authority: ctx.accounts.land_info.to_account_info(),
        },
        signer_seeds,
    ))?;

    msg!("Transferring NFT to new owner...");
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.current_owner_token_account.to_account_info(),
                to: ctx.accounts.new_owner_token_account.to_account_info(),
                authority: ctx.accounts.land_info.to_account_info(),
            },
            signer_seeds,
        ),
        1,
    )?;

    // Now take mutable borrow to update state
    {
        let land_info = &mut ctx.accounts.land_info;
        land_info.owner = ctx.accounts.new_owner.key();
        land_info.pending_owner = Pubkey::default();
        land_info.has_pending_transfer = false;
        land_info.transfer_initiated_at = 0;
    }

    msg!(
        "Transfer approved. New owner: {}",
        ctx.accounts.new_owner.key()
    );

    Ok(())
}
