j2h.export("/components/user.js",(

    class extends j2h.Component {
    
        constructor(){
            
            super();
            
            //Component template
            this.template = [
                
                {"<>":"li","html":[
                    {"<>":"a","href":"/user/${user}","text":"${name}"}
                ]}
                
            ];
        }
    }

));   