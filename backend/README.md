# Data pipeline (branch `data`)

Builds `data/fixture.real.js` (same shape as `demo/fixture.js`, plus `sub`, `why`, `attribution`) from live Dealroom data.
Each person uses their OWN key; Dealroom data and `.env` are never committed (`data/` is gitignored; hackathon terms forbid redistribution).

```bash
cp <your>.env .env                  # DEALROOM_CLIENT_ID / DEALROOM_CLIENT_SECRET
python3 backend/smoke_test.py       # 5 PASS lines = key + every hop works
python3 backend/test_data.py        # after build_fixture.py: 19 integrity checks + 3 live path re-verifications
python3 backend/crawl_companies.py  # 394 EU Financial Inclusion cos + rounds + investors (~3 min)
python3 backend/crawl_matched.py    # launch-year-matched fintech / venture comparison cohorts (~5 min)
python3 backend/crawl_lps.py        # ~394 institutional EU LPs and the GPs each backs (~2 min)
python3 backend/build_fixture.py    # classify sub-themes, LP->GP->company paths, attribution -> data/fixture.real.js
```
Standard library only. Responses are cached in `data/cache/`, so reruns are fast.
To preview: copy `demo/` somewhere, replace `fixture.js` with `data/fixture.real.js`, run `python3 -m http.server`.

## Method
- Theme: Dealroom sector tag `taxonomy_id` 2282901 "financial inclusion", HQ Europe (`hq_location` 76). Sub-themes: keyword rules (`SUBS` in build_fixture.py), unreviewed.
- Graph: Theme -> Company -> GP (investors on the company's funding rounds) -> LP. LP->GP edges come from `/investors/{id}/lp-funds`, which lists the GPs an LP backs (not a GP's LPs), so LPs are crawled and inverted. LP universe = European LP-role investors of type fund of funds, pension, sovereign wealth, family office, other.
- Attribution: companies launched 2012-2022; comparison cohorts are random samples matched to FI on launch year; bootstrap 95% CIs.

## Findings (2026-10-01 crawl)
- 394 FI companies; 1,174 investors; 179 are backed by an institutional EU LP; 134 FI companies reachable; 153 LPs connect to FI. Top: British Business Bank (34 cos / 21 GPs), KfW Capital, Export and Investment Fund of Denmark, British Patient Capital.
- FI follow-on 59% [54-64] vs fintech 55% [50-61] vs venture 51% [46-56]; median step-up 1.6x vs 1.57x vs 2.0x. FI is NOT distinguishable from fintech.
- Concentration: top 3 FI companies (SumUp, Teya, Marshmallow) = 54% of valuation, top 10% = 84%. Result is fintech beta plus a few winners, not a theme premium.

## Caveats (say these in the demo)
- "FI" tag includes large general fintechs (SumUp, Teya, Marshmallow); HQ in Europe != serving Europe (e.g. Moniepoint).
- Exit rates are NOT comparable: comparison cohorts were sampled VC-backed and carry no exit data. Don't claim an exit-rate result.
- LP-GP links carry no commitment size/date. "Indirect exposure" = paths, not ownership.
- demo/index.html still says "fictional fixture" and its readout text is static; change both before presenting real data.
