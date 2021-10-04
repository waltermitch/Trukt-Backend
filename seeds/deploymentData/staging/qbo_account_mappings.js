const items =
    [
        {
            'accountId': '92',
            'itemId': 1
        },
        {
            'accountId': '93',
            'itemId': 2
        },
        {
            'accountId': '94',
            'itemId': 3
        },
        {
            'accountId': '95',
            'itemId': 4
        },
        {
            'accountId': '96',
            'itemId': 5
        },
        {
            'accountId': '97',
            'itemId': 6
        }
    ];

exports.seed = function (knex)
{
    return knex('quickbooks.account_mappings').insert(items).onConflict(['accountId']).ignore();
};