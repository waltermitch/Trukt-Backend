class LineItem
{
    constructor(data)
    {
        this.Description = data.description || '';
        this.Amount = data.amount;
    }
}

module.exports = LineItem;