import argparse
import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import uuid
from zoneinfo import ZoneInfo

from exporter import export_files
import collector


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "site" / "data"
CATEGORIES = {
    "Agent Orchestration": "多代理协作", "Backend": "后端", "Blockchain": "区块链",
    "Browser Automation": "浏览器自动化", "Business": "业务管理", "Code Quality": "代码质量",
    "Data": "数据与模型", "Databases": "数据库", "Design": "设计", "Developer Tooling": "开发工具",
    "DevOps": "开发运维", "Diagramming": "图解", "Docs": "办公文档", "Finance": "金融", "Gaming": "游戏",
    "Knowledge": "知识管理", "Learning": "学习与求职", "Legal": "法律", "Lifestyle": "生活方式",
    "Marketing": "营销", "Media": "多媒体", "Mobile": "移动开发", "Presentations": "演示文稿",
    "Prompting": "提示词", "Research": "研究", "Sales": "销售", "Science": "科研", "Security": "安全",
    "Skill Creation": "技能创建", "Skill Management": "技能管理", "Software Engineering": "软件工程",
    "Testing": "测试", "Token Optimization": "令牌优化", "Writing": "写作",
}


def atomic_json(target, data):
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".pending-", dir=target.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(data, output, ensure_ascii=False, indent=2, allow_nan=False)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def validate_and_build(catalog, descriptions, now, version, cached=False):
    repositories = catalog["catalog"]
    if len(repositories) < 500:
        raise ValueError("来源不足500条，拒绝发布不完整榜单")
    snapshot = datetime.date.fromisoformat(catalog["metrics"]["snapshotDate"])
    snapshot_age = (now.date() - snapshot).days
    if snapshot_age < 0:
        raise ValueError("来源快照日期晚于当前日期")
    seen = set()
    for repository in repositories:
        repo = repository["repo"]
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo) or repo in seen:
            raise ValueError("来源仓库标识异常或重复")
        seen.add(repo)
        if isinstance(repository["stars"], bool) or not isinstance(repository["stars"], int) or repository["stars"] < 0:
            raise ValueError("来源星标异常")
        growth = repository.get("stars7d")
        if growth is not None and (isinstance(growth, bool) or not isinstance(growth, int)):
            raise ValueError("来源增长指标异常")
        if not isinstance(repository.get("compatibleAgents", []), list) or not all(isinstance(agent, str) for agent in repository.get("compatibleAgents", [])):
            raise ValueError("来源代理列表异常")
    top = sorted(repositories, key=lambda repository: (-repository["stars"], repository["repo"].casefold()))[:500]
    skills = []
    for rank, repository in enumerate(top, 1):
        repo = repository["repo"]
        original = str(repository.get("tagline") or repository.get("summary") or "来源未提供能力说明")
        description = descriptions.get(repo)
        skills.append({
            "rank": rank, "repo": repo, "owner": repo.split("/")[0], "name": repo.split("/")[1],
            "stars": repository["stars"], "stars7d": repository.get("stars7d"),
            "category": CATEGORIES.get(repository["category"], repository["category"]),
            "description": description or f"中文说明待补充；来源原文：{original}",
            "originalDescription": original, "translated": bool(description),
            "agents": repository.get("compatibleAgents", []),
            "githubUrl": f"https://github.com/{repo}#readme",
            "sourceUrl": f"https://www.skillleaderboard.com/skill/{repo.replace('/', '-')}",
            "listCommand": f"npx skills add {repo} --list",
            "installCommand": f"npx skills add {repo} -a codex -g",
        })
    return {"meta": {
        "version": version, "reportDate": now.date().isoformat(), "collectedAt": now.isoformat(timespec="seconds"),
        "snapshotDate": snapshot.isoformat(), "snapshotAgeDays": snapshot_age,
        "source": "https://www.skillleaderboard.com/api/catalog", "coverage": len(repositories), "count": 500,
        "collectionMode": "已有公开快照初始化，非实时重取" if cached else "在线获取公开目录",
        "downloads": {"excel": f"downloads/{version}/skills-top500.xlsx", "csv": f"downloads/{version}/skills-top500.csv"},
    }, "skills": skills}


def update(source=None):
    DATA.mkdir(parents=True, exist_ok=True)
    with (ROOT / ".update.lock").open("a") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("已有更新任务正在运行，本次跳过", flush=True)
            return
        now = datetime.datetime.now(ZoneInfo("Asia/Shanghai"))
        status_file = DATA / "status.json"
        previous = json.loads(status_file.read_text()) if status_file.exists() else {}
        running = {"state": "updating", "attemptedAt": now.isoformat(timespec="seconds"), "lastSuccessAt": previous.get("lastSuccessAt")}
        atomic_json(status_file, running)
        print(f"[{now.isoformat()}] 开始更新前500", flush=True)
        try:
            catalog = collector.validate_catalog(json.loads(source.read_text())) if source else collector.fetch_catalog()
            descriptions = json.loads((ROOT / "assets" / "descriptions.json").read_text())
            version = now.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
            payload = validate_and_build(catalog, descriptions, now, version, cached=source is not None)
            directory = ROOT / "site" / "downloads" / version
            export_files(payload, directory)
            day = payload["meta"]["reportDate"]
            archive = DATA / "archive" / f"{day}.json"
            atomic_json(archive, payload)
            history_file = DATA / "history.json"
            history = json.loads(history_file.read_text()).get("entries", []) if history_file.exists() else []
            entries = [entry for entry in history if entry["date"] != day]
            entries.append({"date": day, "snapshotDate": payload["meta"]["snapshotDate"], "count": 500, "path": f"data/archive/{day}.json"})
            atomic_json(history_file, {"entries": sorted(entries, key=lambda entry: entry["date"], reverse=True)})
            atomic_json(DATA / "catalog.json", payload)
            finished = {"state": "success", "attemptedAt": running["attemptedAt"], "lastSuccessAt": payload["meta"]["collectedAt"],
                        "snapshotDate": payload["meta"]["snapshotDate"], "rows": 500, "version": version,
                        "collectionMode": payload["meta"]["collectionMode"], "nextDailyTime": "09:00", "timezone": "Asia/Shanghai"}
            atomic_json(status_file, finished)
            print(json.dumps(finished, ensure_ascii=False), flush=True)
        except Exception as error:
            atomic_json(status_file, {**running, "state": "error", "message": "更新失败，保留上次成功数据；未使用旧缓存冒充新数据。"})
            print(f"更新失败：{type(error).__name__}: {error}", file=sys.stderr, flush=True)
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    arguments = parser.parse_args()
    update(arguments.source)
