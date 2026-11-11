import json
from pathlib import Path
import unittest

from import_lidl_leaflet import apply_audit, apply_publication_review, AUDIT_FIELDS, classify, extract_fields, extract_page, money


class Page:
    def __init__(self, number):
        self.data = json.loads((Path(__file__).parent / f"fixtures/lidl-2026-11-12-page-{number}.json").read_text())
        self.page_number, self.width, self.height = number, self.data["width"], self.data["height"]

    def extract_words(self, **kwargs):
        return self.data["words"]


class LeafletImportTest(unittest.TestCase):
    metadata = {"offerStartDate": "2026-11-12"}

    def test_six_dairy_cards_do_not_borrow_the_next_cards_quantity(self):
        rows, stats = extract_page(Page(55), self.metadata)
        self.assertEqual(stats["priceAnchors"], 6)
        milk = next(r for r in rows if r["name"] == "ŁACIATE Mleko UHT 3,2%")
        self.assertEqual(milk["advertisedPrice"], "2.25")
        self.assertEqual(milk["quantity"]["amount"], "1000")
        self.assertEqual(milk["quantity"]["unit"], "ml")
        self.assertEqual(milk["minimumItems"], 6)
        self.assertEqual(milk["multipleItems"], 6)
        self.assertEqual(milk["validity"]["to"], "2026-11-25")
        self.assertNotIn("BAKOMA", milk["conditionsText"])
        skyr = next(r for r in rows if "Skyr" in r["name"])
        self.assertEqual(skyr["quantity"]["amount"], "150")
        self.assertNotIn("NAME_CROSSES_CARD_BOUNDARY", skyr["reviewReasons"])

    def test_second_date_banner_is_not_replaced_by_the_first_page_header(self):
        rows, _ = extract_page(Page(9), self.metadata)
        milk = next(r for r in rows if "Mleko" in r["name"])
        self.assertEqual(milk["validity"]["to"], "2026-11-25")

    def test_mixed_two_and_three_column_layout_keeps_quantities_separate(self):
        rows, _ = extract_page(Page(83), self.metadata)
        antipasti = next(r for r in rows if "Antipasti" in r["name"])
        self.assertEqual(antipasti["quantity"]["amount"], "150")
        self.assertNotIn("HORTEX", antipasti["conditionsText"])
        vegetables = next(r for r in rows if "Airfryera" in r["name"])
        self.assertEqual(vegetables["quantity"]["amount"], "450")
        self.assertEqual(vegetables["advertisedPrice"], "5.19")

    def test_effective_free_item_price_is_not_silently_accepted_as_simple_price(self):
        rows, _ = extract_page(Page(37), self.metadata)
        effective = next(r for r in rows if r["advertisedPrice"] == "2.49")
        self.assertEqual(effective["name"], "Kaki")
        self.assertTrue(effective["reviewReasons"])

    def test_prices_next_to_titles_do_not_attach_to_the_next_row(self):
        rows, _ = extract_page(Page(53), self.metadata)
        self.assertEqual(next(r for r in rows if r['advertisedPrice'] == '7.49')['name'], 'Dorsz pacyficzny, filet bez skóry')
        rows, _ = extract_page(Page(46), self.metadata)
        self.assertIn('wysokobłonnikowa', next(r for r in rows if r['advertisedPrice'] == '1.19')['name'])

    def test_unknown_mass_and_open_ended_dates_are_retained_without_invention(self):
        result = extract_fields("Kurczak filet", ["1 kg", "Od czw., 12.11"], "", self.metadata)
        self.assertEqual(result["quantity"]["meaning"], "WEIGHT_PRICE_BASIS_PACK_WEIGHT_UNKNOWN")
        self.assertIsNone(result["validity"]["to"])
        self.assertIn("VARIABLE_PACK_WEIGHT", result["reviewReasons"])
        self.assertIn("END_DATE_NOT_STATED", result["reviewReasons"])

    def test_classification_does_not_turn_body_cosmetics_into_food(self):
        self.assertEqual(classify("Kredki kąpielowe do malowania twarzy i ciała"), "NON_FOOD")
        self.assertEqual(classify("Napój migdałowy bez dodatku cukrów"), "PLANT_DRINKS")
        self.assertEqual(classify("Pizza z kurczakiem"), "READY_MEALS")
        self.assertEqual(money("14,90"), "14.90")

    def test_verification_requires_a_matching_source_and_all_independent_fields(self):
        row = {"id": "x", "page": 1, "priceBbox": [1, 2, 3, 4], "name": "Test", "reviewReasons": [], "advertisedPrice": "2.00"}
        result = {"pdfSha256": "source", "offers": [row], "summary": {}}
        expected = {field: None for field in AUDIT_FIELDS}
        expected.update({"name": "Test", "advertisedPrice": "1.00"})
        audit = {"pdfSha256": "source", "method": "manual", "reviewer": "test", "records": [
            {"page": 1, "priceBbox": [1, 2, 3, 4], "expected": expected}]}
        apply_audit(result, audit)
        self.assertEqual(result["summary"]["verified"], 0)
        self.assertEqual(row["verification"], "MISMATCH")
        audit["pdfSha256"] = "different"
        with self.assertRaises(ValueError):
            apply_audit(result, audit)

    def test_publication_review_refuses_changed_sources_and_incomplete_coverage(self):
        review = json.loads((Path(__file__).resolve().parents[2] / 'backendApi/src/main/resources/offers/lidl-2026-11-12-review.json').read_text())
        result = {'pdfSha256': 'changed', 'summary': {'pages': 97}, 'source': {'id': review['sourceId']}, 'offers': []}
        with self.assertRaisesRegex(ValueError, 'UNREVIEWED_LEAFLET'):
            apply_publication_review(result, review)
        result['pdfSha256'] = review['pdfSha256']
        with self.assertRaisesRegex(ValueError, 'INCOMPLETE_REVIEW'):
            apply_publication_review(result, review)

    def test_real_source_annotations_match_dairy_cards_and_reject_the_ambiguous_free_price(self):
        annotation = json.loads((Path(__file__).parent / "fixtures/lidl-2026-11-12-audit.json").read_text())
        for number in [55, 37]:
            rows, _ = extract_page(Page(number), self.metadata)
            for index, row in enumerate(rows):
                row["id"] = str(index)
            audit = {**annotation, "records": [r for r in annotation["records"] if r["page"] == number]}
            result = {"pdfSha256": annotation["pdfSha256"], "offers": rows, "summary": {}}
            apply_audit(result, audit)
            if number == 55:
                self.assertEqual(result["summary"]["verified"], 4)
            else:
                self.assertEqual(result["audit"]["mismatchingRecords"], 1)
                self.assertEqual(result["summary"]["verified"], 1)  # The correctly read plum offer.


if __name__ == "__main__":
    unittest.main()
