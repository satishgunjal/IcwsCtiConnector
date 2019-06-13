"use strict";

var express = require("express");
var router = express.Router();

var webController = require("../controllers/webController");

router.use(function timeLog(req, res, next) {
  next();
});

//Serve the webpage
router.get("/", webController.get_home);

module.exports = router;
