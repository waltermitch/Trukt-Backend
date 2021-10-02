const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME_ORDERS = 'orders';
const TABLE_NAME_JOBS = 'order_jobs';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME_ORDERS, (table) =>
        {
            table.decimal('estimated_distance', 8, 1).unsigned().comment('This is the distance that will be entered by the user when the order is created or updated');
            table.string('bol', 64).comment('customer bill of lading number');
            table.string('bol_url', 1024).comment('the url to the customer\'s bill of lading electronical version');
        })
        .alterTable(TABLE_NAME_JOBS, (table) =>
        {
            table.enu('inspection_type', null, {
                useNative: true,
                enumName: 'inspection_types',
                existingType: true,
                schemaName: SCHEMA_NAME
            });
            table.text('loadboard_instructions').comment('instructions to send to the loadboards');
            table.decimal('estimated_distance', 8, 1).unsigned().comment('This is the distance that will be entered by the user when the job is created or updated');
            table.string('bol', 64).comment('customer bill of lading number');
            table.string('bol_url', 1024).comment('the url to the customer\'s bill of lading electronical version');
            table.integer('equipment_type_id');
            table.foreign('equipment_type_id').references('id').inTable('rcg_tms.equipment_types')
                .onDelete('RESTRICT');
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME_ORDERS, (table) =>
        {
            table.dropColumn('estimated_distance');
            table.dropColumn('bol');
            table.dropColumn('bol_url');
        })
        .alterTable(TABLE_NAME_JOBS, (table) =>
        {
            table.dropForeign('equipment_type_id');
            table.dropColumn('equipment_type_id');
            table.dropColumn('loadboard_instructions');
            table.dropColumn('inspection_type');
            table.dropColumn('estimated_distance');
            table.dropColumn('bol');
            table.dropColumn('bol_url');
        });
};
