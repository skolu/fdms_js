var net = require('net');
var fdms = require('./fdms');
var buf = require("./buffer");
var EventEmitter = require("events").EventEmitter;

var SiteNetConfig = function (fdms_path) {
  this.fdms_path = fdms_path;
}

SiteNetConfig.prototype.listener = function (stream) {
  new SiteNetSession(this.fdms_path, stream);
};

var SiteNetSession = function (fdms_path, stream) {
  this.fdms_path = fdms_path;
  this.info_record = null;
  this.site_net_connection = stream;
  this.fdms_connection = null;

  this.site_net_stream = new SiteNetStream();
  this.fdms_stream = new fdms.FdmsStream();

  this.site_net_stream.on('packet', this.onSiteNetPacket.bind(this));
  this.fdms_stream.on('packet', this.onFdmsPacket.bind(this));

  stream.on('data', function(chunk) {
    this.site_net_stream.append(chunk);
  }.bind(this));

  stream.once('finish', this.onFinish.bind(this));
};

SiteNetSession.prototype.onFinish = function () {
  this.site_net_stream.removeAllListeners();
  this.fdms_stream.removeAllListeners();
  this.site_net_connection.removeAllListeners();
  this.site_net_connection = null;
  if (this.fdms_connection) {
    this.fdms_connection.removeAllListeners();
    this.fdms_connection = null;
  }
  console.log("Site Net session is closed.");
};

SiteNetSession.prototype.onFdmsPacket = function (data) {
  var packet = new Buffer(data.length + 4);
  packet.writeInt16BE(data.length, 0);
  packet.write("22", 2, 2, "ascii");
  data.copy(packet, 4);

  if (this.site_net_connection) {
    var ok = this.site_net_connection.write(packet);
    if (!ok) {
      this.site_net_connection.once('drain', function() {
        this.site_net_connection.write(packet);
      });
    }
  }
};

SiteNetSession.prototype.onSiteNetPacket = function (type, packet) {
  switch (type) {
    case "01":
    var fields = packet.toString().split(",");
    if (fields.length >= 4) {
      this.info_record = new SiteNetInfoRecord();
      this.info_record.customer_id = fields[0];
      this.info_record.terminal_id = fields[1];
      this.info_record.message_format = fields[2];
      this.info_record.transaction_type = fields[3];
      if (fields.length > 4) {
        this.info_record.version_id = fields[4];
      }
    }
    var connection = net.connect({path: this.fdms_path}, function () {
      this.fdms_connection = connection;
      this.fdms_connection.on('data', function (chunk) {
        this.fdms_stream.append(chunk);
      }.bind(this));
      this.fdms_connection.once('finish', this.onFinish.bind(this));

    }.bind(this));
    break;

    default:
    for (var i = 0; i < packet.length; i++) {
      var b = packet[i];
      if (b > 0x7f) {
        packet[i] = b & 0x7f;
      }
    }
    if (this.fdms_stream) {
      var ok = this.fdms_connection.write(packet);
      if (!ok) {
        this.fdms_connection.once('drain', function () {
          this.fdms_connection.write(packet);
        });
      }
    }
    break;
  }
};

var SiteNetStream = function() {
  this.buffer = new buf.ReusableBuffer();
};

SiteNetStream.prototype = new EventEmitter();
SiteNetStream.prototype.append = function (chunk) {
  this.buffer.append(chunk);
  while (this.buffer.size() >= 4) {
    var length = (this.buffer.byteAt(0) << 8) + this.buffer.byteAt(1);
    if (this.buffer.size() >= length + 4) {
      var packet_type = this.buffer.toString(2, 4);
      var packet_data = this.buffer.slice(4, 4 + length);
      this.buffer.shift(4 + length);
      this.emit('packet', packet_type, packet_data);
    }
  }
};

var SiteNetInfoRecord = function() {
  this.customer_id = "";
  this.terminal_id = "";
  this.message_format = "";
  this.transaction_type = "";
  this.version_id = "";
};

module.exports.SiteNetConfig = SiteNetConfig;
