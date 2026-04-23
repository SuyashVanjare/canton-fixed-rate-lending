# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Daml Script tests for multi-party loan origination and settlement scenarios.
- Support for loan rollovers, allowing borrowers to extend their loan terms at the prevailing market rate.
- Integration with Canton Token Standard (CIP-0056) for collateral assets, replacing the simple `Collateral` template.

### Changed
- Upgraded project to Canton SDK 3.4.0.
- Refactored `LoanManager.tsx` to use the new `@c7/react` library for state management instead of `@daml/react`.
- Migrated JSON API usage from v1 to v2 endpoints for command submission and state queries.

## [0.3.0] - 2024-05-20

### Added
- `Market.OrderBook` template now supports partial fills, allowing larger orders to be matched against multiple smaller ones.
- New `docs/RATE_DISCOVERY.md` explaining the privacy-preserving batch auction mechanism for rate discovery.
- Frontend `RateBoard` component now visualizes order book depth and expected clearing rates.

### Changed
- **BREAKING**: Replaced the continuous limit order book with a privacy-preserving batch auction model to prevent leaking information about individual order sizes. The `Market.PlaceOrder` choice is replaced by `Market.SubmitOrder`.
- Interest accrual logic moved into a non-consuming choice `Loan.AccrueInterest` for better performance and to allow off-ledger simulation.

### Fixed
- Corrected a rounding error in the final interest payment calculation upon loan maturity.
- Ensured that archiving a loan proposal correctly returns any locked collateral to the borrower.

## [0.2.0] - 2024-04-15

### Added
- `Collateral.CollateralManager` template to handle deposits and withdrawals for multiple types of tokenized Treasury collateral.
- Frontend `LoanManager` now includes a dedicated component for managing collateral positions.
- Daml Script tests for collateral deposit and withdrawal workflows.

### Changed
- The `Loan.Request` template now includes a `collateralType` field to specify which Treasury asset is being posted as collateral.
- Updated `docs/BORROWER_GUIDE.md` with instructions for managing collateral.

### Fixed
- Resolved an issue where observer parties on a `Loan` contract were not properly propagated to the underlying `Collateral` contract, leading to visibility issues.

## [0.1.0] - 2024-03-01

### Added
- Initial release of the Canton Fixed-Rate Lending protocol.
- Core Daml templates: `Loan.Request`, `Loan.Offer`, `Loan.Agreement`, and `Market.OrderBook`.
- Basic frontend components for viewing rates and managing active loans (`RateBoard.tsx`, `LoanManager.tsx`).
- CI pipeline using GitHub Actions and DPM for automated builds and tests.
- Initial project documentation including `docs/BORROWER_GUIDE.md`.