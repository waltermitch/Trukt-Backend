const LOCATIONS_TABLE_NAME = 'locations';
const PHOTO_TABLE_NAME = 'photos';
const SCHEMA_NAME = 'copart';
const LOT_TABLE_NAME = 'lots';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .createTable(LOCATIONS_TABLE_NAME, (table) =>
        {
            table.uuid('guid').primary();
            table.string('name').notNullable();
            table.string('address').notNullable();
            table.string('city').notNullable();
            table.string('state').notNullable();
            table.string('zip').notNullable();
            table.string('notes');
            table.boolean('sublot');
        })
        .createTable(LOT_TABLE_NAME, (table) =>
        {
            // primary key is lot
            table.string('lot', 20).primary();
            table.string('full_vin');
            table.string('yard_name');
            table.string('make');
            table.string('model');
            table.string('year');
            table.string('model_group');
            table.uuid('location_guid');
            table.string('auction_date');
            table.string('lot_acv');
            table.string('lot_color');
            table.string('yard_number');
            table.string('odometer_reading_received');
            table.string('odometer_reading_description');
            table.boolean('has_keys');
            table.string('title_description');
            table.string('damage_description');
            table.string('lot_condition_code');
            table.string('lot_condition_description');
            table.string('current_high_bid');
            table.string('body_style');
            table.string('engine');
            table.string('drive');
            table.string('fuel_type_description');
            table.string('cylinders');
            table.string('secondary_damage_description');
            table.boolean('off_site_flag');
            table.string('sale_status');
            table.string('seller_name');
            table.string('transaction_type');
            table.string('lane');

            table.foreign('location_guid').references('guid').inTable(`${SCHEMA_NAME}.${LOCATIONS_TABLE_NAME}`);

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
