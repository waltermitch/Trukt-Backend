
let db_owner = 'postgres';

switch (process.env.NODE_ENV)
{
    case 'development':
        db_owner = 'cicfcrqswbsfal';
        break;
    case 'staging':
        db_owner = 'mwkksnszmlilmn';
        break;
    case 'production':
        db_owner = 'u988a4g03s01v';
        break;
    default:
        db_owner = 'postgres';
        break;
}

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
const timestamps = (knex, table) =>
{
    table.uuid('updated_by');
    table.uuid('created_by').notNullable();
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated');
    table.index('created_by');
    table.index('updated_by');
    table.index('date_created');
    table.index('date_updated');
};

const timestamps_trigger = (table_name) =>
{
    const trigger_name = `rcg_${table_name}_created_updated_timestamps`;
    return `
        CREATE TRIGGER ${trigger_name}
            BEFORE INSERT OR UPDATE
            ON rcg_tms.${table_name}
            FOR EACH ROW 
            EXECUTE FUNCTION rcg_tms.rcg_created_updated_timestamps();
        
        COMMENT ON TRIGGER ${trigger_name} on rcg_tms.${table_name}
            IS 'sets the date_created and date_updated fields and prevents users from changing date_created';
    `;
};

const ternary_options = ['yes', 'no', 'unknown'];

// list these alphabetically
module.exports = {
    db_owner,
    guid_function,
    ternary_options,
    timestamps,
    timestamps_trigger
};