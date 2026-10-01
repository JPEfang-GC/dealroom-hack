"""Stage 4: classify FI sub-themes, build LP->GP->company paths, attribution stats, emit data/fixture.real.js
(same shape as demo/fixture.js DEMO_FIXTURE, plus extra fields: sub, why, attribution).
Run: python3 backend/build_fixture.py"""
import json, os, re, statistics, collections, dr
D = os.path.join(dr.ROOT, "data")
TOP_LPS = 25
SUBS = [  # first match wins; keyword rules on tagline/about/tags
    ("remittances", r"remittance|cross-border (payment|transfer)|money transfer|send money|diaspora"),
    ("insurance", r"insur|micro.?insurance|insurtech"),
    ("sme_finance", r"\bsme\b|small business|working capital|merchant|invoice|business loan|business bank|sole trader|freelanc"),
    ("credit_underwriting", r"credit scor|underwrit|thin.?file|open banking.*(lend|credit)|alternative data|affordab"),
    ("credit", r"\bcredit\b|\bloan|lending|borrow|mortgage|\bbnpl\b|buy now|overdraft|microfinance|micro.?loan"),
    ("financial_health", r"financial (health|wellbeing|wellness|education|literacy)|budget|saving|debt (advice|help)|money management|personal finance|financial planning"),
    ("inclusive_banking", r"neobank|digital bank|bank account|unbanked|underbanked|underserved|inclusive|mobile money|wallet|payments?"),
]
def classify(c):
    txt = " ".join([c.get("tagline") or "", c.get("about") or "", " ".join(c.get("tags", []))]).lower()
    for name, rx in SUBS:
        if re.search(rx, txt): return name
    return "other_fi"

def mm(x): return round(x / 1e6, 2) if x else None
def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

cs = json.load(open(f"{D}/companies.json")); lps = json.load(open(f"{D}/lp_holdings.json"))
for c in cs: c["sub"] = classify(c) if c["group"] == "fi" else None
fi = [c for c in cs if c["group"] == "fi"]

# GP -> FI companies (investors from funding rounds)
gp_name, gp2co = {}, collections.defaultdict(set)
for c in fi:
    for r in c["rounds"]:
        for i in r["investors"]: gp2co[i["uuid"]].add(c["uuid"]); gp_name[i["uuid"]] = i["name"]
byid = {c["uuid"]: c for c in cs}

ranked = []
for l in lps:
    gs = [g for g in l["gps"] if g["uuid"] in gp2co]
    if not gs: continue
    cos = set().union(*[gp2co[g["uuid"]] for g in gs])
    subs = collections.Counter(byid[u]["sub"] for u in cos)
    ranked.append({"lp": l, "gps": gs, "cos": cos, "subs": subs, "score": (len(cos), len(gs))})
ranked.sort(key=lambda r: r["score"], reverse=True)
top = ranked[:TOP_LPS]
top_gp_ids = {g["uuid"] for r in top for g in r["gps"]}

def rounds_out(c):
    out = [{"year": r["year"], "amount": mm(r["amount"]) or 0, "valuation": mm(r["valuation"])} for r in sorted(c["rounds"], key=lambda r: (r["year"] or 0, r["month"] or 0)) if r["year"] and r["is_vc"] is not False]
    return out
def company_out(c):
    gps = sorted({f"gp-{i['uuid'][:8]}" for r in c["rounds"] for i in r["investors"] if i["uuid"] in top_gp_ids})
    o = {"id": c["uuid"][:8], "name": c["name"], "group": c["group"], "product": c["tagline"], "sub": c["sub"], "country": c["country"], "gps": gps, "rounds": rounds_out(c)}
    if c["exit_date"]: o["exit"] = {"year": int(str(c["exit_date"])[:4]), "type": "exit"}
    return o

def angle(r):
    s = [k.replace("_", " ") for k, _ in r["subs"].most_common(2)]
    return f"Already holds {len(r['gps'])} managers that backed {len(r['cos'])} European FI companies, mostly {' and '.join(s)}. Ask how it sees thematic exposure vs. generalist VC and whether a dedicated FI fund fits its allocation."
fixture = {
    "asOf": "Live Dealroom crawl " + __import__("datetime").date.today().isoformat(),
    "theme": {"id": "theme-fi", "label": "Financial inclusion (Europe)"},
    "companies": [company_out(c) for c in cs],
    "gps": [{"id": f"gp-{u[:8]}", "name": gp_name[u]} for u in sorted(top_gp_ids)],
    "lps": [{"id": f"lp-{r['lp']['uuid'][:8]}", "name": r["lp"]["name"], "type": r["lp"]["type"].replace("_", " "),
             "gps": [f"gp-{g['uuid'][:8]}" for g in r["gps"]], "fiCompanies": len(r["cos"]), "subthemes": dict(r["subs"]), "angle": angle(r),
             "why": [{"gp": g["name"], "companies": sorted(byid[u]["name"] for u in gp2co[g["uuid"]])} for g in r["gps"]]} for r in top],
}

# --- attribution (does FI add anything beyond fintech, or is it a few winners?) ---
def stats(group):
    x = [c for c in cs if c["group"] == group]
    latest = lambda c: next((r["valuation"] for r in sorted(c["rounds"], key=lambda r: (r["year"] or 0, r["month"] or 0), reverse=True) if r["valuation"]), None)
    steps = []
    for c in x:
        v = [r["valuation"] for r in sorted(c["rounds"], key=lambda r: (r["year"] or 0, r["month"] or 0)) if r["valuation"]]
        if len(v) >= 2 and v[-2]: steps.append(v[-1] / v[-2])
    vals = sorted([v for v in map(latest, x) if v], reverse=True)
    return {"n": len(x), "followOn": round(sum(1 for c in x if len([r for r in c["rounds"] if r["is_vc"]]) > 1) / len(x), 3),
            "medianStepUp": round(statistics.median(steps), 2) if steps else None, "withValuation": len(vals),
            "top3ShareOfValue": round(sum(vals[:3]) / sum(vals), 3) if vals else None,
            "medianValuationM": mm(statistics.median(vals)) if vals else None}
att = {g: stats(g) for g in ("fi", "fintech", "venture")}
fixture["attribution"] = att
fixture["caveats"] = ["Comparison cohorts were sampled as VC-backed, launched 2012+, first 150 returned: not randomised; exits not comparable.", "HQ in Europe does not imply serving European customers.", "LP-GP links are known relationships without commitment size or date."]
open(f"{D}/fixture.real.js", "w").write("// Generated from a live Dealroom crawl. Do not commit (data terms).\nwindow.DEMO_FIXTURE = " + json.dumps(fixture, indent=1) + ";\n")
print("sub-themes:", dict(collections.Counter(c["sub"] for c in fi)))
print(json.dumps(att, indent=1))
print("top LPs:"); [print(" ", l["name"], l["fiCompanies"], len(l["gps"]), l["subthemes"]) for l in fixture["lps"][:6]]
