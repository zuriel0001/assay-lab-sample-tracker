src = open("v9-backup.html", encoding="utf-8").read().split("\n")
head = "\n".join(src[:248])            # lines 1..248: markup, CSS, script start, SHARE_URL, HOUR
css = open("css10.css").read() + open("css11.css").read() + open("css12.css").read() + open("css14.css").read()
head = head.replace("</style>", css + "</style>", 1)
def put(old, new):
    global head
    assert head.count(old) == 1, old
    head = head.replace(old, new)
put('<button role="tab" data-tab="register" aria-selected="false">Register at lab</button>',
    '<button role="tab" data-tab="register" aria-selected="false">Register at lab</button>\n    <button role="tab" data-tab="batches" aria-selected="false">Lab batches</button>\n    <button role="tab" data-tab="storage" aria-selected="false">Storage</button>\n    <button role="tab" data-tab="results" aria-selected="false">Results</button>')
put('<section class="view" id="view-register" hidden></section>',
    '<section class="view" id="view-register" hidden></section>\n  <section class="view" id="view-batches" hidden></section>\n  <section class="view" id="view-storage" hidden></section>\n  <section class="view" id="view-results" hidden></section>')
put('<div class="toast" id="toast" hidden></div>',
    '<div class="toast" id="toast" hidden></div>\n<div class="cert-overlay" id="certBox" role="dialog" aria-modal="true" aria-label="Certificate of analysis" hidden></div>\n<div class="cert-overlay" id="labelBox" role="dialog" aria-modal="true" aria-label="Bag labels" hidden></div>')
put("<title>MET Lab Sample Tracker</title>", "<title>Assay Lab Sample Tracker</title>")
put("<h1>MET Lab Sample Tracker</h1>", "<h1>Assay Lab Sample Tracker</h1>")
put("<small>Mine site → Metallurgical laboratory</small>", "<small>Mine site → Assay laboratory</small>")
import os
data = open("routes-data.js" if os.path.exists("routes-data.js") else "../routes-data.js", encoding="utf-8").read().rstrip("\n")
app = "".join(open(f, encoding="utf-8").read() for f in ["app10-a.js", "app10-b.js", "app10-c.js", "app10-d.js", "app10-e.js", "app12-g.js", "app13-h.js", "app14-i.js", "app10-f.js"])
page = head + "\n" + "/* Default settings. Admins change accounts, sections, the site time zone, reference materials, action limits and workflow routes on the \"Settings\" tab; edited routes are saved to settings/stages. */\n" + data + "\n" + app + "})();\n</script>\n"
open("assay-lab-sample-tracker.html", "w", encoding="utf-8").write(page)
print(len(page), "bytes,", page.count("\n"), "lines")
