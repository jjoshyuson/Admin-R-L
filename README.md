# OOH POS Admin Web

This is the cloud-editable web app repo for the OOH POS admin and POS screens.

Live app:

- Admin: https://jjoshyuson.github.io/Admin-R-L/
- POS: https://jjoshyuson.github.io/Admin-R-L/pos.html

## Work From Another PC

Install these on the other PC:

- Git
- Node.js 22 LTS or newer
- VS Code, Cursor, or another editor

Clone the repo:

```powershell
git clone https://github.com/jjoshyuson/Admin-R-L.git
cd Admin-R-L
```

Install and run:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open the local URL shown by Vite. The POS route is `/pos.html`.

## Save Changes Back To The Cloud Repo

After editing on either PC:

```powershell
git status
git add .
git commit -m "Describe your change"
git push origin main
```

On the other PC before starting work:

```powershell
git pull origin main
```

## Cloud Dev Option

You can also open the repo in GitHub Codespaces from the GitHub repo page. The `.devcontainer` config installs dependencies and forwards the Vite dev server port.

## Shared Data

The app connects to the same Supabase project from every PC, using:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`

Keep `.env.local` private. It is ignored by Git.
