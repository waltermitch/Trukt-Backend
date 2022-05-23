const FUNCTION_NAME = 'rcg_case_stat_count';
const SCHEMA_NAME = 'rcg_tms';
const CONSTRAINTS_TABLE_NAME = 'case_label_stats';
exports.up = function(knex) {
  
    return knex.raw(`
    CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        VOLATILE NOT LEAKPROOF
    AS $BODY$
    BEGIN
        IF (TG_OP = 'INSERT') THEN
            UPDATE ${SCHEMA_NAME}.${CONSTRAINTS_TABLE_NAME} SET count = count + 1
            WHERE NEW.case_label_id = ${CONSTRAINTS_TABLE_NAME}.case_label_id;
        ELSEIF (TG_OP = 'UPDATE') THEN
            IF (NEW.case_label_id <> OLD.case_label_id ) THEN
                UPDATE ${SCHEMA_NAME}.${CONSTRAINTS_TABLE_NAME} SET count = count + 1
                WHERE NEW.case_label_id = ${CONSTRAINTS_TABLE_NAME}.case_label_id;

                UPDATE ${SCHEMA_NAME}.${CONSTRAINTS_TABLE_NAME} SET count = count - 1
                WHERE OLD.case_label_id = ${CONSTRAINTS_TABLE_NAME}.case_label_id;
            END IF;
        ELSEIF (TG_OP = 'DELETE') THEN
            UPDATE ${SCHEMA_NAME}.${CONSTRAINTS_TABLE_NAME} SET count = count - 1
            WHERE OLD.case_label_id = ${CONSTRAINTS_TABLE_NAME}.case_label_id;
        END IF;
        RETURN NEW;
    END;
    $BODY$;

    COMMENT ON FUNCTION rcg_tms.${FUNCTION_NAME}()
            IS 'Update the count based on insert, update and delete of cases table.';`);
    
};

exports.down = function(knex) {
    return knex.raw(`DROP FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}();`);
};
