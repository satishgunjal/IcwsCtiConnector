"use strict";
const express = require("express");
const router = express.Router();

//var agentController = require("../controllers/agentController_old");
var agentController = require("../controllers/agentController");

var dialerController = require("../controllers/dialerController");
var callController = require("../controllers/callController");

router.use(function timeLog(req, res, next) {
  next();
});

router.get("/agent/connection", agentController.connectionState);
router.post("/agent/connection", agentController.agentLogin);
router.delete("/agent/connection", agentController.agentLogout);
router.get("/agent/statusMessages", agentController.getAllStatusMessages);
router.put("/agent/status", agentController.updateUserStatus);

router.post("/call/outbound", callController.createCallParameters);
router.post("/call/answer", callController.answer);
router.post("/call/disconnect", callController.disconnect);
router.post("/call/hold", callController.hold);
router.get("/call/recording/:recordingId/recordingUri", callController.recordingUri);
router.post("/call/:interactionId/code/:wrapupCode/wrapup", callController.wrapup);

router.post("/dialer/login", dialerController.dialerLogin);
router.post("/dialer/code/:wrapupCode/wrapup", dialerController.disposition);
router.post("/dialer/logout", dialerController.dialerLogout);

module.exports = router;