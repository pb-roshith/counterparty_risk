# Connected Counterparty Risk API

FastAPI proof of concept for the supplied connected counterparty methodology and relationship workbook. The frontend design is unchanged. The API uses **synthetic demo data** until approved bank sources are connected.

## Run

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the API explorer. Read endpoints work in demo mode. Set `API_WRITE_KEY` and pass it as `X-API-Key` for ingestion, graph changes, and scoring requests. `DATABASE_URL` defaults to a local SQLite file for a zero-service demo; set a PostgreSQL URL for persistent deployment. Set `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` to enable graph persistence. In Neo4j mode, the service loads canonical entities, relationships, and evidence into a bounded in-process read cache at startup.

Run the existing frontend on port 8080 with `npm run dev` from `frontend/`. Its overall risk page calls this API at `http://127.0.0.1:8000` by default. Set `VITE_API_BASE_URL` in `frontend/.env` when the API is hosted elsewhere.

The dashboard's AI summary Report Generation cards call `POST /api/reports/{section}/pdf` with the selected counterparty dossier. Four section-specific Mistral agents generate Exposure, Contagion Risk, Risk Overview, and Evidence & Sources narratives. The API returns a two-page PDF summary grounded in the selected section's data. Set `MISTRAL_API_KEY` in `backend/.env`; `MISTRAL_REPORT_MODEL` optionally overrides `mistral-small-latest`. Report generation requires the backend to reach Mistral and returns an error to the dashboard if the key or service is unavailable.

The **Manufacture Data** page generates 1–1000 synthetic counterparties per request. The API requires a local request, a PostgreSQL `DATABASE_URL`, and a configured Neo4j connection. PostgreSQL stores business data in `counterparty_details`, `exposure`, `exposure_breakdown`, `assets_recovery`, `assets`, `early_warning`, `early_warning_indicators`, `contagion_risk`, `risk_assessments`, and `other_info`. Graph nodes, edges, UI graph data, and contagion paths are stored in Neo4j. The API joins these sources for the frontend. Keep database credentials in the ignored `backend/.env` file; never commit them.

`app/synthetic_model.py` defines the illustrative formulas for all 15 dashboard risk categories. Manufactured risk assessments store their input measures, formula text, per-category score and model version. Each record has a synthetic Level 2 supplier dependency used by both the contagion card and backend network calculation. Total exposure is the generated EAD; net exposure is EAD minus eligible collateral. Estimated recovery is capped at EAD and combines haircut-adjusted collateral with the LGD-based recovery on the unsecured portion. The legacy demo profiles call `/api/demo/category-assessment` to calculate the same 15 cards from their demo facts and explicitly listed assumptions. These category formulas are **not approved bank methodology** and must be calibrated before use with real counterparties.

To use Senzing v4, install/configure its licensed Python SDK and resources, set `SENZING_PROVIDER=senzing`, and provide `SENZING_ENGINE_CONFIGURATION_JSON`. The adapter uses the [documented v4 Python factory and engine methods](https://senzing.com/docs/python/4/3calls/). Its raw match evidence is separate from the platform confidence score. Mistral is optional; set `MISTRAL_API_KEY` for grounded summaries through the [chat completions API](https://docs.mistral.ai/api). Prompts pass through field redaction and ungrounded numerical output is rejected.

## Methodology

`app/configuration/methodology_v1.json` contains all 25 scored Level 1 and Level 2 relationship definitions, with the exact parameter names, weights, formula text, and rating thresholds extracted from the DOCX. `taxonomy_v0_1.json` contains all 45 workbook relationship entries and the source catalogue. The published version is validated and immutable in metadata storage. Recreate the reference files with:

```powershell
python tools/generate_reference.py "<path-to-methodology.docx>" "<path-to-relationships.xlsx>"
```

The central engine implements rating normalization, weighted relationship scores, confidence, stress, exposure and direction factors, network risk via the product formula, and the canonical 45/35/10/10 final risk score. Numeric rating suggestions use each relationship's threshold text and are marked provisional. Qualitative overrides require reviewed parameter ratings. The L1-01 ownership, financial materiality, and parent support measurement formulas are executable directly. All other formulas are preserved in configuration, while submitted parameter ratings are used for central calculation.

The insights endpoint returns group EAD, product EAD and share, indirect EAD, and network link count when the necessary data exists.

## API groups

- `/api/methodology`, `/api/taxonomy`: source-derived configuration and catalogue.
- `/api/counterparties`, `/api/paths`, `/api/graph`: entities and bounded relationship traversal.
- `/api/counterparties/{id}/risk`, `/insights`, `/exposure`: central risk, contagion, committee and exposure results.
- `/api/ingestion/records`: quality checks, entity resolution, lineage and canonical upsert.
- `/api/calculate/relationship`, `/api/methodology/ratings/suggest`: score traces and provisional rating suggestions.
- `/api/early-warning/*`, `/api/actions`, `/api/audit`: explicit warning formulas, workflow state and audit history.
- `/api/copilot/ask`: read-only explanation over structured facts.
- `/api/risk-copilot/ask`: Risk Copilot uses a Mistral beta Agent with read-only function tools for each PostgreSQL section and Neo4j graph retrieval. Set `MISTRAL_API_KEY` to enable the agent; without it, a limited factual fallback uses the same tools. The response includes table or graph citations.
- `/api/manufactured-counterparties`, `/api/manufactured-counterparties/generate`: persisted synthetic fixture listing and local generation.
- `/api/demo/category-assessment`: formula-backed category cards for the original synthetic demo profiles.

Run tests with `python -m unittest discover -s tests -v`.

## Integration status

The default mock resolver, synthetic data, in-memory graph and SQLite storage make the proof of concept runnable without external accounts. Neo4j, PostgreSQL, licensed Senzing, and Mistral adapters are configured through environment variables but have not been validated against this bank's instances. Source-specific detector logic, parameter measurement formulas beyond L1-01, approved scoring calibration, enterprise authentication, and full frontend API migration require bank rules, source mappings, credentials and test data. The existing frontend fetches its overall risk score from this API; its other screens still use the original labeled demo dataset. No UI design was changed.
