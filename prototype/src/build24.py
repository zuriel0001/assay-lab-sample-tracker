# base.html: the page's markup, base CSS and the start of its script (SHARE_URL, HOUR): the first 248 lines of the v9 page, all that the
# build ever used of it (the v9 script that followed is replaced by the chunks below).
head = open("base.html", encoding="utf-8").read().rstrip("\n")
css = open("css10.css").read() + open("css11.css").read() + open("css12.css").read() + open("css14.css").read() + open("css15.css").read() + open("css16.css").read() + open("css18.css").read() + open("css19.css").read() + open("css20.css").read() + open("css24.css").read() + open("css31.css").read()
head = head.replace("</style>", css + "</style>", 1)
def put(old, new):
    global head
    assert head.count(old) == 1, old
    head = head.replace(old, new)
put('<button role="tab" data-tab="register" aria-selected="false">Register at lab</button>',
    '<button role="tab" data-tab="register" aria-selected="false">Register at lab</button>\n    <button role="tab" data-tab="storage" aria-selected="false">Storage</button>\n    <button role="tab" data-tab="results" aria-selected="false">Results</button>')
put('<section class="view" id="view-register" hidden></section>',
    '<section class="view" id="view-register" hidden></section>\n  <section class="view" id="view-storage" hidden></section>\n  <section class="view" id="view-results" hidden></section>')
put('<div class="toast" id="toast" hidden></div>',
    '<div class="toast" id="toast" hidden></div>\n<div class="cert-overlay" id="certBox" role="dialog" aria-modal="true" aria-label="Certificate of analysis" hidden></div>\n<div class="cert-overlay" id="labelBox" role="dialog" aria-modal="true" aria-label="Bag labels" hidden></div>')
put("<title>MET Lab Sample Tracker</title>", "<title>Assay Lab Sample Tracker</title>")
put("<h1>MET Lab Sample Tracker</h1>", "<h1>Assay Lab Sample Tracker</h1>")
put("<small>Mine site → Metallurgical laboratory</small>", "<small>Mine site → Assay laboratory</small>")
# v15 design: brand bar with logo slot, search and theme switch in the header; navigation with icons, a More menu and a phone bar.
put("""  <header class="top">
    <div class="brand">
      <small>Mine site → Assay laboratory</small>
      <h1>Assay Lab Sample Tracker</h1>
    </div>
    <div class="row" style="gap:8px"><span class="pill" title="Design prototype">Prototype</span><span class="pill warn" id="sync">Connecting…</span><span class="who" id="who"></span><button class="btn" id="signBtn" type="button" hidden>Sign out</button></div>
  </header>

  <form class="lookup" id="lookupForm" autocomplete="off">
    <input id="lookupInput" placeholder="Enter sample ID or tag number" aria-label="Sample ID">
    <button class="btn primary big" type="submit">Track sample</button>
  </form>
""", """  <header class="top">
    <div class="brand"><span class="logo" id="brandLogo"></span><div class="brand-t">
      <small>ZIJIN</small>
      <h1>Assay Lab Sample Tracker</h1>
    </div></div>
    <form class="lookup" id="lookupForm" autocomplete="off" role="search">
      <input id="lookupInput" placeholder="Sample ID, site sample code or batch" aria-label="Sample ID, site sample code or batch">
      <button class="btn primary big" type="submit" aria-label="Track sample"><span class="lk-t">Track sample</span></button>
    </form>
    <div class="row top-meta"><span class="pill" title="Design prototype">Prototype</span><span class="pill warn" id="sync">Connecting…</span><span class="who" id="who"></span><button class="btn" id="signBtn" type="button" hidden>Sign out</button><button class="icon-btn" id="themeBtn" type="button" aria-label="Dark theme" aria-pressed="false"></button></div>
  </header>
""")
import re as _re
nav = _re.search(r'  <nav class="tabs" role="tablist" id="tabs">\n.*?\n  </nav>\n', head, _re.S)
assert nav
head = head.replace(nav.group(0), """  <nav class="tabs" role="tablist" id="tabs" aria-label="Main">
    <button role="tab" data-tab="board" aria-selected="false">Board <span class="count" id="cntActive">0</span></button>
    <button role="tab" data-tab="track" aria-selected="true">Sample</button>
    <button role="tab" data-tab="submit" aria-selected="false">Submit</button>
    <button role="tab" data-tab="register" aria-selected="false">Register</button>
    <button role="tab" data-tab="results" aria-selected="false">Results</button>
    <button role="tab" data-tab="storage" aria-selected="false">Storage</button>
    <button role="tab" data-tab="ledger" aria-selected="false">Ledger</button>
    <button role="tab" data-tab="routes" aria-selected="false">Routes</button>
    <button role="tab" data-tab="stages" aria-selected="false">Settings</button>
    <button role="tab" data-tab="login" aria-selected="false">Sign in</button>
    <div class="tab-more" id="tabMoreWrap" hidden><button type="button" id="tabMore" aria-haspopup="true" aria-expanded="false" aria-controls="tabMenu">More</button><div class="tab-menu" id="tabMenu" hidden></div></div>
  </nav>
""")
import os
data = open("routes-data.js" if os.path.exists("routes-data.js") else "../routes-data.js", encoding="utf-8").read().rstrip("\n")
app = "".join(open(f, encoding="utf-8").read() for f in ["app10-a.js", "app10-b.js", "app10-c.js", "app10-d.js", "app10-e.js", "app12-g.js", "app13-h.js", "app14-i.js", "app15-j.js", "app16-k.js", "app18-l.js", "app18-m.js", "app19-n.js", "app20-o.js", "app24-p.js", "app25-q.js", "app26-r.js", "app27-s.js", "app28-t.js", "app29-u.js", "app31-v.js", "app32-w.js", "app10-f.js"])
page = head + "\n" + "/* Default settings. Admins change accounts, sections, the site time zone, action limits and workflow routes on the \"Settings\" tab; edited routes are saved to settings/stages. */\n" + data + "\n" + app + "})();\n</script>\n"
open("assay-lab-sample-tracker.html", "w", encoding="utf-8").write(page)
print(len(page), "bytes,", page.count("\n"), "lines")
