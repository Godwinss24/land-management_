use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ParcelStatus {
    Pending,
    Active,
    Lien,
}

#[account]
#[derive(InitSpace)]
pub struct LandInfo {
    pub coordinates_hash: [u8; 32],
    pub owner: Pubkey,
    pub status: ParcelStatus,
    pub pending_owner: Pubkey,
    pub transfer_initiated_at: u64,
    pub has_pending_transfer: bool,
    pub has_mortgage: bool,
    pub lender: Pubkey,
    pub mortgage_principal: u64,
    pub mortgage_org: Pubkey,
    pub bump: u8,
}

impl LandInfo {
    pub const SEED_PREFIX: &'static [u8; 4] = b"land";
}
