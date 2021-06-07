const AzureStorage = require('./AzureStorage');

const containerName = config.DocumentContainerName;
const docTypeEnums =
    [
        'Undefined',
        'VendorInvoice',
        'BillOfLading',
        'ProofOfDelivery',
        'LumperTicket',
        'ScaleTicket',
        'InGateTicket',
        'OutGateTicket',
        'Miscellaneous',
        'AccessorialAgreement',
        'RateConfirmation',
        'LoadTender',
        'Invoice',
        'CustomsDocuments',
        'InvoiceWithPaperwork',
        'DetentionLoading',
        'DetentionUnloading',
        'PalletReceipt',
        'SpotApproval',
        'TruckNotUsed',
        'ExitPass',
        'BalanceDue',
        'PackingList'
    ];

class Attachment
{
    constructor(data)
    {
        this.fileName = data?.fileName;
        this.fileType = data.fileType;
        this.objectId = data.objectId;
        this;
    }

    async storeFile(data) { }
}

module.exports = Attachment;
