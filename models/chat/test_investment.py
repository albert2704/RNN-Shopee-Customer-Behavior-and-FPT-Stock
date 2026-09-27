"""Regression checks for dated horizon evidence, not paid generation."""

import copy
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from chat import investment, evidence, service
from daily.api import app
from daily import api as daily_api

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT / "website/public/data/fpt-daily.json").read_text())
OUTLOOK = json.loads((ROOT / "website/public/data/fpt-outlook.json").read_text())


class InvestmentTests(unittest.TestCase):
    def test_outlook_requires_identical_input_revision(self):
        with patch.object(investment, "read_outlook", return_value=OUTLOOK):
            self.assertIsNotNone(investment.compatible_outlook(DATA)[0])
        for field, value in [
            ("observed_through", "2026-10-01"),
            ("last_close", 1),
            ("source", {"closes_sha256": "wrong"}),
        ]:
            bad = {**OUTLOOK, field: value}
            with patch.object(investment, "read_outlook", return_value=bad):
                self.assertIsNone(investment.compatible_outlook(DATA)[0])
        with patch.object(investment, "read_outlook", side_effect=FileNotFoundError):
            self.assertIsNone(investment.compatible_outlook(DATA)[0])

    def test_company_dates_and_official_sources(self):
        docs = investment.company_documents(today=date(2026, 10, 7))
        self.assertTrue(any(d["category"] == "risk" for d in docs))
        self.assertTrue(any(d["category"] == "comparability" for d in docs))
        old = investment.company_documents(today=date(2026, 4, 9))
        self.assertTrue(all(d["published_at"] <= "2026-04-09" for d in old))
        self.assertLess(len(old), len(docs))
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "company.json"
            bad = copy.deepcopy(docs[0])
            bad["source_url"] = "https://fpt.com.attacker.example/news"
            path.write_text(json.dumps({"schema_version": 1, "documents": [bad]}))
            with patch.object(investment, "COMPANY_FILE", path), self.assertRaises(
                ValueError
            ):
                investment.company_documents(today=date(2026, 10, 7))

    def test_context_keeps_long_horizon_and_company_facts(self):
        data = {
            **DATA,
            "outlook": OUTLOOK,
            "company_documents": investment.company_documents(today=date(2026, 10, 7)),
        }
        version, rows = evidence.corpus(data)
        raw = {"documents": rows, "facts": {}, "trace": {}}
        plain = service.prepare_evidence(raw, data, technical=False)
        h6 = next(d["text"] for d in plain["documents"] if d["citation_id"] == "H6")
        facts = json.loads(h6)
        self.assertEqual(facts["trading_sessions"], 126)
        self.assertEqual(
            facts["forecast"]["estimated_close_vnd"],
            OUTLOOK["horizons"][2]["predicted_close"],
        )
        self.assertIn("Không dùng riêng", facts["quality"])
        self.assertNotIn("MAE", h6)
        self.assertTrue(any(d["citation_id"] == "B7" for d in plain["documents"]))
        self.assertEqual(plain["facts"]["available_months"], [1, 3, 6])
        revised = copy.deepcopy(data)
        revised["company_documents"][0]["text"] += " Đã sửa."
        self.assertNotEqual(version, evidence.corpus(revised)[0])
        revised = copy.deepcopy(data)
        revised["outlook"]["horizons"][2]["predicted_close"] += 1
        self.assertNotEqual(version, evidence.corpus(revised)[0])

    def test_horizon_selection_remembers_user_but_not_assistant_suggestions(self):
        messages = [
            {"role": "user", "content": "Tôi có 200 triệu"},
            {"role": "assistant", "content": "Bạn muốn giữ 6 tháng không?"},
        ]
        self.assertIsNone(service.requested_horizon(messages))
        messages += [
            {"role": "user", "content": "Tôi dự định giữ sáu tháng"},
            {"role": "assistant", "content": "Một tháng cũng có dự báo."},
            {"role": "user", "content": "Tôi đã có dự phòng."},
        ]
        self.assertEqual(service.requested_horizon(messages), 6)
        self.assertEqual(
            service.requested_horizon(
                messages + [{"role": "user", "content": "Còn 3 tháng thì sao?"}]
            ),
            3,
        )
        self.assertEqual(
            service.requested_horizon(
                messages + [{"role": "user", "content": "Một năm thì sao?"}]
            ),
            12,
        )
        self.assertEqual(
            service.requested_horizon(
                messages + [{"role": "user", "content": "Ngày mai thế nào?"}]
            ),
            0,
        )

    def test_outlook_endpoint_refuses_mismatch_and_returns_company_sources(self):
        with TestClient(app) as client, patch.object(
            daily_api.pipeline, "read_latest", return_value=DATA
        ):
            with patch.object(
                daily_api, "compatible_outlook", return_value=(OUTLOOK, None)
            ):
                result = client.get("/api/fpt/outlook")
                self.assertEqual(result.status_code, 200)
                self.assertEqual(len(result.json()["horizons"]), 3)
                self.assertTrue(result.json()["company_documents"])
            with patch.object(
                daily_api, "compatible_outlook", return_value=(None, "Không khớp")
            ):
                self.assertEqual(client.get("/api/fpt/outlook").status_code, 503)


if __name__ == "__main__":
    unittest.main()
