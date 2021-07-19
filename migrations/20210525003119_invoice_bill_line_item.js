const table_name = 'invoice_bill_line_items';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true }).unique().notNullable();
        table.string('name').notNullable().unique();
        table.enu('type', ['expense', 'revenue'], {
            useNative: true, enumName: 'expense_types'
        })
            .notNullable()
            .defaultsTo('expense')
            .comment('revenue type items should generally be something you charge the customer for, expense type items should generally be something that you pay a vendor');
        table.string('external_source', 32).comment('the external accounting software source i.e. quickbooks online');
        table.string('external_source_guid').comment('the guid of the item in the external accouting software source');
        table.boolean('is_accessorial').notNullable().defaultsTo(false);
        table.boolean('is_deprecated').notNullable().defaultsTo(false).comment('set this to true when this item is no longer going to be used for orders');
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(table_name)
        .raw('DROP TYPE IF EXISTS rcg_tms.expense_types;');
};
