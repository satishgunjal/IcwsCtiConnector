"use strict";

const logger = require("./../logger");
const config = require("./../config");

let ICWS_URI_SCHEME = config.icws.uriScheme;
let ICWS_URI_PORT = config.icws.uriPort;
let ICWS_URI_PATH = config.icws.uriPath;
let SERVER = config.icws.server;

let usersDetails = null;

let mapUsers = new Map();

exports.addMapUsers  = function(userId, password, sessionId, subscriptionId, csrfToken, cookie, eventSource){
    usersDetails = {password: password, sessionId:sessionId, csrfToken: csrfToken, cookie:cookie, subscriptionId: subscriptionId, eventSource:eventSource};
    mapUsers.set(userId, usersDetails);
};

exports.getMapUsers =  function(userId){
    return mapUsers.get(userId);
};

exports.getMapUsersSize =  function(){
    return mapUsers.size;
};

exports.getUserIdBySubscriberId =  function(subscriptionId) {
    try{
        for (const entry of mapUsers.entries()) { 
            let key = entry.toString().split(",")[0];   
            if(mapUsers.get(key).subscriptionId == subscriptionId){
                logger.log('info', "logMapElements()> key= " + key + " for subscriberID= "+ subscriptionId, {logId: subscriptionId});
                return key;
            }        
        }
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }    
};

exports.deleteMapUsers =  function(userId, subscriptionId){
    let result = "Error"
    try{
        if(mapUsers.has(userId)){
            mapUsers.delete(userId);
            result = "Success";
        }else{
            result = "Key not found";
    
        }
        logger.log('info', "deleteMapUsers()> result= "+ result + " new map size is= " + mapUsers.size, {logId: subscriptionId});
        
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }        
    return result;        
};

exports.logMapElements =  function(subscriptionId) {
    try{
        for (const entry of mapUsers.entries()) { 
            let key = entry.toString().split(",")[0];   
            //console.log("logMapElements()> key= " + key + " value= "+ JSON.stringify(mapUsers.get(key)));
            logger.log('info', "logMapElements()> key= " + key + " value= "+ JSON.stringify(mapUsers.get(key)), {logId: subscriptionId});
          }
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }    
};

//Get time format for unique ID
exports.getFormattedTime = function() {
    var today = new Date();
    //return moment(today).format("YYYYMMDDHHmmssSSS");
    return moment(today).format("YYYYMMDDHHmmss");
}


//subscriptionId is only for logging
exports.icwsUri = function (requestPath, sessionId, subscriptionId) {
    let uri = null;
    try{
        logger.log('debug', "icwsUri()> I/P: requestPath= " + requestPath, {logId: subscriptionId});
        logger.log('debug', "icwsUri()> I/P: sessionId= " + sessionId, {logId: subscriptionId});

        // Create the base URI, using the ICWS port, with the specified server and session ID.
        uri = ICWS_URI_SCHEME + SERVER + ':' + ICWS_URI_PORT + ICWS_URI_PATH;
        // Once a session has been established, subsequent requests for that session require its session ID.
        // (This is not provided when establishing the initial connection.)
        if (sessionId != undefined) {
            uri += '/' + sessionId;
        }
        logger.log('debug', "icwsUri()> uri= " + uri, {logId: subscriptionId});

        // Add the specific ICWS request to the URI being built.
        if (requestPath.substring(0, 1) !== '/') {
            uri += '/';
        }
        uri += requestPath;

        logger.log('debug', "icwsUri()> uri= " + uri, {logId: subscriptionId});
        
    }catch(e){
        logger.log('debug', e.stack, {logId: subscriptionId});
    }
    return uri;
};
