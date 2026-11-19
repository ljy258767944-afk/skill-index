import datetime
import json
import subprocess
import tempfile
import time
from pathlib import Path


CATALOG_URL = "https://www.skillleaderboard.com/api/catalog"


def validate_catalog(data):
    datetime.date.fromisoformat(data["metrics"]["snapshotDate"])
    if not isinstance(data["catalog"], list) or len(data["catalog"]) < 500:
        raise ValueError("来源不足500条，拒绝发布不完整榜单")
    return data


def fetch_catalog():
    with tempfile.TemporaryDirectory(prefix="skill-index-") as temporary:
        target = Path(temporary) / "catalog.json"
        last_error = None
        for attempt in range(3):
            try:
                subprocess.run(
                    ["curl", "--http1.1", "--location", "--fail", "--connect-timeout", "10",
                     "--max-time", "50", "--silent", "--show-error", CATALOG_URL, "--output", str(target)],
                    check=True, timeout=60,
                )
                return validate_catalog(json.loads(target.read_text(encoding="utf-8")))
            except (subprocess.SubprocessError, OSError, ValueError, KeyError, TypeError) as error:
                last_error = error
                if attempt < 2:
                    time.sleep(5 * (attempt + 1))
        raise RuntimeError(f"在线采集失败，保留上次成功榜单：{last_error}")
