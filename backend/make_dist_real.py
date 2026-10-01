"""Build dist-real/: the demo WITH the real Dealroom snapshot, for a deliberate, direct deploy (never committed to git).
Run: python3 backend/make_dist_real.py && npx wrangler deploy --assets ./dist-real
The owner of the API key decided this may be published (presenting to Dealroom). The data file stays out of GitHub; the site is noindex."""
import os, re, shutil, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "demo"), os.path.join(ROOT, "dist-real")
fx = os.path.join(SRC, "real-fixture.local.js")
if not os.path.exists(fx): sys.exit("missing demo/real-fixture.local.js: run the crawlers + build_macro.py first")
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
for f in sorted(os.listdir(SRC)):
    if f.startswith(".") or f in ("synthetic-fixture.js",) or not f.endswith((".html", ".js", ".css", ".svg", ".png", ".ico", "_headers")) and f != "_headers": continue
    shutil.copy(os.path.join(SRC, f), os.path.join(OUT, f))
idx = os.path.join(OUT, "index.html"); s = open(idx).read()
guard = re.search(r"<script>if\(/\^\(localhost.*?</script>", s)
assert guard, "localhost guard not found in index.html"
s = s.replace(guard.group(0), '<script src="real-fixture.local.js"></script>', 1); open(idx, "w").write(s)
t = open(os.path.join(OUT, "real-fixture.local.js")).read(); d = json.loads(t[t.index("= ") + 2:].rstrip().rstrip(";"))
assert d.get("realData") and not d.get("synthetic")
assert not re.search(r"client_secret|DEALROOM_CLIENT|github_pat_", " ".join(open(os.path.join(OUT, f), errors="ignore").read() for f in os.listdir(OUT))), "credential-like string in bundle"
print("dist-real/:", ", ".join(sorted(os.listdir(OUT))), f"({sum(os.path.getsize(os.path.join(OUT,f)) for f in os.listdir(OUT))/1024:.0f} KB)")
print("contains real data:", len(d["companies"]), "companies,", len(d["lps"]), "LPs; credentials: none")
