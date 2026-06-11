# Scores CDM (info) — gratuit, sans API-Football

Le widget sur `classement.html` affiche les **matchs du jour** et un lien **FIFA live**.  
Il **ne modifie pas** `resultats.json` ni le calcul des points du concours.

## Sources (100 % gratuites)

| Source | Rôle |
|--------|------|
| [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) | Calendrier CDM 2026, scores publics quand mis à jour |
| `data/resultats.json` | Scores saisis par l’organisateur (prioritaires pour le bandeau) |
| [FIFA.com](https://www.fifa.com/fr/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures) | Scores **live** minute par minute (lien direct) |

Aucune clé API, aucun Supabase requis pour le widget.

## Fichier principal

`js/live-scores.js` — refresh auto toutes les **5 min** (juin–juillet 2026).

## Ancienne stack API-Football (optionnelle, dépréciée)

Le dossier `supabase/functions/live-scores/` et le secret `APIFOOTBALL_KEY` ne sont **plus utilisés** par le site.  
API-Football exige un abonnement payant pour la saison 2026 — vous pouvez ignorer cette Edge Function.

## Personnalisation

Dans `js/config.js`, `liveScoresUrl` n’est plus lu par le widget.
