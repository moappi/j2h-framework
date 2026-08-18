"use strict";

const sinon = require("sinon");
const Request = require("../../lib/request.js");

function mockExpress(overrides) {
    let req = Object.assign({
        params: { id: "42" },
        query: { q: "term" },
        url: "/things?q=term"
    }, overrides && overrides.req);

    let res = Object.assign({
        statusCode: undefined,
        setHeader: sinon.spy(),
        end: sinon.spy(),
        cookie: sinon.spy()
    }, overrides && overrides.res);

    return { req, res };
}

describe("server/lib/request.js", () => {

    describe("constructor", () => {
        it("copies params and query straight from the express request", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });
            expect(request.params).to.deep.equal({ id: "42" });
            expect(request.query).to.deep.equal({ q: "term" });
            expect(request.sent).to.equal(false);
        });
    });

    describe("send()", () => {

        it("sends a raw string as html with a 200 by default", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.send("<h1>hi</h1>");

            expect(res.end.calledOnceWith("<h1>hi</h1>")).to.equal(true);
            expect(res.setHeader.calledWith("Content-Type", "text/html")).to.equal(true);
            expect(res.statusCode).to.equal(200);
            expect(request.sent).to.equal(true);
        });

        it("sends {html} with an html content-type", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.send({ html: "<p>hello</p>" });

            expect(res.end.calledOnceWith("<p>hello</p>")).to.equal(true);
            expect(res.setHeader.calledWith("Content-Type", "text/html")).to.equal(true);
        });

        it("sends {json} JSON-stringified with a json content-type", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.send({ json: { ok: true, n: 1 } });

            expect(res.end.calledOnceWith(JSON.stringify({ ok: true, n: 1 }))).to.equal(true);
            expect(res.setHeader.calledWith("Content-Type", "application/json")).to.equal(true);
        });

        it("applies custom headers on top of the default ones", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.send({ html: "<p>x</p>", headers: { "X-Custom": "yes" } });

            expect(res.setHeader.calledWith("Content-Type", "text/html")).to.equal(true);
            expect(res.setHeader.calledWith("X-Custom", "yes")).to.equal(true);
        });

        it("does not clobber a status code the caller already set", () => {
            let { req, res } = mockExpress();
            res.statusCode = 201;
            let request = new Request({ req, res });

            request.send({ html: "created" });

            expect(res.statusCode).to.equal(201);
        });

        describe("edge cases", () => {

            it("sending twice only writes the response once (idempotent after first send)", () => {
                let { req, res } = mockExpress();
                let request = new Request({ req, res });

                request.send("first");
                request.send("second");

                expect(res.end.calledOnce).to.equal(true);
                expect(res.end.firstCall.args[0]).to.equal("first");
            });

            it("FIXED: when both {json} and {html} are provided, json wins deterministically", () => {
                // json and html are now mutually exclusive (else-if) instead of
                // two independent ifs where whichever ran last silently won.
                // json is checked first, so it takes priority if a caller
                // mistakenly supplies both.
                let { req, res } = mockExpress();
                let request = new Request({ req, res });

                request.send({ json: { a: 1 }, html: "<b>should be ignored</b>" });

                expect(res.end.calledOnceWith(JSON.stringify({ a: 1 }))).to.equal(true);
                expect(res.setHeader.calledWith("Content-Type", "application/json")).to.equal(true);
            });

            it("falls back to an empty JSON object if the payload can't be stringified", () => {
                let { req, res } = mockExpress();
                let request = new Request({ req, res });

                let circular = {};
                circular.self = circular;

                request.send({ json: circular });

                expect(res.end.calledOnceWith("{}")).to.equal(true);
            });

            it("FIXED: an explicit statusCode of 0 is preserved, not overwritten to 200", () => {
                // The default-status check now compares against `undefined`
                // specifically (`this.res.statusCode === undefined`), so an
                // explicitly-set falsy code like 0 is no longer mistaken for
                // "never set".
                let { req, res } = mockExpress();
                res.statusCode = 0;
                let request = new Request({ req, res });

                request.send("x");

                expect(res.statusCode).to.equal(0);
            });

            it("sends an empty string body without throwing when the string is falsy", () => {
                let { req, res } = mockExpress();
                let request = new Request({ req, res });

                request.send("");

                expect(res.end.calledOnceWith("")).to.equal(true);
            });

            it("does nothing for an unsupported payload type (e.g. a number)", () => {
                let { req, res } = mockExpress();
                let request = new Request({ req, res });

                request.send(42);

                expect(res.end.calledOnceWith(undefined)).to.equal(true);
                expect(request.sent).to.equal(true);
            });
        });
    });

    describe("error()", () => {
        it("sets a 404 status and sends the payload", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.error({ html: "not found" });

            expect(res.statusCode).to.equal(404);
            expect(res.end.calledOnceWith("not found")).to.equal(true);
        });

        it("logs an internal error to the console when provided, without leaking it to the client", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });
            let consoleStub = sinon.stub(console, "error");

            try {
                request.error({ html: "not found" }, new Error("db connection refused"));
                expect(consoleStub.calledOnce).to.equal(true);
            } finally {
                consoleStub.restore();
            }

            expect(res.end.calledOnceWith("not found")).to.equal(true);
        });
    });

    describe("redirect()", () => {
        it("issues a 302 with a Location header and ends the response", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.redirect("/login");

            expect(res.statusCode).to.equal(302);
            expect(res.setHeader.calledWith("Location", "/login")).to.equal(true);
            expect(res.end.calledOnce).to.equal(true);
            expect(request.sent).to.equal(true);
        });

        it("is a no-op if the response was already sent", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.send("already done");
            request.redirect("/somewhere-else");

            expect(res.statusCode).to.equal(200, "redirect() must not overwrite an already-sent response's status");
            expect(res.setHeader.calledWith("Location")).to.equal(false);
        });
    });

    describe("refresh()", () => {
        it("redirects back to the current pathname with the query string re-attached", () => {
            let { req, res } = mockExpress({ req: { url: "/search?q=term&page=2", query: { q: "term", page: "2" } } });
            let request = new Request({ req, res });

            request.refresh();

            expect(res.statusCode).to.equal(302);
            let location = res.setHeader.args.find(([name]) => name === "Location")[1];
            expect(location).to.equal("/search?q=term&page=2");
        });

        it("redirects to a bare pathname when there is no query to preserve", () => {
            let { req, res } = mockExpress({ req: { url: "/search", query: {} } });
            let request = new Request({ req, res });

            request.refresh();

            let location = res.setHeader.args.find(([name]) => name === "Location")[1];
            expect(location).to.equal("/search");
        });
    });

    describe("header()/headers()/status()/cookie()", () => {
        it("sets a single header, but only while the response hasn't been sent yet", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.header("X-One", "1");
            request.send("done");
            request.header("X-Two", "2");

            expect(res.setHeader.calledWith("X-One", "1")).to.equal(true);
            expect(res.setHeader.calledWith("X-Two", "2")).to.equal(false);
        });

        it("sets multiple headers at once via headers()", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.headers({ "X-A": "a", "X-B": "b" });

            expect(res.setHeader.calledWith("X-A", "a")).to.equal(true);
            expect(res.setHeader.calledWith("X-B", "b")).to.equal(true);
        });

        it("status() sets the status code directly", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.status(451);

            expect(res.statusCode).to.equal(451);
        });

        it("cookie() delegates straight to res.cookie(), but only before sending", () => {
            let { req, res } = mockExpress();
            let request = new Request({ req, res });

            request.cookie("session", "abc123", { httpOnly: true });
            expect(res.cookie.calledOnceWith("session", "abc123", { httpOnly: true })).to.equal(true);

            request.send("done");
            request.cookie("late", "nope");
            expect(res.cookie.calledOnce).to.equal(true, "cookie() must not fire after the response was already sent");
        });
    });
});
