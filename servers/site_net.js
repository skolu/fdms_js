var net = require('net');
var fdms = require('./fdms');
var events = require("events");

var SiteNetConfig = function (fdms_path) {
  this.fdms_path = fdms_path;
};

SiteNetConfig.prototype.listener = function (stream) {
  console.log("SiteNET session started.");
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
  stream.once('close', this.onFinish.bind(this));
};

SiteNetSession.prototype.onFinish = function () {
  if (this.site_net_connection) {
    this.site_net_connection.removeAllListeners();
    this.site_net_connection.destroy();
    this.site_net_connection = null;
  }
  if (this.fdms_connection) {
    this.fdms_connection.removeAllListeners();
    this.fdms_connection.destroy();
    this.fdms_connection = null;
  }
  if (this.site_net_stream) {
    this.site_net_stream.removeAllListeners();
    this.site_net_stream = null;
  }
  if (this.fdms_stream) {
    this.fdms_stream.removeAllListeners();
    this.fdms_stream = null;
  }
  console.log("SiteNET session closed.");
};

SiteNetSession.prototype.client_write = function(data) {
  if (this.site_net_connection) {
    console.log("SiteNET: Write Client");
    console.log(data);

    var ok = this.site_net_connection.write(data);
    if (!ok) {
      this.site_net_connection.once('drain', function() {
        this.site_net_connection.write(data);
      }.bind(this));
    }
  }
};

SiteNetSession.prototype.fdms_write = function(data) {
  if (this.fdms_connection !== null) {
    console.log("SiteNET: Write FDMS");
    console.log(data);

    var ok = this.fdms_connection.write(data);
    if (!ok) {
      this.fdms_connection.once('drain', function() {
        this.fdms_connection.write(data);
      }.bind(this));
    }
  }
};

SiteNetSession.prototype.onFdmsPacket = function (data) {
  console.log("SiteNET: Received FDMS");
  console.log(data);
  var packet = new Buffer(data.length + 4);
  packet.writeInt16BE(data.length, 0);
  packet.write("22", 2, 2, "ascii");
  data.copy(packet, 4);
  this.client_write(packet);
};

SiteNetSession.prototype.onSiteNetPacket = function (type, packet) {
  console.log("SiteNET: Received Client");
  console.log(packet);
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
    var connection = net.connect({path: this.fdms_path});
    connection.once('connect', function() {
      this.fdms_connection = connection;
      this.fdms_connection.on('data', function (chunk) {
        this.fdms_stream.append(chunk);
      }.bind(this));
      this.fdms_connection.once('finish', this.onFinish.bind(this));
      this.fdms_connection.once('close', this.onFinish.bind(this));
    }.bind(this));
    break;

    default:
    for (var i = 0; i < packet.length; i++) {
      var b = packet[i];
      if (b > 0x7f) {
        packet[i] = b & 0x7f;
      }
    }
    this.fdms_write(packet);
    break;
  }
};

var SiteNetStream = function() {
  this.buffer = null;
};
SiteNetStream.prototype = Object.create(events.EventEmitter.prototype);
SiteNetStream.prototype.append = function (chunk) {
  var data = null;
  if (this.buffer !== null) {
    data = Buffer.concat([this.buffer, chunk]);
  } else {
    data = chunk;
  }

  var pos = 0;
  while (pos + 4 < data.length) {
    var length = (data[pos] << 8) + data[pos + 1];
    if (data.length >= length + 4) {
      var packet_type = data.toString('ascii', pos + 2, pos + 4);
      var packet_data = data.slice(pos + 4, pos + 4 + length);
      this.emit('packet', packet_type, packet_data);
      pos += length + 4;
    }
  }
  if (pos < data.length) {
    this.buffer = data.slice(pos);
  } else {
    this.buffer = null;
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
