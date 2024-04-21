// utils/calculationUtils.js
function calculatePercent(items) {
    const totalItems = items.length;
    const completedItems = items.filter(item => item.status === 'Present' || item.status === 'Completed').length;
    return totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
}


module.exports = {
    calculatePercent
};
