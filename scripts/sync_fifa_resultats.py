#!/usr/bin/env python3
"""Synchronise data/resultats.json depuis worldcup26.ir (scores FIFA officiels).

Mappe les matchs par paire d'équipes (les numéros worldcup26 ≠ numéros FIFA du jeu),
recalcule le tableau seizièmes (M73–M88) via Annexe C, et publie l'étape 3.
"""
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
import urllib.request
from copy import deepcopy
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTATS = ROOT / "data" / "resultats.json"
WC26_URL = "https://worldcup26.ir/get/games"

# Même GROUPS que organisateur.html / simulate_demo.py
GROUPS = {
    "Groupe A": [[1, "Mexique", "Afrique du Sud"], [2, "Corée du Sud", "Rép. Tchèque"], [25, "Rép. Tchèque", "Afrique du Sud"], [28, "Mexique", "Corée du Sud"], [53, "Rép. Tchèque", "Mexique"], [54, "Afrique du Sud", "Corée du Sud"]],
    "Groupe B": [[3, "Canada", "Bosnie Herzégovine"], [5, "Qatar", "Suisse"], [26, "Suisse", "Bosnie Herzégovine"], [27, "Canada", "Qatar"], [49, "Suisse", "Canada"], [50, "Bosnie Herzégovine", "Qatar"]],
    "Groupe C": [[6, "Brésil", "Maroc"], [7, "Haïti", "Écosse"], [30, "Écosse", "Maroc"], [31, "Brésil", "Haïti"], [51, "Écosse", "Brésil"], [52, "Maroc", "Haïti"]],
    "Groupe D": [[4, "États-Unis", "Paraguay"], [8, "Australie", "Turquie"], [32, "Turquie", "Paraguay"], [29, "États-Unis", "Australie"], [59, "Turquie", "États-Unis"], [60, "Paraguay", "Australie"]],
    "Groupe E": [[9, "Allemagne", "Curacao"], [11, "Côte d'Ivoire", "Équateur"], [35, "Équateur", "Curacao"], [34, "Allemagne", "Côte d'Ivoire"], [55, "Équateur", "Allemagne"], [56, "Curacao", "Côte d'Ivoire"]],
    "Groupe F": [[10, "Pays-Bas", "Japon"], [12, "Suède", "Tunisie"], [36, "Tunisie", "Japon"], [33, "Pays-Bas", "Suède"], [57, "Tunisie", "Pays-Bas"], [58, "Japon", "Suède"]],
    "Groupe G": [[14, "Belgique", "Égypte"], [16, "Iran", "Nouvelle Zélande"], [40, "Nouvelle Zélande", "Égypte"], [38, "Belgique", "Iran"], [65, "Nouvelle Zélande", "Belgique"], [66, "Égypte", "Iran"]],
    "Groupe H": [[13, "Espagne", "Cap Vert"], [15, "Arabie Saoudite", "Uruguay"], [39, "Uruguay", "Cap Vert"], [37, "Espagne", "Arabie Saoudite"], [63, "Uruguay", "Espagne"], [64, "Cap Vert", "Arabie Saoudite"]],
    "Groupe I": [[17, "France", "Sénégal"], [18, "Irak", "Norvège"], [43, "Norvège", "Sénégal"], [42, "France", "Irak"], [61, "Norvège", "France"], [62, "Sénégal", "Irak"]],
    "Groupe J": [[19, "Argentine", "Algérie"], [20, "Autriche", "Jordanie"], [44, "Jordanie", "Algérie"], [41, "Argentine", "Autriche"], [71, "Jordanie", "Argentine"], [72, "Algérie", "Autriche"]],
    "Groupe K": [[21, "Portugal", "RD Congo"], [24, "Ouzbékistan", "Colombie"], [48, "Colombie", "RD Congo"], [45, "Portugal", "Ouzbékistan"], [69, "Colombie", "Portugal"], [70, "RD Congo", "Ouzbékistan"]],
    "Groupe L": [[22, "Angleterre", "Croatie"], [23, "Ghana", "Panama"], [47, "Panama", "Croatie"], [46, "Angleterre", "Ghana"], [67, "Panama", "Angleterre"], [68, "Croatie", "Ghana"]],
}

EN_TO_FR = {
    "Mexico": "Mexique",
    "South Africa": "Afrique du Sud",
    "South Korea": "Corée du Sud",
    "Czech Republic": "Rép. Tchèque",
    "Canada": "Canada",
    "Bosnia and Herzegovina": "Bosnie Herzégovine",
    "Qatar": "Qatar",
    "Switzerland": "Suisse",
    "Brazil": "Brésil",
    "Morocco": "Maroc",
    "Haiti": "Haïti",
    "Scotland": "Écosse",
    "United States": "États-Unis",
    "Paraguay": "Paraguay",
    "Australia": "Australie",
    "Turkey": "Turquie",
    "Germany": "Allemagne",
    "Curaçao": "Curacao",
    "Ivory Coast": "Côte d'Ivoire",
    "Ecuador": "Équateur",
    "Netherlands": "Pays-Bas",
    "Japan": "Japon",
    "Sweden": "Suède",
    "Tunisia": "Tunisie",
    "Belgium": "Belgique",
    "Egypt": "Égypte",
    "Iran": "Iran",
    "New Zealand": "Nouvelle Zélande",
    "Spain": "Espagne",
    "Cape Verde": "Cap Vert",
    "Saudi Arabia": "Arabie Saoudite",
    "Uruguay": "Uruguay",
    "France": "France",
    "Senegal": "Sénégal",
    "Iraq": "Irak",
    "Norway": "Norvège",
    "Argentina": "Argentine",
    "Algeria": "Algérie",
    "Austria": "Autriche",
    "Jordan": "Jordanie",
    "Portugal": "Portugal",
    "Democratic Republic of the Congo": "RD Congo",
    "Uzbekistan": "Ouzbékistan",
    "Colombia": "Colombie",
    "England": "Angleterre",
    "Croatia": "Croatie",
    "Ghana": "Ghana",
    "Panama": "Panama",
}


def norm_team(s: str) -> str:
    return (
        unicodedata.normalize("NFD", s or "")
        .encode("ascii", "ignore")
        .decode()
        .lower()
        .strip()
    )


def team_fr(name: str) -> str:
    return EN_TO_FR.get(name, name)


def build_poule_index() -> dict[str, tuple[int, str, str, bool]]:
    idx: dict[str, tuple[int, str, str, bool]] = {}
    for rows in GROUPS.values():
        for num, home, away in rows:
            idx[norm_team(home) + "|" + norm_team(away)] = (num, home, away, False)
            idx[norm_team(away) + "|" + norm_team(home)] = (num, home, away, True)
    return idx


def fetch_games(url: str = WC26_URL) -> list[dict]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode())
    return data.get("games") or []


def is_group_game(g: dict) -> bool:
    grp = str(g.get("group") or "").strip().upper()
    return grp in list("ABCDEFGHIJKL")


def is_finished(g: dict) -> bool:
    elapsed = str(g.get("time_elapsed") or "").lower()
    return str(g.get("finished") or "").upper() == "TRUE" or elapsed == "finished"


def import_poule_scores(games: list[dict], base: dict) -> tuple[dict, list[str]]:
    idx = build_poule_index()
    matchs = deepcopy(base.get("matchs") or {})
    logs: list[str] = []

    for g in games:
        if not is_group_game(g) or not is_finished(g):
            continue
        home_en = g.get("home_team_name_en") or g.get("home_team_label") or ""
        away_en = g.get("away_team_name_en") or g.get("away_team_label") or ""
        home_fr, away_fr = team_fr(home_en), team_fr(away_en)
        key = norm_team(home_fr) + "|" + norm_team(away_fr)
        hit = idx.get(key)
        if not hit:
            logs.append(f"  ⚠ paire non mappée : {home_fr} – {away_fr}")
            continue
        num, home, away, rev = hit
        try:
            sh, sa = int(g["home_score"]), int(g["away_score"])
        except (TypeError, ValueError, KeyError):
            continue
        if rev:
            sh, sa = sa, sh
        mkey = f"Match {num}"
        prev = matchs.get(mkey, {})
        matchs[mkey] = {
            "home": home,
            "away": away,
            "scoreHome": str(sh),
            "scoreAway": str(sa),
            "csc": prev.get("csc", ""),
            "cartonsRouges": prev.get("cartonsRouges", ""),
        }
        logs.append(f"  M{num:02d} {home} {sh}–{sa} {away}")

    return matchs, logs


def count_filled(matchs: dict) -> int:
    n = 0
    for rows in GROUPS.values():
        for num, *_ in rows:
            m = matchs.get(f"Match {num}", {})
            if str(m.get("scoreHome", "")).strip() != "" and str(m.get("scoreAway", "")).strip() != "":
                n += 1
    return n


def build_ko_official(r32: dict[int, dict]) -> dict[str, dict]:
    ko: dict[str, dict] = {}
    for m in range(73, 105):
        if m <= 88:
            side = r32.get(m, {})
            ko[str(m)] = {"home": side.get("left", ""), "away": side.get("right", "")}
        else:
            ko[str(m)] = {"home": "", "away": ""}
    return ko


def sync_resultats(
    games: list[dict] | None = None,
    *,
    etape: int = 3,
    dry_run: bool = False,
    fill_r32: bool = True,
) -> dict:
    sys.path.insert(0, str(ROOT / "scripts"))
    from simulate_demo import build_r32, compute_standings

    base = json.loads(RESULTATS.read_text(encoding="utf-8")) if RESULTATS.exists() else {}
    if games is None:
        games = fetch_games()

    matchs, import_logs = import_poule_scores(games, base)
    filled = count_filled(matchs)
    total = sum(len(rows) for rows in GROUPS.values())

    standings, thirds = compute_standings(matchs)
    r32 = build_r32(standings, thirds) if fill_r32 else {}
    list32: list[str] = []
    for m in sorted(r32):
        list32.extend([r32[m]["left"], r32[m]["right"]])

    seizieme = {f"M{m}": {"left": r32[m]["left"], "right": r32[m]["right"]} for m in sorted(r32)}

    out = deepcopy(base)
    out["meta"] = {
        "misAJour": date.today().isoformat(),
        "note": f"Synchronisé FIFA worldcup26.ir — {filled}/{total} matchs poule",
    }
    out["etapeDebloquee"] = etape
    out["matchs"] = matchs
    out["equipesQualifiees32Liste"] = list32 if len(list32) == 32 else []
    out["matchsEliminationOfficiels"] = build_ko_official(r32) if fill_r32 else out.get("matchsEliminationOfficiels", {})
    out["seiziemeParMatchR32"] = seizieme if fill_r32 else out.get("seiziemeParMatchR32", {})
    out["phaseFinalePourBareme"] = {
        "liste32QualifiesIssuesPoules": list32 if len(list32) == 32 else [],
        "vainqueursSeiziemePourHuitiemes16": [],
        "vainqueursHuitiemesPourQuarts8": [],
        "vainqueursQuartsPourDemis4": [],
        "finalistesChoisis": [],
        "troisiemePlaceChoix": "",
        "vainqueurFinal": "",
    }
    out["vainqueursTableauElimination"] = {}
    out["scoresElimination"] = {}

    print(f"Poules : {filled}/{total} matchs renseignés")
    if filled < total:
        missing = []
        for rows in GROUPS.values():
            for num, home, away in rows:
                m = matchs.get(f"Match {num}", {})
                if not str(m.get("scoreHome", "")).strip():
                    missing.append(f"M{num} {home}–{away}")
        print("En attente :", ", ".join(missing))
    if fill_r32 and len(list32) == 32:
        print("\nTableau seizièmes (M73–M88) :")
        for m in sorted(r32):
            p = r32[m]
            print(f"  M{m}: {p['left']} vs {p['right']}")

    if not dry_run:
        RESULTATS.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n✓ Écrit {RESULTATS}")

    return out


def main() -> None:
    p = argparse.ArgumentParser(description="Sync resultats.json depuis worldcup26.ir")
    p.add_argument("--dry-run", action="store_true", help="Affiche sans écrire")
    p.add_argument("--etape", type=int, default=3, help="etapeDebloquee (défaut 3)")
    p.add_argument("--no-r32", action="store_true", help="Ne pas recalculer le tableau seizièmes")
    p.add_argument("--games-file", type=Path, help="JSON local worldcup26 (offline)")
    args = p.parse_args()

    games = None
    if args.games_file:
        games = json.loads(args.games_file.read_text(encoding="utf-8")).get("games", [])

    sync_resultats(
        games,
        etape=args.etape,
        dry_run=args.dry_run,
        fill_r32=not args.no_r32,
    )


if __name__ == "__main__":
    main()
