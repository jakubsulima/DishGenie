import json
import unittest
from prepare_lidl_candidates import candidates


class PrepareCandidatesTest(unittest.TestCase):
    def test_preserves_price_and_store_dates_as_separate_evidence(self):
        data = [{"productId": 1, "price": 2, "storeStartDate": 3, "storeEndDate": 4,
                 "canonicalUrl": 5, "fullTitle": 6}, 123,
                {"price": 7, "packaging": 8}, 100, 200, "/p/test/p123", "Synthetic fixture", 5.99,
                {"text": 9}, "1 kg"]
        html = '<script id="__NUXT_DATA__" type="application/json">' + json.dumps(data) + '</script>'
        result = candidates(html)[0]
        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertEqual(result["evidence"]["storeStartDate"], 100)
        self.assertEqual(result["evidence"]["price"]["packaging"]["text"], "1 kg")
        self.assertNotIn("verifiedAt", result)
        self.assertNotIn("packageAmount", result)

    def test_changed_or_empty_source_fails_closed(self):
        for html in ['<p>No data</p>', '<script id="__NUXT_DATA__">[]</script>']:
            with self.assertRaises(ValueError):
                candidates(html)


if __name__ == "__main__":
    unittest.main()
