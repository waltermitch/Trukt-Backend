const knex = require('knex')(require('../knexfile')());

const guid_function = (table_name) =>
{
    return `
        CREATE TRIGGER rcg_${table_name}_guid
            BEFORE INSERT OR UPDATE
            ON rcg_tms.${table_name}
            FOR EACH ROW
            EXECUTE FUNCTION rcg_tms.rcg_gen_uuid();

        COMMENT ON TRIGGER rcg_${table_name}_guid ON rcg_tms.${table_name}
            IS 'Generates a guid and assigns it and prevents users from changing it silently';
    `;
};

// creates timestamps for the table
// use this over the built-in functionality because
// the column names are different and this includes the uuid fields for users
const timestamps = (table) =>
{
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated');
    table.timestamp('date_deleted');
    table.boolean('is_deleted').defaultTo(false).notNullable().index();
};

const authors = (table) =>
{
    table.uuid('created_by_guid').index().notNullable();
    table.uuid('updated_by_guid').index();
    table.uuid('deleted_by_guid').index();
    table.foreign('created_by_guid').references('guid').inTable('rcg_tms.tms_users');
    table.foreign('updated_by_guid').references('guid').inTable('rcg_tms.tms_users');
    table.foreign('deleted_by_guid').references('guid').inTable('rcg_tms.tms_users');
};

const timestamps_trigger = (table_name) =>
{
    const trigger_name = `rcg_${table_name}_crud_timestamps`;
    return `
        CREATE TRIGGER ${trigger_name}
            BEFORE INSERT OR UPDATE
            ON rcg_tms.${table_name}
            FOR EACH ROW 
            EXECUTE FUNCTION rcg_tms.rcg_crud_timestamps();
        
        COMMENT ON TRIGGER ${trigger_name} on rcg_tms.${table_name}
            IS 'sets the date_created etc. columns and prevents uers from chaning the created and deleted values';
    `;
};

const authors_trigger = (table_name) =>
{
    const trigger_name = `rcg_${table_name}_crud_authors`;
    return `
        CREATE TRIGGER ${trigger_name}
            BEFORE INSERT OR UPDATE
            ON rcg_tms.${table_name}
            FOR EACH ROW 
            EXECUTE FUNCTION rcg_tms.rcg_crud_authors();
        
        COMMENT ON TRIGGER ${trigger_name} on rcg_tms.${table_name}
            IS 'sets the created_by etc. columns and prevents users from changing the created and deleted values';
    `;
};

const ternary_options = ['yes', 'no', 'unknown'];

// list these alphabetically
module.exports = {
    guid_function,
    ternary_options,
    timestamps,
    timestamps_trigger,
    authors,
    authors_trigger
};