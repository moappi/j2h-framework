const j2h = require("j2h-framework");

class Page extends j2h.Page {
    
    constructor() {
        
        //No client interactivity
        // server rendering only
        super("server");
        
        //Any components that we're using
        // make sure that the name of the component is unique across your project!
        this.components = {};
        
        //The page template
        this.template = [
            {"<>":"html","html":[
                {"<>":"head","html":[
                    {"<>":"title","text":"Welcome to j2h"}
                ]},
                {"<>":"body","html":[
                    {"<>":"h2","text":"Welcome to j2h"},
                    
                    {"<>":"p","text":"We'll show you how to get a j2h project up and running and create a server page and a hybrid page with client interactivity"},
                    
                    {"<>":"p","text":"This page is an example of a server page, no interactivity, just a simple HTML page"},
                    
                    {"<>":"p","html":[
                        {"<>":"a","href":"/hybrid","text":"This hybrid page"},
                        {"<>":"span","text":" shows you how to grab data and render the page with client interactivity"}
                    ]}
                ]}
            ]}
        ];
    }
}

module.exports = new Page();  