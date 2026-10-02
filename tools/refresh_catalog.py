#!/usr/bin/env python3
"""
Refresh data/catalog.json from the live Shopify storefront.

Shopify's public /products.json endpoint is readable server-side but does not
send CORS headers, so the Lounge (a static site on GitHub Pages) cannot read it
from the browser. This script takes a snapshot instead; the GitHub Action in
.github/workflows/refresh-catalog.yml runs it on a schedule and commits any change.

Standard library only (Python 3.8+). Usage:

    python3 tools/refresh_catalog.py            # write data/catalog.json
    python3 tools/refresh_catalog.py --check    # print a summary, write nothing
"""

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MERCH = ROOT / "data" / "merch.json"
OUT = ROOT / "data" / "catalog.json"
UA = "IncrementsLounge/1.0 (+catalog snapshot)"


def fetch(url, accept="application/json", attempts=4):
    """GET a URL, retrying when the store is busy or briefly unreachable.

    Shopify sometimes turns away requests from cloud runners (429/5xx, timeouts); a refused
    hourly run used to fail outright. Waits 10, 30, then 90 s (or what Retry-After asks).
    """
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.read().decode("utf-8")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            status = getattr(exc, "code", None)
            transient = status is None or status == 429 or status >= 500
            if not transient or attempt == attempts - 1:
                raise
            wait = 10 * 3 ** attempt
            retry_after = exc.headers.get("Retry-After") if getattr(exc, "headers", None) else None
            if retry_after and retry_after.isdigit():
                wait = min(int(retry_after), 300)
            print(f"  {url}: {status or exc} — retrying in {wait} s", file=sys.stderr)
            time.sleep(wait)


def fetch_products(domain):
    products, page = [], 1
    while True:
        data = json.loads(fetch(f"https://{domain}/products.json?limit=250&page={page}"))
        batch = data.get("products", [])
        products.extend(batch)
        if len(batch) < 250:
            return products
        page += 1


def plain_text(body_html):
    text = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>", "\n", body_html or "", flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", l).strip() for l in text.split("\n")]
    return "\n".join(l for l in lines if l)


def cdn(src):
    """Normalise to an https CDN URL with no query string (width is added client-side)."""
    src = src.split("?")[0]
    if src.startswith("//"):
        src = "https:" + src
    return src


OPTION_KEYS = {"color": "colour", "colour": "colour", "size": "size", "style": "style"}


def normalise(p, merch):
    title = p["title"].strip()
    rules = merch["zones"]
    zone = next((r["zone"] for r in rules if re.search(r["match"], title, re.I)), "movement")
    chapter = None
    if zone == "archive":
        for c in merch.get("chapters", []):
            if re.search(c["match"], title, re.I):
                chapter = {"name": c["name"], "year": c["year"]}
                break

    opt_names = [OPTION_KEYS.get(o["name"].strip().lower(), o["name"].strip().lower()) for o in p["options"]]

    images = []
    by_variant = {}
    for img in p.get("images", []):
        entry = {"src": cdn(img["src"]), "w": img.get("width"), "h": img.get("height")}
        images.append(entry)
        for vid in img.get("variant_ids", []) or []:
            by_variant[vid] = entry["src"]

    variants = []
    for v in p["variants"]:
        values = [v.get("option1"), v.get("option2"), v.get("option3")]
        rec = {"id": v["id"], "available": bool(v.get("available")), "price": float(v["price"])}
        for key, val in zip(opt_names, values):
            if val is not None:
                rec[key] = val
        fi = v.get("featured_image")
        if fi and fi.get("src"):
            by_variant[v["id"]] = cdn(fi["src"])
        variants.append(rec)

    # Colour list, in option order, with swatch + representative image.
    colours = []
    if "colour" in opt_names:
        idx = opt_names.index("colour")
        for name in p["options"][idx]["values"]:
            vs = [v for v in variants if v.get("colour") == name]
            image = next((by_variant.get(v["id"]) for v in vs if by_variant.get(v["id"])), None)
            colours.append({
                "name": name,
                "hex": merch["swatches"].get(name),
                "image": image,
                "available": any(v["available"] for v in vs),
            })
    else:
        m = re.search(r" - ([A-Za-z ]+)$", title)
        if m and m.group(1) in merch["swatches"]:
            colours.append({"name": m.group(1), "hex": merch["swatches"][m.group(1)], "image": None,
                            "available": any(v["available"] for v in variants)})

    def values_for(key):
        if key not in opt_names:
            return []
        return p["options"][opt_names.index(key)]["values"]

    prices = [v["price"] for v in variants]
    return {
        "id": p["id"],
        "handle": p["handle"],
        "title": title,
        "url": f"https://{merch['store']['domain']}/products/{p['handle']}",
        "zone": zone,
        "chapter": chapter,
        "featured": zone == "window",
        "description": plain_text(p.get("body_html")),
        "price": min(prices) if prices else 0,
        "available": any(v["available"] for v in variants),
        "options": opt_names,
        "colours": colours,
        "sizes": values_for("size"),
        "styles": values_for("style"),
        "variants": variants,
        "images": images,
        "publishedAt": p.get("published_at"),
    }


def fetch_lifestyle(domain, path):
    # Shopify serves JSON (with escaped slashes) when asked for it, so ask for HTML and unescape anyway.
    page = fetch(f"https://{domain}{path}", accept="text/html").replace("\\/", "/")
    seen, out = set(), []
    for m in re.finditer(r"((?:https:)?//(?:cdn\.shopify\.com/s/files|[a-z.]+/cdn/shop/files)/[^\"' ?]+?)\.(jpg|jpeg|png|webp)", page, re.I):
        base = re.sub(r"_(\d+x\d*|\{width\}x|\d+x\d+@2x|\d+x)$", "", m.group(1))
        url = cdn(base + "." + m.group(2))
        if "Screen_Shot" in url or url in seen:
            continue
        seen.add(url)
        out.append({"src": url})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="print a summary without writing")
    args = ap.parse_args()

    merch = json.loads(MERCH.read_text())
    domain = merch["store"]["domain"]

    raw = fetch_products(domain)
    hidden = set(merch.get("hide", []))
    products = [normalise(p, merch) for p in raw if p["handle"] not in hidden]

    try:
        lifestyle = fetch_lifestyle(domain, merch["store"].get("galleryPage", "/pages/gallery"))
    except Exception as exc:  # the gallery is decoration; never fail the refresh over it
        print(f"warning: gallery fetch failed: {exc}", file=sys.stderr)
        lifestyle = json.loads(OUT.read_text()).get("lifestyle", []) if OUT.exists() else []

    catalog = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "store": domain,
        "currency": merch["store"]["currency"],
        "featured": merch["featured"],
        "products": products,
        "lifestyle": lifestyle,
    }

    zones = {}
    for p in products:
        zones.setdefault(p["zone"], []).append(("" if p["available"] else "×") + p["title"])
    for z, items in zones.items():
        print(f"{z:9} {len(items):2}  " + " · ".join(items))
    print(f"lifestyle {len(lifestyle):2}")

    if args.check:
        return

    # Only rewrite when the substance changed, so the scheduled Action doesn't commit timestamps.
    if OUT.exists():
        old = json.loads(OUT.read_text())
        if {k: v for k, v in old.items() if k != "generatedAt"} == {k: v for k, v in catalog.items() if k != "generatedAt"}:
            print("catalog unchanged")
            return
    OUT.write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(products)} products)")


if __name__ == "__main__":
    main()
