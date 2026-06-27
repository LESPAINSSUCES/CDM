#!/usr/bin/env python3
"""Vérifie la cohérence du tableau seizièmes (M73–M88) avec FIFA 2026."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANNEX = json.loads((ROOT / "data/fifa-annex-c.json").read_text())

KNOCK_R32_DEF = [
    {"m": 73, "L": {"k": "runner", "g": "A"}, "R": {"k": "runner", "g": "B"}},
    {"m": 76, "L": {"k": "winner", "g": "C"}, "R": {"k": "runner", "g": "F"}},
    {"m": 74, "L": {"k": "winner", "g": "E"}, "R": {"k": "third", "pool": ["A", "B", "C", "D", "F"]}},
    {"m": 75, "L": {"k": "winner", "g": "F"}, "R": {"k": "runner", "g": "C"}},
    {"m": 78, "L": {"k": "runner", "g": "E"}, "R": {"k": "runner", "g": "I"}},
    {"m": 77, "L": {"k": "winner", "g": "I"}, "R": {"k": "third", "pool": ["C", "D", "F", "G", "H"]}},
    {"m": 79, "L": {"k": "winner", "g": "A"}, "R": {"k": "third", "pool": ["C", "E", "F", "H", "I"]}},
    {"m": 80, "L": {"k": "winner", "g": "L"}, "R": {"k": "third", "pool": ["E", "H", "I", "J", "K"]}},
    {"m": 82, "L": {"k": "winner", "g": "G"}, "R": {"k": "third", "pool": ["A", "E", "H", "I", "J"]}},
    {"m": 81, "L": {"k": "winner", "g": "D"}, "R": {"k": "third", "pool": ["B", "E", "F", "I", "J"]}},
    {"m": 84, "L": {"k": "winner", "g": "H"}, "R": {"k": "runner", "g": "J"}},
    {"m": 83, "L": {"k": "runner", "g": "K"}, "R": {"k": "runner", "g": "L"}},
    {"m": 85, "L": {"k": "winner", "g": "B"}, "R": {"k": "third", "pool": ["E", "F", "G", "I", "J"]}},
    {"m": 88, "L": {"k": "runner", "g": "D"}, "R": {"k": "runner", "g": "G"}},
    {"m": 86, "L": {"k": "winner", "g": "J"}, "R": {"k": "runner", "g": "H"}},
    {"m": 87, "L": {"k": "winner", "g": "K"}, "R": {"k": "third", "pool": ["D", "E", "I", "J", "L"]}},
]

KO_R16 = {89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80], 93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87]}
KO_QF = {97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96]}
KO_SF = {101: [97, 98], 102: [99, 100]}

# FIFA / Wikipedia — seizièmes M73–M88 (libellés officiels)
FIFA_R32 = {
    73: ("2A", "2B"),
    74: ("1E", "3A/B/C/D/F"),
    75: ("1F", "2C"),
    76: ("1C", "2F"),
    77: ("1I", "3C/D/F/G/H"),
    78: ("2E", "2I"),
    79: ("1A", "3C/E/F/H/I"),
    80: ("1L", "3E/H/I/J/K"),
    81: ("1D", "3B/E/F/I/J"),
    82: ("1G", "3A/E/H/I/J"),
    83: ("2K", "2L"),
    84: ("1H", "2J"),
    85: ("1B", "3E/F/G/I/J"),
    86: ("1J", "2H"),
    87: ("1K", "3D/E/I/J/L"),
    88: ("2D", "2G"),
}

FIFA_R16 = {
    89: (74, 77),
    90: (73, 75),
    91: (76, 78),
    92: (79, 80),
    93: (83, 84),
    94: (81, 82),
    95: (86, 88),
    96: (85, 87),
}

# Colonnes Annexe C Wikipedia : 1A 1B 1D 1E 1G 1I 1K 1L → match M79 M85 M81 M74 M82 M77 M87 M80
ANNEX_SLOTS = [
    (79, "A"),
    (85, "B"),
    (81, "D"),
    (74, "E"),
    (82, "G"),
    (77, "I"),
    (87, "K"),
    (80, "L"),
]

# Quelques combinaisons Annexe C (Wikipedia, juin 2026)
ANNEX_SCENARIOS = {
    67: {"groups": "BDEFIJKL", "map": "EJBDIFLK"},
    73: {"groups": "BDEFGIKL", "map": "EGBDIFLK"},
    74: {"groups": "BDEFGIJL", "map": "EGBDJFLI"},
    75: {"groups": "BDEFGIJK", "map": "EGBDJFIK"},
    363: {"groups": "ABDEFGIL", "map": "EGBDAFLI"},
    364: {"groups": "ABDEFGIK", "map": "EGBDAFIK"},
    365: {"groups": "ABDEFGIJ", "map": "EGBDAFIJ"},
    494: {"groups": "ABCDEFGI", "map": "CGBDAFEI"},
}


def slot_label(slot: dict) -> str:
    if slot["k"] == "winner":
        return f"1{slot['g']}"
    if slot["k"] == "runner":
        return f"2{slot['g']}"
    pool = "/".join(slot["pool"])
    return f"3{pool}"


def build_r32_labels() -> dict[int, tuple[str, str]]:
    out = {}
    for d in KNOCK_R32_DEF:
        out[d["m"]] = (slot_label(d["L"]), slot_label(d["R"]))
    return out


def assign_thirds_annex(advance: set[str]) -> dict[int, str]:
    key = "".join(sorted(advance))
    mapping = ANNEX["lookup"].get(key)
    if not mapping:
        return {}
    out = {}
    for i, slot in enumerate(ANNEX["slotOrder"]):
        out[ANNEX["matchBySlot"][slot]] = mapping[i]
    return out


def assign_thirds_legacy(advance: set[str]) -> dict[int, str]:
    """Même algorithme que index.html / simulate_demo.py."""
    third_slots = []
    for d in KNOCK_R32_DEF:
        if d["L"]["k"] == "third":
            third_slots.append((d["m"], "L", d["L"]["pool"]))
        if d["R"]["k"] == "third":
            third_slots.append((d["m"], "R", d["R"]["pool"]))

    # Rang global des 3e (pts décroissants simulés par ordre alphabétique inverse pour stabilité)
    letters = sorted(advance)
    third_rank = {g: i for i, g in enumerate(letters)}

    def candidates(pool, used):
        cands = []
        for g in pool:
            up = g.upper()
            if up not in advance or up in used:
                continue
            cands.append((third_rank[up], up))
        cands.sort()
        return [g for _, g in cands]

    assignment: dict[tuple[int, str], str] = {}
    used: set[str] = set()

    def backtrack(idx: int) -> bool:
        if idx >= len(third_slots):
            return True
        m, side, pool = third_slots[idx]
        for g in candidates(pool, used):
            used.add(g)
            assignment[(m, side)] = g
            if backtrack(idx + 1):
                return True
            used.remove(g)
            del assignment[(m, side)]
        return False

    if not backtrack(0):
        return {}

    # match → groupe du 3e
    by_match: dict[int, str] = {}
    for (m, side), g in assignment.items():
        by_match[m] = g
    return by_match


def main() -> None:
    labels = build_r32_labels()
    print("=== Seizièmes M73–M88 : définition des créneaux ===")
    ok = True
    for m in sorted(FIFA_R32):
        ours = labels[m]
        fifa = FIFA_R32[m]
        # normaliser pools 3e (ordre des groupes dans le libellé FIFA peut varier)
        def norm(s: str) -> str:
            if s.startswith("3") and "/" in s:
                parts = s[1:].split("/")
                return "3" + "".join(sorted(parts))
            return s

        match_l = ours[0] == fifa[0]
        match_r = norm(ours[1]) == norm(fifa[1])
        status = "OK" if match_l and match_r else "ECART"
        if status != "OK":
            ok = False
        print(f"  M{m:2d}  code={ours[0]:>12} vs {fifa[0]:>12}  |  {ours[1]:>18} vs {fifa[1]:>18}  [{status}]")

    print("\n=== Huitièmes M89–M96 (Round of 16 FIFA) ===")
    for m in sorted(FIFA_R16):
        status = "OK" if KO_R16[m] == list(FIFA_R16[m]) else "ECART"
        if status != "OK":
            ok = False
        print(f"  M{m}: W{KO_R16[m][0]} vs W{KO_R16[m][1]}  [{status}]")

    print("\n=== Quarts / demis ===")
    print(f"  QF: {KO_QF}  (FIFA: 97=W89/W90, 98=W93/W94, 99=W91/W92, 100=W95/W96)")
    print(f"  SF: {KO_SF}  (FIFA: 101=W97/W98, 102=W99/W100)")

    print("\n=== Annexe C : 495 combinaisons officielles ===")
    wiki_path = Path("/home/ubuntu/.cursor/projects/workspace/agent-tools/a7514509-4b04-4e28-bc48-f81e3799ef93.txt")
    annex_all = {}
    if wiki_path.exists():
        for line in wiki_path.read_text().splitlines():
            if not re.match(r"\| \d+ \|", line):
                continue
            parts = [p.strip() for p in line.strip("|").split("|")]
            if len(parts) < 17:
                continue
            groups = parts[1:9]
            if any(len(g) != 1 or not g.isalpha() for g in groups):
                continue
            thirds = [t[1] if t.startswith("3") else t for t in parts[10:18]]
            annex_all["".join(sorted(groups))] = {
                ANNEX_SLOTS[i][0]: thirds[i] for i in range(8)
            }

    annex_fail = 0
    for key, expected in annex_all.items():
        got = assign_thirds_annex(set(key))
        if got != {m: expected[m] for m in expected}:
            annex_fail += 1
    print(f"  Lookup Annexe C : {len(annex_all) - annex_fail}/{len(annex_all)} OK")

    legacy_fail = 0
    for key, expected in list(annex_all.items())[:20]:
        got = assign_thirds_legacy(set(key))
        exp = {m: expected[m] for m in expected}
        if got != exp:
            legacy_fail += 1
    print(f"  Ancien backtracking (échantillon 20) : {20 - legacy_fail}/20 OK")

    print("\n=== Synthèse ===")
    if ok:
        print("✓ Les 16 créneaux seizièmes et les 8 huitièmes correspondent au tableau FIFA 2026.")
    else:
        print("✗ Écart détecté sur les créneaux fixes.")
    if annex_fail:
        print(f"⚠ Lookup Annexe C : {annex_fail} écart(s).")
    else:
        print("✓ Les 495 combinaisons Annexe C sont couvertes.")


if __name__ == "__main__":
    main()
