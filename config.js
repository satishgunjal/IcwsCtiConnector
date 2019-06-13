//Important: Set the env to either development or production to use the appropriate config
/****************************************/
const env = "production"; // 'development' or 'production'
/*******************************************/

let appRoot = require("app-root-path");
const { format } = require("winston");
//const { combine, timestamp, printf } = format;
const timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS';


//All Configurations
const development = {
  server: {
    port: 9090,
    timeoutMs: 12000
  },
  request: {    
    timeoutMs: 10000,
    contentType: 'application/json',
    acceptLanguage: 'en-us'
  },
  logoutTimeout: {    
    timeoutMs: 90000
  },
  icws: {
    server: '10.12.248.7',
    uriScheme: 'http://' ,
    uriPort: '8018',
    uriPath: '/icws',
    messageRetrievalIntervalMs: 1000  
  },
  icwsDialer: {
    abandonedCallsCampaignid: "64BDEC2E-4AE1-4F1F-8C47-79C34433D6FC"
  },
  logs: {
    file: {
      level: 'debug',
      filename: `E:/AgcApps/logs/UAT/IcwsCtiConnector/%DATE%-trace.log`,
      datePattern: "YYYY-MM-DD",
      zippedArchive: false,
      maxSize: '10m',
      maxFiles: '30',
      format: format.combine(
        format.timestamp({format: timestampFormat}),
        format.printf(
        info => `${info.timestamp} [${info.logId}] ${info.level}: ${info.message}`
        )
    ),
    },
    console: {
      level: 'info',
      datePattern: "YYYY-MM-DD",
      format: format.combine(
        format.colorize(),
        format.timestamp({format: timestampFormat}),
        format.printf(
        info => `${info.timestamp} [${info.logId}] ${info.level}: ${info.message}`
        )
      ),
    },
    mongodb: {
      db : 'mongodb://127.0.0.1:27017/icwscticonnector?retryWrites=true',
      collection : 'logs',
      level : 'error',
      capped : true
    },
    morgan: {
      format: ":method :url :status :res[content-length] - :response-time ms"
    }
  }
};

const production = {
  server: {
    port: 8080,
    timeoutMs: 12000
  },
  request: {    
    timeoutMs: 10000,
    contentType: 'application/json',
    acceptLanguage: 'en-us'
  },
  logoutTimeout: {    
    timeoutMs: 90000
  },
  icws: {
    server: '10.12.248.7',
    uriScheme: 'http://' ,
    uriPort: '8018',
    uriPath: '/icws',
    messageRetrievalIntervalMs: 1000  
  },
  icwsDialer: {
    abandonedCallsCampaignid: "4E883D1E-4B03-4E89-8DA6-CE904BB64983"
  },
  logs: {
    file: {
      level: 'verbose',
      filename: `E:/AgcApps/logs/Production/IcwsCtiConnector/%DATE%-trace.log`,
      datePattern: "YYYY-MM-DD",
      zippedArchive: false,
      maxSize: '10m',
      maxFiles: '30',
      format: format.combine(
        format.timestamp({format: timestampFormat}),
        format.printf(
        info => `${info.timestamp} [${info.logId}] ${info.level}: ${info.message}`
        )
    ),
    },
    console: {
      level: 'info',
      datePattern: "YYYY-MM-DD",
      format: format.combine(
        format.colorize(),
        format.timestamp({format: timestampFormat}),
        format.printf(
        info => `${info.timestamp} [${info.logId}] ${info.level}: ${info.message}`
        )
      ),
    },
    mongodb: {
      db : 'mongodb://127.0.0.1:27017/icwscticonnector?retryWrites=true',
      collection : 'logs',
      level : 'error',
      capped : true
    },
    morgan: {
      format: ":method :url :status :res[content-length] - :response-time ms"
    }
  }
};

const config = {
  development,
  production
};

module.exports = config[env];
