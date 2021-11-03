const LOCATIONS_TABLE_NAME = 'location_links';
const PHOTO_TABLE_NAME = 'photos';
const SCHEMA_NAME = 'copart';
const LOT_TABLE_NAME = 'lots';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .createTable(LOCATIONS_TABLE_NAME, (table) =>
        {
            table.increments('id', { primaryKey: true }).notNullable();
            table.uuid('terminal_guid').notNullable();
            table.foreign('terminal_guid').references('guid').inTable('rcg_tms.terminals');
            table.boolean('sublot');
            table.string('yard_number');
        })
        .createTable(LOT_TABLE_NAME, (table) =>
        {
            // primary key is lot
            table.string('lot', 20).primary();
            table.string('full_vin');
            table.string('make');
            table.string('model');
            table.string('year');
            table.string('model_group');
            table.integer('location_id').notNullable();
            table.string('auction_date');
            table.string('lot_acv');
            table.string('color');
            table.string('odometer_reading_received');
            table.string('odometer_reading_description');
            table.boolean('has_keys');
            table.string('title_description');
            table.string('damage_description');
            table.string('condition_code');
            table.string('condition_description');
            table.string('current_high_bid');
            table.string('body');
            table.string('engine');
            table.string('drive');
            table.string('fuel_type_description');
            table.string('cylinders');
            table.string('secondary_damage_description');
            table.boolean('off_site_flag');
            table.string('sale_status');
            table.string('seller_name');
            table.string('transmission_type');
            table.string('notes');

            table.foreign('location_id').references('id').inTable(`${SCHEMA_NAME}.${LOCATIONS_TABLE_NAME}`);

        })
        .raw(`
            ALTER TABLE ${SCHEMA_NAME}.${LOT_TABLE_NAME}
            ADD name VARCHAR(255)
	        GENERATED ALWAYS AS(${SCHEMA_NAME}.${LOT_TABLE_NAME}.year || ' ' || ${SCHEMA_NAME}.${LOT_TABLE_NAME}.make || ' ' || ${SCHEMA_NAME}.${LOT_TABLE_NAME}.model) STORED; `
        )
        .createTable(PHOTO_TABLE_NAME, (table) =>
        {
            // list of fields
            table.increments('id').primary();
            table.string('url');
            table.string('lot').notNullable();
            table.foreign('lot').references('lot').inTable(`${SCHEMA_NAME}.${LOT_TABLE_NAME}`);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .dropTableIfExists(PHOTO_TABLE_NAME)
        .dropTableIfExists(LOT_TABLE_NAME)
        .dropTableIfExists(LOCATIONS_TABLE_NAME);
};
