"""Render BIO CH.1-7 PDF pages to PNG for manual extraction."""
from __future__ import annotations

import json
from pathlib import Path

import pymupdf

PDF = Path(
    r"C:\Users\DELL\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm"
    r"\LocalState\sessions\3DE16AF2B7B041F59923671DBECF679C71D4531A"
    r"\transfers\2026-44\BIO CH.1-7 .pdf"
)
OUT_DIR = Path(__file__).resolve().parents[1] / "imports" / "bio-101" / "extracted" / "pages"
DPI = 200


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(PDF)
    scale = DPI / 72.0
    matrix = pymupdf.Matrix(scale, scale)
    meta = {"pdf_path": str(PDF), "page_count": doc.page_count, "dpi": DPI, "pages": []}
    for i in range(doc.page_count):
        page = doc[i]
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        name = f"{i + 1:03d}.png"
        pix.save(OUT_DIR / name)
        meta["pages"].append({"pdf_index": i + 1, "file": name, "width": pix.width, "height": pix.height})
    map_path = OUT_DIR.parent / "render-meta.json"
    map_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Rendered {doc.page_count} pages to {OUT_DIR}")
    doc.close()


if __name__ == "__main__":
    main()
