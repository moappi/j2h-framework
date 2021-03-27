
class HTTPError extends Error {
    
    constructor(statusCode,message,fileName,lineNumber){
        
        super(message,fileName,lineNumber);
        
        this.name = "HTTPError";
        this.statusCode = statusCode;
    }
    
    toString() {
        return("HTTP Error (" + this.statusCode + ") : " + super.toString());
    }
}

module.exports = HTTPError;