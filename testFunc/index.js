const start = require('../tools/start');

module.exports = async (context) => App.next(context, get);

async function get(context)
{
    start();

    context.log(config);
}