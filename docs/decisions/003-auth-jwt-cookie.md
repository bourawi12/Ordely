# ADR 003 — Authentification JWT émise par l'API, cookie HttpOnly côté Next

- Status: accepted
- Date: 2026-09-29
- Scope: framing

## Context
Le produit est multi-boutiques et vendu ; il faut des comptes, une session sûre et une API
protégée par défaut.

## Decision
L'API émet un JWT (`JWT_SECRET`, `JWT_EXPIRES_IN`) après inscription ou connexion (bcrypt).
Un `AuthGuard` global protège toutes les routes sauf celles marquées `@Public()`. Le frontend
stocke le jeton dans le cookie HttpOnly `ordely_session` et le transmet en `Bearer`.

## Considered options
- Better Auth / NextAuth — rejeté : l'auth vit dans l'API NestJS, pas dans Next.
- Sessions serveur en base — rejeté pour le MVP : plus de stockage, aucun besoin actuel de
  révocation fine.

## Consequences
Pas de révocation immédiate d'un jeton avant expiration. Tout nouvel endpoint est privé par
défaut ; rendre un endpoint public est une décision explicite.
