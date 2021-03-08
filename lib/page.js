const json2html = require("node-json2html");

const Client = require("./client.js"),
      Component = require("./component.js"),
      Request = require("./request.js");

//Error pages
const error = {
    "404":require("../page/404.js"),
    "503":require("../page/503.js")
};

class Page {
    
    constructor(type){
        
        // =================== Public Properties ===================== 
        
        //Default page type
        this.type = type;
        
        //REQUIRED to override
        this.template = {};
        this.components = {};
        
        // =================== Private Properties ===================== 
        
        //All components
        this._components;
    }
    
    // ============================= Public Inherited Methods ==================== 
    
    //Pull all the data for this page
    // use request.params & request.query to determine what data to pull
    async data(req,middleware) {
        return({});
    }
    
    //How this page should be rendered
    async render(req,res,middleware){
        
        let base = this;
        
        let data;
        
        //Create a new request object
        let request = new Request({
            "req":req,
            "res":res,
            "middleware":middleware
        });
        
        //Try getting the data
        try {
            //Get the data for this page
            // allow access to request
            data = await base.data(req,middleware);
        } catch(e) {
            
            //Spit out a 503 (server error)
            return request.error(error["503"].get(),"J2H.PAGE Page.data error '" + req.url + "' (" + e.message + ")");
        }
        
        //Get the all the components 
        // if we don't have them then this will cache for us
        let components = base.getComponents();
        
        //Get the components as template objects
        let templates = Component.templates(components);
        
        //Determine what type of page we're using
        switch(base.type) {
            
            case "server":
                
                //Render the html without events
                let html = json2html.render(data,base.template,{"components":templates});
                
                //Send the page
                request.success({
                    "html":"<!DOCTYPE html>" + html,
                    "headers":{
                        "Content-Type":"text/html"
                    }
                });
            break;
            
            case "hybrid":
                
                //Render the html with events (ihtml)
                let ihtml = json2html.render(data,base.template,{"components":templates,"output":"ihtml"});
                
                //Check to see if we have a client for this page
                // allows us to cache clients for each page
                if(!base.client) {
                
                    //Create a new Client
                    base.client = new Client();
                    
                    //Get the templates for this object
                    // filter for client ONLY
                    let ctemplates = Component.templates(components,true);
                    
                    //Add the components to the client
                    // allows for j2h.component
                    await base.client.components(ctemplates);
                }
                
                //Add the hydration script
                // uses the events from the ihtml object
                await base.client.hydration(ihtml);
                
                //Get the js script and add it to the ihtml
                ihtml.appendHTML(json2html.render({"js":base.client.js()},{"<>":"script","html":"${js}"}));
                
                //Send the page
                request.success({
                    "html":"<!DOCTYPE html>" + ihtml.html,
                    "headers":{
                        "Content-Type":"text/html"
                    }
                });
                
            break;
            
            //TODO client
            
            default:
                //Spit out a 503 (server error)
                request.error(error["503"].get(),"J2H.PAGE Incorrect page type '" + request.req.url + "' (" + base.type + ")");
            break;
        }
    }
    
    // ============================= Private Methods ==================== 
    
    //Get the sub components
    getComponents(){
        
        let base = this;
        
        //Check to see if we have all components cached
        if(!base._sub) {
            
            //Initialize the component store
            base._components = {};
            
            //Itterate over the components for this page
            for(let _component in base.components) {
                
                //Add this component
                base._components[_component] = base.components[_component];
                
                //Get the sub components used by this component
                base._components = Object.assign(base._components,base.components[_component].getComponents());
            }
        }
        
        return(base._components);
    }
}

module.exports = Page;


