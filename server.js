const bodyParser = require("body-parser");

const morgan = require("morgan");  //required for logging all http requests
const moment = require('moment-timezone'); //required for logging timestamps

const agentController = require("./controllers/agentController");
const utils = require("./utils/common");
const logger = require("./logger"); //logger configuration
const config = require("./config"); //global configurations
const apiRouter = require("./routers/apiRouter");
const webRouter = require("./routers/webRouter");

const PORT = config.server.port;
const SERVER_TIMEOUT_MS = config.server.timeoutMs;
const LOGOUT_TIMEOUT_MS = config.logoutTimeout.timeoutMs;

const express = require("express");
const cors = require('cors');
const JSON = require("circular-json");

//For http 
// var app = express()
//   , server = require('http').createServer(app)
//   , io = require('socket.io').listen(server);

//for https
//To test from postman disable 'SSL certificate verification'
let fs = require('fs')
let path = require('path')
let privateKey = fs.readFileSync(path.join(__dirname, 'server.key'), 'utf8');
let certificate = fs.readFileSync(path.join(__dirname, 'server.cert'), 'utf8');
let credentials = { key: privateKey, cert: certificate };

//Using Oberoi provided certificate
let options = {
  pfx: fs.readFileSync(path.join(__dirname, 'cticonnector.oberoirealty.com.pfx')),
  passphrase: 'oberoirealty@123'
};

let app = express()
  , server = require('https').createServer(options, app) // use 'credentials' obj for self signed certificate
  , io = require('socket.io').listen(server);


app.set("view engine", "pug");
app.use(express.static("public"));

morgan("tiny");

//defining timestamp format
morgan.token("date", (req, res, tz) => {
  return moment()
    .tz(tz)
    .format();
});

morgan.format(
  "myformat",
  config.logs.morgan.format
);

app.use(cors({ credentials: true, origin: true }))
app.use(morgan("myformat", { stream: { write: message => logger.info(message.trim()) } }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/", webRouter);
app.use("/api", apiRouter);


io.on('connection', function (socket) {

  socket.on('disconnecting', (reason) => {
    socket_disconnecting(socket, reason);      
  });

  socket.on('disconnect', (reason) =>  {
    socket_disconnect(socket, reason); 
  });

  socket.on('LOGIN', function (req, ack) {
    let logId = null;
    try{
      if(req.userId != null && req.userId != "" && req.subscriptionId != null && req.subscriptionId != ""){
        logId = req.subscriptionId;
        logger.log('info', "socket LOGIN> Sending socket logout request to remove any previous rooms if present.", { logId: logId });
        socket_logout(socket, req.userId, req.subscriptionId)
        socket_login(socket, req, ack);
        }else{
          logger.log('warn', "socket LOGIN> UserId and subscriptionId are missing unable to login the socket", { logId: logId });
          ack("Invalid request. UserId and subscriptionId are required");
        } 
    }catch(e){
      logger.log('error', e.stack, {logId: logId});
    }       
  });

  socket.on('JOIN_ROOM', function (req, ack) {
    let logId = null;
    try{
      if(req.userId != null && req.userId != "" && req.subscriptionId != null && req.subscriptionId != ""){
        logId = req.subscriptionId;
        socket_join(socket, req, ack);    
      }else{
        logger.log('warn', "socket JOIN_ROOM> UserId and subscriptionId are missing unable to perform socket join room", { logId: logId });
        ack("Invalid request. UserId and subscriptionId are required");
      }   
    }catch(e){
      logger.log('error', e.stack, {logId: logId});
    }     
  });

  socket.on('LOGOUT', function (req, ack) {
    let logId = null;
    try{
      if(req.userId != null && req.userId != "" && req.subscriptionId != null && req.subscriptionId != ""){
        logId = req.subscriptionId;
        logger.log('info', "socket LOGOUT> req= " + JSON.stringify(req), { logId: logId });
        let result = socket_logout(socket, req.userId,req.subscriptionId);
        logger.log('info', "socket LOGOUT> Socket logout "+ result, { logId: logId });
        ack(result);
      }else{
        logger.log('warn', "socket LOGOUT> UserId and subscriptionId are missing unable to logout the socket", { logId: logId });
        ack("Invalid request. UserId and subscriptionId are required");
      }      
    }catch(e){
      logger.log('error', e.stack, {logId: logId});
      ack("Error");
    }     
  });

});

function socket_login(socket, req, ack){
  let logId = null;
  try{

    logId = req.subscriptionId;

    logger.log('info', "socket_login()>  Request received for LOGIN: " + JSON.stringify(req), { logId: logId });

    if (req.userId) {
      socket.join(req.userId);
      logger.log('info', "socket_login()> " + req.userId + " added to socket room", { logId: logId });
      logger.log('info', "socket_login()> rooms= " + JSON.stringify(socket.rooms), { logId: logId });
      let socketRoomCount = GetSocketRoomCount(req.userId, logId);
      logger.log('info', "socket_login()> socketRoomCount = " + socketRoomCount, { logId: logId });
    }
    ack("Success");
    logger.log('info', "socket_login()> Socket login success", { logId: logId });
  }catch(e){
    logger.log('error', e.stack, {logId: logId});
  }
}

function socket_join(socket, req, ack){
  let logId = null;
  try{
    
    logId = req.subscriptionId;

    logger.log('info', "socket_join()>  Request received for JOIN_ROOM: " + JSON.stringify(req), { logId: logId });

    if (req.userId) {
      socket.join(req.userId);

      logger.log('info', "socket_join()> " + req.userId + " added to socket room", { logId: logId });
      logger.log('info', "socket_join()> rooms= " + JSON.stringify(socket.rooms), { logId: logId });
      let socketRoomCount = GetSocketRoomCount(req.userId, logId);
      logger.log('info', "socket_join()> socketRoomCount = " + socketRoomCount, { logId: logId });
    }
    ack("Success");
    logger.log('info', "socket_join()> Socket JOIN_ROOM success", { logId: logId });
  }catch(e){
    logger.log('error', e.stack, {logId: logId});
  }
}

function socket_logout(socket, userId, subscriptionId){
  let result = null;
  let logId = null;
  try{
    logId = subscriptionId;

    logger.log('info', "socket_logout()> userId= " + userId, { logId: logId });
    let socketRoomCount = GetSocketRoomCount(userId, logId);
    logger.log('info', "socket_logout()> socketRoomCount = " + socketRoomCount, { logId: logId });    
    
    logger.log('verbose', "socket_logout()> (before removing rooms)rooms= " + JSON.stringify(socket.rooms), { logId: logId });
    
    //  socket.leave(userId);
    // logger.log('info', "socket_logout()> " + userId + " removed from socket room", { logId: logId });

    if(io.sockets.adapter.rooms[userId]){
      var clients_in_the_room = io.sockets.adapter.rooms[userId].sockets; 
      logger.log('info', "socket_logout()*> clients_in_the_room= " + JSON.stringify(clients_in_the_room), { logId: logId });
      for (var clientId in clients_in_the_room ) { 
          logger.log('info', "socket_logout()> client= " + JSON.stringify(clientId), { logId: logId });
          io.sockets.connected[clientId].leave(userId);
          logger.log('info', "socket_logout()> " + userId + " removed from socket room", { logId: logId });
      }    
      logger.log('verbose', "socket_logout()> rooms= " + JSON.stringify(socket.rooms), { logId: logId });  
    }else
    {
      logger.log('verbose', "socket_logout()> No socket rooms found", { logId: logId }); 
    }
         

    result = "Success";
  }catch(e){
    result = "Error";
    logger.log('error', e.stack, {logId: logId});
  }
  return result;
}

function socket_disconnecting(socket, reason){
  let logId = null;
              
  try{
    let rooms = Object.keys(socket.rooms);
    logger.log('verbose', "socket_disconnecting()> rooms=" + JSON.stringify(rooms), { logId: logId});
    logger.log('verbose', "socket_disconnecting()> user disconnecting. reason=" + JSON.stringify(reason), { logId: logId});
    if(rooms)
    {   
      logger.log('info', "socket_disconnecting()> rooms.length=" + rooms.length, { logId: logId});   
      if(rooms.length > 1){
        let userId = rooms[0];
        let userDetails = utils.getMapUsers(userId);
        logger.log('info', "socket_disconnecting()> userDetails= " + JSON.stringify(userDetails), { logId: logId });
        if(userDetails){
          logId = userDetails.subscriptionId;        

          logger.log('verbose', "socket_disconnecting()> rooms userId=" + userId, { logId: logId });
          let socketRoomCount = GetSocketRoomCount(userId, logId);
          logger.log('info', "socket_disconnecting()> socketRoomCount = " + socketRoomCount, { logId: logId });
          //if socket room count is 1 then check if user details present in usermap.
          //if userdetails are present means user closed all the tabs without logging out.
          if(socketRoomCount == 1){ 
            logger.log('info', "socket_disconnecting()*> Callback function will exceute after "+ LOGOUT_TIMEOUT_MS + " MS", { logId: logId });               
            setTimeout( async function () {
              logger.log('info', "socket_disconnecting()*> userId = " + userId, { logId: logId }); 
              let socketRoomCount = GetSocketRoomCount(userId, logId);
              logger.log('info', "socket_disconnecting()*> socketRoomCount = " + socketRoomCount, { logId: logId });
              if (socketRoomCount === 0) {
                logger.log('info', "socket_disconnecting()*> Since socketRoomCount is '0' sending agent logout request", { logId: logId });
                 let result  = await agentController.processAgentLogout(userId, userDetails.sessionId, userDetails.csrfToken, userDetails.cookie, userDetails.subscriptionId) ;
                 logger.log('info', "socket_disconnecting()*()> result= "+ JSON.stringify(result), {logId: userDetails.subscriptionId});
                 socket_logout(socket, userId, userDetails.subscriptionId);
              }else{
                logger.log('info', "socket_disconnecting()*> socketRoomCount is not '0'. One or more tab is still open.", { logId: logId });
              }              
             }, LOGOUT_TIMEOUT_MS);
          }
        }else{
          logger.log('info', "socket_disconnecting()> UserDetails are null", { logId: logId });
        }                
      }else{
        logger.log('verbose', "socket_disconnecting()> SInce room length is <= 1, ignoring this event" + rooms.length, { logId: logId });   
      }  
    }   
  }catch(e){
    logger.log('error', e.stack, {logId: logId});
  }
}

function socket_disconnect(socket, reason){
  try{      
    logger.log('verbose', "socket_disconnect()> user disconnected. reason= "+ JSON.stringify(reason), { logId: "undefined" });
  }catch(e){
    logger.log('error', e.stack, {logId: "subscriptionId"});
  }
}

exports.sendMsg = function (userId, subscriptionId, interactionId, eventType, jsonMsg) {

  //if only userid present and ubscription id is null then we can get the subscription id from "mapSubscriptionIdUserId"
  //This is used for "eventType = userStatusMessage" where we get only userid.

  //logger.log('info', "sendMsg()> I/P: userId = " + userId, {logId: "NULL"});
  //logger.log('info', "sendMsg()> I/P: subscriptionId = " + subscriptionId, {logId: "NULL"});

  let userDetails = null;
  if (userId != null && subscriptionId == null) {
    userDetails = utils.getMapUsers(userId);
    subscriptionId = userDetails.subscriptionId;
    logger.log('info', "socket sendMsg> subscriptionIdFromMap= " + subscriptionId, { logId: subscriptionId });
  }

  //if userid is null and subscription id is not null then take userid from subscription id
  if (userId == null && subscriptionId != null) {
    userId = subscriptionId.split('-')[0];
    logger.log('info', "socket sendMsg> userId from subscriptionid= " + userId, { logId: subscriptionId });
  }

  //Creating logId
  let logId = "NULL";
  if (subscriptionId) {
    logId = subscriptionId;
    if (interactionId) {
      logId = logId + "-" + interactionId;
    }
  }

  logger.log('info', "sendMsg()> I/P: logId = " + logId, { logId: logId });


  logger.log('info', "sendMsg()> I/P: userId = " + userId, { logId: logId });
  logger.log('info', "sendMsg()> I/P: subscriptionId = " + subscriptionId, { logId: logId });
  logger.log('info', "sendMsg()> I/P: interactionId = " + interactionId, { logId: logId });
  logger.log('info', "sendMsg()> I/P: eventType = " + eventType, { logId: logId });
  logger.log('info', "sendMsg()> I/P: jsonMsg = " + JSON.stringify(jsonMsg), { logId: logId });

  if (userId) {
    //mapUserIdSocketObj.get(userId).emit(eventType, jsonMsg);
    //Send this event to everyone in the room.
    io.sockets.in(userId).emit(eventType, jsonMsg);
    logger.log('info', "sendMsg()> Message sent to room= " + userId, { logId: logId });
  } else {
    logger.log('warn', "sendMsg()> Since userId and subscriptionId are null, unable to send message to client", { logId: logId });
  }
}

function GetSocketRoomCount(userId, logId){
  let roomCount = 0
   try{

    let room = io.sockets.adapter.rooms[userId];
    if (room) {
      roomCount = room.length;
    }

   }catch (e) {
        logger.log('error', e.stack, { logId: logId });
    }

    return roomCount;   
}

/**
 * Sets the timeout value for sockets, and emits a 'timeout' event on the Server object, passing the socket as an argument, if a timeout occurs.
 * If there is a 'timeout' event listener on the Server object, then it will be called with the timed-out socket as an argument.
 * By default, the Server's timeout value is 2 minutes, and sockets are destroyed automatically if they time out. However, if you assign a callback to the Server's 'timeout' event, then you are responsible for handling socket timeouts.
 */
server.setTimeout(SERVER_TIMEOUT_MS);
server.listen(PORT, () => {
  logger.log('info', "Genesys ICWS CTI Adapter is listening on port " + PORT + ". SERVER_TIMEOUT_MS= " + SERVER_TIMEOUT_MS + ", REQUEST_TIMEOUT_MS= " + config.request.timeoutMs+ " , LOGOUT_TIMEOUT_MS= "+ LOGOUT_TIMEOUT_MS, { logId: "NULL" });
  
});