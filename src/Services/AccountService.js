const { NotFoundError } = require('../ErrorHandling/Exceptions');
const SFAccount = require('../Models/SFAccount');

const addressTypes = ['billing', 'shipping'];
const addressFields = [
    'Street',
    'State',
    'City',
    'PostalCode',
    'Country'
];
const tableName = 'salesforce.accounts';

const orderbypriority = [`${tableName}.name`, `${tableName}.dot_number`];

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
                    builder.orWhere(`${tableName}.dot_number`, 'ilike', `%${search}%`);
                    break;
            }

            builder.orWhere(`${tableName}.name`, 'ilike', `%${search}%`).andWhere(`${tableName}.name`, 'not ilike', '%Parent%');

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
        const qb = SFAccount.query().findOne('guid', accountId);

        if (accountType)
        {
            const rtype = accountType?.toLowerCase();
            qb.modify('byType', rtype);
            switch (rtype)
            {
                case 'carrier':
                case 'client':
                case 'vendor':
                    qb.withGraphFetched('[contacts, primaryContact]');
                    break;
            }
        }

        const result = await qb;

        if (!result)
        {
            throw new NotFoundError('The account was not found.');
        }

        return result;
    }
}

module.exports = AccountService;