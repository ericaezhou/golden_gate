"""
Credit Loss Forecast Model
Author: Alice Chen
"""

# Model settings
LOOKBACK_QUARTERS = 4  # Policy says 12, but Alice uses 4

def calculate_loss_rate(segment):
    """Calculate loss rate for a segment."""
    # Baseline calculation
    base_rate = get_historical_average(segment)

    # Apply overlay if needed
    # See Alice for overlay criteria
    overlay = 0  # Alice adds this manually

    return base_rate + overlay

def get_historical_average(segment):
    """Get average from database."""
    # Connects to portfolio_risk.db
    return 0.05  # Placeholder

# Segment thresholds
THRESHOLDS = {
    "prime": 0.03,
    "near_prime": 0.07,
    "subprime": None,  # Ask Alice
    "deep_subprime": None,  # Ask Alice
}

# Escalation rules
# Under $2M: just document
# $2M-$5M: Risk committee
# Over $5M: CFO approval
# Over ???: Board notification (ask Alice for amount)