class Account
{
    constructor(data)
    {
        this.DisplayName = data.name;
        this.CompanyName = data.name;
        this.Fax = { 'FreeFormNumber': data.fax };
        this.PrimaryEmailAddr = { 'Address': data.email };
        this.PrimaryPhone = { 'FreeFormNumber': data.phone };
        this.GivenName = data.firstName;
        this.FamilyName = data.lastName || '';

        this.setBillingAddress(data);
    }

    setBillingAddress(data)
    {
        const obj =
        {
            City: data.billingCity,
            Line1: data.billingStreet,
            PostalCode: data.billingPostalCode,
            CountrySubDivisionCode: data.billingState,
            Country: data.billingCountry
        };

        this.BillAddr = obj;
    }

    setContact(arr = [])
    {
        for (let i = 0; i < arr.length; i++)
            if (arr[i].Accounting_Contact__c)
            {
                this.GivenName = arr[i].FirstName;
                this.FamilyName = arr[i].LastName;
                this.PrimaryPhone.FreeFormNumber = arr[i].Phone;
                break;
            }
    }
}

module.exports = Account;
