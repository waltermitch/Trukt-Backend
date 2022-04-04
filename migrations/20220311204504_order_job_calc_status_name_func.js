const OrderJob = require('../src/Models/OrderJob');

const FUNCTION_NAME = 'rcg_order_job_calc_status_name';

exports.up = function(knex)
{
    return knex.raw(`
        drop function if exists ${FUNCTION_NAME};

        create or replace 
        function ${FUNCTION_NAME}(param_job_guid uuid)
        returns varchar
        language plpgsql
        as
        $$ 
        declare 
            job record;
            loadboard_request_guid uuid;
            is_valid_stop boolean default false;
            valid_job_count integer;
            on_hold_post record;
            job_bills integer;
            job_dispatches integer;
            is_job_posted boolean;
            is_dispatch_valid boolean;
            is_job_declined boolean;
            pickup_count integer;
            delivery_count integer;
        begin
            select
            *
        into
            job
        from
            rcg_tms.order_jobs oj
        where oj.guid = param_job_guid;

        select lr.guid into loadboard_request_guid from rcg_tms.loadboard_posts lp
        inner join rcg_tms.loadboard_requests lr 
        on lp.guid = lr.loadboard_post_guid where lp.job_guid = param_job_guid;

        -- get job information for validating new and ready state
            if job.type_id = 1 then 
                select count(*)
                into 
                    valid_job_count
                from 
                (
                    select
                    (
                        select
                            count(*) > 0
                        from
                            rcg_tms.loadboard_requests lbr
                        left join rcg_tms.loadboard_posts lbp2 on
                            lbp2.guid = lbr.loadboard_post_guid
                        where
                            lbr.is_valid
                            and lbr.is_accepted
                            and lbp2.job_guid = oj.guid
                    ) as has_accepted_requests,
                    stop.pickup_requested_date,
                    stop.delivery_requested_date,
                    stop.pickup_sequence,
                    stop.delivery_sequence,
                    stop.bad_pickup_address,
                    stop.bad_delivery_address,
                    stop.commodity_guid
        
                    from
                        rcg_tms.order_jobs oj
                    join (
                        select
                        distinct
                        os.date_requested_start pickup_requested_date,
                        os2.date_requested_start delivery_requested_date,
                        osl.job_guid,
                        os."sequence" pickup_sequence,
                        os2."sequence" delivery_sequence,
                        osl.commodity_guid,
                        case
                            when t.is_resolved then null
                            else CONCAT(t.street1, ' ', t.city, ' ', t.state, ' ', t.zip_code)
                        end as bad_pickup_address,
                        case
                            when t2.is_resolved then null
                            else CONCAT(t2.street1, ' ', t2.city, ' ', t2.state, ' ', t2.zip_code)
                        end as bad_delivery_address
                
                    from
                        rcg_tms.order_stop_links osl
                    left join rcg_tms.order_stops os on
                        osl.stop_guid = os.guid
                    left join rcg_tms.terminals t on
                        os.terminal_guid = t.guid,
                        rcg_tms.order_stop_links osl2
                    left join rcg_tms.order_stops os2 on
                        osl2.stop_guid = os2.guid
                    left join rcg_tms.terminals t2 on
                        os2.terminal_guid = t2.guid
                    where
                        os.stop_type = 'pickup'
                        and os2.stop_type = 'delivery'
                        and os."sequence" < os2."sequence"
                        and osl.order_guid = osl2.order_guid
                        and osl.job_guid = param_job_guid 
                    order by
                        os2."sequence" desc,
                        os."sequence" asc
                    limit 1) as stop on
                        stop.job_guid = oj.guid
                    where
                        guid = param_job_guid 
                        and oj.is_transport
                ) as valid_stops;
        --	 for any other job
            else
                select
                    count(*)
                into
                    valid_job_count
                from 
                (
                select
                    (
                        select
                            count(*) > 0
                        from
                            rcg_tms.loadboard_requests lbr
                        left join rcg_tms.loadboard_posts lbp2 on
                            lbp2.guid = lbr.loadboard_post_guid
                        where
                            lbr.is_valid
                            and lbr.is_accepted
                            and lbp2.job_guid = oj.guid) as has_accepted_requests,
                    stop.commodity_guid,
                    stop.not_resolved_address,
                    stop.stop_type
                from
                    rcg_tms.order_jobs oj
                join (
                    select
                        distinct
                            osl.commodity_guid,
                            osl.job_guid,
                    case
                        when t.is_resolved then null
                        else CONCAT(t.street1, ' ', t.state, ' ', t.city, ' ', t.zip_code)
                    end as not_resolved_address,
                        os.stop_type
                    from
                        rcg_tms.order_stop_links osl
                    left join rcg_tms.order_stops os on
                        osl.stop_guid = os.guid
                    left join rcg_tms.terminals t on
                        os.terminal_guid = t.guid
                    where
                        osl.job_guid = param_job_guid) as stop on
                    stop.job_guid = oj.guid
                where
                    guid = param_job_guid
                    and oj.is_transport = false
                ) as valid_stops;

            end if;

        -- evaluate new state
        if job.is_ready = false
            and job.vendor_guid is null
            and job.vendor_contact_guid is null
            and job.vendor_agent_guid is null
            and loadboard_request_guid is null
            and job.is_on_hold = false
            and job.is_deleted = false
            and job.is_canceled = false
            and job.is_complete = false 
            and valid_job_count > 0
        then
            return '${OrderJob.STATUS.NEW}';
        end if;

        -- evaluate ready state
        if job.is_ready
            and job.date_verified is not null
            and job.verified_by_guid is not null
            and job.updated_by_guid is not null
            and job.status = '${OrderJob.STATUS.READY}' 
            and valid_job_count > 0
        then
            return '${OrderJob.STATUS.READY}';
        end if;

        -- evaluate on hold status 
        if job.is_ready = false
            and job.status = '${OrderJob.STATUS.ON_HOLD}'
            and job.is_on_hold = true
            and job.updated_by_guid is not null
        then
            select
                *,
                lp.status as lp_status,
                lr.status as lr_status
            into
                on_hold_post 
            from
                rcg_tms.loadboard_posts lp 
            left join rcg_tms.loadboard_requests lr 
            on lp.guid = lr.loadboard_post_guid
            where lp.job_guid = param_job_guid;

            if (
                on_hold_post.is_posted = false
                and on_hold_post.lp_status = 'unposted'
                and on_hold_post.external_post_guid is null
            )
                or on_hold_post.loadboard <> 'SUPERDISPATCH'
                or (
                    on_hold_post.is_valid = false
                    and on_hold_post.is_canceled = false
                    and on_hold_post.is_declined = true
                    and on_hold_post.is_synced = true
                    and on_hold_post.lr_status = 'declined'
                    and on_hold_post.decline_reason is not null
                    and on_hold_post.updated_by_guid is not null
                )
            then
                return '${OrderJob.STATUS.ON_HOLD}';
            end if;
        end if;

        -- evaluate pending/dispatch state for transport jobs
        if job.is_dummy = false
            and job.is_on_hold = false
            and job.dispatcher_guid is not null
            and job.is_ready = true
            and job.is_deleted = false
            and job.is_canceled = false
        then
            -- get bills count
            select
                count(*)
            into
                job_bills
            from
                rcg_tms.bills b
            where b.job_guid = param_job_guid;

            -- get active dispatches count
            select
                count(*)
            into
                job_dispatches
            from
                rcg_tms.order_job_dispatches ojd
            where ojd.job_guid = param_job_guid and ojd.is_pending = true;
            
            if job_bills > 0 and job_dispatches > 0 then
                return '${OrderJob.STATUS.PENDING}';
            end if;
        end if;

        -- evaluate posted status
        if job.vendor_guid is null
            and job.vendor_agent_guid is null
            and job.vendor_contact_guid is null
        then
            select
                count(*) > 0
            into
                is_job_posted
            from
                rcg_tms.loadboard_posts lp
            where
                lp.job_guid = param_job_guid
                and lp.is_posted = true;

            if is_job_posted then
                return '${OrderJob.STATUS.POSTED}';
            end if;
        end if;

        -- evaluate dispatched status
        if job.status = '${OrderJob.STATUS.DISPATCHED}'
            and (job.vendor_guid is not null
            or job.vendor_agent_guid is not null
            or job.vendor_contact_guid is not null)
        then
            select
                count(*) = 1
            into
                is_dispatch_valid
            from
                rcg_tms.order_job_dispatches ojd
            where
                ojd.job_guid = param_job_guid
                and ojd.is_pending = false
                and ojd.is_accepted = true
                and ojd.is_canceled = false
                and ojd.is_declined = false
                and ojd.is_valid = true
                and ojd.date_accepted is not null
                and ojd.date_deleted is null
                and ojd.date_canceled is null;
            
            if is_dispatch_valid then
                return '${OrderJob.STATUS.DISPATCHED}';
            end if;
        end if;

        -- evaluate declined status
        if (job.vendor_guid is null
            or job.vendor_agent_guid is null
            or job.vendor_contact_guid is null)
            and job.is_on_hold = false
        then
            select
                *
            into
                is_job_declined
            from
                rcg_tms.order_job_dispatches ojd
            where
                ojd.is_declined = true
                and ojd.job_guid = param_job_guid;
            
            if is_job_declined then
                return '${OrderJob.STATUS.DECLINED}';
            end if;
        end if;

        -- evaluate picked up and delivered state 
        if job.is_transport
            and job.is_ready 
            and job.is_on_hold = false
            and job.is_canceled = false
            and job.is_deleted = false
            and (job.vendor_guid is not null
            or job.vendor_agent_guid is not null
            or job.vendor_contact_guid is not null)
        then
            select
                count(os.*)
            into
                pickup_count
            from rcg_tms.order_stop_links osl
            inner join rcg_tms.order_stops os
            on osl.stop_guid = os.guid
            inner join rcg_tms.order_stops os2
            on osl.stop_guid = os2.guid
            where osl.job_guid = param_job_guid
                and (os.stop_type = 'pickup'
                and osl.is_completed = true
                and os.is_started = true);
            
            select
                count(os.*)
            into
                delivery_count 
            from rcg_tms.order_stop_links osl
            inner join rcg_tms.order_stops os
            on osl.stop_guid = os.guid
            where osl.job_guid = param_job_guid
                and (os.stop_type = 'delivery'
                and osl.is_completed = true
                and os.is_started = true);

            if pickup_count > 0 and delivery_count = 0 then
                return '${OrderJob.STATUS.PICKED_UP}';
            elseif pickup_count > 0 and delivery_count > 0 then
                return '${OrderJob.STATUS.DELIVERED}';
            end if;
        end if;

        -- evaluate deleted status 
        if job.is_canceled = false
            and job.is_on_hold = false
            and job.is_ready = false
            and job.is_deleted = true
            and job.deleted_by_guid is not null
        then
            return '${OrderJob.STATUS.DELETED}';
        end if;

        -- evaluate canceled status 
        if job.is_canceled = true
            and job.is_on_hold = false
            and job.is_ready = false
            and job.is_deleted = false
            and job.deleted_by_guid is null
        then 
            return '${OrderJob.STATUS.CANCELED}';
        end if;

        -- evaluate completed status
        if job.is_complete = true 
            and job.date_completed is not null
            and job.updated_by_guid is not null
        then 
            return '${OrderJob.STATUS.COMPLETED}';
        end if;

        -- evaluate in progress status
        if job.is_transport = false
            and job.vendor_guid is not null
            and job.date_started is not null
            and job.updated_by_guid is not null

        -- get last valid dispatch if exists
            and (
                select
                    count(*) = 1
                from (
                    select
                        *
                    from 
                        rcg_tms.order_job_dispatches ojd
                    where
                        ojd.job_guid = param_job_guid
                        and ojd.vendor_guid is not null
                        and ojd.is_accepted
                        and ojd.is_valid
                        and ojd.is_pending = false 
                        and ojd.is_declined = false
                        and ojd.is_deleted = false
                        and ojd.is_canceled = false
                        and ojd.date_accepted is not null
                    order by ojd.date_accepted desc
                    limit 1
                ) as last_dispatch
            )
        then
            return '${OrderJob.STATUS.IN_PROGRESS}';
        end if;

        return null;
        end;
        $$;
    `);
};

exports.down = function(knex)
{
    return knex.raw(`DROP FUNCTION IF EXISTS rcg_tms.${FUNCTION_NAME};`);
};
