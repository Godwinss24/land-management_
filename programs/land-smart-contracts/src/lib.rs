use anchor_lang::prelude::*;
pub mod state;
pub mod instructions;

use instructions::*;
use state::land_parcel::ParcelStatus;

declare_id!("GLQRLagJYyfpPSyYkhmhgrGLqDPKjV26q4GzAQ9t8zMF");

#[program]
pub mod land_smart_contracts {
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
    ) -> Result<()> {
        instructions::register_land::register_land(ctx, coordinates_hash, owner, status)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
