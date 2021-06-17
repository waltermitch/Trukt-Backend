const RecordTypeService = require('../Services/RecordTypeService');
const AccountSelector = require('../Selectors/AccountSelector');
const Account = require('../Models/Account');

class AccountService
{
    static async searchByType(type, query)
    {
        // get recordType id
        const { sfid } = await RecordTypeService.getId(type);

        // init new selector
        const accSelector = new AccountSelector();

        // default list
        accSelector.withName().withPhone().withEmail().withGUID();
        accSelector.inName();

        // add additional selectors based on type
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

        // write query ${AccountSelector.likeOnNColumns(query, accSelector.searchIn)}
        const q = `select ${accSelector.joinSelectors()} from salesforce.account a 
                        where recordtypeid = '${sfid}' and (${AccountSelector.likeOnNColumns(query, accSelector.searchIn)})
                        order by name ASC`;

        const { rows } = await Account.knex().raw(q);

        return rows;
    }
}

module.exports = AccountService;