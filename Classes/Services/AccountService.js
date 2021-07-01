const SFAccount = require('../Models/SFAccount');

const addressTypes = ['billing', 'shipping'];
const addressFields = [
    'street',
    'state',
    'city',
    'postalcode',
    'country'
];
const tableName = 'salesforce.account';

const orderbypriority = [`${tableName}.name`, `${tableName}.dot_number__c`];

for (const type of addressTypes)

    for (const field of addressFields)

        orderbypriority.push(`${tableName}.${type + field}`);

class AccountService
{
    static async searchByType(accountType, query)
    {
        const search = query.search.replace(/%/g, '');
        const pg = Math.max(1, query.pg || 1) - 1;
        const rc = Math.min(100, Math.max(1, query.rc || 10));
        const rtype = accountType?.toLowerCase();
        let qb = SFAccount.query().modify('byType', rtype);
        qb = qb.where((builder =>
        {

            switch (rtype)
            {
                case 'carrier':
                    builder.orWhere(`${tableName}.dot_number__c`, 'ilike', `%${search}%`);
                    break;
            }

            builder.orWhere(`${tableName}.name`, 'ilike', `%${search}%`);

            for (const type of addressTypes)

                for (const field of addressFields)

                    builder.orWhere(`${tableName}.${type + field}`, 'ilike', `%${search}%`);
        }));

        qb = qb.orderBy(orderbypriority).page(pg, rc);
        const result = await qb.withGraphFetched('[contacts, primaryContact]');

        return result.results || result;
    }

    static async getById(accountType, accountId)
    {
        const rtype = accountType?.toLowerCase();
        const qb = SFAccount.query().where('guid__c', accountId).modify('byType', rtype);
        switch (rtype)
        {
            case 'carrier':
            case 'client':
                qb.withGraphFetched('[contacts, primaryContact]');

                break;
        }
        const result = await qb;

        return result;
    }
}

module.exports = AccountService;