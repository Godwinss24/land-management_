use crate::state::errors::LandError;
use crate::state::land_parcel::LandInfo;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{approve, freeze_account, Approve, FreezeAccount};
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct InitiateTransfer<'info> {
    #[account(mut)]
    pub current_owner: Signer<'info>, // owner signs — proves intent

    /// CHECK: validated as new owner wallet
    pub new_owner: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [LandInfo::SEED_PREFIX, land_info.coordinates_hash.as_ref()],
        bump = land_info.bump,
        constraint = land_info.owner == current_owner.key() @ LandError::NotOwner,
        constraint = !land_info.has_pending_transfer @ LandError::TransferAlreadyPending,
        constraint = !land_info.has_mortgage @ LandError::LandHasMortgage,
    )]
    pub land_info: Account<'info, LandInfo>,

    #[account(
        mut,
        address = land_info.nft_mint,
    )]
    pub mint_account: Account<'info, Mint>,

    // Verify current owner actually holds the NFT
    #[account(
        mut,
        associated_token::mint = mint_account,
        associated_token::authority = current_owner,
        constraint = current_owner_token_account.amount == 1 @ LandError::NotOwner,
    )]
    pub current_owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn initiate_transfer(ctx: Context<InitiateTransfer>) -> Result<()> {
    let land_info = &mut ctx.accounts.land_info;
    let clock = Clock::get()?;

    land_info.pending_owner = ctx.accounts.new_owner.key();
    land_info.has_pending_transfer = true;
    land_info.transfer_initiated_at = clock.unix_timestamp as u64;

    let coordinates_hash = land_info.coordinates_hash;
    let bump = land_info.bump;

    let seeds = &[LandInfo::SEED_PREFIX, coordinates_hash.as_ref(), &[bump]];
    let signer_seeds = &[&seeds[..]];

    // Approve PDA as delegate so it can transfer the token on approve_transfer
    msg!("Approving PDA as delegate...");
    approve(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Approve {
                to: ctx.accounts.current_owner_token_account.to_account_info(),
                delegate: ctx.accounts.land_info.to_account_info(), // PDA becomes delegate
                authority: ctx.accounts.current_owner.to_account_info(), // owner approves
            },
        ),
        1,
    )?;

    // Freeze the token account so owner can't move NFT while transfer is pending
    msg!("Freezing current owner token account...");
    freeze_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        FreezeAccount {
            account: ctx.accounts.current_owner_token_account.to_account_info(),
            mint: ctx.accounts.mint_account.to_account_info(),
            authority: ctx.accounts.land_info.to_account_info(), // PDA is freeze authority
        },
        signer_seeds,
    ))?;

    msg!(
        "Transfer initiated by: {}",
        ctx.accounts.current_owner.key()
    );
    msg!("Pending new owner: {}", ctx.accounts.new_owner.key());

    Ok(())
}