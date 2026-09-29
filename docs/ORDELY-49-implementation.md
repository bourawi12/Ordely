# ORDELY-49 — Technical Implementation Guide (Tunisia Edition)

> **Ticket:** ORDELY-49 — Préparation et script de l'appel (Tunisie B2B)  
> **Author:** Voice AI Software Engineering & Architecture  
> **Target Market:** Tunisia (TND currency, +216 Telecom, Trilingual FR/AR/Derja)  
> **Status:** Implementation Ready  
> **Last Updated:** 2026-09-29

---

## Table of Contents

1. [Overview & Requirements](#1-overview--requirements)
2. [Trilingual System Architecture](#2-trilingual-system-architecture)
3. [Language Selection Engine (Phase 0)](#3-language-selection-engine-phase-0)
4. [Tunisian Dinar (TND) Currency Speech Pipeline](#4-tunisian-dinar-tnd-currency-speech-pipeline)
5. [Variable Binding & Localization](#5-variable-binding--localization)
6. [Webhook & API Integration](#6-webhook--api-integration)
7. [Voice Engine & Speech Provider Matrix](#7-voice-engine--speech-provider-matrix)
8. [INPDP Regulatory Compliance (Tunisia)](#8-inpdp-regulatory-compliance-tunisia)
9. [Telephony Integration (+216 Tunisia)](#9-telephony-integration-216-tunisia)
10. [Testing & Simulation Framework](#10-testing--simulation-framework)

---

## 1. Overview & Requirements

**ORDELY-49** provides the complete orchestration logic, call preparation, script templates, and payload binding for Ordely's outbound voice AI confirmation system tailored for the **Tunisian B2B market**.

### Key Deliverables & Market Specs:

1. **Trilingual Dynamic Routing:** Supports interactive language selection in Phase 0 among:
   - **Tunisian Derja (`aeb-TN`)** — Conversational Tunisian Arabic dialect.
   - **Modern Standard Arabic (`ar-TN`)** — Formal Arabic.
   - **French (`fr-TN`)** — Business French.
2. **Tunisian Currency Engine:** Full support for **Tunisian Dinar (TND)** formatted in **Dinars & Millimes** ($1\text{ TND} = 1000\text{ millimes}$, 3 decimal precision).
3. **INPDP Compliance:** Complies with Tunisian Data Protection Law (*Loi organique n° 2004-63 du 27 juillet 2004*).
4. **Tunisian Telecom Integration:** Native support for E.164 phone format (`+216 XX XXX XXX`) across Tunisie Telecom, Ooredoo Tunisia, and Orange Tunisia.

---

## 2. Trilingual System Architecture

```
┌─────────────────┐       POST /api/v1/calls      ┌─────────────────────────┐
│ CRM / ERP System│──────────────────────────────▶│  Ordely API Gateway     │
│ (Odoo / Custom) │                               └────────────┬────────────┘
└─────────────────┘                                            │
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │ Payload Schema Validator│
                                                  │ (call_payload_schema)   │
                                                  └────────────┬────────────┘
                                                               │
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │  Trilingual Binder      │
                                                  │  (TND Price Engine)     │
                                                  └────────────┬────────────┘
                                                               │
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │  Outbound SIP Dialer    │
                                                  │  (+216 Trunking)        │
                                                  └────────────┬────────────┘
                                                               │
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │ Phase 0: Lang Selection │
                                                  │ (FR / AR / Derja)       │
                                                  └────────────┬────────────┘
                                                               │
                       ┌───────────────────────────────────────┼───────────────────────────────────────┐
                       ▼                                       ▼                                       ▼
         ┌───────────────────────────┐           ┌───────────────────────────┐           ┌───────────────────────────┐
         │ French Script (fr-TN)     │           │ Derja Script (aeb-TN)     │           │ Arabic Script (ar-TN)     │
         │ (call_script_french.md)   │           │ (call_script_tunisian.md) │           │ (call_script_arabic.md)   │
         └───────────────────────────┘           └───────────────────────────┘           └───────────────────────────┘
```

---

## 3. Language Selection Engine (Phase 0)

When the call connects, Phase 0 plays a neutral trilingual greeting and listens for STT intent detection:

### 3.1 Language Detection Rules

```python
LANGUAGE_INTENT_MAP = {
    "aeb-TN": ["تونسي", "درجة", "تونسية", "tounsi", "derja", "3arbi tounsi"],
    "ar-TN": ["عربي", "العربية", "فصحى", "arabe", "arabic"],
    "fr-TN": ["français", "francais", "french", "فرنسي", "بالفرنساوي"]
}

def detect_language(speech_text: str, default_locale: str = "aeb-TN") -> str:
    speech_text_clean = speech_text.strip().lower()
    for locale, keywords in LANGUAGE_INTENT_MAP.items():
        if any(kw in speech_text_clean for kw in keywords):
            return locale
    return default_locale
```

---

## 4. Tunisian Dinar (TND) Currency Speech Pipeline

In Tunisia, $1\text{ TND} = 1000\text{ millimes}$. Prices are expressed with **3 decimal places** (e.g. `196.400 TND`).

### 4.1 Price Converter Algorithm (Python Implementation)

```python
def format_price_tnd_speech(amount: float, locale: str = "fr-TN") -> str:
    """
    Formats a numeric TND price into speech-ready text.
    
    Examples:
      - 35.500 TND in fr-TN  -> "trente-cinq dinars et cinq cents millimes"
      - 35.500 TND in aeb-TN -> "خمسة وثلاثين دينار وخمسمائة ملّيم"
      - 100.000 TND in ar-TN -> "مائة دينار"
    """
    dinars = int(amount)
    millimes = int(round((amount - dinars) * 1000))

    if locale == "fr-TN":
        dinar_str = f"{num2words_fr(dinars)} dinar{'s' if dinars > 1 else ''}"
        if millimes > 0:
            millime_str = f"{num2words_fr(millimes)} millime{'s' if millimes > 1 else ''}"
            return f"{dinar_str} et {millime_str}"
        return dinar_str

    elif locale in ["aeb-TN", "ar-TN"]:
        dinar_str = f"{num2words_ar(dinars)} دينار"
        if millimes > 0:
            millime_str = f"{num2words_ar(millimes)} مليم"
            return f"{dinar_str} و {millime_str}"
        return dinar_str

    return f"{amount:.3f} TND"
```

---

## 5. Variable Binding & Localization

All inputs from the payload are mapped to the selected language template:

| Variable | Raw Value | `fr-TN` Output | `aeb-TN` Output | `ar-TN` Output |
|---|---|---|---|---|
| `{order_id}` | `"CMD-2026-04521"` | `"CMD deux mille vingt-six mille quarante-cinq vingt-un"` | `"الكوماند رقم CMD-2026-04521"` | `"الطلبية رقم CMD-2026-04521"` |
| `{total_price}` | `196.400` | `"cent quatre-vingt-seize dinars et quatre cents millimes"` | `"مائة وستة وتسعين دينار وأربعمائة مليم"` | `"مائة وستة وتسعون ديناراً وأربعمائة مليم"` |
| `{order_date}` | `"2026-09-28"` | `"28 septembre 2026"` | `"28 سبتمبر 2026"` | `"28 سبتمبر 2026"` |

---

## 6. Webhook & API Integration

### 6.1 Triggering a Tunisia Call (`POST /api/v1/calls`)

```json
{
  "call_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "call_config": {
    "language": "aeb-TN",
    "allow_dynamic_language_switch": true,
    "script_version": "2.0.0",
    "max_retries": 2,
    "retry_interval_minutes": 30,
    "call_window": {
      "start": "08:30",
      "end": "19:30",
      "timezone": "Africa/Tunis"
    }
  },
  "company": {
    "name": "TechDistrib Tunisie",
    "support_phone_number": "+21671123456",
    "support_email": "support@techdistrib.tn"
  },
  "customer": {
    "customer_id": "CUST-TN-8847",
    "first_name": "Amira",
    "last_name": "Ben Ali",
    "company_name": "Société Pro IT Tunis",
    "phone": "+21655123456",
    "email": "amira.benali@proit.tn",
    "preferred_language": "aeb-TN"
  },
  "order": {
    "order_id": "CMD-2026-04521",
    "order_date": "2026-09-28",
    "items": [
      {
        "item_id": "SKU-USB-C-001",
        "name": "Câble USB-C Premium",
        "quantity": 3,
        "unit_price": 35.500,
        "unit_price_incl_tax": 35.500,
        "line_total": 106.500
      },
      {
        "item_id": "SKU-ADAPT-65W",
        "name": "Adaptateur secteur 65W",
        "quantity": 1,
        "unit_price": 89.900,
        "unit_price_incl_tax": 89.900,
        "line_total": 89.900
      }
    ],
    "total_price": 196.400,
    "currency": "TND",
    "tax_amount": 31.350,
    "estimated_delivery_date": "2026-10-03",
    "shipping_method": "Aramex Tunisia",
    "pending_orders_count": 1
  },
  "telephony": {
    "caller_id": "+21671800900",
    "fallback_operator_queue": "queue_support_tn_l1",
    "escalation_queue": "queue_support_tn_l2"
  },
  "metadata": {
    "source_system": "odoo_tn",
    "inpdp_consent_logged": true
  }
}
```

---

## 7. Voice Engine & Speech Provider Matrix

For optimal performance in Tunisia:

| Component | Primary Provider | Fallback Provider | Language Code |
|---|---|---|---|
| **TTS (French)** | Azure Neural (`fr-FR-VivienneMultilingualNeural`) | Google Wavenet (`fr-FR-Wavenet-A`) | `fr-TN` / `fr-FR` |
| **TTS (Arabic)** | Azure Neural (`ar-TN-HediNeural` / `ar-TN-ReemNeural`) | ElevenLabs Multilingual v2 | `ar-TN` |
| **TTS (Derja)** | Azure Neural Tunisia / Customized ElevenLabs | Voice cloning tuned for Tunisian Derja | `aeb-TN` |
| **STT Engine** | Deepgram Nova-2 (Multilingual / Arabic) | Google Cloud Speech-to-Text | `ar-TN` / `fr-TN` |

---

## 8. INPDP Regulatory Compliance (Tunisia)

Under Tunisian Law (*Loi organique n° 2004-63 du 27 juillet 2004*):
- Mandatory verbal disclosure in Phase 2 across all 3 scripts.
- Log of explicit verbal consent stored with recording metadata (`inpdp_consent_logged: true`).
- Right to opt-out and transfer to human operator at any time.

---

## 9. Telephony Integration (+216 Tunisia)

- **SIP Trunking:** Direct SIP peering with Tunisian operators (Tunisie Telecom, Ooredoo, Orange).
- **Number Validation:** E.164 pattern `^\+216[234579]\d{7}$`.
- **Calling Hours:** Enforced strict calling window `08:30 - 19:30` (Africa/Tunis timezone).

---

## 10. Testing & Simulation Framework

Run test simulations for Tunisia payloads:

```bash
# Validate schema
npx ajv-cli validate -s schemas/call_payload_schema.json -d tests/fixtures/sample_payload_tn.json

# Test French script rendering
python scripts/test_binder.py --lang fr-TN --payload tests/fixtures/sample_payload_tn.json

# Test Tunisian Derja rendering
python scripts/test_binder.py --lang aeb-TN --payload tests/fixtures/sample_payload_tn.json
```
