/**
 * A minimal, dependency-free test double for the "page.js" client router.
 *
 * j2h-framework's browser router (j2h.js) is built ON TOP OF page.js: it stores
 * a reference to the global `page` function/object and calls a handful of its
 * APIs (`page(path, ...middleware)`, `page()` to start, `new page.Route(path)`,
 * `page.exit(path, cb)`, `page.redirect(path)`).
 *
 * The real "page" package can't be installed in this environment (no npm
 * registry access), and even where it can, unit-testing j2h's OWN routing/
 * preload logic shouldn't depend on page.js's real history/popstate wiring.
 * This double implements just enough of page.js's observable contract -
 * path-to-regexp style route matching with named `:params`, a middleware
 * chain, and exit handlers - to drive j2h.Router / j2h.App tests deterministically.
 *
 * If you'd rather test against the real page.js in your own environment,
 * swap this module out for `require("page")`.
 */
"use strict";

function compile(path) {
    let keys = [];

    let pattern = String(path)
        .replace(/([.+^${}()|[\]\\])/g, "\\$1") // escape regex specials EXCEPT ':' and '*'
        .replace(/\/:([^/]+)/g, (m, name) => {
            keys.push(name);
            return "/([^/]+)";
        })
        .replace(/\*/g, ".*");

    return { keys, regexp: new RegExp("^" + pattern + "(?:\\?.*)?$") };
}

function Route(path) {
    this.path = path;
    let compiled = compile(path);
    this.keys = compiled.keys;
    this.regexp = compiled.regexp;
}

function createMockPage() {
    function page(path, ...callbacks) {
        page._routes.push({ path, route: new Route(path), callbacks });
    }

    page._routes = [];
    page._exits = [];
    page._started = false;
    page._current = undefined;
    page.Route = Route;

    page.exit = function (path, cb) {
        page._exits.push({ route: new Route(path), cb });
    };

    // Build a page.js-style context object for a given "URL"
    page._buildCtx = function (url) {
        let [pathAndSearch, hash] = url.split("#");
        let [pathname, querystring] = pathAndSearch.split("?");

        return {
            canonicalPath: url,
            path: pathAndSearch,
            querystring: querystring || "",
            hash: hash || "",
            pathname,
            routePath: pathname,
            params: {},
            state: {},
            handled: false,
            save() {}
        };
    };

    // Simulate page.js dispatching to `url`: runs exit handlers for the
    // previously-active route, finds a matching route, and walks its
    // middleware chain (ctx, next) => ... in order, exactly like page.js does.
    page.show = function (url) {
        return new Promise((resolve) => {
            let ctx = page._buildCtx(url);

            let runExits = () => {
                if (!page._current) return;
                let prevCtx = page._current;
                for (let exit of page._exits) {
                    if (exit.route.regexp.test(prevCtx.pathname)) {
                        let done = false;
                        exit.cb(prevCtx, () => { done = true; });
                    }
                }
            };

            runExits();

            let match = page._routes.find((r) => r.route.regexp.test(pathname_only(url)));

            if (!match) {
                page._current = ctx;
                return resolve(ctx);
            }

            let m = match.route.regexp.exec(pathname_only(url));
            match.route.keys.forEach((key, i) => { ctx.params[key] = m[i + 1]; });

            let idx = 0;
            // NOTE: real page.js's `next` takes no error argument at all -
            // nextEnter() in page.js's dispatch() is `function nextEnter() {
            // var fn = page.callbacks[i++]; ...; fn(ctx, nextEnter); }`, and
            // ignores whatever is passed to it. j2h.js's Router._apply() does
            // `Promise.all(middleware).then(next)`, which calls `next(<array
            // of resolved middleware results>)` - always a truthy value (even
            // `[]`, since empty arrays are truthy), including when there's no
            // middleware at all. An earlier version of this double treated
            // any truthy argument as an Express-style `next(err)` and
            // rejected the whole dispatch - which real page.js does not do,
            // and which broke every routing test that exercises middleware
            // via `Router._apply()`. `next` now simply ignores its argument,
            // matching real page.js.
            let next = () => {
                if (idx >= match.callbacks.length) {
                    page._current = ctx;
                    return resolve(ctx);
                }
                let isLast = idx === match.callbacks.length - 1;
                let cb = match.callbacks[idx++];
                cb(ctx, next);
                // Real page.js does NOT wait for the terminal route handler to
                // call next() - there's nothing left to advance to. j2h's own
                // terminal handler kicks off page.render() without awaiting it
                // (fire-and-forget from the router's perspective), so dispatch
                // is considered "done" as soon as that handler has been invoked,
                // not when whatever it started finishes. Callers who need to
                // observe the resulting render should await a tick (or several)
                // after `show()`/`redirect()` resolves.
                if (isLast) {
                    page._current = ctx;
                    resolve(ctx);
                }
            };

            next();
        });
    };

    page.redirect = function (url) {
        return page.show(url);
    };

    // page() with no args = "start the router" (dispatch current location).
    // In tests we treat this as a no-op unless a starting URL was configured.
    page.start = function (url) {
        page._started = true;
        if (url) return page.show(url);
        return Promise.resolve();
    };

    // Support calling `page()` directly (as j2h.App.listen() does: base._pagejs())
    let callable = function (...args) {
        if (args.length === 0) return page.start();
        return page(...args);
    };
    Object.assign(callable, page);
    // keep _routes/_exits arrays shared by reference (Object.assign copies the
    // reference for arrays/objects, not a deep clone, so mutations stay in sync)
    return callable;
}

function pathname_only(url) {
    return url.split(/[?#]/)[0];
}

module.exports = createMockPage;
