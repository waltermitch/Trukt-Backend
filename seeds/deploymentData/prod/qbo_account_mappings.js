const items =
    [
        {
            'accountId': '28',
            'itemId': 1
        },
        {
            'accountId': '17',
            'itemId': 2
        },
        {
            'accountId': '30',
            'itemId': 3
        },
        {
            'accountId': '207',
            'itemId': 4
        },
        {
            'accountId': '183',
            'itemId': 5
        },
        {
            'accountId': '182',
            'itemId': 6
        }
    ];

exports.seed = function (knex)
{
    return knex('quickbooks.account_mappings').insert(items).onConflict(['accountId']).ignore();
};