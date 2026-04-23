import React from 'react';
import { useParty, useStreamQueries } from '@c7/react';
import { FixedRate } from '@daml.js/canton-fixed-rate-lending-0.1.0';
import styles from './LoanManager.module.css';

// Type definition for a loan contract for better type safety
type LoanContract = FixedRate.Loan.Loan.CreateEvent;

// Helper function to format decimal strings as currency
const formatCurrency = (amount: string, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(amount));
};

// Helper function to format date strings from Daml (YYYY-MM-DD)
const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // Daml dates are UTC
  });
};

// Helper function to calculate days between two dates
const daysBetween = (startDate: Date, endDate: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const start = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((end - start) / oneDay);
};

// Represents a single row in the loan table
const LoanRow: React.FC<{ contract: LoanContract; party: string; now: Date }> = ({ contract, party, now }) => {
  const { payload } = contract;
  const isBorrower = payload.borrower === party;
  const role = isBorrower ? 'Borrower' : 'Lender';

  const issueDate = new Date(payload.issueDate);
  const maturityDate = new Date(payload.maturityDate);

  // Stop accruing interest after maturity
  const interestEndDate = now > maturityDate ? maturityDate : now;
  const daysElapsed = daysBetween(issueDate, interestEndDate);

  // Interest calculation: Principal * Rate * (Time / 365)
  // Assuming a 365-day year for simplicity. For production, consult business requirements (e.g., ACT/360, 30/360).
  const accruedInterest = (parseFloat(payload.principal) * parseFloat(payload.interestRate) * daysElapsed) / 365.0;
  const totalRepayment = parseFloat(payload.principal) + accruedInterest;

  const isMatured = now >= maturityDate;
  const status = isMatured ? 'Matured' : 'Active';

  return (
    <tr key={contract.contractId} className={isBorrower ? styles.borrowerRow : styles.lenderRow}>
      <td>
        <span className={`${styles.roleBadge} ${isBorrower ? styles.borrowerBadge : styles.lenderBadge}`}>
          {role}
        </span>
      </td>
      <td>{formatCurrency(payload.principal)}</td>
      <td>{(parseFloat(payload.interestRate) * 100).toFixed(2)}%</td>
      <td className={styles.interestAmount}>{formatCurrency(accruedInterest.toString())}</td>
      <td className={styles.repaymentAmount}>{formatCurrency(totalRepayment.toString())}</td>
      <td>{formatDate(payload.maturityDate)}</td>
      <td>
        <span className={`${styles.statusBadge} ${isMatured ? styles.maturedBadge : styles.activeBadge}`}>
          {status}
        </span>
      </td>
      <td className={styles.loanId}>{payload.loanId}</td>
    </tr>
  );
};


// Main Loan Manager Component
export const LoanManager: React.FC = () => {
  const party = useParty();
  const { contracts: loans, loading } = useStreamQueries(FixedRate.Loan.Loan);

  if (loading) {
    return <div className={styles.loading}>Loading active loans...</div>;
  }

  // Use a stable 'now' for the entire render cycle
  const now = new Date();

  // Sort loans by maturity date, soonest first
  const sortedLoans = [...loans].sort((a, b) =>
    new Date(a.payload.maturityDate).getTime() - new Date(b.payload.maturityDate).getTime()
  );

  return (
    <div className={styles.loanManagerContainer}>
      <h2 className={styles.header}>Active Loan Portfolio</h2>
      {sortedLoans.length === 0 ? (
        <div className={styles.noLoansMessage}>
          <h3>No Active Loans</h3>
          <p>Your active loans will appear here once they are funded.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.loanTable}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Principal</th>
                <th>Interest Rate (APR)</th>
                <th>Accrued Interest</th>
                <th>Total Due at Maturity</th>
                <th>Maturity Date</th>
                <th>Status</th>
                <th>Loan ID</th>
              </tr>
            </thead>
            <tbody>
              {sortedLoans.map(loan => (
                <LoanRow key={loan.contractId} contract={loan} party={party} now={now} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoanManager;