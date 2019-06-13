const config = require("./../config");

exports.get_home = function (req, res) {

    res.render("index", {
       
      config: {
        }
    });
}


exports.mock_serve_StartRecording = function (req, res) {
    setTimeout(function sendSucess() {
        res.send("Success");
    }, 500);
};

exports.mock_serve_StopRecording = function (req, res) {
    setTimeout(function sendSucess() {
        res.send("Success");
    }, 500);
}

exports.mock_serve_shutdown = function (req, res) {
    setTimeout(function sendSucess() {
        res.send("Success");
    }, 1000);
};
