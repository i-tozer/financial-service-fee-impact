import Decimal from 'decimal.js';
import { InvestmentConfig, TableRow } from './types';

export class InvestmentCalculator {
  private config: InvestmentConfig;
  private monthDiff: number;
  private defaultMonthlyReturnRate: Decimal;
  private tableData: TableRow[] = [];

  constructor(config: InvestmentConfig) {
    this.config = config;
    this.monthDiff = this.calculateMonthDifference();
    this.defaultMonthlyReturnRate = this.calculateDefaultMonthlyReturnRate();
  }

  /**
   * Calculate and return the investment table data
   */
  public calculate(): TableRow[] {
    this.tableData = [];
    this.initializeTable();
    this.calculateAllMonths();
    return this.tableData;
  }

  /**
   * Calculate the number of months to simulate
   * Uses either:
   * 1. The explicit num_months config parameter
   * 2. The difference between start and end date (for backward compatibility)
   */
  private calculateMonthDifference(): number {
    const { global } = this.config;
    
    // If num_months is explicitly set, use it
    if (global.num_months > 0) {
      return global.num_months;
    }
    
    // Otherwise fall back to date-based calculation
    return (global.end_date.getFullYear() - global.start_date.getFullYear()) * 12 + 
           (global.end_date.getMonth() - global.start_date.getMonth());
  }

  /**
   * Calculate the default monthly return rate based on the annual config
   */
  private calculateDefaultMonthlyReturnRate(): Decimal {
    const { returns } = this.config;
    return returns.value.div(returns.applied_time_unit);
  }
  
  /**
   * Get the return rate for a specific month
   * @param month The month number (1-based)
   * @returns The monthly return rate for the specified month
   */
  private getMonthlyReturnRate(month: number): Decimal {
    // If monthly returns are defined and this month has a specific return rate
    if (this.config.monthlyReturns && this.config.monthlyReturns.length > 0) {
      // Find the return for this month
      const monthlyReturn = this.config.monthlyReturns.find(r => r.month === month);
      if (monthlyReturn) {
        // Check if this is an empty value (special case we added)
        const isEmpty = (monthlyReturn as any).isEmpty;
        if (isEmpty) {
          return new Decimal(0);
        }
        
        // Return is stored as percentage, convert to decimal (divide by 100)
        return monthlyReturn.value.div(100);
      }
    }
    
    // Fall back to default monthly return rate if no specific rate is defined
    return this.defaultMonthlyReturnRate;
  }

  /**
   * Initialize the table with the starting row
   */
  private initializeTable(): void {
    const { global: { starting_principle, start_date } } = this.config;
    
    this.tableData = [];
    this.tableData.push({
      month: 0,
      date: new Date(start_date),
      startingPrinciple: starting_principle,
      endingPrinciple: starting_principle,
      returns: new Decimal(0),
      fees: new Decimal(0),
      valueWithoutFees: starting_principle,
      cumulativeFees: new Decimal(0),
      cumulativeContributions: starting_principle,
      feesPercentage: new Decimal(0),
      momGrossReturnRate: new Decimal(0),
      totalGrossReturnRate: new Decimal(0),
      momNetReturnRate: new Decimal(0),
      momNetExclContribReturnRate: new Decimal(0),
      totalNetReturnRate: new Decimal(0),
      timeWeightedReturn: new Decimal(0),
      moneyWeightedReturn: new Decimal(0)
    });
  }

  /**
   * Calculate all months in the investment period
   */
  private calculateAllMonths(): void {
    for (let month = 1; month <= this.monthDiff; month++) {
      this.calculateMonth(month);
    }
  }

  /**
   * Calculate a single month's data
   */
  private calculateMonth(month: number): void {
    const { global, fees } = this.config;
    const prevRow = this.tableData[month - 1];
    
    const currentDate = new Date(global.start_date);
    currentDate.setMonth(currentDate.getMonth() + month);
    
    // The starting principle for this month is the ending principle from previous month
    let startingPrinciple = prevRow.endingPrinciple;
    
    // Step 1: Add monthly contribution at the START of the month
    let cumulativeContributions = prevRow.cumulativeContributions;
    
    if (global.monthly_contribution.gt(0)) {
      startingPrinciple = startingPrinciple.plus(global.monthly_contribution);
      cumulativeContributions = cumulativeContributions.plus(global.monthly_contribution);
    }
    
    // Step 2: Get the monthly return rate for this specific month
    const monthlyReturnRate = this.getMonthlyReturnRate(month);
    
    // Step 3: Calculate returns based on principle AFTER contribution
    const monthlyReturn = startingPrinciple.mul(monthlyReturnRate);
    
    // Step 4: Calculate principle after returns, before fees
    const principleAfterReturns = startingPrinciple.plus(monthlyReturn);
    
    // Step 5: Calculate fees at the END of the month based on principle after returns
    const monthlyFee = this.calculateMonthlyFees(principleAfterReturns);
    
    // Step 6: Calculate final ending principle after returns and fees
    const endingPrinciple = principleAfterReturns.minus(monthlyFee);
    
    // Track cumulative fees
    const cumulativeFees = prevRow.cumulativeFees.plus(monthlyFee);
    
    // Calculate value without fees for gross returns
    let valueWithoutFees;
    if (global.monthly_contribution.gt(0)) {
      // For value without fees, we need to start with previous value
      valueWithoutFees = prevRow.valueWithoutFees
        .plus(global.monthly_contribution) // Add contribution at start
        .plus(prevRow.valueWithoutFees.plus(global.monthly_contribution).mul(monthlyReturnRate)); // Apply returns to new total
    } else {
      valueWithoutFees = prevRow.valueWithoutFees
        .plus(prevRow.valueWithoutFees.mul(monthlyReturnRate));
    }
    
    // Calculate total net return rate (percentage increase over cumulative contributions)
    const totalNetReturnRate = endingPrinciple.div(cumulativeContributions).minus(1).mul(100);
    
    // Monthly Gross Return Rate (without fees)
    const momGrossReturnRate = monthlyReturnRate.mul(100);
    
    // Total Gross Return Rate (without fees)
    const totalGrossReturnRate = valueWithoutFees.div(cumulativeContributions).minus(1).mul(100);
    
    // Monthly Net Return Rate (with fees, including contribution)
    // We're comparing ending principle to starting principle (which already includes contribution)
    const momNetReturnRate = endingPrinciple.div(startingPrinciple).minus(1).mul(100);
    
    // Monthly Net Return Rate excluding contributions (with fees, excluding contribution)
    // Compare ending principle with previous month's ending principle
    const momNetExclContribReturnRate = endingPrinciple.div(prevRow.endingPrinciple).minus(1).mul(100);
    
    // First add the row to the table with dummy values for the complex metrics
    this.addTableRow(
      month, 
      currentDate, 
      startingPrinciple,
      endingPrinciple,
      monthlyReturn, 
      monthlyFee, 
      valueWithoutFees, 
      cumulativeFees, 
      cumulativeContributions,
      momGrossReturnRate,
      totalGrossReturnRate,
      momNetReturnRate,
      momNetExclContribReturnRate,
      totalNetReturnRate,
      new Decimal(0), // Temporary placeholder for timeWeightedReturn
      new Decimal(0)  // Temporary placeholder for moneyWeightedReturn
    );
    
    // Now calculate the complex metrics with the row already in the table
    // Calculate Time-Weighted Return Rate (TWRR)
    const timeWeightedReturn = this.calculateTimeWeightedReturn(month);
    
    // Calculate Money-Weighted Return (IRR)
    const moneyWeightedReturn = this.calculateMoneyWeightedReturn(month);
    
    // Update the row with the correct values
    this.tableData[month].timeWeightedReturn = timeWeightedReturn;
    this.tableData[month].moneyWeightedReturn = moneyWeightedReturn;
  }

  /**
   * Add a row to the investment table
   */
  private addTableRow(
    month: number, 
    date: Date, 
    startingPrinciple: Decimal,
    endingPrinciple: Decimal,
    returns: Decimal, 
    fees: Decimal, 
    valueWithoutFees: Decimal, 
    cumulativeFees: Decimal,
    cumulativeContributions: Decimal,
    momGrossReturnRate: Decimal,
    totalGrossReturnRate: Decimal,
    momNetReturnRate: Decimal,
    momNetExclContribReturnRate: Decimal,
    totalNetReturnRate: Decimal,
    timeWeightedReturn: Decimal,
    moneyWeightedReturn: Decimal
  ): void {
    this.tableData.push({
      month,
      date,
      startingPrinciple,
      endingPrinciple,
      returns,
      fees,
      valueWithoutFees,
      cumulativeFees,
      cumulativeContributions,
      feesPercentage: fees.div(startingPrinciple).mul(100),
      momGrossReturnRate,
      totalGrossReturnRate,
      momNetReturnRate,
      momNetExclContribReturnRate,
      totalNetReturnRate,
      timeWeightedReturn,
      moneyWeightedReturn
    });
  }

  /**
   * Calculate monthly fees based on principle
   */
  private calculateMonthlyFees(principle: Decimal): Decimal {
    return this.config.fees.reduce((total, fee) => {
      const monthlyFeeRate = fee.value.div(fee.applied_time_unit);
      return total.plus(principle.mul(monthlyFeeRate));
    }, new Decimal(0));
  }

  /**
   * Calculate Money-Weighted Return Rate (MWRR)
   * This is the Internal Rate of Return (IRR) that accounts for the timing of cash flows.
   * IRR is the discount rate that makes the net present value of all cash flows equal to zero.
   */
  private calculateMoneyWeightedReturn(currentMonth: number): Decimal {
    if (currentMonth === 0) return new Decimal(0);
    
    // If there are no contributions (only starting principle), the MWRR equals the total net return rate
    if (this.config.global.monthly_contribution.isZero()) {
      // For the last row that's already in the table
      const prevRow = this.tableData[currentMonth - 1];
      
      // Calculate the values for the current month
      const startingPrinciple = prevRow.endingPrinciple;
      const monthlyReturn = startingPrinciple.mul(this.defaultMonthlyReturnRate);
      const principleAfterReturns = startingPrinciple.plus(monthlyReturn);
      const monthlyFee = this.calculateMonthlyFees(principleAfterReturns);
      const endingPrinciple = principleAfterReturns.minus(monthlyFee);
      
      return endingPrinciple.div(this.config.global.starting_principle).minus(1).mul(100);
    }
    
    // For scenarios with contributions, calculate the Money-Weighted Return (IRR)
    const cashFlows: number[] = [];
    const dates: Date[] = [];
    
    // Initial investment is a negative cash flow (outflow) at time 0
    cashFlows.push(-this.config.global.starting_principle.toNumber());
    dates.push(new Date(this.config.global.start_date));
    
    // Monthly contributions are negative cash flows (outflows) at specific times
    for (let i = 1; i <= currentMonth; i++) {
      // Only add if there was actually a contribution
      if (!this.config.global.monthly_contribution.isZero()) {
        cashFlows.push(-this.config.global.monthly_contribution.toNumber());
        
        // Create date for this contribution (start date + i months)
        const contributionDate = new Date(this.config.global.start_date);
        contributionDate.setMonth(contributionDate.getMonth() + i);
        dates.push(contributionDate);
      }
    }
    
    // Calculate the final value for the end cash flow
    // If we're calculating for a month that's already in the table
    let finalValue: number;
    
    // Check if we need to calculate the ending principle for the current month
    if (this.tableData.length > currentMonth) {
      // Use the value from the table if it's already calculated
      finalValue = this.tableData[currentMonth].endingPrinciple.toNumber();
    } else {
      // Calculate it manually - use the ending principle from the previous month
      const prevRow = this.tableData[currentMonth - 1];
      let startingPrinciple = prevRow.endingPrinciple;
      
      // Add monthly contribution if applicable
      if (this.config.global.monthly_contribution.gt(0)) {
        startingPrinciple = startingPrinciple.plus(this.config.global.monthly_contribution);
      }
      
      // Calculate returns, fees, and final value
      const monthlyReturn = startingPrinciple.mul(this.defaultMonthlyReturnRate);
      const principleAfterReturns = startingPrinciple.plus(monthlyReturn);
      const monthlyFee = this.calculateMonthlyFees(principleAfterReturns);
      const endingPrinciple = principleAfterReturns.minus(monthlyFee);
      
      finalValue = endingPrinciple.toNumber();
    }
    
    // Final value is a positive cash flow (inflow) at the end date
    cashFlows.push(finalValue);
    const endDate = new Date(this.config.global.start_date);
    endDate.setMonth(endDate.getMonth() + currentMonth);
    dates.push(endDate);
    
    // Calculate IRR using the improved approximation method that accounts for actual dates
    const irr = this.calculateImprovedIRR(cashFlows, dates);
    return new Decimal(irr).mul(100);
  }

  /**
   * Calculate Improved IRR (Internal Rate of Return)
   * This algorithm uses the Newton-Raphson method with date-based periods
   */
  private calculateImprovedIRR(cashFlows: number[], dates: Date[]): number {
    if (cashFlows.length !== dates.length) {
      throw new Error("Cash flows and dates arrays must have the same length");
    }
    
    // Convert dates to fractional years from the first date
    const yearFractions = this.datesToYearFractions(dates);
    
    // Initial guess for IRR
    let rate = 0.1; // 10% starting point
    
    // Newton-Raphson method for root finding
    const MAX_ITERATIONS = 100;
    const PRECISION = 0.0000001;
    
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Calculate NPV and its derivative at the current rate
      const [npv, derivative] = this.calculateNPVAndDerivative(cashFlows, yearFractions, rate);
      
      // Check for convergence
      if (Math.abs(npv) < PRECISION) {
        return rate;
      }
      
      // Avoid division by near-zero derivative
      if (Math.abs(derivative) < PRECISION) {
        break;
      }
      
      // Newton-Raphson update step
      const newRate = rate - npv / derivative;
      
      // Check for convergence in rate
      if (Math.abs(newRate - rate) < PRECISION) {
        return newRate;
      }
      
      // Update rate for next iteration
      rate = newRate;
      
      // Bound the rate to prevent excessive values
      if (rate < -0.99) rate = -0.99;
      if (rate > 100) rate = 100;
    }
    
    // Return best approximation if maximum iterations reached
    return rate;
  }
  
  /**
   * Convert array of dates to fractional years from the first date
   */
  private datesToYearFractions(dates: Date[]): number[] {
    if (dates.length === 0) return [];
    
    const firstDate = dates[0];
    const MILLISECONDS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
    
    return dates.map(date => {
      const diffMs = date.getTime() - firstDate.getTime();
      return diffMs / MILLISECONDS_PER_YEAR;
    });
  }
  
  /**
   * Calculate NPV and its derivative at a given rate
   * Returns [NPV, dNPV/dRate]
   */
  private calculateNPVAndDerivative(
    cashFlows: number[], 
    yearFractions: number[], 
    rate: number
  ): [number, number] {
    let npv = 0;
    let derivative = 0;
    
    for (let i = 0; i < cashFlows.length; i++) {
      const t = yearFractions[i];
      const discountFactor = Math.pow(1 + rate, -t);
      
      // NPV calculation
      npv += cashFlows[i] * discountFactor;
      
      // Derivative calculation (dNPV/dRate)
      if (t !== 0) { // Skip derivative calculation for t=0 (initial investment)
        derivative -= t * cashFlows[i] * discountFactor / (1 + rate);
      }
    }
    
    return [npv, derivative];
  }

  /**
   * Calculate Net Present Value for a given discount rate
   * This is a simpler version without derivatives, used by the binary search method
   */
  private calculateNPV(cashFlows: number[], rate: number): number {
    let npv = 0;
    
    // Sum the present value of each cash flow (assuming equally spaced periods)
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + rate, i);
    }
    
    return npv;
  }

  /**
   * Calculate Time-Weighted Return Rate (TWRR)
   * TWRR measures the compound growth rate of the investment independent of the timing and size of cash flows.
   * It answers: "What would my return be if I had invested all my money at the beginning?"
   */
  private calculateTimeWeightedReturn(currentMonth: number): Decimal {
    if (currentMonth === 0) return new Decimal(0);
    
    // For TWRR, we need to calculate each period's return and then link them together
    // by compounding: (1+r₁) × (1+r₂) × ... × (1+rₙ) - 1
    
    // Step 1: Calculate the return for each sub-period (month) that already exists in the table
    const periodReturns: Decimal[] = [];
    
    // Only use months that have complete data (previous months)
    for (let i = 1; i < currentMonth; i++) {
      const periodReturn = this.calculateSinglePeriodReturn(i);
      periodReturns.push(periodReturn);
    }
    
    // For the current month, calculate the return directly without using the row
    // that hasn't been added to the table yet
    if (currentMonth > 0) {
      const { global } = this.config;
      const prevRow = this.tableData[currentMonth - 1];
      
      // Calculate the values needed for the current month's return
      let startValue = prevRow.endingPrinciple;
      let contribution = new Decimal(0);
      
      if (global.monthly_contribution.gt(0)) {
        contribution = global.monthly_contribution;
      }
      
      // Calculate the values for this month
      const principleWithContribution = startValue.plus(contribution);
      const monthlyReturn = principleWithContribution.mul(this.defaultMonthlyReturnRate);
      const principleAfterReturns = principleWithContribution.plus(monthlyReturn);
      const monthlyFee = this.calculateMonthlyFees(principleAfterReturns);
      const endValue = principleAfterReturns.minus(monthlyFee);
      
      // Calculate the period return
      let periodReturn;
      if (contribution.gt(0)) {
        periodReturn = endValue.minus(contribution).div(startValue).minus(1).mul(100);
      } else {
        periodReturn = endValue.div(startValue).minus(1).mul(100);
      }
      
      periodReturns.push(periodReturn);
    }
    
    // Step 2: Geometrically link these returns together
    let cumulativeReturn = new Decimal(1);
    
    for (const returnRate of periodReturns) {
      cumulativeReturn = cumulativeReturn.mul(new Decimal(1).plus(returnRate.div(100)));
    }
    
    // Return the cumulative return as a percentage
    return cumulativeReturn.minus(1).mul(100);
  }
  
  /**
   * Calculate the return for a single period, adjusting for cash flows
   * Formula: (End Value - Contributions) / Start Value - 1
   */
  private calculateSinglePeriodReturn(month: number): Decimal {
    const { global } = this.config;
    
    // Make sure the current row exists before trying to access it
    if (this.tableData.length <= month) {
      throw new Error(`Cannot calculate period return for month ${month}: row not in table yet`);
    }
    
    const prevRow = this.tableData[month - 1];
    const currentRow = this.tableData[month];
    
    // Start value is the ending principle from the previous period
    const startValue = prevRow.endingPrinciple;
    
    // End value is the ending principle for this period
    const endValue = currentRow.endingPrinciple;
    
    // Contribution (if any) is the monthly contribution that was added at the start of this period
    const contribution = global.monthly_contribution;
    
    // Calculate the period return, adjusting for the contribution
    // (End Value - Contribution) / Start Value - 1
    if (contribution.gt(0)) {
      return endValue.minus(contribution).div(startValue).minus(1).mul(100);
    } else {
      return endValue.div(startValue).minus(1).mul(100);
    }
  }
}

// Default investment configuration
export const defaultConfig: InvestmentConfig = {
  fees: [
    {
      name: "annual_advisor_fee",
      description: "prorata",
      type: "simple_rate",
      value: new Decimal(0.03),
      quote_time_unit: "year",
      applied_time_unit: new Decimal(12)
    }
  ],
  returns: {
    type: "simple_rate",
    value: new Decimal(0.12),
    quote_time_unit: "year",
    applied_time_unit: new Decimal(12)
  },
  global: {
    time_unit: "month",
    start_date: new Date("2024-01-01"),
    end_date: new Date("2025-01-01"),
    starting_principle: new Decimal(10000),
    quote_currency: "GBP",
    monthly_contribution: new Decimal(1000),
    num_months: 240 // Default to 12 months
  }
};

/**
 * Factory function to create and run the calculator
 */
export function calculateInvestment(config: InvestmentConfig): TableRow[] {
  const calculator = new InvestmentCalculator(config);
  return calculator.calculate();
} 