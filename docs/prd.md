# PRD — Ordely

## Target SaaS
La confirmation manuelle des commandes COD : télé-opérateurs internes et centres d'appels de
confirmation, qui appellent chaque client par téléphone avant l'expédition (processus AS-IS du
dossier d'analyse). Pas un SaaS unique avec une URL : c'est une pratique, outillée par le
téléphone, le back-office e-commerce et des fichiers Excel.

## Kill mode
**Produit concurrent** : Ordely est vendu aux boutiques COD tunisiennes. Le produit est donc
multi-boutiques, avec création de compte, essai gratuit et configuration par la boutique
elle-même, sans intervention de notre équipe.

## Why kill it
- **Délais → retours COD** : le temps écoulé entre la commande et la confirmation réelle
  augmente les annulations et les colis refusés à la livraison.
- **Coût et pics** : une équipe de télé-opérateurs coûte cher et ne suit pas les pics de
  commandes (le soir, après une publicité) ; un appel dure 2 à 4 minutes, ce qui plafonne le
  volume traitable par jour.

Ce dont on n'a pas besoin de la pratique actuelle : la modification de commande au téléphone,
la coordination stock / fournisseurs / livreurs, la ressaisie dans un ERP/CRM (voir le cimetière).

## Problem
Les boutiques tunisiennes en paiement à la livraison doivent confirmer par téléphone la
quasi-totalité de leurs commandes avant expédition. Fait à la main, c'est lent et coûteux : les
commandes attendent, surtout aux heures de pointe, et chaque commande confirmée trop tard
risque de devenir un colis refusé. Un agent vocal IA peut appeler chaque client dès que la
commande arrive, en tunisien, et enregistrer le résultat sans intervention humaine.

## Target users
- **Segment prioritaire** : petites et moyennes boutiques tunisiennes en paiement à la
  livraison, environ 40 à 120 commandes par jour, qui vendent sur Facebook, Instagram et un
  site e-commerce, avec 1 à 3 confirmatrices (persona Salma du dossier d'analyse). Elles
  utilisent Ordely : configuration, lancement des appels, lecture des résultats.
- **Clients finaux** : les acheteurs de ces boutiques (persona Mariem), qui reçoivent l'appel
  de l'agent et confirment ou annulent leur commande. Ils n'ont pas de compte Ordely.

## Perimeter — the 20% that matters
### Replicated (core loop)
| Feature | Complexity (1-5) | Why this score |
|---|---|---|
| Préparer et lancer l'appel automatiquement (US10–US11) | 5 | Fournisseur de téléphonie externe, file d'appels, appels en temps réel — gardé : c'est la valeur centrale |
| Conversation IA : identifier la commande, la présenter, confirmer ou annuler, en tunisien / français (US12–US16) | 5 | Agent vocal IA externe, temps réel, qualité du darija — gardé : c'est la valeur centrale |
| Comprendre la réponse et demander une clarification si elle est ambiguë (US17–US18) | 4 | Classification du résultat par l'IA, cas limites |
| Appels sans réponse et appels échoués (US19–US20) | 3 | Plusieurs états, relances |
| Mettre à jour le statut de la commande et enregistrer le résultat de l'appel (US21–US22) | 3 | Transitions de statut ; le modèle commande / appel existe déjà |

Support (dans le produit, hors cœur) :

| Feature | Complexity (1-5) | Why this score |
|---|---|---|
| Création de compte et connexion (US01–US02) | 2 | Déjà construits |
| Essai gratuit (US03) | 3 | Quota, expiration, blocage à la fin de l'essai |
| Informations entreprise et coordonnées (US04, US06) | 2 | Formulaire et persistance |
| Personnalisation et paramètres de l'agent (US05, US29) | 3 | Script, langue, voix, horaires utilisés pendant l'appel |
| Gestion du profil (US30) | 2 | Formulaire et persistance |

Scale: 1 trivial CRUD · 2 form + persistence + list · 3 business logic / several states · 4 integrations, payments, roles · 5 real-time, migrations, external systems. A 5 is a graveyard candidate — keep it only if it IS the core value.

### Explicitly NOT replicated (graveyard)
- **Modification de la commande pendant l'appel** : adresse, taille, quantité (déjà exclu du MVP
  dans le dossier d'analyse).
- **Stock, fournisseurs et livreurs** : réservation de stock, appels de réapprovisionnement,
  ordres de livraison (étape 6 de l'AS-IS).
- **Synchronisation ERP / CRM** : Salesforce, HubSpot, SAP ou ERP du vendeur.
- **Notifications** (US28).
- **Connexion à la base de commandes de la boutique** (US07–US09) : pas de connecteur. Les
  commandes arrivent par la saisie manuelle et l'API existantes (`POST /api/orders`).
- **Nouveau travail sur le suivi** (US23–US27) : l'existant (tableau de bord, journal d'appels,
  historiques, détail d'une commande) reste tel quel, figé ; aucune nouvelle story dessus.

### The angle (done differently / better)
- **Vitesse et pics** : chaque commande est appelée quelques minutes après son arrivée, y
  compris le soir et après une publicité, sans limite de lignes — là où une équipe humaine
  laisse les commandes attendre.
- **Darija naturel** : l'agent parle tunisien, français ou anglais selon le client, y compris
  le mélange darija / français, comme le ferait une confirmatrice locale.

## Constraints
- **Stack existante** : on construit sur NestJS + Prisma + PostgreSQL, Next.js et Docker
  Compose déjà en place ; pas de réécriture.
- **Fournisseur vocal externe** : la voix et la téléphonie passent par un fournisseur externe
  (Retell AI, Twilio ou équivalent), pas encore choisi ; il doit gérer le darija et les numéros
  tunisiens (+216).
- **Horaires et consentement** : appels uniquement pendant des heures raisonnables à l'heure de
  Tunis, annonce au client qu'il s'agit d'un appel automatisé, données des clients protégées
  (INPDP).

## Success criteria
Parité sur le périmètre :
- [ ] 100 % des commandes appelées se terminent avec un résultat enregistré (confirmée,
      annulée, sans réponse ou échec) et le statut de commande correspondant, sans ressaisie
      manuelle.
- [ ] Les commandes sans réponse sont relancées selon les paramètres, puis marquées à traiter.
- [ ] Une boutique crée son compte, configure son agent et reçoit un appel test sans aide.

L'angle :
- [ ] **Vitesse** : pendant les heures d'appel, le premier appel part moins de 5 minutes après
      l'arrivée de la commande.
- [ ] **Pics** : 60 commandes arrivées en une heure sont toutes appelées dans les 30 minutes.
- [ ] **Darija** : sur un jeu de 50 scénarios darija / français enregistrés, au moins 90 % des
      décisions sont correctement classées, et l'agent demande une clarification quand la
      réponse est ambiguë.
