# FPMS Batch Fetch & YH Update Progress

Last updated: 2026-08-04

---

## YH Database Status (query anytime via browser console)

Only **1 policy** currently in YH database: **0236043738**

### Policy 0236043738 — GREAT WEALTH ADVANTAGE (GWAD:0874)
- Reinvest transactions: **23** (F225 + F226)
- Null dividend_rates: **0** ✅ (all set)
- Latest reinvest: **2026-07-31** (F225 July 2026) ✅ inserted
- Holdings synced: ✅

---

## All 19 Policies — FPMS Data Collected

| Policy | Plan | ILP Dividends | F225 Jul 2026 | F226 Jul 2026 | YH Status |
|--------|------|--------------|---------------|---------------|-----------|
| 0256337860 | GWA4_5:1123 | ✅ | Reinvest | Reinvest | ❌ Not in YH yet |
| 0256081716 | GWA4_15:1125 | ✅ | Reinvest $0.48 | Reinvest $116.74 | ❌ Not in YH yet |
| 0252845534 | GWA4_15:1125 | ✅ | Reinvest $0.31 | Reinvest $80.12 | ❌ Not in YH yet |
| 0252800207 | GIA_SP:1027 | ✅ | Reinvest $0.10 | Reinvest $26.21 | ❌ Not in YH yet |
| 0250921069 | GWA4_15:1125 | ✅ | Reinvest $0.32 | Reinvest $84.54 | ❌ Not in YH yet |
| 0246597467 | GWA3_5:10059 | ✅ | Reinvest $62.06 | Reinvest $49.91 | ❌ Not in YH yet |
| 0241859277 | GWA2:1038 | ✅ | Reinvest $19.03 | Reinvest $28.68 | ❌ Not in YH yet |
| 0241567701 | GWA2:1038 | ✅ | PayNow GIRO only | N/A | ❌ Not in YH yet |
| 0236511949 | GREAT Life Adv III | ❌ Record Not Found | — | — | ❌ Not in YH yet |
| 0236043738 | GWAD:0874 | ✅ | Reinvest $0.14 | Reinvest $57.62 | ✅ **Updated** |
| 0215890909 | GLADII:0955 | ✅ | Reinvest $0.25 | F216 (not F226) | ❌ Not in YH yet |
| 0215020295 | GWAD:0874 | ✅ | Reinvest $0.40 | Reinvest $105.45 | ❌ Not in YH yet |
| 0214600201 | GREAT Life Adv | ❌ Record Not Found | — | — | ❌ Not in YH yet |
| 0214131662 | GREAT Wealth Adv | ❌ Record Not Found | — | — | ❌ Not in YH yet |
| 0213749900 | GWAD:0874 | ✅ | Reinvest $0.91 | Reinvest $281.65 | ❌ Not in YH yet |
| 0212448544 | GLAD:0873 | ✅ | Reinvest $0.27 | F216 (not F226) | ❌ Not in YH yet |
| 0204938752 | Smart Life Adv | ❌ Record Not Found | — | — | ❌ Not in YH yet |
| 0202882428 | SLA_PA:0741 | ✅ | Reinvest $188.33 | F216 (not F226) | ❌ Not in YH yet |
| 0071847552 | Smart Protect RP | ❌ Record Not Found | — | — | ❌ Not in YH yet |

---

## Fund Rate Reference (July 2026)
- **F225** GreatLink US Income and Growth Fund (Dis): **0.652%** (tx date 31/07/2026)
- **F226** GreatLink Multi-Sector Income Fund: **0.544%** (tx date 15/07/2026)

## Workflow: Clipboard Method (going forward)
1. BlackBerry Access → FPMS → Policy Info → Quick Links → ILP Dividend
2. **Ctrl+A → Ctrl+C** to copy page
3. Claude reads clipboard, parses table, updates Supabase directly
4. No screenshots needed — much faster

## How to Check Progress
Run this in browser console on yhportfoliotracker.vercel.app:
```javascript
const s = JSON.parse(localStorage['sb-togtmfuaoizaqynahzzi-auth-token']);
fetch('https://togtmfuaoizaqynahzzi.supabase.co/rest/v1/policies?select=policy_number', {
  headers: { 'apikey': '<anon_key>', 'Authorization': `Bearer ${s.access_token}` }
}).then(r=>r.json()).then(console.log)
```
