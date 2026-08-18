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
    // seen (Set, internal) : components already visited on this call chain.
    //   Guards against infinite recursion when components (directly or
    //   transitively) reference each other - without this, a circular
    //   component graph would recurse forever and crash with a RangeError.
    //   Once a component has been visited, further references to it are
    //   included by name but not re-expanded, since it's already been (or is
    //   already being) fully resolved higher up the chain.
    getComponents(seen){

        let base = this;

        seen = seen || new Set();
        if(seen.has(base)) return({});

        // PERF: this.components is set once (normally in the constructor)
        // and never changes afterward, so the full recursive traversal
        // below only needs to run once per instance - once it has, reuse
        // the cached result instead of rebuilding it on every request. Must
        // come AFTER the cycle guard above (not before): the guard also
        // covers same-traversal diamond references (a component reachable
        // via two different parents in one call chain), which intentionally
        // still short-circuit to `{}` rather than being served from cache.
        if(base._components) return(base._components);

        seen.add(base);

        //Initialize the component store
        base._components = {};

        //Itterate over the components for this page
        for(let _component in base.components) {

            //Add this component
            base._components[_component] = base.components[_component];

            //Get the sub components used by this component
            base._components = Object.assign(base._components,base.components[_component].getComponents(seen));
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




