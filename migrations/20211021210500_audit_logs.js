const SCHEMA_NAME = 'audit';
const MODIFICATION_TABLE = 'modification_logs';

exports.up = function (knex)
{
    return knex
        .raw(`
            -- Creating hstore data the for ability to store different types of data
            CREATE EXTENSION IF NOT EXISTS hstore;

            -- Creating separate schema for loging information and not to clutter rcg_tms with tables
            CREATE SCHEMA ${SCHEMA_NAME};

            -- remove access privileges
            REVOKE ALL ON SCHEMA ${SCHEMA_NAME} FROM public;

            COMMENT ON SCHEMA ${SCHEMA_NAME} IS 'Out-of-table ${SCHEMA_NAME}/history logging tables and trigger functions';

            -- creating table for storing logging items 
            CREATE TABLE ${SCHEMA_NAME}.${MODIFICATION_TABLE} (
                audit_id bigserial PRIMARY KEY,
                table_name text NOT NULL,
                user_name text NOT NULL,
                action_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                action text NOT NULL CHECK (ACTION IN ('SD','D','U', 'UN')),
                row_data hstore,
                changed_fields hstore
                );
            
            -- remove access privileges
            REVOKE ALL ON ${SCHEMA_NAME}.${MODIFICATION_TABLE} FROM public;
            
            COMMENT ON TABLE ${SCHEMA_NAME}.${MODIFICATION_TABLE} IS 'History of auditable actions on audited tables, from ${SCHEMA_NAME}.if_modified_func()';
            COMMENT ON COLUMN ${SCHEMA_NAME}.${MODIFICATION_TABLE}.audit_id IS 'Unique identifier for each auditable event';
            COMMENT ON COLUMN ${SCHEMA_NAME}.${MODIFICATION_TABLE}.table_name IS 'Non-schema-qualified table name of table event occured in';
            COMMENT ON COLUMN ${SCHEMA_NAME}.${MODIFICATION_TABLE}.user_name IS 'Login / session user whose statement caused the audited event (Postgress)';
            COMMENT ON COLUMN ${SCHEMA_NAME}.${MODIFICATION_TABLE}.action_timestamp IS 'Wall clock time at which audited event''s trigger call occurred';
            COMMENT ON COLUMN ${SCHEMA_NAME}.${MODIFICATION_TABLE}.action IS 'Action type; I = insert, D = delete, U = update, T = truncate';
            COMMENT ON COLUMN ${SCHEMA_NAME}.${MODIFICATION_TABLE}.row_data IS 'Record value. Null for statement-level trigger. For DELETE and UPDATE it is the old tuple.';
            COMMENT ON COLUMN ${SCHEMA_NAME}.${MODIFICATION_TABLE}.changed_fields IS 'New values of fields changed by UPDATE. Null except for row-level UPDATE events.';
            
            
            CREATE INDEX modification_logs_schema_table_idx ON ${SCHEMA_NAME}.${MODIFICATION_TABLE}(table_name);
            CREATE INDEX modification_logs_action_timestamp_idx ON ${SCHEMA_NAME}.${MODIFICATION_TABLE}(action_timestamp);
            CREATE INDEX modification_logs_action_idx ON ${SCHEMA_NAME}.${MODIFICATION_TABLE}(action);
           
            CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.if_modified_func() RETURNS TRIGGER AS
            $body$
            DECLARE
                audit_row ${SCHEMA_NAME}.${MODIFICATION_TABLE};
                h_old hstore = hstore(OLD);
                h_new hstore = hstore(NEW);

                BEGIN
                	-- if trigger with before event
                    IF TG_WHEN <> 'AFTER' THEN
                    	RAISE EXCEPTION '${SCHEMA_NAME}.if_modified_func() may only run as an AFTER trigger';
                    END IF;

            		audit_row = ROW(
                    	nextval('audit.modification_logs_audit_id_seq'), 	-- event_id
                        TG_TABLE_NAME::text,                          		-- table_name
                        session_user::text,                           		-- session_user_name
                        current_timestamp,                            		-- action_tstamp_tx
                        substring(TG_OP,1,1),                         		-- action
                        NULL,                                         		-- row_data,
                        NULL                                          		-- updated_cols
                        );
                    
            		IF (TG_OP = 'UPDATE' AND TG_LEVEL = 'ROW') THEN
                    	audit_row.row_data = h_old;
                        audit_row.changed_fields =  (h_new - h_old);
                        -- if update triggered but nothing has changed
                        IF audit_row.changed_fields = hstore('') THEN
                            -- All changed fields are ignored. Skip this update.
                        	RETURN NULL;
                        END IF;
            			-- if record was soft-deleted, record the issue
                       	IF (exist(h_new, 'is_deleted')) then
                       		-- if deleted then update action to D
                       		IF (new.is_deleted is true AND old.is_deleted is false) THEN
                       			audit_row.action = 'SD';
                       		-- if undeleted, then update and set action to UN
                       		ELSEIF(old.is_deleted is true AND new.is_deleted is false) THEN
                       			audit_row.action = 'UN';
                       		END IF;
                       	END IF;
            		ELSIF (TG_OP = 'DELETE' AND TG_LEVEL = 'ROW') THEN
                    	audit_row.row_data = h_old;
            		ELSE
                    	RAISE WARNING '[${SCHEMA_NAME}.if_modified_func] - Trigger func added as trigger for unhandled case: %, %',TG_OP, TG_LEVEL;
                        RETURN NULL;
            		END IF;
                    INSERT INTO ${SCHEMA_NAME}.${MODIFICATION_TABLE} VALUES (audit_row.*);
            		RETURN NULL;
            	END;
            $body$
            LANGUAGE plpgsql;


            CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.audit_modification_register(target_table regclass) RETURNS void AS
            $body$
            DECLARE
                _q_txt text;
                BEGIN
                    EXECUTE 'DROP TRIGGER IF EXISTS audit_trigger_row ON ' || target_table;
                    _q_txt = 'CREATE TRIGGER audit_trigger_row AFTER UPDATE OR DELETE ON ' ||
                            target_table || ' FOR EACH ROW EXECUTE PROCEDURE ${SCHEMA_NAME}.if_modified_func();';
                    RAISE NOTICE '%',_q_txt;
                    EXECUTE _q_txt;
            END;
            $body$
            language 'plpgsql';
                    
            COMMENT ON FUNCTION ${SCHEMA_NAME}.audit_modification_register(regclass) IS
            $body$
            Add auditing support to a table.
                    
            Arguments:
            	target_table:     Table name, schema qualified if not on search_path
            $body$;
                    
            CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.audit_modification_unregister(target_table regclass) RETURNS void AS
            $body$
                BEGIN
                    EXECUTE 'DROP TRIGGER IF EXISTS audit_trigger_row ON ' || target_table;
                    RAISE NOTICE 'Unable to drop trigger on %.',target_table;
            END;
            $body$
            LANGUAGE 'plpgsql';
                    
            COMMENT ON FUNCTION ${SCHEMA_NAME}.audit_modification_unregister(regclass) IS
            $body$
            Remove auditing support to a table.
                    
            Arguments:
            	target_table:     Table name, schema qualified if not on search_path
            $body$;
                    
            CREATE OR REPLACE VIEW ${SCHEMA_NAME}.registered_tables AS
            SELECT DISTINCT triggers.trigger_schema AS schema,
            	triggers.event_object_table AS audited_table
                FROM information_schema.triggers
                WHERE triggers.trigger_name::text IN ('audit_trigger_row'::text)
                ORDER BY schema, audited_table;

            COMMENT ON VIEW ${SCHEMA_NAME}.registered_tables IS
            $body$
            	View showing all tables with auditing set up. Ordered by schema, then table.
            $body$;
        `);
};

exports.down = function (knex)
{
    return knex.raw(`
        DROP FUNCTION IF EXISTS ${SCHEMA_NAME}.if_modified_func;
        DROP FUNCTION IF EXISTS ${SCHEMA_NAME}.audit_modification_register(regclass);
        DROP FUNCTION IF EXISTS ${SCHEMA_NAME}.audit_modification_unregister(regclass);
        DROP VIEW IF EXISTS ${SCHEMA_NAME}.registered_tables;
        DROP TABLE IF EXISTS ${SCHEMA_NAME}.${MODIFICATION_TABLE};
        DROP SCHEMA IF EXISTS ${SCHEMA_NAME};
    `);
};