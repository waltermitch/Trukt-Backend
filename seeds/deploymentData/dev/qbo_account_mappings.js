const items =
    [
        {
            'accountId': '132',
            'itemId': 1
        },
        {
            'accountId': '133',
            'itemId': 2
        },
        {
            'accountId': '134',
            'itemId': 3
        },
        {
            'accountId': '135',
            'itemId': 4
        },
        {
            'accountId': '136',
            'itemId': 5
        },
        {
            'accountId': '137',
            'itemId': 6
        }
    ];

exports.seed = function (knex)
{
    return knex('quickbooks.account_mappings').insert(items).onConflict(['accountId']).ignore();
};