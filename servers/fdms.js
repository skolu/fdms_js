var constants = require('./constants');
var fdms = require('./fdms_txn');
var ft = require('./fdms_types');
var buffertools = require('buffertools');
var EventEmitter = require('events').EventEmitter;


var FdmsSessionListener = function (stream) {
  console.log("FDMS session started.");
  new FdmsSession(stream);
};

var SessionState = Object.freeze({
  ReadRequest: 1,
  ProcessRequest: 2,
  ReadAcknowlegement: 3
});

var FdmsSession = function (stream) {
  this.fdms_connection = stream;
  this.fdms_stream = new FdmsStream();
  this.fdms_stream.on('packet', this.onFdmsPacket.bind(this));

  stream.on('data', function (chunk) {
    this.fdms_stream.append(chunk);
  }.bind(this));
  stream.once('finish', this.onFinish.bind(this));
  stream.once('close', this.onFinish.bind(this));

  this.online_txn = null;
  this.offline_txn = [];

  this.attempt = 0;
  this.write(constants.ENQ);
  this.state = SessionState.ReadRequest;
  this.rq_timeout = setTimeout(function() {
    if (this.state === SessionState.ReadRequest) {
      console.log("FDMS Read Timeout");
      if (this.fdms_connection) {
        this.fdms_connection.destroy();
      }
    }
  }.bind(this), 15000);
};

FdmsSession.prototype.onFdmsPacket = function(packet) {
  switch (this.state) {
    case SessionState.ReadRequest:
    switch (packet[0]) {
      case constants.STX:
      try {
        var rq = this.parse(packet);
        if (rq.txn_type === ft.TransactionType.Online) {
          if (this.online_txn === null) {
            this.online_txn = rq;
          }
          this.write(constants.ACK);
        } else {
          this.offline_txn.push(rq);
        }
        this.attempt = 0;
      }
      catch (err) {
        console.log("FDMS Read Request Error: " + err);
        this.attempt ++;
        if (this.attempt < 4) {
          this.write(constants.NAK);
        } else {
          this.fdms_connection.destroy();
        }
      }
      break;
      case constants.EOT:
      this.state = SessionState.ProcessRequest;
      var rs = this.process();
      var data = rs.body();
      break;
      default:
      console.log("FDMS Invalid Packet");
      console.log(packet);
      this.fdms_connection.destroy();
      break;
    }
    break;

    default:
    console.log("FDMS Invalid State");
    console.log(packet);
    this.fdms_connection.destroy();
    break;
  }
};

FdmsSession.prototype.process = function () {
  // process offline
  // process add ons
  // process online
  var rs = fdms.fdmsProcessTransaction(this.online_txn);
  return rs;
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
  return fdms.fdmsParseTransaction(packet);
};

FdmsSession.prototype.write = function (data) {
  var packet = data;
  if (!Buffer.isBuffer(data)) {
    packet = new Buffer(1);
    packet[0] = data;
  }
  var ok = this.fdms_connection.write(packet);
  if (!ok) {
    console.log("FDMS Session: write overflow");
    this.fdms_connection.destroy();
  }
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
  this.buffer = null;
};

FdmsStream.prototype = new EventEmitter();
FdmsStream.prototype.append = function (chunk) {
  var data = null;
  if (this.buffer != null) {
    data = Buffer.concat([this.buffer, chunk]);
  } else {
    data = chunk;
  }

  var etx_sep = new Buffer([constants.ETX]);
  var pos = 0;
  var done = false;
  var packet = null;
  while (pos < data.length) {
    if (done) {
      break;
    }
    switch (data[pos]) {
      case constants.STX:
      var end_pos = buffertools.indexOf(data, etx_sep, pos);
      if (end_pos > pos && end_pos + etx_sep.length + 1 < data.length) {
        packet = data.slice(pos, end_pos);
        pos = end_pos;
        this.emit('packet', packet);
      } else {
        done = true;
      }
      break;
      case constants.ACK:
      case constants.NAK:
      case constants.EOT:
      case constants.ENQ:
      packet = data.slice(pos, pos + 1);
      pos++;
      this.emit('packet', packet);
      break;
      default:
      console.log("FDMS stream: invalid character" + data[pos].toString());
      packet = data.slice(pos, pos + 1);
      pos++;
      this.emit('skip', packet);
      break;
    }
  }
  if (pos < data.length) {
    console.log("FDMS Stream: incomplete packet");
    this.buffer = data.slice(pos);
  }
};

module.exports.FdmsSession = FdmsSession;
module.exports.FdmsStream = FdmsStream;
module.exports.FdmsSessionListener = FdmsSessionListener;
