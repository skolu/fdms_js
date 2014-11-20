var constants = require('./constants');
var buf = require('./buffer');
var fdms = require('./fdms_txn');
var EventEmitter = require('events').EventEmitter;

var FdmsSessionListener = function (stream) {
  console.log("FDMS session started.");
  new FdmsSession(stream);
};

var FdmsSession = function (stream) {
  this.fdms_connection = stream;
  this.fdms_stream = new FdmsStream();
  this.attempt = 0;

  stream.on('data', function (chunk) {
    this.fdms_stream.append(chunk);
  }.bind(this));
  stream.once('finish', this.onFinish.bind(this));
  stream.once('close', this.onFinish.bind(this));

  this.attempt = 0;
  this.write(constants.ENQ, this.read_request.bind(this));
};

FdmsSession.prototype.read_request = function() {
  var packet = this.fdms_stream.next();
  if (!packet) {
    this.fdms_stream.once('available', this.read_request.bind(this));
    return;
  }

  if (this.attempt > 3) {
    this.fdms_connection.end();
    return;
  }

  var controlByte = packet[0];
  if (controlByte === constants.STX) {
    try {
      var txn = this.parse(packet);
      if (txn.header.txn_type === '0') {
        this.write(constants.ACK, this.read_request.bind(this));
      }
      this.attempt = 0;
    }
    catch(err) {
      console.log(err);
      this.attempt ++;
      this.write(constants.NAK, this.read_request.bind(this));
    }
  } else if (controlByte === constants.EOT) {
    this.process();
  } else {
    this.fdms_connection.end();
  }
};

FdmsSession.prototype.parse = function (data) {
  var lrs = packet[1];
  for (var i = 2; i < packet.length - 2; i++) {
    lrs ^= packet[i];
  }
  if (lrs !== packet[packet.length - 1]) {
    throw ("Invalid LRS");
  }
  var packet = data.split(1, data.length - 2);
  var txn = fdms.fdmsParseTransaction(packet);
};

FdmsSession.prototype.write = function (data, func) {
  var packet = data;
  if (!Buffer.isBuffer(data)) {
    packet = new Buffer(1);
    packet[0] = data;
  }
  var ok = this.fdms_connection.write(packet);
  if (ok) {
    func();
    return;
  }
  var callback = function() {
    this.fdms_connection.write(packet);
    func();
  }.bind(this);
  this.fdms_connection.once('drain', callback);
};

FdmsSession.prototype.onFinish = function () {
  if (this.fdms_connection) {
    this.fdms_connection.removeAllListeners();
    this.fdms_connection.destroy();
    this.fdms_connection = null;
  }
  if (this.fdms_stream) {
    this.fdms_stream.removeAllListeners();
    this.fdms_stream = null;
  }
  console.log("FDMS session is closed.");
};

var FdmsStream = function() {
  this.buffer = new buf.ReusableBuffer();
  this.next_packet = null;
};

FdmsStream.prototype = new EventEmitter();
FdmsStream.prototype.append = function (chunk) {
  console.log("FDMS: received " + chunk.length);
  this.buffer.append(chunk);
  if (!this.next_packet) {
    this.shift();
  }
  if (this.next_packet) {
    console.log("FDMS: avalable");
    this.emit('available');
  }
};

FdmsStream.prototype.shift = function () {
  if (!this.next_packet) {
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
        this.next_packet = this.buffer.cut(packet_end);
        return;

        case constants.ACK:
        case constants.NAK:
        case constants.EOT:
        case constants.ENQ:
        this.next_packet =  this.buffer.cut(1);
        return;

        default:
        this.buffer.shift(1);
        console.log("Unexpected char in FDMS stream");
        break;
      }
    }
  }
};

FdmsStream.prototype.next = function () {
  var p = this.next_packet;
  if (!p) {
    this.shift();
    p = this.next_packet;
  }
  if (p) {
    this.next_packet = null;
    this.shift();
  }
  return p;
};

module.exports.FdmsSession = FdmsSession;
module.exports.FdmsStream = FdmsStream;
module.exports.FdmsSessionListener = FdmsSessionListener;
