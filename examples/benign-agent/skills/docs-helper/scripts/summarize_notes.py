from pathlib import Path


def summarize(path):
    text = Path(path).read_text(encoding="utf-8")
    return text[:500]
