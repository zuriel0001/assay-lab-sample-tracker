# Assay Lab Sample Tracker on Azure (free test deployment)

This folder is the v26 Assay Lab Sample Tracker made to run outside Claude, on Microsoft Azure free tiers.
It keeps the prototype's workflow exactly: routes, lab batches and QC, action limits, release at once (or a supervisor's sign-off), departments and evaluation,
amendments, certificates, the in/out ledger, walk-in registration and lookup without sign-in, and the roles.
What changes is where data lives (Azure Cosmos DB), how staff sign in (their Microsoft account) and a server that
decides who may read and change what.

## Deploying it (what Zuriel does)

Another copy of the site (on Azure or elsewhere), and what moves with it: see [DEPLOY.md](DEPLOY.md).

You need a GitHub account (you have one) and an Azure account. Everything below stays on free plans.

1. **GitHub repository** (done): https://github.com/zuriel0001/assay-lab-sample-tracker holds this folder. Claude pushes
   updates there; each push redeploys the site automatically once step 4 is done.
2. **Create a free Azure account** at https://azure.microsoft.com/free. Microsoft asks for a card to check your
   identity; the plans below don't charge it. The free account is a 30-day trial: before it ends, Microsoft emails you
   to move to **pay-as-you-go**. Do it (portal → *Subscriptions* → *Upgrade*), or the account and the site are switched
   off. After the move you pay only for use above the free amounts, which this setup stays inside (see *What it costs*).
3. **Create the database.** In the Azure portal (https://portal.azure.com): *Create a resource* → search
   **Azure Cosmos DB** → *Azure Cosmos DB for NoSQL* → *Create*.
   - Resource group: *Create new*, `sample-tracker`. Account name: for example `assaylab-tracker-db`.
   - Location: **West Europe**, the region of the web app's API in step 4, so the two talk quickly. (Static Web Apps
     runs its API in only a few regions; West Europe is the nearest of them to Ghana.) New subscriptions often find West
     Europe greyed out for Cosmos DB; then pick **UK South** (or France Central, Germany West Central), a few
     milliseconds from West Europe. If the list shows only "EUAP" regions, register the `Microsoft.DocumentDB` resource
     provider first (*Subscriptions* → your subscription → *Resource providers*) and open the form again.
   - Capacity mode: **Provisioned throughput**. **Apply Free Tier Discount: Apply.**
     **Limit total account throughput: ticked** (keeps it inside the free 1000 RU/s).
   - On the **Backup Policy** tab choose **Continuous (7 days)**. Keeping it is free; it lets you put the database back
     as it was at any moment of the last 7 days, yourself, from the portal (a restore is charged per GB, cents for this data).
   - *Review + create* → *Create*. When it is ready, open it → *Settings* → *Keys* → copy the
     **PRIMARY CONNECTION STRING**.
4. **Create the web app.** *Create a resource* → search **Static Web App** → *Create*.
   - Resource group `sample-tracker`, name `assay-lab-sample-tracker`, Plan type **Free**. Region for the API (and staging):
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
   *Staff sign in* → *Sign in* → **Sign in with Microsoft**. You arrive as admin. On **Settings → Staff accounts**,
   type each person's sign-in email on their row and choose how they sign in (*Microsoft* or *Email*; your own row
   is added for you), delete example rows you don't need, and press **Save settings**. From then on, the people on
   that list sign in with their role.

   **New people sign up themselves:** *Staff sign in* → *Sign up* → **Sign up with Microsoft** (a work or personal
   Microsoft account), or **Sign up with email** (any email, such as Gmail or Yahoo: full name, email, a password of
   at least 10 characters, section or job). Either way they then wait for you: their request appears at the top of
   **Settings** (the tab shows how many are waiting); pick a role and press **Approve**, or **Decline**. Next time
   they use *Sign in* with the same choice. Someone who signed in with Microsoft but has no access yet presses
   **Request access** instead.

   **Forgotten password** (email sign-in): on **Settings → Staff accounts**, press **Reset password** on their row and
   give them the temporary password shown; they choose a new one when they next sign in. Signed-in email users change
   their own password with **Password** at the top of the page.

   If you can't use a Microsoft account yourself: before any admin is on the account list, signing up with email
   using an address from `ADMIN_EMAILS` also makes you the admin. Do it straight after setting `ADMIN_EMAILS`, and
   check Settings shows your row as *Email*.

   **If Microsoft says "Need admin approval"** (a company account whose IT does not let staff approve apps themselves),
   there are two ways on:
   - Use a personal Microsoft account: an outlook.com, hotmail.com or live.com address, or any other email turned into a
     Microsoft account at https://signup.live.com. Put that address in `ADMIN_EMAILS` (step 5, *Apply*), open the site in
     a private window, and on Microsoft's sign-in page choose *Use another account*.
   - Or ask the company's IT administrator to approve the site once for everyone: they open the site, choose
     *Staff sign in* → *Sign in with email*, sign in with their admin account, tick
     **Consent on behalf of your organization** and press **Accept**. After that every company account can sign in
     (it still sees only the public pages until its email is on a staff account).

Anyone can still register a sample at the lab (it waits for a technician's receipt) and look one up without signing in, from the same URL. *Submit a sample* needs a sign-in.

## Trying it out

- Register a sample at the lab without signing in (use a private browser window), naming the technician it was handed to; write down the ID; look it up by ID and tag.
- Sign in as a technician: confirm receipt, move it through the steps, enter results or attach the results file: complete
  results are released at once, by the technician.
- Submit a batch (several samples at once, one batch number B-…): each sample keeps its own ID and label, but the batch is
  processed as one. The board shows one card for it and counts it once (*Awaiting receipt: 1*); it is received once, on the
  batch page or with one tick on the board; the batch page has one workflow: one press moves every sample on a
  step, one results file for the batch, one release on one batch certificate (one number and check code, every sample
  with its own results), one put-away, and for a critical batch one confirmation by the witness. A sample that needs
  something different is taken out of the batch (*Take it out of the batch* on its record, or a re-assay) and carries
  on by itself.
- Submit a shift's samples with *Shift job*: pick the template (Mill shift, Elution run, Carbon activity), the shift and the date; the
  codes are written as on the plant's reports; untick what was not sampled. The job is received as one, and the lab's report attached to
  it releases every sample on one certificate.
- Give a second account the *Viewer* role and the *Metallurgy* department (Settings): it sees the *Results* tab with each
  result's flags and records evaluations; *Re-assay requested* appears on the lab's board. A free personal account
  (outlook.com) works for a second test person.
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
  result, certificate, evaluation, limit action and QC acceptance must name the person actually signed in. With
  *Release of results: At once* (the default) any lab writer releases the results they saved; with *After a lab supervisor
  signs off* only a lab supervisor or the lab manager releases, and not the person who entered the results (the lab
  manager may, giving the reason that is printed). An amended certificate is always approved by a second person. The
  step order and, under sign-off, the QC gates and limit holds are checked by the page only: someone with a lab staff account and developer tools could skip a step, but not hide that they did.
  Moving those checks onto the server too is a step before this becomes the production system.
- **Any Microsoft account can sign in, and anyone can sign up with email**, but they see only the public pages until
  the lab manager approves them. Limiting Microsoft sign-in to the company's own Microsoft 365 tenant needs the
  Standard plan (about US$9 a month).
- **Email sign-in is the site's own:** passwords are kept only as salted scrypt hashes; a session is a signed,
  HttpOnly, Secure, SameSite=Strict cookie that lasts 12 hours and is renewed while the page is in use; 5 wrong
  passwords hold that email for 15 minutes, and 50 wrong tries or sign-ups hold that internet address. **Nothing checks
  that the person owns the email address** (the site sends no email), so the lab manager's approval is the check:
  approve only people you know. An email login never gets the access of a Microsoft account with the same address,
  or the other way round. Logins are not in the *Download backup* file (passwords stay on the server); they are in
  the database's own 7-day backup.
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
| Not signed in | A sample by ID, tag or site reference, or a batch by its reference (B- and its first ID), without results (unless Settings says anyone may see results); certificate number and check code | Register new samples at the lab only; they wait for a technician's receipt (checked: new ID, not received, no results, current time) |
| Signed in (Microsoft or email) without an account | As above, plus their own access request | As above, plus one access request at a time, for their own email only (name, section or job; no role) |
| Section account | A sample as the public sees it, plus its own section's samples with results | Submit new samples only |
| Viewer | Everything except blind QA/QC links | Submit new samples only; in a department that evaluates (Metallurgy by default), also add an evaluation to a sample (accepted, a query or a re-assay request) under their own name, and nothing else |
| Lab technician | Everything except blind QA/QC links | Samples, batches, ledger, stock records, tag index; attached results files (kept once under their name, never changed or deleted) |
| Lab supervisor | Everything | As a technician, plus blind QA/QC checks: the blind sample and its link to the original, issued in their own name, and comparisons added to the link (never changed or deleted) |
| Admin | Everything, including sign-in emails, access requests and blind QA/QC links | All of that, plus Settings (the company logo only as a PNG, JPEG or WebP picture under 90 KB), answering access requests, resetting email passwords, the backup download, and loading a backup into a copy with no samples |

Staff see each other's names and roles but not their sign-in emails. A request gives no access by itself: a role
comes only from the staff list in Settings, which only the admin saves; who approved or declined it, and when, stays
on the request. The ledger, lab batches and stock records (which
name shelves and tags) are staff only. Nobody deletes a sample, its stock record or a ledger day. A disposal written to the ledger must name a
witness who is not the person recording it, and the monthly ledger sign-offs (signoff/<month>) are added only by a lab supervisor or the
admin, in their own name, and never changed or deleted. On a critical sample (two-person custody: bullion, gravity concentrate, the gold
room) the storage and any disposal are confirmed by the witness from their own account: a request names a second person, only that person
confirms it or sends it back (never the one who asked), and the sample goes into storage, or has material disposed of, only with that
confirmation. Which sample a blind QA/QC sample
re-assays is kept only in its link, which no one but lab supervisors and the admin can read, list or receive as a live change;
the blind sample itself is a QA/QC submission with nothing pointing back, and only a supervisor or the admin can send a sample
presented that way. The API only answers JSON requests from the site's own page, so another website
can't make a signed-in person's browser change records.

## How it is built

| Path | What it is |
|---|---|
| `prototype/` | In the GitHub repository only: the prototype's source, tests and route tables (the project's `sample-tracking` folder, without its old version archives). `build.py` and `test/run-suites.js` read it from here; the site deploy uses only `app/` and `api/`. |
| `app/index.html` | The page. Built by `build.py` from the prototype's `assay-lab-sample-tracker.html` (v26), which it never edits. Every patch must match exactly once, so a changed prototype fails the build loudly. |
| `app/jsqr.js` | jsQR 1.4.0 (Apache 2.0), unchanged: the QR reader the Scan button loads in browsers that can't read codes themselves (v24c). |
| `app/azure-shim.js` | Gives the page the shared-database interface it was written for, over `/api/db`: documents, where-filters, live snapshots (by polling for changes), short leases; plus the signed-in person (`/api/me`) and downloads. It also watches for a new version of the site (v24d): a page left open keeps running the version it loaded, so every few minutes, and when the page comes back to the front, it reads `version.json`; once a newer version is out it reloads itself while in the background or after two minutes without use (never with something typed and unsaved, a dialog open or a change on its way), and until then a bar offers *Reload now*. |
| `app/version.json` | Written by `build.py`: the build id it also puts in the page (`<meta name="build">`), from the page and the shim together. Served with `Cache-Control: no-store`. |
| `app/staticwebapp.config.json` | Node 22 API, Microsoft sign-in only (GitHub sign-in turned off), `/login` and `/logout`; the page and the shim are revalidated on every load (`no-cache`), `version.json` is never cached. |
| `api/db`, `api/me`, `api/auth` | Azure Functions (HTTP) behind `/api`. |
| `api/health` | `GET /api/health`: tries the database steps a sample submission takes (read, query, changes, lease) and lists which work. Nothing private in the answer; repeats within 30 seconds are answered from memory. |
| `api/lib/core.js` | Accounts (sign-in email and how it signs in → role from Settings; `ADMIN_EMAILS` are admins), the read/write rules above and the record-keeping rules (checked inside each write, on the record as it is at that moment). |
| `api/lib/auth.js` | Email sign-in: sign-up, sign-in and out, password change and reset, sessions, slowing down guessing. Logins and the signing key (made once, kept in the database; or set `AUTH_SECRET`) live under `auth/` records that `/api/db` can't reach. |
| `api/lib/store-cosmos.js` | Cosmos DB store: one container `docs` in database `tracker` (created on first use with 1000 RU/s on the container), partitioned by collection; filters, sorting and limits run in the database; ETag checks on every read-modify-write; leases as records; deletes kept as markers so open pages hear about them. |
| `api/lib/store-memory.js` | The same store in memory, for local runs and tests. |
| `dev/server.js` | Local stand-in for Static Web Apps: `node dev/server.js` → http://localhost:4280, in-memory data, a local sign-in page (type an email, or an example username such as `tech1`). |
| `test/api-tests.js` | 230 checks of the read/write rules, the record-keeping rules, stock records, access requests, the company logo, walk-in registration and hand-over, reference material edits, attached results files, the backup export, restoring a backup into an empty copy, blind QA/QC links, batches, release without a lab batch or a QA/QC review step, and the Functions entry points. |
| `test/auth-tests.js` | 51 checks of email sign-in: sign-up, forged and expired sessions, password guessing, resets, an email login not taking a Microsoft account's access, the Functions entry point. |
| `test/store-tests.js` | 28 checks on each store; Cosmos runs against `@vercel/cosmosdb-server` (a local Cosmos imitation) or a real account. |
| `test/run-suites.js` | Runs the prototype's own eighteen suites against this build (real page, real API over HTTP), unchanged except where tracking links carry this site's address or a check writes straight to the database (its ADJUST list), then `azure-extra.js`. |
| `test/azure-extra.js` | 73 browser checks of what is new: Microsoft sign-in, email sign-up and sign-in, password change and reset, first admin, accounts by email, requesting and approving access, upgrade on staff sign-in, what the public sees, the backup download and restore, a batch registered signed out, a sample on a route no longer in use, the server refusing a tampered page's changes, a page left open picking up a new version (not while a note is typed; the same sample open again after the reload). |

Patches `build.py` makes to the page: start after `/api/me` answers; tracking links use this site's address; the
sign-in tab has *Sign in* and *Sign up*, each with Microsoft or email; accounts have a sign-in email and a *Sign in with* choice instead of a password; the first
admin is added to the account list on their first visit to Settings; upgrades and ledger repairs run when a staff
member signs in; permission errors from the server are shown as such; the header says *Test system*; the prototype's
explanatory paragraphs are taken out (labels, warnings, status lines and each route's own description stay).

### Test results (2026-10-21, v26 with the MET Lab jobs, 11 CIL tanks, codes as IDs, the full-site alignment pass, Shift end, results files of another date and the MET Lab's final samples)

| Suite | Result |
|---|---|
| `api-tests.js` | 273 / 273 (v24d, 20 Oct: a walk-in job's samples with their codes as IDs, # written in the key, joining only a batch its own form started; v24d: a batch certificate keeps its batch where results are hidden; on a two-person custody sample only the witness asked confirms storage or a disposal, from their own account; v24c: a disposal in the ledger names a witness who is not the recorder, except an old one brought forward by the upgrade of old records; ledger sign-offs only by a supervisor or the lab manager, in their own name, only added to, never deleted, read by staff only; v26: results files up to 5 MB, a section account opening its own section's file; release at once by the technician, evaluations by a Metallurgy viewer and nothing else, amendments still by a second person, sign-off still enforced when chosen) |
| `store-tests.js` | 56 / 56 (28 in memory, 28 on the local Cosmos DB imitation) |
| `auth-tests.js` | 51 / 51 |
| `azure-extra.js` | 74 / 74 (a stale copy of version.json older than the page never makes it reload itself; including a page left open reloading itself onto a new version, a backup restored into a second copy of the site, a visitor's batch page updating live, and a sample on a route no longer in use moving on) |
| Prototype `run.js` | 107 / 107 |
| Prototype `results-tests.js` | 92 / 93 |
| Prototype `v12-tests.js` | 68 / 71 |
| Prototype `v13-tests.js` | 26 / 26 (including 3,000 stored samples) |
| Prototype `review-tests-v11.js` | 41 / 41 |
| Prototype `review-v11-scenarios.js` | 5 / 5 |
| Prototype `hours-shortcut-tests.js` | 7 / 7 |
| Prototype `v14-tests.js` | 27 / 27 (Settings tabs, lab working hours, bag labels: each QR code holds this site's tracking link) |
| Prototype `work-hours-unit.js` | 14 / 14 |
| Prototype `v15-tests.js` | 46 / 46 (design refresh: tabs, header, theme, board chips, wall screen, progress, Today, logo) |
| Prototype `v16-tests.js` | 42 / 42 (walk-ins without sign-in, Submit after sign-in, 80% passing 75 µm, reference material edits and history, Other reason, receiver, board tiles and lanes, ZIJIN) |
| Prototype `v17-tests.js` | 25 / 25 (one entry tab: Register signed out, Submit signed in with Received now for lab staff; handed to and badge number) |
| Prototype `v18-tests.js` | 71 / 71 (results from the lab's own CSV and Excel reports, kept files, drafts, No QC in this run, batch steps, re-assay from Storage and the Ledger, the shorter form, site sample code and badge). Needs the lab's two real reports, which are not in GitHub; without them it is skipped. |
| Prototype `v20-tests.js` | 71 / 71 (blind QA/QC re-assay: picks, blind IDs, what technicians see, comparisons on both records; a batch or a single sample on Submit and Register; the batch page and receiving a batch; the custody log scrolling) |
| Prototype `v21-tests.js` | 61 / 61 (lab batches optional, header search suggestions, recently opened, same details again, phone tables as cards, batch progress, wording) |
| Prototype `v22-tests.js` | 29 / 29 (no QA/QC review step unless Settings use it: release from the last analysis step, Ready for release on the board, picked results not missing, sampling-point limits) |
| Prototype `v30-tests.js` | 21 / 21 on the prototype and on this build (the MET Lab's final samples on a route of their own: received, analysed, released, what is left returned to the MET Lab in the release with its ledger movement and the job off the board; the MET Lab's working on the batch page only, not on the certificate; carbon activity still tested here; Shift end unchanged) |
| Prototype `v29-tests.js` | 29 / 29 on the prototype and on this build (Shift end, each job from its own section, a section account seeing only its kinds, today's date for a job without a shift; a results file whose codes carry another date said so and read as the batch's on request, with the record noting the file's code; a file naming none of the batch's samples released with only on request; a report's letterhead row not read as a sample; an elution run's code opening its sample, not rewritten as a site ID) |
| Prototype `v28-tests.js` | 46 / 46 on the prototype and on this build (a job's samples with their codes as IDs, the job's batch a site number, a walk-in MET Lab job through the server's rules; Submit › MET Lab job of its own: tank profile with its charts and efficiencies, bottle roll with recovery by size and, with the masses typed on the form or the batch page, the calculated head, tails and overall recovery, preg-robbing index per sample against its control, QA/QC set reported as is; carbon from all 11 CIL tanks drawn tank by tank; phone) |
| Prototype `v27-tests.js` | 32 / 32 on the prototype and on this build (the day shift's Mill shift with its regenerated carbon, one code for two analyses, carbon activity worked out and compared with fresh carbon from the report and from the activity sheet, the strip profile of an elution run with its figures, crosshair, table and certificate, batch certificates with one Sample column) |
| Prototype `v26-tests.js` | 31 / 31 on the prototype and on this build (shift jobs: the Mill shift, Elution run and Carbon activity templates and their codes, one job received as one, a report releasing every sample on one certificate by analysis, materials by item, points filling in their analysis, CIL / CIP as CIL) |
| Prototype `v25-tests.js` | 116 / 116 on the prototype and on this build (a batch processed as one: counted once and received as one, one board card, one workflow, one results file, one release on one batch certificate, one put-away, a sample taken out of its batch, a critical batch confirmed once by its witness; on a critical sample the witness confirms the storage and a disposal from their own account; the workflow complete once the material is on the shelf; from the last lab step the sample waits on Results released, released when its results are saved, two-person custody with a witness; scan a label, including the camera reading a printed label; receive several from the board; disposal witness, asked on the row being disposed; monthly ledger sign-off and summary; a results file never holds the release; turnaround; released results ticked on the workflow, the closing step too) |
| Prototype `v24-tests.js` | 89 / 89 on the prototype and on this build (release at once, any results file accepted (a PDF, a file naming no samples), departments and evaluation, Results tab, re-assay requests, Belt cut sample, testwork as purpose, the new Submit form, Batches, Storage, Ledger, concise Routes, 16 px text, sign-off still selectable; v24c: sample types in Ore, Processing, Gold room, Environment and QC with no testwork or duplicate types, AuFx-named fire assay, an analysis list of exactly the sample type's own analyses, Environment from any site, every board tile with a number opening its list, What it is for and Section limited to what fits the sample type, 18 px text, Received now unticked so submissions wait under Awaiting receipt) |
| Prototype `v23-tests.js` | 53 / 53 (the routes the lab runs: AuFx/AuSx, cyanide, carbon loading, elution, ore fire assay; routes not in use hidden but kept; sampling point lists; example plant limits; the shorter Submit form) |

After the full-site check of 20–21 October (every tab and the main flows as a visitor, technician, supervisor, lab manager, section account and Metallurgy viewer, on a computer, a phone and in dark mode, on this build with the real API core and made-up data: nothing cut off, no sideways scroll, no console errors), every prototype suite was run on the prototype page and passes (run.js 107, results-tests 93, v12 71, v13 26, v14 27, v15 46, v16 42, v17 25, v20 71, v21 61, v22 29, v23 53, v24 89, v25 116, v26 31, v27 32, v28 46, v29 29, v30 21, review 41 + 5, hours 7, work hours 14), and every suite above was run on this build with the results in the table.

No console errors in any suite. The 4 prototype checks that don't pass all expect a page **nobody is signed in to** to
upgrade older records (3) or finish a lab batch a crashed device left half-made (1). On Azure the public can't
change records, so these run when lab staff sign in, and every five minutes on staff pages (`azure-extra.js` checks
the upgrade on sign-in, including the new stock record). Real data on Azure starts at v13, so the upgrade itself only
matters for the tests.

The prototype suites give the same results with the server's record-keeping rules switched on, so every flow the page
has (receipt, steps, batches, results, release, amendments, re-assays, storage, ledger) already writes within them.

Found and fixed while testing: the public form couldn't release its short claim on a new ID (staff waited up to
4 s to receive a just-submitted sample); lists didn't refresh when a page's sign-in changed; a guest page could
briefly try to show withheld results when an admin opened results to everyone; `run.js`'s old disposed record, dated two days
back, fell from 21 October on the day the server began asking a witness for every new disposal, and is now dated before it.

### Running the checks

```sh
python3 build.py
node test/api-tests.js
NODE_PATH=<folder with @azure/cosmos and @vercel/cosmosdb-server> node test/store-tests.js
NODE_PATH=$(npm root -g) node test/run-suites.js            # needs Playwright + Chromium
```
