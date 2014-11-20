var constants = require('./constants');
var buffertools = require('buffertools');

var TxnCode = Object.freeze({
  Close: '0',
  Sale: '1',
  Return: '2',
  TicketOnly: '3',
  AuthOnly: '4',
  VoidSale: '5',
  VoidReturn: '6',
  VoidTicketOnly: '7',
  DepositInquiry: '9',
  RevisionInquiry: 'I',
  NegativeResponse: 'N'
});

var MonetaryTxnCodes = Object.freeze([TxnCode.Sale, TxnCode.Return, TxnCode.TicketOnly,
  TxnCode.AuthOnly, TxnCode.VoidSale, TxnCode.VoidReturn, TxnCode.VoidTicketOnly]);

var VoidTxnCodes = Object.freeze([TxnCode.VoidSale, TxnCode.VoidReturn, TxnCode.VoidTicketOnly]);

var ActionCode = Object.freeze({
  RegularResponse: '0',
  HostSpecificPoll: '1',
  RevisionInquiry: '2',
  PartialApproval: '3'
});

var fdmsProcessTransaction = function (txn) {
  var rs = null;
  if (txn.txn_code === TxnCode.DepositInquiry) {
    rs = new FdmsBatchResponse();
    rs.set_positive();
    rs.set_revision(0);
    rs.set_item_number(1);
    rs.set_batch_number(1);
    rs.response_text = "DEP 00000.01";
    rs.set_batch_id_number(1);
  } else {
    throw "Unsupported Transaction";
  }
  return rs;
};

var BufferSplitter = function(buffer) {
  this.buffer = buffer;
};
BufferSplitter.prototype.split = function(separator, from, to) {
  var res = [];
  var pos = from || 0;
  var end = to || this.buffer.length;
  while (pos < this.buffer.length) {
    var n_pos = buffertools.indexOf(this.buffer, separator, pos);
    if (n_pos < 0)
      break;
    if (n_pos > end) {
      break;
    }
    res.push(this.buffer.slice(pos, n_pos));
    pos = n_pos + separator.length;
  }
  if (pos < end) {
    res.push(this.buffer.slice(pos, end));
  }
  return res;
};

var fdmsParseTransaction = function (data) {
  if (!Buffer.isBuffer(data)) {
    throw "Invalid data";
  }

  var pos = 0;
  if (String.fromCharCode(data[pos]) !== '*') {
    throw "FDMS: protocol flag * expected";
  }

  var header = new FdmsHeader();
  pos++;
  header.protocol_type = String.fromCharCode(data[pos]);

  pos++;
  header.terminal_id = data.toString('ascii', pos, pos + 5);

  pos += 5;
  var sepPos = buffertools.indexOf(data, '#', pos);
  if (sepPos < pos || (sepPos - pos) > 20) {
    throw "FDMS: Merchant Number";
  }
  header.merchant_number = data.toString('ascii', pos, sepPos);
  pos = sepPos;

  pos++;
  sepPos = buffertools.indexOf(data, String.fromCharCode(constants.FS), pos);
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

  if (MonetaryTxnCodes.indexOf(header.txn_code) >= 0) {
    var mt = null;
    if (header.wcc === '@' || mt.wcc === 'B') {
      mt = new FdmsKeyedMonetaryTransaction();
    } else {
      mt = new FdmsSwipedMonetaryTransaction();
    }
    for (var key in header) {
      mt[key] = header[key];
    }
    mt.parse(data.split(pos));
    return mt;
  }
  else if (header.txn_code === TxnCode.DepositInquiry) {
    return header;
  }

  throw "Unsupported transaction code: " + header.txn_code;
};

var FdmsHeader = function() {
  this.protocol_type = '';
  this.terminal_id = '';
  this.merchant_number = '';
  this.device_id = '';
  this.wcc = '';
  this.txn_type = '';
  this.txn_code = '';
};

var FdmsMonetaryTransaction = function () {
  this.total_amount = 0.0;
  this.invoice_no = '';
  this.batch_no = '';
  this.item_no = '';
  this.revision_no = '';
  this.format_code = '';
  this.transaction_id = '';
  this.card_type = '';
  this.pin_block = '';
  this.smid_block = '';
  this.authorization_code = '';
  this.partial_indicator = '';
};
FdmsMonetaryTransaction.prototype = new FdmsHeader();

FdmsMonetaryTransaction.prototype.monetary_parse = function(data) {
  var splitter = new BufferSplitter(data);
  var fields = splitter.split(new Buffer([constants.FS]));
  if (fields[0].length <= 0 && fields[0].length > 8)
    throw "Monetary: parse total amount";
  this.total_amount = parseFloat(fields[0].toString('ascii'));
  if (fields[1].length <= 0 && fields[1].length > 8)
    throw "Monetary: parse invoice number";
  this.invoice_no = fields[1].toString('ascii');

  if (fields[2].length !== 5)
    throw "Monetary: parse";
  this.batch_no = fields[2].toString('ascii', 0, 1);
  this.item_no = fields[2].toString('ascii', 1, 4);
  this.revision_no = fields[2].toString('ascii', 4, 5);

  if (fields[3].length !== 1)
    throw "Monetary: parse";
  this.format_code = fields[3].toString('ascii');

  var aux_data = null;
  if (this.format_code === '6') {  // Retail
    this.transaction_id = fields[15].toString('ascii');
    aux_data = fields[18];
  }
  else if (this.format_code === '2') {  // Restaurante
    this.transaction_id = fields[8].toString('ascii');
    aux_data = fields[10];
  }
  else if (this.format_code === '4') {  // Hotel
    this.transaction_id = fields[11].toString('ascii');
    aux_data = fields[11];
  }
  if (aux_data) {
    var aux_splitter = new BufferSplitter(aux_data);
    var aux_fields = aux_splitter.split(new Buffer([constants.US]));

    this.pin_block = aux_fields[0];
    this.card_type = aux_fields[1];
    // cashback - 2
    // surcharge - 3
    // voucher number - 4
    this.authorization_code = aux_fields[5];
    this.smid_block = aux_fields[6];
    if (aux_fields.length > 7) {
      this.partial_indicator = aux_fields[7];
    }
  }
};

var FdmsSwipedMonetaryTransaction = function() {
  this.track_data = '';
};
FdmsSwipedMonetaryTransaction.prototype = new FdmsMonetaryTransaction();
FdmsSwipedMonetaryTransaction.prototype.parse = function (data) {
  var fs_pos = buffertools.indexOf(data, new Buffer([constants.FS]));
  if (fs_pos <= 0 || fs_pos > 79) {
    throw "Swiped: parse";
  }
  this.track_data = data.toString('ascii', 0, fs_pos);
  this.monetary_parse(data.split(fs_pos + 1));
};

var FdmsKeyedMonetaryTransaction = function() {
  this.account_no = '';
  this.cv_presence = '';
  this.cvv = '';
  this.exp_date = '';
};
FdmsKeyedMonetaryTransaction.prototype = new FdmsMonetaryTransaction();
FdmsSwipedMonetaryTransaction.prototype.parse = function (data) {
  var fs_sep = new Buffer([constants.FS]);
  var us_sep = new Buffer([constants.US]);
  var pos = 0;
  var fs_pos = buffertools.indexOf(data, fs_sep, pos);
  if (fs_pos <= 0) {
    throw "Keyed: parse";
  }
  var splitter = new BufferSplitter(data.split(0, fs_pos));
  var fields = splitter.split(us_sep);
  if (fields.length != 3) {
    throw "Keyed: parse";
  }
  this.account_no = fields[0].toString('ascii');
  this.cv_presence = fields[1].toString('ascii');
  this.cvv = fields[2].toString('ascii');

  pos = fs_pos + fs_sep.length;
  fs_pos = buffertools.indexOf(data, fs_sep, pos);
  if (fs_pos <= 0) {
    throw "Keyed: parse";
  }
  this.exp_date = data.split(pos, fs_pos).toString('ascii');

  this.monetary_parse(data.split(fs_pos + fs_sep.length));
};

var FdmsResponse = function() {
  this.action_code = ActionCode.RegularResponse;
  this.response_code = '0';
  this.batch_no = '0';
  this.item_no = '000';
  this.revision_no = '0';
};
FdmsResponse.prototype.set_negative = function () {
  this.response_code = '1';
};
FdmsResponse.prototype.set_positive = function () {
  this.response_code = '0';
};
FdmsResponse.prototype.set_item_number = function (number) {
  var str = number.toString;
  if (str.length > 3) {
    throw "Incorrect Item#: " + number;
  }
  if (str.length < 3) {
    str = '000' + str;
  }
  this.item_no = str.substr(str.length - 3);
};
FdmsResponse.prototype.set_batch_number = function (number) {
  var str = number.toString;
  if (str.length != 1) {
    throw "Incorrect Batch#: " + number;
  }
  this.batch_no = str;
};
FdmsResponse.prototype.set_evision = function (number) {
  var str = number.toString;
  if (str.length != 1) {
    throw "Incorrect revision: " + number;
  }
  this.revision_no = str;
};

var FdmsTextResponse = function () {
  this.response_text = '';
};
FdmsTextResponse.prototype = new FdmsResponse();

var FdmsBatchResponse = function () {
  this.batch_id_number = '';
  this.response_text2 = '';
};
FdmsBatchResponse.prototype = new FdmsTextResponse();
FdmsBatchResponse.prototype.set_batch_id_number = function(number) {
  var str = number.toString;
  if (str.length < 6) {
    str = '000000' + str;
  }
  this.batch_id_number = str.substr(str.length - 6);
};

var FdmsCreditResponse = function() {
  this.avc_rs_code = '';
  this.cvv_rs_code = '';
  this.transaction_id = '';
  this.balance_amount = null;
  this.approved_amount = null;
  this.requested_amount = null;
};
FdmsCreditResponse.prototype = new FdmsTextResponse();

module.exports.FdmsHeader = FdmsHeader;
module.exports.fdmsParseTransaction = fdmsParseTransaction;
module.exports.fdmsProcessTransaction = fdmsProcessTransaction;

