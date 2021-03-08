const json2html = require("node-json2html");

module.exports = {
    
    "template":{"<>":"html","html":[
        
        {"<>":"head","html":[
            {"<>":"title","html":"404 - Page Not Found"}
        ]},
        
        {"<>":"body","html":[
            
            {"<>":"div","style":"margin:100 auto;width:400px;text-align:center;","html":[
                {"<>":"h1","style":"font-size: 3em;","html":"Sorry."},
                {"<>":"p","style":"font-size: 1.2em;","html":"Looks like we can't find that page. <br>It may have existed at sometime but now we can't find it."},
                {"<>":"a","style":"color:#fff;text-transform:uppercase;text-decoration:none;background:#b1b1b1;padding:20px;border-radius:50px;display:inline-block;","href":"/","html":"Go Back"}
            ]}
        ]}
    ]},
    
    "headers":{
        "Content-Type":"text/html"
    },
    
    "get":function(){
        return({
            "html":json2html.transform({},this.template),
            "headers":this.headers
        });
    }
};