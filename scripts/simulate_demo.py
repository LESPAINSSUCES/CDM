"""Génère resultats.json (vérité officielle démo) + 3 grilles joueurs pour tester le classement."""
from __future__ import annotations

import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRILLES_DIR = ROOT / "data" / "grilles"
RESULTATS = ROOT / "data" / "resultats.json"

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

# Classement visé par groupe : [1er, 2e, 3e, 4e]
GROUP_STANDINGS = {
    "Groupe A": ["Mexique", "Corée du Sud", "Afrique du Sud", "Rép. Tchèque"],
    "Groupe B": ["Suisse", "Canada", "Bosnie Herzégovine", "Qatar"],
    "Groupe C": ["Brésil", "Maroc", "Écosse", "Haïti"],
    "Groupe D": ["États-Unis", "Turquie", "Australie", "Paraguay"],
    "Groupe E": ["Allemagne", "Équateur", "Côte d'Ivoire", "Curacao"],
    "Groupe F": ["Pays-Bas", "Japon", "Suède", "Tunisie"],
    "Groupe G": ["Belgique", "Égypte", "Iran", "Nouvelle Zélande"],
    "Groupe H": ["Espagne", "Uruguay", "Cap Vert", "Arabie Saoudite"],
    "Groupe I": ["France", "Norvège", "Sénégal", "Irak"],
    "Groupe J": ["Argentine", "Autriche", "Algérie", "Jordanie"],
    "Groupe K": ["Portugal", "Colombie", "RD Congo", "Ouzbékistan"],
    "Groupe L": ["Angleterre", "Croatie", "Ghana", "Panama"],
}

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

# Favoris pour les KO (ordre de force décroissant — le plus fort gagne)
KO_STRENGTH = [
    "France", "Argentine", "Brésil", "Angleterre", "Espagne", "Portugal", "Allemagne",
    "Pays-Bas", "Belgique", "États-Unis", "Mexique", "Maroc", "Colombie", "Croatie",
    "Suisse", "Japon", "Uruguay", "Norvège", "Équateur", "Autriche", "Turquie", "Canada",
    "Corée du Sud", "Égypte", "Sénégal", "RD Congo", "Écosse", "Ghana", "Cap Vert",
    "Algérie", "Afrique du Sud", "Ouzbékistan", "Bosnie Herzégovine", "Paraguay",
    "Australie", "Iran", "Haïti", "Jordanie", "Rép. Tchèque", "Panama", "Curacao",
    "Tunisie", "Qatar", "Arabie Saoudite", "Nouvelle Zélande", "Irak",
]

OFFICIAL_BONUS = {
    "meilleureAttaque": "France",
    "matchs00": "5",
    "nationsA9pts": "6",
    "nbCSC": "3",
    "meilleurButeur": "K. Mbappé",
    "meilleurJoueur": "L. Messi",
    "meilleurGardien": "E. Martínez",
    "nbButs": "168",
    "nbCartonsRouges": "7",
    "nbProlongations": "4",
}


_ANNEX = json.loads((ROOT / "data/fifa-annex-c.json").read_text())
_ANNEX_SLOT_ORDER = _ANNEX["slotOrder"]
_ANNEX_MATCH_BY_SLOT = _ANNEX["matchBySlot"]
_ANNEX_LOOKUP = _ANNEX["lookup"]


def fifa_annex_third_assignments(advance_groups: set[str]) -> dict[int, str] | None:
    key = "".join(sorted(g.upper() for g in advance_groups))
    mapping = _ANNEX_LOOKUP.get(key)
    if not mapping:
        return None
    return {_ANNEX_MATCH_BY_SLOT[slot]: mapping[i] for i, slot in enumerate(_ANNEX_SLOT_ORDER)}


def rank(team: str) -> int:
    try:
        return KO_STRENGTH.index(team)
    except ValueError:
        return 999


def stronger(a: str, b: str) -> str:
    return a if rank(a) <= rank(b) else b


def gen_poule_matchs() -> dict:
    """Scores cohérents avec GROUP_STANDINGS."""
    matchs = {}
    for title, rows in GROUPS.items():
        order = GROUP_STANDINGS[title]
        for num, home, away in rows:
            hi, ai = order.index(home), order.index(away)
            if hi < ai:
                sh, sa = (2, 0) if hi == 0 else (1, 0)
            elif hi > ai:
                sh, sa = (0, 1) if ai == 0 else (0, 2)
            else:
                sh, sa = 1, 1
            matchs[f"Match {num}"] = {"home": home, "away": away, "scoreHome": str(sh), "scoreAway": str(sa)}
    return matchs


def group_letter(title: str) -> str:
    return title.replace("Groupe ", "").strip()[-1]


def compute_standings(matchs: dict) -> tuple[dict, list]:
    standings = {}
    thirds = []
    for title, rows in GROUPS.items():
        teams = list({t for _, h, a in rows for t in (h, a)})
        pts = {t: 0 for t in teams}
        gf = {t: 0 for t in teams}
        ga = {t: 0 for t in teams}
        for num, hm, aw in rows:
            m = matchs.get(f"Match {num}", {})
            hh = int(m.get("scoreHome") or -1)
            aa = int(m.get("scoreAway") or -1)
            if hh < 0 or aa < 0:
                continue
            gf[hm] += hh
            ga[hm] += aa
            gf[aw] += aa
            ga[aw] += hh
            if hh > aa:
                pts[hm] += 3
            elif aa > hh:
                pts[aw] += 3
            else:
                pts[hm] += 1
                pts[aw] += 1
        letter = group_letter(title)
        ord_teams = sorted(teams, key=lambda t: (-pts[t], -(gf[t] - ga[t]), -gf[t], t))
        table = [{"rang": i + 1, "team": t, "pts": pts[t]} for i, t in enumerate(ord_teams)]
        standings[letter] = {"letter": letter, "teams": table}
        thirds.append({"grp": letter, "team": table[2]["team"], "pts": table[2]["pts"]})
    thirds.sort(key=lambda r: (-r["pts"], r["grp"]))
    return standings, thirds


def build_r32(standings: dict, thirds: list) -> dict[int, dict]:
    advance_third = {r["grp"] for r in thirds[:8]}
    third_rank = {r["grp"]: i for i, r in enumerate(thirds)}

    def resolve(slot: dict) -> str:
        tb = standings.get(slot["g"])
        if not tb:
            return ""
        return tb["teams"][0]["team"] if slot["k"] == "winner" else tb["teams"][1]["team"]

    def assign_straight(slot: dict, used: set) -> str:
        t = resolve(slot)
        if not t or t in used:
            return ""
        used.add(t)
        return t

    def third_candidates(pool: list, used: set) -> list:
        out = []
        for L in pool or []:
            up = L.upper()
            if up not in advance_third:
                continue
            rk = third_rank.get(up, 999)
            g = standings.get(up)
            tn = g["teams"][2]["team"] if g else ""
            if tn and tn not in used:
                out.append((rk, tn))
        out.sort(key=lambda x: x[0])
        return [t for _, t in out]

    def backtrack_thirds(slots: list, idx: int, used: set, assignment: dict) -> bool:
        if idx >= len(slots):
            return True
        m, side, pool = slots[idx]
        for tn in third_candidates(pool, used):
            used.add(tn)
            assignment[(m, side)] = tn
            if backtrack_thirds(slots, idx + 1, used, assignment):
                return True
            used.discard(tn)
            del assignment[(m, side)]
        return False

    r32 = {}
    used: set = set()
    third_slots = []
    for defn in KNOCK_R32_DEF:
        m = defn["m"]
        r32[m] = {"left": "", "right": ""}
        if defn["L"].get("k") == "third":
            third_slots.append((m, "left", defn["L"].get("pool") or []))
        else:
            r32[m]["left"] = assign_straight(defn["L"], used)
        if defn["R"].get("k") == "third":
            third_slots.append((m, "right", defn["R"].get("pool") or []))
        else:
            r32[m]["right"] = assign_straight(defn["R"], used)

    assignment = {}
    annex = fifa_annex_third_assignments(advance_third)
    annex_ok = False
    if annex:
        annex_ok = True
        for m, grp in annex.items():
            g = standings.get(grp)
            tn = g["teams"][2]["team"] if g else ""
            if not tn or tn in used:
                annex_ok = False
                break
            side = "right"
            for defn in KNOCK_R32_DEF:
                if defn["m"] == m:
                    side = "right" if defn["R"].get("k") == "third" else "left"
                    break
            r32[m][side] = tn
            used.add(tn)
        if not annex_ok:
            for m, side, _ in third_slots:
                r32[m][side] = ""
            used = set()
            for defn in KNOCK_R32_DEF:
                m = defn["m"]
                if defn["L"].get("k") != "third" and r32[m]["left"]:
                    used.add(r32[m]["left"])
                if defn["R"].get("k") != "third" and r32[m]["right"]:
                    used.add(r32[m]["right"])
    if not annex_ok:
        if backtrack_thirds(third_slots, 0, used, assignment):
            for (m, side), tn in assignment.items():
                r32[m][side] = tn
        else:
            for m, side, pool in third_slots:
                if r32[m][side]:
                    continue
                cands = third_candidates(pool, used)
                if cands:
                    used.add(cands[0])
                    r32[m][side] = cands[0]
    return r32


def ko_teams_from_r32(r32: dict, winners: dict[int, str]) -> dict[int, tuple[str, str]]:
    """Construit les affrontements KO à partir des vainqueurs."""
    teams: dict[int, tuple[str, str]] = {}

    def side(mid: int, slot: str) -> str:
        if mid in winners:
            return winners[mid]
        p = r32.get(mid, {})
        return p.get("left" if slot == "L" else "right", "")

    for m, p in r32.items():
        teams[m] = (p["left"], p["right"])

    for m, (a, b) in list(KO_R16.items()):
        teams[m] = (winners.get(a, ""), winners.get(b, ""))
    for m, (a, b) in list(KO_QF.items()):
        teams[m] = (winners.get(a, ""), winners.get(b, ""))
    for m, (a, b) in list(KO_SF.items()):
        teams[m] = (winners.get(a, ""), winners.get(b, ""))
    if 101 in winners and 102 in winners:
        teams[104] = (winners[101], winners[102])
        # petite finale : perdants demis
        w101, w102 = winners[101], winners[102]
        h101, a101 = teams.get(101, ("", ""))
        h102, a102 = teams.get(102, ("", ""))
        l101 = a101 if w101 == h101 else h101
        l102 = a102 if w102 == h102 else h102
        teams[103] = (l101, l102)
    return teams


def simulate_ko_bracket(r32: dict, etape_max: int = 7) -> tuple[dict, dict, dict]:
    """Simule scores KO ; etape_max contrôle jusqu'où on remplit."""
    winners: dict[int, str] = {}
    scores: dict[str, dict] = {}
    ko_official: dict[str, dict] = {}

    def play(mid: int, home: str, away: str, upset: bool = False) -> tuple[str, int, int]:
        fav = stronger(home, away)
        dog = away if fav == home else home
        if upset:
            w = dog
            return w, 1, 2
        w = fav
        return w, 2, (1 if fav == home else 0) if dog == away else 1

    # R32 (étape 3)
    if etape_max >= 3:
        for defn in KNOCK_R32_DEF:
            m = defn["m"]
            home, away = r32[m]["left"], r32[m]["right"]
            ko_official[str(m)] = {"home": home, "away": away}
            w, sh, sa = play(m, home, away)
            winners[m] = w
            scores[f"Match {m}"] = {"home": home, "away": away, "scoreHome": str(sh), "scoreAway": str(sa)}

    teams = ko_teams_from_r32(r32, winners)

    def round_play(ids: list[int], min_etape: int, upsets: set[int] | None = None):
        nonlocal winners, scores, teams
        if etape_max < min_etape:
            return
        upsets = upsets or set()
        for m in ids:
            home, away = teams.get(m, ("", ""))
            if not home or not away:
                continue
            ko_official[str(m)] = {"home": home, "away": away}
            w, sh, sa = play(m, home, away, upset=m in upsets)
            winners[m] = w
            scores[f"Match {m}"] = {"home": home, "away": away, "scoreHome": str(sh), "scoreAway": str(sa)}
        teams = ko_teams_from_r32(r32, winners)

    round_play(list(KO_R16.keys()), 4)
    round_play(list(KO_QF.keys()), 5)
    round_play(list(KO_SF.keys()), 6, upsets={102})  # petite surprise : Espagne bat Brésil en demi
    if etape_max >= 7 and 101 in winners and 102 in winners:
        for m in (103, 104):
            home, away = teams.get(m, ("", ""))
            if not home or not away:
                continue
            ko_official[str(m)] = {"home": home, "away": away}
            w, sh, sa = play(m, home, away)
            winners[m] = w
            scores[f"Match {m}"] = {"home": home, "away": away, "scoreHome": str(sh), "scoreAway": str(sa)}

    vainqueurs = {str(m): w for m, w in winners.items()}
    return scores, vainqueurs, ko_official


def build_phase_finale(list32: list, winners: dict[int, str]) -> dict:
    def collect(a: int, b: int) -> list:
        return [winners[m] for m in range(a, b + 1) if m in winners]

    return {
        "liste32QualifiesIssuesPoules": list32,
        "vainqueursSeiziemePourHuitiemes16": collect(73, 88),
        "vainqueursHuitiemesPourQuarts8": collect(89, 96),
        "vainqueursQuartsPourDemis4": collect(97, 100),
        "finalistesChoisis": collect(101, 102),
        "troisiemePlaceChoix": winners.get(103, ""),
        "vainqueurFinal": winners.get(104, ""),
    }


def build_resultats(etape: int = 7) -> dict:
    matchs = gen_poule_matchs()
    standings, thirds = compute_standings(matchs)
    r32 = build_r32(standings, thirds)
    list32 = []
    for p in r32.values():
        list32.extend([p["left"], p["right"]])
    scores_ko, vainqueurs, ko_off = simulate_ko_bracket(r32, etape_max=etape)
    winners_int = {int(k): v for k, v in vainqueurs.items()}
    seizieme = {f"M{m}": {"left": p["left"], "right": p["right"]} for m, p in r32.items()}

    return {
        "meta": {
            "misAJour": "2026-05-20",
            "note": "Démo — pronostics officiels Cursor Agent pour test classement Pains sucés",
        },
        "etapeDebloquee": etape,
        "matchs": matchs,
        "equipesQualifiees32Liste": list32,
        "matchsEliminationOfficiels": ko_off,
        "seiziemeParMatchR32": seizieme,
        "phaseFinalePourBareme": build_phase_finale(list32, winners_int),
        "vainqueursTableauElimination": vainqueurs,
        "scoresElimination": scores_ko,
        "bonus": OFFICIAL_BONUS,
    }


def mutate_score(sh: int, sa: int, rng_offset: int) -> tuple[int, int]:
    """Légère variation pour grilles joueurs."""
    opts = [(sh, sa), (sh, sa), (max(0, sh - 1), sa), (sh, max(0, sa - 1)), (sh + 1, sa), (sh, sa + 1)]
    return opts[rng_offset % len(opts)]


def build_player_grille(
    prenom: str,
    nom: str,
    email: str,
    official: dict,
    accuracy: float,
    tableau_winner: str,
) -> dict:
    """accuracy ~1.0 = copie l'officiel ; ~0.5 = beaucoup d'erreurs poules."""
    matchs = {}
    off_matchs = official["matchs"]
    for i, (key, real) in enumerate(sorted(off_matchs.items(), key=lambda x: int(x[0].split()[1]))):
        rh, ra = int(real["scoreHome"]), int(real["scoreAway"])
        if i / 72 > accuracy:
            # mauvais pronostic 1N2
            sh, sa = mutate_score(ra, rh, i + len(prenom))
        else:
            sh, sa = mutate_score(rh, ra, i)
        matchs[key] = {
            "home": real["home"],
            "away": real["away"],
            "scoreHome": str(sh),
            "scoreAway": str(sa),
        }

    real_phase = official["phaseFinalePourBareme"]
    list32 = real_phase["liste32QualifiesIssuesPoules"]
    # Tableau étape 2 : mélange selon accuracy
    n_swap = max(0, int((1 - accuracy) * 8))
    pred32 = list32[:]
    for j in range(n_swap):
        a, b = j * 3, j * 3 + 5
        if b < len(pred32):
            pred32[a], pred32[b] = pred32[b], pred32[a]

    # Bracket picks simplifié : favorise tableau_winner en finale
    etape2_pick = {}
    r32 = official["seiziemeParMatchR32"]
    for key, sides in r32.items():
        mid = int(key[1:])
        left, right = sides.get("left", ""), sides.get("right", "")
        if not left or not right:
            continue
        real_w = official["vainqueursTableauElimination"].get(str(mid), "")
        if accuracy > 0.7 and real_w:
            etape2_pick[mid] = real_w
        elif tableau_winner in (left, right):
            etape2_pick[mid] = tableau_winner
        else:
            etape2_pick[mid] = stronger(left, right)

    # Propagation bracket étape 2 (simplifiée)
    def pick_parent(parent_map: dict, mid: int) -> str:
        if mid in etape2_pick:
            return etape2_pick[mid]
        if mid in parent_map:
            a, b = parent_map[mid]
            return etape2_pick.get(a) or etape2_pick.get(b) or ""
        return ""

    for m in KO_R16:
        a, b = KO_R16[m]
        la, lb = etape2_pick.get(a, ""), etape2_pick.get(b, "")
        if la and lb:
            etape2_pick[m] = stronger(la, lb) if tableau_winner not in (la, lb) else tableau_winner
    for m in KO_QF:
        a, b = KO_QF[m]
        la, lb = etape2_pick.get(a, ""), etape2_pick.get(b, "")
        if la and lb:
            etape2_pick[m] = tableau_winner if tableau_winner in (la, lb) else stronger(la, lb)
    for m in KO_SF:
        a, b = KO_SF[m]
        la, lb = etape2_pick.get(a, ""), etape2_pick.get(b, "")
        if la and lb:
            etape2_pick[m] = tableau_winner if tableau_winner in (la, lb) else stronger(la, lb)
    if 101 in etape2_pick and 102 in etape2_pick:
        etape2_pick[104] = tableau_winner

    r16 = [etape2_pick.get(m, "") for m in range(73, 89) if etape2_pick.get(m)]
    qf = [etape2_pick.get(m, "") for m in KO_R16 if etape2_pick.get(m)]
    sf = [etape2_pick.get(m, "") for m in KO_QF if etape2_pick.get(m)]
    finalists = [etape2_pick.get(101, ""), etape2_pick.get(102, "")]
    finalists = [f for f in finalists if f]

    phase = {
        "liste32QualifiesIssuesPoules": pred32[:32] if len(pred32) >= 32 else pred32,
        "vainqueursSeiziemePourHuitiemes16": r16,
        "vainqueursHuitiemesPourQuarts8": qf,
        "vainqueursQuartsPourDemis4": sf,
        "finalistesChoisis": finalists,
        "troisiemePlaceChoix": "",
        "vainqueurFinal": etape2_pick.get(104, tableau_winner),
    }

    kos = {}
    scores_elim = {}
    etape_pub = official.get("etapeDebloquee", 0)

    def _add_ko_pred(m: int):
        key = f"Match {m}"
        real = official["scoresElimination"].get(key, {})
        if not real:
            return
        home, away = real.get("home", ""), real.get("away", "")
        rw = official["vainqueursTableauElimination"].get(str(m), "")
        if accuracy > 0.6 and rw:
            pw, sh, sa = rw, int(real["scoreHome"]), int(real["scoreAway"])
        else:
            pw = stronger(home, away)
            sh, sa = 2, 1
        kos[str(m)] = pw
        scores_elim[key] = {"home": home, "away": away, "scoreHome": str(sh), "scoreAway": str(sa), "vainqueur": pw}

    if etape_pub >= 3:
        for m in range(73, 89):
            _add_ko_pred(m)
    if etape_pub >= 4:
        for m in range(89, 97):
            _add_ko_pred(m)
    if etape_pub >= 5:
        for m in range(97, 101):
            _add_ko_pred(m)
    if etape_pub >= 6:
        for m in range(101, 103):
            _add_ko_pred(m)
    if etape_pub >= 7:
        for m in (103, 104):
            _add_ko_pred(m)

    bonus_variants = [
        {"meilleureAttaque": "France", "matchs00": "4", "nationsA9pts": "5", "nbCSC": "2",
         "meilleurButeur": "K. Mbappé", "meilleurJoueur": "K. Mbappé", "meilleurGardien": "T. Courtois",
         "nbButs": "165", "nbCartonsRouges": "8", "nbProlongations": "5"},
        {"meilleureAttaque": "Espagne", "matchs00": "6", "nationsA9pts": "4", "nbCSC": "4",
         "meilleurButeur": "L. Messi", "meilleurJoueur": "Pedri", "meilleurGardien": "E. Martínez",
         "nbButs": "172", "nbCartonsRouges": "6", "nbProlongations": "3"},
        {"meilleureAttaque": "Brésil", "matchs00": "5", "nationsA9pts": "7", "nbCSC": "3",
         "meilleurButeur": "Vinícius Jr", "meilleurJoueur": "L. Messi", "meilleurGardien": "A. Becker",
         "nbButs": "170", "nbCartonsRouges": "7", "nbProlongations": "4"},
    ]
    idx = abs(hash(email)) % 3
    bonus = bonus_variants[idx]
    if accuracy > 0.8:
        bonus = deepcopy(OFFICIAL_BONUS)
        bonus["nbButs"] = "167"  # proche ±3

    return {
        "identite": {"prenom": prenom, "nom": nom, "email": email, "equipe": "Pains sucés"},
        "matchs": matchs,
        "equipesQualifiees32Liste": phase["liste32QualifiesIssuesPoules"],
        "etape2Tableau": {
            "r32": phase["liste32QualifiesIssuesPoules"],
            "r16": phase["vainqueursSeiziemePourHuitiemes16"],
            "qf": phase["vainqueursHuitiemesPourQuarts8"],
            "sf": phase["vainqueursQuartsPourDemis4"],
            "finalists": phase["finalistesChoisis"],
            "winner": phase["vainqueurFinal"],
        },
        "etape2Pick": {str(k): v for k, v in etape2_pick.items()},
        "vainqueursTableauEliminationChoisis": kos,
        "phaseFinalePourBareme": phase,
        "scoresElimination": scores_elim,
        "bonus": bonus,
    }


def main() -> int:
    GRILLES_DIR.mkdir(parents=True, exist_ok=True)

    # Tournoi complet simulé (étape 7 = tout débloqué côté joueurs pour la démo)
    official = build_resultats(etape=7)

    players = [
        ("Marki", "Organisateur", "marki@painssucés.local", 0.72, "France"),
        ("Sophie", "Dupont", "sophie@painssucés.local", 0.55, "Espagne"),
        ("Cursor", "Agent", "cursor@demo.local", 0.88, "France"),
    ]

    with RESULTATS.open("w", encoding="utf-8") as f:
        json.dump(official, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Écrit {RESULTATS} (etape={official['etapeDebloquee']}, {len(official['matchs'])} matchs poules)")

    for prenom, nom, email, acc, winner in players:
        grille = build_player_grille(prenom, nom, email, official, acc, winner)
        fname = f"CDM2026_{prenom}_{nom}.json".replace(" ", "_")
        path = GRILLES_DIR / fname
        with path.open("w", encoding="utf-8") as f:
            json.dump(grille, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  Grille {prenom} {nom} -> {path.name}")

    merge = ROOT / "scripts" / "merge_grilles.py"
    subprocess.run([sys.executable, str(merge)], check=True, cwd=ROOT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
