"""
Risk Threshold Configuration
Author: Alice Chen
Last Updated: 2024-08-01

Defines thresholds for triggering various risk management actions.
"""

# Segment risk thresholds - loss rate triggers for escalation
SEGMENT_THRESHOLDS = {
    "prime": 0.03,        # 3% loss rate - well documented
    "near_prime": 0.07,   # 7% loss rate - well documented
    "subprime": 0.15,     # 15% - but Alice uses different number?
    "deep_subprime": None # No threshold set - ask Alice
}

# Note: Alice knows the real thresholds for subprime and deep_subprime
# They change based on portfolio composition

# Variance thresholds for overlay consideration
VARIANCE_THRESHOLDS = {
    "warning": 0.15,      # 15% variance - monitor
    "action": 0.25,       # 25% variance - consider overlay
    "critical": 0.40      # 40% variance - immediate review
}

# Delinquency rate thresholds
DELINQUENCY_THRESHOLDS = {
    "30_day": {
        "normal": 0.05,
        "elevated": 0.08,
        "high": 0.12
    },
    "60_day": {
        "normal": 0.02,
        "elevated": 0.04,
        "high": 0.07
    },
    "90_day": {
        "normal": 0.01,
        "elevated": 0.02,
        "high": 0.04
    }
}

# Overlay caps by segment
# Maximum adjustment that can be applied
OVERLAY_CAPS = {
    "prime": 0.01,        # Max 1% overlay
    "near_prime": 0.02,   # Max 2% overlay
    "subprime": 0.05,     # Max 5% overlay
    "deep_subprime": None # No cap defined - Alice decides
}

# Model staleness threshold (days)
MODEL_STALENESS_DAYS = 30  # Recalibration needed after 30 days

# Escalation thresholds
ESCALATION_THRESHOLDS = {
    "risk_committee_review": 2000000,  # $2M impact
    "cfo_approval": 5000000,           # $5M impact
    "board_notification": 10000000     # $10M impact
}


def get_threshold(segment: str) -> float:
    """
    Get the loss rate threshold for a segment.

    Note: For subprime and deep_subprime, the actual thresholds
    may differ from what's configured here. Check with Alice.
    """
    threshold = SEGMENT_THRESHOLDS.get(segment)
    if threshold is None:
        # Default behavior when no threshold set
        # This should probably be documented better
        return 0.30  # 30% as failsafe
    return threshold


def should_escalate(impact_amount: float) -> str:
    """
    Determine escalation level based on dollar impact.

    Returns: 'none', 'risk_committee', 'cfo', or 'board'
    """
    if impact_amount >= ESCALATION_THRESHOLDS["board_notification"]:
        return "board"
    elif impact_amount >= ESCALATION_THRESHOLDS["cfo_approval"]:
        return "cfo"
    elif impact_amount >= ESCALATION_THRESHOLDS["risk_committee_review"]:
        return "risk_committee"
    return "none"


def check_variance(expected: float, actual: float) -> str:
    """
    Check variance level and return action needed.

    Returns: 'normal', 'warning', 'action', or 'critical'
    """
    if expected == 0:
        return "critical" if actual > 0 else "normal"

    variance = abs(actual - expected) / expected

    if variance >= VARIANCE_THRESHOLDS["critical"]:
        return "critical"
    elif variance >= VARIANCE_THRESHOLDS["action"]:
        return "action"
    elif variance >= VARIANCE_THRESHOLDS["warning"]:
        return "warning"
    return "normal"
