const LineItem = require('./LineItem');

class Invoice
{
    constructor(data)
    {
        this.AccountId = data.clientId;
        this.orderNumber = data.orderNumber;
        this.poNumber = data.referenceNumber;
        this.setLineItems(data);

        return this.toJSON();
    }

    setLineItems(data)
    {
        const items = data.lines;

        this.lineItems = [];

        for (let i = 0; i < items.length; i++)
            this.lineItems.push(new InvoiceLineItem(items[i]));
    }

    toJSON()
    {
        const payload =
        {
            'Line': this.lineItems,
            'CustomerRef': { 'value': this.AccountId },
            'DocNumber': this.orderNumber,
            'CustomField': [
                {
                    'DefinitionId': '1',
                    'Name': 'PO Number',
                    'Type': 'StringType',
                    'StringValue': this.poNumber
                }
            ]
        };

        return payload;
    }
}

// private class
class InvoiceLineItem extends LineItem
{
    constructor(data)
    {
        super(data);
        this.SalesItemLineDetail = { ItemAccountRef: { value: data.item.qbAccount.invoicingId } };
        this.DetailType = 'SalesItemLineDetail';
    }
}

module.exports = Invoice;