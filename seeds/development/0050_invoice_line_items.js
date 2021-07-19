const items = [
    {
        name: 'transport',
        type: 'revenue'
    },
    {
        name: 'lumper',
        type: 'revenue'
    },
    {
        name: 'fuel surcharge',
        type: 'revenue',
        is_accessorial: true
    },
    {
        name: 'unloading',
        type: 'revenue',
        is_accessorial: true
    },
    {
        name: 'refund',
        type: 'expense',
        is_accessorial: false
    },
    {
        name: 'deduction',
        type: 'expense',
        is_accessorial: false
    }
];

exports.seed = async function (knex)
{

    return knex('rcg_tms.invoice_bill_line_items').insert(items).onConflict(['name']).ignore();

};
