const j2h = require("j2h-framework");

class Component extends j2h.Component {
    
    constructor(){
        
        super();
        
        //Components that we're using
        this.components = {};
        
        //Template for this component
        this.template =  [
            
            {"<>":"li","html":[
                {"<>":"span","style":"padding-right:5px","text":"${text}"},
                
                //Add some interactivity for the client
                // if you click this it should remove the list item
                {"<>":"a","href":"#","text":"remove","onclick":function(e){
                    
                    //Prevent the default navigation
                    e.event.preventDefault();
                    
                    //Remove the list item
                    $(this).parent().remove();
                }}
            ]}
            
        ];
        
        //Signal that we want this available on the client
        // we want this available on the client so we can render more items on the client
        this.client = true;
    }
}

module.exports = new Component();  