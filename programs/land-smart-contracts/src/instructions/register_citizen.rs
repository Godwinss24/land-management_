use anchor_lang::prelude::*;

use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::token::TokenAccount;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{
        initialize_mint2,
        spl_token_2022::{extension::ExtensionType, pod::PodMint},
        InitializeMint2,
    },
    token_interface::{non_transferable_mint_initialize, NonTransferableMintInitialize, Token2022},
};

#[derive(Accounts)]
pub struct RegisterCitizen<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Citizens wallet
    pub citizen_wallet: UncheckedAccount<'info>,

    /// CHECK: Citizens PDA
    #[account(
        mut,
        seeds = [b"nigeria_land", citizen_wallet.key().as_ref()],
        bump
    )]
    pub citizen_pda: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint_account: Signer<'info>,

    // #[account(
    //     init,
    //     payer = payer,
    //     associated_token::mint = mint_account,
    //     associated_token::authority = citizen_wallet,
    // )]
    // pub citizen_token_account: Account<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn register_citizen(ctx: Context<RegisterCitizen>) -> Result<()> {
    msg!("Register citizen instruction called");

    // Calculate space required for mint and extension data
    let mint_size =
        ExtensionType::try_calculate_account_len::<PodMint>(&[ExtensionType::NonTransferable])?;

    // Calculate minimum lamports required for size of mint account with extensions
    let lamports = (Rent::get()?).minimum_balance(mint_size);

    msg!("Required lamports {:?}", lamports);

    // Invoke System Program to create new account with space for mint and extension data
    create_account(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.mint_account.to_account_info(),
            },
        ),
        lamports,                          // Lamports
        mint_size as u64,                  // Space
        &ctx.accounts.token_program.key(), // Owner Program
    )?;

    // // Initialize the NonTransferable extension
    // // This instruction must come before the instruction to initialize the mint data
    non_transferable_mint_initialize(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        NonTransferableMintInitialize {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            mint: ctx.accounts.mint_account.to_account_info(),
        },
    ))?;

    // // Initialize the standard mint account data
    initialize_mint2(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            InitializeMint2 {
                mint: ctx.accounts.mint_account.to_account_info(),
            },
        ),
        0,                               // decimals
        &ctx.accounts.payer.key(),       // mint authority
        Some(&ctx.accounts.payer.key()), // freeze authority
    )?;

    Ok(())
}
