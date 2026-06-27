# Home Health PT Scheduler

A mobile-friendly, browser-based scheduling app for home health physical therapy teams.

## Features

- Patient list with address, phone number, visits remaining, frequency, authorization expiration date, and notes.
- Weekly schedule and visit status tracking.
- Patients grouped by city or service area.
- Therapist assignment, mock role switching, admin reporting, import/export, and route/schedule optimization helpers.
- Permanent browser storage using `localStorage` so data remains saved on the device between sessions.
- iPhone-friendly responsive layout with safe-area spacing and bottom navigation.

## Run locally

```bash
npm install
npm start
```

Then open <http://localhost:4173>.

## Test and build

```bash
npm test
npm run build
```

The build command creates a static GitHub Pages artifact in `dist/`.

## Free GitHub Pages deployment

This repository is configured to deploy for free with GitHub Pages from GitHub Actions. The app uses relative asset paths (`./src/...`) and a static build artifact, so it works when hosted from the project site path `/PT/`, for example:

```text
https://YOUR-GITHUB-USERNAME.github.io/PT/
```

### One-time GitHub settings to enable

1. Push this branch and merge the pull request into `main`.
2. In GitHub, open the repository page.
3. Go to **Settings** → **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Save the setting if GitHub shows a save button.
6. Go to **Actions** and enable workflows if GitHub prompts you to allow them for the repository.
7. Open the **Deploy GitHub Pages** workflow and run it manually, or push to `main` after the Pages source is set to GitHub Actions.
8. After the workflow succeeds, open the published URL shown in the workflow summary or in **Settings** → **Pages**. It should end with `/PT/`.

### Deployment workflow

The workflow in `.github/workflows/deploy-pages.yml` runs on pushes to `main` and on manual dispatch. It installs dependencies with `npm ci`, runs `npm test`, builds the static site with `npm run build`, uploads `dist/`, and deploys it through GitHub Pages.
