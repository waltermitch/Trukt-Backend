const LineItem = require('./LineItem');

const env = process.env.NODE_ENV || process.env.ENV;

let freightId;

// this is temporary, gonna move accounting exporting into accounting function app
switch (env)
{
    case 'prod':
    case 'production':
        freightId = 17;
        break;
    case 'staging':
        freightId = 28;
        break;
    case 'dev':
    case 'development':
    default:
        freightId = 27;
        break;
}

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
            if (items[i].amount > 0)
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
        let itemId;
        if (data.commodity?.commType?.category === 'freight')
            itemId = freightId;
        else
            itemId = data.item.qbAccount.invoicingId;

        super(data);
        this.SalesItemLineDetail = { ItemAccountRef: { value: itemId } };
        this.DetailType = 'SalesItemLineDetail';
    }
}

module.exports = Invoice;