var net = require('net');
var constants = require("./constants");
var buf = require("./buffer");

function SiteNetProtocol(fdms) {
    this.fdmsServerPath = fdms;
}

SiteNetProtocol.prototype.listener = function(stream) {
    var in_buffer = new buf.ReusableBuffer();
    var out_buffer = new buf.ReusableBuffer();
    var fdms_connection = null;
    var fdms_connected = false;
    var fdms_path = this.fdmsServerPath;

    function fdms_received(chunk) {
        out_buffer.append(chunk);
        if (out_buffer.size() > 0) {
            var packet_end = 0;
            if (out_buffer.byteAt(0) === constants.STX) {
                var got_etx = false;
                for (var i = 1; i < out_buffer.size(); i++) {
                    if (got_etx) {
                        packet_end = i+1;
                        break;
                    }
                    got_etx = out_buffer.byteAt(i) === constants.ETX;
                }
            } else {
                packet_end = 1;
            }
            if (packet_end > 0) {
                var packet = out_buffer.slice(0, packet_end);
                out_buffer.shift(packet_end);
                var b = new Buffer(packet_end + 4);
                b.writeInt16BE(packet_end, 0);
                b.write("22", 2, 2, "ascii");
                packet.copy(b, 4);

                var ok = stream.write(b);
                if (!ok) {
                    stream.once('drain', function() {
                        stream.write(packet);
                    });
                }
            }
        }
    }

    function site_net_received(chunk) {
        in_buffer.append(chunk);
        if (in_buffer.size() >= 4) {
            var length = (in_buffer.byteAt(0) << 8) + in_buffer.byteAt(1);
            if (in_buffer.size() >= length + 4) {
                var frame_type = in_buffer.toString(2, 4);
                var packet = in_buffer.slice(4, 4 + length);
                in_buffer.shift(4 + length);

                switch (frame_type) {
                    case "01":
                        fdms_connection = net.connect({path: fdms_path}, function () {
                            fdms_connected = true;
                            fdms_connection.on('data', fdms_received);
                        });
                        break;

                    default:
                        if (fdms_connected) {
                            var ok = fdms_connection.write(packet);
                            if (!ok) {
                                fdms_connection.once('drain', function() {
                                    fdms_connection.write(packet);
                                });
                            }
                        }
                        break;
                }
            }
        }
    }

    stream.on('data', site_net_received);
};

module.exports.SiteNetProtocol = SiteNetProtocol;