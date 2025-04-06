import Decimal from 'decimal.js';
import { calculateInvestment, defaultConfig } from './investmentCalculator';
import { InvestmentConfig } from './types';

// Helper function to adjust decimal precision for tests
const toFixedDecimal = (value: string, decimals: number = 4): string => {
  return new Decimal(value).toFixed(decimals);
};

describe('Investment Calculator', () => {
  test('should handle default values correctly', () => {
    // Use the default configuration
    const result = calculateInvestment(defaultConfig);
    
    // We should have 13 months (0-12)
    expect(result.length).toBe(13);
    
    // Initial state (month 0) checks
    expect(result[0].month).toBe(0);
    expect(result[0].startingPrinciple.toString()).toBe('100');
    expect(result[0].endingPrinciple.toString()).toBe('100');
    expect(result[0].returns.toString()).toBe('0');
    expect(result[0].fees.toString()).toBe('0');
    
    // Check month 1 calculations
    // With a 12% annual fee, the monthly fee should be 1%
    expect(toFixedDecimal(result[1].fees.toString(), 2)).toBe('1.00');
    
    // After 12 months with fees and no returns
    // The principle should decrease by approximately 11.36%
    const finalPrinciple = result[12].endingPrinciple;
    const expectedPrinciple = toFixedDecimal('88.64', 2);
    expect(toFixedDecimal(finalPrinciple.toString(), 2)).toBe(expectedPrinciple);
    
    // Total fees should be approximately 11.36
    const totalFees = result[12].cumulativeFees;
    expect(toFixedDecimal(totalFees.toString(), 2)).toBe('11.36');
  });
  
  test('should calculate with returns and no fees', () => {
    const config: InvestmentConfig = {
      ...defaultConfig,
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0) // No fees
        }
      ],
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0.12) // 12% annual returns
      }
    };
    
    const result = calculateInvestment(config);
    
    // Initial state (month 0)
    expect(result[0].startingPrinciple.toString()).toBe('100');
    expect(result[0].endingPrinciple.toString()).toBe('100');
    
    // Check month 1 calculations
    // Returns = 100 * (0.12/12) = 1
    // No fees = 0
    // New principle = 100 + 1 - 0 = 101
    expect(toFixedDecimal(result[1].startingPrinciple.toString(), 2)).toBe('100.00');
    expect(toFixedDecimal(result[1].returns.toString(), 2)).toBe('1.00');
    expect(result[1].fees.toString()).toBe('0');
    expect(toFixedDecimal(result[1].endingPrinciple.toString(), 2)).toBe('101.00');
    
    // Check month 12 (last month)
    // After 12 months of 1% return per month
    // We expect a total return of approximately 12.68% due to compounding
    expect(toFixedDecimal(result[12].totalNetReturnRate.toString(), 2)).toBe('12.68');
  });
  
  test('should calculate with both returns and fees', () => {
    const config: InvestmentConfig = {
      ...defaultConfig,
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0.12) // 12% annual fee
        }
      ],
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0.12) // 12% annual returns
      }
    };
    
    const result = calculateInvestment(config);
    
    // Initial state (month 0)
    expect(result[0].startingPrinciple.toString()).toBe('100');
    expect(result[0].endingPrinciple.toString()).toBe('100');
    
    // Check month 1 calculations with new order of operations:
    // 1. Starting principle = 100
    // 2. Calculate returns (1% monthly) on 100: +1
    // 3. Apply fees (1% monthly) on 101: -1.01
    // 4. Ending principle = 100 + 1 - 1.01 = 99.99
    expect(toFixedDecimal(result[1].startingPrinciple.toString(), 2)).toBe('100.00');
    expect(toFixedDecimal(result[1].returns.toString(), 2)).toBe('1.00');
    expect(toFixedDecimal(result[1].fees.toString(), 2)).toBe('1.01');
    expect(toFixedDecimal(result[1].endingPrinciple.toString(), 2)).toBe('99.99');
    
    // With equal returns and fees, the principle should remain roughly the same,
    // but will be slightly lower due to fees being applied after returns
    expect(toFixedDecimal(result[12].endingPrinciple.toString(), 2)).toBe('99.88');
  });
  
  test('should calculate with monthly contributions', () => {
    const config: InvestmentConfig = {
      ...defaultConfig,
      global: {
        ...defaultConfig.global,
        monthly_contribution: new Decimal(10) // £10 monthly
      }
    };
    
    const result = calculateInvestment(config);
    
    // Month 1 calculations with new order of operations:
    // 1. Add contribution at START: 100 + 10 = 110
    // 2. Calculate fee (1% monthly) on 110: 1.10
    // 3. Ending principle = 110 - 1.10 = 108.90
    expect(toFixedDecimal(result[1].startingPrinciple.toString(), 2)).toBe('110.00');
    expect(toFixedDecimal(result[1].fees.toString(), 2)).toBe('1.10');
    expect(toFixedDecimal(result[1].endingPrinciple.toString(), 2)).toBe('108.90');
    
    // Month 2 calculations with new order of operations:
    // 1. Add contribution at START: 108.90 + 10 = 118.90
    // 2. Calculate fee (1% monthly) on 118.90: 1.19
    // 3. Ending principle = 118.90 - 1.19 = 117.71
    expect(toFixedDecimal(result[2].startingPrinciple.toString(), 2)).toBe('118.90');
    expect(toFixedDecimal(result[2].endingPrinciple.toString(), 2)).toBe('117.71');
    
    // Final month should reflect 12 contributions minus fees
    // Approximately ~200
    const finalValue = result[12].endingPrinciple;
    expect(parseFloat(finalValue.toString())).toBeGreaterThan(198);
  });

  test('should calculate return rates based on cumulative contributions', () => {
    const config: InvestmentConfig = {
      ...defaultConfig,
      global: {
        ...defaultConfig.global,
        starting_principle: new Decimal(100),
        monthly_contribution: new Decimal(100) // £100 monthly contribution
      },
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0.12) // 12% annual returns
      },
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0) // No fees for simplicity
        }
      ]
    };
    
    const result = calculateInvestment(config);
    
    // Initial state (month 0)
    expect(result[0].cumulativeContributions.toString()).toBe('100'); // Initial principle only
    
    // Check month 1
    expect(result[1].cumulativeContributions.toString()).toBe('200'); // 100 initial + 100 contribution
    
    // Month 3 should have cumulative contributions of 400
    expect(result[3].cumulativeContributions.toString()).toBe('400'); // 100 initial + 300 contributions
    
    // Final month (12) should have 1300 in cumulative contributions
    expect(result[12].cumulativeContributions.toString()).toBe('1300'); // 100 initial + 1200 contributions
    
    // Calculate expected return for month 12
    // With contributions applied at start of month and 1% monthly return
    // Total return rate should be approximately 7-8%
    const month12ReturnRate = parseFloat(result[12].totalNetReturnRate.toString());
    expect(month12ReturnRate).toBeGreaterThan(6);
    expect(month12ReturnRate).toBeLessThan(8);
    
    // The total net return rate should be lower than if we had calculated it 
    // based only on starting principle
    const incorrectReturnRate = result[12].endingPrinciple.div(config.global.starting_principle).minus(1).mul(100);
    expect(parseFloat(incorrectReturnRate.toString())).toBeGreaterThan(1000); // Would be over 1000%
    expect(month12ReturnRate).toBeLessThan(parseFloat(incorrectReturnRate.toString()));
  });

  test('should calculate correct MoM Net Return Rate with monthly contributions', () => {
    const config: InvestmentConfig = {
      ...defaultConfig,
      global: {
        ...defaultConfig.global,
        starting_principle: new Decimal(1000),
        monthly_contribution: new Decimal(100) // £100 monthly contribution
      },
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0.12) // 12% annual returns (1% monthly)
      },
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0.024) // 0.2% monthly fee
        }
      ]
    };
    
    const result = calculateInvestment(config);
    
    // Calculate expected month 1 returns with new ordering:
    // 1. Starting principle = 1000
    // 2. Add contribution = 1000 + 100 = 1100
    // 3. Calculate returns (1%): 1100 * 0.01 = 11
    // 4. Principle after returns: 1100 + 11 = 1111
    // 5. Calculate fees (0.2%): 1111 * 0.002 = 2.22
    // 6. Ending principle: 1111 - 2.22 = 1108.78
    
    // Check that MoM Net Return includes the contribution in starting value
    // MoM Net Return should be around 0.8% (1% return - 0.2% fee)
    const month1NetReturn = parseFloat(result[1].momNetReturnRate.toString());
    expect(month1NetReturn).toBeCloseTo(0.8, 1); // Should be close to 0.8% with some rounding
    
    // Note that this is different from the previous approach where we 
    // explicitly excluded the contribution. Now, the contribution is 
    // included in the starting principle, so the return is calculated 
    // on the full amount including the contribution.
    
    // Verify that total return rates are calculated correctly
    const incorrectCalc = result[1].endingPrinciple.div(result[0].endingPrinciple).minus(1).mul(100);
    expect(parseFloat(incorrectCalc.toString())).toBeCloseTo(10.9, 1);
    
    // Verify month 2 as well
    // Previous month ending principal: ~1108.78, now starting principal for month 2
    // Add contribution: 1108.78 + 100 = 1208.78
    // Monthly return (1%): 1208.78 * 0.01 = 12.09
    // After returns: 1208.78 + 12.09 = 1220.87
    // Monthly fee (0.2%): 1220.87 * 0.002 = 2.44
    // After fees: 1220.87 - 2.44 = 1218.43
    
    // MoM Net Return should still be around 0.8%
    const month2NetReturn = parseFloat(result[2].momNetReturnRate.toString());
    expect(month2NetReturn).toBeCloseTo(0.8, 1);
  });

  test('should handle large monthly contributions correctly', () => {
    const config: InvestmentConfig = {
      ...defaultConfig,
      global: {
        ...defaultConfig.global,
        starting_principle: new Decimal(100), // £100 starting
        monthly_contribution: new Decimal(100000000) // £100,000,000 monthly
      },
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0) // 0% annual returns
      },
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0.12) // 12% annual fee (1% monthly)
        }
      ]
    };
    
    const result = calculateInvestment(config);
    
    // Month 0 checks (initial state)
    expect(result[0].month).toBe(0);
    expect(result[0].startingPrinciple.toString()).toBe('100');
    expect(result[0].endingPrinciple.toString()).toBe('100');
    expect(result[0].returns.toString()).toBe('0');
    expect(result[0].fees.toString()).toBe('0');
    expect(result[0].cumulativeContributions.toString()).toBe('100');
    expect(result[0].totalNetReturnRate.toString()).toBe('0');
    
    // Month 1 calculations with new order of operations:
    // 1. Starting principle = previous month ending principle = 100
    // 2. Add contribution at START: 100 + 100000000 = 100000100
    // 3. Calculate returns (0%): 0
    // 4. Calculate principle after returns: 100000100
    // 5. Apply fees at END (1%): 100000100 * 0.01 = 1000001
    // 6. Ending principle: 100000100 - 1000001 = 99000099
    // 7. Cumulative contributions: 100 + 100000000 = 100000100
    
    expect(result[1].startingPrinciple.toString()).toBe('100000100');
    expect(result[1].returns.toString()).toBe('0');
    expect(result[1].fees.toString()).toBe('1000001');
    expect(result[1].endingPrinciple.toString()).toBe('99000099');
    expect(result[1].cumulativeContributions.toString()).toBe('100000100');
    
    // Total Net Return Rate calculation
    // (endingPrinciple / cumulativeContributions) - 1 * 100
    // (99000099 / 100000100) - 1 * 100 = -1%
    // The total net return should be approximately -1% due to the 1% fee
    const month1TotalNetReturn = parseFloat(result[1].totalNetReturnRate.toString());
    expect(month1TotalNetReturn).toBeCloseTo(-1, 1);
    
    // Calculate it manually for verification
    const expectedTotalNetReturn = new Decimal(result[1].endingPrinciple)
      .div(result[1].cumulativeContributions)
      .minus(1)
      .mul(100);
    
    expect(parseFloat(result[1].totalNetReturnRate.toString()))
      .toBeCloseTo(parseFloat(expectedTotalNetReturn.toString()), 1);
      
    // Month-over-Month Net Return Rate should also be around -1%
    // (endingPrinciple / startingPrinciple) - 1 * 100
    // (99000099 / 100000100) - 1 * 100 = -1%
    const momNetReturn = parseFloat(result[1].momNetReturnRate.toString());
    expect(momNetReturn).toBeCloseTo(-1, 1);
  });

  test('should calculate correctly with requested test case', () => {
    const config: InvestmentConfig = {
      ...defaultConfig,
      global: {
        ...defaultConfig.global,
        starting_principle: new Decimal(100), // £100 starting
        monthly_contribution: new Decimal(100000000) // £100,000,000 monthly
      },
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0) // 0% annual returns
      },
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0.12) // 12% annual fee (1% monthly)
        }
      ]
    };
    
    const result = calculateInvestment(config);
    
    // Month 0 checks (initial state)
    expect(result[0].month).toBe(0);
    expect(result[0].startingPrinciple.toString()).toBe('100');
    expect(result[0].endingPrinciple.toString()).toBe('100');
    expect(result[0].returns.toString()).toBe('0');
    expect(result[0].fees.toString()).toBe('0');
    expect(result[0].cumulativeContributions.toString()).toBe('100');
    expect(result[0].totalNetReturnRate.toString()).toBe('0');
    
    // Month 1 calculations:
    // 1. Starting principle = previous month's ending principle = 100
    // 2. Add monthly contribution at START: 100 + 100,000,000 = 100,000,100
    // 3. Calculate returns (0%): 0
    // 4. Calculate fees at END (1% of 100,000,100): 1,000,001
    // 5. Ending principle: 100,000,100 - 1,000,001 = 99,000,099
    // 6. Cumulative contributions: 100 + 100,000,000 = 100,000,100
    
    expect(result[1].startingPrinciple.toString()).toBe('100000100');
    expect(result[1].returns.toString()).toBe('0');
    expect(result[1].fees.toString()).toBe('1000001');
    expect(result[1].endingPrinciple.toString()).toBe('99000099');
    expect(result[1].cumulativeContributions.toString()).toBe('100000100');
    
    // Total Net Return should be approximately -1% due to 1% fee on a 0% return
    const totalNetReturn = parseFloat(result[1].totalNetReturnRate.toString());
    expect(totalNetReturn).toBeCloseTo(-1, 1);
    
    // Calculate expected Total Net Return manually
    // (endingPrinciple / cumulativeContributions) - 1 * 100
    // (99,000,099 / 100,000,100) - 1 * 100 = -1%
    const expectedTotalNetReturn = new Decimal(result[1].endingPrinciple)
      .div(result[1].cumulativeContributions)
      .minus(1)
      .mul(100);
    
    expect(parseFloat(expectedTotalNetReturn.toString())).toBeCloseTo(-1, 1);
  });

  test('should demonstrate how monthly contributions affect total net return with fees and no returns', () => {
    // Case 1: Small starting principle (£1), no monthly contribution, 12% annual fee
    const configSmallNoContribution: InvestmentConfig = {
      ...defaultConfig,
      global: {
        ...defaultConfig.global,
        starting_principle: new Decimal(1), // £1 starting
        monthly_contribution: new Decimal(0) // No monthly contribution
      },
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0) // 0% annual returns
      },
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0.12) // 12% annual fee (1% monthly)
        }
      ]
    };
    
    // Case 2: Same small starting principle (£1), large monthly contribution (£1000), 12% annual fee
    const configSmallLargeContribution: InvestmentConfig = {
      ...defaultConfig,
      global: {
        ...defaultConfig.global,
        starting_principle: new Decimal(1), // £1 starting
        monthly_contribution: new Decimal(1000) // £1000 monthly contribution
      },
      returns: {
        ...defaultConfig.returns,
        value: new Decimal(0) // 0% annual returns
      },
      fees: [
        {
          ...defaultConfig.fees[0],
          value: new Decimal(0.12) // 12% annual fee (1% monthly)
        }
      ]
    };
    
    const resultNoContribution = calculateInvestment(configSmallNoContribution);
    const resultWithContribution = calculateInvestment(configSmallLargeContribution);
    
    // Check final total net returns (month 12)
    const finalNetReturnNoContribution = parseFloat(resultNoContribution[12].totalNetReturnRate.toString());
    const finalNetReturnWithContribution = parseFloat(resultWithContribution[12].totalNetReturnRate.toString());
    
    // Without contributions, we expect approximately -11.36% total net return
    // (This is because fees reduce the principle by approximately 1% each month)
    expect(finalNetReturnNoContribution).toBeCloseTo(-11.36, 1);
    
    // With large contributions, we expect approximately -6.27% total net return
    expect(finalNetReturnWithContribution).toBeCloseTo(-6.27, 1);
    
    // Verify the exact values for more precise comparison
    expect(toFixedDecimal(resultNoContribution[12].totalNetReturnRate.toString(), 4)).toBe('-11.3615');
    expect(toFixedDecimal(resultWithContribution[12].totalNetReturnRate.toString(), 4)).toBe('-6.2679');
    
    // Verify the final principles for both cases
    // No contribution: starting £1 should end up around £0.89 (due to 12 months of 1% fee)
    expect(toFixedDecimal(resultNoContribution[12].endingPrinciple.toString(), 4)).toBe('0.8864');
    
    // With contribution: cumulative contributions of £12,001 (£1 + 12*£1000)
    // but ending principle is less due to fees
    expect(resultWithContribution[12].cumulativeContributions.toString()).toBe('12001');
    expect(parseFloat(resultWithContribution[12].endingPrinciple.toString())).toBeLessThan(12001);
  });

  it('should calculate different return metrics correctly for different contribution scenarios', () => {
    // Create two test configurations with identical parameters except for contributions
    // We'll use these to compare how the different return metrics behave

    // Config 1: No monthly contributions
    const noContribConfig: InvestmentConfig = {
      global: {
        starting_principle: new Decimal(10000),
        monthly_contribution: new Decimal(0),
        start_date: new Date('2023-01-01'),
        end_date: new Date('2024-01-01'),
        time_unit: 'month',
        quote_currency: 'GBP',
        num_months: 12
      },
      returns: {
        type: 'percentage',
        value: new Decimal(0), // 0% annual return
        applied_time_unit: new Decimal(12),
        quote_time_unit: 'year'
      },
      fees: [
        {
          name: 'management',
          description: 'Management fee',
          type: 'percentage',
          value: new Decimal(0.12), // 12% annual fee (high fee for clear differences)
          applied_time_unit: new Decimal(12),
          quote_time_unit: 'year'
        }
      ]
    };

    // Config 2: With monthly contributions
    const withContribConfig: InvestmentConfig = {
      global: {
        starting_principle: new Decimal(10000),
        monthly_contribution: new Decimal(1000),
        start_date: new Date('2023-01-01'),
        end_date: new Date('2024-01-01'),
        time_unit: 'month',
        quote_currency: 'GBP',
        num_months: 12
      },
      returns: {
        type: 'percentage',
        value: new Decimal(0), // 0% annual return
        applied_time_unit: new Decimal(12),
        quote_time_unit: 'year'
      },
      fees: [
        {
          name: 'management',
          description: 'Management fee',
          type: 'percentage',
          value: new Decimal(0.12), // 12% annual fee (high fee for clear differences)
          applied_time_unit: new Decimal(12),
          quote_time_unit: 'year'
        }
      ]
    };

    // Calculate both scenarios
    const noContribResult = calculateInvestment(noContribConfig)[12];  // Get month 12
    const withContribResult = calculateInvestment(withContribConfig)[12];  // Get month 12

    // Now compare the different return metrics
    
    // 1. Total Net Return Rate
    // - Should be around -11.36% for no contributions (pure effect of fees on initial investment)
    // - Should be better (less negative) with contributions as they dilute the fee effect
    expect(toFixedDecimal(noContribResult.totalNetReturnRate.toString(), 4)).toBe('-11.3615');
    expect(parseFloat(withContribResult.totalNetReturnRate.toString())).toBeGreaterThan(
      parseFloat(noContribResult.totalNetReturnRate.toString())
    );
    expect(toFixedDecimal(withContribResult.totalNetReturnRate.toString(), 4)).toBe('-8.5830');
    
    // For Money-Weighted Return (MWRR)
    // - For no contribution: May be slightly different from total net return
    // - For contribution: Should account for timing and size of contributions
    // The values may be different due to the different calculation methods
    const mwrrNoContrib = parseFloat(noContribResult.moneyWeightedReturn.toString());
    const netReturnNoContrib = parseFloat(noContribResult.totalNetReturnRate.toString());
    // Verify both return rates are negative
    expect(mwrrNoContrib).toBeLessThan(0);
    expect(netReturnNoContrib).toBeLessThan(0);
    
    // Money-weighted return for contribution scenario should be different from total net return
    // because it accounts for the timing of cash flows
    const mwrr = parseFloat(withContribResult.moneyWeightedReturn.toString());
    const totalNetReturn = parseFloat(withContribResult.totalNetReturnRate.toString());
    
    // The exact value will depend on implementation, but let's verify it's within a reasonable range
    expect(mwrr).not.toBeCloseTo(totalNetReturn, 0);
  });

  it('should verify all return metrics for starting principle 1, contribution 1000, fee 12%', () => {
    // Test case with very small initial investment and large monthly contributions
    // This helps test the edge cases for return rate calculations
    const config: InvestmentConfig = {
      global: {
        starting_principle: new Decimal(1),
        monthly_contribution: new Decimal(1000),
        start_date: new Date('2023-01-01'),
        end_date: new Date('2024-01-01'),
        time_unit: 'month',
        quote_currency: 'GBP',
        num_months: 12
      },
      returns: {
        type: 'percentage',
        value: new Decimal(0), // 0% annual return
        applied_time_unit: new Decimal(12),
        quote_time_unit: 'year'
      },
      fees: [
        {
          name: 'management',
          description: 'Management fee',
          type: 'percentage',
          value: new Decimal(0.12), // 12% annual fee
          applied_time_unit: new Decimal(12),
          quote_time_unit: 'year'
        }
      ]
    };

    const result = calculateInvestment(config);
    const month12 = result[12];
    
    // Output metrics for debugging
    console.log('Month 12 Return Metrics:');
    console.log('Starting Principle: £' + toFixedDecimal(config.global.starting_principle.toString(), 2));
    console.log('Monthly Contribution: £' + toFixedDecimal(config.global.monthly_contribution.toString(), 2));
    console.log('Ending Principle: £' + toFixedDecimal(month12.endingPrinciple.toString(), 2));
    console.log('Cumulative Contributions: £' + toFixedDecimal(month12.cumulativeContributions.toString(), 2));
    console.log('-----------------------------------------');
    console.log('Total Net Return Rate: ' + toFixedDecimal(month12.totalNetReturnRate.toString(), 4) + '%');
    console.log('Money-Weighted Return: ' + toFixedDecimal(month12.moneyWeightedReturn.toString(), 4) + '%');
    
    // Verify Cumulative Contributions = Starting Principle + (12 * Monthly Contribution)
    expect(month12.cumulativeContributions.toString()).toBe('12001');
    
    // Total Net Return Rate = (Ending Principle / Cumulative Contributions) - 1
    // This should be around -6.27% as contributions reduce the percentage impact of fees
    expect(toFixedDecimal(month12.totalNetReturnRate.toString(), 4)).toBe('-6.2679');
    
    // Money-Weighted Return = Measures IRR
    // With our implementation, the MWRR will be different from the Total Net Return
    expect(parseFloat(month12.moneyWeightedReturn.toString()))
      .not.toEqual(parseFloat(month12.totalNetReturnRate.toString()));
    
    // Verify that all return rates are negative (because of fees with 0% returns)
    expect(parseFloat(month12.totalNetReturnRate.toString())).toBeLessThan(0);
    expect(parseFloat(month12.moneyWeightedReturn.toString())).toBeLessThan(0);
  });
}); 