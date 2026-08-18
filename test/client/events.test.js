"use strict";

/**
 * Tests for j2h.Events (client/j2h.js) - the tiny pub/sub used internally for
 * things like the "onpageload" event fired after a page finishes rendering.
 */

const loadClient = require("../helpers/doubles/loadClient.js");

describe("client/j2h.js - Events", () => {

    let j2h;
    beforeEach(() => { ({ j2h } = loadClient()); });

    it("register() + trigger() invokes the callback with {id, ctx}", () => {
        let events = new j2h.Events();
        let received = [];
        events.register("onx", (payload) => received.push(payload));

        events.trigger("onx", { foo: 1 });

        expect(received).to.have.length(1);
        expect(received[0].ctx).to.deep.equal({ foo: 1 });
        expect(received[0].id).to.be.a("string");
    });

    it("supports multiple listeners on the same event name", () => {
        let events = new j2h.Events();
        let a = 0, b = 0;
        events.register("onx", () => a++);
        events.register("onx", () => b++);

        events.trigger("onx", {});

        expect(a).to.equal(1);
        expect(b).to.equal(1);
    });

    it("triggering an event name nobody registered is a safe no-op", () => {
        let events = new j2h.Events();
        expect(() => events.trigger("never-registered", {})).to.not.throw();
    });

    describe("edge case: register() now returns the generated listener id", () => {
        it("FIXED: lets remove() actually be used to unsubscribe through the public API", () => {
            // register() generates an id internally (`let id = _id();`) and
            // uses it as the storage key, but used to never `return` it -
            // so a caller who did `let id = events.register(...)` got
            // `undefined` back, and `events.remove(name, undefined)` deleted
            // a non-existent "undefined" key instead of the real listener.
            // register() now returns the id, so remove() can target it.
            let events = new j2h.Events();
            let calls = 0;

            let id = events.register("onx", () => calls++);
            expect(id).to.be.a("string").and.not.equal("");

            events.remove("onx", id);
            events.trigger("onx", {});

            expect(calls).to.equal(0, "the listener should have been successfully unsubscribed before triggering");
        });
    });

    it("remove() on an event name that was never registered is a safe no-op", () => {
        let events = new j2h.Events();
        expect(() => events.remove("nope", "some-id")).to.not.throw();
    });
});
