var constants = require('./constants');
var buf = require('./buffer');
var EventEmitter = require('events').EventEmitter;

var FdmsSession = function () {
  this.fdms_connection = null;
  this.fdms_stream = new FdmsStream();
  this.fdms_stream.on('packet', this.onFdmsPacket.bind(this));
};

FdmsSession.prototype.listener = function (stream) {
  this.fdms_connection = stream;
  stream.on('data', function (chunk) {
    this.fdms_stream.append(chunk);
  }.bind(this));
  stream.once('finish', this.onFinish.bind(this));
  this.write(constants.ENQ);
};

FdmsSession.prototype.write = function (data) {
  var packet = data;
  if (!Buffer.isBuffer(data)) {
    packet = new Buffer(1);
    packet[0] = data;
  }
  var ok = this.fdms_connection.write(packet);
  if (!ok) {
    this.fdms_connection.once('drain', function() {
      this.fdms_connection.write(packet);
    });
  }
};

FdmsSession.prototype.onFdmsPacket = function (packet) {
  console.log("FDMS packet received");
  this.fdms_connection.end();
};

FdmsSession.prototype.onFinish = function () {
  this.fdms_connection.removeAllListeners();
  this.fdms_stream.removeAllListeners();
  console.log("FDMS session is closed.");
};

var FdmsStream = function() {
  this.buffer = new buf.ReusableBuffer();
};

FdmsStream.prototype = new EventEmitter();
FdmsStream.prototype.append = function (chunk) {
  this.buffer.append(chunk);
  while (this.buffer.size() > 0) {
    var b = this.buffer.byteAt(0);
    switch (b) {
      case constants.STX:
      var packet_end = 0;
      for (var i = 1; i < this.buffer.size(); i++) {
        if (this.buffer.byteAt(i) === constants.ETX) {
          if (i+1 < this.buffer.size()) {
            packet_end = i + 1;
            break;
          }
        }
      }
      if (packet_end === 0) {
        return;
      }
      this.emit('packet', this.buffer.cut(packet_end));
      break;
      case constants.ACK:
      case constants.NAK:
      case constants.EOT:
      case constants.ENQ:
      this.emit('packet', this.buffer.cut(1));
      break;
      default:
      this.buffer.shift(1);
      console.log("Unexpected char in FDMS stream");
    }
  }
};

module.exports.FdmsSession = FdmsSession;
module.exports.FdmsStream = FdmsStream;
