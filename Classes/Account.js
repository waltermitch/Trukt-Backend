const AccountSelectors = require('./Selectors/AccountSelectors');
const PG = require('./PostGres');

class Account
{
    constructor()
    { }

    static async searchAccountByType(type, searchString)
    {
        // get record type
        const recordTypeId = PG.getRecordTypeId('Account', type);

        // default list of fields to select
        const accSelector = new AccountSelectors();

        accSelector.withName().withPhone().withEmail();
        accSelector.inName();

        // query for different things based on account type
        switch (type)
        {
            case 'Carrier':
                accSelector
                    .withContacts()
                    .withDOTNumber()
                    .withAddress('billing')
                    .withAddress('shipping');
                accSelector
                    .inDOTNumber()
                    .inAddress('shipping')
                    .inAddress('billing');
                break;
            case 'Client':
                accSelector
                    .withContacts()
                    .withLoadboardInstructions()
                    .withOrderInstructions()
                    .withAddress('billing')
                    .withAddress('Shipping');
                accSelector
                    .inAddress('shipping')
                    .inAddress('billing');
                break;
            case 'Referrer':
                accSelector.withReferralAmount();
                break;
            default:
                break;
        }

        // write query
        const query = `select ${accSelector.joinSelectors()} from account a 
                        where recordtypeid = '${recordTypeId}' and (${PG.likeOnNColumns(searchString, accSelector.searchIn)})
                        order by name ASC`;

        return await Account.get(query);
    }

    static async get(query)
    {
        // connect
        const db = await PG.connect();

        console.log('Searching');

        const res = await db.raw(query);

        return res?.rows;
    }
}

module.exports = Account;
