
//     j2h-framework.js 1.1.1
//     https://www.json2html.com
//     (c) 2006-2024 Crystalline Technologies
//     j2h-framework may be freely distributed under the MIT license.
//     requires json2html (3.1.0+), page.js (1.8.5+)

var j2h = {
    
    //============================ Public ==============================
    
    //Export an object
    "export":function(path,obj){
        this._exports[path] = obj;
    },
    
    //Require an object
    // ASYNC
    "require":async function(path){
        
        let base = this;
        
        //If we have this object already loaded then get it
        if(base._exports[path] !== undefined) return(base._exports[path]);
        
        //Otherwise we'll need to load this object from this path
        // throws error if we can't find this path
        await base._load(path);
        
        return(base._exports[path]);
    },
    
    //Public classes
    //"Page": defined below
    //"Component": defined below
    //"Router": defined below
    
    //============================ Private ==============================
    
    //Exported objects we can reference
    "_exports":{},
    
    //Load script
    // ASYNC
    "_load":function(src) {
      return new Promise(function(resolve, reject) {
        const s = document.createElement('script');
        let r = false;
        s.type = 'text/javascript';
        s.src = src;
        s.async = true;
        s.onerror = function(err) {
          reject(err, s);
        };
        s.onload = s.onreadystatechange = function() {
          if (!r && (!this.readyState || this.readyState == 'complete')) {
            r = true;
            resolve();
          }
        };
        const t = document.getElementsByTagName('script')[0];
        t.parentElement.insertBefore(s, t);
      });
    },
    
    "_pathJoin":function(parts){
       var separator = '/';
       var replace   = new RegExp(separator+'{1,}', 'g');
       return parts.join(separator).replace(replace, separator);
    },
    
    "_events":function(){
        
        //Set the pop state
        window.onpopstate = function(e) {
          page.replace(e.state.path);
        };
    }
};

j2h.Obj = class {
    
    constructor() {}
    
    //Get the components for this object
    // add them to the global json2html components
    async setComponents(){
        
        let base = this;
        
        if(!base.components) return;
        
        //Itterate over the components for this page
        for(let _name in base.components) {
            
            let _path = base.components[_name],
                _component;
            
            //Load the component if we don't already have it
            // in json2html
            if(!json2html.component.get(_name)) {
            
                //Try loading the component using j2h.require
                // this will use cached components
                try {
                    //Load the script from the path
                    await j2h.require(_path);
                } catch(e) {
                    continue;
                }
                
                //Output the component error
                if(!j2h._exports[_path]) {
                    console.error("Unable to load component ",_name,_path,".  Did you use j2h.export?");
                    continue;
                }
                
                //Create a new instance of this component
                _component = new j2h._exports[_path]();
                
                //Add the component template to json2html
                json2html.component.add(_name,_component.template);
                
                //Get the sub components used by this component
                await _component.setComponents();
            }
        }
    }
    
};

j2h.Page = class extends j2h.Obj {
    
    constructor(ele){
        
        super();
        
        // =================== Public Properties ===================== 
        
        //REQUIRED to override
        this.template = {};
        this.components = {};
        
        // =================== Private Properties ===================== 
        
        //Query select OR element
        // if ele is string we'll check for this element every time we render
        // ensures if the element is removed/replaced then we still can find it later
        this._ele = ele;
    }
    
    // ============================= Public Inherited Methods ==================== 
    
    //Pull all the data for this page
    // use request.params & request.query to determine what data to pull
    async data(req) {
        return({});
    }
    
    //Render this page
    // req = {"params"}
    // res = (reconstruct same as express)
    async render(req,res){
        
        let base = this;
        
        //Get the data for this page
        // allow access to request
        let data = await base.data(req);
        
        //Set the components 
        // save them into json2html.components
        await base.setComponents();
        
        //Find the parent
        let parent;
        
        switch(typeof(base._ele)) {
            
            case "string":
                parent = document.querySelector(base._ele);
            break;
            
            default:
                parent = base._ele;
            break;
        }
        
        //Exit if we don't have a valid parent element
        if(!parent) return;
        
        //Clear the element children
        parent.innerHTML = "";
        
        //Render the html with events
        parent.json2html(data,base.template);
    }
};

j2h.Component = class extends j2h.Obj {
    
    constructor(){
        
        super();
        
        // ============================= Public Properties ==================== 
        
        this.template = {};
        this.components = {};
    }
}; 

// Request and Response helper classes

j2h.Request = class {
    
    //Build a request from the page.js context object
    // ctx: save(), handled, canonicalPath (full), path (relative), querystring, pathname, state (obj), title
    // req: url, baseUrl, cookies, hostname, ip, method, originalUrl, params, path, protocol, query, secure, state {page, session, domain}
    constructor(ctx) {
        
        this.url = new URL(window.location);
        
        this.baseUrl = ctx.canonicalPath;
        this.querystring = ctx.querystring;
        this.path = this.url.pathname;
        this.protocol = this.url.protocol;
        this.params = ctx.params;
        
        //Get the query
        this.query = {};
        
        //Get the query
        if( window.location.href.indexOf('?') >= 0 ) {
            let hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
            for(let i = 0; i < hashes.length; i++) {
                let hash = hashes[i].split('=');
                this.query[hash[0]] = hash[1];
            }
        }
        
        //Always get
        this.method = "GET";
    }
    
};

j2h.Response = class {
    
    constructor() {
        
        //Set the redirect
        this.redirect = j2h.app._pagejs.redirect;
    }
};

j2h.Router = class {
    
    constructor(options) {
        
        //Default config
        this._config = {
            "render":{
                "ele":"body"
            }
        };
        
        //Set the config
        Object.assign(this._config, options);
        
        //Use page.js to do routing
        this._pagejs = page;
        
        //Middleware use by this route
        this._middleware = [];
        
        //Routes
        this._routes = [];
        
        //Flag that we're not yet listening
        this._listening = false;
    }
    
    //============================ Public ==============================
    
    page(path,Page) {
        
        let base = this;
        
        //Add the page
        base._routes.push({
            
            //Router path
            "path":path,
            
            //New page
            "page":new Page(base._config.render.ele)
        });
    }
    
    //register middleware and routers
    // ("/",Router) => Router
    // (function(){}) => Middleware
    use(path,method) {
        
        let base = this;
        
        //Check the first parameter
        switch(typeof(path)) {
            
            //Router
            case "string":
                
                let router = method;
                
                //Add this sub router
                if(router instanceof j2h.Router) {
                    
                    //Update the path for each route
                    for(let _route of router._routes) 
                        _route.path = base._pathjoin([path,_route.path]);
                    
                    //Now add the pages for this subrouter
                    // make sure not to dispatch these pages yet
                    router.listen(false);
                }
            break;
            
            //Middleware
            case "function":
                
                //Add to the middleware for this router
                this._middleware.push(path);
            break;
        }
    }
    
    //Start the app server
    listen(dispatch){
        
        let base = this;
        
        if(dispatch === undefined) dispatch = true;
        
        if(base._listening) return;
        
        //Flag so we can't run this multiple times
        base._listening = true;
        
        //Route the pages
        for(let _route of base._routes) {
            
            //Add the element that we'll render too
            _route.page._ele = this._config.render.ele;
            
            //Route the page
            ((__route)=>{
                
                //route to the page using all middle ware
                base._pagejs(__route.path, (ctx,next)=>{
                    
                    //Create a new request & response
                    let req = new j2h.Request(ctx),
                        res = new j2h.Response();
                    
                    //Resolve all middleware
                    base._useAll(req,res,next);
                    
                }, (ctx)=>{
                    
                    //Create a new request & response
                    let req = new j2h.Request(ctx),
                        res = new j2h.Response();
                    
                    //Render the page when  
                    //$(function(){
                        //Don't wait up for this to complete
                        //Render the page
                        __route.page.render(req,res);
                    //});
                });
                
            })(_route);
        }
        
        //Dispatch the pages
        // only run this after all pages registered
        if(dispatch) base._pagejs();
    }
    
    redirect(path) {
        this._pagejs.redirect(path);    
    }
        
    //============================ Private ==============================
    
    //apply all middleware
    _useAll(req,res,next) {
        
        let base = this;
        
        let middleware = [];
        
        //Run all the middleware for this request
        for(let method of base._middleware) {
            
            //Wait until we're done with this middleware
            middleware.push(new Promise((resolve,reject)=>{
                
                //Run the middleware
                method(req,res,resolve);
                
            }));
        }
        
        //Wait until all middleware is complete
        Promise.all(middleware).then(next);
    }
    
    _pathjoin(parts) {
       let separator = '/';
       let replace   = new RegExp(separator+'/{1,}', 'g');
       return parts.join(separator).replace(replace, separator);
    }
};

//Create a new router for the default app
j2h.app = new j2h.Router();

//Setup the events
j2h._events();