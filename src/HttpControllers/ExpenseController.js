class ExpenseController
{
    static async get(req, res)
    {

    }

    static async post(req, res)
    {
        console.log(req.body);
    }

    static async patch()
    {
        // TODO: Implement patch
    }
}

module.exports = ExpenseController;