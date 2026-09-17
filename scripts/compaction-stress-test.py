#!/usr/bin/env python3
"""
Autonomous autocompaction stress test.
Runs a single long multi-turn conversation against MiniMax M2.5 via Anthropic-compatible API.
Injects seed facts, then hammers the context window with filler turns,
periodically probing recall of the seed facts to detect compaction-induced loss.

Output: full transcript JSON + metrics summary.
"""

import json
import time
import datetime
import os
import sys
import urllib.request
import urllib.error

# ── Config ──────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("ANTHROPIC_API_KEY")
BASE_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.minimax.io/anthropic")
MODEL = os.environ.get("ANTHROPIC_MODEL", "MiniMax-M2.5")
MAX_TOKENS = 1024
TOTAL_TURNS = 120          # target turn count
PROBE_EVERY = 10           # recall probe interval
FILLER_WORDS = 600         # approx tokens per filler prompt

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "test-output")
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
TRANSCRIPT_PATH = os.path.join(OUT_DIR, f"compaction-stress-{TIMESTAMP}.json")
METRICS_PATH = os.path.join(OUT_DIR, f"compaction-stress-{TIMESTAMP}-metrics.md")

# ── Seed facts (ground truth) ──────────────────────────────────────────────
SEED_FACTS = {
    "PROJECT_CODENAME": "ORBIT-DELTA-917",
    "LEAD_ENGINEER": "Dr. Yuki Tanaka",
    "BUDGET_USD": "4,218,903.77",
    "LAUNCH_DATE": "2027-11-03",
    "PRIMARY_LANGUAGE": "Rust",
    "SATELLITE_COUNT": "14",
    "HQ_CITY": "Reykjavik",
    "ENCRYPTION_ALGO": "ChaCha20-Poly1305",
    "DATABASE_ENGINE": "TigerBeetle",
    "MASCOT_NAME": "Nimbus the Otter",
    "MAX_ALTITUDE_KM": "487.3",
    "RELAY_PROTOCOL": "QUIC-v2",
    "BACKUP_SITE": "Ushuaia",
    "PATCH_CADENCE": "every 13 days",
    "LEGAL_ENTITY": "Boreal Dynamics GmbH",
    "BOARD_CHAIR": "Ingrid Solberg",
    "FLEET_SIZE": "38 drones",
    "COMMS_FREQUENCY_GHZ": "28.7",
    "HEAT_SHIELD_MATERIAL": "Nextel 440",
    "FAILOVER_TIMEOUT_MS": "1750",
}

SEED_BLOCK = "IMPORTANT PROJECT REFERENCE — memorise every detail:\n" + "\n".join(
    f"  {k} = {v}" for k, v in SEED_FACTS.items()
)

# ── Filler generators ──────────────────────────────────────────────────────
FILLER_TASKS = [
    "Write a detailed technical design document for a distributed rate limiter that handles 10M req/s. Include diagrams described textually, failure modes, and capacity planning.",
    "Explain the complete history of the Byzantine Generals Problem and all known solutions with pseudocode for each variant.",
    "Generate a comprehensive comparison table of 20 different serialization formats (JSON, Protobuf, FlatBuffers, Cap'n Proto, MessagePack, CBOR, Avro, Thrift, ASN.1, BSON, Ion, FlexBuffers, Bond, SBE, Pickle, XML, YAML, TOML, EDN, Transit) covering performance, schema evolution, and language support.",
    "Write a long short story (at least 500 words) set in a cyberpunk underwater city. Include at least 5 named characters with distinct motivations.",
    "Describe step by step how to build a compiler frontend for a simple language: lexer, parser, AST, type checker. Provide code in Rust.",
    "Explain quantum error correction codes including surface codes, Steane codes, and Shor codes with mathematical notation.",
    "Write a thorough security audit report for a hypothetical REST API that handles financial transactions. Cover OWASP Top 10.",
    "Design a complete database schema for a hospital management system with at least 25 tables, all relationships, and example queries.",
    "Explain the Linux kernel networking stack from NIC driver to userspace socket, covering every layer in detail.",
    "Write a detailed comparison of Raft vs Paxos vs Viewstamped Replication vs Zab consensus protocols with pseudocode.",
]


def make_probe_prompt(turn_num: int) -> str:
    keys = list(SEED_FACTS.keys())
    subset = [keys[i % len(keys)] for i in range(turn_num, turn_num + 5)]
    items = ", ".join(subset)
    return (
        f"RECALL CHECK (turn {turn_num}): Without looking anything up, "
        f"state the exact values for these project fields: {items}. "
        "Reply in the format KEY = VALUE, one per line, nothing else."
    )


def make_filler_prompt(turn_num: int) -> str:
    task = FILLER_TASKS[turn_num % len(FILLER_TASKS)]
    return f"[Turn {turn_num}] {task} Be as thorough and verbose as possible."


# ── API call ───────────────────────────────────────────────────────────────
def call_api(messages: list, retries: int = 3) -> str:
    url = f"{BASE_URL}/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }
    body = json.dumps({
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "messages": messages,
    }).encode()

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode())
                if "content" in data and len(data["content"]) > 0:
                    for block in data["content"]:
                        if block.get("type") == "text":
                            return block.get("text", "")
                    return data["content"][0].get("text", "")
                return json.dumps(data)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode() if e.fp else ""
            print(f"  [HTTP {e.code}] attempt {attempt+1}/{retries}: {err_body[:200]}")
            if e.code == 429 or e.code >= 500:
                time.sleep(5 * (attempt + 1))
                continue
            raise
        except Exception as e:
            print(f"  [ERR] attempt {attempt+1}/{retries}: {e}")
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    return "[ERROR: all retries exhausted]"


# ── Recall scorer ──────────────────────────────────────────────────────────
def score_recall(response: str, turn_num: int) -> dict:
    keys = list(SEED_FACTS.keys())
    subset = [keys[i % len(keys)] for i in range(turn_num, turn_num + 5)]
    results = {}
    for key in subset:
        expected = SEED_FACTS[key]
        found = expected.lower() in response.lower()
        results[key] = {"expected": expected, "found": found}
    total = len(results)
    correct = sum(1 for v in results.values() if v["found"])
    return {"accuracy": correct / total if total else 0, "details": results}


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    print(f"=== Autocompaction Stress Test ===")
    print(f"Model: {MODEL}")
    print(f"Endpoint: {BASE_URL}")
    print(f"Target turns: {TOTAL_TURNS}")
    print(f"Probe every: {PROBE_EVERY} turns")
    print(f"Transcript: {TRANSCRIPT_PATH}")
    print()

    messages = []
    transcript = []
    probes = []

    # Turn 0: inject seed facts
    print(f"[Turn 0] Injecting {len(SEED_FACTS)} seed facts...")
    messages.append({"role": "user", "content": SEED_BLOCK})
    resp = call_api(messages)
    messages.append({"role": "assistant", "content": resp})
    transcript.append({"turn": 0, "type": "seed", "user": SEED_BLOCK, "assistant": resp})
    print(f"  -> {len(resp)} chars response")

    for turn in range(1, TOTAL_TURNS + 1):
        is_probe = (turn % PROBE_EVERY == 0)

        if is_probe:
            prompt = make_probe_prompt(turn)
            ptype = "probe"
        else:
            prompt = make_filler_prompt(turn)
            ptype = "filler"

        print(f"[Turn {turn}/{TOTAL_TURNS}] {ptype}...", end=" ", flush=True)
        messages.append({"role": "user", "content": prompt})

        t0 = time.time()
        resp = call_api(messages)
        elapsed = time.time() - t0
        messages.append({"role": "assistant", "content": resp})

        entry = {
            "turn": turn,
            "type": ptype,
            "user": prompt,
            "assistant": resp,
            "elapsed_s": round(elapsed, 2),
            "msg_count": len(messages),
        }

        if is_probe:
            score = score_recall(resp, turn)
            entry["recall"] = score
            probes.append({"turn": turn, **score})
            print(f"recall={score['accuracy']:.0%} ({elapsed:.1f}s, {len(messages)} msgs)")
        else:
            print(f"ok ({elapsed:.1f}s, {len(messages)} msgs, {len(resp)} chars)")

        transcript.append(entry)

        # Early-stop if we detect total recall collapse
        if is_probe and score["accuracy"] == 0 and turn > PROBE_EVERY:
            print(f"\n*** TOTAL RECALL COLLAPSE at turn {turn} — stopping early ***")
            break

    # ── Write outputs ──────────────────────────────────────────────────────
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(TRANSCRIPT_PATH, "w") as f:
        json.dump({"config": {"model": MODEL, "base_url": BASE_URL, "total_turns": TOTAL_TURNS,
                               "probe_every": PROBE_EVERY, "seed_facts": SEED_FACTS,
                               "timestamp": TIMESTAMP},
                    "transcript": transcript, "probes": probes}, f, indent=2)

    # Metrics markdown
    lines = [
        f"# Autocompaction Stress Test — {TIMESTAMP}",
        f"",
        f"- **Model**: {MODEL}",
        f"- **Endpoint**: {BASE_URL}",
        f"- **Total turns executed**: {len(transcript)}",
        f"- **Seed facts**: {len(SEED_FACTS)}",
        f"",
        f"## Recall Probes",
        f"",
        f"| Turn | Accuracy | Lost Facts |",
        f"|------|----------|------------|",
    ]
    for p in probes:
        lost = [k for k, v in p["details"].items() if not v["found"]]
        lost_str = ", ".join(lost) if lost else "none"
        lines.append(f"| {p['turn']} | {p['accuracy']:.0%} | {lost_str} |")

    lines.append("")
    if probes:
        first_degradation = next((p for p in probes if p["accuracy"] < 1.0), None)
        if first_degradation:
            lines.append(f"**First degradation at turn {first_degradation['turn']}** "
                         f"(accuracy {first_degradation['accuracy']:.0%})")
        else:
            lines.append("**No degradation detected** — all probes returned 100% recall.")
    lines.append("")
    lines.append(f"Full transcript: `{TRANSCRIPT_PATH}`")

    with open(METRICS_PATH, "w") as f:
        f.write("\n".join(lines))

    print(f"\nDone. Metrics: {METRICS_PATH}")
    print(f"Transcript: {TRANSCRIPT_PATH}")


if __name__ == "__main__":
    if not API_KEY:
        print("ERROR: Missing required environment variable 'ANTHROPIC_API_KEY'.", file=sys.stderr)
        raise SystemExit(2)
    main()
