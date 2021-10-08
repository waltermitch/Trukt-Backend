const FUNCTION_NAME = 'rcg_crud_authors';
const SCHEMA_NAME = 'rcg_tms';

exports.up = function (knex)
{
    return knex.raw(`
        CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 1
            STABLE NOT LEAKPROOF
        AS $BODY$
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                NEW.deleted_by_guid = NULL;
                NEW.updated_by_guid = NULL;
            ELSEIF (TG_OP = 'UPDATE') THEN
                -- do not allow users to change the created author
                IF (NEW.created_by_guid <> OLD.created_by_guid) THEN
                    NEW.created_by_guid = OLD.created_by_guid;
                END IF;
                -- do not allow users to change the deleted author
                IF (OLD.deleted_by_guid IS NOT NULL AND NEW.deleted_by_guid IS NOT NULL AND NEW.deleted_by_guid <> OLD.deleted_by_guid) THEN
                    NEW.deleted_by_guid = OLD.deleted_by_guid;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $BODY$;

        COMMENT ON FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
            IS 'prevents users from changing created and deleted by columns';
  `);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}();`);
};
