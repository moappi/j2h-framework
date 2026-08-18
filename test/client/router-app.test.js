"use strict";

const loadClient = require("../helpers/doubles/loadClient.js");

function tick(n) {
    let p = Promise.resolve();
    for (let i = 0; i < (n || 3); i++) p = p.then(() => new Promise((r) => setImmediate(r)));
    return p;
}

function makePage(j2h, template, dataFn) {
    return class extends j2h.Page {
        constructor() {
            super();
            this.template = template || [{ "<>": "div", text: "${marker}" }];
        }
        async data(req) { return dataFn ? dataFn(req) : {}; }
    };
}

describe("client/j2h.js - Router", () => {
    let j2h;
    beforeEach(() => { ({ j2h } = loadClient()); });

    it("page() defaults new routes to preload:true and returns the router for chaining", () => {
        let router = new j2h.Router();
        let Home = makePage(j2h);

        let returned = router.page("/", Home);

        expect(returned).to.equal(router);
        expect(router._routes).to.have.length(1);
        expect(router._routes[0].opts).to.deep.equal({ preload: true });
    });

    it("page() lets the caller override preload per-route", () => {
        let router = new j2h.Router();
        router.page("/no-preload", makePage(j2h), { preload: false });
        expect(router._routes[0].opts.preload).to.equal(false);
    });

    it("merges constructor options shallowly over the defaults", () => {
        let router = new j2h.Router({ render: { ele: "#app" }, loading: "loading..." });
        expect(router.config.render).to.deep.equal({ ele: "#app" });
        expect(router.config.loading).to.equal("loading...");
    });

    describe("has()", () => {
        it("finds a route matching a static path", () => {
            let router = new j2h.Router();
            router.page("/about", makePage(j2h));
            expect(router.has("/about")).to.not.be.undefined;
            expect(router.has("/nope")).to.be.undefined;
        });

        it("matches a route with a named :param", () => {
            let router = new j2h.Router();
            router.page("/user/:username", makePage(j2h));
            expect(router.has("/user/chad")).to.not.be.undefined;
            expect(router.has("/user")).to.be.undefined;
        });

        it("respects the preload-only filter", () => {
            let router = new j2h.Router();
            router.page("/eager", makePage(j2h), { preload: true });
            router.page("/lazy", makePage(j2h), { preload: false });

            expect(router.has("/eager", true)).to.not.be.undefined;
            expect(router.has("/lazy", true)).to.be.undefined;
            expect(router.has("/lazy", false)).to.not.be.undefined;
        });
    });
});

describe("client/j2h.js - App", () => {
    let j2h, page, document;
    beforeEach(() => { ({ j2h, page, document } = loadClient()); });

    describe("routing end-to-end (via the mock page.js router)", () => {

        it("renders the page registered for the matched path into the configured element", async () => {
            document.body.innerHTML = "";
            let Home = makePage(j2h, [{ "<>": "h1", text: "${marker}" }], () => ({ marker: "home" }));

            j2h.app.page("/", Home);
            await j2h.app.listen();
            await page.show("/");
            await tick();

            expect(document.body.__j2hRenderCalls).to.have.length(1);
            expect(document.body.__j2hRenderCalls[0].data).to.deep.equal({ marker: "home" });
        });

        it("passes route :params through to the page's data(req)", async () => {
            document.body.innerHTML = "";
            let seenParams;
            let User = makePage(j2h, [], (req) => { seenParams = req.params; return {}; });

            j2h.app.page("/user/:username", User);
            await j2h.app.listen();
            await page.show("/user/chad");
            await tick();

            expect(seenParams).to.deep.equal({ username: "chad" });
        });

        it("runs registered middleware, in order, before rendering", async () => {
            document.body.innerHTML = "";
            let order = [];

            j2h.app.use((req, res, next) => { order.push("mw1"); next(); });
            j2h.app.use((req, res, next) => { order.push("mw2"); next(); });

            let Home = makePage(j2h, [], () => { order.push("render"); return {}; });
            j2h.app.page("/", Home);

            await j2h.app.listen();
            await page.show("/");
            await tick();

            expect(order).to.deep.equal(["mw1", "mw2", "render"]);
        });

        it("does not proceed to render until ALL middleware has called next()", async () => {
            document.body.innerHTML = "";
            let resolveMw;
            let renderStarted = false;

            j2h.app.use((req, res, next) => { resolveMw = next; }); // deliberately never calls next() yet

            let Home = makePage(j2h, [], () => { renderStarted = true; return {}; });
            j2h.app.page("/", Home);

            await j2h.app.listen();
            page.show("/"); // don't await - middleware is stuck
            await tick();

            expect(renderStarted).to.equal(false, "render must wait for pending middleware");

            resolveMw();
            await tick();

            expect(renderStarted).to.equal(true);
        });
    });

    describe("use() - registering middleware vs. sub-routers", () => {

        it("registers a bare function as global middleware", () => {
            let fn = () => {};
            j2h.app.use(fn);
            expect(j2h.app._middleware).to.include(fn);
        });

        it("mounts a Router at a path prefix and joins child route paths onto it", () => {
            let sub = new j2h.Router();
            sub.page("/settings", makePage(j2h));

            j2h.app.use("/account", sub);

            expect(sub._routes[0].path).to.equal("/account/settings");
        });

        it("registered sub-router routes are reachable through App.has()", () => {
            let sub = new j2h.Router();
            sub.page("/settings", makePage(j2h));
            j2h.app.use("/account", sub);

            expect(j2h.app.has("/account/settings")).to.not.be.undefined;
            expect(j2h.app.has("/settings")).to.be.undefined;
        });

        describe("edge case: use() with an unrecognized second argument", () => {
            it("silently does nothing instead of raising an error", () => {
                // KNOWN QUIRK: use(path, obj) only does something if `obj` is
                // actually an `instanceof j2h.Router`. Passing e.g. a plain
                // object (an easy mistake if you forget `new`) is a silent no-op
                // with no warning that your "router" was never mounted.
                let notARouter = { page() {} };
                expect(() => j2h.app.use("/oops", notARouter)).to.not.throw();
                expect(j2h.app.has("/oops")).to.be.undefined;
            });
        });
    });

    describe("_pathjoin()", () => {
        it("joins path segments with a single slash, collapsing duplicates", () => {
            expect(j2h.app._pathjoin(["/account/", "/settings"])).to.equal("/account/settings");
            expect(j2h.app._pathjoin(["/a", "b", "/c/"])).to.equal("/a/b/c/");
        });
    });

    describe("configure() / listen() / redirect()", () => {

        it("configure({preload:true}) turns preloading on", () => {
            expect(j2h.app.config.preload).to.be.undefined;
            j2h.app.configure({ preload: true });
            expect(j2h.app.config.preload).to.equal(true);
        });

        it("listen() is idempotent - a second call does not re-register routes", async () => {
            let Home = makePage(j2h);
            j2h.app.page("/", Home);

            await j2h.app.listen();
            let routesAfterFirst = page._routes.length;

            await j2h.app.listen();
            expect(page._routes.length).to.equal(routesAfterFirst, "listen() must not double-register routes on a second call");
        });

        it("redirect() delegates to the underlying router's redirect", async () => {
            let calls = [];
            let originalRedirect = page.redirect;
            page.redirect = (url) => { calls.push(url); return originalRedirect(url); };
            j2h.app._pagejs = page;

            j2h.app.redirect("/somewhere");

            expect(calls).to.deep.equal(["/somewhere"]);
        });
    });

    describe("preload diffing (_getPreloadRoutes) - edge cases", () => {

        beforeEach(() => { j2h.app.configure({ preload: true }); });

        it("preloads every ancestor segment the first time any page loads (no previous page yet)", async () => {
            document.body.innerHTML = "";
            let renderedOrder = [];

            let Dashboard = makePage(j2h, [], () => { renderedOrder.push("dashboard"); return {}; });
            let Settings = makePage(j2h, [], () => { renderedOrder.push("settings"); return {}; });

            j2h.app.page("/dashboard", Dashboard);
            j2h.app.page("/dashboard/settings", Settings);

            await j2h.app.listen();
            await page.show("/dashboard/settings");
            await tick(5);

            expect(renderedOrder).to.include("dashboard", "the ancestor route should have been preloaded");
            expect(renderedOrder).to.include("settings", "the target route itself should also render");
            expect(renderedOrder.indexOf("dashboard")).to.be.lessThan(renderedOrder.indexOf("settings"),
                "the preloaded ancestor should render before the target page");
        });

        it("edge case: navigating straight to the root path preloads nothing (no path segments to diff)", async () => {
            // _constructPaths("/") produces an empty segment list, so
            // _getPreloadRoutes() always returns [] for the root - there is
            // simply nothing to preload on the way to "/".
            document.body.innerHTML = "";
            let renderedOrder = [];
            let Home = makePage(j2h, [], () => { renderedOrder.push("home"); return {}; });

            j2h.app.page("/", Home);
            await j2h.app.listen();
            await page.show("/");
            await tick(5);

            expect(renderedOrder).to.deep.equal(["home"]);
        });

        it("only preloads the segments that diverge from the previously-loaded page", async () => {
            document.body.innerHTML = "";
            let renderedOrder = [];

            let Dashboard = makePage(j2h, [], () => { renderedOrder.push("dashboard"); return {}; });
            let Users = makePage(j2h, [], () => { renderedOrder.push("users"); return {}; });
            let Settings = makePage(j2h, [], () => { renderedOrder.push("settings"); return {}; });

            j2h.app.page("/dashboard", Dashboard);
            j2h.app.page("/dashboard/users", Users);
            j2h.app.page("/dashboard/settings", Settings);

            await j2h.app.listen();

            await page.show("/dashboard/users");
            await tick(5);
            renderedOrder.length = 0; // only care about the SECOND navigation now

            await page.show("/dashboard/settings");
            await tick(5);

            // "/dashboard" was already loaded as part of the previous
            // navigation, so it should NOT be preloaded again - only the
            // diverging "settings" leaf should render.
            expect(renderedOrder).to.deep.equal(["settings"]);
        });

        it("a route with preload:false is skipped even when preloading is otherwise required", async () => {
            document.body.innerHTML = "";
            let renderedOrder = [];

            let Dashboard = makePage(j2h, [], () => { renderedOrder.push("dashboard"); return {}; });
            let Settings = makePage(j2h, [], () => { renderedOrder.push("settings"); return {}; });

            j2h.app.page("/dashboard", Dashboard, { preload: false });
            j2h.app.page("/dashboard/settings", Settings);

            await j2h.app.listen();
            await page.show("/dashboard/settings");
            await tick(5);

            expect(renderedOrder).to.deep.equal(["settings"]);
        });
    });
});
