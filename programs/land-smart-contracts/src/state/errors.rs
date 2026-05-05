use anchor_lang::prelude::*;

#[error_code]
pub enum LandError {
    #[msg("Caller does not own this land parcel")]
    NotOwner,
    #[msg("A transfer is already pending for this parcel")]
    TransferAlreadyPending,
    #[msg("No pending transfer found for this parcel")]
    NoPendingTransfer,
    #[msg("Pending owner does not match")]
    InvalidPendingOwner,
    #[msg("Transfer request has expired")]
    TransferExpired,
    #[msg("Cannot transfer land with an active mortgage")]
    LandHasMortgage,
    #[msg("A mortgage already exists on this parcel")]
    MortgageAlreadyExists,
    #[msg("No mortgage found on this parcel")]
    NoMortgageFound,
}
