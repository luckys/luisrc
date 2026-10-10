"""Package the standalone database fundamentals lab without local dependencies or private files."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "examples/transacciones"
OUTPUT = ROOT / "public/assets/examples/transacciones-lab.zip"
FILES = [
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "docker-compose.yml",
    "README.md",
    "db/migrations/001_init.sql",
    "experiments/atomicity/types.ts",
    "experiments/atomicity/database.ts",
    "experiments/atomicity/no-transaction.ts",
    "experiments/atomicity/with-transaction.ts",
    "experiments/atomicity/run.ts",
    "tests/integration/atomicity.test.ts",
    "sql/setup.sql",
    "sql/atomicity.sql",
    "sql/consistency.sql",
    "sql/isolation-reader.sql",
    "sql/isolation-writer.sql",
    "sql/durability.sql",
    "sql/transactions.sql",
    "docs/results.md",
    "docs/glossary.md",
]


def add_file(archive: ZipFile, prefix: str, name: str, content: bytes) -> None:
    entry = ZipInfo(f"{prefix}/{name}", date_time=(2026, 10, 10, 0, 0, 0))
    entry.compress_type = ZIP_DEFLATED
    entry.external_attr = 0o100644 << 16
    archive.writestr(entry, content)


ENGLISH = Path(__file__).parent / "en"
translations = json.loads((ENGLISH / "lab-text.json").read_text())
for prefix, output in [
    ("transacciones", OUTPUT),
    ("transactions", OUTPUT.with_name("transactions-lab-en.zip")),
]:
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for name in FILES:
            content = (LAB / name).read_text()
            if prefix == "transactions":
                if name in ["README.md", "docs/results.md", "docs/glossary.md"]:
                    content = (ENGLISH / Path(name).name).read_text()
                else:
                    for original in sorted(translations, key=len, reverse=True):
                        content = content.replace(original, translations[original])
            add_file(archive, prefix, name, content.encode())
        add_file(archive, prefix, "pnpm-workspace.yaml", b"allowBuilds:\n  esbuild: true\n")
        add_file(archive, prefix, ".gitignore", b"node_modules/\n")
    print(f"Packaged {len(FILES) + 2} files: {output.relative_to(ROOT)}")
