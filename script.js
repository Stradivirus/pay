document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('amount');
    const payButton = document.getElementById('payButton');
    const resultDiv = document.getElementById('result');
    const receiptContainer = document.getElementById('receiptContainer');
    const receiptContent = document.getElementById('receiptContent');
    const downloadButton = document.getElementById('downloadButton');
    const verifyButton = document.getElementById('verifyButton');

    let currentSignature = '';
    let currentReceiptData = null;

    payButton.addEventListener('click', processPayment);
    downloadButton.addEventListener('click', downloadReceipt);
    verifyButton.addEventListener('click', verifyReceipt);

    function utcToKst(utcDateString) {
        return new Date(utcDateString).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'});
    }

    async function processPayment() {
        const amount = amountInput.value;

        if (!amount) {
            resultDiv.textContent = '금액을 입력하세요';
            return;
        }

        resultDiv.textContent = 'Processing payment...';

        try {
            const response = await fetch('https://asia-northeast3-pay-test-433402.cloudfunctions.net/processPayment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: { amount: parseFloat(amount) } })
            });

            const data = await response.json();
            console.log('Response data:', data);

            if (data.success) {
                resultDiv.textContent = `결제 성공!`;
                displayReceipt(data);
                currentSignature = data.signature;
                currentReceiptData = data.receipt;
                verifyButton.style.display = 'block';
            } else {
                resultDiv.textContent = `결제 실패: ${data.error || 'Unknown error'}`;
            }
        } catch (error) {
            console.error('Error:', error);
            resultDiv.textContent = `Error: ${error.message}`;
        }
    }

    function displayReceipt(data) {
        console.log('Displaying receipt:', data);
        if (!data.receipt) {
            console.error('Receipt data is missing');
            return;
        }

        try {
            receiptContent.innerHTML = `
                <p><strong>Transaction ID:</strong> ${data.receipt.transactionId}</p>
                <p><strong>가격:</strong> $${data.receipt.amount.toFixed(2)}</p>
                <p><strong>시간:</strong> ${utcToKst(data.receipt.date)}</p>
                <p><strong>판매자:</strong> ${data.receipt.merchantName}</p>
                <p><strong>판매처:</strong> ${data.receipt.merchantAddress}</p>
            `;
            receiptContainer.style.display = 'block';
            downloadButton.style.display = 'block';
        } catch (error) {
            console.error('Error displaying receipt:', error);
            resultDiv.textContent += '\nError displaying receipt. Please check console for details.';
        }
    }

    function downloadReceipt() {
        try {
            const receiptText = `
Transaction ID: ${currentReceiptData.transactionId}
Price: $${currentReceiptData.amount.toFixed(2)}
Date (UTC): ${currentReceiptData.date}
Date (KST): ${utcToKst(currentReceiptData.date)}
Merchant: ${currentReceiptData.merchantName}
Address: ${currentReceiptData.merchantAddress}
            `.trim();

            const blob = new Blob([receiptText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt_${currentReceiptData.transactionId}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading receipt:', error);
            resultDiv.textContent = 'Error downloading receipt. Please try again.';
        }
    }
    
    async function verifyReceipt() {
        try {
            if (!currentReceiptData) {
                throw new Error('No receipt data available');
            }

            const receiptData = {
                transactionId: currentReceiptData.transactionId,
                amount: currentReceiptData.amount,
                date: currentReceiptData.date // UTC date
            };

            console.log("Receipt data being sent:", JSON.stringify(receiptData, null, 2));

            const response = await fetch('https://asia-northeast3-pay-test-433402.cloudfunctions.net/verifyReceipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(receiptData)
            });

            const data = await response.json();
            console.log("Response from server:", JSON.stringify(data, null, 2));

            if (data.isValid) {
                alert('Receipt is valid!');
            } else {
                alert('Receipt is invalid!');
            }
        } catch (error) {
            console.error('Error verifying receipt:', error);
            console.error('Error stack:', error.stack);
            alert(`Error verifying receipt: ${error.message}`);
        }
    }
});