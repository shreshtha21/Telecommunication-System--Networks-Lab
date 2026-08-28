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