"""Durable production admission counters in Aura, independent of Render's disk."""

from datetime import timedelta, timezone
from threading import Lock

from fastapi import HTTPException
from neo4j import Query

from chat import graph
from chat.config import settings

_schema_lock = Lock()
_ready_databases = set()


def prepare(session, config):
    target = (config["NEO4J_URI"], config["NEO4J_DATABASE"], config["NEO4J_USERNAME"])
    with _schema_lock:
        if target not in _ready_databases:
            session.run(Query(
                "CREATE CONSTRAINT a6_quota_id IF NOT EXISTS "
                "FOR (n:A6Quota) REQUIRE n.id IS UNIQUE", timeout=8,
            )).consume()
            _ready_databases.add(target)


def reserve(config, now, scope="sequence-chat"):
    day = now.astimezone(timezone(timedelta(hours=7))).date().isoformat()
    minute = int(now.timestamp()) // 60
    buckets = [
        {"id": f"{scope}:day:{day}", "limit": config.daily_limit,
         "expires": int(now.timestamp()) + 3 * 86400},
        {"id": f"{scope}:minute:{minute}", "limit": config.minute_limit,
         "expires": (minute + 11) * 60},
    ]
    try:
        graph_config = settings()
        with graph.driver(graph_config) as db, db.session(database=graph_config["NEO4J_DATABASE"]) as session:
            prepare(session, graph_config)
            # Explicit commit: never retry an ambiguous commit and charge twice.
            with session.begin_transaction(timeout=8) as tx:
                # A property write acquires a lock before any bucket count is read.
                # All reservations take this same lock, held until commit/rollback.
                tx.run("MERGE (q:A6Quota {id:$lock}) "
                       "SET q._lock_=true REMOVE q._lock_",
                       lock=scope + ":lock").consume()
                rows = list(tx.run(
                    "UNWIND $buckets AS b MERGE (q:A6Quota {id:b.id}) "
                    "ON CREATE SET q.count=0, q.expires=b.expires, q.scope=$scope "
                    "RETURN q.count AS count, b.limit AS maximum",
                    buckets=buckets, scope=scope,
                ))
                if len(rows) != 2:
                    raise ValueError("Incomplete usage reservation")
                if any(row["count"] >= row["maximum"] for row in rows):
                    raise HTTPException(429, {"code": "demo_limit", "message":
                        "Bản demo đã đạt giới hạn lượt hỏi. Vui lòng thử lại sau."})
                tx.run("UNWIND $buckets AS b MATCH (q:A6Quota {id:b.id}) "
                       "SET q.count=q.count+1", buckets=buckets).consume()
                tx.run("MATCH (q:A6Quota) WHERE q.scope=$scope AND q.expires < $cutoff DELETE q",
                       scope=scope, cutoff=int(now.timestamp())).consume()
                tx.commit()
    except HTTPException:
        raise
    except Exception as error:
        # Fail closed: restarting or an unavailable database must not reset limits.
        raise HTTPException(503, {"code": "usage_unavailable", "message":
            "Chưa kiểm tra được lượt hỏi còn lại. Vui lòng thử lại sau."}) from error
