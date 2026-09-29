# ADR 002 — Prisma et PostgreSQL, schéma par migrations versionnées

- Status: accepted
- Date: 2026-09-29
- Scope: framing

## Context
Les données (boutiques, commandes, appels) sont relationnelles et vont évoluer à chaque story.

## Decision
PostgreSQL 16 via Prisma 6. Toute évolution du schéma passe par une migration Prisma versionnée
dans `backend/prisma/migrations/`, appliquée par `prisma migrate deploy` au démarrage du
conteneur. `prisma migrate reset` est interdit sur une base qui contient des données.

## Considered options
- TypeORM — rejeté : remplacé par Prisma lors de l'intégration (schéma lisible, client typé).
- Drizzle — rejeté : impliquerait de réécrire l'accès aux données existant.

## Consequences
Une story qui change le schéma inclut sa migration (et un backfill si des lignes existent).
Le seed de démo (`prisma/seed.ts`) suit les évolutions du schéma.
