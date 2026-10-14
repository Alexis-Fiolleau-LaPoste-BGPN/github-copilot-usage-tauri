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

The repository's Pages source must be set to **GitHub Actions** for `.github/workflows/docs.yml` to deploy.
