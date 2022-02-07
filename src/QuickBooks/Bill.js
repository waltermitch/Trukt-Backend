const LineItem = require('./LineItem');

const env = process.env.NODE_ENV || process.env.ENV;

let freightId;
switch (env)
{
    case 'prod':
    case 'production':
        freightId = 217;
        break;
    case 'staging':
        freightId = 98;
        break;
    case 'dev':
    case 'development':
    default:
        freightId = 141;
        break;
}

class Bill
{
    constructor(data)
    {
        this.AccountId = data.vendorId;
        this.orderNumber = data.orderNumber;
        this.setLineItems(data);
    }

    setLineItems(data)
    {
        const items = data.lines;

        this.lineItems = [];

        for (let i = 0; i < items.length; i++)
            if (items[i].amount > 0)
                this.lineItems.push(new BillLineItem(items[i]));
    }

    toJSON()
    {
        const payload =
        {
            'VendorRef': { 'value': this.AccountId },
            'Line': this.lineItems,
            'DocNumber': this.orderNumber
        };

        return payload;
    }
}

// private class
class BillLineItem extends LineItem
{
    constructor(data)
    {
        let itemId;
        if (data.commodity?.commType?.category === 'freight')
            itemId = freightId;
        else
            itemId = data.item.qbAccount.billingId;

        super(data);
        this.AccountBasedExpenseLineDetail = { 'AccountRef': { 'value': itemId } };
        this.DetailType = 'AccountBasedExpenseLineDetail';
    }
}

module.exports = Bill;