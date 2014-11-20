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

module.exports.MonetaryTxnCodes = Object.freeze([TxnCode.Sale, TxnCode.Return, TxnCode.TicketOnly,
  TxnCode.AuthOnly, TxnCode.VoidSale, TxnCode.VoidReturn, TxnCode.VoidTicketOnly]);

module.exports.VoidTxnCodes = Object.freeze([TxnCode.VoidSale, TxnCode.VoidReturn, TxnCode.VoidTicketOnly]);

module.exports.ActionCode = Object.freeze({
  RegularResponse: '0',
  HostSpecificPoll: '1',
  RevisionInquiry: '2',
  PartialApproval: '3'
});

module.exports.TransactionType = Object.freeze({
    Online: '0',
    OfflinePiggyBack: '1',
    OfflineCloseBatch: '2',
    RevisedPiggyBack: '3',
    RevisedCloseBatch: '4',
    SpecificPollRevised: '5',
    SpecificPollTransaction: '6'
});

module.exports.TxnCode = TxnCode;
