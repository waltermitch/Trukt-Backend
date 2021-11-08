const currency = require('currency.js');

const mixin = {
    /** Used in Order model to calculate the total estimated revenue and expense from each job */
    calculateEstimatedRevenueAndExpense()
    {
        let orderEstimatedRevenue = currency(0);
        let orderEstimatedExpense = currency(0);

        for (const { estimatedRevenue, estimatedExpense } of this.jobs)
        {
            orderEstimatedRevenue = orderEstimatedRevenue.add(currency(estimatedRevenue));
            orderEstimatedExpense = orderEstimatedExpense.add(currency(estimatedExpense));
        }
        this.estimatedRevenue = orderEstimatedRevenue.value;
        this.estimatedExpense = orderEstimatedExpense.value;
    }
};

module.exports = mixin;