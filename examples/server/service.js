const app = require("express")(),
    j2h = require("j2h-framework");

//extend express app.page
app.page = j2h.express.page;

//your j2h pages
const home = require("./pages/home.js");

//route to your pages
app.page("/",home);

//listen
app.listen(80);