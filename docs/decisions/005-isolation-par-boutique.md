# ADR 005 — Isolation des boutiques par colonne dans une base partagée

- Status: accepted
- Date: 2026-09-29
- Scope: framing

## Context
Le PRD vise un produit concurrent multi-boutiques : chaque boutique ne doit voir que ses données.

## Decision
Une seule base et un seul schéma ; chaque ligne métier porte l'identifiant de sa boutique, et
chaque requête est filtrée par la boutique de l'utilisateur connecté (mis en place par s01).

## Considered options
- Une base ou un schéma par boutique — rejeté : migrations et exploitation démultipliées pour des
  petites boutiques.
- Row-Level Security PostgreSQL — rejeté pour le MVP : complexifie Prisma et les tests ; à revoir
  si le filtrage applicatif montre ses limites.

## Consequences
Un oubli de filtre fuit des données : chaque endpoint a un test d'isolation croisée, et un
filtrage imposé par une extension Prisma est à préférer au filtrage manuel.
