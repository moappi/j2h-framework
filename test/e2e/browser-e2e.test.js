"use strict";

/**
 * Genuine, real-browser end-to-end tests for the browser half of
 * j2h-framework (j2h.js), driven by Playwright against a REAL headless
 * Chromium instance - not jsdom, not mock doubles.
 *
 * This suite:
 *   - Serves the framework's OWN source file (j2h.js at the repo root) live,
 *     so it always tests whatever the current source says.
 *   - Uses REAL vendored builds of page.js and json2html.js (see
 *     test/e2e/vendor/README.md), not stand-in test doubles.
 *   - Runs the unmodified example app straight out of examples/client/ for
 *     the full-app walkthrough, so it's exercising the actual example the
 *     project ships, not a re-implementation of it.
 *   - Confirms real network script loading, real DOM APIs, real
 *     crypto.getRandomValues, real page.js history-based routing, and the
 *     real json2html rendering engine all work correctly against the fixed
 *     j2h.js - each scenario below corresponds 1:1 to one of the six
 *     browser-side bugs fixed in this round (see TESTING.md).
 *
 * Requires the `playwright` package (added as a devDependency) with its
 * Chromium browser installed - run `npx playwright install chromium` once
 * after `npm install` if the browser download is skipped in your
 * environment (e.g. via PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD).
 */

const assert = require("assert");
const { chromium } = require("playwright");
const { start, stop } = require("./server.js");

describe("browser end-to-end (real Chromium, real page.js/json2html, real network)", function () {

    this.timeout(20000);

    let server, baseUrl, browser;

    before(async () => {
        ({ server, url: baseUrl } = await start());
        browser = await chromium.launch();
    });

    after(async () => {
        if (browser) await browser.close();
        if (server) await stop(server);
    });

    describe("unit-level: individual class fixes against a real browser DOM/V8", () => {

        let page;

        beforeEach(async () => {
            page = await browser.newPage();
            page.on("pageerror", (e) => console.error("PAGE ERROR:", e));
            await page.goto(baseUrl + "/unit");
        });

        afterEach(async () => {
            await page.close();
        });

        it("FIXED: State#set() no longer throws on __proto__/constructor/prototype paths", async () => {
            let result = await page.evaluate(() => {
                let before = ({}).polluted;
                let threw = false;
                try {
                    new window.j2h.State().set("__proto__.polluted", "yes");
                    new window.j2h.State().set("constructor.polluted", "yes");
                    new window.j2h.State().set("prototype.polluted", "yes");
                } catch (e) { threw = true; }
                return { threw, pollutedAfter: ({}).polluted, before };
            });

            expect(result.threw).to.equal(false);
            expect(result.pollutedAfter).to.equal(result.before, "Object.prototype must remain unpolluted");
        });

        it("FIXED: State#_clean() removes nested dotted-path state, not just top-level keys", async () => {
            let result = await page.evaluate(() => {
                let state = new window.j2h.State();
                let req = { pathname: "/page1" };
                state.set("topKey", "top-value", req);
                state.set("nested.deep.value", "deep-value", req);
                state._clean("/somewhere-else");
                return { top: state.get("topKey"), nested: state.get("nested.deep.value") };
            });

            expect(result.top).to.be.undefined;
            expect(result.nested).to.be.undefined;
        });

        it("FIXED: Events#register() returns the listener id, so remove() actually works", async () => {
            let result = await page.evaluate(() => {
                let events = new window.j2h.Events();
                let calls = 0;
                let id = events.register("onx", () => calls++);
                events.remove("onx", id);
                events.trigger("onx", {});
                return { id, calls };
            });

            expect(result.id).to.be.a("string").and.not.equal("");
            expect(result.calls).to.equal(0, "listener should have been unsubscribed before triggering");
        });

        it("FIXED: Module#load() falls back to appending in <head> when no anchor <script> tag exists (real network load)", async () => {
            let result = await page.evaluate(async () => {
                document.querySelectorAll("script").forEach((s) => s.remove());
                // The real singleton `j2h.module` - the same one `j2h.export`
                // writes to, exactly like a real page/component file would.
                let mod = window.j2h.module;
                let src = "/e2e/dummy.js";
                let importPromise = mod.import(src);
                let script = document.querySelector('script[src="' + src + '"]');
                let appendedToHead = !!script && script.parentElement === document.head;
                let got = await importPromise; // real network round-trip + real onload
                return { appendedToHead, got };
            });

            expect(result.appendedToHead).to.equal(true);
            expect(result.got).to.equal("value-for:/e2e/dummy.js");
        });

        it("FIXED: Module#load() reads the SCRIPT's own readyState, not the Module instance's (this-binding)", async () => {
            let result = await page.evaluate(async () => {
                let mod = window.j2h.module;
                let src = "/e2e/slow.js?delay=400";
                let importPromise = mod.import(src);
                let script = document.querySelector('script[src="' + src + '"]');

                let resolvedEarly = false;
                importPromise.then(() => { resolvedEarly = true; });

                // Simulate an old-IE-style intermediate readystatechange
                // BEFORE the real (delayed) network response arrives.
                script.readyState = "loading";
                script.onreadystatechange();

                await new Promise((r) => setTimeout(r, 50)); // well before the 400ms real response
                let notResolvedWhileLoading = !resolvedEarly;

                // Let the REAL (delayed) network response actually arrive and
                // execute - the real script really does call
                // window.j2h.export(...) now, but our handler's guard still
                // sees readyState === "loading" (untouched since above), so
                // this real `load` event correctly does not resolve it either.
                await new Promise((r) => setTimeout(r, 550));
                let stillNotResolvedAfterRealLoad = !resolvedEarly;

                // NOW simulate the final "complete" readystatechange - the
                // script has already executed and exported its value, so
                // this is what actually resolves the promise.
                script.readyState = "complete";
                script.onreadystatechange();

                let got = await importPromise;
                return { notResolvedWhileLoading, stillNotResolvedAfterRealLoad, got };
            });

            expect(result.notResolvedWhileLoading).to.equal(true,
                "must not resolve while the script element's readyState is still 'loading'");
            expect(result.stillNotResolvedAfterRealLoad).to.equal(true,
                "must still not resolve after the real network load fires while readyState stays 'loading'");
            expect(result.got).to.equal("value-for:/e2e/slow.js?delay=400");
        });

        it("FIXED: Page#render()'s stale-render guard is per-instance - an unrelated page's render no longer cancels it", async () => {
            let result = await page.evaluate(async () => {
                document.body.innerHTML = '<div id="a"></div><div id="b"></div>';

                let resolveA;
                class PageA extends window.j2h.Page {
                    constructor() { super(); this._ele = "#a"; this.template = [{ "<>": "span", text: "rendered-A" }]; }
                    async data() { return new Promise((r) => { resolveA = r; }); }
                }
                class PageB extends window.j2h.Page {
                    constructor() { super(); this._ele = "#b"; this.template = [{ "<>": "span", text: "rendered-B" }]; }
                    async data() { return {}; }
                }

                let pA = new PageA().render({ pathname: "/a" }, {});
                await new Promise((r) => setTimeout(r, 30)); // let A start & get stuck awaiting its data()

                let pB = new PageB().render({ pathname: "/b" }, {});
                await pB;

                resolveA({});
                await pA;

                return {
                    aHTML: document.querySelector("#a").innerHTML,
                    bHTML: document.querySelector("#b").innerHTML
                };
            });

            expect(result.aHTML).to.include("rendered-A", "A's render must complete via the real json2html engine, not be cancelled by B");
            expect(result.bHTML).to.include("rendered-B");
        });

        it("FIXED: Request querystring parsing only splits on the FIRST '=', preserving values that contain one", async () => {
            let result = await page.evaluate(() => {
                let req = new window.j2h.Request({
                    path: "/user/chad", querystring: "token=abc=def&plain=1",
                    hash: "", params: { user: "chad" }, routePath: "/user/:user", pathname: "/user/chad"
                });
                return req.query;
            });

            expect(result).to.deep.equal({ token: "abc=def", plain: "1" });
        });

        it("PERF FIX: Obj#setComponents() loads independent components concurrently, not sequentially", async () => {
            // setComponents() used to `await` each component's full
            // import->instantiate->recurse chain INSIDE its for..in loop, so
            // component load time scaled with the SUM of every component's
            // load time instead of roughly the slowest one. Prove this with
            // REAL, timed network requests (via the e2e server's ?delay=N
            // support) against the real Obj#setComponents() implementation -
            // not a mock timer.
            let elapsed = await page.evaluate(async () => {
                class FakeComponent extends window.j2h.Component {
                    constructor() { super(); this.template = [{ "<>": "li" }]; }
                }
                let originalExport = window.j2h.module.export.bind(window.j2h.module);
                window.j2h.module.export = (path) => originalExport(path, FakeComponent);

                let obj = new window.j2h.Obj();
                obj.components = {
                    a: "/e2e/perf-a.js?delay=120",
                    b: "/e2e/perf-b.js?delay=120",
                    c: "/e2e/perf-c.js?delay=120"
                };

                let start = performance.now();
                await obj.setComponents();
                let result = performance.now() - start;

                window.j2h.module.export = originalExport;
                return result;
            });

            // Sequential loading of 3 components at ~120ms each would take
            // ~360ms+; concurrent loading should take roughly the time of
            // the single slowest one (~120-150ms with real overhead). 250ms
            // is a comfortable ceiling that catches a regression back to
            // sequential loading without being flaky on a loaded CI box.
            expect(elapsed).to.be.lessThan(250,
                `expected concurrent component loading (~120-150ms for 3 components at ~120ms each), got ${elapsed.toFixed(1)}ms - looks sequential`);
        });
    });

    describe("full app walkthrough: the actual, unmodified examples/client app", () => {

        it("renders the home page, routes client-side (no full reload) to a user page, and back again", async () => {
            let appPage = await browser.newPage();
            appPage.on("pageerror", (e) => console.error("APP PAGE ERROR:", e));

            try {
                await appPage.goto(baseUrl + "/");

                await appPage.waitForSelector("h2");
                let homeText = await appPage.textContent("body");
                expect(homeText).to.include("Home Page");
                expect(homeText).to.include("Bill Brown");
                expect(homeText).to.include("Jane Brown", "user list should render via the lazily-loaded real user component");

                await appPage.evaluate(() => { window.__e2eNoFullReload = true; });
                await appPage.click('a[href="/user/bill"]');
                await appPage.waitForFunction(() => location.pathname === "/user/bill");

                let stillMarked = await appPage.evaluate(() => window.__e2eNoFullReload);
                expect(stillMarked).to.equal(true, "page.js client-side routing must not cause a full page reload");

                let userText = await appPage.textContent("body");
                expect(userText).to.include("User bill");

                await appPage.click("text=back");
                await appPage.waitForFunction(() => location.pathname === "/");
                let homeAgain = await appPage.textContent("body");
                expect(homeAgain).to.include("Home Page");
            } finally {
                await appPage.close();
            }
        });
    });
});
