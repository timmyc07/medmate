# MediMate public web app design

> **部署方向修訂（2026-10-08）：** 首版使用 Render Node Web Service 與 Neon PostgreSQL，覆蓋原定 Azure 架構。Parallels SQL Server 不對外開放；線上資料來自核對過的政府 CSV，保留來源、批次日期與有效資料篩選。Render Free 會休眠，不承諾即時可用性。

## Goal and first release

MediMate will provide a mobile-first Traditional Chinese website for public lookups of pharmacies and medicine records. The first release will not create accounts, save a user's medicine box, or keep individual search history. Those features would handle personal information and need a separate authentication and privacy design.

The user-approved direction is Next.js with TypeScript for both the web interface and server-side API routes. The current project plan's Vanilla JavaScript/FastAPI design is superseded for this release.

## Architecture

- **Web and API:** Next.js App Router, with server-side Route Handlers for pharmacy and medicine search. The browser calls the app API and never connects to SQL Server directly.
- **Hosting:** Render Node Web Service，從 GitHub 部署。
- **Database:** Neon PostgreSQL for online queries. The Parallels SQL Server remains private and is not queried by the deployed website; validated government CSV resources supply catalog data.
- **Database access:** server-only `pg` pool and parameterized query paths. Render uses a pooled `DATABASE_URL`; migrations and imports use an ignored local direct URL.
- **Repository:** `https://github.com/timmyc07/medmate` is public. It contains source, schema/migration scripts, non-sensitive documentation, and deployment workflow. It must exclude CSV source files, database exports/backups, secrets, `.env` files, and user records.

GitHub is the source-control and deployment trigger; it is not a database host. The online dataset is a Neon copy populated from validated government CSV sources.

## User-facing behavior

1. A mobile-first home screen offers pharmacy search and medicine search.
2. Pharmacy lookup supports keyword and city/district filters, and presents name, address, telephone, service/contract status where sourced, and a tap-to-call link. Location-based sorting may be added if it can be done without sending precise location to the server; the user must explicitly invoke browser location access.
3. Medicine lookup supports name or license-number search and presents the official name, indication, license status, and relevant source/update information. The supplied medicine dataset has no side-effect column, so the first release must not invent or imply side-effect information.
4. Responses are paginated and bounded. The API validates query length and page size, uses parameterized SQL, and returns a clear empty/error state without exposing database details.
5. Public content is informational and links or attributes the official source. It is not a diagnosis, treatment recommendation, or substitute for a pharmacist/clinician.

## Data and ingestion

The prior local `PharmacyDB` contains imported user CSVs. The public Neon catalog is populated from re-downloaded government sources. Pharmacy contract records include termination dates; medicine records include cancellation status, valid-until dates, and indications, but not side effects.

Ingestion verifies official publishers and reuse terms, records source URLs and retrieval time, normalizes identifiers and encoding, deduplicates records, and applies explicit status/date filters. Cancelled/expired medicines and terminated pharmacies are excluded. Each imported dataset retains source metadata and an update timestamp.

The CSVs and database contents remain local and untracked. The app repository contains only schema and repeatable import tooling that reads a local or secret-provided input path.

## Security and operations

- Only server-side code can read database configuration; browser bundles contain no connection string or SQL credential.
- Public query endpoints use read-only permissions, parameterized queries, input limits, pagination, and generic error responses.
- Production database access is server-side only. The local Parallels instance is not port-forwarded for public use.
- GitHub Actions receives deployment credentials through workload identity/OIDC or protected repository secrets; no credentials are committed.
- Do not collect accounts, health histories, or search histories in the first release.
- Render and Neon costs depend on selected plans; Render Free may sleep.

## Validation and acceptance

- Official dataset sources, reuse terms, retrieval dates, and active-status rules are documented before loading the online dataset.
- Tests cover search input validation, pagination bounds, SQL parameterization paths, inactive-record filtering, and empty/error results.
- The mobile UI can search pharmacies and medicines through server-side Neon queries without exposing credentials to the client.
- A production configuration can target Neon and deploy from GitHub without storing secrets in the repository.
- Repository history and current contents contain no supplied CSVs, database dumps, or credentials.
- The public site labels source freshness and does not claim side-effect or personalized medical advice unsupported by the source data.

## Verified platform references

Checked on 2026-10-08; official pages returned HTTP 200:

- Next.js Backend for Frontend and Route Handlers: <https://nextjs.org/docs/app/guides/backend-for-frontend>
- Microsoft Learn, Node.js with Azure SQL Database / Managed Instance: <https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-nodejs?view=azuresql>
- Microsoft Learn, deploy Azure App Service with GitHub Actions: <https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions?tabs=applevel>
- Microsoft Learn, App Service managed identities: <https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity>
- GitHub Docs, GitHub Pages is a static hosting service (not an application database): <https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>

Package versions and Taiwan government dataset endpoints/licensing will be rechecked against their authoritative registries/publishers in the implementation plan before dependency installation or online data ingestion.
