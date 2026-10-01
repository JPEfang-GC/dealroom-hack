"""Generate a fully SYNTHETIC dataset (fictional companies, GPs, LPs, market series) with the same structure as the real crawl,
then run the normal builders on it -> demo/synthetic-fixture.js.  Contains NO Dealroom data, so it can be published.
Run: python3 backend/make_synthetic.py        (no API key, no network)"""
import csv, json, os, random, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".synthetic"); os.makedirs(OUT, exist_ok=True)
R = random.Random(20261001)
used_ids, used_names = set(), set()
def uid():
    while True:
        u = "%032x" % R.getrandbits(128)
        if u[:8] not in used_ids: used_ids.add(u[:8]); return u[:8] + "-" + u[8:12] + "-" + u[12:16] + "-" + u[16:20] + "-" + u[20:]
def slug(s): return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-").replace("--", "-")
def unique(gen):
    for _ in range(1000):
        n = gen()
        if n not in used_names: used_names.add(n); return n
    raise RuntimeError("name space exhausted")

A = "Aura Brio Cinder Dova Elm Fable Gilda Harbor Ivo Juno Kite Lumen Mira Nimbus Orla Pivot Quill Rune Sable Tide Umber Vale Wren Xylo Yarrow Zeno Alder Bram Cove Dune Ember Flint Glade Hazel Iris Jade Knoll Lark Moss Nova Opal Pine Reed Sage Thorn".split()
TAGLINES = {
 "credit": ["Fair personal loans for everyday borrowers", "Buy now pay later with transparent lending", "Small-ticket borrowing with instant decisions"],
 "credit_underwriting": ["Alternative data credit scoring for thin-file borrowers", "Real-time underwriting engine for lenders serving underserved consumers", "Affordability checks and open banking underwriting"],
 "sme_finance": ["Working capital for small business owners", "Invoice finance for freelancers and sole traders", "Merchant cash advances and business accounts"],
 "financial_health": ["Budgeting and savings app for everyday financial wellbeing", "Debt advice and money management tools", "Financial education and personal finance coaching"],
 "insurance": ["Micro-insurance for gig workers", "Pay-as-you-go insurance for low-income households", "Embedded insurance for renters"],
 "remittances": ["Low-cost cross-border payments for diaspora families", "Remittance app for migrant workers", "Send money home with transparent fees"],
 "inclusive_banking": ["Digital bank account for the underbanked", "Mobile wallet for first-time account holders", "Neobank for underserved communities"],
 "other_fi": ["Financial services platform", "Fintech infrastructure for regulated providers"]}
SUFFIX = {"credit": ["Lend", "Credit", "Loan"], "credit_underwriting": ["Score", "Assess", "Rate"], "sme_finance": ["Ledger", "Float", "Books"], "financial_health": ["Save", "Budget", "Learn"],
          "insurance": ["Cover", "Safe", "Shield"], "remittances": ["Remit", "Send", "Bridge"], "inclusive_banking": ["Bank", "Wallet", "Pay"], "other_fi": ["Stack", "Core", "Hub"]}
SUBW = {"credit": 18, "sme_finance": 16, "financial_health": 15, "credit_underwriting": 13, "other_fi": 12, "inclusive_banking": 9, "remittances": 9, "insurance": 8}
COUNTRIES = [("United Kingdom", 45), ("Germany", 9), ("France", 9), ("Sweden", 8), ("Netherlands", 7), ("Spain", 6), ("Denmark", 5), ("Ireland", 4), ("Italy", 4), ("Türkiye", 3)]
def wchoice(pairs): 
    tot = sum(w for _, w in pairs); x = R.random() * tot
    for k, w in pairs:
        x -= w
        if x <= 0: return k
    return pairs[-1][0]

# ---- GPs and LPs (fictional) ----
GW = "Northgate Eastmere Highcrest Lindholm Marlowe Oakridge Pembrook Quayside Redfern Stonehaven Thornfield Ullswater Valemont Westbrook Yarrowdale Ashgrove Brackenridge Cobalt Dunmore Elderwick Fairlight Glenmoor Hollowell Ironbridge Juniper Kingsmere Larkspur Millbrook Netherby Orchard Penhallow Ravenscar Silverdale Tamarisk Underhill Wexcombe Yewdale".split()
GP = []
for i in range(70):
    n = unique(lambda: f"{R.choice(GW)} {R.choice(['Capital', 'Ventures', 'Partners', 'Growth', 'Equity', 'Seed'])}")
    GP.append({"uuid": uid(), "name": n, "domain": slug(n) + ".example", "w": R.paretovariate(1.3)})
LT = {"pension_fund": ["Pension Fund", "Pensions"], "fund_of_funds": ["Fund of Funds", "FoF Partners"], "sovereign_wealth_fund": ["Sovereign Fund", "Investment Authority"], "family_office": ["Family Office"], "other": ["Foundation", "Impact Trust", "Development Bank"]}
LTW = [("pension_fund", 30), ("fund_of_funds", 25), ("sovereign_wealth_fund", 10), ("family_office", 20), ("other", 15)]
LPS = []
for i in range(95):
    t = wchoice(LTW); n = unique(lambda: f"{R.choice(GW)} {R.choice(LT[t])}")
    k = max(3, min(len(GP), int(R.paretovariate(1.4) * 4)))
    chosen, pool = [], GP[:]
    while len(chosen) < k and pool:
        g = R.choices(pool, weights=[x["w"] for x in pool])[0]; pool.remove(g); chosen.append(g)
    LPS.append({"uuid": uid(), "name": n, "type": t, "country": wchoice(COUNTRIES), "tagline": "Synthetic institutional investor", "domain": slug(n) + ".example",
                "gps": [{"uuid": g["uuid"], "name": g["name"], "domain": g["domain"]} for g in chosen]})

# ---- companies ----
YF = {2012: .3, 2013: .3, 2014: .35, 2015: .4, 2016: .45, 2017: .5, 2018: .6, 2019: .7, 2020: .9, 2021: 1.6, 2022: 1.2, 2023: .9, 2024: .6, 2025: .55, 2026: .3}
def make_company(group, sub=None):
    base = {"fi": "", "fintech": "", "venture": ""}
    if group == "fi": name = unique(lambda: R.choice(A) + R.choice(SUFFIX[sub])); tag = R.choice(TAGLINES[sub])
    elif group == "fintech": name = unique(lambda: R.choice(A) + R.choice(["Treasury", "Ops", "Ledger", "Terminal", "Rails"])); tag = R.choice(["SME treasury software", "Payments infrastructure", "Finance operations for growing firms", "Merchant payment services"])
    else: name = unique(lambda: R.choice(A) + R.choice(["Labs", "Robotics", "Bio", "Grid", "Orbit", "Forge"])); tag = R.choice(["Industrial computing", "Biomanufacturing platform", "Grid-scale energy storage", "Earth observation analytics"])
    L = R.choice(list(range(2012, 2023)) + ([R.choice([2005, 2008, 2010, 2011, 2023, 2024])] if group == "fi" and R.random() < .16 else []))
    pmore = {"fi": .58, "fintech": .55, "venture": .50}[group]
    star = R.random() < .035
    rounds, y, k = [], min(2026, L + R.choice([0, 0, 1, 2])), 0; amount = R.lognormvariate(14.9, .8); val = None
    while True:
        if y > 2026: break
        a = amount * YF.get(y, .3) * (14 if star and k >= 1 else 1)
        v = (a * R.uniform(3, 8) * (1 if val is None else 1)) if R.random() < .85 else None
        if v and val: v = max(v, val * R.lognormvariate(.45, .5))
        if v: val = v
        invs = []
        for gi, g in enumerate(R.choices(GP, weights=[x["w"] for x in GP], k=R.choice([1, 2, 2, 3]))):
            if g["uuid"] not in [i["uuid"] for i in invs]: invs.append({"uuid": g["uuid"], "name": g["name"], "lead": gi == 0})
        rounds.append({"year": y, "month": R.randint(1, 12), "amount": round(a), "valuation": round(v) if v else None, "round": ["Seed", "Series A", "Series B", "Series C", "Series D"][min(k, 4)], "is_vc": True, "is_exit": False, "investors": invs})
        k += 1
        if k >= 5 or R.random() > pmore: break
        amount *= R.uniform(1.6, 3.2); y += R.choice([1, 1, 2])
    return {"uuid": uid(), "name": name, "group": group, "domain": slug(name) + ".example", "tagline": tag, "about": tag + " (synthetic company)", "country": wchoice(COUNTRIES) if group == "fi" else wchoice(COUNTRIES[:6]),
            "launch_date": f"{L}-01-01", "status": "operational", "exit_date": (f"{min(2026, L + R.randint(4, 9))}-06-01" if group == "fi" and R.random() < .115 else None), "tags": [], "rounds": rounds}
cos = []
for _ in range(210): cos.append(make_company("fi", wchoice(list(SUBW.items()))))
for _ in range(200): cos.append(make_company("fintech"))
for _ in range(200): cos.append(make_company("venture"))
json.dump(cos, open(f"{OUT}/companies.json", "w")); json.dump(LPS, open(f"{OUT}/lp_holdings.json", "w"))

# ---- market series (invented): FI = sum of the synthetic FI companies' VC rounds, so the charts agree with each other ----
fi_year = {y: sum(r["amount"] for c in cos if c["group"] == "fi" for r in c["rounds"] if r["year"] == y) for y in range(2015, 2027)}
share = {2015: 1.0, 2016: .8, 2017: 1.4, 2018: 1.1, 2019: .7, 2020: 1.2, 2021: 1.3, 2022: 1.1, 2023: 1.5, 2024: .8, 2025: .6, 2026: .25}
ftfrac = {2015: .14, 2016: .16, 2017: .17, 2018: .2, 2019: .23, 2020: .22, 2021: .25, 2022: .26, 2023: .2, 2024: .18, 2025: .17, 2026: .16}
yrs = list(range(2015, 2027)); fi = [fi_year[y] for y in yrs]; eu = [fi_year[y] / (share[y] / 100) for y in yrs]; ft = [eu[i] * ftfrac[y] for i, y in enumerate(yrs)]
ft = [max(ft[i], fi[i] * 1.5) for i in range(len(yrs))]
json.dump({"years": yrs, "partialYear": 2026, "currency": "USD", "geography": "Synthetic Europe", "definitions": {"europe_vc": "Synthetic European VC", "fintech": "Synthetic fintech", "fi": "Synthetic Financial Inclusion"},
           "funding_usd": {"europe_vc": eu, "fintech": ft, "fi": fi}, "fi_share_of_europe_vc_pct": [round(f / e * 100, 2) for f, e in zip(fi, eu)], "fi_share_of_fintech_vc_pct": [round(f / t * 100, 2) for f, t in zip(fi, ft)]}, open(f"{OUT}/market_share.json", "w"))
json.dump([[2018, 1.0], [2019, 1.25], [2020, .5], [2021, .25], [2022, 2.0], [2023, 4.5], [2024, 4.0], [2025, 3.0], [2026, 3.0]], open(f"{OUT}/bankrate.json", "w"))
json.dump({"rows": [[g, str(y), "findex_account_ownership", round(R.uniform(90, 99.5), 1)] for g in ("GBR", "USA", "DEU", "FRA") for y in (2011, 2014, 2017, 2021, 2024)]}, open(f"{OUT}/worldbank.json", "w"))
with open(f"{OUT}/consumer_demand_signals.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow("country,year,period,metric,value,unit,source,frequency,population,signal_role,comparison_period,comparison_value,source_url".split(","))
    for m, v, c, u in [("stepchange_full_advice_completions", 13900, 12400, "people per month"), ("stepchange_credit_for_living_costs", 10, 8, "percent of clients"), ("stepchange_clients_with_credit_card_debt", 73, 69, "percent of clients"), ("stepchange_clients_with_personal_loan_debt", 55, 51, "percent of clients")]:
        w.writerow(["GBR", 2026, "2026-08", m, v, u, "stepchange", "monthly", "synthetic clients", "high_frequency_stress", "2025-08", c, ""])

env = dict(os.environ, DR_DATA_DIR=OUT, DR_SYNTHETIC="1")
for s in ("build_fixture.py", "build_macro.py"):
    r = subprocess.run([sys.executable, os.path.join(ROOT, "backend", s)], env=env, capture_output=True, text=True)
    if r.returncode: print(r.stdout[-800:], r.stderr[-1500:]); sys.exit(1)
print("synthetic dataset built:", len(cos), "companies,", len(GP), "GPs,", len(LPS), "LPs ->", "demo/synthetic-fixture.js")
