# Scores live (info) — API-Football via Supabase

Le widget sur `classement.html` affiche les **vrais scores FIFA** à titre informatif.  
Il **ne modifie pas** `resultats.json` ni le calcul des points du concours.

> **Sécurité** : la clé API reste **uniquement** côté Supabase (secret serveur).  
> Ne la mettez **jamais** dans `config.js` ni dans GitHub.

## Méthode rapide — Dashboard Supabase (sans CLI)

Projet : `qpkiwausbvedzmovfvxe` → [supabase.com/dashboard](https://supabase.com/dashboard)

### 1. Ajouter le secret

1. **Project Settings** → **Edge Functions** → **Secrets**
2. Nouveau secret :
   - Nom : `APIFOOTBALL_KEY`
   - Valeur : votre clé API-Football
3. Enregistrer

*(Une copie locale existe dans `supabase/.env.local` — fichier gitignored.)*

### 2. Créer / déployer la fonction `live-scores`

1. Menu **Edge Functions** → **Deploy a new function** (ou éditer si déjà créée)
2. Nom : `live-scores`
3. Coller le code de `supabase/functions/live-scores/index.ts`
4. Déployer avec **Verify JWT = OFF** (accès depuis GitHub Pages avec la clé anon)

URL finale :

`https://qpkiwausbvedzmovfvxe.supabase.co/functions/v1/live-scores`

### 3. Tester

Ouvrir dans le navigateur (ou curl) :

```
https://qpkiwausbvedzmovfvxe.supabase.co/functions/v1/live-scores
```

Réponse attendue : JSON `{ "fixtures": [...], "fetchedAt": "..." }`  
Hors CDM : `"fixtures": []` est normal.

Puis ouvrir **classement.html** : bandeau « Scores FIFA (info live) ».

---

## Méthode CLI (optionnelle)

### Compte API-Football

1. [api-football.com](https://www.api-football.com/) — **la CDM 2026 (`season=2026`) n’est pas incluse dans le plan gratuit** (saisons 2022–2024 seulement). Un abonnement payant est requis pendant le tournoi.
2. Vérifier que le compte n’est **pas suspendu** : [dashboard.api-football.com](https://dashboard.api-football.com/) — sinon `fixtures: []` sans erreur visible côté widget (avant correctif) ou message « compte suspendu ».
3. Mettre à jour le secret `APIFOOTBALL_KEY` dans Supabase après renouvellement / changement de clé.

### Secret + déploiement

```bash
cd CDM2023PAINSSUCES
supabase link --project-ref qpkiwausbvedzmovfvxe
supabase secrets set --env-file supabase/.env.local
supabase functions deploy live-scores --no-verify-jwt
```

## Config site (optionnel)

Par défaut, `js/live-scores.js` appelle :

`https://<supabaseUrl>/functions/v1/live-scores`

URL custom dans `js/config.js` :

```js
liveScoresUrl: 'https://....supabase.co/functions/v1/live-scores',
```

Refresh automatique widget : **~5 min 30** (juin–juillet 2026 seulement — hors saison, pas d’appel API).
