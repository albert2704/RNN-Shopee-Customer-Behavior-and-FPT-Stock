"""Read server-only settings fresh, so adding the API key needs no restart."""

import os
from pathlib import Path

from dotenv import dotenv_values

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def settings():
    local = dotenv_values(ENV_FILE, interpolate=False)
    defaults = {
        "OPENAI_API_KEY": "",
        "OPENAI_MODEL": "gpt-4.1-mini",
        "NEO4J_URI": "bolt://127.0.0.1:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "",
        "NEO4J_DATABASE": "neo4j",
    }
    return {
        key: os.environ.get(key, local.get(key) or default).strip()
        for key, default in defaults.items()
    }
