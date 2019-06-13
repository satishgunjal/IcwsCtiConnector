//Ref https://thisdavej.com/using-winston-a-versatile-logging-library-for-node-js/
// FOr db login ref. https://codesquery.com/nodejs-logging-tutorial/#Save_logs_into_Database

'use strict';
const { createLogger, transports } = require('winston');
require('winston-daily-rotate-file'); //npm install winston-daily-rotate-file --save 
require('winston-mongodb'); //npm install winston-mongodb --save 
const config = require("./config");

const logger = createLogger({  

  transports: [
    new transports.Console(config.logs.console),
    new transports.DailyRotateFile(config.logs.file),
    new transports.MongoDB(config.logs.mongodb)
  ]
});


module.exports = logger;