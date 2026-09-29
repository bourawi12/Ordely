# Architecture — Ordely

Base imposée : l'application déjà présente dans le dépôt (voir ADR 001). Ce document décrit ce
qui existe et fixe les règles que les stories doivent suivre ; il ne propose pas de réécriture.

## Stack
- **Backend** : NestJS 10 (TypeScript), Prisma 6, PostgreSQL 16, JWT (`@nestjs/jwt`), bcryptjs,
  `@nestjs/throttler`, class-validator / class-transformer. Tests : Jest (unitaires `*.spec.ts`
  dans `src/`, e2e `*.e2e-spec.ts` dans `test/`, contre la base de `DATABASE_URL`).
- **Frontend** : Next.js 15 (App Router, React 19, TypeScript strict), CSS Modules + jetons CSS
  dans `globals.css` (pas de Tailwind), polices Montserrat / Inter via `next/font`. Landing :
  three.js + @react-three/fiber.
- **Exécution** : Docker Compose (`db`, `backend`, `frontend`) ; Node 22 dans les images, Node 18
  en local (d'où Nest 10 / Next 15).
- **À venir (stories)** : fournisseur vocal externe (s07, derrière une interface — ADR 006), file de
  travail Redis (s11).

## Repo structure
| Dossier | Rôle |
|---|---|
| `backend/src/<domaine>/` | Un module NestJS par domaine : `auth`, `orders`, `calls`, `dashboard`, `prisma`. Chaque module : `<d>.module.ts`, `<d>.controller.ts`, `<d>.service.ts`, `dto/`, tests `<d>.service.spec.ts`. |
| `backend/src/common/` | Utilitaires partagés sans état (ex. `time.ts`, fuseau Africa/Tunis). |
| `backend/prisma/` | `schema.prisma`, `migrations/` (versionnées), `seed.ts` (données de démo). |
| `backend/test/` | Tests e2e (`app.e2e-spec.ts`). |
| `frontend/src/app/(marketing)/` | Landing publique. |
| `frontend/src/app/(auth)/` | Connexion, inscription ; `actions.ts` (server actions d'auth), `auth.module.css`. |
| `frontend/src/app/(app)/` | Application connectée, sous le shell (`layout.tsx` → `AppShell`) : `dashboard`, `call-logs`, `orders`, `settings`, `analytics`, `integrations`. |
| `frontend/src/components/` | Composants partagés ; `components/app/` pour ceux de l'application (`AppShell`, `ui.module.css`, boutons d'appel). |
| `frontend/src/lib/` | `api.ts` (client HTTP serveur), `session.ts` (cookie), `format.ts` (formatage TND, durées, dates Tunis). |
| `frontend/src/middleware.ts` | Redirige vers `/login` si le cookie de session manque. |
| `docs/` | PRD, stories, architecture, ADR, et fichiers du pipeline par story. |

## Patterns & conventions
Voir « Project conventions » dans `AGENTS.local.md` (source des règles pour les agents). En résumé :
- **API** : préfixe global `/api` ; `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`,
  `transform`) — toute entrée passe par une classe DTO class-validator. Toutes les routes exigent un
  JWT (`AuthGuard` global) sauf celles marquées `@Public()`. Erreurs métier = exceptions Nest
  (`NotFoundException`, `ConflictException`…), jamais de codes d'erreur maison.
- **Données** : accès uniquement via `PrismaService` injecté ; schéma modifié par migration Prisma.
- **Frontend** : les pages sont des server components qui appellent `api.*` (`lib/api.ts`, côté
  serveur uniquement) ; les écritures passent par des server actions dans un `actions.ts` à côté de
  la route, utilisées par des composants client avec `useActionState`. Styles en CSS Modules à partir
  des jetons de `globals.css`.

## Data model
Aujourd'hui (`backend/prisma/schema.prisma`) :
- `User` (id, email unique, name, passwordHash, createdAt).
- `Order` (id, customer, phone, item, quantity, total `Decimal(10,3)` TND, status
  `pending | confirmed | cancelled`, createdAt) — 1 → n `Call`.
- `Call` (id, orderId, status `pending | confirmed | failed | no_answer`, attempt, durationSeconds,
  language, transcript JSON `[{speaker, text}]`, recordingUrl, createdAt).

Évolutions prévues par les stories :
- **s01** : `Boutique` + lien utilisateur ↔ boutique ; `boutiqueId` sur `Order` et `Call`
  (isolation par colonne, ADR 005).
- **s02 / s04** : informations et réglages de la boutique et de l'agent (champs sur la boutique ou
  table de réglages dédiée — décidé en plan).
- **s07 / s08 / s10 / s13** : identifiant fournisseur et raison d'échec, résultat « annulée »,
  marqueur « à traiter », indicateur d'appel test.

## Integration points
- **Auth** : JWT signé par le backend (`JWT_SECRET`, durée `JWT_EXPIRES_IN`), stocké côté Next dans
  le cookie HttpOnly `ordely_session`, envoyé en `Authorization: Bearer` par `lib/api.ts` (ADR 003).
  Inscription / connexion limitées par email (`AuthThrottlerGuard`).
- **Frontend → API** : uniquement côté serveur Next (`BACKEND_URL`), jamais depuis le navigateur
  (ADR 004).
- **Voix / téléphonie** : fournisseur externe à choisir en s07, derrière une interface, avec un
  fournisseur simulé pour le développement et les tests (ADR 006). Événements de fin d'appel reçus
  sur un endpoint public signé (s08).
- **File de travail** : Redis + processus séparé, introduits par s11.
- **Paiement, e-mails, notifications** : hors périmètre du PRD.

## Design / UX
- Deux univers : la landing (`(marketing)`, CSS dédié, animations) et l'application (`(app)`,
  shell avec barre latérale repliable, fond blanc, cartes à bordure).
- Écrans existants : tableau de bord, journal d'appels (filtres dans l'URL, panneau de détail),
  commandes et détail, réglages, connexion / inscription.
- Parcours clés à venir : onboarding de la boutique en 4 écrans juste après l'inscription (s02,
  hors shell, style des pages d'auth) ; réglages de l'agent avec aperçu du script (s04, s06).
- Le design system est capturé par `/ks-design-system` dans `docs/design-system.md`.
