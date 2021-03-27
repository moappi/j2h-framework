const j2h = require("j2h-framework");

class Page extends j2h.Page {
    
    constructor() {
        
        //Signal that we want to run events on the client
        super("hybrid");
        
        //Any components that we're using
        // make sure that the name of the component is unique across your project!
        this.components = {
            "item":require("../components/item.js")
        };
        
        //The page template
        this.template = [
            {"<>":"html","html":[
                {"<>":"head","html":[
                    {"<>":"title","text":"${title}"},
                    
                    //Required for client interactivity
                    {"<>":"script","src":"//ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"},
                    {"<>":"script","src":"//da-proxy.dakolor.com/app/1.0.0/assets/js/json2html.js"}
                ]},
                {"<>":"body","html":[
                    
                    {"<>":"h2","text":"${title}"},
                    {"<>":"p","text":"You'll notice that all the events that we added to the page and component templates are now available on the client."},
                    {"<>":"p","text":"But make sure that you've included both jquery and the json2html library in the head of your page otherwise your events aren't going to work."},  
                    {"<>":"p","text":"Now go ahead and play with me!"},
                    
                    //Button with some client interactivity
                    {"<>":"button","text":"Add Somthing","onclick":function(){
                        
                        //Add an new item to the list
                        // notice that we have access to the component item on the client :)
                        $(this).parent().find("ul").json2html({"text":"I'm new here"},json2html.component.get("item"));  
                    }},
                    
                    //List of items
                    {"<>":"ul","html":[
                        
                        //Get the list of items
                        // we'll use a component so we can add these on the client as well
                        {"[]":"item","data":function(){
                            return(this.items);
                        }}
                    ]}
                ]}
            ]}
        ];
    }
    
    //Async function to intercept before we render
    async render(req,res,next) {
        
        //Check something and output and error page??
        // you have full control of the response
        // note that render is called BEFORE data
        
        //or get j2h to render this page for us
        super(req,res,next);
    }
    
    //Async function to get data for this page
    async data(req) {
        
        //Get data from a server etc..
        // use the req to grab parameters from the url etc..
        
        //Whatever is returned is fed directly to the template
        // NOTE for hybrid mode this data object is available to the client
        return({
            "title":"My First Hybrid Page",
            
            //Items for our list
            "items":[
                {"text":"server item 1"},
                {"text":"server item 2"},
                {"text":"server item 3"},
                {"text":"server item 4"}
            ]
        });
    }
}

module.exports = new Page();  