import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

class OrderHistoryService {
    // ดึงประวัติการสั่งซื้อตาม customer code
    async getOrderHistory(custCode, status = '') {
        return apiClient.get('service/wawashopservice/getOrderHistory', {
            params: {
                cust_code: custCode,
                status: status
            }
        });
    }

    // ดึงรายละเอียดคำสั่งซื้อแต่ละรายการ
    async getOrderDetail(custCode, docNo) {
        return apiClient.get('service/wawashopservice/getOrderDetail', {
            params: {
                cust_code: custCode,
                doc_no: docNo
            }
        });
    }
}

export default new OrderHistoryService();
