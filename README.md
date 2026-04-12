# Canton Fixed-Rate Lending

[![CI](https://github.com/digital-asset/canton-fixed-rate-lending/actions/workflows/ci.yml/badge.svg)](https://github.com/digital-asset/canton-fixed-rate-lending/actions/workflows/ci.yml)

This project implements a Notional Finance-style fixed-rate, fixed-term borrowing and lending protocol on the Canton Network. It enables institutions to borrow stablecoins at a guaranteed rate against high-quality tokenized collateral, such as US Treasuries.

The core mechanism is a privacy-preserving order book for a zero-coupon bond-like instrument called `fCash`. This design allows for efficient price discovery and matching without revealing individual order sizes on the ledger, catering to the privacy requirements of institutional participants.

---

## Core Concepts

*   **Actors**:
    *   **Borrower**: An institution posting collateral to borrow funds at a fixed rate.
    *   **Lender**: An institution providing liquidity to earn a fixed yield.
    *   **Operator**: A designated party responsible for market administration, such as adding supported collateral types and setting risk parameters.

*   **Assets**:
    *   **Lendable Asset**: The underlying currency being lent and borrowed (e.g., a tokenized representation of USD).
    *   **Collateral Asset**: A high-quality tokenized asset (e.g., a tokenized T-Bill) posted by borrowers to secure their loans.
    *   **fCash**: The central instrument of the protocol. `fCash` represents a claim to one unit of the Lendable Asset at a specific future maturity date. It functions as a zero-coupon bond.

*   **Mechanism**:
    1.  **Collateral Deposit**: A Borrower first deposits their Collateral Asset into the protocol.
    2.  **Order Placement**:
        *   A **Borrower** wanting to borrow places a `BorrowOrder`. This is effectively a *bid* for `fCash`—they are willing to receive cash now in exchange for a future repayment obligation (represented by negative `fCash`). The rate they are willing to pay is implied by the price they bid for `fCash`.
        *   A **Lender** wanting to lend places a `LendOrder`. This is an *offer* for `fCash`—they are willing to give cash now in exchange for a future claim (`fCash`). The rate they wish to earn is implied by the price they offer.
    3.  **Privacy-Preserving Matching**: An off-ledger matching engine (or an on-ledger automated agent) matches `LendOrder` and `BorrowOrder` contracts. The matching logic ensures that individual order details are not made public; only the final, matched trade is committed atomically to the ledger.
    4.  **Loan Origination**: When orders are matched, a `Loan` contract is created atomically. The Borrower receives the Lendable Asset, and the Lender receives the corresponding `fCash` contracts.
    5.  **Maturity & Repayment**:
        *   At maturity, the holder of an `fCash` contract can redeem it for one unit of the Lendable Asset.
        *   To reclaim their collateral, the Borrower must repay the principal and the fixed interest by the maturity date.

## Key Features on Canton

*   **Guaranteed Fixed Rates**: Borrowers and lenders lock in a rate for the term of the loan, eliminating exposure to floating interest rate volatility.
*   **Institutional Privacy**: The order book and matching design leverages Canton's privacy model. A party's active, unmatched orders are not visible to other market participants.
*   **Atomic Settlement (DVP)**: Canton's protocol ensures that the exchange of cash for `fCash` and the locking of collateral happen in a single, atomic transaction. There is no settlement risk.
*   **High-Quality Collateral Focus**: The model is designed for regulated, tokenized assets like government bonds, providing a robust foundation for secure lending.

---

## Borrower Quickstart

This guide walks through the process of setting up the project, depositing collateral, and borrowing at a fixed rate.

### Prerequisites

*   DPM (Canton SDK) version 3.4.0 or later. [Installation Guide](https://docs.digitalasset.com/canton/stable/user-manual/getting-started/download-and-install.html).
*   A running Canton ledger. The quickest way is using `dpm sandbox`.

### 1. Build the Project

Clone the repository and compile the Daml code.

```bash
git clone https://github.com/digital-asset/canton-fixed-rate-lending.git
cd canton-fixed-rate-lending
dpm build
```

This command compiles the Daml models and generates a DAR file in `.daml/dist/`.

### 2. Start a Local Ledger and Run Setup

Open two separate terminal windows.

**In Terminal 1: Start the Sandbox**

This command starts a local Canton ledger, listening for gRPC connections on port 6866 and the JSON API on port 7575.

```bash
dpm sandbox
```

**In Terminal 2: Run the Setup Script**

The `Test.Setup` module contains a Daml Script that bootstraps the ledger with necessary parties (Operator, Borrower, Lender) and sets up an initial market for lending USD against tokenized T-Bills.

```bash
dpm test --files daml/Test/Setup.daml
```

This script will:
*   Allocate parties: `Operator`, `Alice` (Borrower), `Bob` (Lender).
*   Create a `Market.Market` contract, governed by the `Operator`.
*   Mint initial T-Bill collateral for `Alice` and USD for `Bob`.

### 3. Deposit Collateral

`Alice` must first deposit her T-Bill tokens as collateral.

This can be done by exercising the `Deposit` choice on her `TBill.Token` contract. In a real application, this would be a UI action. Using Daml Script for demonstration:

```daml
// In a Daml Script file, e.g., daml/Test/BorrowerWorkflow.daml
module Test.BorrowerWorkflow where

import Daml.Script
import qualified DA.Assert as A

import Main.Collateral
import Main.Market
-- ... other imports

borrower_workflow = script do
  -- Parties allocated from setup
  alice <- A.fromSome <$> Daml.Script.participantPartyId "Alice"
  operator <- A.fromSome <$> Daml.Script.participantPartyId "Operator"

  -- 1. Find Alice's T-Bill token and the Market contract
  (tBillCid, tBill) <- A.fromSome <$> queryContractKey @TBill.Token alice (alice, "T-Bill-001")
  (marketCid, _) <- A.fromSome <$> queryContractKey @Market operator operator

  -- 2. Alice deposits her T-Bills as collateral
  collateralDepositCid <- submit alice do
    exercise tBillCid Deposit with marketCid

  -- ... rest of workflow
```

### 4. Place a Borrow Order

With collateral deposited, `Alice` can now place a `BorrowOrder` to borrow USD. She specifies the maturity, the amount of `fCash` she wants to "sell" (which corresponds to her principal + interest), and the minimum price she'll accept (which implies a maximum interest rate).

```daml
// Continuing the script from above...
  -- 3. Alice places a borrow order
  let
    maturity = date 2025 Dec 31
    fCashAmount = 1050.0 -- Represents a future obligation to pay 1050 USD
    minPrice = 0.95238 -- Implies a max rate of ~5% (1 / 0.95238 - 1)

  borrowOrderCid <- submit alice do
    exercise collateralDepositCid PlaceBorrowOrder with
      maturity
      fCashAmount
      minPrice

  -- The borrow order is now active on the ledger, visible only to Alice and the Operator
  -- It awaits a matching lend order from another participant.
```

Once a Lender places a matching `LendOrder`, the `Operator` (or an automated agent) can match them, which will atomically create a `Loan` contract for `Alice`. She can then query for this `Loan` contract to see the details of her fixed-rate debt.

---

## Project Structure

```
.
├── daml                    # Daml source code
│   ├── Main
│   │   ├── Collateral.daml # Collateral deposit and management
│   │   ├── Loan.daml       # Loan lifecycle, repayment, liquidation
│   │   ├── Market.daml     # Market setup, order book contracts
│   │   ├── Token.daml      # fCash token definition
│   │   └── Types.daml      # Shared data types
│   └── Test
│       ├── Setup.daml      # Initial ledger setup script
│       └── Tests.daml      # Unit and integration tests
├── .gitignore
├── daml.yaml               # Daml project configuration
└── README.md
```

## Development and Testing

*   **Build**: `dpm build`
*   **Run all tests**: `dpm test`
*   **Run a specific test file**: `dpm test --files daml/Test/Tests.daml`
*   **Clean**: `rm -rf .daml`