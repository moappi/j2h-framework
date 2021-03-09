
class HTTPError extends Error {
    
    constructor(message,statusCode){
        
        super(message);
        
        this.name = "HTTPError";
        this.statusCode = statusCode;
    }
}

module.exports = HTTPError;