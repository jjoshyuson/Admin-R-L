# Cloud Access

This web app is prepared for GitHub Pages deployment from the `main` branch.

After the workflow is on GitHub, enable Pages:

1. Open the GitHub repository: `https://github.com/jjoshyuson/Admin-R-L`
2. Go to `Settings` > `Pages`.
3. Set `Build and deployment` > `Source` to `GitHub Actions`.
4. Open the `Actions` tab.
5. Run `Deploy admin web to GitHub Pages` if it has not already run.

The cloud URLs will be:

- Admin: `https://jjoshyuson.github.io/Admin-R-L/`
- POS: `https://jjoshyuson.github.io/Admin-R-L/pos.html`

The app uses Supabase for shared data. The GitHub Pages workflow includes the current public Supabase URL, anon key, and `menu-icons` storage bucket. If you rotate those values later, update the repository secrets or variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`

To work on the code from another PC:

```powershell
git clone https://github.com/jjoshyuson/Admin-R-L.git
cd Admin-R-L
npm install
Copy-Item .env.example .env.local
npm run dev
```
