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

        table.integer('type_id').unsigned();
        table.foreign('type_id').references('id').inTable('rcg_tms.commodity_types');

        // this should be FTL (Full Truck Load) and LTL (Less-Than Full-load)
        table.enu('capacity', ['full truck load', 'partial truck load'], { useNative: true, enumName: 'load_capacity_types' });
        table.enu('damaged', ternary_options, { useNative: true, enumName: 'ternary_types' }).defaultTo('unknown').notNullable();
        table.enu('inoperable', null, { useNative: true, enumName: 'ternary_types', existingType: true }).defaultTo('unknown').notNullable();
        table.enu('delivery_status', [
            'none',
            'en route',
            'picked up',
            'delivered'
        ], { useNative: true, enumName: 'delivery_status_types' }).defaultTo('none').notNullable();

        table.integer('length').unsigned();
        table.integer('weight').unsigned();
        table.integer('quantity').unsigned();
        table.string('description');
        table.string('identifier').comment('this should be the VIN if a vehicle is related to this table, otherwise it is a string that identifies the commodity');

        // if this commodity is a vehicle, then there should be a vehicle attached to it
        table.integer('vehicle_id').unsigned();
        table.foreign('vehicle_id').references('id').inTable('rcg_tms.vehicles');

        migration_tools.timestamps(table);
        migration_tools.authors(table);

    })
        .raw(guid_function(table_name))
        .raw(migration_tools.timestamps_trigger(table_name))
        .raw(migration_tools.authors_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(table_name)
        .raw('DROP TYPE IF EXISTS rcg_tms.load_capacity_types CASCADE;')
        .raw('DROP TYPE IF EXISTS rcg_tms.delivery_status_types CASCADE;')
        .raw('DROP TYPE IF EXISTS rcg_tms.ternary_types CASCADE;');
};
