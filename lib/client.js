const _ = require("lodash"),
      json2html = require("node-json2html"),
      yserialize = require("serialize-javascript"),
      { minify } = require("terser");

class Client {
    
    constructor() {

        //Parts
        // left undefined (not `{}`) like the others - `{}` is truthy, so
        // js()'s `if(base._components)` guard would otherwise always be true
        // and prepend a stray "[object Object]" to the generated script for
        // any Client that hasn't had components() called on it yet. In the
        // normal hybrid Page.render() flow this was masked because
        // components() is always called once (even with an empty map), but
        // it breaks any standalone/direct use of Client.
        this._components;
        this._hydration;
        this._data;
        this._template;
    }
    
    //Add the components
    async components(components) {

        // Components are only ever serialized ONCE per Page instance (the
        // caller in lib/page.js guards this behind `if(!base._client)`), so
        // spending the time on a full terser minify()/AST pass here is
        // worthwhile - it's a one-time cost, not a per-request one.
        this._components = "json2html.component.add(" + await serializeAndMinify(components) + ");";
    }

    //Add the hydration script
    async hydration(ihtml) {

        let base = this;

        //Return nothing as we don't need to attach events
        // SHIM Used to support BOTH json2html 2.1.0 and 2.2.0 - the older
        // (2.1.0) shape returns ihtml as a plain Array with no separate
        // .events to read, so there's nothing to hydrate regardless of its
        // length. The newer (2.2.0) shape is a {html,events} object, which we
        // only skip when its events map is missing/empty.
        if(Array.isArray(ihtml)) return;
        if(!ihtml.events || !Object.keys(ihtml.events).length) return;

        // hydration() runs on EVERY hybrid-mode request (unlike components(),
        // it isn't cached on the Page instance), so it uses the raw-only
        // fast path instead of paying for a fresh minify() pass every time -
        // see serializeAndMinify() below for why that cost isn't worth it here.
        let serialized = serialize(ihtml.events);

        //Add the hydration object
        base._hydration = '$(function(){$("html").j2hHydrate(' + serialized + ');});';
    }

    //Add the data to the client
    async data(data) {

        let base = this;

        //Return nothing
        if(!data) return;

        // data(), like hydration(), runs on every hybrid-mode request - use
        // the raw-only fast path rather than minifying per-request.
        let serialized = serialize(data);

        //Add the hydration object
        base._data = 'json2html.data=' + serialized + ";";
    }

    //Add the template to the client
    async template(template) {

        let base = this;

        //Return nothing
        if(!template) return;

        //Serialize & minify the event data
        let serialized = await serializeAndMinify(template);

        //Add the hydration object
        base._template = 'json2html.template=' + serialized + ";";
    }
    
    //Get the client js script
    js() {
        
        let base = this;
        
        let result = "";
        
        //Add the component
        if(base._components) result+=base._components;
        
        //Add the hydration script
        if(base._hydration) result+=base._hydration;
        
        //Add the data object
        if(base._data) result+=base._data;
        
        //Add the template object
        if(base._template) result+=base._template;
        
        return(result);
    }
}

//Serialize the json object WITHOUT minifying it. Used by hydration()/data(),
// which both run on every hybrid-mode request - a full terser parse+AST+
// compress+codegen pass on every request is pure per-request overhead for
// output that's already reasonably compact (serialize-javascript's raw
// output), so this path skips minify() entirely.
function serialize(obj) {
    return(yserialize(obj));
}

//Serialize the json object AND minify it. Used only by components() (and
// template(), which is unused by the real render() flow but kept consistent)
// - both are cached once per Page instance, so the one-time minify() cost is
// worth paying to shrink the payload.
async function serializeAndMinify(obj) {

    //Serialize the event data (bare expression, no shim wrapper)
    let raw = yserialize(obj);

    //Add shim (required for minify to work correctly - terser needs a
    // statement, not a bare expression, to minify)
    let serialized = "let a=" + raw;

    //minify the serialized code
    let minified;

    try {

        //minify the serialized code
        minified = (await minify(serialized)).code;

        //remove the shim and last semicolon
        minified = (minified.substring(6)).slice(0,-1);
    } catch(e) {
        console.error("J2H.Client Unable to minify code (" + e.message + ")")
    }

    //On success, use the minified (and shim-stripped) code. If minify
    // failed, fall back to the unminified but still shim-free `raw` value -
    // NOT `serialized`, which still has the "let a=" wrapper attached and
    // would produce invalid JS once the caller concatenates it (e.g.
    // "json2html.data=let a={...};").
    if(minified) return(minified);
    else return(raw);
}

module.exports = Client; 
