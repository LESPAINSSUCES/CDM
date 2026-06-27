# Scores CDM (info) — worldcup26.ir + FIFA

Le widget sur `classement.html` affiche les **scores live** (gratuits) et un lien **FIFA**.

## Sources

| Source | Rôle |
|--------|------|
| [worldcup26.ir](https://worldcup26.ir/get/games) | API open source [rezarahiminia/worldcup2026](https://github.com/rezarahiminia/worldcup2026) — scores live, buteurs |
| **Supabase `live-scores`** | Proxy CORS (obligatoire depuis GitHub Pages) |
| `data/resultats.json` | Scores concours (prioritaires si saisis) |
| [FIFA.com](https://www.fifa.com/fr/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures) | Référence officielle |

## Déploiement Supabase (obligatoire)

L’API worldcup26 **bloque le CORS** depuis lespainssuces.github.io.  
Il faut redéployer la fonction proxy :

1. [supabase.com/dashboard](https://supabase.com/dashboard) → projet `qpkiwausbvedzmovfvxe`
2. **Edge Functions** → **`live-scores`** → coller `supabase/functions/live-scores/index.ts`
3. **Deploy** · **Verify JWT = OFF**
4. Plus besoin de `APIFOOTBALL_KEY` (secret supprimable)

Test : `https://qpkiwausbvedzmovfvxe.supabase.co/functions/v1/live-scores`  
→ `"fixtures"` avec Mexique – Afrique du Sud si match en cours.

Import organisateur (48 h, poules vides) :  
`…/live-scores?window=48h` → matchs poules **terminés ou live** des **48 dernières heures**.

Import affrontements / scores KO :  
`…/live-scores?scope=knockout` → tous les matchs M73–M104 avec équipes confirmées FIFA.

**Redéployez** `live-scores` après toute mise à jour de `index.ts`.

## Fichiers site

- `js/worldcup26-api.js` — fetch proxy + retry (widget + organisateur)
- `js/live-scores.js` — refresh **2 min**, messages d’erreur explicites
- `js/config.js` — `supabaseUrl` + `supabaseAnonKey` (déjà configurés)

## Organisateur — import live

Onglet **Poules** → **Importer scores du jour (live)** :
- Fenêtre **48 h** (terminés + en cours)
- Seulement les champs poules **encore vides**
- Vérifiez puis **Publier resultats.json**

Onglet **Phase finale — tableau** → **Importer affrontements FIFA** :
- Source worldcup26 (M73–M104, équipes confirmées uniquement)
- Seulement les affrontements **encore vides**
- Publiez + **étape 3** pour que les joueurs pronostiquent les seizièmes

Onglet **Phase finale — scores** → **Importer scores KO (live)** :
- Matchs KO terminés ou en cours, scores vides uniquement
- Complète aussi le tableau si une équipe manquait
