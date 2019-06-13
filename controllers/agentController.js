//For Promise & Async/Await please ref. https://medium.com/@tkssharma/writing-neat-asynchronous-node-js-code-with-promises-async-await-fa8d8b0bcd7c

"use strict";

const JSON = require("circular-json");
const request = require("request");
const Promise = require('promise');
const EventSource = require('eventsource');

const _ = require("lodash");

const utils = require("../utils/common.js");
const dialer = require("./dialerController");

const config = require("../config");
const logger = require("../logger");
const ser = require("../server")

const REQUEST_TIMEOUT_MS = config.request.timeoutMs;
const CONTENT_TYPE = config.request.contentType;
const ACCEPT_LANGUAGE = config.request.acceptLanguage;
// Polling interval for retrieving ICWS message queue.
const ICWS_MESSAGE_RETRIEVAL_INTERVAL_MS = config.icws.messageRetrievalIntervalMs;

// Stores the current version of messaging supported by the connected ICWS session.
// This value is used in helping to determine if short-polling or server sent events should be used for message processing.
var icwsCurrentMessagingVersion = null;

// This holds the value of the messaging version that supports server sent events.
var icwsMessagingVersionForServerSentEvents = 2;

// Dictionary of ICWS message __type ID to the callback (type: icwsMessageCallback)
// to invoke when that message is received.
var icwsMessageCallbacks = {};
var messageProcessingTimerId;
// Optional callback for processing unhandled ICWS messages.
// Type: icwsMessageCallback
var icwsUnhandledMessageCallback = null;

/***********************************************************************
 * Retrieves the state representation of an existing or previous connection.
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/connection/index.htm#get
 * ***********************************************************************/
exports.connectionState = async function (req, res) {
    let sessionId = null;
    let csrfToken = null;
    let cookie = null;
    let subscriptionId = null;

    try {  
        sessionId = req.headers.sessionid;
        csrfToken = req.headers.csrftoken;
        cookie = req.headers["set-cookie"];
        subscriptionId = req.headers.subscriptionid;

        logger.log('info', "connectionState()> ####### START ####### ", { logId: subscriptionId });
        
        logger.log('info', "connectionState()> sessionId= " + sessionId, { logId: subscriptionId });
        logger.log('info', "connectionState()> csrfToken= " + csrfToken, { logId: subscriptionId });
        logger.log('info', "connectionState()> cookie= " + cookie, { logId: subscriptionId });
        logger.log('info', "connectionState()> subscriptionId= " + subscriptionId, { logId: subscriptionId });  

        let result = await connection("GET",{},"connection", sessionId, csrfToken, cookie, subscriptionId);
        res.status(200).json(result);  
    } catch (e) {
        logger.log('error', e.stack, { logId: subscriptionId });
        res.status(200).json({ 'error': e.message, 'responseMessage': 'Check connection state request failed' });
    } 
};

exports.agentLogin = async function (req, res) {

    let result = null;
    let userDetails= null;
    let subscriptionId = null;

    try{
        let userId = req.body.userId;
        let password = req.body.password;
        let station = req.body.station;
        subscriptionId = req.headers.subscriptionid;

        logger.log('verbose', "exports.agentLogin()> ####### START ####### ", { logId: subscriptionId });
        logger.log('verbose', "exports.agentLogin()> req.body= " + JSON.stringify(req.body), { logId: subscriptionId });
        logger.log('verbose', "exports.agentLogin()> subscriptionId= " + subscriptionId, { logId: subscriptionId });

        logger.log('info', "exports.agentLogin()> Check if user details exists in map", {logId: subscriptionId});
                        
        userDetails = utils.getMapUsers(userId);
        logger.log('info', "exports.agentLogin()> userDetails= "+ JSON.stringify(userDetails), {logId: subscriptionId});

        if(userDetails){
            logger.log('warn', "exports.agentLogin()> "+ userId + " wasnt logged out from system", {logId: subscriptionId});                        
            logger.log('warn', "exports.agentLogin()> "+ userId + " details presents in map. Checking last connection status", {logId: subscriptionId});
            //connectionState= none= 0, up= 1, down= 2
            //Note: here we are passing new subscriptionId
            result = await connection("GET",{},"connection", userDetails.sessionId, userDetails.csrfToken, userDetails.cookie, subscriptionId);  
            if (result.responseCode == 200) {                                     
                logger.log('info', "exports.agentLogin()> The connection representation was successfully retrieved. connectionState= "+ result.body.connectionState, {logId: subscriptionId });    
                if(result.body.connectionState == 1){   
                    logger.log('info', "exports.agentLogin()> connectionState of ("+ userId + ") is up. Sending logout request", {logId: subscriptionId});    
                    result = await exports.processAgentLogout(userId, userDetails.sessionId, userDetails.csrfToken, userDetails.cookie,subscriptionId);  
                    logger.log('info', "exports.agentLogin()> Old session logout result= " + JSON.stringify(result), {logId: subscriptionId});                                    
                }
            }
        }
        result =  await agentLogin(userId,password,station, subscriptionId);    
    }catch (e) {
        logger.log('error', e.stack, { logId: subscriptionId });       
        result =  { 'error': e.message, 'responseMessage': 'Agent login failed' }
    } 
    finally{
        logger.log('info', "exports.agentLogin()> result= "+ JSON.stringify(result), {logId: subscriptionId });  
        res.status(200).json(result);
    }         
}

async function agentLogin(userId,password,station, subscriptionId) {   
    let result = null; 
    let statusMessages = null;

    logger.log('verbose', "agentLogin()> ####### START ####### ", { logId: subscriptionId });

    logger.log('verbose', "agentLogin()> userId= " + userId, { logId: subscriptionId });
    logger.log('verbose', "agentLogin()> password= " + password, { logId: subscriptionId });
    logger.log('verbose', "agentLogin()> station= " + station, { logId: subscriptionId });
    logger.log('verbose', "agentLogin()> subscriptionId= " + subscriptionId, { logId: subscriptionId });
     
    try{ 
        let userDetails = utils.getMapUsers(userId);
        logger.log('info', "agentLogin()> userDetails= "+ JSON.stringify(userDetails), {logId: subscriptionId});

        if(userDetails){
            logger.log('info', "agentLogin()> Since user details present in map. removing values for userID("+userId+")"+ JSON.stringify(userDetails), {logId: subscriptionId});
            utils.deleteMapUsers(userId, subscriptionId);
            logger.log('info', "agentLogin()> "+ userId + " details removed from map. New map size is= "+ utils.getMapUsersSize(), {logId: subscriptionId});
            utils.logMapElements(subscriptionId); 
        }

        let payload = {
            "__type": "urn:inin.com:connection:icAuthConnectionRequestSettings",
            "applicationName": "AGC Genesys Adapter",
            "userID": userId,
            "password": password
        };   
        result = await connection("POST",payload,"connection?include=features,effective-station", null, null, null, subscriptionId);    
        if (result.responseCode == 201) {
            logger.log('info', "agentLogin()> User (" + userId + ") logged in", { logId: subscriptionId });
            
            GetIcwsCurrentMessagingVersion(result.response);
            let sessionId = result.response.headers["inin-icws-session-id"];
            let csrfToken = result.response.headers["inin-icws-csrf-token"];
            let cookie = result.response.headers["set-cookie"];

            logger.log('info', "agentLogin()> sessionId= " + sessionId, {logId: subscriptionId});
            logger.log('info', "agentLogin()> csrfToken= " + csrfToken, {logId: subscriptionId});
            logger.log('info', "agentLogin()> cookie= " + cookie, {logId: subscriptionId });

            result = await stationLogin(sessionId, csrfToken, cookie, station, subscriptionId);
            if (result.responseCode == 200) {
                logger.log('info', "agentLogin()> Station(" + station + ") assigned to user(" + userId + ")", {logId: subscriptionId});
                result = await startUserStatusSubscription(sessionId, csrfToken, cookie, userId, subscriptionId); 
                if (result.responseCode == 200) {
                    logger.log('info', "agentLogin()> User status subscription started for user("+ userId+")", {logId: subscriptionId});
                    result = await  getStatusMessages(sessionId, csrfToken, cookie, userId, subscriptionId);
                    if (result.responseCode == 200) {
                        logger.log('info', "agentLogin()> Get user status messages request for user("+ userId+") successfull", {logId: subscriptionId});
                        statusMessages = result.body.statusMessages;
                        result = await  subscribeToQueue(sessionId, csrfToken, cookie, userId,subscriptionId);
                    
                        if (result.responseCode == 200) {
                            logger.log('info', "agentLogin()> Queue subscription for agent (" + userId + ") with subscriptionId(" + subscriptionId + ") started", {logId: subscriptionId});                       
                            
                            result = { 'body': result.body, 'responseCode': 0, 'responseMessage': 'Success', 'sessionId': sessionId,
                            'csrfToken': csrfToken, 'cookie': cookie, 'subscriptionId': subscriptionId, 'statusMessages': statusMessages };

                            let eventSource = await startMessageProcessing(sessionId, cookie, userId, password, subscriptionId, csrfToken);                            
                            
                            //adding user details to  map
                            if(eventSource){
                                utils.addMapUsers(userId,password, sessionId, subscriptionId, csrfToken, cookie, eventSource);
                                logger.log('info', "agentLogin()> "+ userId + " details added in map. New map size is= "+ utils.getMapUsersSize(), {logId: subscriptionId});
                                utils.logMapElements(subscriptionId); 
                                //Sending logged in response through socket also. Its required to update the softphone status on multiple tabs
                                ser.sendMsg(userId,subscriptionId,null, 'ACD_LOGGED_IN', result)
                            }else{
                                logger.log('error', "agentLogin()> 'eventSource' object is null", {logId: subscriptionId});
                                result = {  'error': e.message, 'responseMessage': 'Agent login failed'};
                            }
                        }
                    }                    
                }
            }
        }
                        
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }
    return result;
};

/***********************************************************************
 * Retrieves the state representation of an existing or previous connection.
 * connectionState= none= 0, up= 1, down= 2
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/connection/index.htm#get
 * ***********************************************************************/
function connection(method,payload,requestPath, sessionId, csrfToken, cookie, subscriptionId) {
    
    logger.log('verbose', "connection()> ####### START ####### ", { logId: subscriptionId });
    logger.log('verbose', "connection()> method= " + method, {logId: subscriptionId});
    logger.log('verbose', "connection()> payload= " + JSON.stringify(payload), {logId: subscriptionId});
    logger.log('verbose', "connection()> requestPath= " + requestPath, {logId: subscriptionId});
    logger.log('verbose', "connection()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "connection()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "connection()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('verbose', "connection()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);
    logger.log('debug',  "connection()> uri= " + uri, {logId: subscriptionId});
    
    let options = {
        method: method,
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: payload,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };
    logger.log('verbose',  "connection()> options = " + JSON.stringify(options), {logId: subscriptionId});
    // Return new promise 
    return new Promise(function(resolve, reject) {
        // Do async job
        request(options, function (error, response, body) {
            try {        
                logger.log('info', "connection()> Response received", { logId: subscriptionId });
                if (error) {
                    logger.log('error', error, { logId: subscriptionId });
                    logger.log('error', "connection()> ####### ERROR ####### ", { logId: subscriptionId });
                    reject(error);
                    //res.status(200).json({ 'error': error.message, 'responseMessage': 'Check connection state request failed' });

                } else {
                    logger.log('info', "connection()> statusCode= " + response.statusCode, { logId: subscriptionId });
                    logger.log('debug', "connection()> body= " + JSON.stringify(body), { logId: subscriptionId }); 

                    resolve({ 'body': body,'responseCode': response.statusCode, 'response': response });
                    // /res.status(200).json({ 'body': body, 'responseCode': response.statusCode});                    
                }
            } catch (e) {
                logger.log('error', e.stack, { logId: subscriptionId });
                reject(e);
                //res.status(200).json({ 'error': e.message, 'responseMessage': 'Check connection state request failed' });
            } 
        });        
    });    
};

/***********************************************************************
* Creates, changes, or replaces a station connection representation. If a station connection already exists,
* it will be updated using the provided station settings. If there is no existing station connection for the session, 
* one will be created using the station settings.
*  Sample header and body
*  {"method":"PUT","url":"http://192.168.230.50:8018/icws/29113001/connection/station","headers":{"Content-type":"application/json","Accept-Language":"en-us","ININ-ICWS-CSRF-Token":"VXVzZXIyWCRJQ1dTIEphdmFTY3JpcHQgRGlyZWN0IFVzYWdlIEV4YW1wbGVYJDczYjY5YWZhLWUwYTUtNDVjOC04MGJkLTEwYTI2ODBiNTk4M1gPMTkyLjE2OC4xMzEuMTgy","Cookie":["icws_29113001=b9ff8b8d-f899-4b52-80ab-8a7167cf7365|languageId=en-us; Path=/icws/29113001; HttpOnly"]},"body":{"__type":"urn:inin.com:connection:workstationSettings","workstation":"TestSoftPhone"},"json":true}
*
* API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/connection/station/index.htm#put
* ***********************************************************************/
function stationLogin(sessionId, csrfToken, cookie, station, subscriptionId) {

    logger.log('verbose', "stationLogin()> ####### START ####### ");

    logger.log('verbose', "stationLogin()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "stationLogin()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "stationLogin()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('verbose', "stationLogin()> station= " + station, {logId: subscriptionId});

    let requestPath = "/connection/station";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    let options = {
        method: 'PUT',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: {
            "__type": "urn:inin.com:connection:workstationSettings",
            "workstation": station,
            "supportedMediaTypes" : [1],
            "readyForInteractions" : true
        },
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };
    logger.log('verbose',  "stationLogin()> options = " + JSON.stringify(options), {logId: subscriptionId});  
    return new Promise(function(resolve, reject) {
        request(options, function (error, response, body) {
            try{
                logger.log('info', "stationLogin()> Response received", {logId: subscriptionId});

                if (error) {
                    logger.log('error', error, {logId: subscriptionId});
                    logger.log('error', "stationLogin()> ####### ERROR ####### ", {logId: subscriptionId});                    
                    reject(error);
                } else {
                    logger.log('info', "stationLogin()> statusCode= " + response.statusCode, { logId: subscriptionId });
                    logger.log('debug', "stationLogin()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    resolve({ 'body': body,'responseCode': response.statusCode });                    
                }
            }catch(e){
                logger.log('error', e.stack, {logId: subscriptionId});
                reject(e);
            }
        }); 
    });   
};

/**
 * Starts the subscription for users statuses for given user id
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/messaging/subscriptions/status/user-statuses/index.htm#put
 */
function startUserStatusSubscription(sessionId, csrfToken, cookie, userId, subscriptionId) {
    
    logger.log('verbose', "startUserStatusSubscription()> ####### START #######", {logId: subscriptionId});

    logger.log('verbose', "startUserStatusSubscription()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "startUserStatusSubscription()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "startUserStatusSubscription()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('verbose', "startUserStatusSubscription()> userId= " + userId, {logId: subscriptionId});

    let requestPath = "/messaging/subscriptions/status/user-statuses";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    var options = {
        method: 'PUT',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: { 'userIds': [userId] },
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };
    logger.log('verbose', "startUserStatusSubscription()> options= " + JSON.stringify(options), {logId: subscriptionId});
    return new Promise(function(resolve, reject) {
        request(options, function (error, response, body) {
            try{
                logger.log('info', "startUserStatusSubscription()> Response received", {logId: subscriptionId});
                if (error) {
                    logger.log('error', error);
                    logger.log('error', "startUserStatusSubscription()> ####### ERROR #######", {logId: subscriptionId});                
                    reject(error);
                } else {
                    logger.log('info', "startUserStatusSubscription()> statusCode= " + response.statusCode, { logId: subscriptionId });
                    logger.log('debug', "startUserStatusSubscription()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    resolve({ 'body': body,'responseCode': response.statusCode });
                }
            }catch(e){
                logger.log('error', e.stack, {logId: subscriptionId});                
                resolve(e);
            }
        });  
    });  
};

/**
 * Starts the subscription for users statuses for given user id
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/status/status-messages-user-access/(userId)/index.htm#get
 */
function getStatusMessages(sessionId, csrfToken, cookie, userId, subscriptionId) {

    logger.log('verbose', "getStatusMessages()> ####### START #######", {logId: subscriptionId});

    logger.log('verbose', "getStatusMessages()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "getStatusMessages()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "getStatusMessages()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('verbose', "getStatusMessages()> userId= " + userId, {logId: subscriptionId});

    let requestPath = "/status/status-messages-user-access/" + userId;

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    var options = {
        method: 'GET',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: {},
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('debug', "getStatusMessages()> options= " + JSON.stringify(options), {logId: subscriptionId});
    return new Promise(function(resolve, reject) {

        request(options, function (error, response, body) {
            try{
                logger.log('info', "getStatusMessages()> Response received", {logId: subscriptionId});
                if (error) {
                    logger.log('error', error, {logId: subscriptionId});
                    logger.log('error', "getStatusMessages()> ####### ERROR #######", {logId: subscriptionId});
                    reject(error);
                    
                } else {
                    logger.log('info', "getStatusMessages()> statusCode= " + response.statusCode, { logId: subscriptionId });
                    logger.log('debug', "getStatusMessages()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    resolve({ 'body': body,'responseCode': response.statusCode });                    
                }
            }catch(e){
                logger.log('error', e.stack, {logId: subscriptionId});
                reject(e);
            }
        });
    });   
};

/**
 * This retrieves all status messages defined in Interaction Center. 
 * Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/status/status-messages/index.htm#resource
 */
exports.getAllStatusMessages = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;
    let cookie = req.get('set-cookie');

    logger.log('info', "getAllStatusMessages()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "getAllStatusMessages()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "getAllStatusMessages()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "getAllStatusMessages()> cookie= " + cookie, {logId: subscriptionId});
    
    logger.log('info', "getAllStatusMessages()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    let requestPath = "/status/status-messages";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "getAllStatusMessages()> uri= " + uri);

    var options = {
        method: req.method,
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: {},
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('debug', "getAllStatusMessages()> options= " + JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "getAllStatusMessages()> Response received", {logId: subscriptionId});
            logger.log('info', "getAllStatusMessages()> statusCode = "  + response.statusCode, {logId: subscriptionId});

            if (error) {
                logger.log('error', error); 
                logger.log('error', "getAllStatusMessages()> ####### ERROR #######", {logId: subscriptionId});                      
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Get all status messages request failed'});
            } else {
                logger.log('debug', "getAllStatusMessages()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                if (response.statusCode == 200) {     
                    logger.log('info', "getAllStatusMessages()> ####### SUCCESS #######", {logId: subscriptionId});   
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});                     
                }
                else{                    
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};


/**
 * Subscribe to "InteractionStates". This subscription will send update messages for the "Eic_State" attribute on interactions in the System queue, and the User queue whose ID is "John.Smith".
 * What is Queue: A queue is collection of interactions related to a user, station or workgroup. The CIC client has the ability to monitor My Interactions and other station, user or workgroup queues.
 * What is workgroup: Workgroups are logical groups of users (for example, departments) that can function as a group in the CIC system. 
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/messaging/subscriptions/queues/(subscriptionId)/index.htm#put
 * */ 
function subscribeToQueue(sessionId, csrfToken, cookie, userId,subscriptionId) {
    
    logger.log('verbose', "subscribeToQueue()> ####### START ####### ", {logId: subscriptionId});

    let payload = {
        "queueIds": [{
            "queueType": 1,
            "queueName": userId
        }
        ],
        "attributeNames": [
            "Eic_CallState", "Eic_CallStateString", "EIC_LocalId", "Eic_LocalUserId", "Eic_UWSegmentQueues","Eic_CallId",
            "Eic_DispositionCode", "EIC_LocalTnRaw", "EIC_RemoteTnRaw",
            "Eic_LocalAddress", "Eic_LocalName","Eic_IRRecordingId","Eic_CallPurpose", "Eic_CallDirection"
        ]
    };

    logger.log('verbose', "subscribeToQueue()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "subscribeToQueue()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "subscribeToQueue()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('verbose', "subscribeToQueue()> userId= " + userId, {logId: subscriptionId});
    logger.log('verbose', "subscribeToQueue()> payload= " + JSON.stringify(payload), {logId: subscriptionId});
    
    let requestPath = "/messaging/subscriptions/queues/" + subscriptionId;
    
    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('info', "subscribeToQueue()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: 'PUT',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: payload,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('debug',"subscribeToQueue()> options= " +  JSON.stringify(options), {logId: subscriptionId});
    return new Promise(function(resolve, reject) {

        request(options, function (error, response, body) {
            try{
                logger.log('info',"subscribeToQueue()> Response received", {logId: subscriptionId});
                if (error) {
                    logger.log('error', error, {logId: subscriptionId});
                    logger.log('error', "subscribeToQueue()> ####### ERROR #######", {logId: subscriptionId});                    
                    reject(error);
                } else {
                    logger.log('info', "subscribeToQueue()> statusCode= " + response.statusCode, {logId: subscriptionId});
                    logger.log('debug', "subscribeToQueue()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    resolve({ 'body': body, 'responseCode': response.statusCode});                    
                }
            }catch(e){
                logger.log('error', e.stack, {logId: subscriptionId});
                reject(e);
            }
        });    
    });
};

/***********************************************************************
*  Sample request is as below
*  url: http://localhost:443/api/agent/logout
*  headers:headers= {"csrftoken":"csrfToken","content-type":"application/json","sessionid":"sessionId","set-cookie":["cookie"]}
*  body: {"userID": "user2", "subscriptionId":""}
* **********************************************************************
*/
exports.agentLogout = async function (req, res) {  

    let result = null;

    let sessionId = null;
    let csrfToken = null;
    let cookie = null;
    let userId = null;
    let subscriptionId = null;

    try{
        //** Header keys are always in lower case */
        sessionId = req.headers.sessionid;
        csrfToken = req.headers.csrftoken;
        cookie = req.get('set-cookie');
        userId = req.body.userId;
        subscriptionId = req.body.subscriptionId;

        logger.log('info', "exports.agentLogout()> ####### START ####### ", {logId: subscriptionId});

        logger.log('info', "exports.agentLogout()> sessionId= " + sessionId, {logId: subscriptionId});
        logger.log('info', "exports.agentLogout()> csrfToken= " + csrfToken, {logId: subscriptionId});
        logger.log('info', "exports.agentLogout()> cookie= " + cookie, {logId: subscriptionId});
        logger.log('info', "exports.agentLogout()> userId= " + userId, {logId: subscriptionId});
        logger.log('info', "exports.agentLogout()> subscriptionId= " + subscriptionId, {logId: subscriptionId});
        
        logger.log('info', "exports.agentLogout()> ####### END ####### ", {logId: subscriptionId}); 

        result = await exports.processAgentLogout(userId, sessionId, csrfToken, cookie,subscriptionId);          

    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
        result = { 'error': e.message, 'responseMessage': 'Agent Logout failed' };
    }  
    finally{
        logger.log('info', "agentLogout()> result= "+ JSON.stringify(result), {logId: subscriptionId});
        res.status(200).json(result);
    }
};

/**
 * 
 * @param {*} userId 
 * @param {*} sessionId 
 * @param {*} csrfToken 
 * @param {*} cookie 
 * @param {*} subscriptionId 
 */
exports.processAgentLogout = async function(userId, sessionId, csrfToken, cookie,subscriptionId) {  
    let result = null;
    logger.log('verbose', "processAgentLogout()> ####### START ####### ", {logId: subscriptionId});
    logger.log('verbose', "processAgentLogout()> userId= " + userId, {logId: subscriptionId});
    logger.log('verbose', "processAgentLogout()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "processAgentLogout()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "processAgentLogout()> cookie= " + cookie, {logId: subscriptionId});
    
    try{        
        result = await stopUserStatusSubscription(sessionId,csrfToken, cookie, subscriptionId);   
        if (result.responseCode == 204) {
            logger.log('info', "processAgentLogout()> User status subscription stopped for user("+ userId+")", {logId: subscriptionId});

            result = await unsubscribeFromQueue(sessionId,csrfToken, cookie, subscriptionId); 
            if (result.responseCode == 204) {
                logger.log('info', "processAgentLogout()> The interaction queue subscription "+ subscriptionId + " has been removed for user("+ userId +")", {logId: subscriptionId});
                result = await connection("DELETE",{},"connection", sessionId, csrfToken, cookie, subscriptionId); 
                if (result.responseCode == 200) {
                    logger.log('info', "processAgentLogout()> User("+ userId + ") Logout successfull", {logId: subscriptionId});
                    result =  {'body': result.body, 'responseCode': 0, 'responseMessage': 'Success'};
                    //Sending logged out response through socket also. Its required to update the softphone status on multiple tabs
                    ser.sendMsg(userId,subscriptionId,null, 'ACD_LOGGED_OUT', result)    

                    stopMessageProcessing(userId, subscriptionId);                                
                    }
                }
            }    
                        
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }    
    return result;
};

/**
* Stops the subscription for users statuses.
*/
function stopUserStatusSubscription(sessionId, csrfToken, cookie, subscriptionId) {
    
    logger.log('verbose', "stopUserStatusSubscription()> ####### START #######", {logId: subscriptionId});
    logger.log('verbose', "stopUserStatusSubscription()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "stopUserStatusSubscription()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "stopUserStatusSubscription()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('verbose', "stopUserStatusSubscription()> subscriptionId= " + subscriptionId, {logId: subscriptionId});
    // The DELETE request does not take any payload values.
    let payload = {};

    let uri = utils.icwsUri("/messaging/subscriptions/status/user-statuses", sessionId, subscriptionId);

    var options = {
        method: 'DELETE',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: payload,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };
    
    logger.log('verbose', "stopUserStatusSubscription()> options= " + JSON.stringify(options), {logId: subscriptionId});
    return new Promise(function(resolve, reject) {
        request(options, function (error, response, body){
            try{
                logger.log('info', "stopUserStatusSubscription()> Response received. statusCode= " + response.statusCode, {logId: subscriptionId});
                if (error) {
                    logger.log('error', error);
                    logger.log('error', "stopUserStatusSubscription()> ####### ERROR #######", {logId: subscriptionId});
                    reject(error);                       
                } else {
                        logger.log('info', "stopUserStatusSubscription()> statusCode= " + response.statusCode, { logId: subscriptionId });
                        logger.log('debug', "stopUserStatusSubscription()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                        resolve({ 'body': body, 'responseCode': response.statusCode});                    
                    }
            }catch(e){
                logger.log('error', e.stack, {logId: subscriptionId});
                reject(e); 
            }
        });
    });
};

/**
 * Removes the interaction queue subscription..
 * WHat is Queue: A queue is collection of interactions related to a user, station or workgroup. The CIC client has the ability to monitor My Interactions and other station, user or workgroup queues.
 * What is workgroup: Workgroups are logical groups of users (for example, departments) that can function as a group in the CIC system. 
 * subscriptionIdOld will be used to remove old login details.
 * */
function unsubscribeFromQueue(sessionId, csrfToken, cookie, subscriptionId) {
    
    logger.log('verbose', "unsubscribeFromQueue()> ####### START ####### ", {logId: subscriptionId});
    logger.log('verbose', "unsubscribeFromQueue()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('verbose', "unsubscribeFromQueue()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('verbose', "unsubscribeFromQueue()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('verbose', "unsubscribeFromQueue()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    let requestPath = "/messaging/subscriptions/queues/" + subscriptionId;
    
    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    var options = {
        method: 'DELETE',
        url: uri,
        headers: {
            'Content-type': 'application/json',
            'Accept-Language': 'en-us',
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: {},
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('verbose', "unsubscribeFromQueue()> options= "+ JSON.stringify(options), {logId: subscriptionId});
    return new Promise(function(resolve, reject) {
        request(options, function (error, response, body) {
            try{
                logger.log('info', "unsubscribeFromQueue()> Response received", {logId: subscriptionId});
                if (error) {
                    logger.log('error', error, {logId: subscriptionId});
                    logger.log('error', "unsubscribeFromQueue()> ####### ERROR #######", {logId: subscriptionId});
                    reject(error);
                } else {
                    logger.log('info', "unsubscribeFromQueue()> statusCode= " + response.statusCode, { logId: subscriptionId });
                    logger.log('debug', "unsubscribeFromQueue()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    resolve({ 'body': body, 'responseCode': response.statusCode});                
                }
            }catch(e){
                logger.log('error', e.stack, {logId: subscriptionId});
                reject(e);
            }
        });    
    }); 
};

/* Starts the message processing mechanism, if not already running.
*  If the connected ICWS session supports server sent events, then we will elect to use the message processing for
*  server sent events instead of short-polling
*/
async function startMessageProcessing(sessionId, cookie, userId, password, subscriptionId, csrfToken) {
    let eventSource = null;
    try{        
        logger.log('info', "startMessageProcessing()> sessionId= " + sessionId, {logId: subscriptionId});
        logger.log('info', "startMessageProcessing()> cookie= " + cookie, {logId: subscriptionId});

        if (typeof EventSource !== 'undefined' && icwsCurrentMessagingVersion >= icwsMessagingVersionForServerSentEvents) {
            logger.log('info', "startMessageProcessing()> Calling startServerSentEventsMessageProcessing() ", {logId: subscriptionId});
            eventSource = await startServerSentEventsMessageProcessing(sessionId, cookie, userId, password, subscriptionId, csrfToken);
        } else {
            logger.log('error', "startMessageProcessing()> Short message polling not implemented", {logId: subscriptionId});
            //startShortPollingMessageProcessing(sessionId, cookie, userId, password, subscriptionId, csrfToken);
        }
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }
    return eventSource;
}

/**
* Starts the message processing mechanism for server sent events, if not already running.
**/
function startServerSentEventsMessageProcessing(sessionId, cookie, userId, password, subscriptionId, csrfToken) {
    let eventSource = null;
    try{
        logger.log('info', "startServerSentEventsMessageProcessing()> sessionId= " + sessionId, {logId: subscriptionId});
        logger.log('info', "startServerSentEventsMessageProcessing()> cookie= " + cookie, {logId: subscriptionId});
        logger.log('info', "startServerSentEventsMessageProcessing()> csrfToken= " + csrfToken, {logId: subscriptionId});

        //logger.log('info', "startServerSentEventsMessageProcessing ()> ################################ EventSource= " + JSON.stringify(EventSource), {logId: subscriptionId});
        
        if (EventSource) {
            let messagesUrl = utils.icwsUri("/messaging/messages", sessionId, subscriptionId);
            logger.log('info', "startServerSentEventsMessageProcessing ()> messagesUrl= " + messagesUrl, {logId: subscriptionId});

            let eventSourceInitDict = { headers: { 'Cookie': cookie, https: { rejectUnauthorized: false } } };
            logger.log('debug', "startServerSentEventsMessageProcessing ()> eventSourceInitDict= " + JSON.stringify(eventSourceInitDict), {logId: subscriptionId});
        
            eventSource = new EventSource(messagesUrl, eventSourceInitDict)
            // Add in some event handlers to display the status of the EventSource socket.
            eventSource.onopen = function () {
                //icwsDirectUsageExample.diagnostics.reportInformationalMessage('EventSource socket was opened.', null);
                logger.log('info', "startServerSentEventsMessageProcessing ()> EventSource socket was opened for user = " + userId, {logId: subscriptionId});               
            };
            eventSource.onerror = function () {
                var status;
                switch (eventSource.readyState) {
                    case EventSource.CONNECTING:
                        //console.log(EventSource);
                        status = 'EventSource socket is reconnecting.';
                        break;
                    case EventSource.CLOSED:
                        status = 'EventSource socket was closed.';
                        break;
                }
                logger.log('debug', "startServerSentEventsMessageProcessing ()> status= " + status, {logId: subscriptionId});
            };

            eventSource.addEventListener('message', function (e) {
                processMessage(JSON.parse(e.data));
            });
        }
        else {
            logger.log('debug', "startServerSentEventsMessageProcessing()> EventSource object is null ", {logId: subscriptionId});
        }
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }
    return eventSource;
};

/**
 * Calls the registered callback for a message received from the server.
 * @see startMessageProcessing
 * @see stopMessageProcessing
 */
function processMessage(jsonMessage) {
    let subscriptionId = null;

    try{
        var messageType, messageCallback;
        let fullMessageType = jsonMessage.__type;
        let splitMessageTypeArray = fullMessageType.split(":");
        messageType =splitMessageTypeArray[splitMessageTypeArray.length-1];
        
        let userId = null;
        if(jsonMessage.userStatusList){
            userId = jsonMessage.userStatusList[0].userId;
        }
        
        if(jsonMessage.subscriptionId){
            subscriptionId = jsonMessage.subscriptionId;
        }
        
        //for offering event 
        let interactionId = null;
        
        if(jsonMessage.interactionsAdded){
            logger.log('info', "processMessage()> (interactionsAdded)length= " + jsonMessage.interactionsAdded.length, {logId: subscriptionId});
            if(jsonMessage.interactionsAdded.length > 0){
                interactionId = jsonMessage.interactionsAdded[0].interactionId;
                logger.log('info', "processMessage()> (interactionsAdded)interactionId= " + interactionId, {logId: subscriptionId});
            }
            
        }
        if(jsonMessage.interactionsChanged){
            logger.log('info', "processMessage()> (interactionsChanged)length= " + jsonMessage.interactionsChanged.length, {logId: subscriptionId});
                if(jsonMessage.interactionsChanged.length > 0){
                    interactionId = jsonMessage.interactionsChanged[0].interactionId;
                    logger.log('info', "processMessage()> (interactionsChanged)interactionId= " + interactionId, {logId: subscriptionId});
                }
            
        }
        if(jsonMessage.interactionsRemoved){
            logger.log('info', "processMessage()> (interactionsRemoved)length= " + jsonMessage.interactionsRemoved.length, {logId: subscriptionId});
            if(jsonMessage.interactionsRemoved.length > 0){
                interactionId = jsonMessage.interactionsRemoved[0];
                logger.log('info', "processMessage()> (interactionsRemoved)interactionId= " + interactionId, {logId: subscriptionId});
            }
            
        }

        // For each message, invoke a registered message callback if there is one;
        // otherwise, invoke the unhandled message callback.
        messageCallback = icwsMessageCallbacks[messageType];

        if (messageCallback) {
            messageCallback(jsonMessage);
        } else if (icwsUnhandledMessageCallback !== null) {
            icwsUnhandledMessageCallback(jsonMessage);
        }
        
        ser.sendMsg(userId,subscriptionId,interactionId, messageType,jsonMessage);
        //Send ready request to dialer
        if(messageType == "userStatusMessage"){
            if(jsonMessage){
                if(jsonMessage.userStatusList.length >= 1){
                    if(jsonMessage.userStatusList[0].statusId == 'Available'){
                        //there is no subscriptionId in available message
                        subscriptionId = utils.getMapUsers(userId).subscriptionId;
                        logger.log('info', "processMessage()> Selected status is= " + jsonMessage.userStatusList[0].statusId+ ", Calling readyForCalls()", {logId: subscriptionId}); 
                        let userDetails = utils.getMapUsers(userId);
                        dialer.readyForCalls(userId, userDetails.sessionId,userDetails.csrfToken,subscriptionId, userDetails.cookie); 
                    }                     
                }
            }              
        }

    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }
};

/**
* Updates the specified user's status.
* Sample request
* {"accept-language":"en-us","csrftoken":"csrftoken","content-type":"application/json","sessionid":"54613001","set-cookie":["icws_54613001=a9e2a927-ea3e-4794-a8d9-1598c504a6f4|languageId=en-us; Path=/icws/54613001; HttpOnly"]}
*/
exports.updateUserStatus = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;

    let cookie = req.get('set-cookie');
    let userId = req.body.userId;
    let payload = { "statusId" : req.body.statusId };

    logger.log('info', "updateUserStatus()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "updateUserStatus()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "updateUserStatus()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "updateUserStatus()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "updateUserStatus()> userId= " + userId, {logId: subscriptionId});
    
    logger.log('info', "updateUserStatus()> subscriptionId= " + subscriptionId, {logId: subscriptionId});
    logger.log('info', "updateUserStatus()> payload= " + JSON.stringify(payload), {logId: subscriptionId});

    let requestPath = "/status/user-statuses/" + userId;

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "updateUserStatus()> uri= " + uri);

    var options = {
        method: req.method,
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: payload,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('debug', "updateUserStatus()> options= " + JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "updateUserStatus()> Response received", {logId: subscriptionId});
            logger.log('info', "updateUserStatus()> statusCode = "  + response.statusCode, {logId: subscriptionId});

            if (error) {
                logger.log('error', error); 
                logger.log('error', "updateUserStatus()> ####### ERROR #######", {logId: subscriptionId});                      
                res.status(200).json({ 'error': error.message, 'responseMessage': 'User('+ userId + ') status change failed'});
            } else {
                if (response.statusCode == 202) {     
                    logger.log('info', "updateUserStatus()> ####### SUCCESS #######", {logId: subscriptionId});   
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});                     
                }
                else{
                    logger.log('debug', "updateUserStatus()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};


function GetIcwsCurrentMessagingVersion(result){
    // Cache the supported messaging version for this ICWS session connection.
    // This is used to help determine if we can use server sent events over short-polling for message processing.
    // The features property is an array that does not guarantee index positions of features,
    //   so we need to search it for the featureId we are interested in.  
  
    if (result.body["features"]) {
      for (var i=result.body["features"].length - 1; i >= 0; i--) {
        var featureObject = result.body["features"][i];
        if (featureObject.featureId === 'messaging') {
          icwsCurrentMessagingVersion = featureObject.version;
          break;
        }
      }
    }
    logger.log('verbose',  "GetIcwsCurrentMessagingVersion()> icwsCurrentMessagingVersion= " + icwsCurrentMessagingVersion);

  };

  /**
 * Stops the message processing mechanism, if running.
 * @see startMessageProcessing
 */
function stopMessageProcessing(userId, subscriptionId) {
    try{
        // Call the appropriate stop based on if we used server sent events or short-polling.
        if (utils.getMapUsers(userId)) {
            logger.log('info', "stopMessageProcessing()> Calling stopServerSentEventsMessageProcessing()", {logId: subscriptionId});
            stopServerSentEventsMessageProcessing(userId,subscriptionId);
        } else {
            logger.log('info', "stopMessageProcessing()> Calling stopShortPollingMessageProcessing()", {logId: subscriptionId});
            stopShortPollingMessageProcessing();
        }
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }     
}

/**
 * Stops the message processing mechanism for server sent events, if running.
 * @see startMessageProcessing
 * @see stopMessageProcessing
 */
function stopServerSentEventsMessageProcessing(userId,subscriptionId) {
    try{
        let userDetails = utils.getMapUsers(userId);
        if (!!userDetails) {
            userDetails.eventSource.close();
            logger.log('info', "stopServerSentEventsMessageProcessing()> eventSource closed for user= "+ userId, {logId: subscriptionId});
            utils.deleteMapUsers(userId, subscriptionId);
        }
    }catch(e){
        logger.log('error', e.stack, {logId: subscriptionId});
    }    
}

 /**
 * Stops the message processing mechanism for short-polling, if running.
 * @see startMessageProcessing
 * @see stopMessageProcessing
 */
function stopShortPollingMessageProcessing() {
    if (!!messageProcessingTimerId) {
        clearTimeout(messageProcessingTimerId);
        messageProcessingTimerId = null;
    }
}