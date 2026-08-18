/**
 * Minimal test double for the browser build of json2html (the "json2html"
 * global + its `Element.prototype.json2html` / `$.fn.json2html` rendering
 * plugin) that j2h.js's Page.render() calls into.
 *
 * We deliberately do NOT try to reimplement json2html's real template
 * rendering engine here - that's a separate, well-tested project. This
 * double only needs to let us assert that j2h.Page/j2h.Obj call the right
 * json2html APIs, with the right arguments, at the right time (e.g. "loading"
 * html shown before data resolves, "component.add" called for client
 * components, render skipped when a newer render superseded this one).
 */
"use strict";

function createMockJson2html(ElementCtor) {
    let componentStore = {};
    let triggered = [];

    let json2html = {
        component: {
            add(name, template) {
                componentStore[name] = template;
            },
            get(name) {
                return componentStore[name];
            },
            _store: componentStore
        },
        toText: {
        },
        trigger(id) {
            triggered.push(id);
        },
        _triggered: triggered
    };

    // json2html's browser build extends Element.prototype directly (in
    // addition to the jQuery plugin) so j2h can call `parent.json2html(...)`
    // on a raw DOM node returned by document.querySelector().
    ElementCtor.prototype.json2html = function (data, template, options) {
        this.__j2hRenderCalls = this.__j2hRenderCalls || [];
        this.__j2hRenderCalls.push({ data, template, options });

        // Fake-render something deterministic & inspectable
        let marker = document.createElement("div");
        marker.setAttribute("data-j2h-mock-rendered", "true");
        marker.setAttribute("data-j2h-mock-call", String(this.__j2hRenderCalls.length));
        this.appendChild(marker);

        return this;
    };

    return json2html;
}

module.exports = createMockJson2html;
