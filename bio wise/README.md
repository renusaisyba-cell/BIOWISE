# Bio Wise — Biogas Estimation

A full-stack educational project for biogas estimates, digester observations, five time-series charts, energy/LPG savings estimates, and digestate management.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js and Express
- Database: Supabase PostgreSQL

## Project structure
```text
bio wise/
├── frontend/        # index.html, styles.css, app.js
├── backend/         # Express API, routes, Supabase client, .env
├── database/        # schema.sql
├── .gitignore
└── README.md
```

## Run locally (Windows)
1. Install Node.js LTS and Git.
2. Open this folder in VS Code and open Terminal.
3. Run `cd backend` then `npm install`.
4. Create a Supabase project. Open its SQL Editor and run the contents of `../database/schema.sql`.
5. Edit `backend/.env` and replace the example `SUPABASE_URL` and server-side key with your own values. The included `.env` contains placeholders, not working credentials. Never share or commit a real service-role key.
6. Start the server with `npm run dev` (or `npm start`).
7. Open `http://localhost:3000` in your browser. Keep the terminal open while using it.

## Features
- Gas production vs time, temperature vs time, pH vs time, methane percentage vs time, and predicted vs actual production charts.
- Energy calculator estimates cooking energy, LPG displaced, and potential savings in rupees.
- Digestate management with estimated daily quantity and records.
- Supabase-backed saved data and history.

## Important estimate note
Values depend on assumptions and actual feedstock/digester conditions. Energy, LPG displacement, savings, and digestate values are estimates, not guarantees or calibrated engineering predictions. The app does not automatically read physical sensors; users enter observations.

## GitHub safety
`backend/.env` should remain private and is excluded by `.gitignore`. Before pushing, run `git status` and confirm no real credentials are staged. If a key is ever committed, rotate it immediately.
