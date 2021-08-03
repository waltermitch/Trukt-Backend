const table_name = 'orders';
const cosignee = 'cosignee_guid';
exports.up = function (knex)
{
    return Promise.all([
        knex.schema.withSchema('rcg_tms').table(table_name, table =>
        {
            table.string(cosignee, 100);
            table.foreign(cosignee).references('guid__c').inTable('salesforce.account');
            table.string('reference_number', 64).comment('external reference number that customer provides');
            table.enu('inspection_type', ['standard', 'advanced'],
                {
                    useNative: true, enumName: 'inspection_types'
                }).defaultsTo('standard');
            table.boolean('is_tender').notNullable().defaultsTo(false).comment('this is mainly used for EDI load tenders');
            table.boolean('is_started').defaultsTo(false).notNullable();
        }),
        knex.schema.withSchema('rcg_tms').table('order_jobs', table =>
        {
            table.enu('load_type', null, { useNative: true, enumName: 'load_capacity_types', existingType: true });
            table.boolean('is_started').defaultsTo(false).notNullable();
            table.text('instructions').comment('instructions for the vendor, these instructions will be posted to load boards');
        })
    ]);
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(table_name, (table) =>
        {
            table.dropForeign(cosignee);
            table.dropColumn(cosignee);
            table.dropColumn('reference_number');
            table.dropColumn('inspection_type');
            table.dropColumn('is_tender');
            table.dropColumn('is_started');
        })
        .raw('DROP TYPE IF EXISTS rcg_tms.inspection_types;')
        .table('order_jobs', (table) =>
        {
            table.dropColumn('load_type');
            table.dropColumn('is_started');
            table.dropColumn('instructions');
        });

    // dont need to drop type load_capacity because it is initialized in commodities

};
