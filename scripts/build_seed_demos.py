#!/usr/bin/env python3
"""Génère data/seeds/*.json — grilles démo complètes pour Supabase."""
import copy
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEEDS = ROOT / "data" / "seeds"


def git_participants():
    raw = subprocess.check_output(
        ["git", "-C", str(ROOT), "show", "fe7f031:data/participants.json"]
    )
    return json.loads(raw.decode("utf-8"))["participants"]


def by_name(parts, name):
    return copy.deepcopy(next(p for p in parts if p["identite"]["prenom"] == name))


def replace_team(obj, old, new):
    if isinstance(obj, dict):
        return {k: replace_team(v, old, new) for k, v in obj.items()}
    if isinstance(obj, list):
        return [replace_team(v, old, new) for v in obj]
    if isinstance(obj, str) and obj == old:
        return new
    return obj


def strip_export(p):
    p.pop("sourceFichier", None)
    return p


def fix_scores_vainqueur(scores, old, new):
    for v in scores.values():
        if v.get("vainqueur") == old:
            v["vainqueur"] = new


def build_cursor(parts):
    """Prono IA : hosts + Amérique du Sud, Argentine championne vs Espagne."""
    p = strip_export(by_name(parts, "Cursor"))
    poule_matchs = copy.deepcopy(p.get("matchs", {}))
    p = replace_team(p, "France", "Argentine")
    p["matchs"] = poule_matchs
    p["identite"] = {
        "prenom": "Cursor",
        "nom": "Agent",
        "email": "cursor.demo@demo.local",
        "equipe": "Pains sucés · prono IA 2026",
    }
    e2 = p["etape2Tableau"]
    e2["finalists"] = ["Argentine", "Espagne"]
    e2["winner"] = "Argentine"
    pfb = p.get("phaseFinalePourBareme", {})
    pfb["finalistesChoisis"] = ["Argentine", "Espagne"]
    pfb["vainqueurFinal"] = "Argentine"
    p["phaseFinalePourBareme"] = pfb
    fix_scores_vainqueur(p.get("scoresElimination", {}), "France", "Argentine")
    p["bonus"] = {
        "meilleureAttaque": "Argentine",
        "matchs00": "5",
        "nationsA9pts": "6",
        "nbCSC": "3",
        "meilleurButeur": "L. Martínez",
        "meilleurJoueur": "Pedri",
        "meilleurGardien": "E. Martínez",
        "nbButs": "174",
        "nbCartonsRouges": "7",
        "nbProlongations": "5",
    }
    p["_seedMeta"] = {
        "label": "Cursor Agent — prono data-driven",
        "story": "Hosts performants, Europe solide, Argentine au sommet (génération post-Messi).",
    }
    return p


def build_sophie(parts):
    """Optimiste Iberia : l'Espagne l'emporte."""
    p = strip_export(by_name(parts, "Sophie"))
    p["identite"] = {
        "prenom": "Sophie",
        "nom": "Martin",
        "email": "sophie.demo@demo.local",
        "equipe": "Les Bleu(e)s du dimanche",
    }
    p["bonus"]["meilleureAttaque"] = "Espagne"
    p["bonus"]["meilleurButeur"] = "L. Yamal"
    p["bonus"]["meilleurJoueur"] = "Pedri"
    p["_seedMeta"] = {
        "label": "Sophie — Iberia au sommet",
        "story": "Poules serrées, finale Espagne–Argentine, la Roja au bout du suspense.",
    }
    return p


def build_lucas(parts):
    """Sélectionneur classique : le Brésil champion."""
    p = strip_export(by_name(parts, "Marki"))
    p = replace_team(p, "France", "Brésil")
    p["identite"] = {
        "prenom": "Lucas",
        "nom": "Bernard",
        "email": "lucas.demo@demo.local",
        "equipe": "Seleção du bureau",
    }
    p["bonus"] = {
        "meilleureAttaque": "Brésil",
        "matchs00": "6",
        "nationsA9pts": "5",
        "nbCSC": "4",
        "meilleurButeur": "Vinícius Jr",
        "meilleurJoueur": "Vinícius Jr",
        "meilleurGardien": "A. Becker",
        "nbButs": "168",
        "nbCartonsRouges": "8",
        "nbProlongations": "4",
    }
    p["_seedMeta"] = {
        "label": "Lucas — favori Seleção",
        "story": "Gros noms en phases finales, Vinícius en feu, Brésil bat l'Argentine en finale.",
    }
    return p


def main():
    SEEDS.mkdir(parents=True, exist_ok=True)
    parts = git_participants()
    demos = [
        ("cursor-agent.json", build_cursor(parts)),
        ("sophie-iberia.json", build_sophie(parts)),
        ("lucas-selecao.json", build_lucas(parts)),
    ]
    for fname, payload in demos:
        meta = payload.pop("_seedMeta", {})
        path = SEEDS / fname
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        if fname == "cursor-agent.json":
            subprocess.run(
                ["node", str(ROOT / "scripts" / "derive_tableau_from_poules.js"), str(path)],
                cwd=str(ROOT),
                check=True,
            )
        print(
            fname,
            "->",
            payload["identite"]["email"],
            "|",
            meta.get("label", ""),
            "| matchs",
            len(payload.get("matchs", {})),
            "| KO scores",
            len(payload.get("scoresElimination", {})),
            "| vainqueur",
            payload.get("etape2Tableau", {}).get("winner"),
        )


if __name__ == "__main__":
    main()
