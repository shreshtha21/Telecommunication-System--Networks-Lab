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
        const row = gridData.slice(i*c, (i+1)*c).split('').map(Number);
        grid.push(row);
    }

    //calc parity
    const rowP = new Array(r).fill(0);
    const colP = new Array(c).fill(0);
    for(let i=0;i<r;i++){
        for(let j=0;j<c;j++){
            rowP[i] ^= grid[i][j];
            colP[j] ^= grid[i][j];
        }
    }

    //final msg
    const encodedBits =lenBits +padMsg +rowP.join('') +colP.join('');

    //add err
    const txBits = encodedBits.split('');
    const errIdx = Number.parseInt(errorIndex, 10);

    if (!Number.isNaN(errIdx) && errIdx >= 0) {
        if(errIdx >= L) throw new Error(`Error bit index must be between 0 and ${L - 1}.`);
        txBits[6 + errIdx] = txBits[6 + errIdx] === '0' ? '1' : '0';
    }

    let finalStr = txBits.join('');
    if(finalStr.length % 2 !== 0) finalStr += '0';
    
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