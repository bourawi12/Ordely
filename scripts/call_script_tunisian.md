# 📞 Ordely — Script d'Appel Vocal (Dialecte Tunisien / الدارجة التونسية — `aeb-TN`)

> **Ticket Jira :** ORDELY-49  
> **Version :** 2.0.0  
> **Langue :** Dialecte Tunisien (`aeb-TN`)  
> **Devise :** Dinar tunisien (TND) — 1 TND = 1 000 millimes (دينار و ملّيم)  
> **Fuseau horaire :** Africa/Tunis (UTC+1)  
> **Dernière mise à jour :** 2026-09-29

---

## 1. Vue d'ensemble du flux

> **Prérequis :** La Phase 0 (sélection de langue dans `language_selection.md`) a été effectuée. Le client a choisi **le dialecte tunisien (الدارجة)**.

---

## 2. Phase 1 — Accueil & Présentation de l'IA (مرحبة و تقديم)

### 2.1 Prompt principal

```text
يعيشك، أنا أوردرلي (Ordely).

نكلّم فيك من عند شركة {company_name} باش نتفقّدوا الكوماند متاعك اللّي تعدّات مؤخراً.
```

### 2.2 Variante — Personnalisée par le prénom

```text
يعيشك يا {customer_first_name}، أنا أوردرلي (Ordely).

نكلّم فيك باسم {company_name} على خاطر الكوماند متاعك اللّي تعدّات مؤخراً.
```

---

## 3. Phase 2 — Divulgation obligatoire (الإعلام الآلي)

> **⚠️ مطابق للقانون التونسي لحماية المعطيات الشخصية (INPDP — القانون الأساسي عدد 63 لسنة 2004).**

```text
نحّب نعلّمك اللّي المكالمة هذه أوتوماتيكية ومسيّرة بذكاء اصطناعي. المكالمة تنجّم تكون مسجّلة للمراقبة وتطوير جودة الخدمة، حسب القوانين الجاري بيها العمل.

تحّب نكمّلوا ؟
```

### 3.1 Réponses attendues

| Intention | Exemple d'expression (Tunisien) | Action |
|---|---|---|
| **Oui / Accord** | « إي » / « ميسالش » / « كمّل » / « أي نعم » | → Phase 3 |
| **Non / Refus** | « لا » / « ما نحبش » / « سكر » | → §7.4 |
| **Silence** | (> 5 secondes) | → §7.1 |

---

## 4. Phase 3 — Identification de la commande (تثبّت في الكوماند)

```text
يعطيك الصحة.

نكلّم فيك على الكوماند رقم {order_id}، اللّي تعدّات نهار {order_date}.

ثابته هيّ الكوماند متاعك ؟
```

### 4.1 Réponses attendues

| Intention | Exemple (Tunisien) | Action |
|---|---|---|
| **Oui** | « إي صحيح » / « هيّ بيدها » / « أي نعم » | → Phase 4 |
| **Non** | « لا مش هذه » / « غالط » / « مش متاعي » | → §7.5 |

---

## 5. Phase 4 — Récapitulatif des articles & Montant total (تفاصيل الكوماند و السوم)

### 5.1 Introduction

```text
واضح. هاو تفاصيل الكوماند متاعك :
```

### 5.2 Boucle sur les articles

```text
— {item_quantity} من {item_name}، بالسوم الفردي {item_unit_price}.
```

**Exemples de prononciation en Dinars & Millimes (TND) :**

```text
— 3 من Câble USB-C Premium، بـ 35 دينار و 500 ملّيم القطعة.
— 1 من Adaptateur secteur 65W، بـ 89 دينار و 900 ملّيم القطعة.
```

> **قواعد نطق المبالغ بالدينار التونسي (TND) :**  
> - `35.500 TND` ← « خمسة وثلاثين دينار وخمسمائة ملّيم »  
> - `100.000 TND` ← « مائة دينار »  
> - `7.250 TND` ← « سبعة ديار ومائتين وخمسين ملّيم »  
> - 1 دينار = 1000 ملّيم.

### 5.3 Annonce du total

```text
المبلغ الجملي متاع الكوماند متاعك يجي {total_price} احتساب كل الأداءات.
```

### 5.4 Confirmation

```text
المعلومات هذه صحيحة ؟
```

---

## 6. Phase 5 — Confirmation & Clôture (التأكيد و الإنتهاء)

```text
يعطيك الصحة. الكوماند متاعك رقم {order_id} تأكدت بنجاح.

{delivery_info_block}

باش يوصلك ميل فيه التأكيد على العنوان {customer_email} في الدرجين هذوما.
```

### 6.1 Bloc de livraison (`{delivery_info_block}`)

```text
التوصيل مبرمج لنهار {estimated_delivery_date}.
```

### 6.2 Clôture

```text
عندك أي سؤال آخر يخص الكوماند هذه ؟
```

```text
يرحم والديك على ثقتك فينا يا {customer_first_name}. 

إن شاء الله نهارك زين و شاهية طيبة. في الأمان !
```

---

## 7. Cas particuliers & Prompts de secours (حالات خاصة)

### 7.1 Répondeur / Messagerie vocale (المجيب الآلي)

```text
عصباط، معاك أوردرلي من عند {company_name}. 

طلبتك باش نتأكدوا من الكوماند متاعك رقم {order_id} اللّي تعدّات نهار {order_date} بقيمة {total_price}.

كان عندك أي استفسار تنجّم تكلّمنا على الرقم {support_phone_number} ولّا تفقد حسابك على الموقع.

يعيشك و في الأمان.
```

### 7.2 Demande de conseiller humain (تحويل لمُرشد)

```text
واضح. باش نحوّلك توّا لمُرشد حريفة باش يعاونك. لحظة عيشك.
```

### 7.3 Changement de langue (تبديل اللغة)

```text
مريقل، باش نكمّلوا بلغة أخرى. لحظة عيشك.
```
