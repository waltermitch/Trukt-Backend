class LineItem
{
    constructor(data)
    {
        this.setDescription(data);
    }

    setDescription(data)
    {
        // init once
        const description = data?.pickup?.city + ', ' + data?.pickup?.state + ' to ' + data?.delivery?.city + ', ' + data?.delivery?.state + '\n';
    }
}

module.exports = LineItem;