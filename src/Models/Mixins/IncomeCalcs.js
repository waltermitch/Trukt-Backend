const currency = require('currency.js');

const mixin = {
    calculateEstimatedIncome()
    {
        this.estimatedIncome = currency(this.estimatedRevenue).subtract(currency(this.estimatedExpense));
    },
    calculateNetProfitMargin(totalRevenue, totalExpense)
    {
        if(totalRevenue == null && totalRevenue == 0)
        {
            return '00.00';
        }
        const totalRev = currency(totalRevenue);
        return ((totalRev.subtract(currency(totalExpense))
        / (totalRev)) * 100).toFixed(2);
    }
};

module.exports = mixin;