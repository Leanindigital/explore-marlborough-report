"""Read-only pull of Explore Marlborough Google Ads daily data into data/google-daily.json.

Usage: python3 scripts/fetch_google.py [path-to-folder-with-.env]
Defaults to ~/Documents/Claude Code/Google-Ads for credentials. Only GAQL search calls are made.
"""
import json, os, sys, datetime
from collections import defaultdict
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient

CID = "1536230820"  # Explore Marlborough Tours (clients.json)
START = "2026-10-15"
PURCHASE = "Explore Marlborough - GA4 (web) purchase"

envdir = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Documents/Claude Code/Google-Ads")
load_dotenv(os.path.join(envdir, ".env"))
keys = dict(developer_token="GOOGLE_ADS_DEVELOPER_TOKEN", client_id="GOOGLE_ADS_CLIENT_ID",
            client_secret="GOOGLE_ADS_CLIENT_SECRET", refresh_token="GOOGLE_ADS_REFRESH_TOKEN",
            login_customer_id="GOOGLE_ADS_LOGIN_CUSTOMER_ID")
cfg = {k: (os.getenv(v) or "").strip().strip('"').strip("'") for k, v in keys.items()}
# Tolerate dashes/spaces in the manager ID (e.g. 123-456-7890).
cfg["login_customer_id"] = "".join(c for c in cfg["login_customer_id"] if c.isdigit())
missing = [v for k, v in keys.items() if k != "login_customer_id" and not cfg[k]]
if missing:
    sys.exit("Missing credentials: " + ", ".join(missing) + ". Add them as repository secrets.")
if not cfg["login_customer_id"]:
    cfg.pop("login_customer_id")
cfg["use_proto_plus"] = True
ga = GoogleAdsClient.load_from_dict(cfg).get_service("GoogleAdsService")
q = lambda s: list(ga.search(customer_id=CID, query=s))

cust = q("SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1")[0].customer
tz = ZoneInfo(cust.time_zone)
end = (datetime.datetime.now(tz).date() - datetime.timedelta(days=1)).isoformat()
dr = f"segments.date BETWEEN '{START}' AND '{end}'"

rows = defaultdict(lambda: dict(impr=0, clicks=0, cost=0.0, bookings=0.0, value=0.0, other_conv=0.0))
for r in q(f"SELECT segments.date, campaign.name, ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros "
           f"FROM ad_group WHERE {dr} AND metrics.impressions > 0"):
    d = rows[(r.segments.date, r.campaign.name, r.ad_group.name)]
    d["impr"] += r.metrics.impressions; d["clicks"] += r.metrics.clicks; d["cost"] += r.metrics.cost_micros / 1e6
for r in q(f"SELECT segments.date, campaign.name, ad_group.name, segments.conversion_action_name, metrics.conversions, "
           f"metrics.conversions_value FROM ad_group WHERE {dr} AND metrics.conversions > 0"):
    d = rows[(r.segments.date, r.campaign.name, r.ad_group.name)]
    if r.segments.conversion_action_name == PURCHASE:
        d["bookings"] += r.metrics.conversions; d["value"] += r.metrics.conversions_value
    else:
        d["other_conv"] += r.metrics.conversions

# Cross-check against the account total for the same range.
tot = q(f"SELECT metrics.cost_micros, metrics.clicks FROM customer WHERE {dr}")
acct_cost = sum(r.metrics.cost_micros for r in tot) / 1e6
ours = sum(v["cost"] for v in rows.values())
if abs(acct_cost - ours) > 0.05:
    sys.exit(f"Cost mismatch: account {acct_cost:.2f} vs rows {ours:.2f}. Nothing written.")

out = dict(
    account="Explore Marlborough Tours", customer_id="153-623-0820", currency=cust.currency_code,
    time_zone=cust.time_zone, start=START, end=end,
    generated=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    bookings_action=PURCHASE,
    rows=[dict(date=k[0], campaign=k[1], ad_group=k[2], **{x: round(y, 2) for x, y in v.items()})
          for k, v in sorted(rows.items())],
)
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "google-daily.json")
with open(path, "w") as f:
    json.dump(out, f, indent=1)
print(f"Wrote {len(out['rows'])} rows, {START} to {end}, cost {ours:.2f} {cust.currency_code}")
