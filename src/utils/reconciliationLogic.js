export const reconcile = (bankData, salesData, config) => {
    const {
        bankAmountCol, bankDateCol, bankRefCol,
        salesAmountCol, salesDateCol, salesRefCol,
        toleranceAmount = 0,
        toleranceDays = 2
    } = config;

    const matched = [];
    const bankPending = [...bankData];
    const salesPending = [...salesData];

    // Pass 1: Exact Match (Amount + Ref + Date within tolerance)
    for (let i = salesPending.length - 1; i >= 0; i--) {
        const sale = salesPending[i];
        const saleAmount = parseFloat(sale[salesAmountCol]);
        const saleDate = new Date(sale[salesDateCol]);
        const saleRef = String(sale[salesRefCol]).trim().toLowerCase();

        const bankIdx = bankPending.findIndex(bank => {
            const bankAmount = parseFloat(bank[bankAmountCol]);
            const bankDate = new Date(bank[bankDateCol]);
            const bankRef = String(bank[bankRefCol]).trim().toLowerCase();

            const amountMatch = Math.abs(bankAmount - saleAmount) <= toleranceAmount;
            const dateDiff = Math.abs(bankDate - saleDate) / (1000 * 60 * 60 * 24);
            const refMatch = saleRef && bankRef && (saleRef.includes(bankRef) || bankRef.includes(saleRef));

            return amountMatch && refMatch && dateDiff <= toleranceDays;
        });

        if (bankIdx !== -1) {
            matched.push({
                sale,
                bank: bankPending[bankIdx],
                type: 'Exacto (Ref + Monto)'
            });
            bankPending.splice(bankIdx, 1);
            salesPending.splice(i, 1);
        }
    }

    // Pass 2: Fuzzy Match (Amount + Date within tolerance)
    for (let i = salesPending.length - 1; i >= 0; i--) {
        const sale = salesPending[i];
        const saleAmount = parseFloat(sale[salesAmountCol]);
        const saleDate = new Date(sale[salesDateCol]);

        const bankIdx = bankPending.findIndex(bank => {
            const bankAmount = parseFloat(bank[bankAmountCol]);
            const bankDate = new Date(bank[bankDateCol]);

            const amountMatch = Math.abs(bankAmount - saleAmount) <= toleranceAmount;
            const dateDiff = Math.abs(bankDate - saleDate) / (1000 * 60 * 60 * 24);

            return amountMatch && dateDiff <= toleranceDays;
        });

        if (bankIdx !== -1) {
            matched.push({
                sale,
                bank: bankPending[bankIdx],
                type: 'Monto + Fecha'
            });
            bankPending.splice(bankIdx, 1);
            salesPending.splice(i, 1);
        }
    }

    return {
        matched,
        bankPending,
        salesPending,
        summary: {
            totalSales: salesData.length,
            totalBank: bankData.length,
            matchedCount: matched.length,
            salesPendingCount: salesPending.length,
            bankPendingCount: bankPending.length
        }
    };
};
