class Payment
{
    constructor(data)
    {
        this.AccountId = data.vendorId;
        this.orderNumber = data.order_number;
        this.setLineItems(data);
    }

    setLineItems(data)
    {
        // save var
        const commodities = data.commodities;

        // temp storage
        const lineItems = [];

        for (let i = 0; i < commodities.length; i++)
        {
            // init once
            let description = data?.pickup?.city + ', ' + data?.pickup?.state + ' to ' + data?.delivery?.city + ', ' + data?.delivery?.state + '\n';

            // if it's a vehicle
            if (commodities[i].vin || commodities[i].year || commodities[i].make || commodities[i].model)
            {
                if (commodities[i].year)
                {
                    description += (commodities[i].year + ' ');
                }
                if (commodities[i].make)
                {
                    description += (commodities[i].make + ' ');
                }
                if (commodities[i].model)
                {
                    description += (commodities[i].model + '\n');
                }
                if (commodities[i].vin)
                {
                    description += ('VIN: ' + commodities[i].vin);
                }

                if (commodities[i].lot_number != null)
                {
                    description = description.concat(' LOT: ', commodities[i].lot_number);
                }
            }
            else
            {
                description = description.concat('\n', commodities[i].description);
            }

            const temp =
            {
                'Amount': commodities[i].amount,
                'Description': description,
                'AccountBasedExpenseLineDetail': { 'AccountRef': { 'value': 28 } },
                'DetailType': 'AccountBasedExpenseLineDetail'
            };

            // add item to array of lineItems
            lineItems.push(temp);
        }

        // create line items
        this.lineItems = lineItems;
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

module.exports = Payment;