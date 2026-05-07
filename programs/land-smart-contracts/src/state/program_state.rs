use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProgramState {
    pub admin: Pubkey,
    pub bump: u8,
}

impl ProgramState {
    pub const SEED_PREFIX: &'static [u8] = b"program_state";
}
