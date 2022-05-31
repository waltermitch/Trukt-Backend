const TABLE_NAME = 'case_notes';

exports.up = function(knex)
{
    return knex.raw(`DROP TRIGGER IF EXISTS rcg_${TABLE_NAME}_guid ON rcg_tms.${TABLE_NAME};`);
};

exports.down = function(knex)
{
  
};
