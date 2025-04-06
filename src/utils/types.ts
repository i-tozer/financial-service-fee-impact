import Decimal from 'decimal.js';

// Types for the calculator
export interface Fee {
  name: string;
  description: string;
  type: string;
  value: Decimal;
  quote_time_unit: string;
  applied_time_unit: Decimal;
}

export interface Returns {
  type: string;
  value: Decimal;
  quote_time_unit: string;
  applied_time_unit: Decimal;
}

// New interface for monthly returns
export interface MonthlyReturn {
  month: number;
  value: Decimal; // Return rate for this month (percentage)
  date?: string; // Optional date for display purposes
}

export interface Global {
  time_unit: string;
  start_date: Date;
  end_date: Date;
  starting_principle: Decimal;
  quote_currency: string;
  monthly_contribution: Decimal;
  // Number of months to calculate
  num_months: number;
}

export interface InvestmentConfig {
  fees: Fee[];
  // Original annual return (used as fallback)
  returns: Returns;
  // New monthly returns array
  monthlyReturns?: MonthlyReturn[];
  global: Global;
}

export interface TableRow {
  month: number;
  date: Date;
  startingPrinciple: Decimal;
  endingPrinciple: Decimal;
  returns: Decimal;
  fees: Decimal;
  valueWithoutFees: Decimal;
  cumulativeFees: Decimal;
  cumulativeContributions: Decimal;
  feesPercentage: Decimal;
  momGrossReturnRate: Decimal;
  totalGrossReturnRate: Decimal;
  momNetReturnRate: Decimal;
  momNetExclContribReturnRate: Decimal;
  totalNetReturnRate: Decimal;
  timeWeightedReturn: Decimal;
  moneyWeightedReturn: Decimal;
} 