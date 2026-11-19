# Explore Marlborough Google Ads report

One-page Google Ads report for Explore Marlborough Tours (153-623-0820), published with GitHub Pages.

- `index.html`, `styles.css`, `app.js`: the page. No build step.
- `data/google-daily.json`: one row per ad group per day since launch (15 Oct 2026). Bookings are the GA4 `purchase` conversion only.
- `scripts/fetch_google.py`: read-only Google Ads pull. Run locally, then commit and push `data/`:

      python3 scripts/fetch_google.py

Next: FareHarbor reconciliation (match GA4 transaction IDs to FareHarbor booking numbers).
