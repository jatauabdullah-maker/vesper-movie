"""Probe the vidsrc.me RCP flow (pure HTTP, no browser) — the most promising
server-side extraction path per the Ciarands/vidsrc-me-resolver approach."""
import re, sys, urllib.request, urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

def get(url, referer=None):
    req = urllib.request.Request(url)
    req.add_header("User-Agent", UA)
    if referer:
        req.add_header("Referer", referer)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace"), r.geturl()

def main(imdb="tt0111161"):
    embed = f"https://vidsrc.me/embed/{imdb}"
    html, final = get(embed)
    print(f"[1] embed -> {final} ({len(html)} bytes)")
    hashes = re.findall(r'data-hash="([^"]+)"', html)
    print(f"[2] data-hash found: {len(hashes)} -> {hashes[:4]}")
    iframes = re.findall(r'<iframe[^>]*src="([^"]+)"', html)
    print(f"[3] iframes: {iframes[:4]}")
    if not hashes:
        # maybe the player iframe carries it
        for src in iframes:
            if src.startswith("//"):
                src = "https:" + src
            try:
                sub, subfinal = get(src, referer=final)
                print(f"[4] iframe {subfinal} ({len(sub)} bytes)")
                h2 = re.findall(r'data-hash="([^"]+)"', sub)
                print(f"    data-hash: {h2[:4]}")
                print(f"    markers: {set(re.findall(r'(m3u8|prorcp|/rcp/|file:|hunter)', sub))}")
            except Exception as e:
                print(f"[4] iframe {src} failed: {e}")
        return
    for h in hashes[:2]:
        rcp = f"https://vidsrc.stream/rcp/{h}"
        try:
            page, f2 = get(rcp, referer=embed)
            print(f"[5] rcp {f2} ({len(page)} bytes)")
            dh = re.search(r'id="hidden"[^>]*data-h="([^"]+)"', page)
            di = re.search(r'<body[^>]*data-i="([^"]+)"', page)
            print(f"    data-h: {bool(dh)}  data-i: {di.group(1) if di else None}")
            if dh and di:
                buf, seed = bytes.fromhex(dh.group(1)), di.group(1)
                out = "".join(chr(b ^ ord(seed[i % len(seed)])) for i, b in enumerate(buf))
                print(f"    decoded -> {out[:160]}")
        except Exception as e:
            print(f"[5] rcp failed: {e}")

if __name__ == "__main__":
    main(*sys.argv[1:])
