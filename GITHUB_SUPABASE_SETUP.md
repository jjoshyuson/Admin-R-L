# Admin Web GitHub + Supabase Setup Guide

This guide is for the `admin-web` project in:

`C:\Users\joshy\OneDrive\Documents\OOH POS 3.0\admin-web`

The goal is:

1. Put the web app on GitHub.
2. Keep the code backed up and versioned.
3. Connect the web app to Supabase correctly.
4. Prepare it for deployment later.

## What GitHub Is For

GitHub is for:

- storing the code
- version history
- backup
- sharing the project
- deploying through services like Vercel or Netlify

GitHub does **not** replace Supabase.

Supabase is for:

- database tables
- storage buckets
- API access
- authentication if you add it later

## Important Clarification

For this admin web app:

- `GitHub` stores your source code
- `Supabase` stores your live data
- your `hosting platform` runs the web app for users

So yes, you should put the project on GitHub.

But GitHub alone will not make syncing work.

To make syncing work, you must also provide:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`

## Current Project Status

This project already has:

- React + Vite
- Supabase client dependency
- `.env.example`
- build script
- test script

This project is **not currently a Git repository yet** in the local workspace, so you need to initialize Git first.

## Files You Already Have

- [package.json](</C:/Users/joshy/OneDrive/Documents/OOH POS 3.0/admin-web/package.json>)
- [.env.example](</C:/Users/joshy/OneDrive/Documents/OOH POS 3.0/admin-web/.env.example>)
- [.gitignore](</C:/Users/joshy/OneDrive/Documents/OOH POS 3.0/admin-web/.gitignore>)

## Step 1: Open The Correct Folder

Open PowerShell in:

```powershell
cd "C:\Users\joshy\OneDrive\Documents\OOH POS 3.0\admin-web"
```

Everything below assumes you are inside `admin-web`.

## Step 2: Make Sure Local Env Is Set

Create a local env file from the example.

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and fill in the real values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_SUPABASE_STORAGE_BUCKET=menu-icons
```

### Where To Get These

In Supabase:

1. Open your project dashboard.
2. Go to `Project Settings`.
3. Open `API`.
4. Copy:
   - Project URL
   - `anon` public key
5. Confirm your storage bucket name.

## Step 3: Test The Web App Locally First

Install packages if needed:

```powershell
npm install
```

Run the dev server:

```powershell
npm run dev
```

Build check:

```powershell
npm run build
```

Test check:

```powershell
npm test
```

Do not push to GitHub until local build passes.

## Step 4: Initialize Git In `admin-web`

This workspace is not yet a Git repo, so initialize one:

```powershell
git init
git branch -M main
```

Check status:

```powershell
git status
```

## Step 5: Review What Will Be Committed

Make sure these are **not** committed:

- `node_modules`
- `dist`
- `.env.local`

The current `.gitignore` already ignores `node_modules` and `dist`.

### Add `.env.local` Protection If Needed

If `.env.local` is not already ignored, append this to `.gitignore`:

```gitignore
.env.local
.env
```

That is strongly recommended so you do not publish keys by mistake.

## Step 6: Create The First Commit

Stage files:

```powershell
git add .
```

Create commit:

```powershell
git commit -m "Initial admin-web sync integration"
```

## Step 7: Create A GitHub Repository

On GitHub website:

1. Log in.
2. Click `New repository`.
3. Repository name suggestion:
   - `ooh-pos-admin-web`
4. Keep it `Private` unless you intentionally want it public.
5. Do **not** add a README, `.gitignore`, or license from GitHub if you already committed locally.
6. Create repository.

After creation, GitHub will show the remote URL.

It will look like one of these:

```text
https://github.com/YOUR_USERNAME/ooh-pos-admin-web.git
```

or

```text
git@github.com:YOUR_USERNAME/ooh-pos-admin-web.git
```

## Step 8: Connect Local Repo To GitHub

Using HTTPS:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/ooh-pos-admin-web.git
git push -u origin main
```

Using SSH:

```powershell
git remote add origin git@github.com:YOUR_USERNAME/ooh-pos-admin-web.git
git push -u origin main
```

If GitHub asks for login, complete the authentication flow.

## Step 9: Verify GitHub Upload

On the GitHub repo page, confirm these appear:

- `src/`
- `public/`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.env.example`
- `WORKLOG.md`
- this guide file

Confirm these do **not** appear:

- `.env.local`
- `node_modules`
- `dist`

## Step 10: Understand What GitHub Does For Supabase

GitHub does not automatically connect to Supabase.

You still need to:

1. keep the correct environment variables
2. point the app to the correct Supabase project
3. make sure the database tables and storage bucket exist
4. make sure Supabase policies allow the web app to read/write what it needs

## Step 11: Minimum Supabase Checklist

Before expecting live sync in the web app, confirm:

### A. Correct project

Your `.env.local` values match the exact Supabase project you intend to use.

### B. Required public env vars exist

You have:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`

### C. Storage bucket exists

If menu image upload is used, confirm the bucket exists:

- `menu-icons`

Or update the env value to the actual bucket name.

### D. Database tables exist

Your Supabase project must already contain the tables expected by the web app and Android admin app baseline.

If you want Menu Settings half-order pricing to persist from the web app, also run:

- [SUPABASE_MENU_HALF_PRICE.sql](</C:/Users/joshy/OneDrive/Documents/OOH POS 3.0/SUPABASE_MENU_HALF_PRICE.sql>)

That patch adds the optional `public.products.half_order_price` column the latest admin-web build already knows how to read and write.

If you want POS edit-order approval to be controlled by Admin Web, also run:

- [SUPABASE_ORDER_EDIT_REQUESTS.sql](</C:/Users/joshy/OneDrive/Documents/OOH POS 3.0/SUPABASE_ORDER_EDIT_REQUESTS.sql>)

That patch adds the `public.order_edit_requests` realtime table used when POS asks Admin Web to approve editing an existing order.

### E. Row Level Security / policies

If RLS is enabled, the anon client must be allowed to perform the reads/writes required by the admin web app.

If policies block access, the UI may load but sync counts will show errors or zero data.

## Step 12: If You Want Deployment After GitHub

Best path:

1. push code to GitHub
2. connect repo to `Vercel` or `Netlify`
3. add the same environment variables there
4. deploy

For Vite apps, this is easier than trying to use GitHub alone as the host.

## Recommended Deployment Variables

Set these in the hosting platform:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_STORAGE_BUCKET
```

Use the same values as `.env.local`.

## Step 13: Ongoing Workflow After GitHub Setup

Every time you make changes:

```powershell
git status
git add .
git commit -m "Describe the change"
git push
```

## Recommended Commit Style

Examples:

- `git commit -m "Wire sync troubleshooting screen"`
- `git commit -m "Connect admin-web orders to Supabase"`
- `git commit -m "Add finance and payables sync flows"`

## Safe Rule For Secrets

Never commit:

- `.env.local`
- service role keys
- database passwords

The web app should use the public `anon` key only.

Do not place the Supabase `service_role` key in frontend code.

## What To Ask ChatGPT Website For Help With

You said you want to use ChatGPT website to help while doing this. Use prompts like these:

### Prompt 1: GitHub push help

```text
I have a Vite React app in a local folder on Windows. I need a step-by-step guide to initialize git, create a GitHub repo, connect the remote, and push my first commit. Explain each command and what output I should expect.
```

### Prompt 2: Supabase env help

```text
I have a Vite React app using Supabase. Explain exactly where to find VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Supabase dashboard, and how to set them in .env.local and in Vercel.
```

### Prompt 3: Deployment help

```text
I have already pushed my Vite React app to GitHub. Give me a step-by-step guide to deploy it on Vercel and configure the required environment variables for Supabase.
```

### Prompt 4: Troubleshooting sync

```text
My React Vite admin app shows zero sync data even though Supabase is connected. Give me a troubleshooting checklist for environment variables, RLS policies, table names, storage buckets, and browser console/network errors.
```

## Fastest Practical Path

If you want the fastest clean path, do this:

1. set `.env.local`
2. run `npm run build`
3. run `npm test`
4. run `git init`
5. create GitHub repo
6. push code
7. deploy from GitHub using Vercel
8. add Supabase env vars in Vercel
9. verify the Sync Data & Logs screen

## Final Notes

- You do need GitHub for a proper source-control and deployment workflow.
- You do not need GitHub just to make local Supabase syncing work.
- You do need Supabase env setup for the web app to actually read live data.
- If the sync screen still shows nothing after env setup, check Supabase rows and policies next.
