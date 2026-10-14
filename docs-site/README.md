# GCT documentation site

This is the Fumadocs/Next.js site for the GCT showcase and user documentation. It is deployed as a static GitHub Pages artifact by `.github/workflows/docs.yml`.

## Local development

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. Documentation pages live in `content/docs/`; the homepage is `app/(home)/page.tsx`.

## Static export

GitHub Actions sets `PAGES_BASE_PATH` from the Pages configuration (`/github-copilot-tracker` for the project site). The build exports to `out/`, including the base path for assets, routes and search. To reproduce the Pages build locally:

```powershell
$env:PAGES_BASE_PATH = "/github-copilot-tracker"
npm run build
```

The repository currently serves GitHub Pages from `main:/docs`. `.github/workflows/docs.yml` builds the Fumadocs export and syncs it to `docs/`, so no Pages settings change is needed. GitHub Actions commits the generated static files after content changes.
