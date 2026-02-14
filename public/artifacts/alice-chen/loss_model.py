"""
Credit Loss Forecasting Model
Author: Alice Chen
Last Updated: 2024-09-15

This module calculates quarterly credit loss forecasts for different
customer segments based on historical data and macroeconomic factors.
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Optional

# Segment definitions
SEGMENTS = ['prime', 'near_prime', 'subprime', 'deep_subprime']

# Historical loss rates (updated quarterly)
HISTORICAL_LOSS_RATES = {
    'prime': 0.023,
    'near_prime': 0.051,
    'subprime': 0.124,
    'deep_subprime': 0.221
}


def get_historical_loss_rate(segment: str) -> float:
    """Get the baseline historical loss rate for a segment."""
    if segment not in HISTORICAL_LOSS_RATES:
        raise ValueError(f"Unknown segment: {segment}")
    return HISTORICAL_LOSS_RATES[segment]


def apply_macro_factors(segment_data: Dict, macro_indicators: Optional[Dict] = None) -> float:
    """
    Apply macroeconomic adjustment factors to the base rate.

    Factors considered:
    - Unemployment rate changes
    - Fed interest rate changes
    - Consumer sentiment index
    """
    if macro_indicators is None:
        return 1.0

    adjustment = 1.0

    # Unemployment impact
    if 'unemployment_delta' in macro_indicators:
        # Each 0.5% increase in unemployment adds ~5% to loss rate
        adjustment += macro_indicators['unemployment_delta'] * 0.1

    # Interest rate impact
    if 'fed_rate_delta' in macro_indicators:
        # Rate increases pressure borrowers
        adjustment += macro_indicators['fed_rate_delta'] * 0.05

    return adjustment


def calculate_loss_forecast(segment_data: Dict) -> float:
    """Calculate quarterly loss forecast."""
    base_rate = get_historical_loss_rate(segment_data['segment'])
    macro_adj = apply_macro_factors(segment_data)

    # TODO: Manual overlay logic not implemented
    # Analyst applies judgment adjustments manually
    # See Alice for the specific criteria used

    return base_rate * macro_adj


def generate_quarterly_forecast(portfolio_data: pd.DataFrame) -> pd.DataFrame:
    """
    Generate loss forecast for entire portfolio.

    Args:
        portfolio_data: DataFrame with segment allocations

    Returns:
        DataFrame with forecasted losses by segment
    """
    results = []

    for segment in SEGMENTS:
        segment_data = {
            'segment': segment,
            'exposure': portfolio_data[portfolio_data['segment'] == segment]['exposure'].sum()
        }

        loss_rate = calculate_loss_forecast(segment_data)

        results.append({
            'segment': segment,
            'exposure': segment_data['exposure'],
            'model_loss_rate': loss_rate,
            'adjustment': 0,  # Filled in manually by analyst
            'final_loss_rate': loss_rate  # Updated after adjustment
        })

    return pd.DataFrame(results)


def validate_forecast(forecast_df: pd.DataFrame) -> bool:
    """
    Validate forecast before submission.

    Checks:
    - All segments present
    - Loss rates within reasonable bounds
    - Adjustments documented (somehow?)
    """
    # Check all segments present
    if set(forecast_df['segment']) != set(SEGMENTS):
        return False

    # Check loss rates are reasonable
    for _, row in forecast_df.iterrows():
        if row['final_loss_rate'] < 0 or row['final_loss_rate'] > 0.5:
            return False

    # TODO: Check that adjustments are documented
    # Currently no way to enforce this

    return True


if __name__ == "__main__":
    # Example usage
    sample_portfolio = pd.DataFrame({
        'segment': ['prime', 'near_prime', 'subprime', 'deep_subprime'],
        'exposure': [1000000, 500000, 200000, 50000]
    })

    forecast = generate_quarterly_forecast(sample_portfolio)
    print(forecast)
