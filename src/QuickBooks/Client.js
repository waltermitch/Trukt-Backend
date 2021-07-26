const Account = require('./Account');

class Client extends Account
{
    constructor(data)
    {
        super(data);

        this.setShippingAddress(data);
        this.setBusinessType(data.businessType);
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

    setBusinessType(type, clientTypes)
    {
        this.CustomerTypeRef = { 'value': clientTypes?.[`${type?.toLowerCase()}`]?.Id };
    }

}

module.exports = Client;