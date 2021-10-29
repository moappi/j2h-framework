const _ = require("lodash"),
      json2html = require("node-json2html"),
      yserialize = require("serialize-javascript"),
      { minify } = require("terser");

class Client {
    
    constructor() {
        
        //Parts
        this._components = {};
        this._hydration;
        this._data;
        this._template;
    }
    
    //Add the components
    async components(components) {
        
        //Add the serialized components
        this._components = "json2html.component.add(" + await serialize(components) + ");";
    }
    
    //Add the hydration script
    async hydration(ihtml) {
        
        let base = this;
        
        //Return nothing as we don't need to attach events
        // SHIM Used to support BOTH json2html 2.1.0 and 2.2.0
        if(Array.isArray(ihtml)) if(!ihtml.length) return;
        else if(!Object.keys(ihtml.events).length) return;
        
        //Serialize & minify the event data 
        let serialized = await serialize(ihtml.events);
        
        //Add the hydration object
        base._hydration = '$(function(){$("html").j2hHydrate(' + serialized + ');});';
    }
    
    //Add the data to the client
    async data(data) {
        
        let base = this;
        
        //Return nothing
        if(!data) return;
        
        //Serialize & minify the event data 
        let serialized = await serialize(data);
        
        //Add the hydration object
        base._data = 'json2html.data=' + serialized + ";";
    }
    
    //Add the template to the client
    async template(template) {
        
        let base = this;
        
        //Return nothing
        if(!template) return;
        
        //Serialize & minify the event data 
        let serialized = await serialize(data);
        
        //Add the hydration object
        base._template = 'json2html.template=' + template + ";";
    };
    
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
