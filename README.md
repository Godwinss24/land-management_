# Anchor Land Management

A Solana-based decentralized land registry system built using the Anchor framework. Manages land parcels as NFTs with on-chain ownership tracking, transfer workflows, and mortgage management.

## Features

- **Land Registration**: Register parcels with hashed coordinates, mint unique NFTs for ownership proof
- **Ownership Transfers**: Initiate and approve land transfers with pending state tracking
- **Mortgage Management**: Setup and settle mortgages linked to land parcels
- **Immutable NFTs**: 1-of-1 NFTs with permanent mint authority removal

## Project Structure

```
anchor-land-management/
└── land-smart-contracts/       # Core Anchor program
    ├── programs/               # Rust on-chain programs
    ├── tests/                  # TypeScript tests
    └── Anchor.toml             # Configuration
```

## Prerequisites

- Solana CLI
- Anchor Framework (v0.32+)
- Node.js (v16+) & Yarn
- Rust (stable)

## Getting Started

```bash
cd land-smart-contracts
yarn install
anchor build
```

## Commands

| Command | Description |
|---------|-------------|
| `anchor test` | Run test suite |
| `anchor deploy` | Deploy to configured cluster |
| `anchor build` | Compile program |

## Smart Contract Instructions

- `register_land`: Register new land parcel + mint NFT
- `initiate_transfer`: Start ownership transfer
- `approve_transfer`: Complete transfer approval
- `setup_mortgage`: Link mortgage to parcel
- `settle_mortgage`: Clear mortgage status

## State

`LandInfo` account stores: coordinates hash, owner, status, mortgage details, NFT mint address.

## License

ISC (see `land-smart-contracts/package.json`)
