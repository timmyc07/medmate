# MediMate public web app design

## Goal and first release

MediMate will provide a mobile-first Traditional Chinese website for public lookups of pharmacies and medicine records. The first release will not create accounts, save a user's medicine box, or keep individual search history. Those features would handle personal information and need a separate authentication and privacy design.

The user-approved direction is Next.js with TypeScript for both the web interface and server-side API routes. The current project plan's Vanilla JavaScript/FastAPI design is superseded for this release.

## Architecture

- **Web and API:** Next.js App Router, with server-side Route Handlers for pharmacy and medicine search. The browser calls the app API and never connects to SQL Server directly.
- **Hosting:** Azure App Service, deployed from the public GitHub repository with GitHub Actions.
- **Database:** Azure SQL Database for online queries. The Parallels SQL Server remains a local development/source database; it will not be exposed to the public internet or queried directly by the deployed website.
- **Database access:** server-only SQL Server driver and parameterized, read-only query paths for public endpoints. Production credentials should use the App Service managed identity where supported; local development uses ignored environment configuration.
- **Repository:** `https://github.com/timmyc07/medmate` is public. It contains source, schema/migration scripts, non-sensitive documentation, and deployment workflow. It must exclude CSV source files, database exports/backups, secrets, `.env` files, and user records.

GitHub is the source-control and deployment trigger; it is not a database host. The online dataset is a separately managed Azure SQL copy populated from validated source data.

## User-facing behavior

1. A mobile-first home screen offers pharmacy search and medicine search.
2. Pharmacy lookup supports keyword and city/district filters, and presents name, address, telephone, service/contract status where sourced, and a tap-to-call link. Location-based sorting may be added if it can be done without sending precise location to the server; the user must explicitly invoke browser location access.
3. Medicine lookup supports name or license-number search and presents the official name, indication, license status, and relevant source/update information. The supplied medicine dataset has no side-effect column, so the first release must not invent or imply side-effect information.
4. Responses are paginated and bounded. The API validates query length and page size, uses parameterized SQL, and returns a clear empty/error state without exposing database details.
5. Public content is informational and links or attributes the official source. It is not a diagnosis, treatment recommendation, or substitute for a pharmacist/clinician.

## Data and ingestion

The current local `PharmacyDB` contains data imported from user-supplied CSV files. The source headers show that pharmacy records include institution status and contact/address fields; pharmacy contract data includes termination/closure fields; medicine records include cancellation status, cancellation/effective dates, and indications, but not side effects.

Before data is copied to Azure SQL or shown as current, ingestion must verify each source against its official publisher, confirm reuse terms, record source URL and retrieval date, normalize identifiers and encoding, deduplicate records, and define explicit active/current filters from the publisher's status/date fields. Cancelled/expired medicines and closed/terminated pharmacies must not appear as current results. Records with ambiguous status should be labeled or excluded until resolved. Each imported dataset must retain source/provenance metadata and an update timestamp.

The CSVs and database contents remain local and untracked. The app repository contains only schema and repeatable import tooling that reads a local or secret-provided input path.

## Security and operations

- Only server-side code can read database configuration; browser bundles contain no connection string or SQL credential.
- Public query endpoints use read-only permissions, parameterized queries, input limits, pagination, and generic error responses.
- Production database access is restricted to the app identity/network path where Azure supports it. The local Parallels instance is not port-forwarded for public use.
- GitHub Actions receives deployment credentials through workload identity/OIDC or protected repository secrets; no credentials are committed.
- Do not collect accounts, health histories, or search histories in the first release.
- Deployment configuration and code can be prepared in GitHub. Creating or enabling paid Azure resources requires an available Azure subscription and must be reviewed for cost before provisioning.

## Validation and acceptance

- Official dataset sources, reuse terms, retrieval dates, and active-status rules are documented before loading the online dataset.
- Tests cover search input validation, pagination bounds, SQL parameterization paths, inactive-record filtering, and empty/error results.
- The mobile UI can search pharmacies and medicines against a local SQL Server development database without exposing credentials to the client.
- A production configuration can target Azure SQL and deploy through GitHub Actions without storing secrets in the repository.
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
