const LineItem = require('./LineItem');

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
        super(data);
        this.AccountBasedExpenseLineDetail = { 'AccountRef': { 'value': data.item.qbAccount.billing_id } };
        this.DetailType = 'AccountBasedExpenseLineDetail';
    }
}

module.exports = Bill;