const COLORS = {
    "00": {name:"Red", hex:"#e74c3c"},
    "01": {name:"Blue", hex:"#3498db"},
    "10": {name:"Green", hex:"#2ecc71"},
    "11": {name:"Yellow", hex:"#f1c40f"}
};

// grid dims
function getGridDimen(N) {
    if(N === 0) {return {r: 0, c: 0};}
    let bestR = 1;
    let bestC = N;
    let bestSum = Infinity;

    for(let r=1; r<=N;r++){
        const c = Math.ceil(N/r);
        const sum = r+c;
        if(sum < bestSum){
            bestR = r;
            bestC = c;
            bestSum = sum;
        } else if (sum === bestSum) {
            if (Math.abs(r - c) < Math.abs(bestR - bestC)) {
                bestR = r;
                bestC = c;
            }
        }
    }
    return {r: bestR,c: bestC};
}

function encode(message, errorIndex){
    //len
    const L = message.length;
    const lenBits = L.toString(2).padStart(6, '0');

    //msg
    const padMsg = (L % 2 !== 0) ? message + '0' : message;

    //grid for 2d parity
    const N = padMsg.length;
    const {r,c} = getGridDimen(N);

    //fill remn bits with 0
    const remn = r*c - N;
    const gridData = padMsg + '0'.repeat(remn);

    //make the grid
    const grid = [];

    for(let i=0; i<r;i++){
        const row = gridData
            .slice(i*c, (i+1)*c)
            .split('')
            .map(Number);

        grid.push(row);
    }

    //calc parity
    const rowP = new Array(r).fill(0);
    const colP = new Array(c).fill(0);

    for(let i=0;i<r;i++){
        for(let j=0;j<c;j++){
            const bit = grid[i][j];

            rowP[i] ^= bit;
            colP[j] ^= bit;
        }
    }

    //final msg
    const encodedBits =
        lenBits +
        padMsg +
        rowP.join('') +
        colP.join('');

    //add err
    const txBits = encodedBits.split('');
    const errIdx = Number.parseInt(errorIndex, 10);

    if (!Number.isNaN(errIdx) && errIdx >= 0) {
        if(errIdx >= L){
            throw new Error(
                `Error bit index must be between 0 and ${L - 1}.`
            );
        }

        const payloadIdx = 6 + errIdx;
        txBits[payloadIdx] =
            txBits[payloadIdx] === '0' ? '1' : '0';
    }

    let finalStr = txBits.join('');

    if(finalStr.length % 2 !== 0){
        finalStr += '0';
    }

    //bits to colors
    const colors = [];

    for(let i = 0; i < finalStr.length; i += 2) {
        const chunk = finalStr.substring(i, i+2);
        colors.push(chunk);
    }

    return{
        length: L,
        lenBits: lenBits,
        originalMessage: message,
        padMsg: padMsg,
        grid: grid,
        rows: r,
        cols: c,
        rowP: rowP,
        colP: colP,
        encodedBits: encodedBits,
        txBits: finalStr,
        colors: colors,
        errorIndex: Number.isNaN(errIdx) ? -1 : errIdx
    };
}


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


document
    .getElementById('tab-sender')
    .addEventListener('click', () => {

        document
            .getElementById('tab-sender')
            .classList.add('active');

        document
            .getElementById('tab-receiver')
            .classList.remove('active');

        document
            .getElementById('sender')
            .classList.add('active-tab');

        document
            .getElementById('receiver')
            .classList.remove('active-tab');
    });


//rcvr tab
document.getElementById('tab-receiver').addEventListener('click', () => {
        document.getElementById('tab-receiver').classList.add('active');
        document.getElementById('tab-sender').classList.remove('active');
        document.getElementById('receiver').classList.add('active-tab');
        document.getElementById('sender').classList.remove('active-tab');
    });


//sender
        let txInt= null;
        document.getElementById('btn-transmit').addEventListener('click', () => {

        const msg =document.getElementById('sender-msg').value.trim();

        if (!/^[01]+$/.test(msg)) {
            alert("Message must contain only 0s and 1s.");
            return;
        }

        if(msg.length > 63){
            alert("Message too long for 6-bit length field.");
            return;
        }

        //err index
        const errIn =document.getElementById('sender-err-idx').value.trim();
        const errIdx =errIn === '' || errIn === '-1'? -1: parseInt(errIn, 10);
        if(errIdx !== -1 && (!Number.isInteger(errIdx) ||errIdx < 0 ||errIdx >= msg.length)){
            alert(
                `Error index must be -1 or between 0 and ${msg.length - 1}.`
            );
            return;
        }

//Encode
        let res;
        try {
            res = encode(msg, errIdx);
        } catch (e) {
            alert(e.message);
            return;
        }

        const txDiv= document.getElementById('tx-colors');
        txDiv.innerHTML ='';
        document.getElementById('sender-output').style.display = 'block';

        if (txInt!== null) {
            clearTimeout(txInt);
            txInt = null;
        }
        speechSynthesis.cancel();

        let clrIdx = 0;
        function showNextColor(){
            if (clrIdx >= res.colors.length) return;
            const bits = res.colors[clrIdx];
            const word = COLORS[bits].name;
            const utter = new SpeechSynthesisUtterance(word);

            utter.rate = 2.5;
            utter.pitch = 1;
            utter.volume = 1;

            utter.onend = () => {
                clrIdx++;
                showNextColor();
            };
            speechSynthesis.speak(utter);
        }
        showNextColor();
    });


//Receiver
    let rcvdClrs = [];
    function renderRcvdClrs(){
        const rxDiv =document.getElementById('rx-sequence');
        rxDiv.innerHTML = '';
        rcvdClrs.forEach(c =>{
            const block =document.createElement('div');
            block.className = 'color-block';
            block.style.backgroundColor = COLORS[c].hex;
            block.innerHTML =`<span>${COLORS[c].name}</span> <span>${c}</span>`;
            rxDiv.appendChild(block);
        });
    }

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            rcvdClrs.push(btn.dataset.bits);
            renderRcvdClrs();
        });
    });

    //backspace btn
    document.getElementById('btn-rx-back').addEventListener('click', () => {
        rcvdClrs.pop();
        renderRcvdClrs();
    });

    //clear btn
    document.getElementById('btn-rx-clear').addEventListener('click', () => {
        rcvdClrs = [];
        renderRcvdClrs();
        document.getElementById('rx-output').style.display = 'none';
    });

    //decode button
    document.getElementById('btn-rx-decode').addEventListener('click', () => {
        if(rcvdClrs.length ===0){
            alert("Please enter the received colors first.");
            return;
        }
        const res= decode(rcvdClrs);
        const outElem =document.getElementById('rx-result');
        if(res.error){
            outElem.textContent= res.error;
            document.getElementById('rx-output').style.display ='block';
            return;
        }
        const rxBits =rcvdClrs.join('');
        let out =`Received bitstream: ${rxBits}

        Error detected: ${res.errDetected ? 'YES' : 'NO'}`;
        //error
        if(res.errDetected){
            if(res.errBitIdx >=0)
                out +=
            `\nDetected error bit index ` + 
            `(0-based in original message): ` +`${res.errBitIdx}\n`;
            else out +=`Error detected in padding/parity area.\n`;
        }

        //correct message
        let payloadStr = res.payload;
        if(res.errDetected && res.errBitIdx >= 0){
            const errIdx = res.errBitIdx;
            payloadStr = payloadStr.substring(0, errIdx) + '[' + payloadStr[errIdx] + ']' +payloadStr.substring(errIdx + 1);
        }
        out += `\nCorrected message:${payloadStr}`;
        outElem.textContent = out;
        document.getElementById('rx-output').style.display = 'block';
    });