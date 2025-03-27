import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

class DocHistoryService {
    // ดึงรายการเอกสาร
    async getDocList(custCode, transFlag = '') {
        return apiClient.get('service/wawashopservice/getDocList', {
            params: {
                cust_code: custCode,
                trans_flag: transFlag
            }
        });
    }

    // ดึงรายละเอียดเอกสาร
    async getDocDetail(custCode, docNo) {
        return apiClient.get('service/wawashopservice/getDocDetail', {
            params: {
                cust_code: custCode,
                doc_no: docNo
            }
        });
    }
}

export default new DocHistoryService();
