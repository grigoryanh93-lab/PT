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

The build command creates a static deployment artifact in `dist/`. Vercel installs with `npm install`, builds with `npm run build`, and serves `dist/` as the output directory.

## Vercel deployment

This app is a static site. `vercel.json` tells Vercel to:

- install dependencies with `npm install`;
- build with `npm run build`;
- serve the generated `dist/` directory.

Deploy from the `main` branch in Vercel and keep the output directory set to `dist` if overriding project settings manually.

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

## Shared Supabase mode

The app runs in demo mode when Supabase is not configured. Demo mode keeps using `localStorage` so a therapist can try the app on one device. To make the app shared across phones, create a Supabase project and run `supabase-schema.sql` in the Supabase SQL editor.

### Environment variables

Set these variables in Vercel (**Project Settings → Environment Variables**) and redeploy:

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
```

For local static builds you can also export `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before running `npm run build`. The build writes those values into `dist/src/config.js`. Do not use the Supabase service-role key in Vercel or in the browser.

### First admin and therapist accounts

1. In Supabase Auth, create the first admin user.
2. Copy that user's Auth UID.
3. Insert matching rows in `profiles` and `therapists` with role `admin`.
4. Log in to the app with the admin account.
5. Use **Therapists → Add therapist** to create therapist profiles in the app, then create or invite matching Supabase Auth users from the Supabase dashboard using the same UID/profile details.

Admins can see all patients, appointments, visit logs, reports, imports, and exports. Therapists can only read assigned patients and appointments because the Supabase row-level security policies filter rows by `auth.uid()`.

### Offline/cache behavior

Successful Supabase loads are cached to `localStorage`. If Supabase is unavailable, the app displays a warning and continues with the local cache so phone use is not blocked, but the source of truth for configured deployments is Supabase.
