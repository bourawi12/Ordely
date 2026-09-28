# User Stories — Ordely

> One story = one shippable slice, written to be executed by an agent.
> Id format: `s<number>-<short-slug>` — reused in every pipeline file and in the branch name.

Source : `docs/prd.md` et les user stories US01–US30 du dossier d'analyse. US01 (création de
compte) et US02 (connexion) sont déjà construites (`backend/src/auth/`, `frontend/src/app/(auth)/`)
et ne deviennent pas des stories. Le suivi (US23–US27) est figé tel quel et les éléments du
cimetière (US07–US09, US28, modification de commande, stock, ERP/CRM) ne deviennent pas des
stories. Les deux fonctionnalités notées 5 dans le PRD (US10–US11, US12–US16) sont découpées
ici en stories de complexité 4 au plus.

Cible (« target as spec ») : la confirmation manuelle décrite dans le processus AS-IS du dossier
d'analyse. Chaque story indique l'étape AS-IS qu'elle remplace.

Ordre = ordre de dépendance.

---

## Story s01-boutique-privee — Espace privé par boutique
**As a** commerçant **I want** que mes commandes, mes appels et mes réglages soient visibles par moi seul **so that** les données de mes clients restent privées sur une plateforme partagée par plusieurs boutiques.

### Complexity
4 — migration de données et règle d'autorisation transversale.

### Acceptance criteria
- [ ] À l'inscription, le commerçant saisit le nom de sa boutique ; un compte, une boutique et le lien entre les deux sont créés ensemble, ou rien n'est créé.
- [ ] Chaque commande et chaque appel appartient à exactement une boutique.
- [ ] Un commerçant de la boutique A qui demande une commande ou un appel de la boutique B reçoit 404, dans l'API comme dans l'interface.
- [ ] Les listes, le tableau de bord, l'export CSV et l'usage ne comptent que les données de la boutique du commerçant connecté.
- [ ] Les commandes et appels existants sont rattachés à une boutique par défaut par la migration, sans perte.

### Dependencies
Aucune (US01–US02 déjà construites).

### Agentic notes
- Risque (4) : une requête oubliée fuit les données d'une autre boutique. Toutes les requêtes Prisma de `backend/src/orders/`, `backend/src/calls/`, `backend/src/dashboard/` doivent être filtrées ; envisager une extension du client Prisma qui l'impose. Tester chaque endpoint en isolation croisée.
- Schéma : `backend/prisma/schema.prisma` (modèles `Order`, `Call`, `User`). Migration Prisma avec backfill ; ne jamais lancer `prisma migrate reset` sur la base de dev.
- L'identifiant de boutique se résout dans `backend/src/auth/auth.guard.ts` (payload JWT `sub`).
- Le formulaire d'inscription est `frontend/src/components/AuthForm.tsx` ; l'action `register` est dans `frontend/src/app/(auth)/actions.ts`.
- `prisma/seed.ts` doit créer une boutique de démo.

---

## Story s02-infos-entreprise — Informations de l'entreprise et coordonnées
**As a** commerçant **I want** renseigner le nom commercial, le secteur et les coordonnées de ma boutique **so that** l'agent se présente au nom de ma boutique et donne les bonnes coordonnées aux clients (US04, US06).

### Complexity
2 — formulaire et persistance.

### Acceptance criteria
- [ ] Le commerçant enregistre le nom commercial, le secteur d'activité et un numéro de contact de la boutique ; les valeurs sont relues à l'identique après rechargement.
- [ ] Un numéro de contact invalide est refusé avec un message sur le champ, sans rien enregistrer.
- [ ] Ces informations sont rattachées à la boutique du commerçant connecté et invisibles pour les autres boutiques.

### Dependencies
s01-boutique-privee.

### Agentic notes
- Page existante à étendre : `frontend/src/app/(app)/settings/page.tsx` (lecture seule aujourd'hui).
- Validation du téléphone : même règle que `backend/src/orders/dto/create-order.dto.ts` (`phone`).
- Équivalent AS-IS : l'opérateur se présente oralement au nom de la boutique.

---

## Story s03-profil — Gestion du profil
**As a** commerçant **I want** modifier mon nom et mon mot de passe **so that** mes informations personnelles restent à jour (US30).

### Complexity
2 — formulaire et persistance.

### Acceptance criteria
- [ ] Le commerçant modifie son nom ; le nouveau nom apparaît dans l'en-tête de l'application.
- [ ] Le changement de mot de passe exige le mot de passe actuel ; un mot de passe actuel faux est refusé sans rien modifier.
- [ ] Le nouveau mot de passe respecte les règles de l'inscription (8 à 72 caractères) et permet ensuite de se connecter ; l'ancien ne fonctionne plus.

### Dependencies
s01-boutique-privee.

### Agentic notes
- Auth : `backend/src/auth/auth.service.ts` (bcrypt, `BCRYPT_ROUNDS`), DTO de référence `register.dto.ts`.
- Le nom affiché vient de `/auth/me` dans `frontend/src/app/(app)/layout.tsx` → `AppShell`.

---

## Story s04-parametres-agent — Personnalisation et paramètres de l'agent
**As a** commerçant **I want** choisir la langue par défaut, la voix, le message d'accueil, les heures d'appel et le nombre maximal de tentatives de l'agent **so that** il communique et appelle comme je le souhaite (US05, US29).

### Complexity
3 — plusieurs réglages avec règles de validation, consommés par les stories d'appel.

### Acceptance criteria
- [ ] Le commerçant enregistre : langue par défaut (tunisien, français, anglais), voix, message d'accueil, plage horaire d'appel, jours sans appel, nombre maximal de tentatives, délai entre tentatives.
- [ ] Une nouvelle boutique a des valeurs par défaut utilisables sans rien configurer.
- [ ] Une plage horaire de moins d'une heure, ou un nombre de tentatives hors de 1 à 5, est refusé avec un message clair.
- [ ] Les heures sont interprétées à l'heure de Tunis (Africa/Tunis).

### Dependencies
s01-boutique-privee.

### Agentic notes
- Nouvelle page de réglages dans le shell existant (`frontend/src/components/app/AppShell.tsx`, entrée « Settings »).
- Fuseau : réutiliser `backend/src/common/time.ts` (`DEFAULT_TIMEZONE`).
- Les listes de voix dépendent du fournisseur vocal (choisi en s07) : stocker un identifiant de voix libre, validé plus tard.

---

## Story s05-essai-gratuit — Essai gratuit
**As a** commerçant **I want** essayer gratuitement Ordely avec un quota d'appels limité **so that** j'évalue la solution avant de m'engager (US03).

### Complexity
3 — quota, expiration et blocage.

### Acceptance criteria
- [ ] Une nouvelle boutique démarre en essai avec un quota d'appels et une durée, tous deux configurables par variable d'environnement.
- [ ] L'application affiche les appels restants et la date de fin de l'essai.
- [ ] Quand le quota est atteint ou l'essai expiré, toute nouvelle mise en file d'appel est refusée avec un message qui l'explique ; les données restent consultables.

### Dependencies
s01-boutique-privee.

### Agentic notes
- Le widget de l'offre existe déjà dans la barre latérale (`AppShell.tsx`) et lit `GET /api/calls/usage` (`CallsService.usage()`, variables `PLAN_NAME` / `PLAN_CALL_LIMIT`) : le transformer en compteur d'essai par boutique.
- Le blocage se fait au point d'entrée unique de mise en file : `CallsService.queue()` et `queueAllPending()`.
- Valeurs du quota et de la durée : à fixer (non tranché dans le PRD) — les laisser configurables.

---

## Story s06-script-appel — Préparation et script de l'appel
**As a** client **I want** que l'agent se présente au nom de la boutique, annonce que l'appel est automatisé, identifie ma commande et me la récapitule **so that** je sais tout de suite de quoi il s'agit et je peux vérifier (US10, US12, US14).

### Complexity
3 — construction du contexte d'appel à partir de la commande, de la boutique et des réglages.

### Acceptance criteria
- [ ] Pour une commande donnée, le script généré contient : le nom commercial de la boutique, l'annonce d'un appel automatisé, le prénom du client, le numéro de commande, les articles et quantités, et le total en TND.
- [ ] Le script est généré dans la langue par défaut de la boutique (tunisien, français ou anglais).
- [ ] Le message d'accueil personnalisé de la boutique est utilisé quand il existe ; sinon un message par défaut.
- [ ] Une commande sans téléphone valide ne produit pas de script et est signalée.

### Dependencies
s02-infos-entreprise, s04-parametres-agent.

### Agentic notes
- Données : `Order` (`customer`, `phone`, `item`, `quantity`, `total` en `Decimal`) dans `schema.prisma`.
- L'annonce d'appel automatisé est une contrainte du PRD (consentement) : elle n'est pas désactivable.
- Tester le rendu du script comme une fonction pure, sans fournisseur vocal.
- Équivalent AS-IS : étape 3, l'opérateur lit la fiche commande au client.

---

## Story s07-appel-commande — Passer un vrai appel pour une commande
**As a** commerçant **I want** que « Call now » déclenche réellement un appel de l'agent vers le client **so that** la commande est confirmée sans qu'un opérateur compose le numéro (US11, lancement).

### Complexity
4 — intégration d'un fournisseur de téléphonie externe.

### Acceptance criteria
- [ ] Mettre une commande en file déclenche un appel via le fournisseur vocal avec le script de s06 ; l'identifiant d'appel du fournisseur est enregistré sur l'appel.
- [ ] Hors des heures d'appel de la boutique, l'appel n'est pas passé et reste en attente jusqu'à l'ouverture de la plage.
- [ ] En environnement de développement et de test, un fournisseur simulé remplace le vrai et produit un appel traçable.
- [ ] Une erreur du fournisseur au lancement passe l'appel à l'état « échec » avec la raison enregistrée.

### Dependencies
s06-script-appel.

### Agentic notes
- Risque (4) : le fournisseur n'est pas choisi (contrainte PRD). Première tâche : un ADR `docs/decisions/` comparant au moins deux fournisseurs (darija, numéros +216, latence, coût/min).
- Isoler le fournisseur derrière une interface pour pouvoir en changer ; le fournisseur simulé sert aux tests.
- Point d'entrée existant : `CallsService.queue()` (`backend/src/calls/calls.service.ts`) et le bouton `CallNowButton` (`frontend/src/components/app/CallButtons.tsx`) qui ne font aujourd'hui qu'enregistrer un appel `pending`.
- Ajouter les champs nécessaires au modèle `Call` (identifiant fournisseur, raison d'échec) par migration.
- Équivalent AS-IS : étape 3, composition manuelle du numéro.

---

## Story s08-resultat-appel — Confirmation ou annulation par le client
**As a** client **I want** confirmer ou annuler ma commande pendant l'appel, **and as a** commerçant **I want** que ma décision soit comprise et que le statut de la commande soit mis à jour **so that** le résultat est enregistré sans ressaisie (US15, US16, US17, US21, US22).

### Complexity
4 — réception d'événements externes et transitions d'état.

### Acceptance criteria
- [ ] À la fin d'un appel où le client confirme, l'appel passe à « confirmé » et la commande à « confirmée ».
- [ ] À la fin d'un appel où le client annule, l'appel enregistre le résultat « annulée » (distinct d'un échec technique) et la commande passe à « annulée ».
- [ ] La durée, la langue détectée et la transcription de l'appel sont enregistrées.
- [ ] Un événement de fin d'appel reçu deux fois ne modifie la commande qu'une fois.
- [ ] Un événement dont la signature du fournisseur est invalide est rejeté sans rien modifier.

### Dependencies
s07-appel-commande.

### Agentic notes
- Risque (4) : endpoint public appelé par le fournisseur → vérification de signature obligatoire, idempotence sur l'identifiant d'appel.
- Mettre à jour `Call` et `Order` dans une même transaction Prisma.
- Les statuts existants : `Order.status` (`pending`, `confirmed`, `cancelled`), `Call.status` (`pending`, `confirmed`, `failed`, `no_answer`) — il manque un résultat d'appel « annulée » : l'ajouter (migration).
- Le journal d'appels et le détail existent déjà (`frontend/src/app/(app)/call-logs/`) : ils affichent le résultat sans nouveau travail d'interface (suivi figé).
- Équivalent AS-IS : étape 5, ressaisie manuelle du résultat.

---

## Story s09-conversation-tunisien — Conversation en tunisien
**As a** client **I want** parler à l'agent en tunisien, mélangé au français si je veux **so that** je comprends la conversation et je réponds naturellement (US13).

### Complexity
4 — qualité d'un modèle vocal externe, mesurée sur un jeu de scénarios.

### Acceptance criteria
- [ ] Un jeu de 50 scénarios de réponses en darija et en français (confirmation, annulation, ambiguïté) est versionné dans le dépôt.
- [ ] Sur ce jeu, au moins 90 % des décisions sont correctement classées (critère de succès du PRD) ; la mesure est une commande reproductible.
- [ ] Si le client répond dans une autre langue que celle de l'accueil, l'agent continue dans la langue du client.

### Dependencies
s08-resultat-appel.

### Agentic notes
- Risque (4) : dépend de la qualité du fournisseur et du modèle ; la mesure doit tourner sur des transcriptions enregistrées, pas sur de vrais appels.
- Le jeu de scénarios sert aussi de non-régression quand le script ou le fournisseur change.

---

## Story s10-reponse-ambigue — Clarification des réponses ambiguës
**As a** commerçant **I want** que l'agent demande une précision quand la réponse du client est ambiguë **so that** aucune commande n'est confirmée ou annulée par erreur (US18).

### Complexity
3 — état supplémentaire dans la conversation et règle de repli.

### Acceptance criteria
- [ ] Une réponse classée ambiguë déclenche une question de clarification et ne modifie pas le statut de la commande.
- [ ] Après deux réponses ambiguës consécutives, l'appel se termine et la commande est marquée « à traiter », sans être confirmée ni annulée.
- [ ] Une réponse claire après une clarification est traitée comme en s08.

### Dependencies
s08-resultat-appel.

### Agentic notes
- Les scénarios ambigus du jeu de s09 couvrent ce cas ; ajouter les cas de répétition.
- « À traiter » : réutiliser le même marqueur que s12 (définir le champ une seule fois).

---

## Story s11-appels-automatiques — Appel automatique des nouvelles commandes
**As a** commerçant **I want** que chaque nouvelle commande soit appelée automatiquement, même en cas de pic **so that** aucune commande n'attend qu'un opérateur soit libre (US11, automatisation).

### Complexity
4 — file de travail, concurrence et horaires.

### Acceptance criteria
- [ ] Pendant les heures d'appel, une nouvelle commande est appelée moins de 5 minutes après sa création.
- [ ] 60 commandes créées en une heure sont toutes appelées dans les 30 minutes.
- [ ] Une commande n'a jamais deux appels actifs en même temps.
- [ ] Les appels en attente survivent à un redémarrage du service.
- [ ] Une commande créée hors des heures d'appel est appelée à l'ouverture de la plage suivante.

### Dependencies
s07-appel-commande.

### Agentic notes
- Risque (4) : ajoute un service de file (ex. Redis) à `docker-compose.yml` et un processus de traitement ; unicité d'un appel actif garantie en base.
- Déclencheurs existants : création de commande (`OrdersService.create`, `POST /api/orders`) et `queueAllPending()`.
- Respecter le quota d'essai de s05 au moment de lancer l'appel.

---

## Story s12-sans-reponse-echecs — Appels sans réponse et appels échoués
**As a** commerçant **I want** que les appels sans réponse soient relancés puis signalés, et que les échecs soient enregistrés avec leur raison **so that** je peux traiter ces commandes plus tard et suivre les problèmes (US19, US20).

### Complexity
3 — plusieurs états et planification des relances.

### Acceptance criteria
- [ ] Un appel sans réponse est enregistré « sans réponse » et une nouvelle tentative est planifiée selon le délai et le nombre maximal de tentatives de la boutique (s04).
- [ ] Aucune relance n'est planifiée hors des heures d'appel.
- [ ] Après la dernière tentative sans réponse, la commande est marquée « à traiter ».
- [ ] Un appel échoué (erreur technique, numéro invalide) est enregistré « échec » avec sa raison et n'est pas relancé automatiquement si la raison est un numéro invalide.

### Dependencies
s04-parametres-agent, s11-appels-automatiques.

### Agentic notes
- Relances : tâches différées dans la file de s11.
- Les statuts `no_answer` et `failed` existent déjà dans `Call.status`.
- Équivalent AS-IS : étape 3, « l'appel doit être replanifié à la main ».

---

## Story s13-appel-test — Appel test sur mon téléphone
**As a** commerçant **I want** recevoir un appel test de l'agent sur mon propre numéro **so that** j'entends mon agent avant qu'il appelle mes clients (critère d'onboarding du PRD).

### Complexity
2 — réutilise l'appel de s07 avec une commande fictive.

### Acceptance criteria
- [ ] Depuis les réglages de l'agent, le commerçant déclenche un appel test vers le numéro de contact de la boutique, avec le script courant et une commande d'exemple.
- [ ] Les appels test n'apparaissent pas dans les statistiques, l'export ni le quota d'essai.
- [ ] Au plus 5 appels test par boutique et par jour ; au-delà, un message l'explique.

### Dependencies
s02-infos-entreprise, s04-parametres-agent, s07-appel-commande.

### Agentic notes
- Marquer l'appel comme test plutôt que créer une fausse commande persistée.
- Exclure les appels test dans `DashboardService` et `CallsService` (liste, export, usage).
