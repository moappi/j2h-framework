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
                        {"[]":"user","{}":o=>o.users}
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
  