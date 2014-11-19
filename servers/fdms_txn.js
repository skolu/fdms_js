var constants = require('./constants');
var buffertools = require('buffertools');

var fdmsParseTransaction = function (data) {
  if (!Buffer.isBuffer(data)) {
    throw "Invalid data";
  }
  var pos = 0;
  if (data[pos] === constants.STX) {
    pos++;
  }

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
      mt = new FdmsSwipedßMonetaryTransaction();
    }
    for (var key in header) {
      mt[key] = header[key];
    }
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
  var pos = 0;
  var fs_pos = buffertools.indexOf(String.fromCharCode(constants.FS));
  if (fs_pos < pos)
    throw "Monetary: parse";
  var field = data.toString('ascii', pos, fs_pos);
  this.total_amount = parseFloat(field);
  pos += fs_pos;

  pos++;
  var fs_pos = buffertools.indexOf(String.fromCharCode(constants.FS));
  if (fs_pos < pos)
    throw "Monetary: parse";
  this.invoice_no = data.toString('ascii', pos, fs_pos);
  pos += fs_pos;

  pos++;
  var fs_pos = buffertools.indexOf(String.fromCharCode(constants.FS));
  if (fs_pos < pos || fs_pos - pos != 5)
    throw "Monetary: parse";

  this.batch_no = data.toString('ascii', pos, pos+1);
  this.item_no = data.toString('ascii', pos+1, pos+4);
  this.revision_no = data.toString('ascii', pos+4, pos+4);
  pos += fs_pos;

  pos++;

    fs_pos = list(sep_gen(FS, data, pos))
    self.format_code = data[pos:fs_pos[0]].decode()
    aux_data = bytes()
    if self.format_code == '6':  # Retail
        if len(fs_pos) < 15:
            raise ValueError('Monetary: Retail: parse')
        self.transaction_id = data[fs_pos[11]+1:fs_pos[12]].decode()
        aux_data = data[fs_pos[14]+1:fs_pos[15]]
    elif self.format_code == '2':  # Restaurant
        self.transaction_id = data[fs_pos[4]+1:fs_pos[5]].decode()
        aux_data = data[fs_pos[6]+1:fs_pos[7]]
    elif self.format_code == '4':  # Hotel
        self.transaction_id = data[fs_pos[7]+1:fs_pos[8]].decode()
        aux_data = data[fs_pos[12]+1:fs_pos[13]]

    if len(aux_data) > 0:
        fields = list(buf_chop(aux_data, sep_gen(US, aux_data)))
        if len(fields) < 7:
            raise ValueError('Monetary: parse')
        self.pin_block = fields[0]
        self.card_type = fields[1]
        # cashback - 2
        # surcharge - 3
        # voucher number - 4
        self.authorization_code = fields[5]
        self.smid_block = fields[6]
        if len(fields) > 7:
            self.partial_indicator = fields[7]
};

var FdmsSwipedMonetaryTransaction = function() {
  this.track_data = '';
};
FdmsSwipedMonetaryTransaction.prototype = new FdmsMonetaryTransaction();

var FdmsKeyedMonetaryTransaction = function() {
  this.account_no = '';
  this.cv_presence = '';
  this.cvv = '';
  this.exp_date = '';
};
FdmsKeyedMonetaryTransaction.prototype = new FdmsMonetaryTransaction();


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

module.exports.FdmsHeader = FdmsHeader;
module.exports.fdmsParseTransaction = fdmsParseTransaction;


