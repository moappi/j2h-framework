
j2h framework is a featherweight rendering framework for 

- node.js using [express](https://expressjs.com/)
- browser using page.js [experimental]

exclusively for [json2html templates](https://json2html.com)

+   json2html template support for both pages and components
+   Render fully interactive html pages
+   Seemless use of the same templates on the client and server
+   Ultra simple integration with express (in one line of code)

# Node.js (Server)

The j2h framework simply extends your express routing by adding an app.page method to render j2h pages.  

You can integrate it into your project with one line of code!

```javascript
app.page = j2h.express.page;
```

You can then create a j2h page (see Pages below) and route to them. 

You'll be able to use all the features of express that you know and love like middleware, advanced routing etc..

```javascript
const app = require("express")(),
    j2h = require("j2h-framework");

//extend express app.page
app.page = j2h.express.page;

//your j2h page
const home = require("./pages/home.js");

//route to your page
app.page("/",home);

//listen
app.listen(80);
```

## Pages

Simply extend our j2h.Page class, then modify 

+   **template (required)** the template object you want to use to render this page

+   **components (optional)** components object that this page directly uses. You'll need you use a unique name across your project
+   **data (optional)** async method used to return the data that this page will render
+   **render (optional)** async method used to interupt the rendering process, great for redirecting the page etc..

Don't forget to specify the render mode by calling the super contructor with either

+   **"server"** which will render a flat html page
+   **"hybrid"**  which renders interactive html that includes events sepcified in your page or components.  json2html will take care of rehydrating these events for you on the client, just make sure to include jquery and json2html on the client! You'll also be able to reference your components on the client (see Components for configuration)

### Example

```javascript

const j2h = require("j2h-framework");

class Page extends j2h.Page {
    
    constructor() {
      
        //Call the super constructor and signal what kind of page rendering we want to use
        super("hybrid");
        
        //Components that this page directly uses
        // NOTE these need to be unique across the entire project
        this.components = {
            "link":require("./components/link.js")
        };
        
        //The pages template
        this.template = [
            {"<>":"html","html":[
                {"<>":"head","html":[
                    {"<>":"title","text":"${title}"}
                ]},
                {"<>":"body","text":[
                    {"<>":"h2","text":"${title}"},
                    {"[]":"link"}
                ]}
            ]}
        ];
    }
    
    //Render 
    async render(req,res,next) {
        
        //Check something and output and error page??
        // you have full control of the response
        
        //or get j2h to render this page for us
        // the data object is the optional data object to pass when rendering
        // if the data object is omitted here then the data function will be used instead
        super(req,res,next,data);
    }
    
    async data(req) {
    
        //Get data from a server
        // use the req to grab parameters from the url etc..
        
        return({
            "title":"My First j2h Page",
            "url":"https://www.json2html.com"
        });
    }
}

module.exports = new Page(); 
    
```

## Data or Render?

What's the difference between the 'data' and 'render' methods?  

When rendering a page j2h first calls the render method, then the data method to get the data object to render. Here's when you want to use them

+   **data method** use to format the data for the page, remember whatever you return here is sent directly for rendering with the template [ie just like json2html.render(data,template)]
+   **render method** use this method to perform your page logic (ie check middleware, access, get data from a database etc..) You'll have full access to the response so you can do things like redirect to an error page if you ran into trouble. If you're already pulling the data inside the render function you can pass the data object to the super.render function eg super.render(res,req,next,{"my":"data}) **Make sure to call the super render function if you want j2h to continue rendering the page!**


## Components

Simply extend our j2h.Component class and modify

+   **template (required)** the template object you want to use to render this page

+   **components (optional)** components object that this component directly uses. You'll need you use a unique name across your project
+   **client (optional)** (default false) if true then the component will be availabe on the client via json2html.component.get(name) (in hybrid render mode). Otherwise component will not be available on the client.

### Example

```javascript

const j2h = require("j2h-framework");

class Component extends j2h.Component {
    
    constructor(){
        
        //Make sure we call the super constructor first
        super();
        
        //Components that this page directly uses
        // NOTE these need to be unique across the entire project
        this.components = {};
        
        //The template
        this.template =  [
            {"<>":"a","href":"${url}","text":"${text}"}
        ];
        
        //Signal that we want this component to be available on the client
        // only if the page is rendered in hybrid mode
        this.client = true;
    }
}

module.exports = new Component();  
    
```

# Browser (Client)

j2h-framework can also be used on the browser, note that this is still experimental.

## Dependancies

- json2html (2.1.0+)
- jquery (3.6.0+)
- page.js (1.8.5+)


## Getting Started

j2h-framework for the browser uses page.js instead of express, but it's very similar.

Note that instead of using require, you can use j2h.require which is an async function to include your pages

```javascript
(async function() {
    
    //Pages that we want to 
    let pages = {
        "home":await j2h.require("/pages/home.js"),
        "user":await j2h.require("/pages/user.js")
    };
    
    //Optional middleware
    j2h.app.use((req,res,next)=>{
        
        //Apply middleware here
        // recommend using localStorage to store session data
        
        next();
    });
    
    //Apply the routes
    j2h.app.page("/",pages.home);
    j2h.app.page("/user/:user",pages.user);
    
    j2h.app.listen();
    
})();  
```

### Page Example

You'll be able to use the same struture for a page as the server version, the exceptions are

- use j2h.export to export your pages for use with j2h
- use a string to specify the absolute path of your components

```javascript
j2h.export("/pages/home.js",(

    class extends j2h.Page {
    
        constructor(){
            
            super();
            
            //Componets that this page uses
            // note that /components/test.js MUST be a j2h.Component exported using j2h.export()
            this.components = {
                "user":"/components/user.js"
            };
            
            //Component template
            this.template = [
                
                {"<>":"section","html":[
                    {"<>":"h2","text":"Home Page"},
                    {"<>":"ul","html":[
                        {"[]":"user","obj":function(){
                            return(this.users);  
                        }}
                    ]}
                ]}
                
            ];
        }
        
        //Data method
        // returns the data we want to render for this page
        async data(req) {
            
            //check to see if we have a user to render
            // get the user from the api
            return({
                "users":[
                    {"name":"Bill Brown","user":"bill"},
                    {"name":"Jane Brown","user":"jane"},
                ]
            });
        }
    }

));
```

# Project Status
We need help!  We'd love help with writing tests, creating better examples or some much needed documentation :)

