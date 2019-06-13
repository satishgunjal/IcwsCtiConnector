"use strict";
const JSON = require("circular-json");
const request = require("request");

const _ = require("lodash");
const utils = require("../utils/common.js");

const config = require("./../config");
const logger = require("./../logger");
const ser = require("./../server")

const REQUEST_TIMEOUT_MS = config.request.timeoutMs;
const CONTENT_TYPE = config.request.contentType;
const ACCEPT_LANGUAGE = config.request.acceptLanguage;

/**
 * Performs a pickup on the interaction..
 */
exports.answer = function (req, res) {
        
    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;

    let contentType = req.headers['content-type'];
    let acceptLanguage = req.headers['accept-language'];
    let cookie = req.get('set-cookie');
    let interactionId = req.body.interactionId

    logger.log('info', "answer()> ####### START ####### ", {logId: subscriptionId});

    //logger.log('info', "answer()> req.headers= " + JSON.stringify(req.headers), {logId: subscriptionId});
    //logger.log('info', "answer()> req.body= " + JSON.stringify(req.body), {logId: subscriptionId});

    logger.log('info', "answer()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "answer()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "answer()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "answer()> method= " + req.method, {logId: subscriptionId});
    logger.log('info', "answer()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "answer()> interactionId= " + interactionId, {logId: subscriptionId});

    let requestPath = "/interactions/" + interactionId + "/pickup";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('info', "answer()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: req.method,
        url: uri,
        headers: {
            'Content-type': contentType,
            'Accept-Language': acceptLanguage,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: {},
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('info', "answer()> options= "+ JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "answer()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', error, {logId: subscriptionId});
                logger.log('error', "answer()> ####### ERROR #######", {logId: subscriptionId});            
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Call answer failed' });
            } else {
                logger.log('info', "answer()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 200) {
                    logger.log('info', "answer()> The action was successfully performed", {logId: subscriptionId});
                    logger.log('info', "answer()> ####### SUCCESS #######", {logId: subscriptionId});

                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "answer()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e)
        {
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};

/**
 * Disconnects the interaction.
 */
exports.disconnect = function (req, res) {
    
    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;

    let contentType = req.headers['content-type'];
    let acceptLanguage = req.headers['accept-language'];
    let cookie = req.get('set-cookie');
    let interactionId = req.body.interactionId

    logger.log('info', "disconnect()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "disconnect()> req.headers= " + JSON.stringify(req.headers), {logId: subscriptionId});
    logger.log('info', "disconnect()> req.body= " + JSON.stringify(req.body), {logId: subscriptionId});

    logger.log('info', "disconnect()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "disconnect()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "disconnect()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "disconnect()> method= " + req.method, {logId: subscriptionId});
    logger.log('info', "disconnect()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "disconnect()> interactionId= " + interactionId, {logId: subscriptionId});

    let requestPath = "/interactions/" + interactionId + "/disconnect";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('info', "disconnect()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: req.method,
        url: uri,
        headers: {
            'Content-type': contentType,
            'Accept-Language': acceptLanguage,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: {},
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('debug', "disconnect()> options= "+ JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "disconnect()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', error, {logId: subscriptionId});
                logger.log('error', "disconnect()> ####### ERROR #######", {logId: subscriptionId});
            
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Call disconnect failed' });
            } else {
                logger.log('info', "disconnect()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 200) {
                    logger.log('info', "disconnect()> The action was successfully performed", {logId: subscriptionId});
                    logger.log('info', "disconnect()> ####### SUCCESS #######", {logId: subscriptionId});

                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "disconnect()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};

/**
 * Places the interaction on hold or takes it off hold..
 * 
 * here property 'on' value can be true or false.
 * True = puts the interaction on hold
 * False = takes it off hold.
 */
exports.hold = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;

    let contentType = req.headers['content-type'];
    let acceptLanguage = req.headers['accept-language'];
    let cookie = req.get('set-cookie');
    let interactionId = req.body.interactionId
    let holdParameters = req.body.holdParameters

    logger.log('info', "hold()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "hold()> req.headers= " + JSON.stringify(req.headers), {logId: subscriptionId});;
    logger.log('info', "hold()> req.body= " + JSON.stringify(req.body), {logId: subscriptionId});

    logger.log('info', "hold()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "hold()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "hold()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "hold()> method= " + req.method, {logId: subscriptionId});
    logger.log('info', "hold()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "hold()> interactionId= " + interactionId, {logId: subscriptionId});
    logger.log('info', "hold()> holdParameters= " + JSON.stringify(holdParameters), {logId: subscriptionId});

    let requestPath = "/interactions/" + interactionId + "/hold";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "hold()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: req.method,
        url: uri,
        headers: {
            'Content-type': contentType,
            'Accept-Language': acceptLanguage,
            'ININ-ICWS-CSRF-Token': csrfToken,
            'Cookie': cookie
        },
        body: holdParameters,
        json: true,
        timeout: REQUEST_TIMEOUT_MS
    };

    logger.log('info', "hold()> options= " +JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "hold()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', "hold()> ####### ERROR #######", {logId: subscriptionId});
                logger.log('error', error, {logId: subscriptionId});
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Hold/unhold failed' }, {logId: subscriptionId});
            } else {
                logger.log('info', "hold()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 200) {
                    logger.log('info', "hold()> The action was successfully performed", {logId: subscriptionId});
                    logger.log('info', "hold()> ####### SUCCESS #######", {logId: subscriptionId});
        
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "hold()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};



exports.recordingUri = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;
    let recordingId = req.params.recordingId;
    let cookie = req.get('set-cookie');

    logger.log('info', "recordingUri()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "recordingUri()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "recordingUri()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "recordingUri()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "recordingUri()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "recordingUri()> recordingId= " + recordingId, {logId: subscriptionId});

    let requestPath = "/recordings/"+ recordingId +"/export-uri";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "recordingUri()> uri= " + uri, {logId: subscriptionId});

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

    logger.log('debug', "recordingUri()> options= " +JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "recordingUri()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', "recordingUri()> ####### ERROR #######", {logId: subscriptionId});
                logger.log('error', error, {logId: subscriptionId});
                res.status(200).json({ 'error': error.message, 'responseMessage': 'GET recordingUri failed' }, {logId: subscriptionId});
            } else {
                logger.log('info', "recordingUri()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 200) {
                    logger.log('info', "recordingUri()> The export URI is included in the response", {logId: subscriptionId});
                    logger.log('info', "recordingUri()> ####### SUCCESS #######", {logId: subscriptionId});

                    logger.log('info', "recordingUri()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "recordingUri()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};

exports.wrapup = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;    
    let cookie = req.get('set-cookie');

    let interactionId = req.params.interactionId;
    let wrapupCode = req.params.wrapupCode;

    logger.log('info', "wrapup()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "wrapup()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "wrapup()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "wrapup()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "wrapup()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "wrapup()> interactionId= " + interactionId, {logId: subscriptionId});
    logger.log('info', "wrapup()> wrapupCode= " + wrapupCode, {logId: subscriptionId});

    let payload = {code: wrapupCode, segmentId:3, time:new Date(new Date().toUTCString()).getTime(), user: subscriptionId.split("-")[0], sourceInteractionId:interactionId};

    logger.log('info', "wrapup()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "wrapup()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "wrapup()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "wrapup()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "wrapup()> cookie= " + cookie, {logId: subscriptionId});
    logger.log('info', "wrapup()> interactionId= " + interactionId, {logId: subscriptionId});
    logger.log('info', "wrapup()> wrapupCode= " + wrapupCode, {logId: subscriptionId});
    logger.log('info', "wrapup()> payload= " + JSON.stringify(payload), {logId: subscriptionId});

    let requestPath = "/interactions/"+ interactionId +"/wrap-up-assignments";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "wrapup()> uri= " + uri, {logId: subscriptionId});

    var options = {
        method: 'POST',
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

    logger.log('debug', "wrapup()> options= " +JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "wrapup()> Response received", {logId: subscriptionId});
            if (error) {
                logger.log('error', "wrapup()> ####### ERROR #######", {logId: subscriptionId});
                logger.log('error', error, {logId: subscriptionId});
                res.status(200).json({ 'error': error.message, 'responseMessage': 'ACD call disposition failed' }, {logId: subscriptionId});
            } else {
                logger.log('info', "wrapup()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 201) {
                    logger.log('info', "wrapup()> Wrap-up code is created and appended to the Interaction.", {logId: subscriptionId});
                    logger.log('info', "wrapup()> ####### SUCCESS #######", {logId: subscriptionId});

                    logger.log('info', "wrapup()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    ser.sendMsg(null,subscriptionId,null, 'ACD_DISPOSITION', { 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "wrapup()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    ser.sendMsg(null,subscriptionId,null, 'ACD_DISPOSITION', { 'body': body, 'responseCode': response.statusCode});
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            ser.sendMsg(null,subscriptionId,null, 'ACD_DISPOSITION', { 'error': e.message, 'responseMessage': 'ACD call disposition failed'});
            res.status(200).json({ 'error': e.message, 'responseMessage': 'ACD call disposition failed'});
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};

/**
 * To make outbound call.
 * ref. https://help.genesys.com/developer/cic/docs/icws/webhelp/ConceptualContent/GoingFurther_InteractionsAndQueues.htm#top
 * */
exports.createCallParameters = function (req, res) {

    //** Header keys are always in lower case */
    let sessionId = req.headers.sessionid;
    let csrfToken = req.headers.csrftoken;
    let subscriptionId = req.headers.subscriptionid;
    let cookie = req.get('set-cookie');
    let payload = req.body

    logger.log('info', "createCallParameters()> ####### START ####### ", {logId: subscriptionId});

    logger.log('info', "createCallParameters()> req.headers= " + JSON.stringify(req.headers), {logId: subscriptionId});
    logger.log('info', "createCallParameters()> req.body= " + JSON.stringify(req.body), {logId: subscriptionId});

    logger.log('info', "createCallParameters()> sessionId= " + sessionId, {logId: subscriptionId});
    logger.log('info', "createCallParameters()> csrfToken= " + csrfToken, {logId: subscriptionId});
    logger.log('info', "createCallParameters()> subscriptionId= " + subscriptionId, {logId: subscriptionId});

    logger.log('info', "createCallParameters()> method= " + req.method, {logId: subscriptionId});
    logger.log('info', "createCallParameters()> cookie= " + cookie, {logId: subscriptionId});

    logger.log('info', "createCallParameters()> payload= " + JSON.stringify(payload));

    let requestPath = "/interactions";

    let uri = utils.icwsUri(requestPath, sessionId, subscriptionId);

    logger.log('debug', "createCallParameters()> uri= " + uri);

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

    logger.log('debug', "createCallParameters()> options= " + JSON.stringify(options), {logId: subscriptionId});

    request(options, function (error, response, body) {
        try{
            logger.log('info', "createCallParameters()> Response received", {logId: subscriptionId});
            
            if (error) {
                logger.log('error', "createCallParameters()> ####### ERROR #######", {logId: subscriptionId});
                logger.log('error', error);
                res.status(200).json({ 'error': error.message, 'responseMessage': 'Create call parameters failed' }, {logId: subscriptionId});
            } else {
                logger.log('info', "createCallParameters()> statusCode= " + response.statusCode, {logId: subscriptionId});
                if (response.statusCode == 201) {
                    logger.log('info', "createCallParameters()> The interaction was created successfully", {logId: subscriptionId});
                    logger.log('info', "createCallParameters()> ####### SUCCESS #######", {logId: subscriptionId});
                   
                    res.status(200).json({ 'body': body, 'responseCode': 0, 'responseMessage': 'Success'});
                }
                else{
                    logger.log('debug', "createCallParameters()> body= " +  JSON.stringify(body), {logId: subscriptionId});
                    res.status(200).json({ 'body': body, 'responseCode': response.statusCode});
                }
            }
        }catch(e){
            logger.log('error', e.stack, {logId: subscriptionId});
        }
    });    
};