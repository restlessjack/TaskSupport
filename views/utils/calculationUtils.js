// utils/calculationUtils.js
function calculatePercent(items) {
    const totalItems = items.length;
    const completedItems = items.filter(item => item.status === 'Completed').length;
    return (completedItems / totalItems) * 100;
}