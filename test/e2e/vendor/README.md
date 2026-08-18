# Vendored browser libraries

`page.js` and `json2html.js` are real, unmodified browser builds vendored
straight from their upstream GitHub source repos, used by the end-to-end
suite (`test/e2e/browser-e2e.test.js`) instead of `examples/client/index.html`'s
original cdnjs `<script>` links.

Why vendor instead of using the CDN links directly: some CI/sandbox networks
restrict outbound access to arbitrary CDN hosts, which would make the
end-to-end suite flaky or unrunnable there depending on network policy. Both
libraries are pure client-side JS with no build step, so a straight copy of
their repo's browser-ready file works as-is.

| File           | Source                                                              |
|----------------|----------------------------------------------------------------------|
| `page.js`      | https://github.com/visionmedia/page.js (`page.js` at repo root)     |
| `json2html.js` | https://github.com/moappi/json2html (`json2html.js` at repo root)   |

If you'd rather test against the CDN-hosted versions used by the live
example (or a newer release), just point `test/e2e/fixtures/index.html` and
`test/e2e/fixtures/unit.html` back at the cdnjs URLs from
`examples/client/index.html` - the rest of the suite doesn't care where they
came from, only that `window.page` / `window.json2html` end up defined.
