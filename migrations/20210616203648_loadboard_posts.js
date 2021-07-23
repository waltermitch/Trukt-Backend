const migration_tools = require('../tools/migration');

const loadboardNames = [
    { name: 'SUPERDISPATCH', requires_options: false, allows_bulk: true },
    { name: 'CENTRALDISPATCH', requires_options: false, allows_bulk: true },
    { name: 'SHIPCARS', requires_options: false, allows_bulk: true },
    { name: 'CARDELIVERYNETWORK', requires_options: false, allows_bulk: false },
    {
        name: 'DAT',
        requires_options: true,
        allows_bulk: true,
        required_fields: {
            requiredFields: [
                'contact',
                'loadType',
                'equipmentType',
                'length',
                'weight',
                'commodity',
                'comment1',
                'comment2'
            ]
        }
    },
    {
        name: 'TRUCKSTOP',
        requires_options: true,
        allows_bulk: false,
        required_fields: {
            requiredFields: [
                'contact',
                'loadType',
                'equipmentType',
                'length',
                'weight'
            ]
        }
    }
];
const loadboardContacts = [
    {
        name: 'powersports',
        phone: '(972)866-4640',
        email: 'powersports@rcglogistics.com',
        loadboard: 'DAT'
    },
    {
        name: 'vkuzmenko',
        phone: '(770)338-3583',
        email: 'vkuzmenko@rcglogistics.com',
        loadboard: 'DAT'
    },
    {
        name: 'ship',
        phone: '(972)866-4640',
        email: 'ship@rcglogistics.com',
        loadboard: 'DAT'
    },
    {
        name: 'Gabriel Miranda',
        phone: '(972)866-4640',
        email: 'powersports@rcglogistics.com',
        loadboard: 'TRUCKSTOP'
    },
    {
        name: 'Donald Neverov',
        phone: '(972)866-4640',
        email: 'ship@rcglogistics.com',
        loadboard: 'TRUCKSTOP'
    },
    {
        name: 'YMC',
        phone: '(770)338-3583',
        email: 'ymc@rcglogistics.com',
        loadboard: 'TRUCKSTOP'
    }
];
const proms = [];
const table_name_lb = 'loadboards';
const table_name_lb_contact = 'loadboard_contacts';
const table_name_post = 'loadboard_posts';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name_lb, (table) =>
    {
        table.string('name', 24).primary().notNullable();
        table.boolean('requires_options');
        table.boolean('allows_bulk');
        table.json('required_fields');
    }).createTable(table_name_lb_contact, (table) =>
    {
        table.increments().primary();
        table.string('name').notNullable();
        table.string('phone');
        table.string('email').notNullable();
        table.string('loadboard');
        table.foreign('loadboard').references('name').inTable(`rcg_tms.${table_name_lb}`);
    }).createTable(table_name_post, (table) =>
    {
        table.increments().primary();
        table.uuid('job_guid').notNullable();
        table.string('loadboard').notNullable();
        table.string('external_guid', 80).comment('external id of the load');
        table.string('external_post_guid', 80).comment('external id of the posting');
        table.string('instructions', 60).comment('instructions for the posting, limited to 60 because of central dispatch');
        table.enu('status', [
            'fresh',
            'created',
            'posted',
            'updated',
            'reposted',
            'unposted',
            'removed'
        ], { useNative: true, enumName: 'post_status' }).defaultTo('fresh');
        table.boolean('is_created').defaultTo(true);
        table.boolean('is_posted').defaultTo(false);
        table.boolean('is_synced').defaultTo(false);
        table.boolean('has_error').defaultTo(false);
        table.json('values');

        migration_tools.timestamps(table);
        migration_tools.authors(table);

        table.foreign('job_guid').references('guid').inTable('rcg_tms.order_jobs');
        table.foreign('loadboard').references('name').inTable(`rcg_tms.${table_name_lb}`);
    })
        .raw(migration_tools.timestamps_trigger(table_name_post))
        .raw(migration_tools.authors_trigger(table_name_post))
        .then(() =>
        {
            proms.push(knex(table_name_lb).insert(loadboardNames), knex(table_name_lb_contact).insert(loadboardContacts));
            Promise.all(proms);
        });

};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name_post).dropTableIfExists(table_name_lb_contact).dropTableIfExists(table_name_lb).raw('DROP TYPE IF EXISTS rcg_tms.post_status');
};
