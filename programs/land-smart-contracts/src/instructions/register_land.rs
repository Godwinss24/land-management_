use crate::state::land_parcel::{LandInfo, ParcelStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(coordinates_hash: [u8; 32])]
pub struct RegisterLand<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        space = 8 + LandInfo::INIT_SPACE,
        payer = payer,
        seeds = [
            LandInfo::SEED_PREFIX,
            coordinates_hash.as_ref(),
        ],
        bump,
    )]
    pub land_info: Account<'info, LandInfo>,

    pub system_program: Program<'info, System>,
}

pub fn register_land(
    ctx: Context<RegisterLand>,
    coordinates_hash: [u8; 32],
    owner: Pubkey,
    status: ParcelStatus,
) -> Result<()> {
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
    land_info.bump = ctx.bumps.land_info;

    Ok(())
}
