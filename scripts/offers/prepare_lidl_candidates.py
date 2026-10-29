#!/usr/bin/env python3
"""Read a saved official Lidl HTML page into a REVIEW file. Never publishes prices.

Usage: python3 scripts/offers/prepare_lidl_candidates.py saved-page.html candidates.json
Only embedded JSON is parsed; no page JavaScript is executed and no network requests
are made. The output is deliberately NOT accepted by the publication API.
"""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path


class NuxtData(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        self.inside = tag == "script" and dict(attrs).get("id") == "__NUXT_DATA__"

    def handle_endtag(self, tag):
        if tag == "script":
            self.inside = False

    def handle_data(self, text):
        if self.inside:
            self.parts.append(text)


def resolve(data, index, visited=frozenset()):
    if not isinstance(index, int) or index < 0:
        return None
    if index >= len(data) or index in visited or len(visited) > 60:
        raise ValueError("Unsupported reference in source JSON")
    value = data[index]
    visited = visited | {index}
    if isinstance(value, dict):
        return {key: resolve(data, ref, visited) for key, ref in value.items()}
    if isinstance(value, list):
        if value and isinstance(value[0], str):
            if value[0] not in {"Ref", "Reactive", "ShallowReactive", "ShallowRef"} or len(value) != 2:
                raise ValueError("Unsupported Nuxt wrapper")
            return resolve(data, value[1], visited)
        return [resolve(data, ref, visited) for ref in value]
    return value


def candidates(html):
    parser = NuxtData()
    parser.feed(html)
    if not parser.parts:
        raise ValueError("No supported product data. Review source format; do not publish prices.")
    data = json.loads("".join(parser.parts))
    if not isinstance(data, list):
        raise ValueError("Unsupported source format")
    result = []
    seen = set()
    for index, value in enumerate(data):
        if not isinstance(value, dict) or not {"productId", "price", "storeStartDate", "storeEndDate"} <= value.keys():
            continue
        product = resolve(data, index)
        product_id = product["productId"]
        if product_id in seen:
            continue
        seen.add(product_id)
        path = product.get("canonicalUrl", "")
        if not isinstance(path, str) or not path.startswith("/p/") or "?" in path or "#" in path:
            raise ValueError("Unexpected product URL")
        result.append({
            "status": "NEEDS_REVIEW", "store": "LIDL", "sourceProductId": product_id,
            "sourceUrl": "https://www.lidl.pl" + path,
            "productName": product.get("fullTitle"),
            "evidence": {key: product.get(key) for key in (
                "price", "storeStartDate", "storeEndDate", "regionsV2", "regionsPrices", "lidlPlus", "disclaimers", "stockAvailability")},
            "requiredReview": ["canonical ingredient mapping", "fixed package size (not a per-kg loose price)",
                "in-store dates AND price validity in Europe/Warsaw", "nationwide applicability",
                "loyalty/coupon eligibility", "minimum, multiples, limits and other conditions"],
        })
    if not result:
        raise ValueError("No candidates found. Source changes must not produce an empty published feed.")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.input.stat().st_size > 10_000_000:
        raise ValueError("Input exceeds 10 MB")
    review = {"schemaVersion": 1, "preparedAt": datetime.now(timezone.utc).isoformat(),
              "notice": "Unverified candidates; preparation time is NOT verification time.",
              "candidates": candidates(args.input.read_text(encoding="utf-8"))}
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(review, output, ensure_ascii=False, indent=2)
    print(f"Prepared {len(review['candidates'])} candidates for review; published 0 offers.")


if __name__ == "__main__":
    main()
