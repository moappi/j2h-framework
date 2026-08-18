"use strict";

const HTTPError = require("../../lib/httpError.js");

describe("server/lib/httpError.js", () => {

    it("is a real Error subclass", () => {
        let err = new HTTPError(500, "boom");
        expect(err).to.be.instanceOf(Error);
        expect(err).to.be.instanceOf(HTTPError);
    });

    it("sets statusCode, name and message from the constructor", () => {
        let err = new HTTPError(404, "Not Found", "page.js", 42);
        expect(err.statusCode).to.equal(404);
        expect(err.name).to.equal("HTTPError");
        expect(err.message).to.equal("Not Found");
    });

    it("toString() prefixes the HTTP status code", () => {
        let err = new HTTPError(418, "I'm a teapot");
        expect(err.toString()).to.equal("HTTP Error (418) : HTTPError: I'm a teapot");
    });

    it("is catchable/throwable like a normal error", () => {
        expect(() => {
            throw new HTTPError(500, "kaboom");
        }).to.throw(HTTPError, "kaboom");
    });

    describe("edge cases", () => {

        it("does not throw when constructed with no statusCode/message", () => {
            expect(() => new HTTPError()).to.not.throw();
        });

        it("statusCode is undefined (not coerced) when omitted", () => {
            let err = new HTTPError();
            expect(err.statusCode).to.be.undefined;
        });

        it("toString() still renders sensibly with an undefined statusCode", () => {
            let err = new HTTPError(undefined, "no code given");
            expect(err.toString()).to.equal("HTTP Error (undefined) : HTTPError: no code given");
        });

        it("accepts a non-numeric statusCode without coercion or validation", () => {
            // The class does zero validation on statusCode - documents current
            // (permissive) behavior so a future change doesn't silently start
            // rejecting values it used to accept.
            let err = new HTTPError("not-a-number", "weird but allowed");
            expect(err.statusCode).to.equal("not-a-number");
        });
    });
});
