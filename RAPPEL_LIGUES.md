# Rappel — CDM 2026 (ligues + invitations)

## Liens à envoyer sur WhatsApp (un groupe = un lien)

Base : `https://lespainssuces.github.io/CDM/`

| Ligue | Lien complet |
|--------|----------------|
| **Pains sucés** (grille) | https://lespainssuces.github.io/CDM/?ligue=pains-suces&invite=painssuces26 |
| **Pains sucés** (classement) | https://lespainssuces.github.io/CDM/classement.html?ligue=pains-suces&invite=painssuces26 |
| **Peuple** (grille) | https://lespainssuces.github.io/CDM/?ligue=peuple&invite=peuple26 |
| **Peuple** (classement) | https://lespainssuces.github.io/CDM/classement.html?ligue=peuple&invite=peuple26 |
| **Compet 1** (grille) | https://lespainssuces.github.io/CDM/?ligue=compet1&invite=compet1-26 |
| **Compet 1** (classement) | https://lespainssuces.github.io/CDM/classement.html?ligue=compet1&invite=compet1-26 |
| **Compet 2** (grille) | https://lespainssuces.github.io/CDM/?ligue=compet2&invite=compet2-26 |
| **Compet 2** (classement) | https://lespainssuces.github.io/CDM/classement.html?ligue=compet2&invite=compet2-26 |

## Règles

- **Sans le bon lien** → impossible de **créer** une nouvelle grille (4 ligues fermées).
- **Déjà inscrit** dans une ligue → peut se reconnecter avec son mail + code **sans** refaire le lien.
- **Même e-mail, plusieurs ligues** → une grille par ligue ; dupliquer en SQL si besoin (voir plus bas).
- Lien « nu » `…/CDM/` = Pains sucés **mais** inscription bloquée sans `invite=painssuces26`.

## Codes d’invitation (si vous changez un code)

Modifier **les deux** :
1. `js/leagues.js` → `invite` dans `LEAGUES`
2. Supabase → `scripts/supabase_league_invites.sql` → fonction `check_league_invite`

Puis exécuter le SQL dans Supabase et push le site.

## Supabase — SQL à exécuter (ordre)

1. `scripts/supabase_leagues.sql` (déjà fait)
2. **`scripts/supabase_league_invites.sql`** ← nouveau (à lancer une fois)

## Dupliquer une grille vers une autre ligue (sans JSON)

```sql
insert into public.grilles (email, prenom, nom, equipe, payload, code_hash, league_id, updated_at)
select email, prenom, nom, equipe, payload, code_hash, 'compet1', now()
from public.grilles
where email = 'joueur@mail.com' and league_id = 'pains-suces';
```

Plusieurs joueurs : `and email in ('a@mail.com', 'b@mail.com')`.

## Vérifications SQL

```sql
select league_id, count(*) from public.grilles group by league_id;
```

```sql
select email, league_id from public.grilles where email = 'joueur@mail.com' order by league_id;
```
