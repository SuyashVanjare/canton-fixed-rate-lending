# Canton Fixed-Rate Lending: Borrower's Guide

This guide provides a comprehensive overview for institutions looking to borrow funds through the Canton Fixed-Rate Lending platform. The protocol enables borrowing at a fixed, predictable interest rate against high-quality tokenized collateral.

## Overview

The platform connects institutional borrowers with lenders in a private, secure, and efficient manner. Borrowers can lock tokenized assets, such as US Treasuries, as collateral to obtain fixed-term, fixed-rate loans in a settlement asset (e.g., a fiat-backed stablecoin).

The key benefits for borrowers are:
- **Rate Certainty**: Lock in an interest rate for the duration of the loan, eliminating exposure to floating rate volatility.
- **Privacy**: Loan details and borrowing activity are confidential, visible only to the direct parties involved (borrower, lender, operator), thanks to Canton's privacy model.
- **Atomic Settlement**: Daml smart contracts guarantee that loan disbursement and collateral locking, as well as loan repayment and collateral release, occur atomically in a single transaction. There is no settlement risk.
- **Efficiency**: The entire lifecycle, from request to repayment, is managed on-ledger, reducing paperwork and back-office reconciliation.

## Accepted Collateral

The platform primarily accepts tokenized, high-quality liquid assets (HQLA). The initial set of accepted collateral includes:

- **Tokenized US Treasury Bills (T-Bills)**: Short-term debt instruments issued by the U.S. government.
- **Tokenized US Treasury Notes (T-Notes)**: Medium-term government debt instruments.
- **Tokenized US Treasury Bonds (T-Bonds)**: Long-term government debt instruments.

All collateral must conform to the Canton token standard (CIP-0056) and be held in the borrower's wallet on a Canton participant node.

## Loan Terms

Each loan is defined by a set of clear, immutable terms established at origination.

- **Principal**: The amount of the settlement asset (e.g., USDC) that the borrower receives.
- **Collateral**: The amount and type of tokenized asset pledged by the borrower. The required collateral value is determined by the loan-to-value (LTV) ratio set by the platform operator.
- **Maturity**: The date on which the loan principal and accrued interest are due.
- **Fixed Interest Rate**: The annualized interest rate, determined through the rate discovery mechanism. This rate is locked for the entire term of the loan.
- **Repayment Amount**: The total amount due at maturity, calculated as `Principal + (Principal * Rate * Term)`. This amount is fixed and known at origination.

## The Borrowing Workflow

The borrowing process is designed to be straightforward and secure, managed entirely through Daml smart contracts.

### Step 1: Pledging Collateral

Before requesting a loan, the borrower must first pledge their collateral.

1.  The borrower holds the tokenized Treasury asset in their Canton wallet.
2.  The borrower initiates a transaction to create a `Collateral.Pledge` contract.
3.  This action atomically transfers the collateral tokens into the control of the `Pledge` contract, which is co-signed by the borrower and the platform Operator.
4.  The borrower receives a `Collateral.Pledged` contract, which serves as a claim on the locked collateral and can be used to secure a loan. The asset is now encumbered and cannot be transferred by the borrower.

### Step 2: Submitting a Borrow Request

With collateral pledged, the borrower can now submit a request to borrow.

1.  The borrower creates a `Market.BorrowRequest` contract.
2.  The request specifies:
    - The `ContractId` of the `Collateral.Pledged` contract.
    - The desired principal amount.
    - The desired maturity date.
3.  This request is visible to the platform Operator, who manages the order book.

### Step 3: Rate Discovery & Loan Origination

The `BorrowRequest` enters the platform's privacy-preserving order book to be matched with lender offers.

1.  **Matching**: The Operator's matching engine pairs the `BorrowRequest` with one or more `LendOrder`s based on rate and maturity. The matching process is designed to find the best available rate for the borrower. For more details, see [RATE_DISCOVERY.md](./RATE_DISCOVERY.md).
2.  **Origination**: Once a match is found, the Operator triggers an atomic transaction that:
    - Creates the final `Lending.Loan` contract, viewable by the borrower, lender(s), and Operator. This contract codifies all loan terms.
    - Consumes the `BorrowRequest` and the corresponding `LendOrder`(s).
    - Transfers the loan principal (e.g., USDC) from the lender(s) to the borrower.
    - Consumes the `Collateral.Pledged` contract and creates a `Loan.CollateralLock` contract, which formally links the collateral to this specific loan.

The borrower has now successfully received the loan funds, and the loan is officially active.

## Managing and Repaying Your Loan

### The `Loan` Contract

The active `Lending.Loan` contract is the single source of truth for the debt obligation. The borrower can query this contract at any time to see the loan terms, maturity date, and total repayment amount.

### The Repayment Process

Repayment is a simple, atomic process driven by the borrower.

1.  **Initiate Repayment**: On or before the maturity date, the borrower creates a `Repayment.RepaymentInstruction` contract. This instruction includes an `Allocation` of the required repayment amount (principal + interest) in the settlement currency. This signals the borrower's intent and readiness to repay.
2.  **Settle Repayment**: The borrower (or Operator) exercises the `Repay` choice on the active `Lending.Loan` contract, providing the `RepaymentInstruction` Contract ID as an argument.
3.  **Atomic Settlement & Collateral Release**: This single `Repay` choice executes an atomic transaction that:
    - Consumes the `RepaymentInstruction`, transferring the repayment funds from the borrower to the lender(s).
    - Archives the `Lending.Loan` contract, extinguishing the debt.
    - Archives the `Loan.CollateralLock` contract.
    - Returns the underlying collateral tokens to the borrower's wallet, free and clear.

If any step fails, the entire transaction is rolled back, ensuring neither party is left in an inconsistent state.

## Liquidation

If the value of the pledged collateral falls below a predetermined maintenance margin, the loan is at risk of liquidation. In such an event, the Operator has the right to exercise a `Liquidate` choice on the `Loan` contract. This will seize the collateral, sell it on the open market to recover the outstanding loan amount, and return any excess funds to the borrower. Borrowers are expected to monitor their collateralization levels to avoid liquidation.

## Why Daml and Canton?

This protocol is built on Daml and Canton to leverage their unique strengths for institutional finance:

- **Privacy by Default**: Canton's architecture ensures that contract data is only shared with stakeholders. Your borrowing positions are not exposed on a public ledger.
- **Guaranteed Atomicity**: Daml's transaction model eliminates settlement risk. Complex, multi-step workflows like loan origination and repayment are guaranteed to execute fully or not at all.
- **Interoperability**: Canton is designed to connect different participants and ledgers, enabling a seamless flow of assets and data across the financial ecosystem.
- **Legal and Operational Clarity**: Daml contracts clearly define the rights, obligations, and authorities of each party, providing an auditable and unambiguous record of the entire loan lifecycle.