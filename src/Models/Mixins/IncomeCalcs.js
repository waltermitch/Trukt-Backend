const currency = require('currency.js');

const mixin = {
    calculateEstimatedIncome()
    {
        this.estimatedIncome = currency(this.estimatedRevenue).subtract(currency(this.estimatedExpense));
    },
    calculateNetProfitMargin(totalRevenue, totalExpense)
    {
        this.netProfitMargin = totalRevenue != null ? ((currency(totalRevenue).subtract(currency(totalExpense))
        / (currency(totalRevenue))) * 100).toFixed(2) : '00.00';
    }
};

module.exports = mixin;