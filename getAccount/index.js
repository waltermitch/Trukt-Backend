module.exports = async (context, req) => await App.next(context, getAccount, req);

async function getAccount(context, req)
{
    context.log(req.params);
}