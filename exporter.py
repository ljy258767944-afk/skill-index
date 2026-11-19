import csv
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / "assets" / "template.xlsx"
HEADERS = ["排名", "技能仓库", "GitHub星标", "近7日新增", "类别", "中文能力说明", "列出技能", "安装到Codex", "来源注明兼容代理", "GitHub / README", "能力来源"]


def skill_row(skill):
    return [skill["rank"], skill["repo"], skill["stars"], skill["stars7d"], skill["category"],
            skill["description"], skill["listCommand"], skill["installCommand"],
            " / ".join(skill["agents"]) or "来源未注明", skill["githubUrl"], skill["sourceUrl"]]


def export_files(payload, directory):
    directory.mkdir(parents=True, exist_ok=True)
    workbook = load_workbook(TEMPLATE)
    workbook.properties.creator = "Skill Index"
    workbook.properties.lastModifiedBy = "Skill Index"
    sheet = workbook["Top500"]
    meta = payload["meta"]
    notes = [
        "GitHub技能累计人气 Top 500 · 按仓库累计 Stars 排序",
        f"整理日期：{meta['reportDate']}（北京时间）｜星标快照：{meta['snapshotDate']}｜来源收录：{meta['coverage']}个仓库；非GitHub官方全站榜",
        "累计Stars不是历史峰值，也不是往期每日榜合集；星标属于整个仓库，不属于单项技能。",
        "能力说明依据来源整理；命令未经逐项试装。先列出技能，再按需选择；无法识别时按仓库README操作。",
        f"成功整理时间：{meta['collectedAt']}｜数据模式：{meta['collectionMode']}；未逐仓库实时核验。",
    ]
    for row_index, note in enumerate(notes, 1):
        sheet.cell(row_index, 1, note)
    for row_index, skill in enumerate(payload["skills"], 8):
        for column_index, value in enumerate(skill_row(skill), 1):
            cell = sheet.cell(row_index, column_index)
            if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
                value = "'" + value
            cell.value = value
            if column_index in (10, 11):
                cell.hyperlink = value
    guide = workbook["口径与安装"]
    replacements = {
        "整理日期": meta["reportDate"],
        "覆盖范围": f"来源公开目录收录{meta['coverage']}个仓库，本表取累计Stars前500；不代表GitHub官方全站榜。",
        "星标快照": f"{meta['snapshotDate']}。来源未注明日期时区。星标不是整理当天实时计数，未逐仓库实时核验。",
        "本次交付范围": "Skill Index由GitHub Actions计划每日北京时间09:00更新；云端任务可能排队延迟，不依赖个人电脑开机。",
        "整理记录": f"{meta['collectedAt']}（北京时间）；{meta['collectionMode']}；新入榜条目没有中文说明时保留来源原文并明确标注。",
    }
    for row in guide.iter_rows(min_row=3, max_col=2):
        if row[0].value in replacements:
            row[1].value = replacements[row[0].value]
    excel = directory / "skills-top500.xlsx"
    workbook.save(excel)
    workbook.close()
    verified = load_workbook(excel, read_only=True, data_only=True)
    stored = list(verified["Top500"].iter_rows(min_row=8, max_row=507, values_only=True))
    assert len(stored) == 500 and [row[1] for row in stored] == [skill["repo"] for skill in payload["skills"]]
    assert all(row[2] == skill["stars"] for row, skill in zip(stored, payload["skills"]))
    verified.close()
    with (directory / "skills-top500.csv").open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.writer(target)
        writer.writerow(HEADERS + ["星标快照"])
        for skill in payload["skills"]:
            row = skill_row(skill) + [meta["snapshotDate"]]
            writer.writerow(["'" + value if isinstance(value, str) and value.startswith(("=", "+", "-", "@")) else value for value in row])
