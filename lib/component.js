class Component {
    
    constructor(type){
        
        // ============================= Public Properties ==================== 
        
        this.template = {};
        this.components = {};
        
        //Signal if we should add this component to the client
        // DEFAULT to false
        this.client = false;
        
        // ============================= Private Properties  ==================== 
        
        //All sub components used by this component
        this._components;
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
    
    /* ---------------------- Static Helper ------------------------ */
    
    //Get the templates for these components
    // client = true (if we want components only for the client)
    static templates(components,client) {
        
        let out = {};
        
        for(let _component in components)  {
            let component = components[_component];
            
            //Add the components template if we match the client filter criteria
            if( (component.client && client) || !client) out[_component] = component.template;
        }
        
        return(out);
    }
}

module.exports = Component;




