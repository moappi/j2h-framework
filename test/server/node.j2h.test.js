"use strict";

/**
 * Tests for node.j2h.js - the framework's server entry point (`main` in
 * package.json): the public class exports, and the `app.page = j2h.express.page`
 * one-liner integration described in the README.
 */

const express = require("express");
const request = require("supertest");

const j2h = require("../../node.j2h.js");
const RealPage = require("../../lib/page.js");
const RealComponent = require("../../lib/component.js");
const RealRequest = require("../../lib/request.js");
const RealHTTPError = require("../../lib/httpError.js");

describe("server/node.j2h.js", () => {

    describe("module exports", () => {
        it("exposes Page, Component, Request, HTTPError and express.page", () => {
            expect(j2h.Page).to.be.a("function");
            expect(j2h.Component).to.be.a("function");
            expect(j2h.Request).to.be.a("function");
            expect(j2h.HTTPError).to.be.a("function");
            expect(j2h.express).to.have.property("page").that.is.a("function");
        });

        it("re-exports the exact same classes as lib/*.js (not copies)", () => {
            expect(j2h.Page).to.equal(RealPage);
            expect(j2h.Component).to.equal(RealComponent);
            expect(j2h.Request).to.equal(RealRequest);
            expect(j2h.HTTPError).to.equal(RealHTTPError);
        });
    });

    describe("express.page()", () => {

        it("wires GET <path> to page.render(req,res,next) with the genuine express req/res objects", async () => {
            // This is a deliberate regression test for a very easy mistake to
            // (re)introduce: express.page()'s route handler is written as
            // `async (res, req, next) => { ... page.render(res, req, next) ... }`
            // - the LOCAL parameter names are swapped relative to what express
            // actually passes positionally, but the call site swaps them back
            // when handing off to page.render(). The net effect cancels out and
            // is correct today, but renaming either side without checking the
            // other would silently break every route. Asserting end-to-end
            // through a real express app + real HTTP request is what actually
            // proves the wiring is right, independent of the confusing naming.
            let app = express();
            app.page = j2h.express.page;

            let receivedReq, receivedRes;
            let fakePage = {
                async render(req, res, next) {
                    receivedReq = req;
                    receivedRes = res;
                    res.status(200).send("rendered-ok");
                }
            };

            app.page("/test", fakePage);

            let res = await request(app).get("/test?x=1");

            expect(res.status).to.equal(200);
            expect(res.text).to.equal("rendered-ok");

            // Proves `req` really is the express Request (has query/params/etc.)
            expect(receivedReq.query).to.deep.equal({ x: "1" });
            expect(receivedReq.path).to.equal("/test");

            // Proves `res` really is the express Response (has status/send/etc.),
            // not the request object.
            expect(typeof receivedRes.status).to.equal("function");
            expect(typeof receivedRes.send).to.equal("function");
        });

        it("forwards a render() rejection to next(err), letting express's error middleware handle it", async () => {
            let app = express();
            app.page = j2h.express.page;

            let fakePage = { async render() { throw new Error("render blew up"); } };
            app.page("/boom", fakePage);

            app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
                res.status(500).send("caught:" + err.message);
            });

            let res = await request(app).get("/boom");

            expect(res.status).to.equal(500);
            expect(res.text).to.equal("caught:render blew up");
        });

        it("supports route params, which land in req.params exactly as express would provide them", async () => {
            let app = express();
            app.page = j2h.express.page;

            let receivedParams;
            let fakePage = {
                async render(req, res) {
                    receivedParams = req.params;
                    res.status(200).send("ok");
                }
            };

            app.page("/user/:username", fakePage);

            await request(app).get("/user/chad");

            expect(receivedParams).to.deep.equal({ username: "chad" });
        });
    });
});
