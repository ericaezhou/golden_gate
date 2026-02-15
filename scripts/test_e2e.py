#!/usr/bin/env python3
"""End-to-end test script for the Golden Gate pipeline.

Usage:
    # Start the server first:
    uv run serve

    # Then in another terminal:
    uv run python scripts/test_e2e.py

    # Or with a specific file:
    uv run python scripts/test_e2e.py --files data/run_notes.txt data/loss_forecast_model.py

    # Skip interview (auto-end):
    uv run python scripts/test_e2e.py --skip-interview

    # Give N interview answers then skip:
    uv run python scripts/test_e2e.py --max-rounds 3

Requires: the server running at http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

BASE_URL = "http://localhost:8000"
DEFAULT_FILES = [
    "data/run_notes.txt",
    "data/loss_forecast_model.py",
]

# Sample answers for the interview (auto-mode)
SAMPLE_ANSWERS = [
    "The loss threshold of 0.3 was calibrated against Q4 2019 actuals. We use the 4-quarter shortcut when GDP is above 1.5% and there are no major Fed rate changes. The 12-quarter method from the methodology doc is more conservative but takes longer to run.",
    "Marcus Park is the backup. He knows the model architecture but hasn't done the overlay process end-to-end. The escalation thresholds are: routine under $2M, risk committee for $2-5M, and CFO for anything over $5M. The board threshold is still verbal at roughly $10M.",
    "The overlay sizing follows roughly 1% per 10% DQ increase, capped at 5%. New products under 6 months always get a 20% buffer. I've been tracking in column F of the forecast spreadsheet but I'll be honest, I haven't been great about documenting every decision there.",
    "The stress testing notebook needs to be updated to use the 12-quarter baseline. Right now it's using the shortcut method which isn't technically policy-approved. The model methodology doc says 12q is required but no one has flagged this in 2+ years.",
    "Finance team cares most about the board presentation. David reviews it before it goes out. The risk queries SQL file has both methods — the 12q policy-approved one and the 4q shortcut I actually use. Key gotcha: the cohort variance calculation can look wrong if you don't exclude the first 90 days of new originations.",
]


def print_step(msg: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def print_json(data: dict) -> None:
    print(json.dumps(data, indent=2, default=str)[:2000])


def check_health(client: httpx.Client) -> None:
    """Verify the server is running."""
    try:
        r = client.get(f"{BASE_URL}/api/health")
        r.raise_for_status()
        print(f"Server health: {r.json()}")
    except httpx.ConnectError:
        print("ERROR: Server not running. Start it with: uv run serve")
        sys.exit(1)


def start_offboarding(
    client: httpx.Client,
    project_name: str,
    file_paths: list[str],
) -> str:
    """Upload files and start the offboarding pipeline."""
    print_step("Step 1: Starting offboarding pipeline")

    files = []
    for fp in file_paths:
        path = Path(fp)
        if not path.exists():
            print(f"WARNING: File not found: {fp}, skipping")
            continue
        files.append(("files", (path.name, path.read_bytes())))
        print(f"  Uploading: {path.name} ({path.stat().st_size} bytes)")

    if not files:
        print("ERROR: No valid files to upload")
        sys.exit(1)

    r = client.post(
        f"{BASE_URL}/api/offboarding/start",
        data={"project_name": project_name, "role": "Risk Analyst", "timeline": "2 weeks"},
        files=files,
    )
    r.raise_for_status()
    data = r.json()
    session_id = data["session_id"]
    print(f"  Session created: {session_id}")
    return session_id


def wait_for_pipeline(client: httpx.Client, session_id: str) -> dict | None:
    """Poll the pipeline status until it reaches interview_ready or completes.

    Uses simple status polling instead of SSE for maximum compatibility.
    """
    print_step("Step 2: Waiting for analysis pipeline...")

    prev_status = None
    poll_count = 0
    max_polls = 300  # 10 minutes at 2s intervals
    start_time = time.time()

    while poll_count < max_polls:
        time.sleep(2)
        poll_count += 1

        r = client.get(f"{BASE_URL}/api/offboarding/{session_id}/status")
        r.raise_for_status()
        data = r.json()
        status = data.get("status", "unknown")
        step = data.get("current_step", "unknown")

        elapsed = int(time.time() - start_time)

        # Print status changes
        current = f"{status}/{step}"
        if current != prev_status:
            print(f"  [{elapsed:3d}s] status={status}  step={step}")
            prev_status = current
        elif poll_count % 15 == 0:
            # Print a heartbeat every ~30s even if no change
            print(f"  [{elapsed:3d}s] still at status={status}  step={step}  (waiting...)")

        if status == "interview_ready":
            # Check interview status for the question
            ir = client.get(f"{BASE_URL}/api/interview/{session_id}/status")
            ir.raise_for_status()
            interview_data = ir.json()
            print(f"  >>> Interview ready!")
            return {"interview_ready": True, "interview": interview_data}

        elif status == "complete":
            print(f"  Pipeline complete!")
            return {"complete": True}

        elif status == "error":
            error_msg = data.get("error", "Unknown error")
            print(f"  ERROR: {error_msg}")
            # Try to read the graph_state for more detail
            store_r = client.get(f"{BASE_URL}/api/session/{session_id}/artifacts")
            if store_r.status_code == 200:
                print(f"  Artifacts so far: {json.dumps(store_r.json(), indent=2)[:500]}")
            sys.exit(1)

    print(f"  TIMEOUT: Pipeline didn't complete in {max_polls * 2}s")
    sys.exit(1)


def run_interview(
    client: httpx.Client,
    session_id: str,
    skip: bool = False,
    max_rounds: int = 5,
) -> None:
    """Run the interactive interview loop."""
    print_step("Step 3: Interview")

    if skip:
        print("  Skipping interview (--skip-interview)")
        r = client.post(f"{BASE_URL}/api/interview/{session_id}/end")
        r.raise_for_status()
        print_json(r.json())
        return

    # Wait for interview to become active (pipeline might still be transitioning)
    question = None
    for attempt in range(15):
        r = client.get(f"{BASE_URL}/api/interview/{session_id}/status")
        r.raise_for_status()
        status = r.json()
        if status.get("interview_active"):
            question = status.get("question", {})
            break
        msg = status.get("message", "")
        if attempt == 0:
            print(f"  Waiting for interview to start... ({msg})")
        time.sleep(2)

    if question is None:
        print("  No active interview. Pipeline may have completed without one.")
        return
    round_num = 0

    while round_num < max_rounds:
        q_text = question.get("question_text", "(no question)")
        q_round = question.get("round", round_num + 1)
        q_remaining = question.get("remaining", "?")

        print(f"\n  --- Round {q_round} ({q_remaining} questions remaining) ---")
        print(f"  Q: {q_text}")

        # Use sample answer or prompt user
        if round_num < len(SAMPLE_ANSWERS):
            answer = SAMPLE_ANSWERS[round_num]
            print(f"  A (auto): {answer[:100]}...")
        else:
            answer = input("  Your answer (or 'end' to stop): ").strip()
            if answer.lower() == "end":
                r = client.post(f"{BASE_URL}/api/interview/{session_id}/end")
                r.raise_for_status()
                print("  Interview ended by user.")
                return

        r = client.post(
            f"{BASE_URL}/api/interview/{session_id}/respond",
            json={"user_response": answer},
            timeout=120.0,
        )
        r.raise_for_status()
        result = r.json()

        facts = result.get("facts_extracted", [])
        if facts:
            print(f"  Facts extracted: {len(facts)}")
            for f in facts[:3]:
                print(f"    - {f[:80]}")

        if not result.get("interview_active"):
            print("\n  Interview complete!")
            print(f"  Message: {result.get('message', '')}")
            return

        question = result.get("question", {})
        round_num += 1

    # Hit max rounds — end the interview
    print(f"\n  Reached max rounds ({max_rounds}). Ending interview.")
    r = client.post(f"{BASE_URL}/api/interview/{session_id}/end")
    r.raise_for_status()
    print_json(r.json())


def check_artifacts(client: httpx.Client, session_id: str) -> None:
    """Check what artifacts were generated."""
    print_step("Step 4: Checking artifacts")
    r = client.get(f"{BASE_URL}/api/session/{session_id}/artifacts")
    r.raise_for_status()
    print_json(r.json())


def test_onboarding_narrative(client: httpx.Client, session_id: str) -> None:
    """Test the onboarding narrative endpoint."""
    print_step("Step 5: Onboarding narrative")
    r = client.get(
        f"{BASE_URL}/api/onboarding/{session_id}/narrative",
        timeout=120.0,
    )
    if r.status_code == 404:
        print(f"  Not available yet: {r.json().get('detail', '')}")
        return
    r.raise_for_status()
    data = r.json()
    narrative = data.get("narrative_md", "")
    print(f"  Cached: {data.get('cached', False)}")
    print(f"  Narrative ({len(narrative)} chars):")
    print(f"  {narrative[:500]}...")


def test_onboarding_qa(client: httpx.Client, session_id: str) -> None:
    """Test the QA endpoint with sample questions."""
    print_step("Step 6: Onboarding QA")

    questions = [
        "What is the loss threshold and where did it come from?",
        "Who should I contact if there's a risk escalation over $5M?",
        "What's the difference between the 4-quarter and 12-quarter methods?",
    ]

    for q in questions:
        print(f"\n  Q: {q}")
        r = client.post(
            f"{BASE_URL}/api/onboarding/{session_id}/ask",
            json={"question": q},
            timeout=60.0,
        )
        if r.status_code == 404:
            print(f"  Not available: {r.json().get('detail', '')}")
            return
        r.raise_for_status()
        data = r.json()
        answer = data.get("answer", "")
        print(f"  A: {answer[:300]}...")


def main():
    parser = argparse.ArgumentParser(description="Golden Gate E2E test")
    parser.add_argument(
        "--files", nargs="+", default=DEFAULT_FILES,
        help="File paths to upload (default: demo data)",
    )
    parser.add_argument(
        "--project-name", default="Risk Forecast Model",
        help="Project name",
    )
    parser.add_argument(
        "--skip-interview", action="store_true",
        help="Skip the interview phase",
    )
    parser.add_argument(
        "--max-rounds", type=int, default=3,
        help="Max interview rounds in auto mode (default: 3)",
    )
    parser.add_argument(
        "--session-id", default=None,
        help="Resume from an existing session (skip upload + analysis)",
    )
    args = parser.parse_args()

    client = httpx.Client(timeout=30.0)

    try:
        check_health(client)

        if args.session_id:
            session_id = args.session_id
            print(f"Resuming session: {session_id}")
        else:
            session_id = start_offboarding(client, args.project_name, args.files)
            result = wait_for_pipeline(client, session_id)
            if result and result.get("complete"):
                print("Pipeline completed without interview.")
            else:
                run_interview(
                    client, session_id,
                    skip=args.skip_interview,
                    max_rounds=args.max_rounds,
                )

        # Wait a moment for final artifacts to be written
        time.sleep(2)

        check_artifacts(client, session_id)
        test_onboarding_narrative(client, session_id)
        test_onboarding_qa(client, session_id)

        print_step("DONE")
        print(f"  Session ID: {session_id}")
        print(f"  Artifacts:  data/sessions/{session_id}/")
        print(f"  Status:     {BASE_URL}/api/offboarding/{session_id}/status")

    finally:
        client.close()


if __name__ == "__main__":
    main()
