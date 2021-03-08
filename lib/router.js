const _ = require("lodash");

//Error pages
const error = {
    "404":require("../page/404.js"),
    "503":require("../page/503.js")
};

const Request = require("./request.js");

class Router {
    
    //Router uses the express app
    constructor(app){
        
        //Save the express app
        this.app = app;
        
        //List of all middleware to run on each request
        this.middleware = [];
    }
    
    //Add middleware
    /// MUST be async function
    use(method) {
        this.middleware.push(method);
    }
    
    //Add a route
    add(_path,page) {
        
        let base = this;
        
        //Route this request
        base.app.get(_path,async (req,res)=>{
            
            let _out = {};
            
            //Itterate over the middleware
            for(let middleware of base.middleware) {
                
                //Run the middleware & merge results
                if(typeof(middleware) === "function") {
                    
                    let result = await middleware(req,res);
                    
                    //Merge the result as long as we have an valid JSON object
                    if(typeof(result) === "object" && !Array.isArray(result)) _.merge(_out,result);
                }
            }
            
            //Render the page
            await page.render(req,res,_out);
        });
    }
    
    //Start the router by listening to this port
    listen(port){
        
        let base = this;
        
        //Add a catch all for any routes we didn't specify
        // Note that this can be overridden 
        base.app.get("*",(req, res)=>{
            
            //Create a new request
            let request = new Request({
                "req":req,
                "res":res
            });
            
            //Spit out the 404 error page
            request.error(error["404"].get());
        });
        
        //Listen to this port
        base.app.listen(port);
    }
}

module.exports = Router;