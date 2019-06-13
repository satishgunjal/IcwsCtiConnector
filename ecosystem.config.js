module.exports = {
    apps: [
        {
            name: "IcwsCtiConnector",
            script: "server.js",
            instances: 1,
            exec_mode: "fork"
        }
    ]
 }