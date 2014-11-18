var constants = require('./constants');
var buffertools = require('buffertools');

var fdmsParseTransaction = function (data) {
  if (!Buffer.isBuffer(data)) {
    throw "Invalid data";
  }

  var p_ch = data.toString('ascii', pos, pos + 1);
  if (p_ch !== '*')
    throw "FDMS: protocol flag * expected";

  var header = new FdmsHeader();
  pos++;
  header.protocol_type = data.toString('ascii', pos, pos + 1);

  pos++;
  header.terminal_id = data.toString('ascii', pos, pos + 5);

  pos += 5;
  var sepPos = buffertools.indefOf(data, '#', pos);
  if (sepPos < pos || (sepPos - pos) > 20) {
    throw "FDMS: Merchant Number";
  }
  header.merchant_number = data.toString('ascii', pos, sepPos);
  pos = sepPos;

  pos++;
  sepPos = buffertools.indefOf(data, String.fromCharCode(constants.FS), pos);
  var sepPos = buffertools.indefOf(data, '#', pos);
  if (sepPos < pos || (sepPos - pos) > 5) {
    throw "FDMS: Device ID";
  }
  header.device_id = data.toString('ascii', pos, sepPos);
  pos = sepPos;

  pos++;
  header.wcc = String.fromCharCode(data[pos]);

  pos++;
  header.txn_type = String.fromCharCode(data[pos]);

  pos++;
  header.txn_code = String.fromCharCode(data[pos]);

  pos++;
  if (data[pos] !== constants.FS) {
    throw "Invalid transaction header";
  }

  pos++;

};

var FdmsHeader = function() {
  this.protocol_type = ''
  this.terminal_id = ''
  this.merchant_number = ''
  this.device_id = ''
  this.wcc = ''
  this.txn_type = ''
  this.txn_code = '';
};

module.exports.FdmsHeader = FdmsHeader;
module.exports.fdmsParseTransaction = fdmsParseTransaction;


