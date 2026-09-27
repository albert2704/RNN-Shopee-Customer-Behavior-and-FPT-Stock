"""Start a dedicated loopback Neo4j container; never prints secrets."""

import json
import os
import secrets
import shutil
import subprocess

from dotenv import set_key

from .config import ENV_FILE, settings

NAME = "assignment6-neo4j"
IMAGE = "neo4j:2026.09.0"


def main():
    if not ENV_FILE.exists():
        # O_EXCL avoids replacing a configuration the user just created.
        fd = os.open(ENV_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(ENV_FILE.with_name(".env.example").read_text())
    os.chmod(ENV_FILE, 0o600)
    config = settings()
    if not config["NEO4J_PASSWORD"]:
        set_key(str(ENV_FILE), "NEO4J_PASSWORD", secrets.token_urlsafe(30))
        config = settings()
    docker = shutil.which("docker")
    if not docker:
        raise SystemExit(
            "Install and start Docker Desktop, then run this command again."
        )
    result = subprocess.run(
        [docker, "container", "inspect", "--format", "{{json .Config.Labels}}", NAME],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        labels = json.loads(result.stdout) or {}
        if labels.get("com.assignment6.component") != "neo4j":
            raise SystemExit(
                "Container name already belongs to another service; left unchanged."
            )
        subprocess.run([docker, "start", NAME], check=True)
    else:
        subprocess.run(
            [
                docker,
                "run",
                "-d",
                "--name",
                NAME,
                "--label",
                "com.assignment6.component=neo4j",
                "-p",
                "127.0.0.1:7474:7474",
                "-p",
                "127.0.0.1:7687:7687",
                "--env",
                "NEO4J_AUTH",
                "--env",
                "NEO4J_server_memory_heap_initial__size=256m",
                "--env",
                "NEO4J_server_memory_heap_max__size=512m",
                "--env",
                "NEO4J_server_memory_pagecache_size=256m",
                "-v",
                "assignment6-neo4j-data:/data",
                IMAGE,
            ],
            check=True,
            env={**os.environ, "NEO4J_AUTH": "neo4j/" + config["NEO4J_PASSWORD"]},
        )
    print(
        "Neo4j started on loopback. Add OPENAI_API_KEY to models/.env; keep it private."
    )


if __name__ == "__main__":
    main()
