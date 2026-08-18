"use strict";

const sinon = require("sinon");

const Component = require("../../lib/component.js");

describe("server/lib/component.js", () => {

    describe("defaults", () => {
        it("defaults template/components to empty objects and client to false", () => {
            let c = new Component();
            expect(c.template).to.deep.equal({});
            expect(c.components).to.deep.equal({});
            expect(c.client).to.equal(false);
        });
    });

    describe("getComponents()", () => {

        it("returns an empty object when the component has no sub-components", () => {
            let c = new Component();
            expect(c.getComponents()).to.deep.equal({});
        });

        it("returns direct sub-components keyed by name", () => {
            let link = new Component();
            let page = new Component();
            page.components = { link };

            let got = page.getComponents();
            expect(got).to.have.property("link", link);
        });

        it("recursively flattens grandchild components into a single map", () => {
            let leaf = new Component();
            let mid = new Component();
            mid.components = { leaf };
            let top = new Component();
            top.components = { mid };

            let got = top.getComponents();
            expect(Object.keys(got).sort()).to.deep.equal(["leaf", "mid"]);
            expect(got.leaf).to.equal(leaf);
            expect(got.mid).to.equal(mid);
        });

        it("last-registered component wins when the same name appears at multiple levels", () => {
            let leafA = new Component();
            let leafB = new Component();

            let mid = new Component();
            mid.components = { dup: leafA };

            let top = new Component();
            // "dup" also declared directly on top - Object.assign order means
            // whichever is merged last (the deeper/child one, since sub-components
            // are merged in after the direct one) wins.
            top.components = { dup: leafB, mid };

            let got = top.getComponents();
            expect(got.dup).to.equal(leafA, "the nested component should overwrite the direct one during the merge");
        });

        describe("edge case: circular component references", () => {

            it("FIXED: breaks the cycle instead of overflowing the stack, and still includes both components", () => {
                // getComponents() now tracks visited components on a shared
                // "seen" Set across the recursive call chain. Once a component
                // is revisited (a cycle), its own sub-components aren't
                // re-expanded again - but it's still included by name in the
                // merged map, since whoever referenced it still needs it
                // registered under that name.
                let a = new Component();
                let b = new Component();
                a.components = { b };
                b.components = { a };

                let got = a.getComponents();

                expect(() => a.getComponents()).to.not.throw();
                expect(Object.keys(got).sort()).to.deep.equal(["a", "b"]);
                expect(got.a).to.equal(a);
                expect(got.b).to.equal(b);
            });

            it("FIXED: a component referencing itself resolves to just that component, no stack overflow", () => {
                let self = new Component();
                self.components = { self };

                let got;
                expect(() => { got = self.getComponents(); }).to.not.throw();
                expect(Object.keys(got)).to.deep.equal(["self"]);
                expect(got.self).to.equal(self);
            });

            it("does not falsely treat two DIFFERENT components with the same shape as a cycle", () => {
                let leafA = new Component();
                let leafB = new Component();
                let mid = new Component();
                mid.components = { leafA, leafB };

                let got = mid.getComponents();
                expect(Object.keys(got).sort()).to.deep.equal(["leafA", "leafB"]);
            });
        });

        describe("performance: caches the resolved component map instead of rebuilding it every call", () => {

            it("PERF FIX: a second call returns the EXACT SAME object, not a freshly rebuilt equal one", () => {
                let leaf = new Component();
                let mid = new Component();
                mid.components = { leaf };

                let first = mid.getComponents();
                let second = mid.getComponents();

                expect(second).to.equal(first, "second call should return the cached object reference");
            });

            it("PERF FIX: a mutation to .components after the first call is NOT reflected by a later call (proves it's truly cached, not just coincidentally equal)", () => {
                let leaf = new Component();
                let mid = new Component();
                mid.components = { leaf };

                let first = mid.getComponents();
                expect(Object.keys(first)).to.deep.equal(["leaf"]);

                // this.components is documented as set once (normally in the
                // constructor) and never changed afterward - mutating it here
                // is deliberately "doing the unsupported thing" to prove the
                // cache is real, not to suggest this is a supported pattern.
                mid.components.extra = new Component();

                let second = mid.getComponents();
                expect(Object.keys(second)).to.deep.equal(["leaf"],
                    "a cached result should not pick up components added after the first resolution");
            });

            it("PERF FIX: a child's own getComponents() is not re-invoked on the parent's second call (the child is also served from its own cache)", () => {
                let leaf = new Component();
                let leafSpy = sinon.spy(leaf, "getComponents");
                let mid = new Component();
                mid.components = { leaf };

                mid.getComponents(); // first call: builds + caches mid's map, calling leaf.getComponents() once
                mid.getComponents(); // second call: should be served entirely from mid's own cache

                expect(leafSpy.callCount).to.equal(1,
                    "leaf.getComponents() should only ever run once - mid's second call short-circuits before recursing into it again");
            });

            it("still resolves correctly the first time even after a sibling/cousin component has already been cached from an unrelated prior call", () => {
                // Guards against a naive fix over-caching based on component
                // IDENTITY alone (e.g. a module-level cache) rather than
                // per-instance state - two unrelated trees must not interfere.
                let sharedShapeLeaf = new Component();
                let treeA = new Component();
                treeA.components = { sharedShapeLeaf };
                treeA.getComponents(); // warm treeA's own cache

                let differentLeaf = new Component();
                let treeB = new Component();
                treeB.components = { differentLeaf };

                let gotB = treeB.getComponents();
                expect(Object.keys(gotB)).to.deep.equal(["differentLeaf"]);
            });
        });
    });

    describe("Component.templates() (static)", () => {

        it("returns an empty object for an empty component map", () => {
            expect(Component.templates({})).to.deep.equal({});
        });

        it("returns every component's template when no client filter is requested", () => {
            let a = new Component(); a.template = { a: 1 };
            let b = new Component(); b.template = { b: 2 }; b.client = true;

            let templates = Component.templates({ a, b });
            expect(templates).to.deep.equal({ a: { a: 1 }, b: { b: 2 } });
        });

        it("only returns components flagged client=true when the client filter is on", () => {
            let a = new Component(); a.template = { a: 1 }; a.client = false;
            let b = new Component(); b.template = { b: 2 }; b.client = true;

            let templates = Component.templates({ a, b }, true);
            expect(templates).to.deep.equal({ b: { b: 2 } });
        });

        it("returns an empty object when filtering for client but none are client-enabled", () => {
            let a = new Component(); a.client = false;
            expect(Component.templates({ a }, true)).to.deep.equal({});
        });
    });
});
