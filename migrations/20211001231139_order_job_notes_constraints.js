const CONSTRAINTS_TABLE_NAME = 'order_job_note_constraint';
const ORDER_NOTES_TABLE = 'order_notes';
const ORDER_JOB_JOB_TABLE = 'order_job_notes';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(CONSTRAINTS_TABLE_NAME, table =>
    {
        table.uuid('guid').notNullable().comment('Order or Job guid');
        table.uuid('note_guid').notNullable().unique();
    })
        .raw(`
            CREATE OR REPLACE FUNCTION rcg_tms.rcg_job_note_constraint()
                RETURNS trigger
                LANGUAGE 'plpgsql'
                COST 100
                VOLATILE NOT LEAKPROOF
            AS $BODY$
            BEGIN
                IF(TG_OP = 'INSERT') THEN 
                    INSERT INTO rcg_tms.${CONSTRAINTS_TABLE_NAME} (guid, note_guid) VALUES (NEW.job_guid, NEW.note_guid);
                ELSEIF(TG_OP = 'UPDATE') THEN
                    NEW.guid = OLD.guid;
                    NEW.note_guid = OLD.note_guid;
                END IF;
                RETURN NEW;
            END;
            $BODY$;

            COMMENT ON FUNCTION rcg_tms.rcg_job_note_constraint()
                IS 'Enforces notes not to be shared between jobs and orders';

            CREATE OR REPLACE FUNCTION rcg_tms.rcg_order_note_constraint()
                RETURNS trigger
                LANGUAGE 'plpgsql'
                COST 100
                VOLATILE NOT LEAKPROOF
            AS $BODY$
            BEGIN
                IF(TG_OP = 'INSERT') THEN
                    INSERT INTO rcg_tms.${CONSTRAINTS_TABLE_NAME} (guid, note_guid) VALUES (NEW.order_guid, NEW.note_guid);
                ELSEIF(TG_OP = 'UPDATE') THEN
                    NEW.guid = OLD.guid;
                    NEW.note_guid = OLD.note_guid;
                END IF;
                RETURN NEW;
            END;
            $BODY$;

            COMMENT ON FUNCTION rcg_tms.rcg_order_note_constraint()
                IS 'Enforces notes not to be shared between jobs and orders';
            
            CREATE TRIGGER rcg_job_note_constraint_trigger
                BEFORE INSERT OR UPDATE
                ON rcg_tms.${ORDER_JOB_JOB_TABLE}
                FOR EACH ROW
                EXECUTE FUNCTION rcg_tms.rcg_job_note_constraint();

            COMMENT ON TRIGGER rcg_job_note_constraint_trigger ON rcg_tms.${ORDER_JOB_JOB_TABLE}
                IS 'Enforces notes not to be shared between jobs and orders';

            CREATE TRIGGER rcg_order_note_constraint_trigger
                BEFORE INSERT OR UPDATE
                ON rcg_tms.${ORDER_NOTES_TABLE}
                FOR EACH ROW
                EXECUTE FUNCTION rcg_tms.rcg_order_note_constraint();
            
            COMMENT ON TRIGGER rcg_order_note_constraint_trigger ON rcg_tms.${ORDER_NOTES_TABLE}
                IS 'Enforces notes not to be shared between jobs and orders';          
        `);
};

exports.down = function (knex)
{
    return knex
        .raw(`
            DROP TRIGGER IF EXISTS rcg_order_note_constraint_trigger ON rcg_tms.${ORDER_NOTES_TABLE};
            DROP TRIGGER IF EXISTS rcg_job_note_constraint_trigger ON rcg_tms.${ORDER_JOB_JOB_TABLE};
            DROP FUNCTION rcg_tms.rcg_job_note_constraint;
            DROP FUNCTION rcg_tms.rcg_order_note_constraint;
            DROP TABLE IF EXISTS rcg_tms.order_job_note_constraint;
        `);
};