
exports.up = function (knex)
{
    return knex.raw(`
    DROP TRIGGER rcg_case_notes_guid ON rcg_tms.case_notes;
  `);
};

exports.down = function (knex)
{
    // the trigger is not needed, case_notes has no guid column.
    return knex.raw('SELECT 1;');
};
