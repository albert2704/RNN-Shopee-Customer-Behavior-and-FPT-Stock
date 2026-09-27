"""Controlled imports + lexical retrieval + graph traversal; no generated Cypher."""

from neo4j import GraphDatabase, Query

from .config import settings
from .evidence import corpus, fold, search_query


def driver(config=None):
    c = config or settings()
    return GraphDatabase.driver(
        c["NEO4J_URI"],
        auth=(c["NEO4J_USERNAME"], c["NEO4J_PASSWORD"]),
        connection_timeout=4,
        connection_acquisition_timeout=5,
        max_transaction_retry_time=0,
    )


def ping():
    with driver() as db:
        db.verify_connectivity()


def retrieve(data, question):
    version, rows = corpus(data)
    f, m, source = data["forecast"], data["model"], data["source"]
    params = {
        "bundle": version,
        "rows": rows,
        "snapshot": "a6:snapshot:" + source["closes_sha256"],
        "source": "a6:source:" + source["provider_sha256"],
        "forecast": "a6:forecast:" + f["id"],
        "run": "a6:run:" + m["run_id"],
        "f": {k: v for k, v in f.items() if k != "id" and not isinstance(v, dict)},
        "source_url": source["source_url"],
        "provider": source["provider"],
        "observed": f["observed_through"],
        "q": search_query(question),
        "evaluations": [
            {"id": f"a6:{m['run_id']}:{method}", "method": method, **metrics}
            for method, metrics in m["test"].items()
        ],
        "horizons": [
            {
                "id": f"a6:outlook:{data['outlook']['run_id']}:{source['closes_sha256']}:{h['sessions']}",
                "run": f"a6:outlook-run:{data['outlook']['run_id']}:{h['sessions']}",
                "months": h["months"],
                "sessions": h["sessions"],
                "predicted_close": h["predicted_close"],
                "predicted_return_pct": h["predicted_return_pct"],
                "observed_through": data["outlook"]["observed_through"],
            }
            for h in (data.get("outlook") or {}).get("horizons", [])
        ],
    }
    with driver() as db, db.session(database=settings()["NEO4J_DATABASE"]) as session:

        def run(query, **extra):
            return session.run(Query(query, timeout=12), {**params, **extra})

        run(
            "CREATE CONSTRAINT a6_entity_id IF NOT EXISTS FOR (n:A6Entity) REQUIRE n.id IS UNIQUE"
        ).consume()
        run(
            "CREATE FULLTEXT INDEX a6_evidence IF NOT EXISTS FOR (n:A6Evidence) ON EACH [n.search_text] "
            "OPTIONS {indexConfig: {`fulltext.analyzer`: 'standard-no-stop-words', `fulltext.eventually_consistent`: false}}"
        ).consume()
        # Each import transaction writes a complete connected evidence bundle atomically.
        run("""
            MERGE (stock:A6Entity:A6Stock {id:'a6:stock:FPT'}) SET stock.symbol='FPT'
            MERGE (s:A6Entity:A6Snapshot {id:$snapshot}) SET s.observed_through=$observed
            MERGE (src:A6Entity:A6Source {id:$source}) SET src.url=$source_url, src.provider=$provider
            MERGE (r:A6Entity:A6ModelRun {id:$run})
            MERGE (f:A6Entity:A6Forecast {id:$forecast}) SET f += $f
            MERGE (f)-[:FOR_STOCK]->(stock) MERGE (f)-[:USES_INPUT]->(s)
            MERGE (f)-[:PRODUCED_BY]->(r) MERGE (s)-[:FROM_SOURCE]->(src)
            FOREACH (h IN $horizons |
                MERGE (hf:A6Entity:A6HorizonForecast {id:h.id}) SET hf += h
                MERGE (hr:A6Entity:A6ModelRun {id:h.run})
                MERGE (hf)-[:FOR_STOCK]->(stock) MERGE (hf)-[:USES_INPUT]->(s)
                MERGE (hf)-[:PRODUCED_BY]->(hr))
            WITH stock,s,src,r,f
            UNWIND $evaluations AS item
            MERGE (e:A6Entity:A6Evaluation {id:item.id}) SET e += item
            MERGE (r)-[:HAS_EVALUATION]->(e)
            WITH DISTINCT stock,s,src,r,f
            UNWIND $rows AS row
            MERGE (c:A6Entity:A6Evidence {id:row.id}) SET c += row
            MERGE (c)-[:ABOUT]->(stock)
            FOREACH (_ IN CASE row.entity WHEN 'forecast' THEN [1] ELSE [] END | MERGE (c)-[:DESCRIBES]->(f))
            FOREACH (_ IN CASE row.entity WHEN 'model' THEN [1] ELSE [] END | MERGE (c)-[:DESCRIBES]->(r))
            FOREACH (_ IN CASE row.entity WHEN 'source' THEN [1] ELSE [] END | MERGE (c)-[:DESCRIBES]->(src))
            FOREACH (h IN [h IN $horizons WHERE h.sessions=row.horizon_sessions] |
                MERGE (hf:A6Entity:A6HorizonForecast {id:h.id}) MERGE (c)-[:DESCRIBES]->(hf))
            FOREACH (_ IN CASE row.entity WHEN 'company' THEN [1] ELSE [] END |
                MERGE (p:A6Entity:A6Publication {id:row.source_url})
                SET p.url=row.source_url, p.published_at=row.published_at, p.publisher='FPT'
                MERGE (c)-[:FROM_SOURCE]->(p) MERGE (p)-[:ABOUT]->(stock))
        """).consume()
        run("CALL db.awaitIndex('a6_evidence', 10)").consume()
        matches = list(run("""
            CALL db.index.fulltext.queryNodes('a6_evidence', $q) YIELD node, score
            WHERE node.bundle=$bundle
            RETURN node.citation_id AS id, score ORDER BY score DESC, id LIMIT 4
        """))
        chosen = list(
            dict.fromkeys(
                ["E1", "E2", "E3", "E7", "E8"]
                + [r["id"] for r in matches]
                + [
                    r["citation_id"]
                    for r in rows
                    if r["entity"] in {"horizon", "company"}
                ]
            )
        )
        # Corporate actions require an explicit topic; do not distract a general
        # investment answer with an old dividend approval that may be misread as paid.
        question_text = fold(question)
        company_ids = {"B2", "B3", "B5", "B6", "B7"}
        if any(
            term in question_text
            for term in ("co tuc", "phat hanh", "chia tach", "dividend")
        ):
            company_ids.add("B8")
        if any(term in question_text for term in ("2025", "ca nam", "thuong nien")):
            company_ids.add("B1")
        if any(
            term in question_text
            for term in (" ai", "tri tue", "chuyen doi so", "data analytics")
        ):
            company_ids.add("B4")
        chosen = [
            key for key in chosen if not key.startswith("B") or key in company_ids
        ]
        documents = [
            dict(r["doc"])
            for r in run(
                """
            MATCH (c:A6Evidence {bundle:$bundle})-[:ABOUT]->(:A6Stock {symbol:'FPT'})
            WHERE c.citation_id IN $ids
            RETURN c{.citation_id,.title,.text,.source_url,.source_pointer} AS doc ORDER BY c.citation_id
        """,
                ids=chosen,
            )
        ]
        graph_facts = run("""
            MATCH (f:A6Forecast {id:$forecast})-[:FOR_STOCK]->(stock:A6Stock)
            MATCH (f)-[:USES_INPUT]->(s:A6Snapshot {id:$snapshot})-[:FROM_SOURCE]->(src:A6Source {id:$source})
            MATCH (f)-[:PRODUCED_BY]->(r:A6ModelRun {id:$run})-[:HAS_EVALUATION]->(e:A6Evaluation)
            RETURN stock.symbol AS symbol, f.observed_through AS observed_through,
                f.last_close AS last_close, f.predicted_close AS predicted_close,
                r.id AS model_id, s.id AS snapshot_id, src.provider AS provider,
                collect(DISTINCT e{.method,.MAE,.RMSE,.count,.direction_accuracy}) AS evaluation
        """).single(strict=True).data()
    if len(documents) < 5 or graph_facts["last_close"] != f["last_close"]:
        raise ValueError("Incomplete or mismatched graph evidence")
    return {
        "documents": documents,
        "facts": graph_facts,
        "trace": {
            "backend": "Neo4j",
            "retrieval": "fulltext + graph traversal",
            "bundle": version,
            "documents": len(documents),
            "paths": [
                "Forecast → FOR_STOCK → FPT",
                "Forecast → USES_INPUT → Snapshot → FROM_SOURCE → Source",
                "Forecast → PRODUCED_BY → ModelRun → HAS_EVALUATION → Evaluation",
            ]
            + (
                [
                    "HorizonForecast → FOR_STOCK → FPT; HorizonForecast → PRODUCED_BY → ModelRun"
                ]
                if params["horizons"]
                else []
            )
            + (
                ["Evidence → FROM_SOURCE → Publication → ABOUT → FPT"]
                if data.get("company_documents")
                else []
            ),
        },
    }
