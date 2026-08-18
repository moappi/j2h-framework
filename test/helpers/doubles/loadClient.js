/**
 * Loads a fresh, isolated instance of the browser j2h.js module inside a
 * fresh jsdom document.
 *
 * j2h.js is written as a browser-style singleton (`j2h.app` is constructed
 * once at module-evaluation time and mutated through the public API), so
 * re-`require()`-ing it without clearing the module cache would leak
 * routes/state/event registrations between tests. This helper clears the
 * cache and rebuilds the globals (`document`, `window`, `page`, `crypto`)
 * every time it's called, so each test gets its own clean j2h instance.
 */
"use strict";

const { JSDOM } = require("jsdom");
const createMockPage = require("./mockPage.js");
const createMockJson2html = require("./mockJson2html.js");

const J2H_SOURCE = require.resolve("../../../j2h.js");

function loadClient(options) {
    options = options || {};

    let dom = new JSDOM(options.html || "<!doctype html><html><body></body></html>", {
        url: options.url || "https://example.test/"
    });

    let mockPage = createMockPage();

    global.window = dom.window;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.page = mockPage;

    // Node >=19 ships a global WebCrypto implementation; j2h.Events._createId()
    // relies on crypto.getRandomValues, which works fine against it. On
    // older Node (<19), fall back to jsdom's own crypto implementation.
    //
    // IMPORTANT: `global.crypto` on modern Node is a getter-only accessor
    // with no setter, so a plain `global.crypto = ...` assignment throws
    // "TypeError: Cannot set property crypto of #<Object> which has only a
    // getter" - even when "assigning" it right back to itself via
    // `global.crypto || ...`, since the assignment operator still invokes
    // the (nonexistent) setter regardless of the right-hand value.
    // Object.defineProperty replaces the property descriptor outright
    // instead of going through the setter, so it's used here - but only
    // when crypto isn't already defined, since we don't want to (and can't)
    // clobber the real one anyway.
    if (!global.crypto) {
        Object.defineProperty(global, "crypto", {
            value: dom.window.crypto,
            configurable: true,
            writable: true
        });
    }

    let mockJson2html = createMockJson2html(dom.window.Element);
    global.json2html = mockJson2html;
    dom.window.json2html = mockJson2html;

    delete require.cache[J2H_SOURCE];
    let j2h = require(J2H_SOURCE);

    return { j2h, dom, page: mockPage, json2html: mockJson2html, document: dom.window.document };
}

module.exports = loadClient;
