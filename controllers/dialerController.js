"use strict";

const JSON = require("circular-json");
const request = require("request");
var _ = require("lodash");
var utils = require("../utils/common.js");
const logger = require("./../logger");
const config = require("./../config");
const ser = require("./../server")

/**
 * timeout - integer containing number of milliseconds, controls two timeouts.
 * Read timeout: Time to wait for a server to send response headers (and start the response body) before aborting the request.
 * Connection timeout: Sets the socket to timeout after timeout milliseconds of inactivity. Note that increasing the timeout beyond the OS-wide TCP connection timeout will not have any effect
 */
const REQUEST_TIMEOUT_MS = config.request.requestTimeoutMs;
const CONTENT_TYPE = config.request.contentType;
const ACCEPT_LANGUAGE = config.request.acceptLanguage;

let campaignId = config.icwsDialer.abandonedCallsCampaignid;

/**
 * Logs the agent in to Dialer.
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/dialer/log-in/index.htm#post
 */
exports.dialerLogin = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;

    let cookie = req.get('set-cookie');
    let userId = req.body.userId;

    let paylod= {campaignId: campaignId};

    logger.log('info', "dialerLogin()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "dialerLogin()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "dialerLogin()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "dialerLogin()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "dialerLogin()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "dialerLogin()> paylod= " + JSON.stringify(paylod), {logId: subscriptionId});
    logger.log('info', "dialerLogin()> userId= " + userId, {logId: subscriptionId});

    let requestPath = "/dialer/log-in";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "dialerLogin()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: 'POST',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: paylod,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('info', "dialerLogin()> options= " +JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "dialerLogin()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', "dialerLogin()> ####### ERROR #######", {logId: subscriptionId});
                logger.log('error', error, {logId: subscriptionId});
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Dialer login failed' }, {logId: subscriptionId});
            } else {
                logger.log('info', "dialerLogin()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 200) {
                    logger.log('info', "dialerLogin()> The request to log in to Dialer succeeded.", {logId: subscriptionId});
                    logger.log('info', "dialerLogin()> ####### SUCCESS #######", {logId: subscriptionId});
        
                    ser.sendMsg(userId,subscriptionId,null, 'DIALER_LOGGED_IN', { 'body': body, 'responseCode': 0, 'responseMessage': 'Success'})
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                    exports.readyForCalls(userId, sessionId,csrfToken,subscriptionId, cookie);
                }
                else{
                    logger.log('debug', "dialerLogin()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    //ser.sendMsg(userId,subscriptionId,null, 'dialerLogin_Resp', {'body': body, 'responseCode': response.statusCode})
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
            //ser.sendMsg(userId,subscriptionId,null, 'dialerLogin_Resp', {'error': e.message, 'responseMessage': 'Dialer login failed' })
            res.status(200).json({ 'error': e.message, 'responseMessage': 'Dialer login failed' });
        }
    });    
};

/**
 * Notifies Dialer that the agent is ready to start receiving calls.
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/dialer/ready-for-calls/index.htm#resource
 */
exports.readyForCalls = function(userId, sessionId,csrfToken,subscriptionId, cookie) {

    let paylod={campaignIds: [campaignId]};

    logger.log('info', "readyForCalls()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "readyForCalls()> userId= " + userId, {logId: subscriptionId});

    logger.log('info', "readyForCalls()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "readyForCalls()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "readyForCalls()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "readyForCalls()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "readyForCalls()> paylod= " + JSON.stringify(paylod), {logId: subscriptionId});

    let requestPath = "/dialer/ready-for-calls";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "readyForCalls()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: 'POST',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: paylod,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('debug', "readyForCalls()> options= " +JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "readyForCalls()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', "readyForCalls()> ####### ERROR #######", {logId: subscriptionId});
                logger.log('error', error, {logId: subscriptionId});
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Dialer login failed' }, {logId: subscriptionId});
            } else {
                logger.log('info', "readyForCalls()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 200) {
                    logger.log('info', "readyForCalls()> The request to log in to Dialer succeeded.", {logId: subscriptionId});
                    logger.log('info', "readyForCalls()> ####### SUCCESS #######", {logId: subscriptionId});
                    ser.sendMsg(userId,subscriptionId,null, "DIALER_AGENT_READY",{ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "readyForCalls()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    ser.sendMsg(userId,subscriptionId,null, "readyForCalls_Resp",{ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
            ser.sendMsg(userId,subscriptionId,null, "readyForCalls_Resp",{ 'error': e.message, 'responseMessage': 'Dialer login failed' });            
        }
    });    
};

/**
* Dispositions the last Dialer call for the agent and sends the result back to Dialer. 
* Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/dialer/disposition/index.htm#resource
*/
exports.disposition = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;

    let cookie = req.get('set-cookie');
    let userId = req.body.userId;
    let payload = {label:req.params.wrapupCode, placeAdditionalFollowUpCall: false, isAbandon: false, };//,  callAttributes: req.body.attributes}

    logger.log('info', "disposition()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "disposition()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "disposition()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "disposition()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "disposition()> userId= " + userId, {logId: subscriptionId});
    
    logger.log('info', "disposition()> subscriptionId= " + subscriptionId, {logId: subscriptionId});
    logger.log('info', "disposition()> payload= " + JSON.stringify(payload), {logId: subscriptionId});

    let requestPath = "/dialer/disposition";    

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "disposition()> uri= " + uri);

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

    logger.log('debug', "disposition()> options= " + JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "disposition()> Response received", {logId: subscriptionId});
            logger.log('info', "disposition()> statusCode = "  + response.statusCode, {logId: subscriptionId});

            if (error) {
                logger.log('error', error); 
                logger.log('error', "disposition()> ####### ERROR #######", {logId: subscriptionId});                      
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Dialer call disposition failed'});
            } else {
                if (response.statusCode == 200) {     
                    logger.log('info', "disposition()> ####### SUCCESS #######", {logId: subscriptionId});  

                    ser.sendMsg(userId,subscriptionId,null, 'DIALER_DISPOSITION', {'body': body, 'responseCode': 0, 'responseMessage': 'Success'}) 
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});                     
                }
                else{
                    logger.log('debug', "disposition()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    ser.sendMsg(userId,subscriptionId,null, 'DIALER_DISPOSITION', { 'body': body, 'responseCode': response.statusCode}) 
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            ser.sendMsg(userId,subscriptionId,null, 'DIALER_DISPOSITION', { 'error': e.message, 'responseMessage': 'Dialer call disposition failed' });
            res.status(200).json({ 'body': body, 'responseCode': response.statusCode}); 
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};

/**
 * Logout the agent from Dialer.
 * API Ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/icws/(sessionId)/dialer/log-off/index.htm#resource
 */
exports.dialerLogout = function (req, res) {
     //** Header keys are always in lower case */
     let sessionId = req.headers.sessionid;
     let csrfToken = req.headers.csrftoken;
     let subscriptionId = req.headers.subscriptionid;
 
     let cookie = req.get('set-cookie');
     let userId = req.body.userId;

    let paylod= {campaignIds: [campaignId]};

    logger.log('info', "dialerLogout()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "dialerLogout()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "dialerLogout()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "dialerLogout()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "dialerLogout()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "dialerLogout()> paylod= " + JSON.stringify(paylod), {logId: subscriptionId});
    logger.log('info', "dialerLogout()> userId= " + userId, {logId: subscriptionId});

    let requestPath = "/dialer/log-off";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "dialerLogout()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: 'POST',
        url: uri,
        headers: {
            'Content-type': CONTENT_TYPE,
            'Accept-Language': ACCEPT_LANGUAGE,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: paylod,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('info', "dialerLogout()> options= " +JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "dialerLogout()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', "dialerLogout()> ####### ERROR #######", {logId: subscriptionId});
                logger.log('error', error, {logId: subscriptionId});
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Dialer logout failed' }, {logId: subscriptionId});
            } else {
                logger.log('info', "dialerLogout()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 200) {
                    logger.log('info', "dialerLogout()> Dialer logout succeeded.", {logId: subscriptionId});
                    logger.log('info', "dialerLogout()> ####### SUCCESS #######", {logId: subscriptionId});
        
                    //ser.sendMsg(userId,subscriptionId,null, 'dialerLogout_Resp', { 'body': body, 'responseCode': 0, 'responseMessage': 'Success'})
                    ser.sendMsg(userId,subscriptionId,null, 'DIALER_LOGGED_OUT', {'body': body, 'responseCode': 0, 'responseMessage': 'Success'})
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "dialerLogout()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    //ser.sendMsg(userId,subscriptionId,null, 'dialerLogout_Resp', {'body': body, 'responseCode': response.statusCode})
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
            //ser.sendMsg(userId,subscriptionId,null, 'dialerLogout_Resp', {'error': e.message, 'responseMessage': 'Dialer logout failed' })
            res.status(200).json({ 'error': e.message, 'responseMessage': 'Dialer logout failed' });
        }
    });    
};
