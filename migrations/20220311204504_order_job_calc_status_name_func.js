const FUNCTION_NAME = 'rcg_order_job_calc_status_name';

exports.up = function(knex)
{
    return knex.withSchema('rcg_tms').raw(`
        drop function if exists rcg_order_job_calc_status_name;

        create or replace 
        function rcg_order_job_calc_status_name(param_job_guid uuid)
        returns varchar
        language plpgsql
        as
        $$ 
        declare 
            job_status varchar;
            job record;
            loadboard_request_guid uuid;
            is_valid_stop boolean default false;
            valid_job_count integer;
            on_hold_post record;
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
            and job.status = 'new'
        then
            job_status := job.status;

        -- evaluate ready state
        elsif job.is_ready
            and job.date_verified is not null
            and job.verified_by_guid is not null
            and job.updated_by_guid is not null
            and job.status = 'ready' 
            and valid_job_count > 0
        then
            job_status := job.status;

        -- evaluate on hold status 
        elseif job.is_ready = false
            and job.status = 'on hold'
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
                job_status := job.status;
            end if;
            
        end if;

            return job_status;
        end;
        $$;
    `);
};

exports.down = function(knex)
{
    return knex.withSchema('rcg_tms').raw(`DROP FUNCTION IF EXISTS rcg_tms.${FUNCTION_NAME};`);
};
