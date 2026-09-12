# SpillFlare crawl policy

- Canonical host: `https://spillflare.com.ng`, without a trailing slash except `/`.
- Clean hubs, state pages, archive years, archive pagination, incidents, and evidence pages with attachments are indexable and self-canonical.
- Explorer/filter/search/sort query variants are `noindex,follow` and canonicalize to their clean hub. They are intentionally absent from sitemaps. Clean archive pagination is not treated as a facet.
- `/search` remains `noindex,follow`; `/api/` and `/search` are disallowed in robots.txt. CSS, JavaScript, incident, state, and archive routes remain crawlable.
- Incident and evidence sitemap entries omit `lastmod`: incident dates are event dates, not reliable page-change dates. Data-backed collection pages use the validated snapshot retrieval time because their rendered membership/counts change with the deployed snapshot. Editorial pages omit `lastmod` without a trustworthy edit timestamp.
- Googlebot log reports verify candidates through reverse DNS under `googlebot.com`/`google.com` and matching forward DNS. Results are cached for seven days; a user agent alone is never trusted.
