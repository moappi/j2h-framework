
const _ = require("lodash");
      
//Internal Classes
const Router = require("./lib/router.js");
      
//Static Classes
const Page = require("./lib/page.js"),
      Component = require("./lib/component.js"),
      Request = require("./lib/request.js");

class J2H {
    
    constructor(app) {
        
        let base = this;
        
        //Create a new j2h router
        base.router = new Router(app);
    }
    
    /* ----------------------- Public Methods ------------------- */
    
    //Add a middleware
    // type = name of middleware to refer back to
    // func(request) and returns object to save for middleware
    use(method) {
        
        let base = this;
        
        //Add a route
        base.router.use(method);
    }
    
    //Add a route
    route(_path,page) {
        
        let base = this;
        
        //Add a route
        base.router.add(_path,page);
    }
    
    //Start the j2h engine and listen to this port
    listen(port) {
        
        let base = this;
        
        //Start the app and listen to this port
        base.router.listen(port);
    }
    
    /* ----------------------- Static Properties ------------------- */
    
    static get Page() {
        return(Page);
    }
    
    static get Component() {
        return(Component);
    }
    
    static get Request() {
        return(Request);
    }
}

module.exports = J2H;