var tls = require('tls');
var net = require('net');
var fs = require('fs');
var sn = require('./servers/site_net');
var fdms = require('./servers/fdms');

var unix_pipe = "./fdms_server";

var fdmsProtocol = new fdms.FdmsProtocol();
var fdmsServer = net.createServer(fdmsProtocol.listener.bind(fdmsProtocol));
if (fs.existsSync(unix_pipe)) {
    fs.unlinkSync(unix_pipe);
}

fdmsServer.listen(unix_pipe);

var options = {
    key: fs.readFileSync('cert.pem'),
    cert: fs.readFileSync('cert.pem')
};

var siteNet = new sn.SiteNetProtocol(unix_pipe);
var server = tls.createServer(options, siteNet.listener.bind(siteNet));
server.listen(8444);
console.log("Started");
