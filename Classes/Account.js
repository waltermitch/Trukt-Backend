const PG = require('./PostGres');

class Account
{
    constructor() { }

    static async getAccountByType(type, searchString)
    {
        // connect
        const db = await PG.connect();

        // get record type
        const recordTypeId = PG.getRecordTypeId('Account', type);

        // default list of fields to select
        const select = ['name', 'email__c as email', 'phone'];
        const searchIn = ['name'];

        // query for different things based on account type
        switch (type)
        {
            case 'Carrier':
                select.push('dot_number__c as dotNumber');
                searchIn.push('dot_number__c');
                select.push(...Account.withAddress('Billing'));
                select.push(...Account.withAddress('Shipping'));
                searchIn.push(...Account.withAddress('Shipping'));
                break;
            case 'Client':
                select.push(Account.withContacts());

                // select.push(Account.withConsignee());
                select.push(Account.withLoadboardInstructions(), Account.withOrderInstructions());
                select.push(...Account.withAddress('Billing'), ...Account.withAddress('Shipping'));
                searchIn.push(...Account.withAddress('Shipping'));
                break;
            case 'Referrer':
                select.push(Account.withReferralAmount());
        }

        // execute
        const res = await db.raw(`(select ${select.join(', ')} from account a
                                    where recordtypeid = '${recordTypeId}'
                                    and (${PG.likeOnNColumns(searchString, searchIn)}) order by name ASC)`);

        return res.rows;
    }

    static withContacts()
    {
        return ` (select coalesce(json_agg(contacts), '[]'::json) as contacts from 
                    (select firstname, lastname, phone
                    from salesforce.contact c where a.sfid = c.accountid)
                    as contacts) `;
    }

    static withReferralAmount()
    {
        return 'referral_amount__c as referralAmount';
    }

    static withOrderInstructions()
    {
        return 'order_instructions__c as orderInstructions';
    }

    static withLoadboardInstructions()
    {
        return 'loadboard_instructions__c as loadboardInstructions';
    }

    static withAddress(type)
    {
        return [
            `${type}Street`,
            `${type}City`,
            `${type}State`,
            `${type}PostalCode`
        ];
    }

}

module.exports = Account;
