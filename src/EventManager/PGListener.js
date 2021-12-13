const Handler = require('./Handler');
const PG = require('../PostGres');

// list of channels to listen to
const channels =
    ['job_status_change'];

let client;

class PGListener
{
    static async listen()
    {
        if (!client)
        {
            // get raw connection
            client = await PG.getRawConnection();

            console.log('Listening To DB Triggers');

            // subscribe to these channels
            channels.forEach(async (e) => await client.query(`LISTEN ${e}`));

            // handle notifications
            client.on('notification', async (msg) =>
            {
                try
                {
                    // convert string to json
                    const jsonMsg = JSON.parse(msg.payload);

                    switch (msg.channel)
                    {
                        case 'job_status_change':
                            await Handler.jobStatusChanged(jsonMsg);
                            break;
                        default:
                            break;
                    }
                }
                catch (err)
                {
                    console.log('Error In PG Triggers');
                    console.log(err);
                    const error = err?.response?.data || err;
                    console.log(JSON.stringify(error));
                }
            });

        }
    }
}

module.exports = PGListener;