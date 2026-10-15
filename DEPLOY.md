# Setting up another copy of the Assay Lab Sample Tracker

This repository holds everything needed to build and run the site: the page (`app/`), the server (`api/`), the source
the page is built from (`prototype/`, with `build.py`) and the tests. Deploying it again gives the same site.

## What a new copy does not get from GitHub

- **The data.** Samples, lab batches, the ledger, stock records, kept results files, Settings (staff accounts, sections,
  site time, workflow routes, reference materials, limits, logo), access requests and email logins all live in the
  copy's own database. A new copy starts empty; a backup from another copy can be loaded into it (*Moving data* below).
- **The settings in step 4** (database connection string, admin emails). Keep the connection string private: never
  put it in GitHub and never send it to anyone.
- The lab's two real SGS report files used in testing are kept out of GitHub on purpose.

## A second copy on Azure

These are the steps of *Deploying it* in `README.md`, with what differs for a second copy.

1. **Database (Azure Cosmos DB for NoSQL).** Create it as in README step 3 (Provisioned throughput, Limit total account
   throughput ticked, Continuous 7-day backup), then copy its **PRIMARY CONNECTION STRING** (*Settings* → *Keys*).
   The free tier is **one Cosmos DB account per Azure subscription**, and the live site already uses this
   subscription's. For the second copy, either:
   - create it in **another subscription** (for example the company's), where *Apply Free Tier Discount* is available; or
   - **share the live site's account** with a database of its own: in the live account open *Data Explorer* →
     `tracker` → `docs` → *Scale & Settings*, lower the throughput to 600 RU/s and *Save*; then in step 4 below set
     `COSMOS_DATABASE` = `tracker2` and `COSMOS_THROUGHPUT` = `400`, so the two together stay inside the free 1000 RU/s; or
   - create a paid account (serverless capacity mode charges per use, small for this data).
2. **Web app (Static Web App, Free plan).** Create it as in README step 4: Source **GitHub**, repository
   `zuriel0001/assay-lab-sample-tracker`, Build presets **Custom**, App location `/app`, Api location `/api`, Output
   location empty.
   - Azure adds a second deployment file to `.github/workflows/`. From then on **every push to `main` updates both
     sites**, so they stay the same.
   - For a copy that should *not* change when the live site changes (a training or test copy), first make a branch in
     GitHub (for example `copy-b`) and pick that branch here instead of `main`.
3. **Wait for the first deployment** (the repository's *Actions* tab shows a green tick).
4. **Settings of the web app.** Static Web App → *Settings* → *Environment variables* → add, then *Apply*:

   | Name | Value |
   |---|---|
   | `COSMOS_CONNECTION_STRING` | The connection string from step 1. Required. |
   | `ADMIN_EMAILS` | The first lab manager's email (more than one: separate with commas). Required. |
   | `COSMOS_DATABASE` | Optional. The database name; default `tracker`. Use another name when sharing an account. |
   | `COSMOS_THROUGHPUT` | Optional. RU/s given to the database's container when the site first creates it; default 1000. |
   | `AUTH_SECRET` | Not needed. The site makes its own key for email sign-ins and keeps it in its database. Set it only to choose the key yourself; changing it later signs every email user out. |

5. **Check it.** Open `https://<the new address>/api/health`. It should say `"store": "cosmos"` with `read`, `query`,
   `changes` and `lease` all `ok` (the `ids` line is a diagnostic and always shows one failure).
6. **First sign-in.** Sign in with an address from `ADMIN_EMAILS` (*Sign in with Microsoft*, or *Sign up with email* with
   that address) and you are the lab manager. Go straight to **Settings → Accounts**, check your row says Admin, and
   press **Save settings**. Until an admin is saved there, anyone who signs up with email using an `ADMIN_EMAILS`
   address becomes admin.
7. **Fill in Settings** for this copy (sections, site time and lab shifts, staff, reference materials, limits, routes,
   logo), or load a backup of another copy instead (*Moving data* below).

Also for each copy: the Azure free account is a 30-day trial (move to pay-as-you-go to keep the free plans running),
and a budget alert (*Cost Management* → *Budgets*) is a good safety net.

## Moving data between copies

1. On the copy that has the data: **Settings → Download backup** (lab manager). The file holds every record: Settings,
   samples, batches, ledger, stock records, site sample code index, ID counters, access requests and kept results files.
2. On the new copy, before anyone registers a sample there: sign in as its lab manager (step 6 above), open
   **Settings** and press **Restore backup** (it shows only while the copy has no samples). Pick the file; the page
   shows how many samples, batches and other records it holds. Press **Load … records**. The page reloads when done.
3. Check a few samples by ID and the staff list on Settings.

What does not come across:
- **Email logins.** Passwords are never in a backup. People who signed in with email sign up again with the same
  address (the lab manager approves them), or the lab manager presses **Reset password** on their row and gives them
  the temporary password. Microsoft sign-ins work at once: their accounts are on the restored staff list.
- The person who restores the backup stays lab manager on the new copy, whatever the backup's staff list says.
- A backup loads only into a copy with no samples, and only once; it never merges into a copy already in use.

The database's own 7-day backup (README step 3) is separate: it puts one Azure database back as it was, inside Azure.

## Running it outside Azure

What the code supports today, and what it would take.

- **The page** (`app/`) is plain files; any web server can serve them.
- **The server logic** (`api/lib/core.js`, `auth.js`) is plain Node.js 22 with no Azure dependency except two:
  - **Microsoft sign-in** comes from Azure Static Web Apps, which signs people in and passes who they are to the API in
    the `x-ms-client-principal` header. Outside Azure there is no Microsoft sign-in until one is built (a Microsoft
    Entra ID OpenID Connect sign-in in the server). The site's own **email sign-in** works anywhere.
  - **The database** is Cosmos DB (`api/lib/store-cosmos.js`), reached over the internet with the connection string,
    so a server anywhere can use the same database.
- **`dev/server.js`** runs the whole site on plain Node (`node dev/server.js`, then http://localhost:4280), with a
  database in memory (lost when it stops) or a real Cosmos DB (`COSMOS_CONNECTION_STRING=... node dev/server.js`). It
  is for testing only: its sign-in page lets anyone type any email or example username (`admin`, `tech1`) and become
  that person. **Never run `dev/server.js` where other people can reach it.**

To run a real copy on your own server:

1. Make a server file from `dev/server.js` without its test sign-in: remove the `/.auth/login/aad`, `/.auth/dev-login`
   and `/.auth/logout` pages, the `devauth` cookie and `DEV_USERS` (pass `devUsers: null` to `createCore`), and always
   delete any `x-ms-client-principal` header a request arrives with, so nobody can pretend to be signed in. Staff then
   use email sign-in only. Keep `/api/me`, `/api/auth`, `/api/db`, `/api/health` and the static files, plus the page
   headers in `app/staticwebapp.config.json`.
2. Put it behind **HTTPS** (for example Caddy or nginx with a certificate). Email sign-in cookies are sent only over
   HTTPS, and the page needs HTTPS to fingerprint results files. Pass the visitor's address in `X-Forwarded-For` so
   repeated wrong passwords are throttled per person.
3. **Database:** keep Cosmos DB (set `COSMOS_CONNECTION_STRING`), or write a store for another database with the same
   functions as `api/lib/store-memory.js` (`get`, `set`, `update`, `remove`, `query`, `changes`, `acquire`, `peekLease`,
   `page`) and prove it with `test/store-tests.js`.
4. Keep it running with a service manager (systemd or pm2), and back the database up.

Then run the tests against the new copy's code (`README.md`, *Running the checks*) before people use it.
