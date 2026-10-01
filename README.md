# Dealroom API / Inclusive Alpha

## Dealroom

Run the first request with `dealroom.ps1` from this folder (PowerShell).
Credentials are in `.env`; never commit the client secret or paste it anywhere.
The personal `SETUP.txt` and downloaded credential bundle are excluded from Git.
Access tokens last 24 hours; the script obtains a fresh token when run.
Setup guide: https://developers.beta.dealroom.co/getting-started/agent-setup.md
Documentation index: https://developers.beta.dealroom.co/llms.txt

The API script reads credentials from a local `.env` file, which is ignored by
Git. Do not commit API credentials or Dealroom response exports.

## Public macro and financial-inclusion sources

`macro_sources.py` provides a no-key World Bank Indicators API connector and
an OECD SDMX CSV connector. It uses only the Python standard library.

```powershell
python .\macro_sources.py
```

Both source connectors return a shared observation shape:
`country` (ISO-3), `year`, `metric`, `value`, `source`, and `unit`, with
optional source indicator and label fields. `normalize_observation(...)` is
also available for country/year Dealroom aggregates such as FI VC funding, so
analytics can join sources without source-specific frontend logic.

The World Bank function currently returns GDP per capita, GDP growth,
unemployment, inflation, population, and Global Findex account ownership
(overall and poorest 40%). Change the country list and year range in the
example or import `fetch_world_bank` from the module. Findex indicators are
survey observations (currently available for 2024, 2021, 2017, 2014, and
2011); do not treat the gaps between survey years as zero or interpolate them
without labeling it. Formal borrowing and emergency-fund resilience need a
separate Findex series mapping; they are not yet included in the WDI request.

For a ready-made OECD series, import and call `fetch_oecd_household_debt()`.
It returns annual household and NPISH debt as a percentage of net disposable
income, starting in 2010. The raw rows retain OECD's dimension columns and
labels. For another OECD measure, choose it in Data Explorer, copy its
Developer API URL in CSV format, then pass it to `fetch_oecd_csv(url)`. OECD
uses dataset-specific SDMX dimensions, so the connector preserves its original
columns instead of guessing how to reshape a dataset.

Before combining with Dealroom, map countries to ISO-3 and retain the source,
observation year, indicator, unit, and missing values. Match year definitions
explicitly: a survey year and a venture-round year do not necessarily represent
the same measurement period. Live connection checks succeeded on 2026-10-01:
the World Bank returned 30 rows for GBR and FRA (2022–2024), and the OECD
household-debt query returned 503 rows. The module makes public HTTPS requests;
the calls worked when direct network access was approved for this workspace.

## Consumer stress and demand cycle

`consumer_demand_signals.csv` contains a source-linked UK snapshot across FCA,
StepChange, Bank of England and UK Finance. `consumer_demand.py` loads it into
the shared country/year/period/metric/value/source/unit shape and calculates
within-series comparisons without blending percentages, counts or currency
flows. See `consumer-demand-cycle.md` for the current signal interpretation,
source caveats and the recommended next history pull.

To continue in a new chat: Read this README and the source-linked analysis in
`consumer-demand-cycle.md`.

## Hackathon demo: LP attribution and FI performance

Open `demo/index.html` in a browser. The static demo uses Cytoscape.js and the
fictional, self-contained data in `demo/fixture.js`. It includes the LP → GP →
company network, a cohort comparison (funding progression, follow-on rate,
valuation step-ups, exits and top-three concentration), and a ranked LP review
screen with suggested investigation angles.

**All names, portfolio links and figures in the demo are fictional.** The
fixture is only for building and presenting the interaction flow. Replace it
with a validated, licensed Dealroom query before presenting any results as fact.
The FI category rule, European fintech definition, cohort overlap and LP-to-GP
relationships must all be reviewed and documented first. LP portfolio links
do not prove direct company ownership, amount invested or realized return.
