const migration_tools = require('../tools/migration');

const guid_function = migration_tools.guid_function;
const ternary_options = migration_tools.ternary_options;
const table_name = 'commodities';

exports.up = function (knex)
{

    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.string('name').notNullable();
        table.uuid('guid').unique().notNullable();

        table.integer('type').unsigned();
        table.foreign('type').references('id').inTable('rcg_tms.commodity_types');

        // this should be FTL (Full Truck Load) and LTL (Less-Than Full-load)
        table.enu('capacity', [ 'Full TL', 'Partial TL' ]).notNullable();
        table.enu('damaged', ternary_options).defaultTo('unknown').notNullable();
        table.enu('inoperable', ternary_options).defaultTo('unknown').notNullable();
        table.enu('delivery_status', [
            'none',
            'en route',
            'picked up',
            'delivered'
        ]).defaultTo('none').notNullable();

        table.integer('length').unsigned();
        table.integer('weight').unsigned();
        table.integer('quantity').unsigned();
        table.string('description');
        table.string('identifier').comment('this should be the VIN if a vehicle is related to this table, otherwise it is a string that identifies the commodity');

        // if this commodity is a vehicle, then there should be a vehicle attached to it
        table.integer('vehicle').unsigned();
        table.foreign('vehicle').references('id').inTable('rcg_tms.vehicles');

        table.timestamps(true, true);

    }).raw(guid_function(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
