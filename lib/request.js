
const url = require("url"),
    querystring = require("querystring");

class Request {
    
    constructor(options){
        
        //Request, response, proxy
        this.req = options.req;
        this.res = options.res;
        
        //Have we already sent out response
        this.sent = false;
        
        /* ----------------------- REQUEST --------------------- */
        
        //Set the params
        this.params = this.req.params;
        
        //Set the query
        this.query = this.req.query;
        
        //Set the default headers
        this.default = {
            "headers":{
                "html":{"Content-Type": "text/html"},
                "json":{"Content-Type": "application/json"}
            }
        };    
    }
    
    /* ----------------------- REQUEST --------------------- */
    // Most of these come from this.req directly
    
    
    /* ----------------------- RESPONSE --------------------- */
    
    //Is the response valid (ie have we already sent one yet??)
    valid(){
        return(!this.sent);  
    }
    
    //Send an error http request 404
    error(obj,internal){
        
        //Log the internal error
        if(internal) console.error(internal);
        
        //Send the response as a 404
        this.send(obj,404);
    }
    
    //Send a successfull http request 200
    success(obj){
        
        //Send the response as a 200
        this.send(obj,200);
    }
    
    //Set the request
    send(obj,status){
        
        let out,
            headers = {};

        //Make sure we have a valid response before trying to send anything
        if(!this.valid()) return;
        
        //Determine what we need to render
        switch(typeof obj) {
            
            //DEFAULT to html output
            case "string":
                
                //Set the headers
                headers = this.default.headers.html;
                
                //Set the output object
                out = obj || "";
            break;
            
            //Otherwise this could be html or json
            case "object":
                
                //Check to see if we have a json object
                if(obj.json) {
                    
                    //Get the json object
                    out = obj.json || {};
                    
                    try {
                        out = JSON.stringify(obj.json);
                    } catch(e) {
                        out = "{}";
                    }
                    
                    //Set the headers
                    headers = this.default.headers.json;    
                }
                
                //Check to see if we have a json object
                if(obj.html) {
                    
                    //Get the json object
                    out = obj.html || "";
                    
                    //Set the headers
                    headers = this.default.headers.html;  
                }
                
                //Add the custom headers
                if(obj.headers)
                    for(let prop in obj.headers)
                        headers[prop] = obj.headers[prop];
            break;
            
            default:
            break;
        }

        //Set the status code
        this.res.statusCode = this.statusCode || status;
        
        //Set the headers
        this.headers(headers);
        
        //Set the response
        this.res.end(out);
        
        //Make that this response is already sent
        this.sent = true;
    }
    
    //Rediret the response to url
    redirect(_url){
    
        //Make sure we have a valid response before trying to send anything
        if(!this.valid()) return;
        
        this.res.statusCode = 302;
        this.res.setHeader('Location',_url);
        this.res.end();
        
        //Make that this response is already sent
        this.sent = true;
    }
    
    //Refresh the request
    // rebuilds the request and adds new query parameters
    refresh(){
        
        let _url = url.parse(this.req.url).pathname;
        
        //Get the query parameters
        let queryp = querystring.stringify(this.query);
        
        //Add the query parameter if we have any
        if(queryp) _url += "?" + queryp;
        
        //Redirect to the url
        this.redirect(_url);
    }
    
    //Set a header
    header(name,val){
    
        //Make sure we have a valid response before trying to send anything
        if(!this.valid()) return;
        
        this.res.setHeader(name,val);
    }
    
    //Set all headers
    headers(headers){
        //Apply all the headers
        for(let header in headers)
            this.header(header,headers[header]);
    }
    
    //Set the response cookie
    cookie(name,data,options) {
    
        //Make sure we have a valid response before trying to send anything
        if(!this.valid()) return;
    
        this.res.cookie(name,data,options);
    }
    
    //Set the status 
    status(val) {
        this.statusCode = val;
    }
}

module.exports = Request;