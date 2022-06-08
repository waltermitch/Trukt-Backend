const migration_tools = require('../tools/migration');

const TABLE_NAME = 'loadboard_load_posts';
const ternary_options = migration_tools.ternary_options;

exports.up = function(knex) {
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) => {
        table.uuid('guid').primary().unique().notNullable();
        const jobguid = 'job_guid';
        table.uuid(jobguid).notNullable();
        table.foreign(jobguid).references('guid').inTable('rcg_tms.order_jobs').onDelete('SET NULL');
        table.string('job_category',16).nullable();
        table.string('job_type',24).nullable();
        table.string('job_number',24).nullable();

        table.uuid('shipper_guid').index();
        const postguid = 'post_guid';
        table.uuid(postguid).notNullable();
        table.foreign(postguid).references('guid').inTable('rcg_tms.loadboard_posts').onDelete('CASCADE');
        const dispatcherguid = 'dispatcher_guid';
        table.uuid(dispatcherguid).notNullable();
        table.foreign(dispatcherguid).references('guid').inTable('rcg_tms.tms_users');
        table.text('instructions').nullable();
        table.string('load_type').nullable();
        table.string('carrier_pay').nullable();
        table.decimal('distance',14,2);
        table.decimal('rate_per_mile',14,2);
        table.specificType('equipment', 'text ARRAY');
        table.timestamp('date_created').defaultTo(knex.fn.now());
        table.timestamp('pickup_date_requested_end');
        table.timestamp('pickup_date_requested_start');
        table.timestamp('pickup_date_requested_type');
        table.string('pickup_street1',64).nullable().index();
        table.string('pickup_street2',64).nullable();
        table.string('pickup_state',100).nullable().index();
        table.string('pickup_city',64).nullable().index();
        table.string('pickup_country',64).nullable().index();
        table.string('pickup_zip_code',16).notNullable().index();
        table.float('pickup_latitude',14,10).nullable();
        table.float('pickup_longitude',14,10).nullable();
        table.timestamp('delivery_date_requested_end').nullable();
        table.timestamp('delivery_date_requested_start').nullable();
        
        let exists = false
        table.enu(`delivery_date_requested_type`, [
            'estimated',
            'exactly',
            'no later than',
            'no earlier than'
        ], {
            useNative: true, enumName: 'delivery_date_requested_type', existingType: exists
        });
        exists = true
        table.string('delivery_street1',64).nullable();
        table.string('delivery_street2',64).nullable();
        table.string('delivery_state',100).nullable().index();
        table.string('delivery_city',64).nullable().index();
        table.string('delivery_country',64).nullable().index();
        table.string('delivery_zip_code',16).notNullable().index();
        table.float('delivery_latitude',15,7).nullable();
        table.float('delivery_longitude',15,7).nullable();
        table.string('commodity_capacity').nullable();
        table.specificType('commodity_type', 'text ARRAY').nullable();
        table.specificType('commodity_category', 'text ARRAY').nullable().index();
        table.enu('commodity_damaged', ternary_options, { useNative: true, enumName: 'ternary_type' }).defaultTo('unknown').notNullable().index();
        table.text('commodity_description',255).nullable();
        table.enu('commodity_inoperable', null, { useNative: true, enumName: 'ternary_type', existingType: true }).defaultTo('unknown').notNullable().index();
        table.decimal('commodity_length').nullable();
        table.decimal('commodity_quantity').nullable();
        table.decimal('commodity_weight').nullable();

        
    })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists(TABLE_NAME);
};
