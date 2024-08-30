document.addEventListener('DOMContentLoaded', () => {
    // 로그인 상태 확인
    if (!sessionStorage.getItem('isLoggedIn')) {
        // 로그인 상태가 아니면 index.html로 리디렉션
        window.location.href = 'index.html';
        return;
    }

    const container = document.querySelector('.container');
    const amountInput = document.getElementById('amount');
    const payButton = document.getElementById('payButton');
    const resultDiv = document.getElementById('result');
    const receiptContainer = document.getElementById('receiptContainer');
    const receiptContent = document.getElementById('receiptContent');
    const downloadButton = document.getElementById('downloadButton');
    const verifyButton = document.getElementById('verifyButton');
    const inquiryButton = document.getElementById('inquiryButton');
    const refundButton = document.getElementById('refundButton');

    let currentSignature = '';
    let currentReceiptData = null;

    // 각 요소가 존재하는지 확인하고 이벤트 리스너 추가
    if (amountInput) {
        amountInput.addEventListener('input', function() {
            if (this.value) {
                container.classList.add('show-receipt');
            } else {
                container.classList.remove('show-receipt');
            }
        });
    }

    if (payButton) payButton.addEventListener('click', processPayment);
    if (downloadButton) downloadButton.addEventListener('click', downloadReceipt);
    if (verifyButton) verifyButton.addEventListener('click', verifyReceipt);
    if (inquiryButton) inquiryButton.addEventListener('click', handleInquiry);
    if (refundButton) refundButton.addEventListener('click', handleRefund);

    function utcToKst(utcDateString) {
        return new Date(utcDateString).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'});
    }

    function formatAmount(amount) {
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
    }

    async function processPayment() {
        const amount = amountInput.value;

        if (!amount) {
            resultDiv.textContent = '금액을 입력하세요';
            return;
        }

        resultDiv.textContent = '결제 처리 중...';

        try {
            const response = await fetch('https://asia-northeast3-pay-test-433402.cloudfunctions.net/processPayment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: { amount: parseFloat(amount) } })
            });

            const data = await response.json();
            console.log('Payment response data:', data);

            if (data.success) {
                resultDiv.textContent = `결제 성공! 영수증 생성 중...`;
                container.classList.add('show-receipt');
                receiptContainer.style.display = 'block';
                await generateReceipt(data.transactionId, data.amount, data.date);
            } else {
                resultDiv.textContent = `결제 실패: ${data.error || '알 수 없는 오류'}`;
            }
        } catch (error) {
            console.error('Error:', error);
            resultDiv.textContent = `오류: ${error.message}`;
        }
    }

    async function generateReceipt(transactionId, amount, date) {
        try {
            const response = await fetch('https://asia-northeast3-pay-test-433402.cloudfunctions.net/generateReceipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: { transactionId, amount, date } })
            });

            const data = await response.json();
            console.log('Receipt response data:', data);

            if (data.success) {
                displayReceipt(data);
                currentSignature = data.signature;
                currentReceiptData = data.receipt;
                if (verifyButton) verifyButton.style.display = 'block';
                resultDiv.textContent += '\n영수증 생성 완료!';
            } else {
                resultDiv.textContent += '\n영수증 생성 실패: ' + (data.error || '알 수 없는 오류');
            }
        } catch (error) {
            console.error('Error generating receipt:', error);
            resultDiv.textContent += '\n영수증 생성 중 오류 발생: ' + error.message;
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
                <p><strong>거래 ID:</strong> ${data.receipt.transactionId}</p>
                <p><strong>가격:</strong> ${formatAmount(data.receipt.amount)}</p>
                <p><strong>시간:</strong> ${utcToKst(data.receipt.date)}</p>
                <p><strong>판매자:</strong> ${data.receipt.merchantName}</p>
                <p><strong>판매처:</strong> ${data.receipt.merchantAddress}</p>
            `;
            receiptContainer.style.display = 'block';
            if (downloadButton) downloadButton.style.display = 'block';
        } catch (error) {
            console.error('Error displaying receipt:', error);
            resultDiv.textContent += '\n영수증 표시 중 오류가 발생했습니다. 자세한 내용은 콘솔을 확인해주세요.';
        }
    }

    function downloadReceipt() {
        try {
            const receiptText = `
거래 ID: ${currentReceiptData.transactionId}
가격: ${formatAmount(currentReceiptData.amount)}
날짜 (UTC): ${currentReceiptData.date}
날짜 (KST): ${utcToKst(currentReceiptData.date)}
판매자: ${currentReceiptData.merchantName}
주소: ${currentReceiptData.merchantAddress}
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
            resultDiv.textContent = '영수증 다운로드 중 오류가 발생했습니다. 다시 시도해 주세요.';
        }
    }
    
    async function verifyReceipt() {
        try {
            if (!currentReceiptData) {
                throw new Error('사용 가능한 영수증 데이터가 없습니다');
            }

            const receiptData = {
                transactionId: currentReceiptData.transactionId,
                amount: currentReceiptData.amount,
                date: currentReceiptData.date // UTC date
            };

            console.log("전송되는 영수증 데이터:", JSON.stringify(receiptData, null, 2));

            const response = await fetch('https://asia-northeast3-pay-test-433402.cloudfunctions.net/verifyReceipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(receiptData)
            });

            const data = await response.json();
            console.log("서버 응답:", JSON.stringify(data, null, 2));

            if (data.isValid) {
                alert('영수증이 유효합니다!');
            } else {
                alert('영수증이 유효하지 않습니다!');
            }
        } catch (error) {
            console.error('영수증 검증 중 오류:', error);
            console.error('오류 스택:', error.stack);
            alert(`영수증 검증 중 오류 발생: ${error.message}`);
        }
    }

    function handleInquiry() {
        window.location.href = 'inquiry.html';
    }

    function handleRefund() {
        window.location.href = 'refund.html';
    }
});