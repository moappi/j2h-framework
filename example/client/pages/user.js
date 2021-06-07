
//Export this page
j2h.export("/pages/user.js",(

    class extends j2h.Page {
    
        constructor(){
            
            super();
            
            //Components that this page uses
            this.components = {};
            
            //Component template
            this.template = [
                
                {"<>":"section","html":[
                    {"<>":"h2","text":"User ${user}"},
                    {"<>":"a","href":"/","text":"back"}
                ]}
                
            ];
        }
        
        //Render method
        // allows us to do things like redirect to an error page etc..
        async render(req,res) {
            
            //if(req.params.user === "chad") return res.redirect("/");
            
            await super.render(req,res);
        }
        
        //Data method
        // returns the data we want to render for this page
        async data(req) {
            
            //check to see if we have a user to render
            // get the user from the api
            return({
                "user":req.params.user
            });
        }
    }

));
 