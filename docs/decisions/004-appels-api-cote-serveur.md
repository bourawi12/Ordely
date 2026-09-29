# ADR 004 — Le frontend appelle l'API uniquement côté serveur

- Status: accepted
- Date: 2026-09-29
- Scope: framing

## Context
Le jeton de session doit rester hors de portée du JavaScript du navigateur.

## Decision
Les pages sont des server components qui passent par `frontend/src/lib/api.ts` (`server-only`) ;
les écritures passent par des server actions. Le navigateur ne contacte jamais l'API directement
et l'API ne sert pas de CORS au navigateur en pratique.

## Considered options
- Appels `fetch` depuis le navigateur avec le jeton — rejeté : exposerait le jeton au JS.
- Route handlers Next servant de proxy générique — rejeté : doublonne les server actions.

## Consequences
Un 401 de l'API redirige vers `/login?expired=1`. Les server actions qui attrapent des erreurs
doivent laisser passer les redirections (`unstable_rethrow`).
