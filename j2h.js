
//j2h-framework for the browser (client)
// requires json2html (2.1.0+), jquery (1.9+), page.js (1.8.5+)

//Namespace
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
        }
    }
};

j2h.Obj = class {
    
    constructor() {}
    
    //Get components associated with the object (Page or Component)
    async getComponents(){
        
        let base = this;
        
        //Initialize the component store
        let _components = {};
        
        if(!base.components) return(_components);
        
        //Itterate over the components for this page
        for(let _name in base.components) {
            
            let _path = base.components[_name];
            
            try {
                //Load the script from the path
                await j2h._load(_path);
            } catch(e) {
                continue;
            }
            
            //Output the component error
            if(!j2h._exports[_path]) {
                console.error("Unable to load component ",_name,_path," (Missing component, did you use j2h.export?)");
                continue;
            }
            
            //Add this component instance
            _components[_name] = new j2h._exports[_path]();
            
            //Get the sub components used by this component
            Object.assign(_components,await _components[_name].getComponents());
        }
        
        return(_components);
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
        
        //Element that we'll render to
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
    async render(req,res,data){
        
        let base = this;
        
        //Get the location we want to render this page
        let $ele = $(base._ele);
        
        //Get the data for this page
        // allow access to request
        if(data === undefined) data = await base.data(req);
        
        //Get the all the components to render this page
        // include sub components as well
        let components = await base.getComponents();
        
        //Get the components as template objects
        let _templates = base.getTemplates(components);
        
        //Add the components to json2html
        json2html.component.add(_templates);
        
        //Render the html with events (ihtml)
        $ele.empty().json2html(data,base.template);
    }
    
    // ============================= Private Methods ==================== 
    
    //Get the templates for these components
    getTemplates(components) {
        
        let out = {};
        
        for(let _component in components)  {
            let component = components[_component];
            
            //Add the components template if we match the client filter criteria
            out[_component] = component.template;
        }
        
        return(out);
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
        
        //TODO change this to a json object
        //this.query = this.url.searchParams;
        
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
        
        //TODO
        // this.cookies
        // this.ip
        // this.secure

        //TODO set the state
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
                    $(function(){
                        //Don't wait up for this to complete
                        //Render the page
                        __route.page.render(req,res);
                    });
                });
                
            })(_route);
        }
        
        //Dispatch the pages
        // only run this after all pages registered
        if(dispatch) base._pagejs();
    }
    
    //Redirect to another page
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
}

//Create a new router for the default app
j2h.app = new j2h.Router();

//Setup the events
j2h._events();

