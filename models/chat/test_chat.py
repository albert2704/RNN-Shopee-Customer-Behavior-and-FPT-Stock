"""No paid API calls. Opt-in Neo4j test exercises a real graph with isolated IDs."""

import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
import uuid
from dataclasses import replace
from decimal import Decimal
from unittest.mock import PropertyMock, patch

from fastapi.testclient import TestClient

from chat import api, config, graph, service
from chat.calculator import parse_amount, scenario
from chat.evidence import corpus, fold, search_query
from daily.api import app

DATA = json.loads(
    (
        Path(__file__).resolve().parents[2] / "website/public/data/fpt-daily.json"
    ).read_text()
)
# Pin arithmetic examples independently of the website's manually refreshed market snapshot.
DATA["forecast"].update(
    last_close=60400.0,
    observed_through="2026-10-06",
    predicted_close=60455.780087438434,
    predicted_return_pct=0.09235113814309796,
)
DATA["source"]["last_date"] = "2026-10-06"


def messages(*texts):
    return [{"role": "user", "content": text} for text in texts]


def mock_evidence():
    version, docs = corpus(DATA)
    return {"documents": docs, "facts": {"symbol": "FPT"}, "trace": {"bundle": version}}


class ChatTests(unittest.TestCase):
    def test_amount_units_and_rejections(self):
        for text, value in [
            ("Tôi có 200 triệu", 200_000_000),
            ("1,5 tỷ", 1_500_000_000),
            ("200.000.000 VND", 200_000_000),
            ("200tr", 200_000_000),
        ]:
            self.assertEqual(parse_amount(text), Decimal(value))
        for text in [
            "200",
            "-200 triệu",
            "−200 triệu",
            "âm 200 triệu",
            "1.000 triệu",
            "0 triệu",
            "200 triệu và 50 triệu",
            "50 triệu USD",
            "$50 triệu",
        ]:
            self.assertIsNone(parse_amount(text), text)

    def test_budget_arithmetic(self):
        result = scenario(
            messages("Tôi có 200 triệu, nên đầu tư như thế nào?"), DATA["forecast"]
        )
        self.assertEqual(result["whole_shares"], 3311)
        self.assertEqual(result["cost_vnd"], 199_984_400)
        self.assertEqual(result["remaining_vnd"], 15_600)
        self.assertNotIn("stress", result)
        self.assertLessEqual(result["cost_vnd"], result["budget_vnd"])

    def test_multi_turn_amount_roles_and_corrections(self):
        for followup in [
            "Tôi chịu lỗ tối đa 20 triệu",
            "Giữ dự phòng 50 triệu",
            "Nếu giá FPT lên 70000 VND?",
            "Tôi chỉ muốn dùng một nửa",
            "Không, tôi chỉ có 100",
            "Dùng 20% vốn",
            "Tôi nợ 100 triệu",
            "Nếu giá là 50000 thì mua được bao nhiêu cổ phiếu?",
            "50 triệu USD mua được bao nhiêu cổ phiếu?",
        ]:
            self.assertIsNone(
                scenario(messages("Tôi có 200 triệu", followup), DATA["forecast"]),
                followup,
            )
        result = scenario(
            messages("Tôi có 200 triệu", "Dùng 100 triệu mua FPT"), DATA["forecast"]
        )
        self.assertEqual(result["budget_vnd"], 100_000_000)
        self.assertEqual(
            scenario(
                messages("Tôi có 200 triệu", "Mua được bao nhiêu cổ phiếu?"),
                DATA["forecast"],
            )["budget_vnd"],
            200_000_000,
        )

    def test_normalized_search_and_no_lucene_operators(self):
        self.assertEqual(fold("Đầu tư cổ phiếu"), "dau tu co phieu")
        self.assertEqual(
            search_query('FPT ") OR *:* MATCH (n) DELETE n'),
            '"fpt" OR "or" OR "match" OR "n" OR "delete"',
        )

    def test_corpus_dates_baselines_and_revision(self):
        version, rows = corpus(DATA)
        lookup = {r["citation_id"]: r for r in rows}
        self.assertIn(DATA["forecast"]["observed_through"], lookup["E2"]["text"])
        self.assertIn(
            str(DATA["model"]["test"]["persistence"]["MAE"]), lookup["E3"]["text"]
        )
        revised = copy.deepcopy(DATA)
        revised["forecast"]["last_close"] += 100
        self.assertNotEqual(version, corpus(revised)[0])

    def test_config_hot_reload_without_exposing_environment(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / ".env"
            with patch.object(config, "ENV_FILE", env), patch.dict(
                os.environ, {}, clear=True
            ):
                env.write_text("OPENAI_API_KEY=first-test-secret\n")
                self.assertEqual(
                    config.settings()["OPENAI_API_KEY"], "first-test-secret"
                )
                env.write_text("OPENAI_API_KEY=second-test-secret\n")
                self.assertEqual(
                    config.settings()["OPENAI_API_KEY"], "second-test-secret"
                )

    def test_response_is_grounded_and_citations_validated(self):
        good = service.Answer(
            paragraphs=[
                service.Paragraph(text="Đây là dữ liệu FPT đã lưu.", citations=["E2"])
            ],
        )
        with patch.object(
            service.pipeline, "read_latest", return_value=DATA
        ), patch.object(
            service, "retrieve", return_value=mock_evidence()
        ), patch.object(
            service, "generate", return_value=good
        ) as generate:
            result = service.answer(
                service.ChatRequest(messages=messages("Tôi có 200 triệu"))
            )
            self.assertIsNone(result["scenario"])
            self.assertNotIn("comparison", result)
            self.assertTrue(all("Tôi định" not in text for text in result["followups"]))
            self.assertNotIn("C1", [d["citation_id"] for d in result["sources"]])
            self.assertIsNone(generate.call_args.args[2])
            good.paragraphs[0].citations = ["invented"]
            with self.assertRaises(ValueError):
                service.answer(service.ChatRequest(messages=messages("FPT?")))

    def test_plain_context_keeps_forecast_and_limitations_without_metric_dump(self):
        raw = mock_evidence()
        evidence = service.prepare_evidence(raw, DATA, technical=False)
        serialized = json.dumps(evidence["documents"], ensure_ascii=False)
        for unwanted in [
            "MAE",
            "RMSE",
            "hidden_size",
            "search_text",
            "whole_shares",
            "10%",
        ]:
            self.assertNotIn(unwanted, serialized)
        self.assertNotIn("evaluation", evidence["facts"])
        self.assertEqual(
            evidence["facts"]["observed_price"]["close_vnd"],
            DATA["forecast"]["last_close"],
        )
        self.assertEqual(
            evidence["facts"]["forecast"]["estimated_close_vnd"],
            DATA["forecast"]["predicted_close"],
        )
        self.assertIn("06/10/2026", serialized)
        self.assertIn("chưa chính xác hơn", serialized)
        self.assertIsNone(evidence["facts"]["forecast"]["target_date"])
        self.assertEqual(evidence["trace"], raw["trace"])
        # Full technical evidence remains available for a direct question.
        technical = service.prepare_evidence(raw, DATA, technical=True)
        self.assertIn(str(DATA["model"]["test"]["rnn"]["MAE"]), json.dumps(technical))

    def test_current_question_controls_detail_and_calculation(self):
        for question in [
            "Tôi có 200 triệu, nên đầu tư như thế nào?",
            "Khoảng 6 tháng, tôi đã có tiền dự phòng rồi.",
            "FPT hay HPG đáng mua hơn lúc này?",
            "Dự báo có đáng tin không?",
            "Với số tiền trên, đừng tính mua được bao nhiêu cổ phiếu, chỉ nói rủi ro",
            "Không cần tính số lượng cổ phiếu, có nên mua FPT không?",
        ]:
            self.assertEqual(
                service.reply_mode(messages("Mua được bao nhiêu cổ phiếu?", question)),
                {"technical": False, "calculation": False},
            )
        self.assertTrue(
            service.reply_mode(messages("MAE của RNN là bao nhiêu?"))["technical"]
        )
        self.assertTrue(
            service.reply_mode(messages("100 triệu mua được bao nhiêu cổ phiếu?"))[
                "calculation"
            ]
        )
        self.assertTrue(
            service.reply_mode(messages("Mua được bao nhiêu cổ phiếu?", "50 triệu"))[
                "calculation"
            ]
        )
        self.assertFalse(
            service.reply_mode(messages("Đầu tư thế nào?", "50 triệu"))["calculation"]
        )

        self.assertTrue(
            service.reply_mode(
                messages("Mua được bao nhiêu cổ phiếu?", "50 triệu", "Tôi có 100 triệu")
            )["calculation"]
        )
        self.assertTrue(
            service.reply_mode(
                [
                    {"role": "user", "content": "Mua được bao nhiêu cổ phiếu?"},
                    {"role": "assistant", "content": "Bạn muốn dùng bao nhiêu tiền?"},
                    {"role": "user", "content": "Tôi có 50 triệu"},
                ]
            )["calculation"]
        )

    def test_consumer_context_preserves_past_forecast_outcomes(self):
        data = copy.deepcopy(DATA)
        data["ledger"].append(
            {
                "observed_through": "2026-09-30",
                "predicted_close": 61000,
                "actual": 60800,
                "actual_date": "2026-10-01",
                "prospective": True,
                "comparable": False,
            }
        )
        evidence = service.prepare_evidence(mock_evidence(), data, technical=False)
        ledger = next(
            doc["text"] for doc in evidence["documents"] if doc["citation_id"] == "E6"
        )
        self.assertIn("2026-10-01", ledger)
        self.assertIn("60800", ledger)
        self.assertIn('"comparable": false', ledger)

    def test_explicit_share_question_gets_exact_calculation_only(self):
        good = service.Answer(
            paragraphs=[
                service.Paragraph(text="Phép tính theo yêu cầu.", citations=["C1"])
            ]
        )
        with patch.object(
            service.pipeline, "read_latest", return_value=DATA
        ), patch.object(
            service, "retrieve", side_effect=lambda *_: mock_evidence()
        ), patch.object(
            service, "generate", return_value=good
        ) as generate:
            result = service.answer(
                service.ChatRequest(
                    messages=messages(
                        "Tính giúp tôi 50 triệu mua được bao nhiêu cổ phiếu FPT theo giá đã lưu."
                    )
                )
            )
            self.assertEqual(result["scenario"]["whole_shares"], 827)
            self.assertEqual(result["scenario"]["remaining_vnd"], 49_200)
            self.assertNotIn("stress", result["scenario"])
            self.assertEqual(generate.call_args.args[2], result["scenario"])
            self.assertIn("C1", [doc["citation_id"] for doc in result["sources"]])
            good.paragraphs[0].citations = ["E2"]
            # A later investment question does not inherit the calculator's mode or numbers.
            later = service.answer(
                service.ChatRequest(
                    messages=messages(
                        "50 triệu mua được bao nhiêu cổ phiếu?", "Vậy có nên mua không?"
                    )
                )
            )
            self.assertIsNone(later["scenario"])
            self.assertNotIn("C1", [doc["citation_id"] for doc in later["sources"]])

    def test_real_sdk_serialization_with_mock_transport(self):
        import httpx2
        from openai import OpenAI

        def handler(request):
            body = json.loads(request.content)
            self.assertEqual(request.url.path, "/v1/responses")
            self.assertFalse(body["store"])
            self.assertEqual(body["text"]["format"]["type"], "json_schema")
            self.assertTrue(body["text"]["format"]["strict"])
            self.assertIn("retrieved_documents", body["input"][0]["content"])
            answer = {
                "paragraphs": [{"text": "Dữ liệu FPT đã lưu.", "citations": ["E2"]}],
            }
            return httpx2.Response(
                200,
                json={
                    "id": "test-response",
                    "object": "response",
                    "created_at": 0,
                    "model": "gpt-4.1-mini",
                    "status": "completed",
                    "error": None,
                    "incomplete_details": None,
                    "output": [
                        {
                            "id": "test-message",
                            "type": "message",
                            "role": "assistant",
                            "status": "completed",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": json.dumps(answer),
                                    "annotations": [],
                                }
                            ],
                        }
                    ],
                },
            )

        client = OpenAI(
            api_key="not-a-real-key",
            http_client=httpx2.Client(transport=httpx2.MockTransport(handler)),
        )
        with patch.object(service, "OpenAI", return_value=client):
            answer = service.generate(
                messages("FPT?"),
                mock_evidence(),
                None,
                {},
                {"OPENAI_API_KEY": "not-a-real-key", "OPENAI_MODEL": "gpt-4.1-mini"},
            )
        self.assertEqual(answer.paragraphs[0].citations, ["E2"])

    def test_status_checks_configured_graph_database(self):
        graph_config = {"NEO4J_DATABASE": "classroom-database"}
        with patch.object(graph, "settings", return_value=graph_config), patch.object(
            graph, "driver"
        ) as driver, patch.object(
            api,
            "settings",
            return_value={"OPENAI_API_KEY": "test-key", "OPENAI_MODEL": "test-model"},
        ), patch.object(api.pipeline, "read_latest", return_value=DATA):
            db = driver.return_value.__enter__.return_value
            session = db.session.return_value.__enter__.return_value
            self.assertTrue(api.status()["ready"])
            driver.assert_called_once_with(graph_config)
            db.session.assert_called_once_with(database="classroom-database")
            query = session.run.call_args.args[0]
            self.assertEqual(query.text, "RETURN 1")
            self.assertGreater(query.timeout, 0)
            self.assertLessEqual(query.timeout, 5)

            session.run.return_value.consume.side_effect = RuntimeError(
                "database unavailable"
            )
            unavailable = api.status()
            self.assertFalse(unavailable["graph_connected"])
            self.assertFalse(unavailable["ready"])

    def test_readiness_warning_excludes_private_exception_data(self):
        private = "secret-password neo4j+s://private-host private-config"
        for code in ("Neo.ClientError.Security.Unauthorized", private):
            with self.subTest(code=code), patch.object(
                api.graph, "ping", side_effect=api.Neo4jError(private)
            ), patch.object(
                api.Neo4jError, "code", new_callable=PropertyMock, return_value=code
            ), patch.object(
                api, "settings",
                return_value={"OPENAI_API_KEY": private, "OPENAI_MODEL": "test-model"},
            ), patch.object(api.pipeline, "read_latest", return_value=DATA), patch.object(
                api, "_readiness_log_state", (None, 0.0)
            ), self.assertLogs(api.logger, level="WARNING") as logged:
                self.assertFalse(api.status()["ready"])
                self.assertFalse(api.status()["ready"])
            self.assertEqual(len(logged.output), 1)
            self.assertNotIn(private, logged.output[0])
            self.assertIn("class=Neo4jError", logged.output[0])
            expected = code if code != private else "unavailable"
            self.assertIn("code=" + expected, logged.output[0])
            self.assertIsNone(logged.records[0].exc_info)

    def test_request_bounds_and_missing_key(self):
        with TestClient(app) as client, patch.object(
            api, "settings", return_value={"OPENAI_API_KEY": ""}
        ):
            headers = {"Origin": "http://127.0.0.1:4173"}
            body = {"messages": messages("Tôi có 200 triệu")}
            self.assertEqual(client.post("/api/chat", json=body).status_code, 403)
            self.assertEqual(
                client.post(
                    "/api/chat", json=body, headers={"Origin": "https://example.com"}
                ).status_code,
                403,
            )
            self.assertEqual(
                client.post("/api/chat", json=body, headers=headers).json()["detail"][
                    "code"
                ],
                "missing_key",
            )
            self.assertEqual(
                client.post(
                    "/api/chat",
                    json={"messages": messages("x" * 4001)},
                    headers=headers,
                ).status_code,
                422,
            )
            self.assertEqual(
                client.post(
                    "/api/chat",
                    content="x" * 80001,
                    headers={**headers, "Content-Type": "application/json"},
                ).status_code,
                413,
            )

    def test_api_success_failure_and_concurrency(self):
        headers = {"Origin": "http://127.0.0.1:4173"}
        body = {"messages": messages("FPT?")}
        with TestClient(app) as client, patch.object(
            api, "settings", return_value={"OPENAI_API_KEY": "test-secret"}
        ), patch.object(api.service, "answer", return_value={"paragraphs": []}):
            api.last_attempt = 0
            self.assertEqual(
                client.post("/api/chat", json=body, headers=headers).status_code, 200
            )
            self.assertEqual(
                client.post("/api/chat", json=body, headers=headers).status_code, 200
            )
            api.chat_lock.acquire()
            try:
                self.assertEqual(
                    client.post("/api/chat", json=body, headers=headers).status_code,
                    409,
                )
            finally:
                api.chat_lock.release()
            api.last_attempt = 0
            with patch.object(
                api.service,
                "answer",
                side_effect=RuntimeError("private-key-must-not-appear"),
            ):
                response = client.post("/api/chat", json=body, headers=headers)
                self.assertEqual(response.status_code, 502)
                self.assertNotIn("private-key", response.text)
                self.assertFalse(api.chat_lock.locked())

    def test_optional_request_limits_keep_cooldown(self):
        headers = {"Origin": "http://127.0.0.1:4173"}
        body = {"messages": messages("FPT?")}
        with TestClient(app) as client, patch.object(
            app.state, "deployment", replace(app.state.deployment, enforce_limits=True)
        ), patch.object(api, "settings", return_value={"OPENAI_API_KEY": "test-secret"}), patch.object(
            api, "reserve_chat"
        ) as reserve, patch.object(api.service, "answer", return_value={"paragraphs": []}), patch.object(
            api.time, "monotonic", return_value=10.0
        ):
            api.last_attempt = 0
            self.assertEqual(client.post("/api/chat", json=body, headers=headers).status_code, 200)
            response = client.post("/api/chat", json=body, headers=headers)
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.json()["detail"]["code"], "cooldown")
            reserve.assert_called_once()

    @unittest.skipUnless(
        os.environ.get("A6_TEST_NEO4J") == "1",
        "set A6_TEST_NEO4J=1 for local integration",
    )
    def test_live_graph_refresh_paths_remain_scoped(self):
        data = copy.deepcopy(DATA)
        prefix = "chat-test-" + uuid.uuid4().hex
        data["forecast"]["id"] = prefix
        data["model"]["run_id"] = prefix
        versions = []
        try:
            for revision in range(3):
                # Same frozen forecast, but raw source changes, then older closes change.
                data["source"]["provider_sha256"] = f"{prefix}-raw-{revision}"
                data["source"]["closes_sha256"] = f"{prefix}-closes-{revision // 2}"
                versions.append(corpus(data)[0])
                result = graph.retrieve(data, "Nguồn dữ liệu FPT và kiểm tra RNN")
                self.assertEqual(
                    result["facts"]["last_close"], data["forecast"]["last_close"]
                )
                self.assertEqual(len(result["facts"]["evaluation"]), 4)
                self.assertIn("E4", [d["citation_id"] for d in result["documents"]])
        finally:
            with graph.driver() as db:
                db.execute_query(
                    "MATCH (n:A6Entity) WHERE n.id CONTAINS $prefix OR n.bundle IN $versions DETACH DELETE n",
                    prefix=prefix,
                    versions=versions,
                    database_="neo4j",
                )


if __name__ == "__main__":
    unittest.main()
