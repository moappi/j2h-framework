"use strict";

const sinon = require("sinon");
const loadClient = require("../helpers/doubles/loadClient.js");

function tick(n) {
    let p = Promise.resolve();
    for (let i = 0; i < (n || 1); i++) p = p.then(() => new Promise((r) => setImmediate(r)));
    return p;
}

describe("client/j2h.js - Component", () => {
    let j2h;
    beforeEach(() => { ({ j2h } = loadClient()); });

    it("defaults template/components to empty objects", () => {
        let c = new j2h.Component();
        expect(c.template).to.deep.equal({});
        expect(c.components).to.deep.equal({});
    });
});

describe("client/j2h.js - Obj.setComponents()", () => {
    let j2h, document, json2html;

    beforeEach(() => {
        ({ j2h, document, json2html } = loadClient({
            html: '<!doctype html><html><head><script src="/j2h.js"></script></head><body></body></html>'
        }));
    });

    it("does nothing when the object has no `components` property at all", async () => {
        let obj = new j2h.Obj();
        await expect_not_to_throw(() => obj.setComponents());
    });

    it("does nothing for an empty components map", async () => {
        let obj = new j2h.Obj();
        obj.components = {};
        await expect_not_to_throw(() => obj.setComponents());
    });

    it("lazy-loads a client component by path, registers its template, and recurses into its own sub-components", async () => {
        let obj = new j2h.Obj();
        obj.components = { user: "/components/user.js" };

        let setComponentsPromise = obj.setComponents();

        let script = document.querySelector('script[src="/components/user.js"]');
        expect(script, "setComponents() should lazy-load unregistered components via j2h.module.import()").to.not.be.null;

        // Simulate the loaded file self-registering via j2h.export(), the way
        // every example component in this repo does.
        j2h.export("/components/user.js", class extends j2h.Component {
            constructor() {
                super();
                this.template = [{ "<>": "li", text: "${name}" }];
            }
        });
        script.onload();

        await setComponentsPromise;

        expect(json2html.component.get("user")).to.deep.equal([{ "<>": "li", text: "${name}" }]);
    });

    it("skips components that are already registered (no duplicate load)", async () => {
        json2html.component.add("user", [{ "<>": "li" }]); // pre-registered

        let obj = new j2h.Obj();
        obj.components = { user: "/components/user.js" };

        await obj.setComponents();

        expect(document.querySelector('script[src="/components/user.js"]'),
            "an already-registered component must not be re-fetched").to.be.null;
    });

    describe("edge cases", () => {

        it("silently skips a component whose script fails to load, instead of failing the whole page", async () => {
            let obj = new j2h.Obj();
            obj.components = { broken: "/components/broken.js" };

            let setComponentsPromise = obj.setComponents();
            let script = document.querySelector('script[src="/components/broken.js"]');
            script.onerror(new Error("404"));

            await expect_not_to_throw(() => setComponentsPromise);
            expect(json2html.component.get("broken")).to.be.undefined;
        });

        it("logs an error and skips a component that loaded but never called j2h.export()", async () => {
            let obj = new j2h.Obj();
            obj.components = { misconfigured: "/components/misconfigured.js" };

            let consoleStub = sinon.stub(console, "error");
            let setComponentsPromise = obj.setComponents();
            let script = document.querySelector('script[src="/components/misconfigured.js"]');
            script.onload(); // "loads" but the script forgot to call j2h.export(...)

            try {
                await setComponentsPromise;
                expect(consoleStub.calledOnce).to.equal(true);
                expect(consoleStub.firstCall.args[0]).to.include("misconfigured");
            } finally {
                consoleStub.restore();
            }

            expect(json2html.component.get("misconfigured")).to.be.undefined;
        });
    });

    describe("performance: components load concurrently, not one at a time", () => {

        it("PERF FIX: requests every component's script up front, before ANY of them has finished loading", async () => {
            // setComponents() used to `await` each component's full
            // import->instantiate->recurse chain INSIDE the for..in loop, so
            // component B's script wasn't even requested until component A's
            // entire chain had finished. It now fires every top-level
            // component's chain concurrently via Promise.all - independent
            // components no longer wait on each other's network round trip.
            let obj = new j2h.Obj();
            obj.components = {
                a: "/components/a.js",
                b: "/components/b.js",
                c: "/components/c.js"
            };

            let setComponentsPromise = obj.setComponents();

            // If the components were still loading sequentially, only "a"'s
            // script would exist in the document at this point - "b" and "c"
            // wouldn't be requested until "a" resolved. With concurrent
            // loading, all three scripts should already be present.
            await tick(1);
            expect(document.querySelector('script[src="/components/a.js"]'), "a's script should be requested immediately").to.not.be.null;
            expect(document.querySelector('script[src="/components/b.js"]'), "b's script should ALSO already be requested, not waiting on a").to.not.be.null;
            expect(document.querySelector('script[src="/components/c.js"]'), "c's script should ALSO already be requested, not waiting on a or b").to.not.be.null;

            // Resolve them out of order (c, then a, then b) to further prove
            // there's no ordering dependency between them.
            j2h.export("/components/c.js", class extends j2h.Component { constructor() { super(); this.template = [{ "<>": "li", text: "c" }]; } });
            document.querySelector('script[src="/components/c.js"]').onload();

            j2h.export("/components/a.js", class extends j2h.Component { constructor() { super(); this.template = [{ "<>": "li", text: "a" }]; } });
            document.querySelector('script[src="/components/a.js"]').onload();

            j2h.export("/components/b.js", class extends j2h.Component { constructor() { super(); this.template = [{ "<>": "li", text: "b" }]; } });
            document.querySelector('script[src="/components/b.js"]').onload();

            await setComponentsPromise;

            expect(json2html.component.get("a")).to.deep.equal([{ "<>": "li", text: "a" }]);
            expect(json2html.component.get("b")).to.deep.equal([{ "<>": "li", text: "b" }]);
            expect(json2html.component.get("c")).to.deep.equal([{ "<>": "li", text: "c" }]);
        });

        it("PERF FIX: one component's failure doesn't block or fail its siblings", async () => {
            let obj = new j2h.Obj();
            obj.components = {
                good: "/components/good.js",
                broken: "/components/broken.js"
            };

            let setComponentsPromise = obj.setComponents();
            await tick(1);

            document.querySelector('script[src="/components/broken.js"]').onerror(new Error("404"));

            j2h.export("/components/good.js", class extends j2h.Component { constructor() { super(); this.template = [{ "<>": "li", text: "good" }]; } });
            document.querySelector('script[src="/components/good.js"]').onload();

            await expect_not_to_throw(() => setComponentsPromise);

            expect(json2html.component.get("good")).to.deep.equal([{ "<>": "li", text: "good" }]);
            expect(json2html.component.get("broken")).to.be.undefined;
        });
    });
});

describe("client/j2h.js - Page.render()", () => {
    let j2h, document;

    beforeEach(() => {
        ({ j2h, document } = loadClient({
            html: '<!doctype html><html><head><script src="/j2h.js"></script></head><body></body></html>'
        }));
    });

    it("renders the page's data through json2html into the resolved element", async () => {
        document.body.innerHTML = '<div id="app"></div>';

        class HomePage extends j2h.Page {
            constructor() { super(); this._ele = "#app"; this.template = [{ "<>": "h1", text: "${title}" }]; }
            async data() { return { title: "Home" }; }
        }

        let page = new HomePage();
        await page.render({ pathname: "/" }, {});

        let el = document.querySelector("#app");
        expect(el.__j2hRenderCalls).to.have.length(1);
        expect(el.__j2hRenderCalls[0].data).to.deep.equal({ title: "Home" });
        expect(el.__j2hRenderCalls[0].template).to.deep.equal([{ "<>": "h1", text: "${title}" }]);
    });

    it("accepts a live DOM Element for _ele, not just a selector string", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        let el = document.querySelector("#app");

        class HomePage extends j2h.Page {
            constructor() { super(); this._ele = el; this.template = []; }
            async data() { return {}; }
        }

        await new HomePage().render({ pathname: "/" }, {});

        expect(el.__j2hRenderCalls).to.have.length(1);
    });

    it("shows a string 'loading' state immediately, before the async data() resolves", async () => {
        document.body.innerHTML = '<div id="app"></div>';

        let resolveData;
        class SlowPage extends j2h.Page {
            constructor() {
                super();
                this._ele = "#app";
                this._loading = "<p>Loading...</p>";
                this.template = [];
            }
            async data() { return new Promise((r) => { resolveData = r; }); }
        }

        let page = new SlowPage();
        let renderPromise = page.render({ pathname: "/" }, {});
        await tick(2);

        expect(document.querySelector("#app").innerHTML).to.equal("<p>Loading...</p>");

        resolveData({});
        await renderPromise;

        expect(document.querySelector("#app").innerHTML).to.not.equal("<p>Loading...</p>");
    });

    it("shows a json2html-template 'loading' state via .json2html() too", async () => {
        document.body.innerHTML = '<div id="app"></div>';

        let resolveData;
        class SlowPage extends j2h.Page {
            constructor() {
                super();
                this._ele = "#app";
                this._loading = [{ "<>": "p", text: "spinning..." }];
                this.template = [];
            }
            async data() { return new Promise((r) => { resolveData = r; }); }
        }

        let page = new SlowPage();
        let renderPromise = page.render({ pathname: "/" }, {});
        await tick(2);

        let el = document.querySelector("#app");
        expect(el.__j2hRenderCalls).to.have.length(1);
        expect(el.__j2hRenderCalls[0].template).to.deep.equal([{ "<>": "p", text: "spinning..." }]);

        resolveData({});
        await renderPromise;
    });

    describe("edge cases", () => {

        it("silently does nothing when the target element can't be found (no throw)", async () => {
            class GhostPage extends j2h.Page {
                constructor() { super(); this._ele = "#does-not-exist"; this.template = []; }
                async data() { return {}; }
            }

            await expect_not_to_throw(() => new GhostPage().render({ pathname: "/ghost" }, {}));
        });

        it("does nothing when _ele was never set at all", async () => {
            class NoTargetPage extends j2h.Page {
                constructor() { super(); this.template = []; }
                async data() { return {}; }
            }

            await expect_not_to_throw(() => new NoTargetPage().render({ pathname: "/" }, {}));
        });
    });
});

async function expect_not_to_throw(fn) {
    let threw = null;
    try { await fn(); } catch (e) { threw = e; }
    expect(threw).to.equal(null);
}
