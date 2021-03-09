
module.exports = {
    "Page": require("./lib/page.js"),
    "Component": require("./lib/component.js"),
    "Request": require("./lib/request.js"),
    "HTTPError": require("./lib/httpError.js"),
    
    //Express helper functions
    "express":{
        
        //Extend express with a app.page or route.page function
        "page":function(_path,page){
            
            //Get using async
            this.get(_path,async (res,req,next)=>{
                try {
                    await page.render(res,req,next);
                } catch(e) {
                    next(e);
                }
            });
            
        }
    }
};