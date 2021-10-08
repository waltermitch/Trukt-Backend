class CarrierBankAccount
{
    constructor(data)
    {
        this.BankABANumber = data.bankRoutingNumber;
        this.BankAccountNumber = data.bankAccountNumber;
        this.BankAccountType = '3';
        this.IntermediaryABANumber = null;
        this.IsDefault = 'True';
        this.PayeeKey = data.sfId;
        this.PrimaryKey = 'Bank1';
    }
}

module.exports = CarrierBankAccount;