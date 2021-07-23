const Account = require('./Account');

class Vendor extends Account
{
    constructor(data)
    {
        super(data);

        this.AcctNum = data.accountNumber;
        this.TaxIdentifier = data.taxId;
    }
}

module.exports = Vendor;