# ADR 001 — L'application existante est la base technique

- Status: accepted
- Date: 2026-09-29
- Scope: framing

## Context
Le PRD impose de construire sur la stack existante. Le dépôt contient déjà une application
fonctionnelle : API NestJS + Prisma + PostgreSQL, frontend Next.js, Docker Compose, authentification
et écrans de suivi.

## Decision
Le code présent dans `backend/` et `frontend/` est le boilerplate du projet. Les stories s'y
conforment (modules NestJS par domaine, App Router Next.js) au lieu d'introduire une autre base.

## Considered options
- Repartir d'un boilerplate (ex. Next.js + Drizzle + Better Auth) — rejeté : casse l'existant
  (auth, suivi, données de démo) et contredit la contrainte « stack existante » du PRD.
- Tout réécrire dans un seul projet Next.js fullstack — rejeté : aucun gain pour le MVP, perte du
  backend testé.

## Consequences
Deux applications à maintenir (API et frontend). Node 18 en local limite les versions (Nest 10,
Next 15) ; les images Docker utilisent Node 22.
