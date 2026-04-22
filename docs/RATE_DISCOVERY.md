# Rate Discovery and Privacy-Preserving Order Book

This document outlines the rate discovery mechanism used in the Canton Fixed-Rate Lending protocol. The core of the system is a privacy-preserving order book designed to match institutional borrowers and lenders for fixed-term, fixed-rate loans collateralized by tokenized assets, such as government bonds.

## 1. Overview

The primary goal is to establish a fair market interest rate for a given loan maturity (e.g., 30-day, 90-day) while maximizing transaction privacy for participants. Unlike a continuous, transparent central limit order book (CLOB) found in traditional exchanges, our model uses a periodic batch auction. This approach prevents information leakage about individual order sizes and price sensitivity, which is critical for institutional participants who need to execute large trades without moving the market against them.

The key features of the model are:
*   **Fixed-Rate, Fixed-Term:** All loans for a given maturity that are matched in a batch receive the same, single interest rate (the "clearing rate").
*   **Privacy-Preserving:** Individual order details (principal amount and rate limit) are never revealed to other market participants. Only the submitter and the designated Market Operator can see the order.
*   **Atomic Settlement:** Order matching, loan creation, principal transfer, and collateral locking occur in a single, atomic Daml transaction, eliminating settlement risk.
*   **Verifiable Matching:** The matching algorithm is encoded in a Daml smart contract, ensuring a deterministic and verifiable outcome for every participant.

## 2. The Order Book and Matching Model

The order book is composed of two primary contract types on the ledger:

*   **`LendOrder`**: A commitment by a lender to provide a certain `principal` amount at or above a specified minimum Annual Percentage Rate (`minApr`) for a given `maturity`.
*   **`BorrowOrder`**: A commitment by a borrower to take a loan of a certain `principal` amount at or below a specified maximum Annual percentage rate (`maxApr`) for a given `maturity`. The borrower must also pre-position the required collateral, which is referenced in the order.

### 2.1. The Matching Process

Matching is not continuous. It is triggered periodically (e.g., daily at a set time) by a trusted `MarketOperator` party for each specific maturity.

The matching algorithm proceeds as follows:

1.  **Collection**: The `MarketOperator` gathers all active `LendOrder` and `BorrowOrder` contracts for a single maturity (e.g., all orders maturing on 2025-12-31).
2.  **Sorting**:
    *   `BorrowOrder` contracts are sorted in descending order by their `maxApr` (highest rate bids first).
    *   `LendOrder` contracts are sorted in ascending order by their `minApr` (lowest rate offers first).
3.  **Cumulative Volume Calculation**: The operator constructs cumulative supply (lending) and demand (borrowing) curves based on the sorted orders.
4.  **Finding the Clearing Rate**: The clearing rate is the interest rate at which the largest volume of principal can be matched. This is the intersection point of the supply and demand curves.
    *   All borrowers who bid at or above the clearing rate are matched.
    *   All lenders who offered at or below the clearing rate are matched.
    *   Crucially, *all matched participants receive the same, single clearing rate*, even if their original bid/offer was more favorable. This is a key feature of a uniform price auction.
5.  **Atomic Execution**: The `MarketOperator` exercises a choice that executes the entire matching and settlement process within one atomic transaction. This choice:
    *   Calculates the clearing rate and total matched volume based on the input order contracts.
    *   Identifies which orders (or portions of orders) will be filled.
    *   For each matched lender-borrower pair, it initiates a Delivery-vs-Payment (DVP) settlement. This transfers the principal from the lender to the borrower and simultaneously locks the borrower's collateral in a `LoanCollateral` contract.
    *   Creates a `FixedRateLoan` contract representing the new debt obligation.
    *   Archives the `LendOrder` and `BorrowOrder` contracts that were fully or partially filled, creating new contracts for any remaining unfilled portions.

### 2.2. Example Walkthrough

Consider a market for loans maturing in 90 days.

**Lend Orders (Supply):**
*   Lender A: $1,000,000 @ 4.80% `minApr`
*   Lender B: $2,000,000 @ 4.85% `minApr`
*   Lender C: $500,000 @ 4.90% `minApr`

**Borrow Orders (Demand):**
*   Borrower X: $1,500,000 @ 4.95% `maxApr`
*   Borrower Y: $1,200,000 @ 4.85% `maxApr`
*   Borrower Z: $800,000 @ 4.80% `maxApr`

**Matching Logic:**
1.  **Sort Orders:** Lenders are sorted `A, B, C`. Borrowers are sorted `X, Y, Z`.
2.  **Construct Curves:**
    *   At 4.80%, supply is $1M (A), demand is $3.5M (X+Y+Z). Demand > Supply.
    *   At 4.85%, supply is $3M (A+B), demand is $2.7M (X+Y). Supply > Demand.
3.  **Determine Clearing Rate:** The curves cross between 4.80% and 4.85%. The clearing rate will be **4.85%**. This is the highest rate at which demand is met or exceeded by supply.
4.  **Determine Matched Volume:**
    *   **Lenders matched:** A ($1M @ 4.80%) and B ($2M @ 4.85%) are both willing to lend at 4.85%. Total supply available: $3M.
    *   **Borrowers matched:** X ($1.5M @ 4.95%) and Y ($1.2M @ 4.85%) are willing to borrow at 4.85%. Total demand: $2.7M.
    *   **Total volume:** The matched volume is the minimum of total supply and demand at the clearing rate: `min($3.0M, $2.7M) = $2.7M`.
5.  **Execution:**
    *   A single transaction executes the settlement for $2.7M.
    *   Borrowers X and Y get their loans filled at 4.85%.
    *   Lender A is fully filled ($1M). Lender B is partially filled ($1.7M out of $2M).
    *   The remaining portion of Lender B's order ($300k) becomes a new `LendOrder` contract.
    *   Lender C and Borrower Z are completely unfilled, and their original `LendOrder` and `BorrowOrder` contracts remain active for the next auction.

## 3. Privacy on Canton

Canton's underlying privacy model is fundamental to this design.

*   When a lender submits a `LendOrder`, the contract is only visible to the `lender` (the signatory) and the `MarketOperator` (an observer). No other participant in the network can see that this order exists, let alone its size or rate. The same applies to `BorrowOrder` contracts.
*   During the matching transaction, the `MarketOperator` must fetch the details of the orders it is matching. Canton ensures that the operator has the necessary visibility to do this, but the underlying order data is only shared with the participants of that specific atomic transaction.
*   The final `FixedRateLoan` and `LoanCollateral` contracts are private agreements between the lender, the borrower, and any required observers (like the operator or a regulator). Uninvolved third parties have no visibility into the loan's existence or its terms.

This "privacy by design" ensures that an institution's trading strategy is not leaked to the wider market, preventing front-running and other forms of market manipulation. The only information that might be made public by the `MarketOperator` is the aggregate result: the clearing rate and total volume matched for that period.