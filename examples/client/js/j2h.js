
//     j2h-framework.js 2.1.0
//     https://www.json2html.com
//     (c) 2006-2026 Crystalline Technologies
//     j2h-framework may be freely distributed under the MIT license.
//     requires json2html (3.1.0+), page.js (1.8.5+)

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.j2h = factory());
}(this, (function () { 'use strict';
    
    let j2h = {
        
        //============================ Public ==============================
        
        //Module instance
        // used for exporting and importing Pages and Components
        "module":undefined,
        
        //Alias functions to Module class functions
        //  export(path,obj) = async j2h.Module.export
        //  require(path) = async j2h.Module.import
        //  import(path) = async j2h.Module.import
        
        //Helper for json2html.refresh
        "refresh":function(id){
            json2html.trigger(id);
        }
    };
    
    //Modified implementation of lodash
    // includes get() and set()
    let lodash = {
        
        "_regex":{
            "reEscapeChar":/\\(\\)?/g,
            "rePropName":/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
            "reIsDeepProp":/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
            "reIsPlainProp":/^\w*$/,
            "reIsUint":/^(?:0|[1-9]\d*)$/
        },
        
        "INFINITY": 1 / 0,
        "MAX_SAFE_INTEGER":9007199254740991,
        
        //============================ Public ==============================
        
        "get":function(object,path) {
            
            let base = this;
            
            path  = base._castPath(path, object);
            
            let index = 0,
                length = path.length;
              
            while (object != null && index < length) 
                object = object[base._toKey(path[index++])];
            
            return( (index && index == length) ? object : undefined );
        },
        
        //Returns the all 
        "set":function(object, path, value) {
            
            let base = this;
            
            if (!base._isObject(object)) return object;
            
            path = base._castPath(path, object);
            
            let index = -1,
              length = path.length,
              lastIndex = length - 1,
              nested = object;
            
            while (nested != null && ++index < length) {
                let key = base._toKey(path[index]),
                    newValue = value;
                
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') return object;
            
                if (index != lastIndex) {
                    let objValue = nested[key];
                    newValue = base._isObject(objValue)
                      ? objValue
                      : (base._isIndex(path[index + 1]) ? [] : {});
                  
                }
                
                base._assignValue(nested, key, newValue);
                nested = nested[key];
            }
            
            //Get all paths (recusive) that have changed
            let updated = [];
            
            //Itterate over path 
            for(let i=1; i <= path.length; i++)
                updated.push(path.slice(0,i).join("."));
            
            //Return list of all paths that we updated
            // this will be a recursive list
            return(updated);
        },
        
        //============================ Private ==============================
        
        //from LODASH
        "_castPath":function(value, object) {
            let base = this;
            
            if (Array.isArray(value)) return value;
            return(base._isKey(value, object) ? [value] : base._stringToPath(base._toString(value)));
        },
        
        //from LODASH
        "_stringToPath":function(string) {
            let base = this;
            
            let result = [];
            if (string.charCodeAt(0) === 46 /* . */) result.push('');
            
            string.replace(base._regex.rePropName, function(match, number, quote, subString) {
                result.push(quote ? subString.replace(base._regex.reEscapeChar, '$1') : (number || match));
            });
            
            return(result);
        },
        
        //from LODASH
        "_toKey":function(value) {
            let base = this;
            
            if (typeof value == 'string') return value;
            
            let result = (value + '');
            return (result == '0' && (1 / value) == -base.INFINITY) ? '-0' : result;
        },
        
        //from LODASH
        "_isKey":function(value, object) {
            let base = this;
            
            if (Array.isArray(value)) return false;
            
            let type = typeof value;
            if (type == 'number' || type == 'boolean' || value == null) return true;
            
            return( base._regex.reIsPlainProp.test(value) || !base._regex.reIsDeepProp.test(value) || (object != null && value in Object(object)) );
        },
        
        //from LODASH
        "_toString":function(value) {
            let base = this;
            return value == null ? '' : base._baseToString(value);
        },
        
        //from LODASH
        "_baseToString":function(value) {
            
            let base = this;
            // Exit early for strings to avoid a performance hit in some environments.
            if (typeof value == 'string') return value;
            
            if (isArray(value)) return value.join('') + '';
            
            let result = (value + '');
            return (result == '0' && (1 / value) == -base.INFINITY) ? '-0' : result;
        },
        
        //from LODASH
        "_isObject":function(value) {
            let type = typeof value;
            return value != null && (type == 'object' || type == 'function');
        },
        
        //from LODASH
        "_isIndex":function(value, length) {
            
            let base = this;
            
            let type = typeof value;
            length = length == null ? base.MAX_SAFE_INTEGER : length;
            
            return !!length &&
            (type == 'number' ||
              (type != 'symbol' && base._regex.reIsUint.test(value))) &&
                (value > -1 && value % 1 == 0 && value < length);
        },
        
        //from LODASH
        "_assignValue":function(object, key, value) {
            let base = this;
            
            let objValue = object[key];
            if (!(Object.prototype.hasOwnProperty.call(object, key) && base._eq(objValue, value)) || (value === undefined && !(key in object))) {
                base._baseAssignValue(object, key, value);
            }
        },
        
        //from LODASH
        "_baseAssignValue":function(object, key, value) {
            object[key] = value;
        },
        
        //from LODASH
        "_eq":function(value, other) {
            return value === other || (value !== value && other !== other);
        }
    };
    
    //============================ Public Classes ==============================
    
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
                
                    //Try loading a component
                    // this will use cached components
                    try {
                        //Load the script from the path
                        await j2h.module.import(_path);
                    } catch(e) {
                        continue;
                    }
                    
                    //Check to see if we have this component loaded
                    if(typeof(j2h.module.get(_path)) !== "function") {
                        console.error("Unable to load component ",_name,"(",_path,").  Did you use j2h.export?");
                        continue;
                    }
                    
                    //Create a new instance of this component
                    _component = new j2h.module._exports[_path]();
                    
                    //Add the component template to json2html
                    json2html.component.add(_name,_component.template);
                    
                    //Get the sub components used by this component
                    await _component.setComponents();
                }
            }
        }
        
    };
    
    j2h.Page = class extends j2h.Obj {
        
        constructor(){
            
            super();
            
            // =================== Public Properties ===================== 
            
            //REQUIRED to override
            this.template = {};
            this.components = {};
            
            // =================== Private Properties ===================== 
            
            //Query select OR element
            // if ele is string we'll check for this element every time we render
            // ensures if the element is removed/replaced then we still can find it later
            this._ele = undefined;
            
            //Loading component (optional)
            this._loading = undefined;
        }
        
        // ============================= Public Inherited Methods ==================== 
        
        //Pull all the data for this page
        // use request.params & request.query to determine what data to pull
        async data(req,state) {
            return({});
        }
        
        //Render this page
        // req = {"params"}
        // res = (reconstruct same as express)
        async render(req,res){
            
            let base = this;
            
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
            
            //Render the loading component (if we have one)
            if(base._loading) {

                //Get the type of loading this is
                switch(typeof(base._loading)) {
                    
                    //HTML string
                    case "string":
                        parent.innerHTML = base._loading;
                    break;

                    //JSON2HTML template
                    case "object":
                        parent.innerHTML = "";
                        parent.json2html({},base._loading);
                    break;
                }
            }
            
            //Get the data for this page
            // allow access to request
            let data = await base.data(req,j2h.app.state);
            
            let obj = data;
            
            //If we're using the state
            // make sure to clean any stale states we might have
            if(j2h.app.state) j2h.app.state._clean(req.pathname);
            
            //Set the components 
            // save them into json2html.components
            await base.setComponents();
            
            //Clear the element children
            // gets rid of loading stuff
            parent.innerHTML = "";
            
            //Render the html with events
            parent.json2html(obj,base.template);
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
    
    j2h.Request = class {
        
        //Build a request from the page.js context object
        // ctx: save(), handled, canonicalPath (full), path (relative), querystring, pathname, state (obj), title
        // req: url, baseUrl, cookies, hostname, ip, method, originalUrl, params, path, protocol, query, secure, state {page, session, domain}
        constructor(ctx) {
            
            //Get the url information 
            this.baseUrl = ctx.path;
            this.querystring = ctx.querystring;
            this.hash = ctx.hash;
            this.protocol = new URL(window.location).protocol;
            this.params = ctx.params;
            this.routePath = ctx.routePath;
            
            //Make sure to sanitize the path as pagejs includes the entire search and has in the pathname
            this.pathname = ctx.pathname.split(/[?#]/)[0];
            
            //Get the query
            this.query = {};
            
            //Get the query
            if( this.querystring ) {
                let hashes = this.querystring.split('&');
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
            
            //Create a new id for this router
            this._id = _id();
            
            if(!options) options = {};
            
            //Default config
            this.config = {
                
                //Render
                "render":{
                    
                    //HTML query string OR HTML Element
                    "ele":"body"
                },
                
                //Perform preloading for this route
                // this should be an array of j2h pages (in order)
                // which need to be pre-loaded first before rending this page
                // only when the app is first loaded
                "preload":undefined,
                
                //Loading HTML (string)
                // or json2html template
                "loading":undefined
            };
            
            //Set the config
            Object.assign(this.config, options);
            
            //Use page.js to do routing
            this._pagejs = page;
            
            //Middleware used by this route
            this._middleware = [];
            
            //Routes
            this._routes = [];
        }
        
        //============================ Public ==============================
        
        //Route this page
        page(path,Page,opts) {
            
            let base = this;
            
            //By default set this route to preload
            let _opts = {
                "preload":true
            };
            
            if(!opts) opts = {};
            
            //Assign the options
            Object.assign(_opts, opts);
            
            //Add the page
            base._routes.push({
                
                //Router path
                "path":path,
                
                //New page
                "page":new Page(base.config),
                
                //Preload this page
                "opts":_opts
            });
            
            //For chaining
            return(base);
        }
        
        //Determine if this path has a route on this router
        // path (string) : path to check if we have a route for
        // preload (boolean) : only check preloading routes
        // returns route (or undefined)
        has(path,preload) {
            
            let base = this;
            
            //Route the pages
            for(let _route of base._routes) {
                
                //Don't check pages we don't want to preload
                // if we're only looking for preload pages
                if(preload && !_route.opts.preload) continue;
                
                //Build a temporary route and see if this path matches
                if( (new page.Route(_route.path)).matches(path) ) return(_route);
            }
          
          return;
        }
        
        //============================ Private ==============================
        
        //Register the routes that this rounter is going to use with pagejs
        _register(){
            
            let base = this;
            
            //Register the routes with pagejs
            for(let _route of base._routes) {
                
                //Skip if this is a router
                // ONLY for the app so we can maintain the heirarchy
                if(_route instanceof j2h.Router) continue;
                
                //Add the element that we'll rendering on
                _route.page._ele = base.config.render.ele;
                
                //Add the loading component
                if(base.config.loading) _route.page._loading = base.config.loading;
                
                //Route the page
                ((__route)=>{

                    //route to the page using all middleware
                    base._pagejs(__route.path,(ctx,next)=>{

                        //Apply the middleware
                        base._apply(ctx,next);
                            
                    },(ctx,next)=>{
                        
                        //Preload pages
                        
                        //Exit if we don't require preloading
                        // check if the app is configured for preloading
                        // AND the route is configured for preloading
                        if(!j2h.app.config.preload || __route.opts.preload === false) return next();
                        
                        //Get all the routes that we need to preload
                        // this will compare the previous page (if we have one)
                        // to the current page and mine out all paths we need to preload
                        // in order to build the current page
                        let missing = j2h.app._getPreloadRoutes(ctx);

                        //If we're not missing any routes then continue loading this page
                        if(!missing.length) return next();
                        
                        //Preload the missing routes
                        // once ready then continue loading this page
                        base._preload(missing,ctx).then(next);
                        
                    }, (ctx)=>{
                        
                        //Render the route using the context
                        base._render(__route,ctx);
                    });
                    
                    //Route all exits for pages to help save the previous pages context
                    base._pagejs.exit(__route.path,(ctx,next)=>{
                        
                        //Set the previous context if we're using preloading
                        if(j2h.app.config.preload && __route.opts.preload !== false) j2h.app._prev = ctx;
                        
                        next();
                    });
                    
                })(_route);
            }
        }
        
        //Apply all middleware
        // middleware is only allowed for main router
        _apply(ctx,next) {
            
            let base = this;
            
            //Create a new request & response
            let req = new j2h.Request(ctx),
                res = new j2h.Response();
            
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
        
        //Render a page
        // only called for end pages (NOT for preloaded pages)
        async _render(route,ctx) {
            
            let base = this;
            
            //Render the page and wait until loaded
            await route.page.render(new j2h.Request(ctx),new j2h.Response());
            
            //Trigger the page rendered event
            j2h.app.events.trigger("onpageload",ctx);
            
            //Check to see if we want to redirect to another route
            // NOTE this could include variables that need to be resolved
            if(route.opts.default) j2h.app.redirect(_resolvePath(ctx.pathname,route.opts.default));
        }
        
        //Render preload missing pages
        async _preload(missing,ctx) {
            
            let base = this;
            
            //Register events to facilitate the pre-loading
            for(let pg of missing) {
                
                //Create a new context 
                // based on the missing pathname
                let _ctx = base._newContext(ctx,pg.pathname);

                //Render the page and wait until we're done
                await pg.route.page.render(new j2h.Request(_ctx), new j2h.Response());
            }
        }
        
        //Build path
        _buildPath(pathname,search,hash) {
            
            if(!search) search = window.location.search;
            if(!hash) hash = window.location.hash;
            
            //Sanitize the search
            if(search === '?' || !search.length) search = '';
            else 
                if(search[0] !== "?") search = "?" + search;
            
            //Sanitize the hash
            if(hash === '#' || !hash.length) hash = '';
            else
                if(hash[0] !== "#") hash = "#" + hash;
            
            return(pathname + search + hash);
        }
        
        //Create a shallow copy of the context
        // and set it as if we've loaded from this pathname
        // NEEDS to be part of the same route
        _newContext(ctx,pathname) {
            
            let base = this;
            
            //Get the size of the pathname
            
            let _ctx = Object.assign({}, ctx, {
                "canonicalPath":pathname,
                "path":base._buildPath(pathname,ctx.querystring,ctx.hash),
                "pathname":pathname
            });
            
            //Set the route path
            // assume that this is part of the same route
            let parts = pathname.split("/");
            
            //Recreate the route path based on the size of the pathname
            _ctx.routePath = "/";
            
            if(parts.length-1 > 0) _ctx.routePath += ctx.routePath.split("/").slice(1,parts.length).join("/");
             
            return( _ctx );
        }
        
    };
    
    j2h.State = class {
        
        constructor() {
            
            //============================ Public ==============================
            
            //Entire state
            this.all = {};
            
            //============================ Private ==============================
            
            //State path dependancies 
            // top level state properties associated with this pathname
            this._dependancies = {
                // "/app":["users"]
            };
            
            //Paths we're subscribed to along with array of callbacks
            // {"pathname":[function(){},..]
            // eg {"obj.var":[function(){}..]
            this._subscribed = {};
        }
        
        //============================ Public ==============================
        
        //Attach this part of the state to this request path (page)
        // this will clean this part of the state when this path has been unloaded
        attach(path,req) {
            
            let base = this;
            
            let pathname = req.pathname;
            
            //Remove any tailing "/" from the pathnames
            if(pathname[pathname.length-1] === "/") pathname = pathname.substring(0, pathname.length - 1);
            
            //Will overwrite the pathname with the state
            // if we already have it
            if(!base._dependancies[pathname]) base._dependancies[pathname] = [];
            base._dependancies[pathname].push(path);
        }
        
        //Get the state 
        // path (string,array) : OPTIONAL path, can be an array or string (eg 'obj.var' or ['obj','var'])
        // returns : state value at this path OR if path not specified the entire state (all)
        get(path) {
            
            let base = this;
            
            if(!path) return(base.all);
            
            //Otherwise get part of the state we want
            return( lodash.get(base.all,path) );
        }
        
        //Set the state
        // path (string, array) : REQUIRED path of the variable to modify within the state (eg 'obj.var' or ['obj','var'])
        // value (any object) 
        // returns : state
        set(path, value, req) {
            
            let base = this;
            
            //Attach this path to be cleaned whenever this page has been unloaded
            if(req) base.attach(path,req);
            
            //Get the paths that were updated
            // this is a full tree traversal
            let updated = lodash.set(base.all,path,value);
            
            //Reverse the array 
            // we want to start with the lowest part of the tree first
            updated = updated.reverse();
            
            //Check each path that was updated
            // and perform the 
            for(let _updated of updated) 
                base._callSubscriptions(_updated,path,value);
            
            //For chaining
            return(base);
        }
        
        //Subscribe to changes to this path
        // note callbacks will be triggered for any sub objects changed witin this part of the state
        // eg if you subscribe to "app" then any sub objects within "app", like "app.sub" will also trigger this callback
        // path (string,array) : REQUIRED path within the state we want to subscribe to for changes, can be an array or string (eg 'obj.var' or ['obj','var'])
        // callback (function) : REQUIRED callback function that we want to run whenever this part of the state changes
        subscribe(path,callback) {
            
            let base = this;
            
            if(Array.isArray(path)) path = path.join(".");
            
            //Initalize the subscriptions for this path
            if(base._subscribed[path] === undefined) base._subscribed[path] = [];
            
            //Add the callback
            base._subscribed[path].push(callback);
            
            //For chaining
            return(base);
        }
        
        //============================ Private ==============================
        
        //Call subscriptions for each callback associated with this path
        _callSubscriptions(path,originalPath,value) {
            
            let base = this;
            
            let callbacks = base._subscribed[path];
            
            //Itterate over the callbacks
            if(Array.isArray(callbacks)) {
                
                //Run each callback
                for(let callback of callbacks)
                    if(typeof(callback) === "function") callback(originalPath,value);
            }
        }
        
        //Clean the state using this pathname as a reference
        // removes all dependancies where the pathname is now invalid
        _clean(pathname) {
            
            let base = this;
            
            //Check the pathname to see if we have 
            let _pathname = pathname.split("/");
            
            //Remove the last / from the path
            if(!_pathname[_pathname.length-1].length) _pathname.shift();
            
            //Root is always valid
            let valid = [];
            
            //Itterate over all the states and generate a list of all paths
            for(let i=0; i < _pathname.length; i++)
                valid.push( _pathname.slice(0,i+1).join("/"));
            
            //Replace the first valid path with "/"
            valid[0] = "/";
            
            //Fitler out all path names that don't match this sub path
            // then remove those dependancies (keys) from the state
            Object.keys(base._dependancies)
              .filter(pname=>(valid.indexOf(pname) < 0))
              .map(pname=>{
                   
                  //Remove all keys that this pathname depended on
                  base._dependancies[pname].map(key=>delete base.all[key]);
                  
                  //Finally remove the dependancy
                  delete base._dependancies[pname];
               });
        }
    };
    
    j2h.Events = class {
        
        constructor() {
            
            //============================ Private ==============================
            
            //All events
            this._events = {};
        }
        
        //============================ Public ==============================
        
        register(name,callback) {
            
            let base = this;
            
            //Create a new event id
            let id = _id();
            
            //Register the event name
            if(!base._events[name]) base._events[name] = {};
            
            //Set the callback events
            base._events[name][id] = callback;
        }
            
        remove(name,id) {
            
            let base = this;
            
            if(!base._events[name]) return;
            
            delete base._events[name][id];
        }
            
        trigger(name,ctx) {
            
            let base = this;
            
            //Trigger the events
            for(let id in base._events[name]) {
                let event = base._events[name][id];
                if(typeof(event) === "function") event.call(base,{"id":id,"ctx":ctx});
            }
        }
        
        //============================ Private ==============================
            
        _createId(){
            return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
                (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
            );
        }
    };
    
    //============================ Private Classes ==============================
    
    j2h.Module = class {
        
        constructor() {
            
            //============================ Private ==============================
            
            //Exported objects we can reference
            this._exports = {};
        }
        
        //Export a Page / Component
        // path (string) : absolute path to this object eg '/app/page/home.js'
        // obj (Page or Component) : component and page
        export(path,obj){
            this._exports[path] = obj;
        }
        
        //Get Page / Component by path
        get(path) {
            return(this._exports[path]);
        }
        
        //Import an exported object (Page or Component)
        // needs to be a page or component 
        async import(path){
            
            let base = this;
            
            //If we have this object already loaded then get it
            if(base._exports[path] !== undefined) return(base._exports[path]);
            
            //Otherwise we'll need to load this object from the path
            // throws error if we can't find the path
            await base.load(path);
            
            return(base._exports[path]);
        }
        
        //Load script
        async load(src) {
          return new Promise((resolve, reject)=>{
            const s = document.createElement('script');
            let r = false;
            s.type = 'text/javascript';
            s.src = src;
            s.async = true;
            s.onerror = (err)=>reject(err, s);
            s.onload = s.onreadystatechange = ()=>{
              if (!r && (!this.readyState || this.readyState == 'complete')) {
                r = true;
                resolve();
              }
            };
            const t = document.getElementsByTagName('script')[0];
            t.parentElement.insertBefore(s, t);
          });
        }
    };
    
    j2h.App = class extends j2h.Router {
        
        constructor(options) {
            
            super(options);
            
            //============================ Public ==============================
            
            //Create a new j2h State controller
            this.state = new j2h.State();
            
            //Create a new j2h Event controller
            this.events = new j2h.Events();
            
            //============================ Private ==============================
            
            //Flag if we're listening for requests
            this._listening = false;
            
            //All sub routers
            this._routers = [];
            
            //Previous context
            // (if we have one)
            this._prev;
        }
        
        //============================ Public ==============================
        
        //Configure options for this app
        // preload : true/false (use page preloading)
        configure(opts) {
            
            let base = this;
            
            if(opts.preload) base.config.preload = true;
        }
        
        //Register middleware and router
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
                        
                        //Add the router to the _routes for the app
                        // this will allow us to have a complete list of  
                        // all routes and routers in the correct order
                        base._routes.push(router);
                        
                        //Add the router to the list of sub routers for this app
                        base._routers.push(router);
                        
                        //Update the path for each route
                        for(let _route of router._routes) 
                            _route.path = base._pathjoin([path,_route.path]);
                        
                        //Register all the routes
                        router._register();
                    }
                    
                break;
                
                //Middleware
                case "function":
                    
                    //Add to the middleware for this router
                    this._middleware.push(path);
                break;
            }
        }
        
        //Redirect to this path
        redirect(path) {
            this._pagejs.redirect(path);    
        }
        
        //Determine if this path has a route on this app
        // returns router that this route can be found on
        has(path,preload) {
            
            let base = this;
            
            //Check all routes
            for(let _route of base._routes) {
                
                //If this is a router
                // then check to see if that router will route this route
                if(_route instanceof j2h.Router) {
                    
                    //This is a router 
                    // not a route
                    let router = _route;
                    
                    //Get the route (if this router has it)
                    let found = router.has(path,preload);
                    
                    if(found) return(found);
                    else continue;
                }
                
                //Don't check pages we don't want to preload
                // if we're only looking for preload pages
                if(preload && !_route.opts.preload) continue;
                
                //Otherwise check to see if we match this route
                if( (new page.Route(_route.path)).matches(path) ) return(_route);
            }
            
            return;
        }
        
        //Start listening
        // call after all routes have been added
        async listen(){
            
            let base = this;
            
            //Exit if we're already listening
            if(base._listening) return;
            
            //Flag so we can't run this multiple times
            base._listening = true;
            
            //Register the main router routes
            base._register();
            
            return base._pagejs();
        }
        
        //============================ Private ==============================
        
        //Join path together by parts
        _pathjoin(parts) {
           let separator = '/';
           let replace   = new RegExp(separator+'/{1,}', 'g');
           return parts.join(separator).replace(replace, separator);
        }
        
        //Resolve the paths with variable names using source path
        //TODO this should be done to include other regex terms NOT just comparing path lengths
        _resolvePaths(paths,source) {
            
            let _source = source.split("/"),
                out = [];
                
            //If the path that we're checking is smaller than the source 
            // then grab only that part of the source        
            for(let path of paths) {
                let _path = path.split("/");
                if(_path.length < _source.length) out.push(_source.slice(0, _path.length).join("/"));
            }
            
            return(out);
        }
        
        //Sets the state of all routers associated with this app
        // using the pathname of the page that we're looking to load
        //returns [{"route":..,"pathname":..}] which need to be preloaded (in order)
        _getPreloadRoutes(ctx){
            
            let base = this;
            
            //Split the path name into parts
            let _current = _constructPaths(ctx.pathname);
                            
            let _prev=[];
            
            //Set the previous path if we have one
            if(base._prev) _prev = _constructPaths(base._prev.pathname);
            
            //Get the paths that we need to preload
            // as well as the paths that are already preloaded
            let preload = [];
                
            //Check to see if we have a previous page
            // if not then set all the current pages to be pre-loaded
            // otherwise find the pages that we've already preloaded and ommit those
            if(!_prev.length) preload = _current;
            else {
                
                //Itterate over the current paths
                for(let i=0; i < _current.length; i++) {
                    
                    //If our previous path is shorter
                    // then we need to preload this path
                    if(i >= _prev.length) preload.push(_current[i]);
                    else {
                    
                        //Check to see if these paths match
                        // if not then we need to preload it
                        if(_current[i] !== _prev[i]) preload.push(_current[i]);
                    }
                }
            } 
            
            let valid = [];
            
            //Filter out any paths that aren't valid
            // ie that we don't have a route for them
            for(let path of preload){
                
                //Get the route that contains this path
                let route = base.has(path,true);
                
                //Add the router 
                if(route) valid.push({
                    "route":route,
                    "pathname":path
                });
            }
            
            //Remove the current page
            // as that one isn't missing
            valid.pop();
            
            //Return the valid paths we need to preload (in order)
            return(valid);
        }
    };
    
    //============================ Initialize ==============================
    
    //SHIM for pagejs
    // provides a pathMatch for matching this path to the route
    page.Route.prototype.matches = function(path) {
        let qsIndex = path.indexOf('?'),
            pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
        
        m = this.regexp.exec(decodeURIComponent(pathname));
    
        if(!m) return false;
        else return true;
    };
    
    //Create a new Module instance
    j2h.module = new j2h.Module();
    
    //Set the alias functions to require
    j2h.export = (path,obj)=>j2h.module.export.call(j2h.module,path,obj);
    j2h.import = j2h.require = (path)=>j2h.module.import.call(j2h.module,path);
    
    //Create a new App instance
    j2h.app = new j2h.App({
        "render":{
            "ele":"body"
        }
    });
    
    //============================ Helpers ==============================
    //Get a new random id 
	function _id() {
		return (_random()+_random());
	}
	
	//Random string (4 characters)
	function _random() {
	   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
	}
	
	//Construct all paths that lead to this pathname
	// eg /app/user/chad returns array ['/','/app','/app/user','app/user/chad']
	function _constructPaths(pathname){
	    
        let paths = [];
        
        //Split into parts
        // filter out ones that are empty (leading and tailing /)
        let parts = pathname.split(/[?#]/)[0]
                        .split("/")
                        .filter(o=>o.length);
        
        let _path = ["/"];
        
        //Itterate over parts 
        for(let i=1; i <= parts.length; i++)
            paths.push("/" + parts.slice(0,i).join("/"));
        
        return(paths);
	}
	
	//Resolve base + url
	// allows for a relative path like "test" to append to base path like "/something"
	// resulting in /something/test 
    function _resolvePath(base,url) {
        
        //Exit if we have an abolute path or explict relative path
        if(url[0] === "/" || url[0] === ".") return( (new URL(url,"https://a" + base)).pathname );
            
        //Otherwise we'll create a new absolute path by joining them together
        
        //Join together directly as we already have the folder 
        if(base[base.length-1] === "/") return(base + url);
        
        //Otherwise join with a /
        return([base,url].join("/"));
    }

    return(j2h);

})));
   