# 🌐 Ordely — Sélection de Langue / اختيار اللغة

> **Ticket Jira :** ORDELY-49  
> **Phase :** Phase 0 — Language Selection (pré-script)  
> **Langues supportées :** Français (TN), Arabe standard, Dialecte tunisien

---

## Flux de sélection de langue

```
Appel décroché / Pickup détecté
        │
        ▼
┌─────────────────────────────────────┐
│  PHASE 0 — Prompt trilingue         │
│  (Accueil + choix de langue)        │
└──────────────┬──────────────────────┘
               │
     ┌─────────┼───────────┐
     │         │           │
     ▼         ▼           ▼
  Français   Arabe     Tunisien
  (fr-TN)   (ar-TN)   (aeb-TN)
     │         │           │
     ▼         ▼           ▼
  Phase 1    Phase 1    Phase 1
  FR script  AR script  TN script
```

---

## Prompt trilingue d'accueil

> Ce prompt est diffusé **une seule fois** au décroché. L'ordre est :
> Arabe → Français → Tunisien (pour couvrir la majorité des préférences).

```text
السلام عليكم، أهلاً بيكم في أوردرلي.

Bonjour et bienvenue chez Ordely.

أهلا وسهلا، مرحبا بيك في أوردرلي.
```

**Pause : 500 ms**

```text
للمتابعة بالعربية، قولوا : عربي.

Pour continuer en français, dites : français.

باش تكمّل بالتونسي، قول : تونسي.
```

---

## Détection d'intention — Choix de langue

| Langue cible | Mots-clés / Intentions détectées | Code langue | Script chargé |
|---|---|---|---|
| **Arabe standard** | « عربي », « العربية », « بالعربي » | `ar-TN` | `call_script_arabic.md` |
| **Français** | « français », « french », « بالفرنسية » | `fr-TN` | `call_script_french.md` |
| **Tunisien (Derja)** | « تونسي », « درجة », « بالتونسي », « tounsi » | `aeb-TN` | `call_script_tunisian.md` |

---

## Cas de non-réponse au choix de langue

### Silence (> 5 secondes)

```text
معذرة، ما فهمتش الإختيار متاعك.

Excusez-moi, je n'ai pas compris votre choix.

سامحني، ما فهمتش شنوّا اخترت.
```

**Pause : 300 ms, puis relance :**

```text
قولوا عربي، français، ولّا تونسي.

Dites : arabe, français, ou tunisien.

قول : عربي، فرنسي، ولّا تونسي.
```

### Après 2 échecs consécutifs

→ **Langue par défaut :** `fr-TN` (français tunisien)

```text
Je vais poursuivre en français. Vous pourrez demander un changement 
de langue à tout moment.

باش نكمّل بالفرنساوي. تنجّم تطلب تبدّل اللغة وقتلّي تحب.
```

---

## Changement de langue en cours d'appel

À tout moment pendant l'appel, si le client dit un des déclencheurs de langue, le système bascule :

| Déclencheur | Action |
|---|---|
| « بدّل للعربي » / « parlez arabe » | Recharger script `ar-TN`, reprendre à la phase courante |
| « parlez français » / « فرنسي » | Recharger script `fr-TN`, reprendre à la phase courante |
| « تونسي » / « حكيلي تونسي » | Recharger script `aeb-TN`, reprendre à la phase courante |

**Confirmation de bascule :**

```text
(FR) Bien sûr, je continue en français.
(AR) طبعاً، باش نكمّل بالعربية.
(TN) ماشي، باش نكمّل بالتونسي.
```
