# Writes the icon custom properties used by css15.css (stroke icons on a 24 px grid, drawn as CSS masks so they take the text colour).
from urllib.parse import quote
I = {
 "board":   '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
 "track":   '<circle cx="11" cy="11" r="6.5"/><path d="m20.5 20.5-4.8-4.8"/>',
 "submit":  '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
 "register":'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/>',
 "batches": '<path d="M6 4v12a2 2 0 0 0 4 0V4M14 4v12a2 2 0 0 0 4 0V4"/><path d="M4 4h16"/><path d="M6 11h4M14 13h4"/>',
 "storage": '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
 "results": '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="m9 15 2 2 4-4"/>',
 "ledger":  '<path d="M4 8h14l-4-4"/><path d="M20 16H6l4 4"/>',
 "routes":  '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
 "stages":  '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
 "login":   '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
 "more":    '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
 "moon":    '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
 "sun":     '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
 "wall":    '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
 "close":   '<path d="M6 6l12 12M18 6 6 18"/>',
 "chev":    '<path d="m6 9 6 6 6-6"/>',
 "flask":   '<path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
 "clock":   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
}
out = []
for k, body in I.items():
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{body}</svg>'
    out.append(f'  --ic-{k}:url("data:image/svg+xml,{quote(svg, safe=" =:/,.-")}");')
print(":root{\n" + "\n".join(out) + "\n}")
