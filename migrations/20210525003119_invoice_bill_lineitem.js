const table_name = 'invoice_bill_lineitems';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true }).unique().notNullable();
        table.string('name').notNullable().unique();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
