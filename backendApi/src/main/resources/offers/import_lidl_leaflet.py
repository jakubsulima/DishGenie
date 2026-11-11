#!/usr/bin/env python3
"""Pilot: extract priced offer candidates from a complete official Lidl PDF.

No AI calls, no publication API and no writes to the application's database.
Usage: python import_lidl_leaflet.py --metadata flyer.json --pdf leaflet.pdf --output reports/leaflet
Optional --flyer-url downloads metadata/PDF from the official leaflet service.
"""
import argparse
from collections import Counter
from datetime import date
from decimal import Decimal
import hashlib
import html
import json
from pathlib import Path
import re
import resource
import sys
import time
import unicodedata
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

VERSION = "lidl-native-pdf-2"
MONEY = re.compile(r"^(\d{1,4}[,.]\d{2})\*?$")
PACK = re.compile(r"^(?:(\d+)\s*[x×]\s*)?(\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|szt\.?)$", re.I)
DATE = re.compile(r"(?<!\d)(\d{1,2})\.(\d{2})(?!\d)")


def normalize(value):
    return " ".join(unicodedata.normalize("NFC", value).replace("\x00", "").split()).strip()


def money(value):
    return str(Decimal(value.replace(",", ".")).quantize(Decimal("0.01")))


def bbox(words):
    return [min(w["x0"] for w in words), min(w["top"] for w in words),
            max(w["x1"] for w in words), max(w["bottom"] for w in words)]


def lines(words, gap=12):
    """Preserve physical lines and split adjacent columns rather than PDF object order."""
    rows = []
    for word in sorted(words, key=lambda w: (w["top"], w["x0"])):
        row = next((r for r in reversed(rows[-5:]) if abs(r[0]["top"] - word["top"]) < 1.4), None)
        if row is None:
            rows.append([word])
        else:
            row.append(word)
    result = []
    for row in rows:
        segment = []
        for word in sorted(row, key=lambda w: w["x0"]):
            if segment and word["x0"] - segment[-1]["x1"] > gap:
                result.append(segment)
                segment = []
            segment.append(word)
        if segment:
            result.append(segment)
    return sorted(result, key=lambda row: (row[0]["top"], row[0]["x0"]))


def line_text(row):
    return normalize(" ".join(w["text"] for w in row))


def name_blocks(words):
    title = [w for w in words if "CondPro-Bold" in w["fontname"] and 7 <= w["size"] <= 18]
    blocks = []
    for row in lines(title):
        box = bbox(row)
        prior = next((b for b in reversed(blocks) if abs(b["bbox"][0] - box[0]) < 4
                      and -0.5 <= box[1] - b["bbox"][3] < 5), None)
        if prior is None:
            blocks.append({"words": list(row), "bbox": box})
        else:
            prior["words"].extend(row)
            prior["bbox"] = bbox(prior["words"])
    result = []
    for block in blocks:
        block["name"] = normalize(" ".join(line_text(r) for r in lines(block.pop("words"))))
        if not re.match(r"^(?:Limit|Szczegóły|Co to|Produkty|Więcej|R \d|KUCHNIALIDLA)\b", block["name"], re.I):
            result.append(block)
    return result


def classify(name):
    """Classify discovery only; this never maps a branded product to a generic ingredient."""
    value = name.lower()
    if re.search(r"\b(?:karma|kota|psa|kosmetyk|szampon|serum|krem do|płyn do|pościel|skarpet|świeca|dekorac|środek do|kąpielow|twarzy|ciała|prania|perfum|dezodorant|parkside|akumulator|wiertark)", value):
        return "NON_FOOD"
    patterns = [
        ("COOKING", r"przypraw|oliwa|olej|ocet|sos\b|majonez|musztard|koncentrat|passat|przecier"),
        ("SWEETS_SNACKS", r"czekolad|cukierk|ciast[ak]|piernik|pralin|krówk|chips|żelk|chałw|delicje|kalendarz adwentowy|lody|rogal|pącz|drożdżów|babka |sernik|tort\b"),
        ("READY_MEALS", r"dania gotowe|zupa|antipasti|pełnowartościowy posiłek|pizza|panini|zapiekank"),
        ("PLANT_DRINKS", r"napój (?:migdałowy|owsiany|sojowy|ryżowy)"),
        ("MEAT_FISH", r"kurczak|schab|wołow|wieprz|indyk|kaczk|gęs|mięso|mielon|kiełbas|szynk|wędlin|parów|bekon|boczek|salami|burger|łoso|pstrąg|karp\b|dorsz|śled|makrel|tuńczyk|krewet|halibut|morszczuk"),
        ("DAIRY_EGGS", r"mleko|masło|\bser\b|serek|skyr|twar|jogurt|kefir|śmietan|mozzarella|brie\b|camembert|jaja|jajka|gouda"),
        ("VEGETABLES", r"warzyw|pomidor|ogór|kapust|dyni|cukini|papryk|marchew|ziemniak|cebul|czosnek|broku|kalafior|sałat|szpinak|burak|pieczar|rzodkiew|seler"),
        ("FRUIT_NUTS", r"banan|jabł|śliw|nektaryn|mandaryn|pomarań|awokad|kiwi|kaki|granat|mango|winogron|cytryn|grusz|borów|truskaw|malin|orzech|migdał|rodzyn|daktyl|morel|żurawin|bakali|pistacj"),
        ("DRY_GOODS", r"ryż|makaron|kasz|mąk|płatki|otręby|groch|fasol|ciecierzyc|soczewic|cukier\b|sól\b|skrobi|budyń|proszek do pieczenia"),
        ("BAKERY", r"chleb|bułk|bagiet|pinsa|spody do pizzy|tortill"),
        ("DRINKS", r"herbat|kaw[ayę]|napój|napoje|wod[ayę]|pepsi|sok|nektar|piwo|jasne pełne|budweiser|lech\b|paulaner|wino\b"),
    ]
    return next((category for category, pattern in patterns if re.search(pattern, value)), "UNCLASSIFIED")


def dates_in(text, year):
    result = []
    for day, month in DATE.findall(text):
        try:
            parsed = date(year, int(month), int(day)).isoformat()
        except ValueError:
            continue
        if parsed not in result:
            result.append(parsed)
    return result


def extract_fields(name, text_lines, header, metadata):
    text = "\n".join(text_lines)
    lower = text.lower()
    reasons = []
    quantities = []
    for line in text_lines:
        match = PACK.fullmatch(line.strip())
        if match:
            count, value, unit = match.groups()
            amount = Decimal(value.replace(",", ".")) * int(count or 1)
            unit = unit.lower().rstrip(".")
            if unit in {"kg", "l"}:
                amount *= 1000
            unit = {"kg": "g", "l": "ml", "szt": "pcs"}.get(unit, unit)
            quantity = {"amount": format(amount.normalize(), "f"), "unit": unit, "sourceText": line}
            if quantity not in quantities:
                quantities.append(quantity)
    if len(quantities) != 1:
        reasons.append("QUANTITY_MISSING_OR_AMBIGUOUS")
    quantity = quantities[0] if len(quantities) == 1 else None
    category = classify(name)
    if quantity and quantity["unit"] == "g" and quantity["sourceText"].strip() in {"1 kg", "100 g"}:
        if "luzem" in name.lower():
            quantity["meaning"] = "WEIGHT_PRICE_BASIS"
        elif category == "MEAT_FISH":
            quantity["meaning"] = "WEIGHT_PRICE_BASIS_PACK_WEIGHT_UNKNOWN"
            reasons.append("VARIABLE_PACK_WEIGHT")
        else:
            quantity["meaning"] = "ADVERTISED_AMOUNT"
    elif quantity:
        quantity["meaning"] = "ADVERTISED_AMOUNT"
    year = int(metadata["offerStartDate"][:4])
    card_dates = dates_in(text, year)
    page_dates = dates_in(header, year)
    selected_dates = card_dates or page_dates
    validity = {"from": None, "to": None, "basis": "CARD" if card_dates else "PAGE"}
    if len(selected_dates) == 2 and selected_dates[0] <= selected_dates[1]:
        validity.update({"from": selected_dates[0], "to": selected_dates[1]})
    elif len(selected_dates) == 1:
        validity["from"] = selected_dates[0]
        reasons.append("END_DATE_NOT_STATED")
    else:
        reasons.append("VALIDITY_MISSING_OR_AMBIGUOUS")
    minimum = re.search(r"przy zakupie\s+(\d+)", lower)
    multiple = re.search(r"wielokrotności\s+(\d+)", lower)
    limit = re.search(r"limit:\s*(\d+(?:[,.]\d+)?)\s*(kg|opak\.|szt\.|pusz\.)", lower)
    complex_promo = bool(re.search(r"gratis|miksuj|mieszaj|drugi|druga|trzeci|tańszy produkt|wybrane produkty", lower))
    if complex_promo:
        reasons.append("COMPLEX_PROMOTION")
    if "region" in lower or "region" in header.lower():
        reasons.append("REGIONAL_SCOPE")
    if "przy zakupie" in lower and not minimum:
        reasons.append("MINIMUM_NOT_PARSED")
    if category in {"UNCLASSIFIED", "NON_FOOD"}:
        reasons.append(category)
    return {"quantity": quantity, "validity": validity, "category": category,
            "loyaltyRequired": "aplikacj" in lower or "lidl plus" in lower,
            "couponRequired": "kupon" in lower,
            "minimumItems": int(minimum.group(1)) if minimum else 1,
            "multipleItems": int(multiple.group(1)) if multiple else 1,
            "limit": {"value": limit.group(1), "unit": limit.group(2)} if limit else None,
            "conditionsText": text, "reviewReasons": reasons}


def extract_page(page, metadata):
    words = [w for w in page.extract_words(extra_attrs=["fontname", "size"])
             if w["x0"] >= 0 and w["top"] >= 0 and w["x1"] <= page.width + .1 and w["bottom"] <= page.height + .1]
    names = name_blocks(words)
    prices = [w for w in words if "LidlFontPrice" in w["fontname"] and w["size"] >= 20 and MONEY.fullmatch(w["text"])]
    header = "\n".join(line_text(row) for row in lines([w for w in words if w["top"] < 62 and w["size"] <= 22]))
    regional = any("regionie" in w["text"].lower() for w in words)
    matches = []
    for price in prices:
        candidates = []
        for index, name in enumerate(names):
            box = name["bbox"]
            dx, dy = abs(price["x0"] - box[0]), price["top"] - box[3]
            if dx > page.width * .48 or dy > page.height * .34 or dy < -110:
                continue
            score = abs(dy) + dx * 1.65 + (140 if dy < -15 else 0)
            if box[1] <= price["bottom"] and box[3] >= price["top"]:
                score = dx * .8
            candidates.append((score, index))
        candidates.sort()
        if candidates:
            matches.append((price, candidates[0][1], candidates[1][0] - candidates[0][0] if len(candidates) > 1 else 999))
    # "Cena poza promocją / To wychodzi za sztukę" is one card with two prices.
    # The effective price may be physically nearer the neighbouring product's title.
    for k, (price, index, margin) in enumerate(matches):
        labels = [w for w in words if price["x0"] - 5 <= w["x0"] <= price["x0"] + 100
                  and price["top"] - 65 <= w["top"] < price["top"]]
        if "wychodzi" not in " ".join(w["text"] for w in labels).lower():
            continue
        paired = [(p, i, m) for p, i, m in matches if p["x0"] < price["x0"]
                  and price["x0"] - p["x0"] < 150 and abs(p["top"] - price["top"]) < 8]
        if paired:
            _, index, _ = max(paired, key=lambda v: v[0]["x0"])
            matches[k] = (price, index, margin)
    reuse = Counter(index for _, index, _ in matches)
    result = []
    for price, index, margin in matches:
        name = names[index]
        left = min(name["bbox"][0], price["x0"])
        right_candidates = [p["x0"] - 6 for p in prices if p["x0"] > left + 85 and abs(p["top"] - price["top"]) < 55]
        right_candidates += [n["bbox"][0] - 6 for other_index, n in enumerate(names) if other_index != index
                             and n["bbox"][0] > left + 85 and abs(n["bbox"][1] - name["bbox"][1]) < 40]
        right = min(right_candidates, default=page.width - 8)
        top = min(name["bbox"][1], price["top"] - 45)
        # Some date banners sit above the product title (e.g. a second offer window).
        previous_bottom = max([p["bottom"] for p in prices if p["bottom"] < name["bbox"][1]
                               and left - 3 <= p["x0"] < right], default=0)
        above = [w for w in words if left - 2 <= w["x0"] < right and previous_bottom < w["top"] < name["bbox"][1]
                 and w["size"] <= 22]
        banner = "\n".join(line_text(row) for row in lines(above))
        banner_dates = dates_in(banner, int(metadata["offerStartDate"][:4]))
        bottom = min([n["bbox"][1] - 5 for n in names if left - 3 <= n["bbox"][0] < right
                      and n["bbox"][1] > max(name["bbox"][3] + 8, price["top"] + price["size"] * .5)], default=page.height - 28)
        bottom = min(bottom, max(name["bbox"][3] + 85, price["bottom"] + 45), page.height - 28)
        context = [w for w in words if left - 2 <= w["x0"] < right and top - 1 <= w["top"] < bottom
                   and w["size"] <= 18 and "LidlFontPrice" not in w["fontname"]]
        text_lines = [line_text(row) for row in lines(context)]
        fields = extract_fields(name["name"], text_lines, banner if len(banner_dates) == 2 else header, metadata)
        if fields["validity"]["basis"] == "PAGE" and len(banner_dates) == 2:
            fields["validity"]["basis"] = "BANNER"
        all_dates = dates_in(" ".join(w["text"] for w in words), int(metadata["offerStartDate"][:4]))
        if fields["validity"]["basis"] == "PAGE" and len(all_dates) > 2:
            fields["validity"] = {"from": None, "to": None, "basis": "AMBIGUOUS_PAGE"}
            fields["reviewReasons"].append("MULTIPLE_VALIDITY_WINDOWS")
        if page.page_number == 1 and len(prices) > 3:
            fields["reviewReasons"].append("COVER_TEASER")
        if regional and "REGIONAL_SCOPE" not in fields["reviewReasons"]:
            fields["reviewReasons"].append("REGIONAL_SCOPE")
        if reuse[index] > 1:
            fields["reviewReasons"].append("MULTIPLE_PRICES_FOR_NAME")
        if margin < 25:
            fields["reviewReasons"].append("AMBIGUOUS_LAYOUT")
        if name["bbox"][2] > right:
            fields["reviewReasons"].append("NAME_CROSSES_CARD_BOUNDARY")
        if price["top"] < name["bbox"][1]:
            fields["reviewReasons"].append("PRICE_PRECEDES_NAME")
        result.append({"name": name["name"], "advertisedPrice": money(MONEY.fullmatch(price["text"]).group(1)),
                       "currency": "PLN", "page": page.page_number,
                       "bbox": [round(left - 2, 2), round(top - 2, 2), round(right, 2), round(bottom, 2)],
                       "priceBbox": [round(v, 2) for v in bbox([price])],
                       "pageHeader": header, **fields})
    return result, {"page": page.page_number, "textWords": len(words), "priceAnchors": len(prices),
                    "unmatchedPriceAnchors": len(prices) - len(matches)}


AUDIT_FIELDS = ("name", "advertisedPrice", "quantity.amount", "quantity.unit", "quantity.meaning",
                "validity.from", "validity.to", "minimumItems", "multipleItems", "loyaltyRequired", "couponRequired", "limit")


def nested(row, path):
    for key in path.split("."):
        if not isinstance(row, dict):
            return None
        row = row.get(key)
    return row


def apply_audit(result, audit):
    """Compare independent source annotations, never turn parser confidence into verification."""
    if audit["pdfSha256"] != result["pdfSha256"]:
        raise ValueError("Audit belongs to a different source PDF")
    expected = {(r["page"], tuple(r["priceBbox"])): r for r in audit["records"]}
    if len(expected) != len(audit["records"]):
        raise ValueError("Duplicate audit anchors")
    found, outcomes = set(), []
    for row in result["offers"]:
        key = (row["page"], tuple(row["priceBbox"]))
        annotation = expected.get(key)
        if annotation is None:
            continue
        if set(annotation["expected"]) != set(AUDIT_FIELDS):
            raise ValueError("Every audit must check all required fields")
        found.add(key)
        errors = {field: {"expected": value, "actual": nested(row, field)}
                  for field, value in annotation["expected"].items() if nested(row, field) != value}
        row["verification"] = "MISMATCH" if errors else "VERIFIED_AGAINST_SOURCE"
        row["auditErrors"] = errors
        outcomes.append({"id": row["id"], "page": row["page"], "name": row["name"],
                         "outcome": row["verification"], "errors": errors})
    if set(expected) - found:
        raise ValueError("Audited offer missing from current extraction")
    matched = [r for r in result["offers"] if r.get("verification") == "VERIFIED_AGAINST_SOURCE"]
    result["audit"] = {"method": audit["method"], "reviewer": audit["reviewer"], "recordsChecked": len(outcomes),
        "matchingRecords": len(matched), "mismatchingRecords": len(outcomes) - len(matched), "outcomes": outcomes}
    result["summary"]["verified"] = len(matched)
    result["summary"]["verifiedDistinctProducts"] = len({(normalize(r["name"]).lower(), nested(r, "quantity.amount"), nested(r, "quantity.unit")) for r in matched})
    result["summary"]["verifiedWithoutReviewFlags"] = sum(not r["reviewReasons"] for r in matched)


def apply_publication_review(result, review):
    """A reviewed source is an explicit allowlist, bound to the complete PDF and price anchors.

    Parser output for a changed/unreviewed document is never automatically published.
    Source corrections remain distinguishable from the raw extraction in offers.json.
    """
    if (review["pdfSha256"] != result["pdfSha256"] or review["pages"] != result["summary"]["pages"]
            or review["sourceId"] != result["source"]["id"]):
        raise ValueError("UNREVIEWED_LEAFLET: source PDF changed; publication review required")
    key = lambda r: (r["page"], tuple(r["priceBbox"]))
    annotations = {key(r): r for r in review["records"]}
    if len(annotations) != len(review["records"]) or set(annotations) != {key(r) for r in result["offers"]}:
        raise ValueError("INCOMPLETE_REVIEW: every extracted offer must have exactly one disposition")
    application = []
    for row in result["offers"]:
        annotation = annotations[key(row)]
        if annotation["sourcePrice"] != row["advertisedPrice"]:
            raise ValueError("REVIEW_PRICE_MISMATCH")
        row["publicationReview"] = {"decision": annotation["decision"], "reason": annotation["reason"]}
        if annotation["decision"] != "PUBLISH":
            continue
        offer = dict(annotation["offer"])
        if not offer["validFrom"] or not offer["validTo"] or offer["validFrom"] > offer["validTo"]:
            raise ValueError("Invalid reviewed dates")
        if Decimal(offer["amount"]) <= 0 or offer["unit"] not in {"g", "ml", "pcs"}:
            raise ValueError("Invalid reviewed amount")
        if offer["weighted"] and (offer["unit"] != "g" or offer["minimum"] != 1 or offer["multiple"] != 1):
            raise ValueError("Unsupported weighted offer")
        if offer["price"] is None and not (offer["bundlePrice"] and offer["bundleSize"]):
            raise ValueError("Missing exact reviewed price")
        offer.update(page=row["page"], sourcePrice=row["advertisedPrice"], sourceUrl=result["source"]["flyerUrlAbsolute"],
                     productId=f"leaflet:{result['pdfSha256'][:16]}:{row['id']}")
        application.append(offer)
        row["publicationReview"]["correctedFields"] = offer
    result["applicationOffers"] = application
    result["summary"].update(reviewedCandidates=len(annotations), reviewedProducts=len(application),
                             dispositions=dict(Counter(r["decision"] for r in review["records"])),
                             reviewReasons=dict(Counter(r["reason"] for r in review["records"] if r["decision"] != "PUBLISH")))


def fetch(url, allowed_host, target, max_bytes):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != allowed_host or parsed.username or parsed.port not in {None, 443}:
        raise ValueError("Unexpected source URL")
    request = Request(url, headers={"User-Agent": "DishGenie-LeafletPilot/1.0"})
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            raise ValueError("Source redirects are not allowed")
    with build_opener(NoRedirect).open(request, timeout=45) as response:
        if urlparse(response.url).hostname != allowed_host:
            raise ValueError("Unexpected source redirect")
        body = response.read(max_bytes + 1)
    if len(body) > max_bytes:
        raise ValueError("Source exceeds size limit")
    target.write_bytes(body)
    return len(body)


def acquire(url, cache, refresh=False):
    match = re.fullmatch(r"https://www\.lidl\.pl/l/pl/gazetki/([a-z0-9-]+)/ar/0(?:\?_ab=1)?", url)
    if not match:
        raise ValueError("Use an official Polish nationwide leaflet URL")
    slug = match.group(1)
    metadata_path = cache / f"{slug}.json"
    total_bytes = 0
    requests = 0
    source_due = refresh or not metadata_path.exists() or time.time() - metadata_path.stat().st_mtime > 21600
    if source_due:
        api = "https://endpoints.leaflets.schwarz/v4/flyer?" + urlencode({"flyer_identifier": slug, "region_id": 0, "region_code": 0})
        total_bytes += fetch(api, "endpoints.leaflets.schwarz", metadata_path, 5_000_000)
        requests += 1
    payload = json.loads(metadata_path.read_text())
    metadata = payload["flyer"]
    if not payload.get("success") or metadata.get("clientLocale") != "lidl/pl-PL" or not metadata.get("pages"):
        raise ValueError("Unsupported leaflet metadata")
    UUID(metadata["id"])
    pdf_path = cache / f"{metadata['id']}.pdf"
    if source_due or not pdf_path.exists():
        total_bytes += fetch(metadata["pdfUrl"], "assets.leaflets.schwarz", pdf_path, 60_000_000)
        requests += 1
    return metadata, pdf_path, total_bytes, requests


def render_review(result, pdf_path, output):
    import pypdfium2 as pdfium
    document = pdfium.PdfDocument(pdf_path)
    image_path = f"pages/{result['pdfSha256'][:12]}"
    images = output / image_path
    images.mkdir(parents=True, exist_ok=True)
    for n in sorted({o["page"] for o in result["offers"] if o["category"] != "NON_FOOD"}):
        target = images / f"{n:03}.jpg"
        if not target.exists():
            document[n - 1].render(scale=1.8).to_pil().convert("RGB").save(target, quality=82)
    cards = []
    for row in result["offers"]:
        if row["category"] == "NON_FOOD":
            continue
        quantity = row["quantity"]
        amount = f"{quantity['amount']} {quantity['unit']}" if quantity else "?"
        reviewed = row.get("publicationReview", {})
        verified = row.get("verification") == "VERIFIED_AGAINST_SOURCE" or reviewed.get("decision") == "PUBLISH"
        correction = ('<p>Sprawdzone pola do aplikacji:</p><pre>' + html.escape(json.dumps(reviewed["correctedFields"], ensure_ascii=False, indent=2)) + '</pre>') if "correctedFields" in reviewed else ''
        cards.append(f'<article data-verified="{str(verified).lower()}"><h3>{html.escape(row["id"])} · s. {row["page"]} · {html.escape(row["name"])}</h3>'
                     f'<p><b>{row["advertisedPrice"]} PLN · {amount}</b> · {html.escape(str(row["validity"]))}</p>'
                     f'<p>{html.escape(row.get("verification", "UNREVIEWED"))} · {html.escape(", ".join(row["reviewReasons"]) or "STRUCTURE_OK_UNAUDITED")}</p>'
                     f'<p>{html.escape(reviewed.get("decision", ""))} {html.escape(reviewed.get("reason", ""))}</p>'
                     f'{correction}<details><summary>Surowy odczyt i strona źródłowa</summary><pre>{html.escape(row["conditionsText"])}</pre>'
                     f'<img loading="lazy" src="{image_path}/{row["page"]:03}.jpg" alt="Strona {row["page"]}"></details></article>')
    summary = result["summary"]
    checked = f'{summary["reviewedCandidates"]} rozstrzygniętych rekordów' if "reviewedCandidates" in summary else f'{summary["verified"]} potwierdzonych wystąpień'
    intro = (f'<p><b>{summary.get("reviewedProducts", summary.get("verifiedDistinctProducts", 0))} pozycji potwierdzonych do wykorzystania</b> '
             f'({checked}). {summary["candidates"]} rekordów-kandydatów z {summary["pages"]} stron. '
             f'Koszt zewnętrznego API: 0 USD.</p>'
             '<p>Surowy odczyt jest oddzielony od sprawdzonych pól. Ten plik jest raportem ekstrakcji; nie zapisuje cen w bazie aplikacji. Nie oznacza pełnego pokrycia reklam procentowych i samych zdjęć.</p>'
             '<label>Szukaj <input id="search" type="search"></label> '
             '<label>Widok <select id="filter"><option value="all">Wszystkie</option><option value="verified">Potwierdzone</option><option value="other">Pozostałe</option></select></label>')
    controls = '<script>function filter(){const q=document.querySelector("#search").value.toLocaleLowerCase();const v=document.querySelector("#filter").value;document.querySelectorAll("article").forEach(a=>{a.hidden=!a.textContent.toLocaleLowerCase().includes(q)||(v==="verified"&&a.dataset.verified!=="true")||(v==="other"&&a.dataset.verified==="true")})}document.querySelector("#search").oninput=filter;document.querySelector("#filter").onchange=filter;'
    if summary["verified"]:
        controls += 'document.querySelector("#filter").value="verified";filter();'
    controls += '</script>'
    output.joinpath("review.html").write_text('<!doctype html><meta charset="utf-8"><title>Lidl — kontrola importu</title>'
        '<style>body{font:16px system-ui;max-width:1100px;margin:30px auto;padding:16px;background:#fafafa}article{background:white;border:1px solid #ccc;padding:16px;margin:15px 0}pre{white-space:pre-wrap}img{max-width:850px;width:100%}</style>'
        '<h1>Lidl — kontrola importu pełnej gazetki</h1>' + intro + "".join(cards) + controls, encoding="utf-8")


def run(metadata, pdf_path, output, cache, render=False):
    import pdfplumber
    started, cpu = time.perf_counter(), time.process_time()
    if pdf_path.stat().st_size > 60_000_000:
        raise ValueError("PDF exceeds 60 MB limit")
    sha = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    parser_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    cache_key = hashlib.sha256((VERSION + parser_hash + sha + json.dumps(metadata, sort_keys=True)).encode()).hexdigest()
    cached = cache / f"extracted-{cache_key}.json"
    hit = cached.exists()
    if hit:
        result = json.loads(cached.read_text())
    else:
        rows, pages = [], []
        with pdfplumber.open(pdf_path) as pdf:
            if len(pdf.pages) != len(metadata["pages"]) or len(pdf.pages) > 200:
                raise ValueError("Incomplete PDF or oversized leaflet")
            for page in pdf.pages:
                offers, stats = extract_page(page, metadata)
                rows.extend(offers)
                pages.append(stats)
                page.close()
        if not any(p["priceAnchors"] for p in pages):
            raise ValueError("No native price text: OCR is required; no empty catalog produced")
        for index, row in enumerate(sorted(rows, key=lambda r: (r["page"], r["priceBbox"][1], r["priceBbox"][0])), 1):
            row["id"] = f"offer-{index:03}"
            row["sourceUrl"] = metadata["flyerUrlAbsolute"]
            row["status"] = "NEEDS_REVIEW" if row["reviewReasons"] else "STRUCTURE_OK_UNAUDITED"
        result = {"version": VERSION, "pdfSha256": sha, "source": {k: metadata[k] for k in
                  ["id", "title", "pdfUrl", "flyerUrlAbsolute", "offerStartDate", "offerEndDate"]}, "pages": pages, "offers": rows}
        cached.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["measurement"] = {"cacheHit": hit, "extractionSeconds": round(time.perf_counter() - started, 4),
        "cpuSeconds": round(time.process_time() - cpu, 4), "peakRssBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024),
        "paidModelApiCalls": 0, "paidModelApiCostUsd": "0.00", "ocrCalls": 0,
        "pagesProcessed": 0 if hit else len(result["pages"]), "pdfBytes": pdf_path.stat().st_size,
        "excludes": ["engineering time", "manual verification", "hosting and electricity"]}
    result["summary"] = {"pages": len(result["pages"]), "priceAnchors": sum(p["priceAnchors"] for p in result["pages"]),
        "candidates": len(result["offers"]), "categories": dict(Counter(r["category"] for r in result["offers"])),
        "structurallyCompleteUnaudited": sum(not r["reviewReasons"] for r in result["offers"]),
        "published": 0, "verified": 0}
    output.mkdir(parents=True, exist_ok=True)
    output.joinpath("offers.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    if render:
        render_started = time.perf_counter()
        render_review(result, pdf_path, output)
        result["measurement"]["reviewRenderSeconds"] = round(time.perf_counter() - render_started, 4)
    result["measurement"]["runSeconds"] = round(time.perf_counter() - started, 4)
    return result


def main():
    started = time.perf_counter()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--flyer-url")
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--pdf", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache-dir", type=Path, default=Path("reports/leaflet-cache"))
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--render-review", action="store_true")
    parser.add_argument("--audit", type=Path, help="Source annotations for measured correctness, not model confidence")
    parser.add_argument("--publication-review", type=Path, help="Complete reviewed publication allowlist, bound to source SHA-256")
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    if args.flyer_url:
        metadata, pdf_path, downloaded, requests = acquire(args.flyer_url, args.cache_dir, args.refresh)
    elif args.metadata and args.pdf:
        payload = json.loads(args.metadata.read_text())
        metadata, pdf_path, downloaded, requests = payload.get("flyer", payload), args.pdf, 0, 0
    else:
        parser.error("Provide --flyer-url or both --metadata and --pdf")
    result = run(metadata, pdf_path, args.output, args.cache_dir, args.render_review)
    if args.publication_review:
        apply_publication_review(result, json.loads(args.publication_review.read_text()))
        if args.render_review:
            render_review(result, pdf_path, args.output)
    if args.audit:
        apply_audit(result, json.loads(args.audit.read_text()))
        verified = [r for r in result["offers"] if r.get("verification") == "VERIFIED_AGAINST_SOURCE"]
        args.output.joinpath("verified-offers.json").write_text(json.dumps({"source": result["source"], "pdfSha256": result["pdfSha256"],
            "notice": "Source-checked extraction. Not published, not yet mapped to recipe ingredients.", "offers": verified}, ensure_ascii=False, indent=2), encoding="utf-8")
        if args.render_review:
            render_review(result, pdf_path, args.output)
    else:
        args.output.joinpath("verified-offers.json").unlink(missing_ok=True)
    result["measurement"]["downloadedBytes"] = downloaded
    result["measurement"]["sourceHttpRequests"] = requests
    result["measurement"]["totalSeconds"] = round(time.perf_counter() - started, 4)
    args.output.joinpath("offers.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"summary": result["summary"], "measurement": result["measurement"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
