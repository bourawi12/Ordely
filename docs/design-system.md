# Design System — Ordely

Sources : l'identité visuelle Ordely (planche de marque : Bleu Ordely #1E63FF, Bleu foncé #0B1F44,
Bleu clair #E8F1FF, Gris clair #F5F7FB, Montserrat pour les titres, Inter pour les textes) et le
système déjà en place dans le frontend (`frontend/src/app/globals.css`,
`frontend/src/components/app/ui.module.css`, `frontend/src/app/(auth)/auth.module.css`).
Ce document décrit ce système ; il n'en invente pas.

Trois univers partagent la marque :
- **Application** (`(app)`, sous `AppShell`) : jetons de `globals.css`, clair et sombre.
- **Pages d'authentification et d'onboarding** (`(auth)`) : palette de marque fixe, clair uniquement.
- **Landing** (`(marketing)`) : `landing.module.css`, clair uniquement, animations.

## Tokens
- Colors — application (`globals.css`, clair / sombre) :

  | Jeton | Clair | Sombre | Usage |
  |---|---|---|---|
  | `--bg` | #f5f7fb | #0a1428 | Fond du document |
  | `--app-bg` | #f8f9fb | #0a1428 | Surfaces secondaires (en-têtes de tableau, survols) |
  | `--surface` | #ffffff | #0f1f3d | Cartes, barre latérale, fond du contenu |
  | `--text` | #0b1f44 | #ededf0 | Texte principal |
  | `--muted` | #6b6b76 | #9a9aa5 | Texte secondaire, libellés |
  | `--border` | #e3e9f4 | #1d3260 | Bordures, séparateurs |
  | `--accent` | #1e63ff | #5b8cff | Actions principales, liens |
  | `--accent-text` | #ffffff | #0a1428 | Texte sur `--accent` |
  | `--accent-soft` | #edf2ff | #15295a | Fonds de pastille, bouton doux, élément de menu actif |
  | `--accent-on-soft` | **#1450d6** | **#7ea6ff** | **Nouveau** — texte posé sur `--accent-soft` |
  | `--success-bg` / `--success-text` | #dcfce7 / #166534 | #14532d / #bbf7d0 | Badge « Confirmed » |
  | `--pending-bg` / `--pending-text` | #fef3c7 / #92400e | #78350f / #fde68a | Badge « Pending » |
  | `--fail-bg` / `--fail-text` | #fdecec / #c62828 | #4c1414 / #fca5a5 | Badges « Failed » / « Cancelled », erreurs |
  | `--neutral-bg` / `--neutral-text` | #eef0f3 / #5b6472 | #1f2b44 / #a9b4c8 | Badge « No-answer », compteurs |
  | `--danger` | #dc2626 | #f87171 | Actions destructrices |
  | `--positive` | **#15803d** (était #16a34a) | #4ade80 | Variation favorable |
  | `--negative` | #dc2626 | #f87171 | Variation défavorable |
  | `--track` | #eef3fd | #14254a | Piste des barres de graphique |

- Colors — pages d'authentification / onboarding (`auth.module.css`, clair uniquement) :
  `--blue` #1e63ff, `--navy` #0b1f44, `--sky` #e8f1ff, `--ink-soft` #4a5a7a, `--line` #dde6f5,
  fond #f5f7fb avec deux halos bleus radiaux ; message d'information : texte **#1450d6** (était
  #1e63ff) sur `--sky` ; message d'erreur : #b42318 sur #fdecec.
- Typography : titres en **Montserrat** 600–800 (`--font-montserrat`), texte en **Inter**
  (`--font-inter`), chargées par `next/font` dans `app/layout.tsx`. Échelle observée dans
  l'application : titre de page 1,6rem (600), titre de carte 1,2rem (600), texte 0,95–1rem,
  libellés 0,82–0,9rem en capitales espacées (`letter-spacing` 0,03–0,04em), chiffres clés
  2,5rem Montserrat 700 avec `tabular-nums`.
- Spacing / radius : espacements en rem par pas de 0,25 (0,5 · 0,75 · 1 · 1,25 · 1,5 · 1,75 ·
  2 · 2,5) ; rayons 6–8px (badges, pastilles), 9–10px (boutons, champs), 12px (menus),
  16px (cartes de l'app), 20px (carte d'authentification) ; bouton rond / puce 999px. Barre
  latérale 280px (88px repliée), en-tête 88px de haut.

## Available components
| Component | Usage |
|---|---|
| `AppShell` (`components/app/AppShell.tsx`) | Mise en page de toute page connectée : barre latérale repliable, en-tête avec titre, cloche, menu utilisateur. Ne pas l'utiliser pour l'onboarding. |
| `ui.card` / `ui.cardPad` / `ui.cardHead` / `ui.cardTitle` | Conteneur de section avec bordure 1px, rayon 16px. |
| `ui.btn` | Action principale (fond accent). Une seule par zone. |
| `ui.btnSoft` | Action secondaire dans une liste (« Call now »). Texte en `--accent-on-soft`. |
| `ui.btnGhost` | Action neutre avec bordure (Export, Cancel, Log out). |
| `ui.table` / `ui.tableWrap` | Tableau de données, en-têtes en capitales, défilement horizontal propre. |
| `StatusBadge` (`components/StatusBadge.tsx`) | Statut d'appel ou de commande (confirmed, pending, failed, no_answer, cancelled). |
| `ui.pill` | Étiquette informative (« Last 7 days »). |
| `ui.field` + `ui.input` | Champ de formulaire de l'app : libellé au-dessus, champ pleine largeur. |
| `ui.error` | Message d'erreur sous un champ ou un formulaire. |
| `ui.empty` | État vide d'une liste. |
| `Icon` (`components/Icon.tsx`) | Icônes au trait (Lucide) : utiliser les noms existants ; en ajouter un = compléter ce composant. |
| `Logo` (`components/Logo.tsx`) | Mot-symbole ordely avec le sourire. |
| `ComingSoon` (`components/app/ComingSoon.tsx`) | Page d'une section pas encore disponible. |
| `CallNowButton` / `CallAllPendingButton` | Mise en file d'appels, avec état « Queued » / message. |
| Page d'auth : `auth.page` / `auth.panel` / `auth.card` / `auth.form` / `auth.submit` / `auth.error` / `auth.notice` | Écrans hors application (connexion, inscription, **onboarding**) : carte centrée, logo au-dessus, formulaire vertical, bouton pleine largeur. |
| `AuthForm` (`components/AuthForm.tsx`) | Formulaire connexion / inscription avec `useActionState`. |

## UI patterns
- Forms : libellé au-dessus du champ ; validation côté serveur (DTO de l'API) affichée via
  `useActionState` ; les valeurs saisies sont renvoyées dans l'état pour ne rien perdre en cas
  d'erreur ; bouton désactivé avec libellé « …ing » pendant l'envoi. Formulaires hors application :
  style `auth.form` (champs 0,7rem de marge interne, rayon 10px, halo de focus bleu).
- States (empty / loading / error / success) : vide → `ui.empty` avec une phrase utile ;
  chargement → pages rendues côté serveur, pas de squelettes ; erreur de page → `error.tsx` de la
  route ; succès d'une action → bouton qui change d'état (« Queued ») ou message court à côté.
- Feedback (toast, inline) : pas de toast. Retour en ligne : `ui.error` / `auth.error` (fond
  `--fail-bg`) pour les erreurs, `auth.notice` pour l'information, `role="alert"` / `role="status"`.
- Filtres et pagination : état dans l'URL (voir le journal d'appels), liens plutôt que boutons.
- Dates et montants : `lib/format.ts` (heure de Tunis, TND).

## Do / Don't
- ✅ Construire l'app avec `ui.module.css` et les jetons de `globals.css` ; les écrans hors app
  (onboarding compris) avec `auth.module.css`.
- ✅ Texte posé sur `--accent-soft` → `--accent-on-soft`, jamais `--accent`.
- ✅ Vérifier chaque écran en clair et en sombre (l'app) et à 390px de large.
- ✅ Une action principale (`ui.btn`) par zone ; les autres en `btnSoft` / `btnGhost`.
- ❌ Pas de Tailwind, pas de couleurs en dur dans les composants, pas de nouveau jeton sans passer
  par ce document.
- ❌ Pas de nouveau composant « maison » quand un bloc existant couvre le besoin ; un besoin non
  couvert est un manque à signaler.
- ❌ Ne pas utiliser `AppShell` pour un écran que l'utilisateur doit terminer avant d'accéder à
  l'app (onboarding).

## Contrastes mesurés (WCAG, texte normal ≥ 4,5:1)
Mesurés une seule fois ici ; les phases suivantes ne remesurent pas.

| Texte / fond | Clair | Sombre |
|---|---|---|
| `--text` / `--surface` · `--app-bg` · `--bg` | 16,23 · 15,41 · 15,13 | 14,00 · 15,72 · 15,72 |
| `--muted` / `--surface` · `--app-bg` · `--accent-soft` | 5,26 · 5,00 · 4,70 | 5,87 · 6,59 · 5,04 |
| `--accent` / `--surface` · `--app-bg` | 4,90 · 4,65 | 5,17 · 5,81 |
| `--accent-text` / `--accent` | 4,90 | 5,81 |
| `--accent-on-soft` / `--accent-soft` (nouveau) | 5,95 | 5,87 |
| ~~`--accent` / `--accent-soft`~~ (ancien usage) | ~~4,38~~ échec | ~~4,44~~ échec |
| `--success-text` / `--success-bg` | 6,49 | 7,52 |
| `--pending-text` / `--pending-bg` | 6,37 | 7,28 |
| `--fail-text` / `--fail-bg` · `--surface` | 4,92 · 5,62 | 7,81 · 8,62 |
| `--neutral-text` / `--neutral-bg` | 5,24 | 6,76 |
| `--danger` · `--negative` / `--surface` | 4,83 | 5,91 |
| `--positive` / `--surface` (#15803d) | 5,02 (ancien #16a34a : 3,30, échec) | 9,39 |
| Auth : navy / blanc · ink-soft / blanc · ink-soft / fond | 16,23 · 6,92 · 6,45 | — |
| Auth : erreur #b42318 / #fdecec · bouton blanc / bleu | 5,76 · 4,90 | — |
| Auth : notice #1450d6 / `--sky` (ancien #1e63ff : 4,31, échec) | 5,86 | — |

### Corrections de jetons à reporter dans le code
Trois couples échouaient ; la correction est dans les jetons, pas au cas par cas :
1. Ajouter `--accent-on-soft` (#1450d6 / #7ea6ff) dans `globals.css` et l'utiliser pour le texte de
   `ui.btnSoft`, `ui.pill`, l'élément actif du menu (`shell.module.css`) et le plan de la barre
   latérale.
2. `--positive` clair : #16a34a → #15803d.
3. `auth.module.css` : texte de `.notice` #1e63ff → #1450d6.

Ces trois changements sont purement visuels (couleurs) : ils relèvent du mode Quick Fix, sur la
branche `dev`, à la demande explicite de l'utilisateur.
