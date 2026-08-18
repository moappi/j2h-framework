"use strict";

/**
 * Tests for j2h.State (client/j2h.js), including its internal lodash-style
 * get()/set() path resolution (j2h.js vendors a trimmed-down lodash clone
 * rather than depending on the real package in the browser bundle - there's
 * no separate export for it, so we exercise it indirectly through State,
 * which is the only thing that calls it).
 */

const loadClient = require("../helpers/doubles/loadClient.js");

describe("client/j2h.js - State", () => {

    let j2h;
    beforeEach(() => { ({ j2h } = loadClient()); });

    describe("get()/set() path resolution", () => {

        it("sets and gets a top-level value", () => {
            let state = new j2h.State();
            state.set("count", 1);
            expect(state.get("count")).to.equal(1);
        });

        it("sets and gets a deeply nested value via a dotted string path", () => {
            let state = new j2h.State();
            state.set("a.b.c", 42);
            expect(state.get("a.b.c")).to.equal(42);
            expect(state.all).to.deep.equal({ a: { b: { c: 42 } } });
        });

        it("accepts an array path as an alternative to a dotted string", () => {
            let state = new j2h.State();
            state.set(["a", "b", "c"], 42);
            expect(state.get(["a", "b", "c"])).to.equal(42);
        });

        it("get() with a missing path returns undefined instead of throwing", () => {
            let state = new j2h.State();
            expect(state.get("nope.nope.nope")).to.be.undefined;
            state.set("a.b", 1);
            expect(state.get("a.b.c.d")).to.be.undefined;
        });

        it("get() with no path returns the entire state tree", () => {
            let state = new j2h.State();
            state.set("a", 1);
            state.set("b", 2);
            expect(state.get()).to.deep.equal({ a: 1, b: 2 });
            expect(state.get()).to.equal(state.all);
        });

        it("set() on an array index creates the array and fills the slot", () => {
            let state = new j2h.State();
            state.set("items[1]", "second");
            expect(state.all.items).to.be.an("array");
            expect(state.all.items[1]).to.equal("second");
        });

        describe("edge case: prototype pollution attempts", () => {

            it("FIXED: blocks writes to __proto__ without throwing (Object.prototype is not polluted)", () => {
                // The guard in lodash.set() correctly refuses to write to
                // __proto__/constructor/prototype (so pollution itself was
                // always blocked), but it used to `return object;` instead of
                // the list of updated paths State.set() expects, so
                // State.set()'s `.reverse()` call blew up with a TypeError.
                // It now returns `[]`, so a pollution attempt is a clean
                // no-op instead of a crash.
                let state = new j2h.State();
                let before = ({}).polluted;

                expect(() => state.set("__proto__.polluted", "yes")).to.not.throw();

                expect(({}).polluted).to.equal(before, "Object.prototype must remain unpolluted");
            });

            it("FIXED: blocks writes to constructor and prototype keys the same way, without throwing", () => {
                let state = new j2h.State();
                expect(() => state.set("constructor.polluted", "yes")).to.not.throw();
                expect(() => state.set("prototype.polluted", "yes")).to.not.throw();
                expect(({}).polluted).to.be.undefined;
            });
        });
    });

    describe("subscribe()", () => {

        it("fires when the exact subscribed path changes", () => {
            let state = new j2h.State();
            let seen = [];
            state.subscribe("count", (path, value) => seen.push({ path, value }));

            state.set("count", 5);

            expect(seen).to.deep.equal([{ path: "count", value: 5 }]);
        });

        it("also fires ANCESTOR subscribers when a nested descendant changes", () => {
            let state = new j2h.State();
            let parentSeen = [];
            let childSeen = [];
            state.subscribe("obj", (path, value) => parentSeen.push({ path, value }));
            state.subscribe("obj.var", (path, value) => childSeen.push({ path, value }));

            state.set("obj.var", 99);

            expect(childSeen).to.deep.equal([{ path: "obj.var", value: 99 }]);
            expect(parentSeen).to.deep.equal([{ path: "obj.var", value: 99 }]);
        });

        it("accepts an array path, joined with '.'", () => {
            let state = new j2h.State();
            let seen = [];
            state.subscribe(["obj", "nested"], (path) => seen.push(path));

            state.set("obj.nested", 1);

            expect(seen).to.deep.equal(["obj.nested"]);
        });

        it("supports multiple subscribers on the same path", () => {
            let state = new j2h.State();
            let a = [], b = [];
            state.subscribe("x", () => a.push(1));
            state.subscribe("x", () => b.push(1));

            state.set("x", 1);

            expect(a.length).to.equal(1);
            expect(b.length).to.equal(1);
        });

        it("setting a path with nothing subscribed to it does not throw", () => {
            let state = new j2h.State();
            expect(() => state.set("nobody.is.listening", 1)).to.not.throw();
        });
    });

    describe("attach() / _clean() (page-lifecycle garbage collection)", () => {

        it("attaches a top-level state path to the page that set it, and removes it once that page is cleaned", () => {
            let state = new j2h.State();
            state.set("users", ["a", "b"], { pathname: "/dashboard" });

            expect(state.get("users")).to.deep.equal(["a", "b"]);

            state._clean("/somewhere-else"); // navigated away from /dashboard entirely

            expect(state.get("users")).to.be.undefined;
        });

        it("keeps state that belongs to a still-valid ANCESTOR path of the page being navigated to", () => {
            let state = new j2h.State();
            state.set("layout", "sidebar-open", { pathname: "/dashboard" });

            // navigating to a page still nested under /dashboard - "/dashboard"
            // itself is part of that route's ancestor chain, so it must survive.
            state._clean("/dashboard/settings");

            expect(state.get("layout")).to.equal("sidebar-open");
        });

        it("cleans state belonging to a SIBLING page that isn't part of the new route's ancestor chain", () => {
            let state = new j2h.State();
            state.set("users", ["a"], { pathname: "/dashboard/users" });

            // "/dashboard/users" is a sibling of "/dashboard/settings", not an
            // ancestor of it, so it's treated as no-longer-active and cleaned.
            state._clean("/dashboard/settings");

            expect(state.get("users")).to.be.undefined;
        });

        describe("edge case: nested dotted-path state is now correctly garbage collected", () => {
            it("FIXED: removes both a top-level key AND a nested dotted-path key on cleanup", () => {
                // _clean() used to do `delete base.all[key]` where `key` is the
                // raw path STRING originally passed to set() (e.g.
                // "profile.name"). That only ever worked for single-segment/
                // top-level paths - for a nested path like "profile.name",
                // `base.all` has no literal property named "profile.name" (it
                // has base.all.profile.name instead), so the delete was a
                // no-op and the stale value was never actually removed. Fixed
                // by adding a path-aware `lodash.unset()` helper and using it
                // in place of the bare `delete`.
                let state = new j2h.State();
                let req = { pathname: "/page1" };

                state.set("topKey", "top-value", req);
                state.set("nested.deep.value", "deep-value", req);

                expect(state.get("topKey")).to.equal("top-value");
                expect(state.get("nested.deep.value")).to.equal("deep-value");

                state._clean("/somewhere-else");

                expect(state.get("topKey")).to.be.undefined; // top-level: correctly cleaned
                expect(state.get("nested.deep.value")).to.be.undefined; // nested: now ALSO correctly cleaned
            });

            it("FIXED: also works for a state path set via an array (not just a dotted string)", () => {
                let state = new j2h.State();
                let req = { pathname: "/page1" };

                state.set(["a", "b", "c"], "deep-value", req);
                expect(state.get("a.b.c")).to.equal("deep-value");

                state._clean("/somewhere-else");

                expect(state.get("a.b.c")).to.be.undefined;
            });
        });
    });
});
