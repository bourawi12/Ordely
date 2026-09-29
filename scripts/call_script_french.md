# 📞 Ordely — Script d'Appel Vocal (Français — Tunisie)

> **Ticket Jira :** ORDELY-49  
> **Version :** 2.0.0  
> **Langue :** Français (Tunisie — `fr-TN`)  
> **Devise :** Dinar tunisien (TND) — 1 TND = 1 000 millimes  
> **Fuseau horaire :** Africa/Tunis (UTC+1)  
> **Dernière mise à jour :** 2026-09-29

---

## Table des matières

1. [Vue d'ensemble du flux](#1-vue-densemble-du-flux)
2. [Phase 1 — Accueil & Présentation de l'IA](#2-phase-1--accueil--présentation-de-lia)
3. [Phase 2 — Divulgation obligatoire d'appel automatisé](#3-phase-2--divulgation-obligatoire-dappel-automatisé)
4. [Phase 3 — Identification de la commande](#4-phase-3--identification-de-la-commande)
5. [Phase 4 — Récapitulatif des articles & montant total](#5-phase-4--récapitulatif-des-articles--montant-total)
6. [Phase 5 — Prochaines étapes & confirmation](#6-phase-5--prochaines-étapes--confirmation)
7. [Cas particuliers & prompts de secours](#7-cas-particuliers--prompts-de-secours)
8. [Variables dynamiques](#8-variables-dynamiques)

---

## 1. Vue d'ensemble du flux

> **Prérequis :** La Phase 0 (sélection de langue) dans `language_selection.md`
> a déjà été complétée. Le client a choisi **le français**.

```
  Phase 0 (langue = français) ✓
               │
               ▼
┌──────────────────────────────────────┐
│  PHASE 1 — Accueil & Présentation   │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  PHASE 2 — Divulgation automatisée  │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  PHASE 3 — Identification commande  │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  PHASE 4 — Récapitulatif articles   │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  PHASE 5 — Confirmation & clôture   │
└──────────────────────────────────────┘
```

---

## 2. Phase 1 — Accueil & Présentation de l'IA

### 2.1 Prompt principal (après sélection du français)

```text
Bonjour, je m'appelle Ordely.

Je vous appelle au nom de {company_name} pour assurer le suivi de votre 
commande récente.
```

**Règles de diffusion :**

| Paramètre | Valeur |
|---|---|
| Débit vocal | 140–160 mots/minute |
| Ton | Professionnel, courtois, neutre |
| Pause post-accueil | 800 ms (laisser le client réagir) |

### 2.2 Variante — Contact personnalisé

Si `{customer_first_name}` est disponible :

```text
Bonjour {customer_first_name}, je m'appelle Ordely.

Je vous appelle au nom de {company_name} à propos de votre commande récente.
```

---

## 3. Phase 2 — Divulgation obligatoire d'appel automatisé

> **⚠️ Obligation réglementaire (Loi organique n° 2004-63 — Protection des 
> données personnelles en Tunisie / INPDP).**  
> Ce bloc **doit** être prononcé avant toute collecte de confirmation verbale.

```text
Je vous informe que cet appel est automatisé et traité par un assistant 
vocal intelligent. Cet échange peut être enregistré à des fins d'assurance 
qualité, conformément à la réglementation en vigueur.

Souhaitez-vous poursuivre ?
```

### 3.1 Réponse attendue

| Intention détectée | Action |
|---|---|
| **Oui / D'accord / Continuez** | → Passer à la Phase 3 |
| **Non / Je refuse** | → Prompt de clôture courtoise (voir §7.4) |
| **Silence (> 5 s)** | → Relance (voir §7.1) |
| **Incompréhension** | → Reformulation (voir §7.2) |

---

## 4. Phase 3 — Identification de la commande

```text
Parfait, merci.

Je vous contacte au sujet de votre commande numéro {order_id}, passée 
le {order_date}.

Est-ce bien votre commande ?
```

### 4.1 Réponse attendue

| Intention détectée | Action |
|---|---|
| **Oui / C'est ça / Exact** | → Passer à la Phase 4 |
| **Non / Ce n'est pas la bonne** | → Prompt de vérification (§7.5) |
| **Silence (> 5 s)** | → Relance (voir §7.1) |

### 4.2 Variante — Commandes multiples

Si le client possède plusieurs commandes récentes (`{pending_orders_count}` > 1) :

```text
Parfait, merci.

Je vois que vous avez {pending_orders_count} commandes récentes. 
Je vous contacte au sujet de la commande numéro {order_id}, passée 
le {order_date}.

Est-ce bien de cette commande dont vous souhaitez le suivi ?
```

---

## 5. Phase 4 — Récapitulatif des articles & montant total

### 5.1 Introduction du récapitulatif

```text
Très bien. Voici le récapitulatif de votre commande :
```

### 5.2 Boucle sur les articles

Pour chaque élément dans `{items}` :

```text
— {item_quantity} fois {item_name}, au prix unitaire de {item_unit_price}.
```

**Exemples rendus (Dinar tunisien) :**

```text
— 3 fois Câble USB-C Premium, au prix unitaire de 35 dinars et 500 millimes.
— 1 fois Adaptateur secteur 65W, au prix unitaire de 89 dinars et 900 millimes.
```

> **Règles de prononciation des prix en Dinars tunisiens (TND) :**  
> - `35.500 TND` → « trente-cinq dinars et cinq cents millimes »  
> - `100.000 TND` → « cent dinars »  
> - `7.250 TND` → « sept dinars et deux cent cinquante millimes »  
> - Les millimes à zéro sont omis à l'oral.  
> - **1 TND = 1 000 millimes** (3 décimales dans le système monétaire).

### 5.3 Annonce du total

```text
Le montant total de votre commande s'élève à {total_price}, 
toutes taxes comprises.
```

### 5.4 Pause de confirmation

```text
Ces informations sont-elles correctes ?
```

| Intention détectée | Action |
|---|---|
| **Oui / C'est correct** | → Passer à la Phase 5 |
| **Non / Il y a une erreur** | → Transfert opérateur (§7.6) |
| **Question sur un article** | → Répétition de l'article concerné |

---

## 6. Phase 5 — Prochaines étapes & confirmation

### 6.1 Confirmation et actions suivantes

```text
Parfait. Votre commande numéro {order_id} est bien confirmée.

{delivery_info_block}

Vous recevrez un e-mail de confirmation à l'adresse {customer_email} 
dans les prochaines minutes.
```

### 6.2 Bloc d'information de livraison (`{delivery_info_block}`)

**Si `{estimated_delivery_date}` est disponible :**

```text
La livraison est prévue pour le {estimated_delivery_date}.
```

**Si non disponible :**

```text
Vous recevrez les informations de livraison par e-mail très prochainement.
```

### 6.3 Clôture

```text
Avez-vous des questions supplémentaires concernant cette commande ?
```

| Intention détectée | Action |
|---|---|
| **Non / C'est tout** | → Prompt de clôture (§6.4) |
| **Oui / J'ai une question** | → Transfert opérateur (§7.6) |

### 6.4 Prompt de clôture finale

```text
Merci pour votre confiance, {customer_first_name}. 

Nous vous souhaitons une excellente journée. Au revoir !
```

**Variante horaire (fuseau Africa/Tunis) :**

| Tranche horaire | Formule |
|---|---|
| 06:00 – 12:00 | « une excellente matinée » |
| 12:00 – 18:00 | « une excellente après-midi » |
| 18:00 – 22:00 | « une excellente soirée » |

---

## 7. Cas particuliers & prompts de secours

### 7.1 Silence prolongé / Pas de réponse

**Après 5 secondes de silence :**

```text
Excusez-moi, êtes-vous toujours en ligne ?
```

**Après 10 secondes supplémentaires :**

```text
Je ne détecte plus de réponse de votre part. 
Je vais mettre fin à l'appel. Vous pouvez nous recontacter au 
{support_phone_number} ou par e-mail à {support_email}. 
Bonne journée.
```

→ **Action :** Fin d'appel + marquage `call_status: "no_response"`.

### 7.2 Incompréhension / Parole non reconnue

```text
Excusez-moi, je n'ai pas bien compris votre réponse.
Pourriez-vous simplement répondre par oui ou par non ?
```

**Après 2 incompréhensions consécutives :**

```text
Je suis désolé, je rencontre des difficultés à comprendre vos réponses. 
Je vais vous transférer vers un conseiller. Veuillez patienter un instant.
```

→ **Action :** Transfert vers `{fallback_operator_queue}`.

### 7.3 Répondeur / Messagerie vocale détectée

```text
Bonjour, ici Ordely pour le compte de {company_name}.

Nous vous avons contacté au sujet de votre commande numéro {order_id}, 
passée le {order_date}, d'un montant de {total_price}.

Pour toute question, vous pouvez nous recontacter au {support_phone_number} 
ou consulter votre espace client en ligne.

Merci et à bientôt.
```

→ **Action :** Fin d'appel + marquage `call_status: "voicemail_left"`.

### 7.4 Refus de poursuivre l'appel

```text
Je comprends tout à fait. 
Je vous rappelle que vous pouvez consulter le détail de votre commande 
dans votre espace client ou nous contacter directement au 
{support_phone_number}.

Bonne journée et au revoir.
```

→ **Action :** Fin d'appel + marquage `call_status: "customer_declined"`.

### 7.5 Mauvaise commande identifiée

```text
Je vous prie de m'excuser pour cette confusion. 
Je vais vous transférer vers un conseiller qui pourra vous aider à 
identifier la bonne commande. Veuillez patienter un instant.
```

→ **Action :** Transfert vers `{fallback_operator_queue}`.

### 7.6 Demande de transfert vers un opérateur humain

**Déclencheurs d'intention :** « parler à quelqu'un », « un humain », « un conseiller », « transfert », « opérateur »

```text
Bien sûr. Je vous transfère immédiatement vers un conseiller disponible. 
Veuillez patienter quelques instants, merci.
```

→ **Action :** Transfert vers `{fallback_operator_queue}` + marquage `call_status: "transferred_to_human"`.

### 7.7 Client agressif ou mécontent

**Déclencheurs de sentiment :** score de sentiment < -0.6

```text
Je comprends votre frustration et j'en suis désolé. 
Pour mieux vous accompagner, je vais vous mettre en relation avec un 
conseiller spécialisé. Veuillez patienter un instant.
```

→ **Action :** Transfert prioritaire vers `{escalation_queue}` + marquage `call_status: "escalated"`.

### 7.8 Demande de rappel

```text
Bien entendu. Un conseiller vous rappellera dans les meilleurs délais.
Pouvez-vous me confirmer que le numéro {customer_phone} est bien 
le numéro auquel vous souhaitez être rappelé ?
```

| Réponse | Action |
|---|---|
| **Oui** | → Créer ticket de rappel + clôture |
| **Non** | → Transfert opérateur |

### 7.9 Changement de langue en cours d'appel

**Déclencheurs :** « عربي », « تونسي », « parlez arabe », « en tunisien »

```text
Bien sûr, je bascule la conversation. Un instant s'il vous plaît.
```

→ **Action :** Recharger le script de la langue demandée, reprendre à la phase courante.

---

## 8. Variables dynamiques

| Variable | Type | Exemple | Source |
|---|---|---|---|
| `{company_name}` | string | « TechDistrib Tunisie » | Profil entreprise |
| `{customer_first_name}` | string | « Amira » | Fiche client CRM |
| `{customer_email}` | string | « amira@exemple.tn » | Fiche client CRM |
| `{customer_phone}` | string | « +216 55 123 456 » | Fiche client CRM |
| `{order_id}` | string | « CMD-2026-04521 » | ERP / OMS |
| `{order_date}` | string (date) | « 28 septembre 2026 » | ERP / OMS |
| `{items}` | array | Voir schéma JSON | ERP / OMS |
| `{item_name}` | string | « Câble USB-C Premium » | Ligne de commande |
| `{item_quantity}` | integer | 3 | Ligne de commande |
| `{item_unit_price}` | string | « 35 dinars et 500 millimes » | Ligne de commande |
| `{total_price}` | string | « 196 dinars et 400 millimes » | ERP / OMS |
| `{currency}` | string | « dinars » | ERP / OMS |
| `{estimated_delivery_date}` | string \| null | « 3 octobre 2026 » | Logistique |
| `{support_phone_number}` | string | « 71 123 456 » | Configuration |
| `{support_email}` | string | « support@techdistrib.tn » | Configuration |
| `{pending_orders_count}` | integer | 2 | ERP / OMS |
| `{fallback_operator_queue}` | string | « queue_support_l1 » | Téléphonie |
| `{escalation_queue}` | string | « queue_support_l2 » | Téléphonie |
| `{delivery_info_block}` | string | (Généré dynamiquement) | Moteur d'appel |
