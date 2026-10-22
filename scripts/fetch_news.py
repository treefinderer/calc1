#!/usr/bin/env python3
"""Fetches the News feeds and writes news/<id>.json for the site (spec 0003).

Run by .github/workflows/pages.yml before each deploy. Standard library only.
  python3 scripts/fetch_news.py             fetch all feeds, write news/*.json
  python3 scripts/fetch_news.py --selftest  parse tests/fixtures/sample-rss.xml offline and check the output shape
"""
import datetime
import email.utils
import html.parser
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "news")
FIXTURE = os.path.join(ROOT, "tests", "fixtures", "sample-rss.xml")
LIVE_BASE = "https://treefinderer.github.io/calc1/news/"
USER_AGENT = "Mozilla/5.0 (compatible; TallyNewsBot/1.0; +https://treefinderer.github.io/calc1/)"
TIMEOUT_S = 20
MAX_ITEMS = 10
SUMMARY_MAX = 300
MEDIA = "{http://search.yahoo.com/mrss/}"

# The feeds from spec 0002, unchanged.
FEEDS = [
    ("politics", "https://feeds.bbci.co.uk/news/world/rss.xml", "BBC News"),
    ("technology", "https://feeds.bbci.co.uk/news/technology/rss.xml", "BBC News"),
    ("science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "BBC News"),
    ("stocks", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069", "CNBC"),
    ("sports", "https://feeds.bbci.co.uk/sport/rss.xml", "BBC Sport"),
]
ITEM_KEYS = {"title", "link", "pubDate", "summary", "thumbnail"}
ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def iso_utc(dt):
    return dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def now_iso():
    return iso_utc(datetime.datetime.now(datetime.timezone.utc))


def squash(s):
    return re.sub(r"\s+", " ", s or "").strip()


class _TextOnly(html.parser.HTMLParser):
    """Collects the text of an HTML fragment; entities are decoded, script and style content dropped."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        elif tag in ("br", "p", "div", "li"):
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def plain_text(fragment):
    p = _TextOnly()
    p.feed(fragment or "")
    p.close()
    return squash("".join(p.parts))


def shorten(s, limit):
    if len(s) <= limit:
        return s
    cut = s[:limit]
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return cut.rstrip(" ,.;:!?-–—") + "…"


def web_url(s, https_only):
    """Returns the URL if it is http(s) (https only when asked), otherwise None."""
    s = (s or "").strip()
    try:
        u = urllib.parse.urlsplit(s)
    except ValueError:
        return None
    if not u.netloc or u.scheme not in (("https",) if https_only else ("http", "https")):
        return None
    return s


def is_image(el):
    return el.get("medium") == "image" or (el.get("type") or "").startswith("image/")


def thumbnail(item):
    """First https image from media:thumbnail, then media:content, then enclosure; None if there is none."""
    candidates = [el.get("url") for el in item.iter(MEDIA + "thumbnail")]
    candidates += [el.get("url") for el in item.iter(MEDIA + "content") if is_image(el)]
    candidates += [el.get("url") for el in item.findall("enclosure") if is_image(el)]
    for url in candidates:
        if web_url(url, True):
            return url.strip()
    return None


def pub_date(s):
    try:
        dt = email.utils.parsedate_to_datetime((s or "").strip())
    except (TypeError, ValueError, IndexError):
        return None
    if dt is None:
        return None
    if dt.tzinfo is None:  # RFC 822 "-0000" means UTC with no zone given
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return iso_utc(dt)


def parse_feed(xml_bytes):
    """RSS 2.0 bytes -> list of at most MAX_ITEMS items in feed order."""
    channel = ET.fromstring(xml_bytes).find("channel")
    if channel is None:
        raise ValueError("not an RSS 2.0 feed")
    items = []
    for item in channel.findall("item"):
        if len(items) >= MAX_ITEMS:
            break
        title = squash(item.findtext("title"))
        link = web_url(item.findtext("link"), False)
        if not title or not link:
            continue
        summary = plain_text(item.findtext("description"))
        items.append({
            "title": title,
            "link": link,
            "pubDate": pub_date(item.findtext("pubDate")),
            "summary": "" if summary == title else shorten(summary, SUMMARY_MAX),
            "thumbnail": thumbnail(item),
        })
    return items


def shape_problems(doc):
    """Returns a list of ways the document breaks the news/<id>.json shape (empty when it is fine)."""
    if not isinstance(doc, dict):
        return ["not an object"]
    problems = []
    if not isinstance(doc.get("source"), str) or not doc["source"]:
        problems.append("source missing")
    if not isinstance(doc.get("fetchedAt"), str) or not ISO_UTC.match(doc["fetchedAt"]):
        problems.append("fetchedAt not ISO UTC")
    items = doc.get("items")
    if not isinstance(items, list):
        return problems + ["items not a list"]
    if len(items) > MAX_ITEMS:
        problems.append("more than %d items" % MAX_ITEMS)
    for i, it in enumerate(items):
        where = "item %d: " % i
        if not isinstance(it, dict) or set(it) != ITEM_KEYS:
            problems.append(where + "keys are not " + ", ".join(sorted(ITEM_KEYS)))
            continue
        if not isinstance(it["title"], str) or not it["title"]:
            problems.append(where + "title missing")
        if not web_url(it["link"] if isinstance(it["link"], str) else "", False):
            problems.append(where + "link not http(s)")
        if it["pubDate"] is not None and not (isinstance(it["pubDate"], str) and ISO_UTC.match(it["pubDate"])):
            problems.append(where + "pubDate not ISO UTC")
        s = it["summary"]
        if not isinstance(s, str) or re.search(r"<[a-zA-Z/!]|&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);", s) or len(s) > SUMMARY_MAX + 1:
            problems.append(where + "summary not plain text")
        t = it["thumbnail"]
        if t is not None and not (isinstance(t, str) and web_url(t, True)):
            problems.append(where + "thumbnail not https or null")
    return problems


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, application/json, */*"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
        return res.read()


def live_copy(cat):
    """The category's file as currently published, or None if it can't be downloaded or isn't usable."""
    try:
        doc = json.loads(download(LIVE_BASE + cat + ".json").decode("utf-8"))
    except Exception:
        return None
    if shape_problems(doc) or doc.get("error"):
        return None
    return doc


def write_json(path, doc):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    usable = 0
    for cat, url, source in FEEDS:
        try:
            doc = {"source": source, "fetchedAt": now_iso(), "items": parse_feed(download(url))}
            note = "%d items" % len(doc["items"])
        except Exception as e:
            doc = live_copy(cat)
            if doc:
                note = "feed failed (%s), kept the published copy from %s" % (e, doc["fetchedAt"])
            else:
                doc = {"source": source, "fetchedAt": now_iso(), "items": [], "error": True}
                note = "feed failed (%s), no published copy, wrote error" % e
        if not doc.get("error"):
            usable += 1
        write_json(os.path.join(OUT_DIR, cat + ".json"), doc)
        print("%s: %s" % (cat, note))
    if not usable:
        print("Every feed failed and no published copy was found.", file=sys.stderr)
        return 1
    return 0


def selftest():
    """Offline: parses the sample feed and checks the output shape. Prints the result; returns the exit code."""
    failures = []

    def check(name, cond):
        if not cond:
            failures.append(name)

    try:
        with open(FIXTURE, "rb") as f:
            items = parse_feed(f.read())
    except Exception as e:
        print("FAIL sample feed parses: %s" % e)
        print("SELFTEST: FAIL")
        return 1
    doc = {"source": "BBC News", "fetchedAt": now_iso(), "items": items}
    problems = shape_problems(doc)
    check("output shape: " + "; ".join(problems), not problems)
    check("at most 10 items (sample has 12)", len(items) == MAX_ITEMS)
    check("javascript: link skipped", all(not it["link"].startswith("javascript") for it in items))
    check("every pubDate converted to ISO UTC", all(it["pubDate"] and ISO_UTC.match(it["pubDate"]) for it in items))
    first = items[0] if items else {}
    check("RFC 822 date with offset converted to UTC", first.get("pubDate") == "2026-10-22T08:00:00Z")
    check("summary free of tags and entities", first.get("summary") == 'Leaders meet in Geneva & talk "trade".')
    check("thumbnails are https or null", all(it["thumbnail"] is None or it["thumbnail"].startswith("https://") for it in items))
    thumbs = {it["title"]: it["thumbnail"] for it in items}
    check("thumbnail from media:thumbnail", thumbs.get("Summit opens in Geneva") == "https://example.com/thumb.jpg")
    check("thumbnail from media:content", thumbs.get("Chip makers rally") == "https://example.com/content.jpg")
    check("thumbnail from enclosure", thumbs.get("Rocket lands") == "https://example.com/enclosure.jpg")
    check("http thumbnail becomes null", "Plain http image" in thumbs and thumbs["Plain http image"] is None)
    check("long summary capped", all(len(it["summary"]) <= SUMMARY_MAX + 1 for it in items) and
          any(it["summary"].endswith("…") for it in items))
    bad = {"source": "X", "fetchedAt": "2026-10-22 08:00", "items": [{"title": "T", "link": "javascript:x", "pubDate": "Wed, 22 Oct 2026",
                                                                       "summary": "<b>x</b>", "thumbnail": "http://x/y.jpg"}]}
    check("shape check rejects a bad document", len(shape_problems(bad)) == 5)

    if failures:
        for name in failures:
            print("FAIL " + name)
        print("SELFTEST: FAIL %d checks failed" % len(failures))
        return 1
    print("SELFTEST: PASS fetch_news.py (%d items from the sample feed)" % len(items))
    return 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv[1:] else main())
