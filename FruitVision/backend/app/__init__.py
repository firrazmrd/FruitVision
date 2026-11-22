import sys

# Konsol Windows sering cp1252/cp437: paksa UTF-8 agar pesan dan nama file non-ASCII tidak membuat CLI crash.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
