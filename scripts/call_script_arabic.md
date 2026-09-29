# 📞 Ordely — Script d'Appel Vocal (Arabe Standard / اللغة العربية الفصحى — `ar-TN`)

> **Ticket Jira :** ORDELY-49  
> **Version :** 2.0.0  
> **Langue :** Arabe Standard (`ar-TN`)  
> **Devise :** Dinar tunisien (TND) — 1 TND = 1 000 millimes (دينار و مليم)  
> **Fuseau horaire :** Africa/Tunis (UTC+1)  
> **Dernière mise à jour :** 2026-09-29

---

## 1. Vue d'ensemble du flux

> **Prérequis :** La Phase 0 (sélection de langue dans `language_selection.md`) a été effectuée. Le client a choisi **اللغة العربية الفصحى**.

---

## 2. Phase 1 — Accueil & Présentation de l'IA (الترحيب والتعريف)

### 2.1 Prompt principal

```text
السلام عليكم، أنا أوردرلي (Ordely).

أتصل بكم نيابة عن شركة {company_name} لمتابعة طلبيتكم الأخيرة.
```

### 2.2 Variante — Personnalisée par le prénom

```text
مرحباً السيد(ة) {customer_first_name}، أنا أوردرلي (Ordely).

أتصل بكم نيابة عن شركة {company_name} بخصوص طلبيتكم الأخيرة.
```

---

## 3. Phase 2 — Divulgation obligatoire (الإعلام القانوني)

> **⚠️ مطابق للقانون التونسي لحماية المعطيات الشخصية (INPDP — القانون الأساسي عدد 63 لسنة 2004).**

```text
أحيطكم علماً أن هذه المكالمة أوتوماتيكية ومدارة بواسطة مساعد صوتي ذكي. قد يتم تسجيل هذا التبادل لغرض ضمان الجودة، وفقاً للقوانين والترتيبات الجاري بها العمل.

هل ترغبون في المتابعة؟
```

### 3.1 Réponses attendues

| Intention | Exemple (Arabe) | Action |
|---|---|---|
| **Oui / Accord** | « نعم » / « موافق » / « تفضل » | → Phase 3 |
| **Non / Refus** | « لا » / « غير موافق » / « ألغِ المكالمة » | → §7.4 |
| **Silence** | (> 5 secondes) | → §7.1 |

---

## 4. Phase 3 — Identification de la commande (التحقق من الطلبية)

```text
شكراً لكم.

أتصل بكم بشأن طلبيتكم رقم {order_id}، المسجلة بتاريخ {order_date}.

هل هذه هي طلبيتكم؟
```

---

## 5. Phase 4 — Récapitulatif des articles & Montant total (تفاصيل الطلبية والمبلغ)

### 5.1 Introduction

```text
ممتاز. إليكم تفاصيل طلبيتكم:
```

### 5.2 Boucle sur les articles

```text
— {item_quantity} من {item_name}، بسعر فردي قدره {item_unit_price}.
```

**Exemples en Dinars & Millimes (TND) :**

```text
— 3 من Câble USB-C Premium، بسعر 35 ديناراً و 500 مليم للقطعة.
— 1 من Adaptateur secteur 65W، بسعر 89 ديناراً و 900 مليم للقطعة.
```

### 5.3 Annonce du total

```text
المبلغ الإجمالي لطلبيتكم هو {total_price} احتساب جميع الرسوم والآداءات.
```

### 5.4 Confirmation

```text
هل هذه المعلومات صحيحة؟
```

---

## 6. Phase 5 — Confirmation & Clôture (التأكيد والإنهاء)

```text
شكراً لكم. تم تأكيد طلبيتكم رقم {order_id} بنجاح.

{delivery_info_block}

ستصلكم رسالة تأكيد عبر البريد الإلكتروني {customer_email} خلال الدقائق القادمة.
```

```text
نشكركم على ثقتكم بنا {customer_first_name}.

نتمنى لكم يوماً سعيداً. إلى اللقاء!
```

---

## 7. Cas particuliers & Prompts de secours (حالات خاصة)

### 7.1 Répondeur / Messagerie vocale (المجيب الآلي)

```text
مرحباً، معكم أوردرلي نيابة عن شركة {company_name}.

اتصلنا بكم بشأن طلبيتكم رقم {order_id} المؤرخة في {order_date}، بمبلغ إجمالي قدره {total_price}.

لأي استفسار، يمكنكم الاتصال بنا على الرقم {support_phone_number} أو زيارة حسابكم الإلكتروني.

شكراً لكم وإلى اللقاء.
```

### 7.2 Demande de conseiller humain (تحويل لمستشار)

```text
بكل سرور. سأقوم بتحويلكم فوراً إلى أحد مستشارينا. يرجى الانتظار لحظة.
```
