function decode(colorSeq) {
    // convert to bits
    const rxBits = colorSeq.join('').split('').map(Number);

    if (rxBits.length < 6) {
        return {error: "Not enough bits for the 6-bit length field."};
    }

    // get length
    const lengthBits = rxBits.slice(0, 6);
    const L = parseInt(lengthBits.join(''), 2);

    if (L > 63) {
        return {error: "Invalid payload length."};
    }

    // padded message length
    const paddedLen = (L % 2 !== 0) ? L + 1 : L;

    // create grid
    const { r, c } = getGridDimen(paddedLen);

    const expectedTot = 6 + paddedLen + r + c;

    if (rxBits.length !== expectedTot &&
        rxBits.length !== expectedTot + 1) {
        return {
            error: `Invalid transmission length. `
        };
    }

    // divide into secctions
    const rxPayloadBits = rxBits.slice(6, 6 + paddedLen);

    const rxRowParity = rxBits.slice(
        6 + paddedLen,
        6 + paddedLen + r
    );

    const rxColParity = rxBits.slice(
        6 + paddedLen + r,
        expectedTot
    );

    // reconstruct grid
    const gridData = [
        ...rxPayloadBits,
        ...new Array(r * c - paddedLen).fill(0)
    ];

    const grid = [];

    for (let i = 0; i < r; i++) {
        grid.push(
            gridData.slice(i * c, (i + 1) * c)
        );
    }

    // calculate parity
    const calculatedRowParity = new Array(r).fill(0);
    const calculatedColParity = new Array(c).fill(0);

    for (let i = 0; i < r; i++) {
        for (let j = 0; j < c; j++) {
            const bit = grid[i][j];

            calculatedRowParity[i] ^= bit;
            calculatedColParity[j] ^= bit;
        }
    }

    // find error
    const badRows = [];

    for (let i = 0; i < r; i++) {
        if (calculatedRowParity[i] !== rxRowParity[i]) {
            badRows.push(i);
        }
    }

    const badCols = [];

    for (let j = 0; j < c; j++) {
        if (calculatedColParity[j] !== rxColParity[j]) {
            badCols.push(j);
        }
    }

    // find error index
    const correctedPayloadBits = [...rxPayloadBits];

    let errDetected = false;
    let errBitIdx = -1;

    if (badRows.length === 0 && badCols.length === 0) {
        errDetected = false;
    }

    else if (badRows.length === 1 && badCols.length === 1) {
        const errorRow = badRows[0];
        const errorCol = badCols[0];

        // grid to linear
        const gridIndex = errorRow * c + errorCol;

        if (gridIndex >= paddedLen) {
            return {
                error: "Parity points outside the transmitted payload."
            };
        }

        errDetected = true;

        // correct the error bit
        correctedPayloadBits[gridIndex] ^= 1;

        if(gridIndex < L) {
            errBitIdx = gridIndex;
        }
    }

    else {
        return {
            error: "Parity checks indicate an invalid " +
                   "or unsupported error pattern."
        };
    }

    // get correct message
    const correctedMessage =
        correctedPayloadBits.slice(0, L).join('');

    return {
        valid: true,
        length: L,
        lengthBits: lengthBits.join(''),
        rows: r,
        cols: c,
        receivedPayloadBits: rxPayloadBits.join(''),
        rowParity: rxRowParity.join(''),
        colParity: rxColParity.join(''),
        badRows: badRows,
        badCols: badCols,
        errDetected: errDetected,
        errBitIdx: errBitIdx,
        payload: correctedMessage
    };
}