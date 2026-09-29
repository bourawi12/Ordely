# ADR 006 — Le fournisseur vocal est derrière une interface

- Status: accepted
- Date: 2026-09-29
- Scope: framing

## Context
Les appels passent par un fournisseur externe (PRD) qui n'est pas encore choisi ; il doit gérer le
darija et les numéros +216, et les tests ne peuvent pas passer de vrais appels.

## Decision
Le backend parle au fournisseur via une interface unique (passer un appel, lire un événement de fin
d'appel). Un fournisseur simulé l'implémente pour le développement et les tests. Le choix du
fournisseur réel fera l'objet de son propre ADR dans la story s07.

## Considered options
- Coder directement contre un fournisseur — rejeté : verrouille le choix avant de l'avoir comparé.
- Choisir le fournisseur maintenant — rejeté : pas assez d'éléments (qualité darija, coût).

## Consequences
Les tests restent déterministes. Changer de fournisseur ne touche qu'une implémentation.
