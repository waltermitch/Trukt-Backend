const crypt = require('../tools/crypt');

module.exports = async (context) => App.next(context, get);

async function get(context)
{
    global.config = crypt();

    context.log(config);
}