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