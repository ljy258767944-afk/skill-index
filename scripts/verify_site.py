import json
from pathlib import Path, PurePosixPath

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


def local_file(path):
    relative = PurePosixPath(path.lstrip("/"))
    assert not relative.is_absolute() and ".." not in relative.parts
    target = SITE.joinpath(*relative.parts)
    assert target.is_file(), f"Missing published asset: {path}"
    return target


def verify_payload(payload):
    skills = payload["skills"]
    assert len(skills) == 500
    assert len({skill["repo"].casefold() for skill in skills}) == 500
    assert [skill["rank"] for skill in skills] == list(range(1, 501))
    assert [skill["stars"] for skill in skills] == sorted((skill["stars"] for skill in skills), reverse=True)
    for path in payload["meta"]["downloads"].values():
        local_file(path)
    workbook = load_workbook(local_file(payload["meta"]["downloads"]["excel"]), read_only=True, data_only=True)
    rows = list(workbook["Top500"].iter_rows(min_row=8, max_row=507, values_only=True))
    assert [(row[1], row[2]) for row in rows] == [(skill["repo"], skill["stars"]) for skill in skills]
    workbook.close()


def main():
    for name in ("index.html", "app.js", "styles.css", "favicon.svg"):
        local_file(name)
    verify_payload(json.loads(local_file("data/catalog.json").read_text(encoding="utf-8")))
    history = json.loads(local_file("data/history.json").read_text(encoding="utf-8"))
    for entry in history["entries"]:
        verify_payload(json.loads(local_file(entry["path"]).read_text(encoding="utf-8")))
    for path in SITE.rglob("*"):
        assert not path.is_symlink()
        if path.is_file():
            assert path.suffix in {".html", ".js", ".css", ".svg", ".json", ".xlsx", ".csv"} or path.name == ".nojekyll", f"Unexpected publication: {path}"
    print("Verified: 500 ranked repositories, history, Excel data and published file whitelist")


if __name__ == "__main__":
    main()
