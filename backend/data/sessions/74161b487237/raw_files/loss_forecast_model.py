"""
Credit Loss Forecasting Model — Q3 2024
Author: Alice Chen, Risk Analyst
Last Updated: 2024-09-15

Calculates quarterly credit loss forecasts using historical defaults
and macroeconomic adjustments.

References:
    - Data source: portfolio_risk.db
    - SQL queries: risk_queries.sql
    - Policy doc:  model_methodology.docx
    - Output:      Q3_2024_forecast.xlsx
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Optional, Tuple

# --- Configuration ---
DB_PATH = "portfolio_risk.db"
FORECAST_OUTPUT = "Q3_2024_forecast.xlsx"

# TODO: Policy (model_methodology.docx) specifies 12 quarters.
#       Using 4 here because Alice says the difference is < 0.3%
#       when macro conditions are stable.
LOOKBACK_QUARTERS = 4

# Segment definitions
SEGMENTS = ["prime", "near_prime", "subprime", "deep_subprime"]

# Macro overlay multiplier — applied when GDP drops below trigger
# See policy_snapshot table in portfolio_risk.db for approved value
MACRO_OVERLAY_MULTIPLIER = None  # TODO: Ask Alice — she applies this manually

# Escalation thresholds (dollar impact)
ESCALATION_THRESHOLDS = {
    "routine": 0,               # Analyst sign-off only
    "risk_committee": 2_000_000, # Weekly sync review
    "cfo_approval": 5_000_000,   # CFO email approval (3-5 day lead time)
    "board_notification": None,  # Verbal guidance from CFO (~$10M) — not in any policy
}

# Segment-level loss thresholds for triggering an overlay
SEGMENT_LOSS_THRESHOLDS = {
    "prime": 0.03,
    "near_prime": 0.07,
    "subprime": None,        # Alice adjusts this quarterly — no fixed value
    "deep_subprime": None,   # Not defined; Alice decides at runtime
}


def load_historical_defaults(db_path: str = DB_PATH) -> pd.DataFrame:
    """Load historical default rates from portfolio_risk.db."""
    conn = sqlite3.connect(db_path)
    df = pd.read_sql("SELECT * FROM historical_defaults ORDER BY quarter DESC", conn)
    conn.close()
    return df


def compute_baseline_rate(
    defaults_df: pd.DataFrame,
    n_quarters: int = LOOKBACK_QUARTERS,
) -> float:
    """Compute rolling average default rate.

    NOTE: Policy specifies 12-quarter window (see risk_queries.sql query A).
    We use 4-quarter here for speed. Alice says it's fine when GDP > 1.5%.
    """
    recent = defaults_df.head(n_quarters)
    return recent["default_rate"].mean()


def apply_macro_overlay(
    base_rate: float,
    macro_data: Optional[Dict] = None,
) -> Tuple[float, float]:
    """Apply macroeconomic adjustment to base rate.

    Returns (adjusted_rate, overlay_amount).

    WARNING: The overlay sizing logic below is a rough sketch.
    The actual criteria Alice uses are NOT fully captured here.
    """
    if macro_data is None:
        return base_rate, 0.0

    overlay = 0.0

    # TODO: Manual overlay criteria not documented.
    #       Alice applies +1% to +5% based on her judgment.
    #       Rough heuristic from her notes:
    #         - 10% delinquency increase → +1% overlay
    #         - Cap at 5% per segment
    #       But she also considers cohort variance, new product buffers,
    #       and "gut feel" from 4 years of experience.
    # FIXME: This logic MUST be formalized before Alice leaves.

    if macro_data.get("gdp_growth", 0) < 1.5:
        overlay += 0.02  # Recession buffer
    if macro_data.get("unemployment_delta", 0) > 0.5:
        overlay += macro_data["unemployment_delta"] * 0.01

    return base_rate + overlay, overlay


def should_escalate(impact_amount: float) -> str:
    """Determine escalation level based on dollar impact.

    Returns one of: 'routine', 'risk_committee', 'cfo', 'board'.

    NOTE: Board notification threshold was never formally approved.
    Alice operates on verbal ~$10M guidance from CFO.
    """
    # TODO: Board threshold is undefined — Alice handles this case manually
    if impact_amount >= 10_000_000:
        return "board"  # Alice's verbal rule, not in policy
    for level in ["cfo_approval", "risk_committee", "routine"]:
        threshold = ESCALATION_THRESHOLDS.get(level, 0) or 0
        if impact_amount >= threshold:
            return level.replace("_approval", "")
    return "routine"


def generate_forecast(db_path: str = DB_PATH) -> pd.DataFrame:
    """Generate full quarterly forecast.

    Output is saved to Q3_2024_forecast.xlsx after manual overlay review.
    """
    defaults_df = load_historical_defaults(db_path)
    baseline = compute_baseline_rate(defaults_df)

    results = []
    for segment in SEGMENTS:
        threshold = SEGMENT_LOSS_THRESHOLDS.get(segment)
        results.append({
            "segment": segment,
            "baseline_rate": round(baseline, 4),
            "macro_overlay": 0.0,        # Filled in manually by Alice
            "final_rate": round(baseline, 4),  # Updated after overlay
            "threshold": threshold,       # May be None — that's a problem
            "rationale": "",              # Alice fills this in (but rarely does)
        })

    return pd.DataFrame(results)


if __name__ == "__main__":
    forecast = generate_forecast()
    forecast.to_excel(FORECAST_OUTPUT, index=False)
    print(forecast)
