const EventManager = require('./EventManager')
const PG = require('../PostGres');

// list of channels to listen to
const channels =
    [
        'job_status_change'
    ]

let client;

class PGListener
{
    static async listen()
    {
        if (!client)
        {
            // get raw connection
            client = await PG.getRawConnection();

            //subscribe to these channels
            channels.forEach((e) => client.query(`LISTEN ${e}`));

            // handle notifications
            client.on('notification', async (msg) =>
            {
                // handle notifications here...
                console.log(msg)

                //convert string to json
                const jsonMsg = JSON.parse(msg.payload);

                switch (msg.channel)
                {
                    case 'job_status_change':
                        await EventManager.jobStatusChanged(jsonMsg);
                        break;
                    default:
                        break;
                }
            })
        }
    }
}

module.exports = PGListener;