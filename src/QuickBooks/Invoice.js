class Invoice
{
    constructor(data)
    {
        this.AccountId = data.AccountId;
        this.orderNumber = data.order_number;
        this.poNumber = data.po_number;
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

            const itemRef = description.includes('Fuel Surcharge') ? 9 : 4;

            const temp =
            {
                'Amount': commodities[i].amount,
                'Description': description,
                'SalesItemLineDetail': { 'ItemRef': { 'value': itemRef } },
                'DetailType': 'SalesItemLineDetail'
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

module.exports = Invoice;