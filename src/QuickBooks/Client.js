const ClientTypes = process.env.QBClientTypes.split(',');
const Account = require('./Account');

class Client extends Account
{
    constructor(data)
    {
        super(data);

        this.setShippingAddress(data);
        this.setBusinessType(data.business_type);
    }

    setShippingAddress(data)
    {
        const obj =
        {
            'City': data.shippingCity,
            'Line1': data.shippingStreet,
            'PostalCode': data.shippingPostalCode,
            'CountrySubDivisionCode': data.shippingState,
            'Country': data.shippingCountry
        };

        this.ShipAddr = obj;
    }

    setBusinessType(type)
    {
        let temp;

        switch (type)
        {
            case 'Auction':
            case 'AUCTION':
                temp = ClientTypes[0];
                break;
            case 'Business':
            case 'BUSINESS':
                temp = ClientTypes[1];
                break;
            case 'Dealer':
            case 'DEALER':
                temp = ClientTypes[2];
                break;
            case 'Private':
            case 'PRIVATE':
                temp = ClientTypes[3];
                break;
            case 'Port':
            case 'PORT':
                temp = ClientTypes[4];
                break;
            case 'Repo':
            case 'REPO':
                temp = ClientTypes[4];
                break;
        }

        this.CustomerTypeRef = { 'value': temp };
    }
}

module.exports = Client;