"use strict";

/**
 * End-to-end server-rendering tests using the REAL dependencies declared in
 * package.json (node-json2html, lodash, serialize-javascript, terser) rather
 * than stubs - these prove the pieces genuinely work together, not just that
 * Page's orchestration calls the right stubbed functions. Mirrors the shape
 * of examples/server/pages/*.js and examples/server/components/item.js.
 */

const sinon = require("sinon");

const Page = require("../../lib/page.js");
const Component = require("../../lib/component.js");

function mockExpress() {
    let req = { params: {}, query: {} };
    let sent = { html: undefined, headers: {} };
    let res = {
        statusCode: undefined,
        setHeader(n, v) { sent.headers[n] = v; },
        end(out) { sent.html = out; },
        cookie() {}
    };
    return { req, res, sent };
}

describe("integration/server-rendering (real node-json2html)", () => {

    it("renders a full HTML document, including a nested (non-client) component", async () => {
        class LinkComponent extends Component {
            constructor() {
                super();
                this.template = [{ "<>": "a", "href": "${url}", "html": "${title}" }];
            }
        }

        class HomePage extends Page {
            constructor() {
                super("server");
                this.components = { link: new LinkComponent() };
                this.template = [
                    { "<>": "html", "html": [
                        { "<>": "head", "html": [{ "<>": "title", "html": "${title}" }] },
                        { "<>": "body", "html": [
                            { "<>": "h2", "html": "${title}" },
                            { "[]": "link", "{}": (o) => o.link }
                        ] }
                    ] }
                ];
            }
            async data() {
                return {
                    title: "My First j2h Page",
                    link: { url: "https://www.json2html.com", title: "My First Link!" }
                };
            }
        }

        let page = new HomePage();
        let { req, res, sent } = mockExpress();
        let next = sinon.spy();

        await page.render(req, res, next);

        if (next.called) throw new Error(`render() unexpectedly called next() with: ${next.firstCall.args[0]}`);
        expect(sent.headers["Content-Type"]).to.equal("text/html");
        expect(sent.html).to.include("<!DOCTYPE html>");
        expect(sent.html).to.include("My First j2h Page");
        expect(sent.html).to.include('href="https://www.json2html.com"');
        expect(sent.html).to.include("My First Link!");
    });

    it("renders each request's own data independently (sequential, non-concurrent requests)", async () => {
        class GreetPage extends Page {
            constructor() {
                super("server");
                this.template = [{ "<>": "p", "html": "Hello, ${name}!" }];
            }
            async data(req) { return { name: req.query.name || "stranger" }; }
        }

        let page = new GreetPage();

        let first = mockExpress();
        first.req.query = { name: "Alice" };
        await page.render(first.req, first.res, sinon.spy());
        expect(first.sent.html).to.include("Hello, Alice!");

        let second = mockExpress();
        second.req.query = { name: "Bob" };
        await page.render(second.req, second.res, sinon.spy());
        expect(second.sent.html).to.include("Hello, Bob!");

        expect(first.sent.html).to.include("Hello, Alice!", "the first response must not have been mutated by the second request");
    });

    it("propagates a data() rejection to next() rather than crashing the server", async () => {
        class BrokenPage extends Page {
            constructor() { super("server"); this.template = []; }
            async data() { throw new Error("upstream service unavailable"); }
        }

        let page = new BrokenPage();
        let { req, res } = mockExpress();
        let next = sinon.spy();

        await page.render(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(next.firstCall.args[0].message).to.equal("upstream service unavailable");
    });
});
