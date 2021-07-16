const payment_methods = [
    {
        'name': 'ACH'
    },
    {
        'name': 'company check'
    },
    {
        'name': 'COD'
    },
    {
        'name': 'comcheck'
    },
    {
        'name': 'credit card'
    },
    {
        'name': 'certified funds'
    },
    {
        'name': 'wire transfer'
    },
    {
        'name': 'other'
    }
];

const payment_terms = [
    {
        'name': 'immediately'
    },
    {
        'name': 'quick pay'
    },
    {
        'name': '5 day'
    },
    {
        'name': '7 day'
    },
    {
        'name': '10 day'
    },
    {
        'name': '15 day'
    },
    {
        'name': '20 day'
    },
    {
        'name': '30 day'
    },
    {
        'name': '45 day'
    }
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable('invoice_bill_payment_terms', (table) =>
        {
            table.increments('id', { primaryKey: true });
            table.string('name', 24);
        })
        .createTable('invoice_bill_payment_methods', (table) =>
        {
            table.increments('id', { primaryKey: true });
            table.string('name', 24);
        }).then(() =>
        {
            return knex('invoice_bill_payment_terms').insert(payment_terms);
        }).then(() =>
        {
            return knex('invoice_bill_payment_methods').insert(payment_methods);
        }).then(() =>
        {
            return knex.schema.withSchema('rcg_tms')
                .alterTable('invoice_bills', (table) =>
                {
                    table.integer('payment_method_id').unsigned();
                    table.integer('payment_term_id').unsigned();
                    table.foreign('payment_method_id').references('id').inTable('invoice_bill_payment_methods');
                    table.foreign('payment_term_id').references('id').inTable('invoice_bill_payment_terms');
                    table.dropColumn('payment_method');
                    table.dropColumn('payment_terms');
                });
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .alterTable('invoice_bills', (table) =>
        {
            table.dropForeign('payment_method_id');
            table.dropForeign('payment_term_id');
            table.dropColumn('payment_method_id');
            table.dropColumn('payment_term_id');
            table.string('payment_method');
            table.string('payment_terms');
        })
        .dropTableIfExists('invoice_bill_payment_terms')
        .dropTableIfExists('invoice_bill_payment_methods');

};
