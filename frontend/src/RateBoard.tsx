import React, { useMemo } from 'react';
import { useStreamQueries } from '@c7/react';
import { FixedRate } from '@daml.js/canton-fixed-rate-lending-0.1.0';
import { differenceInDays, parseISO } from 'date-fns';

// Define the terms (columns) and rate bands (rows) for the rate board
const TERMS_IN_DAYS = [30, 60, 90, 180, 365];
const RATE_STEP = 0.25;
const MIN_RATE = 3.00;
const MAX_RATE = 7.00;

// Generate the rate bands from min/max and step
const RATE_BANDS = Array.from(
  { length: (MAX_RATE - MIN_RATE) / RATE_STEP + 1 },
  (_, i) => MIN_RATE + i * RATE_STEP
).reverse(); // Reverse to show higher rates at the top

// Type definition for the aggregated data structure
type AggregatedData = {
  [term: number]: {
    [rateBand: number]: number; // Total amount for this term/rate combo
  };
};

/**
 * Formats a large number into a more readable string with suffixes (K, M, B).
 * @param amount The numerical amount to format.
 * @returns A formatted string, e.g., "1.5M", "250K".
 */
const formatAmount = (amount: number): string => {
  if (amount < 1e3) return amount.toFixed(0);
  if (amount >= 1e3 && amount < 1e6) return +(amount / 1e3).toFixed(1) + 'K';
  if (amount >= 1e6 && amount < 1e9) return +(amount / 1e6).toFixed(1) + 'M';
  if (amount >= 1e9 && amount < 1e12) return +(amount / 1e9).toFixed(1) + 'B';
  return amount.toExponential(1);
};

/**
 * Finds the closest term bucket for a given offer's term length.
 * @param issueDate The issue date of the offer.
 * @param maturityDate The maturity date of the offer.
 * @returns The closest term from TERMS_IN_DAYS, or null if no suitable bucket is found.
 */
const findTermBucket = (issueDateStr: string, maturityDateStr: string): number | null => {
  const issueDate = parseISO(issueDateStr);
  const maturityDate = parseISO(maturityDateStr);
  const days = differenceInDays(maturityDate, issueDate);

  // Find the closest term bucket this offer falls into
  return TERMS_IN_DAYS.reduce((prev, curr) =>
    (Math.abs(curr - days) < Math.abs(prev - days) ? curr : prev), TERMS_IN_DAYS[0]);
};

/**
 * Finds the rate band for a given interest rate.
 * @param rate The interest rate as a percentage (e.g., 5.25 for 5.25%).
 * @returns The lower bound of the rate band (e.g., 5.25 for a rate of 5.35%).
 */
const findRateBand = (rate: number): number => {
  return Math.floor(rate / RATE_STEP) * RATE_STEP;
};

/**
 * RateBoard component displays a grid of available lending liquidity,
 * aggregated by term and interest rate.
 */
const RateBoard: React.FC = () => {
  const { contracts: offers, loading } = useStreamQueries(FixedRate.Lending.LendingOffer);

  // useMemo is crucial for performance, preventing re-aggregation on every render.
  // The aggregation logic runs only when the list of offers changes.
  const aggregatedLiquidity = useMemo<AggregatedData>(() => {
    const data: AggregatedData = {};
    TERMS_IN_DAYS.forEach(term => data[term] = {});

    offers.forEach(offer => {
      const { amount, rate, issueDate, maturityDate } = offer.payload;

      const termBucket = findTermBucket(issueDate, maturityDate);
      if (termBucket === null) return; // Skip if offer doesn't fit a standard term

      // Daml Decimal is a string; convert to number for calculations.
      // Rate is a decimal (e.g., 0.05), so multiply by 100 for percentage.
      const ratePercent = parseFloat(rate) * 100;
      const rateBand = findRateBand(ratePercent);

      const offerAmount = parseFloat(amount);

      // Initialize the rate band for the term if it doesn't exist
      if (!data[termBucket][rateBand]) {
        data[termBucket][rateBand] = 0;
      }
      data[termBucket][rateBand] += offerAmount;
    });

    return data;
  }, [offers]);

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Loading Rate Board...</div>;
  }

  return (
    <div className="bg-gray-900 text-white font-sans rounded-lg shadow-xl overflow-hidden border border-gray-700">
      <h2 className="text-xl font-semibold p-4 border-b border-gray-700">
        Lending Rate Board
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-center">
          <thead className="bg-gray-800">
            <tr>
              <th className="p-3 font-medium text-gray-400 tracking-wider">Rate (% APY)</th>
              {TERMS_IN_DAYS.map(term => (
                <th key={term} className="p-3 font-medium text-gray-400 tracking-wider">
                  {term} Days
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {RATE_BANDS.map(rateBand => (
              <tr key={rateBand} className="hover:bg-gray-800/50 transition-colors duration-150">
                <td className="p-3 font-mono text-gray-400">
                  {rateBand.toFixed(2)} - {(rateBand + RATE_STEP).toFixed(2)}
                </td>
                {TERMS_IN_DAYS.map(term => {
                  const liquidity = aggregatedLiquidity[term]?.[rateBand] ?? 0;
                  const hasLiquidity = liquidity > 0;
                  const cellClasses = hasLiquidity
                    ? 'text-cyan-300 font-semibold'
                    : 'text-gray-600';

                  return (
                    <td key={`${term}-${rateBand}`} className={`p-3 font-mono ${cellClasses}`}>
                      {hasLiquidity ? formatAmount(liquidity) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {offers.length === 0 && !loading && (
        <div className="p-4 text-center text-gray-500">
          No lending offers available.
        </div>
      )}
    </div>
  );
};

export default RateBoard;