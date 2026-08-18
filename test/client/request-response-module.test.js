"use strict";

const loadClient = require("../helpers/doubles/loadClient.js");

describe("client/j2h.js - Request", () => {

    let j2h;
    beforeEach(() => { ({ j2h } = loadClient()); });

    function ctx(overrides) {
        return Object.assign({
            path: "/user/chad",
            querystring: "",
            hash: "",
            params: { user: "chad" },
            routePath: "/user/:user",
            pathname: "/user/chad"
        }, overrides);
    }

    it("copies path/params/routePath straight from the page.js context, and defaults method to GET", () => {
        let req = new j2h.Request(ctx());
        expect(req.baseUrl).to.equal("/user/chad");
        expect(req.params).to.deep.equal({ user: "chad" });
        expect(req.routePath).to.equal("/user/:user");
        expect(req.method).to.equal("GET");
    });

    it("parses a single querystring parameter into req.query", () => {
        let req = new j2h.Request(ctx({ querystring: "sort=name" }));
        expect(req.query).to.deep.equal({ sort: "name" });
    });

    it("parses multiple ampersand-separated querystring parameters", () => {
        let req = new j2h.Request(ctx({ querystring: "sort=name&order=desc&page=2" }));
        expect(req.query).to.deep.equal({ sort: "name", order: "desc", page: "2" });
    });

    it("defaults to an empty query object when there is no querystring", () => {
        let req = new j2h.Request(ctx({ querystring: "" }));
        expect(req.query).to.deep.equal({});
    });

    it("strips a trailing ?query or #hash off of pathname, even if page.js left one attached", () => {
        // KNOWN QUIRK, defended against explicitly in the source: page.js's ctx.pathname
        // can include the search/hash on some versions, so j2h sanitizes it itself.
        let req = new j2h.Request(ctx({ pathname: "/user/chad?ref=email#top" }));
        expect(req.pathname).to.equal("/user/chad");
    });

    describe("edge case: a querystring value containing '=' (e.g. base64/JSON)", () => {
        it("FIXED: only splits on the FIRST '=', preserving everything after it in the value", () => {
            // `hash.split('=')` on "token=abc=def" used to yield
            // ["token","abc","def"], and only `hash[0]`/`hash[1]` were used - so
            // req.query.token ended up as "abc", silently losing "=def". Fixed
            // by locating the first '=' with indexOf() and splitting there.
            let req = new j2h.Request(ctx({ querystring: "token=abc=def" }));
            expect(req.query.token).to.equal("abc=def");
        });

        it("FIXED: still parses normal single-'=' values correctly alongside a multi-'=' one", () => {
            let req = new j2h.Request(ctx({ querystring: "token=abc=def&plain=1" }));
            expect(req.query).to.deep.equal({ token: "abc=def", plain: "1" });
        });

        it("captures a bare key with no '=' at all (value is undefined, key still present)", () => {
            let req = new j2h.Request(ctx({ querystring: "flag" }));
            expect(req.query).to.have.property("flag");
            expect(req.query.flag).to.be.undefined;
        });
    });
});

describe("client/j2h.js - Response", () => {

    let j2h;
    beforeEach(() => { ({ j2h } = loadClient()); });

    it("exposes redirect() wired to the underlying router's redirect function", () => {
        let calls = [];
        j2h.app._pagejs.redirect = (url) => calls.push(url);

        let res = new j2h.Response();
        res.redirect("/login");

        expect(calls).to.deep.equal(["/login"]);
    });
});

describe("client/j2h.js - Module", () => {

    let j2h;
    // Module.load() anchors its injected <script> with
    // `document.getElementsByTagName('script')[0].parentElement.insertBefore(...)`,
    // which assumes at least one <script> tag already exists in the document
    // (true in a real page that loaded j2h.js itself via a <script> tag). We
    // provide one here by default so the "happy path" tests reflect realistic
    // usage; the "no anchor script tag" edge case below deliberately uses a
    // bare document instead.
    beforeEach(() => {
        ({ j2h } = loadClient({ html: '<!doctype html><html><head><script src="/j2h.js"></script></head><body></body></html>' }));
    });

    it("export() then get() returns the exact object that was exported", () => {
        let mod = new j2h.Module();
        let PageClass = class {};

        mod.export("/pages/home.js", PageClass);

        expect(mod.get("/pages/home.js")).to.equal(PageClass);
    });

    it("get() on a path that was never exported returns undefined", () => {
        let mod = new j2h.Module();
        expect(mod.get("/pages/missing.js")).to.be.undefined;
    });

    it("import() resolves immediately from cache without re-loading, once a path has been exported", async () => {
        let mod = new j2h.Module();
        let PageClass = class {};
        mod.export("/pages/home.js", PageClass);

        let loadSpy = require("sinon").spy(mod, "load");

        let got = await mod.import("/pages/home.js");

        expect(got).to.equal(PageClass);
        expect(loadSpy.called).to.equal(false, "should not hit the network/DOM for an already-exported path");
    });

    it("import() on an unexported path injects a <script> tag pointing at that path", async () => {
        let mod = new j2h.Module();

        let importPromise = mod.import("/pages/lazy.js");

        // the module hasn't called j2h.export() yet (that's the "script" - i.e.
        // the loaded file - doing it on load), so give the script a moment to
        // "load" and self-export before we resolve it below.
        let script = document.querySelector('script[src="/pages/lazy.js"]');
        expect(script, "load() should insert a <script src=...>").to.not.be.null;

        mod.export("/pages/lazy.js", "lazily-exported-value");
        script.onload();

        let got = await importPromise;
        expect(got).to.equal("lazily-exported-value");
    });

    it("rejects when the injected script fails to load", async () => {
        let mod = new j2h.Module();

        let importPromise = mod.import("/pages/broken.js");
        let script = document.querySelector('script[src="/pages/broken.js"]');

        let error = new Error("network error");
        script.onerror(error);

        let threw = null;
        try { await importPromise; } catch (e) { threw = e; }
        expect(threw).to.equal(error);
    });

    describe("edge cases", () => {

        it("FIXED: falls back to appending in <head> (instead of throwing) when the document has no existing <script> tag to anchor before", async () => {
            // load() used to do
            //   document.getElementsByTagName('script')[0].parentElement.insertBefore(s, t)
            // with no guard for the "no script tags yet" case, and threw a
            // TypeError when the document had none. Fixed with a fallback to
            // append to <head> (or <html> if there's no <head> either).
            let { j2h: freshJ2h, document: freshDocument } = loadClient({ html: "<!doctype html><html><body></body></html>" });
            let mod = new freshJ2h.Module();

            let importPromise = mod.import("/pages/whatever.js");

            let script = freshDocument.querySelector('script[src="/pages/whatever.js"]');
            expect(script, "load() should still insert a <script src=...> even with no anchor tag").to.not.be.null;
            expect(script.parentElement).to.equal(freshDocument.head, "should have been appended to <head> as a fallback");

            mod.export("/pages/whatever.js", "resolved-fine");
            script.onload();

            let got = await importPromise;
            expect(got).to.equal("resolved-fine");
        });

        it("FIXED: waits for the script's OWN readyState to reach 'complete' instead of resolving on the first event (correct `this` binding)", async () => {
            // The old-IE-style readyState guard
            //   () => { if (!r && (!this.readyState || this.readyState=='complete')) resolve(); }
            // was an ARROW function, so `this` was Module#load's `this` (the
            // Module instance) - which never has a `.readyState` property -
            // NOT the <script> element `s`. `!this.readyState` was therefore
            // always `true`, so onreadystatechange resolved the import on its
            // very first firing regardless of the script's actual state.
            // Fixed by reading `s.readyState` directly.
            let mod = new j2h.Module();

            let importPromise = mod.import("/pages/still-loading.js");
            let script = document.querySelector('script[src="/pages/still-loading.js"]');

            let resolved = false;
            importPromise.then(() => { resolved = true; });

            // Simulate an old-IE-style intermediate readystatechange where the
            // script is NOT actually done loading yet.
            script.readyState = "loading";
            script.onreadystatechange();
            await Promise.resolve(); // let any (incorrect) resolution microtask run

            expect(resolved).to.equal(false, "must NOT resolve while readyState is still 'loading'");

            mod.export("/pages/still-loading.js", "resolved-correctly");
            script.readyState = "complete";
            script.onreadystatechange();

            let got = await importPromise;
            expect(got).to.equal("resolved-correctly");
        });
    });
});
