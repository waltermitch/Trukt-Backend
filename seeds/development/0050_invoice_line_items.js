const items = [
    { name: 'transport', type: 'revenue' },
    { name: 'lumper', type: 'revenue' },
    { name: 'referral', type: 'expense' },
    { name: 'fuel surcharge', type: 'revenue', is_accessorial: true },
    { name: 'unloading', type: 'revenue', is_accessorial: true },
    { name: 'refund', type: 'expense', is_accessorial: false },
    { name: 'deduction', type: 'expense', is_accessorial: false },
    { name: 'duplicate car keys', type: 'revenue', is_accessorial: true },
    { name: 'laser-cut transponder key', type: 'revenue', is_accessorial: true },
    { name: 'mechanical key', type: 'revenue', is_accessorial: true },
    { name: 'program car remotes', type: 'revenue', is_accessorial: true },
    { name: 'program keys', type: 'revenue', is_accessorial: true },
    { name: 'proximity fob w/last cut key override', type: 'revenue', is_accessorial: true },
    { name: 'remote/key combo', type: 'revenue', is_accessorial: true },
    { name: 'replace car fobs', type: 'revenue', is_accessorial: true },
    { name: 'replace car remotes', type: 'revenue', is_accessorial: true },
    { name: 'self programmable remote', type: 'revenue', is_accessorial: true },
    { name: 'sell car remotes', type: 'revenue', is_accessorial: true },
    { name: 'tibbe key', type: 'revenue', is_accessorial: true },
    { name: 'transponder key', type: 'revenue', is_accessorial: true },
    { name: 'Services', type: 'expense', is_accessorial: false }
];

exports.seed = async function (knex)
{

    return knex('rcg_tms.invoice_bill_line_items').insert(items).onConflict(['name']).ignore();

};
