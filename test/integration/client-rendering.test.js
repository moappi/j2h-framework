"use strict";

/**
 * End-to-end CLIENT rendering test mirroring examples/client/pages/home.js,
 * examples/client/pages/user.js and examples/client/components/user.js:
 * two routed pages, one of which lazy-loads a shared, path-referenced
 * component, driven through the full j2h.App routing pipeline.
 */

const loadClient = require("../helpers/doubles/loadClient.js");

function tick(n) {
    let p = Promise.resolve();
    for (let i = 0; i < (n || 5); i++) p = p.then(() => new Promise((r) => setImmediate(r)));
    return p;
}

describe("integration/client-rendering (routing + lazy components)", () => {

    it("routes between two pages and renders a lazily-loaded, path-referenced component", async () => {
        let { j2h, page, document } = loadClient({
            html: '<!doctype html><html><head><script src="/js/j2h.js"></script></head><body></body></html>'
        });

        document.body.innerHTML = "";

        j2h.export("/pages/home.js", class extends j2h.Page {
            constructor() {
                super();
                this.components = { user: "/components/user.js" };
                this.template = [
                    { "<>": "section", "html": [
                        { "<>": "h2", "text": "Home Page" },
                        { "<>": "ul", "html": [{ "[]": "user", "{}": (o) => o.users }] }
                    ] }
                ];
            }
            async data() {
                return { users: [{ name: "Bill Brown", user: "bill" }, { name: "Jane Brown", user: "jane" }] };
            }
        });

        j2h.export("/pages/user.js", class extends j2h.Page {
            constructor() {
                super();
                this.template = [{ "<>": "section", "html": [{ "<>": "h2", "text": "User ${user}" }] }];
            }
            async data(req) { return { user: req.params.user }; }
        });

        let pages = {
            home: await j2h.require("/pages/home.js"),
            user: await j2h.require("/pages/user.js")
        };

        j2h.app.page("/", pages.home);
        j2h.app.page("/user/:user", pages.user);

        await j2h.app.listen();

        // --- navigate to "/" ---
        let showPromise = page.show("/");

        // While home's data() (and its lazy component load) is settling,
        // the component script should have been requested.
        await tick(2);
        let componentScript = document.querySelector('script[src="/components/user.js"]');
        expect(componentScript, "home page's 'user' component should be lazily fetched").to.not.be.null;

        j2h.export("/components/user.js", class extends j2h.Component {
            constructor() {
                super();
                this.template = [{ "<>": "li", "html": [{ "<>": "a", "href": "/user/${user}", "text": "${name}" }] }];
            }
        });
        componentScript.onload();

        await showPromise;
        await tick(3);

        expect(document.body.__j2hRenderCalls).to.have.length(1);
        expect(document.body.__j2hRenderCalls[0].data).to.deep.equal({
            users: [{ name: "Bill Brown", user: "bill" }, { name: "Jane Brown", user: "jane" }]
        });

        // --- now navigate to "/user/bill" ---
        await page.show("/user/bill");
        await tick(3);

        let lastCall = document.body.__j2hRenderCalls[document.body.__j2hRenderCalls.length - 1];
        expect(lastCall.data).to.deep.equal({ user: "bill" });
    });
});
