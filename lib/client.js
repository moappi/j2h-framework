const json2html = require("node-json2html"),
      yserialize = require("serialize-javascript"),
      { minify } = require("terser");

class Client {
    
    constructor() {
        
        //Parts
        this.component = {};
        this.hydrate;
    }
    
    //Add the components
    async components(components) {
        
        //Add the serialized components
        this.component = "json2html.component.add(" + await serialize(components) + ");";
    }
    
    //Add the hydration script
    async hydration(ihtml) {
        
        let base = this;
        
        //Return nothing as we don't need to attach events
        if(!ihtml.events) return;
        if(!ihtml.events.length) return;
        
        //Serialize & minify the event data 
        let serialized = await serialize(ihtml.events);
        
        //Add the hydration object
        base.hydrate = '$(function(){$("html").j2hHydrate(' + serialized + ');});';
    }
    
    //Get the client js script
    js() {
        
        let base = this;
        
        let result = "";
        
        //Add the component
        if(base.component) result+=base.component;
        
        //Add the hydration script
        if(base.hydrate) result+=base.hydrate;
        
        return(result);
    }
}

//Serialize the json object
async function serialize(obj) {
    
    //Serialize the event data
    // plus add shim (required for minify to work correctly)
    let serialized = "let a=" + yserialize(obj);
    
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
    
    if(minified) return(minified);
    else return(serialized);
}

module.exports = Client; 
