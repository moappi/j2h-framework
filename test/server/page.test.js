"use strict";

/**
 * Tests for lib/page.js - the core server-side rendering orchestration:
 * "server" mode (flat HTML)
 *
 * `node-json2html` is stubbed via proxyquire so these are true UNIT tests of
 * Page's own orchestration logic, independent of json2html's real template
 * engine (which is covered by the integration tests in test/integration/).
 */

const sinon = require("sinon");
const proxyquire = require("proxyquire");

const HTTPError = require("../../lib/httpError.js");
const Component = require("../../lib/component.js");

function mockExpress(overrides) {
    let req = Object.assign({ params: {}, query: {} }, overrides && overrides.req);
    let sent = { html: undefined, statusCode: undefined, headers: {} };
    let res = Object.assign({
        statusCode: undefined,
        setHeader(n, v) { sent.headers[n] = v; },
        end(out) { sent.html = out; },
        cookie() {}
    }, overrides && overrides.res);
    return { req, res, sent };
}

function makeJsonRenderStub() {
    return sinon.stub().callsFake((data, template, options) => {
        if (options && options.output === "ihtml") {
            let ihtml = {
                html: `<body data-marker="${data && data.marker}"></body>`,
                events: (data && data.events) || {},
                appended: []
            };
            ihtml.appendHTML = function (extra) { this.appended.push(extra); this.html += extra; };
            if (data && data.__hydrationGate) ihtml.__hydrationGate = data.__hydrationGate;
            return ihtml;
        }
        if (template && template["<>"] === "script") {
            return `<script>${data.js}</script>`;
        }
        return `<body data-marker="${data && data.marker}"></body>`;
    });
}

function loadPage({ jsonRenderStub, ClientStub } = {}) {
    let stubs = {
        "node-json2html": { render: jsonRenderStub || makeJsonRenderStub() }
    };
    if (ClientStub) stubs["./client.js"] = ClientStub;
    return proxyquire("../../lib/page.js", stubs);
}

function tick() {
    return new Promise((resolve) => setImmediate(resolve));
}

function deferred() {
    let resolve;
    let promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}

describe("server/lib/page.js", () => {

    describe("data()", () => {
        it("defaults to returning an empty object", async () => {
            let Page = loadPage();
            let page = new Page("server");
            expect(await page.data({})).to.deep.equal({});
        });
    });

    describe("render() - server mode", () => {

        it("renders flat html and sends it with a doctype + html content-type", async () => {
            let jsonRenderStub = makeJsonRenderStub();
            let Page = loadPage({ jsonRenderStub });

            class HomePage extends Page {
                constructor() {
                    super("server");
                    this.template = [{ "<>": "h1", text: "hi" }];
                }
                async data() { return { marker: "home" }; }
            }

            let page = new HomePage();
            let { req, res, sent } = mockExpress();
            let next = sinon.spy();

            await page.render(req, res, next);

            expect(next.called).to.equal(false);
            expect(sent.html).to.equal('<!DOCTYPE html><body data-marker="home"></body>');
        });

        it("uses the page's data() method when no explicit data is passed to render()", async () => {
            let jsonRenderStub = makeJsonRenderStub();
            let Page = loadPage({ jsonRenderStub });

            class HomePage extends Page {
                constructor() { super("server"); this.template = []; }
                async data() { return { marker: "from-data-method" }; }
            }

            let page = new HomePage();
            let { req, res } = mockExpress();
            await page.render(req, res, sinon.spy());

            expect(jsonRenderStub.firstCall.args[0]).to.deep.equal({ marker: "from-data-method" });
        });

        it("prefers explicit data passed to render() over the data() method", async () => {
            let jsonRenderStub = makeJsonRenderStub();
            let Page = loadPage({ jsonRenderStub });

            let dataSpy = sinon.spy(async () => ({ marker: "should-not-be-used" }));

            class HomePage extends Page {
                constructor() { super("server"); this.template = []; this.data = dataSpy; }
            }

            let page = new HomePage();
            let { req, res } = mockExpress();

            await page.render(req, res, sinon.spy(), { marker: "explicit" });

            expect(dataSpy.called).to.equal(false, "data() should be skipped when data is passed explicitly");
            expect(jsonRenderStub.firstCall.args[0]).to.deep.equal({ marker: "explicit" });
        });

        describe("edge case: explicit `null` data", () => {
            it("FIXED: is treated the same as omitted, so the data() method still runs", async () => {
                // `if (data === undefined || data === null) data = await base.data(req);`
                // now treats an explicit `null` (a common "no data" sentinel in
                // other APIs) the same as not passing data at all, matching the
                // documented behavior: "if the data object is omitted... the data
                // function will be used instead".
                let jsonRenderStub = makeJsonRenderStub();
                let Page = loadPage({ jsonRenderStub });

                let dataSpy = sinon.spy(async () => ({ marker: "from-data-method" }));

                class HomePage extends Page {
                    constructor() { super("server"); this.template = []; this.data = dataSpy; }
                }

                let page = new HomePage();
                let { req, res } = mockExpress();

                await page.render(req, res, sinon.spy(), null);

                expect(dataSpy.called).to.equal(true);
                expect(jsonRenderStub.firstCall.args[0]).to.deep.equal({ marker: "from-data-method" });
            });
        });

        it("collects nested page components and passes their templates to json2html.render", async () => {
            let jsonRenderStub = makeJsonRenderStub();
            let Page = loadPage({ jsonRenderStub });

            let link = new Component();
            link.template = [{ "<>": "a" }];

            class HomePage extends Page {
                constructor() {
                    super("server");
                    this.template = [];
                    this.components = { link };
                }
            }

            let page = new HomePage();
            let { req, res } = mockExpress();
            await page.render(req, res, sinon.spy());

            expect(jsonRenderStub.firstCall.args[2]).to.deep.equal({ components: { link: [{ "<>": "a" }] } });
        });

        it("FIXED: a circular component reference no longer crashes render() with a RangeError", async () => {
            // Page has its own copy of getComponents() (not inherited from
            // Component) with the identical cycle guard - regression test for
            // that copy specifically.
            let jsonRenderStub = makeJsonRenderStub();
            let Page = loadPage({ jsonRenderStub });

            let a = new Component();
            let b = new Component();
            a.components = { b };
            b.components = { a };

            class HomePage extends Page {
                constructor() { super("server"); this.template = []; this.components = { a }; }
            }

            let page = new HomePage();
            let { req, res } = mockExpress();
            let next = sinon.spy();

            await expect_not_to_throw(() => page.render(req, res, next));

            expect(next.called).to.equal(false);
            expect(jsonRenderStub.firstCall.args[2].components).to.have.keys(["a", "b"]);
        });

        describe("performance: getComponents() caches its result across requests", () => {

            it("PERF FIX: a second render() on the same Page instance reuses the first call's resolved component set, even if .components was mutated in between", async () => {
                // Page has its own copy of getComponents() (mirrors the
                // component.test.js coverage of Component's copy) -
                // this.components is set once, normally in the constructor,
                // and the render() docstring already claimed this caches -
                // regression test proving it now actually does.
                let jsonRenderStub = makeJsonRenderStub();
                let Page = loadPage({ jsonRenderStub });

                let link = new Component();
                link.template = [{ "<>": "a" }];

                class HomePage extends Page {
                    constructor() { super("server"); this.template = []; this.components = { link }; }
                }

                let page = new HomePage();

                let { req: req1, res: res1 } = mockExpress();
                await page.render(req1, res1, sinon.spy());
                expect(jsonRenderStub.firstCall.args[2]).to.deep.equal({ components: { link: [{ "<>": "a" }] } });

                // Add a second component after the first render already ran.
                let extra = new Component();
                extra.template = [{ "<>": "span" }];
                page.components.extra = extra;

                let { req: req2, res: res2 } = mockExpress();
                await page.render(req2, res2, sinon.spy());

                // The second render should still only see the ORIGINAL,
                // cached component set - not the one mutated in afterward.
                expect(jsonRenderStub.secondCall.args[2]).to.deep.equal({ components: { link: [{ "<>": "a" }] } });
            });

            it("does not call a component's own getComponents() again on the Page's second render", async () => {
                let jsonRenderStub = makeJsonRenderStub();
                let Page = loadPage({ jsonRenderStub });

                let link = new Component();
                link.template = [{ "<>": "a" }];
                let linkSpy = sinon.spy(link, "getComponents");

                class HomePage extends Page {
                    constructor() { super("server"); this.template = []; this.components = { link }; }
                }

                let page = new HomePage();
                let { req: req1, res: res1 } = mockExpress();
                let { req: req2, res: res2 } = mockExpress();

                await page.render(req1, res1, sinon.spy());
                await page.render(req2, res2, sinon.spy());

                expect(linkSpy.callCount).to.equal(1,
                    "the component's getComponents() should only run on the first render - the second render is served from the Page's own cache");
            });
        });
    });

    describe("render() - unknown page type", () => {
        it("passes an HTTPError(500) to next() instead of throwing synchronously", async () => {
            let Page = loadPage();

            class BrokenPage extends Page {
                constructor() { super("not-a-real-type"); this.template = []; }
            }

            let page = new BrokenPage();
            let { req, res } = mockExpress();
            let next = sinon.spy();

            await expect_not_to_throw(() => page.render(req, res, next));

            expect(next.calledOnce).to.equal(true);
            let err = next.firstCall.args[0];
            expect(err).to.be.instanceOf(HTTPError);
            expect(err.statusCode).to.equal(500);
            expect(err.message).to.include("Unknown page type");
        });

        it("also treats a page constructed with no type argument at all as unknown", async () => {
            let Page = loadPage();
            let page = new Page(); 
            page.template = [];

            let { req, res } = mockExpress();
            let next = sinon.spy();

            await page.render(req, res, next);

            expect(next.calledOnce).to.equal(true);
            expect(next.firstCall.args[0]).to.be.instanceOf(HTTPError);
        });
    });

    describe("render() - error propagation", () => {
        it("catches a synchronous rendering error and forwards it to next(), rather than throwing", async () => {
            let jsonRenderStub = sinon.stub().throws(new Error("malformed template"));
            let Page = loadPage({ jsonRenderStub });

            class HomePage extends Page {
                constructor() { super("server"); this.template = []; }
            }

            let page = new HomePage();
            let { req, res } = mockExpress();
            let next = sinon.spy();

            await expect_not_to_throw(() => page.render(req, res, next));

            expect(next.calledOnce).to.equal(true);
            expect(next.firstCall.args[0].message).to.equal("malformed template");
        });

        it("still works when render() is called without a next callback at all", async () => {
            let jsonRenderStub = sinon.stub().throws(new Error("boom"));
            let Page = loadPage({ jsonRenderStub });

            class HomePage extends Page {
                constructor() { super("server"); this.template = []; }
            }

            let page = new HomePage();
            let { req, res } = mockExpress();

            // render() builds a no-op `next` for us when one isn't supplied -
            // this must not throw even though the render itself failed.
            await expect_not_to_throw(() => page.render(req, res));
        });
    });
});

async function expect_not_to_throw(fn) {
    let threw = null;
    try { await fn(); } catch (e) { threw = e; }
    expect(threw).to.equal(null);
}
