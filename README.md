# 📞 Ordely — Voice AI B2B Order Confirmation Agent (Tunisia Edition)

[![Jira Ticket](https://img.shields.io/badge/Jira-ORDELY--49-blue)](https://jira.ordely.ai/browse/ORDELY-49)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![JSON Schema](https://img.shields.io/badge/Schema-Draft%202020--12-orange)](schemas/call_payload_schema.json)
[![Market](https://img.shields.io/badge/Market-Tunisia%20%28%2B216%29-red)](https://ordely.ai)

> **Ordely** is an automated voice AI fulfillment agent designed to call B2B e-commerce customers after an order is placed to confirm order details, summarize items, and handle customer queries in **Tunisia**.

---

## 🎯 Scope of Jira Ticket ORDELY-49

> **"Préparation et script de l'appel : En tant que client, je veux que l'agent se présente, annonce un appel automatisé, identifie ma commande et la récapitule, afin que je sache tout de suite de quoi il s'agit."**

### Key Features Implemented:
1. **Trilingual Language Engine (Phase 0):** Interactively prompts customer to pick between **Tunisian Derja (`aeb-TN`)**, **Modern Standard Arabic (`ar-TN`)**, or **French (`fr-TN`)**.
2. **Tunisian Dinar Currency Engine (TND):** Full support for Dinars and Millimes ($1\text{ TND} = 1000\text{ millimes}$).
3. **INPDP Regulatory Compliance:** Verbal automated disclosure and recording notice compliant with Tunisian Data Protection Law (*Loi 2004-63*).
4. **Telephony & Fallback:** PSTN/SIP routing for Tunisia (+216), fallback prompts for voicemail, silence, and operator transfer.

---

## 📂 Repository Structure

```
ordely/
├── README.md                            # Project documentation & usage guide
├── schemas/
│   └── call_payload_schema.json         # Strict JSON Schema (v2) for call payload
├── scripts/
│   ├── language_selection.md            # Phase 0: Trilingual language selection prompt
│   ├── call_script_french.md            # French call script for Tunisia (fr-TN)
│   ├── call_script_tunisian.md          # Tunisian Derja call script (aeb-TN)
│   └── call_script_arabic.md            # Modern Standard Arabic script (ar-TN)
└── docs/
    └── ORDELY-49-implementation.md      # Technical architecture & integration guide
```

---

## 🚀 Quick Start & Testing

### 1. Validate a Call Payload against Schema

You can validate any call trigger payload using standard JSON Schema CLI tools like `ajv-cli`:

```bash
# Install AJV CLI if not installed
npm install -g ajv-cli ajv-formats

# Validate sample payload against Ordely schema
ajv validate -s schemas/call_payload_schema.json -d docs/sample_payload.json -c ajv-formats
```

### 2. Sample Payload (Tunisia B2B Order)

Save this sample payload to test your integration:

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
  }
}
```

---

## 🗣️ Voice Script Phases Overview

Every outbound call follows a structured state machine across 6 phases:

| Phase | Title | Objective | Key Script File |
|---|---|---|---|
| **Phase 0** | Language Selection | Interactively choose Derja, Arabic, or French | [`scripts/language_selection.md`](file:///c:/Users/LENOVO/Desktop/ordely/scripts/language_selection.md) |
| **Phase 1** | Agent Greeting | Introduce Ordely and B2B seller company | [`scripts/call_script_tunisian.md`](file:///c:/Users/LENOVO/Desktop/ordely/scripts/call_script_tunisian.md) |
| **Phase 2** | Mandatory Disclosure | Announce AI agent & recording (INPDP compliance) | All scripts (§ Phase 2) |
| **Phase 3** | Order Identification | Identify order by `{order_id}` and `{order_date}` | All scripts (§ Phase 3) |
| **Phase 4** | Order Summary | State items, quantities, TND prices & total | All scripts (§ Phase 4) |
| **Phase 5** | Confirmation & Close | Confirm order, state delivery date, close call | All scripts (§ Phase 5) |

---

## 💡 Currency & Speech Formatting Rules (TND)

- **Currency Code:** `TND` (Dinar Tunisien)
- **Sub-unit:** `millimes` ($1\text{ TND} = 1000\text{ millimes}$)
- **Decimal precision:** 3 decimal places (e.g. `196.400`)

### Speech Conversion Matrix

| Raw Value | French (`fr-TN`) | Tunisian Derja (`aeb-TN`) | Arabic (`ar-TN`) |
|---|---|---|---|
| `35.500 TND` | *"trente-cinq dinars et cinq cents millimes"* | *"خمسة وثلاثين دينار وخمسمائة ملّيم"* | *"خمسة وثلاثون ديناراً وخمسمائة مليم"* |
| `100.000 TND` | *"cent dinars"* | *"مائة دينار"* | *"مائة دينار"* |
| `7.250 TND` | *"sept dinars et deux cent cinquante millimes"* | *"سبعة ديار ومائتين وخمسين ملّيم"* | *"سبعة دنانير ومائتان وخمسون مليم"* |

---

## 📖 Technical Documentation

For detailed architecture diagrams, variable binding pipelines, webhook integration details, and error recovery policies, refer to:

👉 [`docs/ORDELY-49-implementation.md`](file:///c:/Users/LENOVO/Desktop/ordely/docs/ORDELY-49-implementation.md)

---

## 🛠️ Maintenance & Contributions

- To modify script prompts, update the relevant markdown file under [`scripts/`](file:///c:/Users/LENOVO/Desktop/ordely/scripts).
- To update API payload parameters, edit [`schemas/call_payload_schema.json`](file:///c:/Users/LENOVO/Desktop/ordely/schemas/call_payload_schema.json).
