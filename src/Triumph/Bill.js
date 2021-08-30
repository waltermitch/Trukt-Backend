class Bill
{
    constructor(data)
    {
        this.ApprovedDate = data.datePaid;
        this.ExternalInvoiceKey = data.guid;
        this.ExternalPayeeKey = data.vendorId;
        this.InvoiceImportedStatusId = data.paymentStatus || 2;
        this.InvoiceNo = data.poNumber;
        this.NetAmount = data.amount;
        this.ReferenceNo = data.paymentId;
    }
}

module.exports = Bill;