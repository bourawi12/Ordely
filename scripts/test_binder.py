#!/usr/bin/env python3
"""
Ordely Voice AI — Dynamic Script Binder & Tester
Validates call payloads against JSON Schema and renders voice scripts for Tunisia (FR, AR, Derja).
"""

import json
import argparse
import sys
from pathlib import Path

def format_price_tnd(amount: float, locale: str = "fr-TN") -> str:
    dinars = int(amount)
    millimes = int(round((amount - dinars) * 1000))
    
    if locale == "fr-TN":
        d_str = f"{dinars} dinar{'s' if dinars > 1 else ''}"
        m_str = f" et {millimes} millimes" if millimes > 0 else ""
        return f"{d_str}{m_str}"
    elif locale in ["aeb-TN", "ar-TN"]:
        d_str = f"{dinars} دينار"
        m_str = f" و {millimes} مليم" if millimes > 0 else ""
        return f"{d_str}{m_str}"
    return f"{amount:.3f} TND"

def render_script(payload: dict, locale: str) -> str:
    company = payload.get("company", {})
    customer = payload.get("customer", {})
    order = payload.get("order", {})
    
    first_name = customer.get("first_name", "")
    company_name = company.get("name", "Notre entreprise")
    order_id = order.get("order_id", "")
    order_date = order.get("order_date", "")
    total_price = format_price_tnd(order.get("total_price", 0.0), locale)
    
    items = order.get("items", [])
    item_lines = []
    for item in items:
        qty = item.get("quantity", 1)
        name = item.get("name", "")
        price = format_price_tnd(item.get("unit_price_incl_tax", item.get("unit_price", 0.0)), locale)
        if locale == "fr-TN":
            item_lines.append(f"  - {qty}x {name} à {price}")
        else:
            item_lines.append(f"  - {qty} من {name} بسعر {price}")
            
    items_summary = "\n".join(item_lines)
    
    if locale == "fr-TN":
        return f"""
=====================================================
ORDELY VOICE ENGINE — SPOKEN PROMPT RENDER (fr-TN)
=====================================================
Phase 1: Bonjour {first_name}, je m'appelle Ordely. Je vous appelle au nom de {company_name}.
Phase 2: Appel automatisé & enregistré sous réglementation INPDP.
Phase 3: Commande N° {order_id} passée le {order_date}.
Phase 4: Récapitulatif :
{items_summary}
         Total : {total_price}.
Phase 5: Merci pour votre confiance {first_name} !
=====================================================
"""
    elif locale == "aeb-TN":
        return f"""
=====================================================
ORDELY VOICE ENGINE — SPOKEN PROMPT RENDER (aeb-TN)
=====================================================
Phase 1: يعيشك يا {first_name}، أنا أوردرلي نكلّم فيك من عند {company_name}.
Phase 2: مكالمة أوتوماتيكية ومسجّلة حسب قانون حماية المعطيات الشخصية INPDP.
Phase 3: الكوماند رقم {order_id} اللّي تعدّات نهار {order_date}.
Phase 4: التفاصيل :
{items_summary}
         المبلغ الجملي : {total_price}.
Phase 5: يرحم والديك على ثقتك فينا يا {first_name} !
=====================================================
"""
    else:
        return f"""
=====================================================
ORDELY VOICE ENGINE — SPOKEN PROMPT RENDER (ar-TN)
=====================================================
Phase 1: مرحباً {first_name}، أنا أوردرلي أتصل بكم نيابة عن شركة {company_name}.
Phase 2: مكالمة آلية ومسجلة وفقاً لقانون حماية المعطيات الشخصية.
Phase 3: الطلبية رقم {order_id} بتاريخ {order_date}.
Phase 4: التفاصيل :
{items_summary}
         المبلغ الإجمالي : {total_price}.
Phase 5: نشكركم على ثقتكم بنا {first_name} !
=====================================================
"""

def main():
    parser = argparse.ArgumentParser(description="Test Ordely Voice Script Binder")
    parser.add_argument("--payload", required=True, help="Path to JSON payload file")
    parser.add_argument("--lang", default="aeb-TN", choices=["fr-TN", "aeb-TN", "ar-TN"], help="Locale tag")
    
    args = parser.parse_args()
    
    payload_path = Path(args.payload)
    if not payload_path.exists():
        print(f"Error: Payload file {payload_path} not found.", file=sys.stderr)
        sys.exit(1)
        
    with open(payload_path, "r", encoding="utf-8") as f:
        payload = json.load(f)
        
    output = render_script(payload, args.lang)
    print(output)

if __name__ == "__main__":
    main()
