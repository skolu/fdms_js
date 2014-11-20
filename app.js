var tls = require('tls');
var net = require('net');
var fs = require('fs');
var sn = require('./servers/site_net');
var fdms = require('./servers/fdms');

var unix_pipe = "./fdms_server";

if (fs.existsSync(unix_pipe)) {
  fs.unlinkSync(unix_pipe);
}

var fdmsServer = net.createServer(fdms.FdmsSessionListener);
fdmsServer.listen(unix_pipe);

var options = {
  key: fs.readFileSync('cert.pem'),
  cert: fs.readFileSync('cert.pem')
};

var siteNetConfig = new sn.SiteNetConfig(unix_pipe);
var siteNetServer = tls.createServer(options, siteNetConfig.listener.bind(siteNetConfig));
siteNetServer.listen(8444);
console.log("Started");
