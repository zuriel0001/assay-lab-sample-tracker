# MET Lab Sample Tracker on Azure (free test deployment)

This folder is the v13 MET Lab Sample Tracker made to run outside Claude, on Microsoft Azure free tiers.
It keeps the prototype's workflow exactly: routes, lab batches and QC, action limits, the second-person release,
amendments, certificates, the in/out ledger, public submission and lookup without sign-in, and the roles.
What changes is where data lives (Azure Cosmos DB), how staff sign in (their Microsoft account) and a server that
decides who may read and change what.

## Deploying it (what Zuriel does)

You need a GitHub account (you have one) and an Azure account. Everything below stays on free plans.

1. **GitHub repository** (done): https://github.com/zuriel0001/met-lab-sample-tracker holds this folder. Claude pushes
   updates there; each push redeploys the site automatically once step 4 is done.
2. **Create a free Azure account** at https://azure.microsoft.com/free. Microsoft asks for a card to check your
   identity; the plans below don't charge it. The free account is a 30-day trial: before it ends, Microsoft emails you
   to move to **pay-as-you-go**. Do it (portal → *Subscriptions* → *Upgrade*), or the account and the site are switched
   off. After the move you pay only for use above the free amounts, which this setup stays inside (see *What it costs*).
3. **Create the database.** In the Azure portal (https://portal.azure.com): *Create a resource* → search
   **Azure Cosmos DB** → *Azure Cosmos DB for NoSQL* → *Create*.
   - Resource group: *Create new*, `sample-tracker`. Account name: for example `metlab-tracker-db`.
   - Location: **West Europe**, the same region as the web app's API in step 4, so the two talk quickly. (Static Web Apps
     runs its API in only a few regions; West Europe is the nearest of them to Ghana.)
   - Capacity mode: **Provisioned throughput**. **Apply Free Tier Discount: Apply.**
     **Limit total account throughput: ticked** (keeps it inside the free 1000 RU/s).
   - On the **Backup Policy** tab choose **Continuous (7 days)**. Keeping it is free; it lets you put the database back
     as it was at any moment of the last 7 days, yourself, from the portal (a restore is charged per GB, cents for this data).
   - *Review + create* → *Create*. When it is ready, open it → *Settings* → *Keys* → copy the
     **PRIMARY CONNECTION STRING**.
4. **Create the web app.** *Create a resource* → search **Static Web App** → *Create*.
   - Resource group `sample-tracker`, name `metlab-sample-tracker`, Plan type **Free**. Region for the API (and staging):
     **West Europe**.
   - Source **GitHub**: sign in, pick the repository from step 1, branch `main`.
   - Build presets **Custom**. App location `/app`. Api location `/api`. Output location: leave empty.
   - *Review + create* → *Create*. Azure adds a deployment file to the repository and publishes the site; the
     first run takes a few minutes (watch it under the repository's *Actions* tab).
5. **Connect the two.** Open the Static Web App → *Settings* → *Environment variables* → add:
   - `COSMOS_CONNECTION_STRING` = the connection string from step 3
   - `ADMIN_EMAILS` = the email you sign in to Microsoft with (more than one: separate with commas)

   Press *Apply*.
6. **Open the site** (the URL on the Static Web App's *Overview*, like `https://xxxx.azurestaticapps.net`).
   *Staff sign in* → **Sign in with Microsoft**. You arrive as admin. On **Settings → Staff accounts**, type each
   person's Microsoft sign-in email on their row (your own row is added for you), delete example rows you don't
   need, and press **Save settings**. From then on, the people on that list sign in with their role.

Anyone can still submit a sample and look one up without signing in, from the same URL.

## Trying it out

- Submit a sample without signing in (use a private browser window); write down the ID; look it up by ID and tag.
- Sign in as a technician: confirm receipt, move it through the steps, put it in a lab batch, enter results.
- Release needs a supervisor or the admin who did **not** enter the results, so testing it needs two Microsoft
  accounts. A free personal account (outlook.com) works for a second test person.
- Sign in as a section account and check that only that section's released results appear on *Results*.
- Export the ledger CSV and open it in Excel.

## What it costs

Nothing while it stays within: Static Web Apps **Free** plan (100 GB traffic a month), and one Cosmos DB account
with the free tier applied (1000 RU/s and 25 GB, for the life of the account) with *Limit total account throughput*
ticked. Neither has an end date. The Azure free account itself is a 30-day trial; moving it to pay-as-you-go when
Microsoft asks (step 2) keeps both free plans ([free account FAQ](https://azure.microsoft.com/en-us/free/free-account-faq/)). Optional safety net: Azure portal → *Cost Management* → *Budgets* → a budget of 1 (any currency) with an
email alert.

## Why Cosmos DB and not Azure SQL

The Azure SQL Database free offer gives 100,000 vCore-seconds a month. A tracker that lab pages keep open all day
keeps the database awake, which uses that up in roughly 55 hours, and then the database pauses until the next month.
The Cosmos DB free tier has no time allowance (it is a fixed 1000 RU/s that never runs out) and stores records the way
the tracker already shapes them. Sources: [SQL free offer](https://learn.microsoft.com/azure/azure-sql/database/free-offer),
[Cosmos DB free tier](https://learn.microsoft.com/azure/cosmos-db/free-tier),
[Static Web Apps plans](https://learn.microsoft.com/azure/static-web-apps/plans) and
[quotas](https://learn.microsoft.com/azure/static-web-apps/quotas).

## Limits of this test deployment

- **What the server enforces, and what only the page checks.** Besides who may read and change what (below), the
  server keeps the record honest whatever a page sends: a sample's history, its certificates and the ledger's movements
  are only ever added to, never edited or removed; samples and ledger days are never deleted; every new history line,
  result, certificate, limit action and QC acceptance must name the person actually signed in; only a lab supervisor or
  the lab manager releases results or accepts QC, and not the person who entered the results (the lab manager may,
  giving the reason that is printed). The step order, the QC gates before release and the limit holds are checked by
  the page only: someone with a lab staff account and developer tools could skip a step, but not hide that they did.
  Moving those checks onto the server too is a step before this becomes the production system.
- **Any Microsoft account can sign in**, but it sees only the public pages until an admin puts its email on a staff
  account. Limiting sign-in to the company's own Microsoft 365 tenant needs the Standard plan (about US$9 a month).
- **Live updates** arrive every 2.5 seconds (15 seconds when the tab is in the background); each change is sent to a
  page once.
- **Backups:** the continuous 7-day backup from step 3, plus **Settings → Download backup** (lab manager only): one
  JSON file with every record, to keep somewhere safe (weekly, say). Keep the paper log going during the test.
- **Size:** the workflow board loads only the samples still in the lab (awaiting receipt up to results released).
  Stored material is listed on the *Storage* tab from small stock records (about 250 bytes per sample), and the
  ledger's month check, section results and reference material charts read bounded lists, sorted and cut in the
  database. In the prototype's test with 3,000 stored samples the board loads 14 KB instead of 21.6 MB.
- **The certificate still says it is a design prototype**, not an official laboratory certificate.
- The example reference material values and permit limits are still example values (Settings).
- The API trusts the sign-in details Static Web Apps adds to each request (`x-ms-client-principal`). Claude checks,
  once the site is live, that a request can't fake them.
- Teams: the site can be pinned in a Teams channel as a link or website tab; a proper Teams app is a later step.

## Who can do what (enforced by the server)

| Person | Reads | Changes |
|---|---|---|
| Not signed in, or signed in without an account | A sample by ID, tag or site reference, without results (unless Settings says anyone may see results); certificate number and check code | Submit new samples only (checked: new ID, not received, no results, current time) |
| Section account | As above, plus its own section's samples with results | As above |
| Viewer | Everything | Submit new samples only |
| Lab technician, lab supervisor | Everything | Samples, batches, ledger, stock records, tag index |
| Admin | Everything, including sign-in emails | All of that, plus Settings and the backup download |

Staff see each other's names and roles but not their sign-in emails. The ledger, lab batches and stock records (which
name shelves and tags) are staff only. Nobody deletes a sample, its stock record or a ledger day. The API only answers JSON requests from the site's own page, so another website
can't make a signed-in person's browser change records.

## How it is built

| Path | What it is |
|---|---|
| `app/index.html` | The page. Built by `build.py` from `../sample-tracking/met-lab-sample-tracker.html` (v13), which it never edits. Every patch must match exactly once, so a changed prototype fails the build loudly. |
| `app/azure-shim.js` | Gives the page the shared-database interface it was written for, over `/api/db`: documents, where-filters, live snapshots (by polling for changes), short leases; plus the signed-in person (`/api/me`) and downloads. |
| `app/staticwebapp.config.json` | Node 22 API, Microsoft sign-in only (GitHub sign-in turned off), `/login` and `/logout`. |
| `api/db`, `api/me` | Azure Functions (HTTP) behind `/api`. |
| `api/lib/core.js` | Accounts (Microsoft email → role from Settings; `ADMIN_EMAILS` are admins), the read/write rules above and the record-keeping rules (checked inside each write, on the record as it is at that moment). |
| `api/lib/store-cosmos.js` | Cosmos DB store: one container `docs` in database `tracker` (created on first use with 1000 RU/s on the container), partitioned by collection; filters, sorting and limits run in the database; ETag checks on every read-modify-write; leases as records; deletes kept as markers so open pages hear about them. |
| `api/lib/store-memory.js` | The same store in memory, for local runs and tests. |
| `dev/server.js` | Local stand-in for Static Web Apps: `node dev/server.js` → http://localhost:4280, in-memory data, a local sign-in page (type an email, or an example username such as `tech1`). |
| `test/api-tests.js` | 101 checks of the read/write rules, the record-keeping rules, stock records, the backup export and the Functions entry points. |
| `test/store-tests.js` | 27 checks on each store; Cosmos runs against `@vercel/cosmosdb-server` (a local Cosmos imitation) or a real account. |
| `test/run-suites.js` | Runs the prototype's own six browser suites against this build (real page, real API over HTTP), unchanged, then `azure-extra.js`. |
| `test/azure-extra.js` | 26 browser checks of what is new: Microsoft sign-in, first admin, accounts by email, upgrade on staff sign-in, what the public sees, the backup download, the server refusing a tampered page's changes. |

Patches `build.py` makes to the page: start after `/api/me` answers; tracking links use this site's address; the
sign-in tab is *Sign in with Microsoft*; accounts have a *Microsoft sign-in email* instead of a password; the first
admin is added to the account list on their first visit to Settings; upgrades and ledger repairs run when a staff
member signs in; permission errors from the server are shown as such; the header says *Test system*; the prototype's
explanatory paragraphs are taken out (labels, warnings, status lines and each route's own description stay).

### Test results (2026-10-14)

| Suite | Result |
|---|---|
| `api-tests.js` | 101 / 101 |
| `store-tests.js` | 54 / 54 (27 in memory, 27 on the local Cosmos DB imitation) |
| `azure-extra.js` | 26 / 26 |
| Prototype `run.js` | 101 / 107 |
| Prototype `results-tests.js` | 87 / 88 |
| Prototype `v12-tests.js` | 67 / 70 |
| Prototype `v13-tests.js` | 26 / 26 (including 3,000 stored samples) |
| Prototype `review-tests-v11.js` | 41 / 41 |
| Prototype `review-v11-scenarios.js` | 5 / 5 |

No console errors in any suite. The 10 prototype checks that don't pass all expect a page **nobody is signed in to** to
upgrade older records (9) or finish a lab batch a crashed device left half-made (1). On Azure the public can't
change records, so these run when lab staff sign in, and every five minutes on staff pages (`azure-extra.js` checks
the upgrade on sign-in, including the new stock record). Real data on Azure starts at v13, so the upgrade itself only
matters for the tests.

The prototype suites give the same results with the server's record-keeping rules switched on, so every flow the page
has (receipt, steps, batches, results, release, amendments, re-assays, storage, ledger) already writes within them.

Found and fixed while testing: the public form couldn't release its short claim on a new ID (staff waited up to
4 s to receive a just-submitted sample); lists didn't refresh when a page's sign-in changed; a guest page could
briefly try to show withheld results when an admin opened results to everyone.

### Running the checks

```sh
python3 build.py
node test/api-tests.js
NODE_PATH=<folder with @azure/cosmos and @vercel/cosmosdb-server> node test/store-tests.js
NODE_PATH=$(npm root -g) node test/run-suites.js            # needs Playwright + Chromium
```
