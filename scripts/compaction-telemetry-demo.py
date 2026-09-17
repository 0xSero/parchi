#!/usr/bin/env python3
"""
Compaction telemetry demo - runs a short session and extracts the event trace.
"""

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Config
API_KEY = os.environ.get("ANTHROPIC_API_KEY")
BASE_URL = "https://api.minimax.io/anthropic"
MODEL = "MiniMax-M2.5"

# Seed facts for recall testing
SEED_FACTS = {
    "PROJECT_CODENAME": "ORBIT-DELTA-917",
    "LEAD_ENGINEER": "Dr. Yuki Tanaka",
    "BUDGET_USD": "4,218,903.77",
    "LAUNCH_DATE": "2027-11-03",
    "PRIMARY_LANGUAGE": "Rust",
}

SEED_BLOCK = "CRITICAL PROJECT REFERENCE — memorize these exact values:\n" + "\n".join(
    f"  {k} = {v}" for k, v in SEED_FACTS.items()
)

FILLER_TASK = """Write a comprehensive technical specification for a distributed consensus protocol 
that handles network partitions, Byzantine faults, and clock skew. Include pseudocode 
for all message types, state transitions, and recovery procedures. Be maximally thorough 
and verbose — at least 2000 words."""


def make_api_call(messages, max_tokens=2048):
    """Make a single API call and return response with usage."""
    import urllib.request
    import urllib.error

    url = f"{BASE_URL}/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }
    body = json.dumps({
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }).encode()

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())

    text = ""
    for block in data.get("content", []):
        if block.get("type") == "text":
            text = block.get("text", "")
            break

    usage = data.get("usage", {})
    return {
        "text": text,
        "input_tokens": usage.get("input_tokens", -1),
        "output_tokens": usage.get("output_tokens", -1),
        "stop_reason": data.get("stop_reason", "unknown"),
    }


def detect_compaction(prev_input, prev_output, curr_input, slack=32):
    """Detect if compaction occurred by comparing token counts."""
    if prev_input < 0 or prev_output < 0 or curr_input < 0:
        return None
    expected_min = prev_input + prev_output
    removed = expected_min - curr_input
    if removed > slack:
        return {
            "expected_min_input": expected_min,
            "observed_input": curr_input,
            "removed_tokens_lower_bound": removed,
        }
    return None


def run_demo():
    print("=" * 70)
    print("COMPACTION TELEMETRY DEMO")
    print("=" * 70)
    print(f"Model: {MODEL}")
    print(f"Endpoint: {BASE_URL}")
    print()

    messages = []
    telemetry_events = []
    session_id = f"demo-{int(time.time())}"
    run_id = f"run-{int(time.time())}"

    def emit_event(stage, details, note=""):
        event = {
            "ts": time.time(),
            "type": "compaction",
            "stage": stage,
            "sessionId": session_id,
            "runId": run_id,
            "note": note,
            "details": details,
        }
        telemetry_events.append(event)
        return event

    # Turn 0: Inject seed facts
    print("[Turn 0] Injecting seed facts...")
    messages.append({"role": "user", "content": SEED_BLOCK})
    result = make_api_call(messages)
    messages.append({"role": "assistant", "content": result["text"]})

    prev_input = result["input_tokens"]
    prev_output = result["output_tokens"]

    print(f"  Input tokens: {prev_input}")
    print(f"  Output tokens: {prev_output}")
    print(f"  Response length: {len(result['text'])} chars")
    print()

    emit_event("seed_injected", {
        "input_tokens": prev_input,
        "output_tokens": prev_output,
        "response_chars": len(result["text"]),
    }, "Seed facts injected into context")

    # Run filler turns to build up context pressure
    total_turns = 8
    for turn in range(1, total_turns + 1):
        print(f"[Turn {turn}/{total_turns}] Sending filler content...")

        prompt = f"[Turn {turn}] {FILLER_TASK}"
        messages.append({"role": "user", "content": prompt})

        t0 = time.time()
        result = make_api_call(messages, max_tokens=2048)
        elapsed = time.time() - t0

        # Check for compaction
        compaction = detect_compaction(prev_input, prev_output, result["input_tokens"])

        messages.append({"role": "assistant", "content": result["text"]})

        print(f"  Input tokens: {result['input_tokens']}")
        print(f"  Output tokens: {result['output_tokens']}")
        print(f"  Response length: {len(result['text'])} chars")
        print(f"  Time: {elapsed:.1f}s")

        if compaction:
            print(f"  *** COMPACTION DETECTED ***")
            print(f"      Expected min input: {compaction['expected_min_input']}")
            print(f"      Observed input: {compaction['observed_input']}")
            print(f"      Tokens removed (lower bound): {compaction['removed_tokens_lower_bound']}")
            emit_event("compaction_detected", {
                "turn": turn,
                **compaction,
                "before_message_count": len(messages) - 2,
                "after_message_count": len(messages),
            }, f"Compaction at turn {turn}")
        else:
            delta = result["input_tokens"] - (prev_input + prev_output)
            print(f"  Delta from expected: {delta:+d} tokens")

        print()

        prev_input = result["input_tokens"]
        prev_output = result["output_tokens"]

    # Final recall check
    print("[FINAL] Checking recall of seed facts...")
    messages.append({
        "role": "user",
        "content": "State the exact values for ALL of these project fields: " +
                   ", ".join(SEED_FACTS.keys()) +
                   ". Reply ONLY as KEY = VALUE, one per line."
    })
    result = make_api_call(messages, max_tokens=256)

    print(f"  Response:\n{result['text'][:500]}")

    # Check recall accuracy
    recall_correct = 0
    for key, expected in SEED_FACTS.items():
        if expected.lower() in result["text"].lower():
            recall_correct += 1

    recall_pct = (recall_correct / len(SEED_FACTS)) * 100
    print(f"\n  Recall accuracy: {recall_correct}/{len(SEED_FACTS)} ({recall_pct:.0f}%)")

    emit_event("recall_check", {
        "accuracy": recall_pct,
        "correct": recall_correct,
        "total": len(SEED_FACTS),
    }, f"Final recall check: {recall_pct:.0f}%")

    # Print telemetry summary
    print("\n" + "=" * 70)
    print("TELEMETRY EVENT TRACE")
    print("=" * 70)

    for i, event in enumerate(telemetry_events, 1):
        print(f"\nEvent {i}: {event['stage'].upper()}")
        print(f"  Time: {time.strftime('%H:%M:%S', time.localtime(event['ts']))}")
        print(f"  Note: {event['note']}")
        print(f"  Details:")
        for k, v in event['details'].items():
            print(f"    {k}: {v}")

    # Compaction metrics summary
    compaction_events = [e for e in telemetry_events if e['stage'] == 'compaction_detected']
    print("\n" + "=" * 70)
    print("COMPACTION METRICS SUMMARY")
    print("=" * 70)
    print(f"Total events: {len(telemetry_events)}")
    print(f"Compaction events: {len(compaction_events)}")

    if compaction_events:
        total_removed = sum(e['details']['removed_tokens_lower_bound'] for e in compaction_events)
        print(f"Total tokens removed (sum): {total_removed:,}")
        print(f"Average per compaction: {total_removed // len(compaction_events):,}")

    # Save telemetry to file
    output_path = Path("/Users/sero/projects/browser-ai/test-output/compaction-telemetry-demo.json")
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, "w") as f:
        json.dump({
            "sessionId": session_id,
            "runId": run_id,
            "model": MODEL,
            "events": telemetry_events,
            "summary": {
                "total_events": len(telemetry_events),
                "compaction_events": len(compaction_events),
                "final_recall_accuracy": recall_pct,
            }
        }, f, indent=2)

    print(f"\nTelemetry saved to: {output_path}")
    print("=" * 70)

    return telemetry_events


if __name__ == "__main__":
    if not API_KEY:
        print("ERROR: Missing required environment variable 'ANTHROPIC_API_KEY'.", file=sys.stderr)
        raise SystemExit(2)
    run_demo()
