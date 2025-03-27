// stores/authen.js
import router from '@/router';
import UserService from '@/services/UserService';
import { defineStore } from 'pinia';

export const useAuthenStore = defineStore('authen', {
    state: () => ({
        loginSuccess: false,
        loginErrorMsg: '',
        token: localStorage.getItem('_token') || '',
        loading: false,
        userType: localStorage.getItem('_userType') || '', // 'customer' หรือ 'employee'
        userData: JSON.parse(localStorage.getItem('_userData') || '{}'),
        empData: JSON.parse(localStorage.getItem('_empData') || '{}'),
        userCode: localStorage.getItem('_userCode') || '',
        empCode: localStorage.getItem('_empCode') || ''
    }),

    getters: {
        isAuthenticated: (state) => !!state.token,
        isCustomer: (state) => state.userType === 'customer',
        isEmployee: (state) => state.userType === 'employee',
        fullName: (state) => {
            if (state.userType === 'customer') {
                return state.userData?.user_name || '';
            }
            return state.empData?.user_name || '';
        },
        userAddress: (state) => {
            if (state.userType === 'customer') {
                return state.userData?.address || '';
            }
            return state.empData?.address || '';
        },
        userTelephone: (state) => {
            if (state.userType === 'customer') {
                return state.userData?.telephone || '';
            }
            return state.empData?.telephone || '';
        }
    },

    actions: {
        /**
         * ลงชื่อเข้าใช้สำหรับลูกค้า
         * @param {string} userCode รหัสลูกค้า
         * @param {string} password รหัสผ่าน
         * @param {string} returnUrl URL สำหรับ redirect หลังจากลงชื่อเข้าใช้สำเร็จ
         */
        async loginCustomer(userCode, password) {
            this.loading = true;
            this.loginErrorMsg = '';

            try {
                const response = await UserService.loginCustomer(userCode, password);

                if (response.success && response.data && response.data.length > 0) {
                    const userData = response.data[0];

                    // บันทึกข้อมูลลง state และ localStorage
                    this.token = 'CUSTOMER_TOKEN_' + Date.now();
                    this.userType = 'customer';
                    this.userData = userData;
                    this.empData = {}; // ล้างข้อมูลพนักงาน
                    this.userCode = userData.user_code;
                    this.empCode = ''; // ล้างรหัสพนักงาน
                    this.loginSuccess = true;

                    localStorage.setItem('_token', this.token);
                    localStorage.setItem('_userType', 'customer');
                    localStorage.setItem('_userData', JSON.stringify(userData));
                    localStorage.removeItem('_empData'); // ล้างข้อมูลพนักงานออกจาก localStorage
                    localStorage.setItem('_userCode', userData.user_code);
                    localStorage.removeItem('_empCode'); // ล้างรหัสพนักงานออกจาก localStorage

                    // ไม่นำทางไปหน้าหลักทันที เพื่อให้ผู้ใช้สามารถเลือกพนักงานได้ก่อน
                    // router.push(returnUrl || '/');

                    return true; // เพิ่มการ return true เพื่อบอกว่าล็อกอินสำเร็จ
                } else {
                    throw new Error('รหัสลูกค้าหรือรหัสผ่านไม่ถูกต้อง');
                }
            } catch (error) {
                console.error('การลงชื่อเข้าใช้ลูกค้าล้มเหลว:', error);
                this.loginSuccess = false;
                this.loginErrorMsg = error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
                return false; // เพิ่มการ return false เพื่อบอกว่าล็อกอินไม่สำเร็จ
            } finally {
                this.loading = false;
            }
        },

        /**
         * ลงชื่อเข้าใช้สำหรับพนักงาน
         * @param {string} empCode รหัสพนักงาน
         * @param {string} password รหัสผ่าน
         * @param {string} returnUrl URL สำหรับ redirect หลังจากลงชื่อเข้าใช้สำเร็จ
         */
        async loginEmployee(empCode, password) {
            this.loading = true;
            this.loginErrorMsg = '';

            try {
                const response = await UserService.loginEmployee(empCode, password);

                if (response.success && response.data && response.data.length > 0) {
                    const empData = response.data[0];

                    // บันทึกข้อมูลลง state และ localStorage
                    this.token = 'EMPLOYEE_TOKEN_' + Date.now();
                    this.userType = 'employee';
                    this.empData = empData;
                    this.userData = {}; // ล้างข้อมูลลูกค้า
                    this.empCode = empData.user_code;
                    this.userCode = ''; // ล้างรหัสลูกค้า
                    this.loginSuccess = true;

                    localStorage.setItem('_token', this.token);
                    localStorage.setItem('_userType', 'employee');
                    localStorage.setItem('_empData', JSON.stringify(empData));
                    localStorage.removeItem('_userData'); // ล้างข้อมูลลูกค้าออกจาก localStorage
                    localStorage.setItem('_empCode', empData.user_code);
                    localStorage.removeItem('_userCode'); // ล้างรหัสลูกค้าออกจาก localStorage

                    // สำหรับพนักงาน ไม่นำทางไปที่ไหนทันที แต่ส่งค่า true กลับเพื่อให้หน้า login แสดงส่วนค้นหาลูกค้า
                    return true; // เพิ่มการ return ค่าเพื่อให้หน้า login รู้ว่าล็อกอินสำเร็จ
                } else {
                    throw new Error('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
                }
            } catch (error) {
                console.error('การลงชื่อเข้าใช้พนักงานล้มเหลว:', error);
                this.loginSuccess = false;
                this.loginErrorMsg = error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
                return false; // เพิ่มการ return ค่าเพื่อให้หน้า login รู้ว่าล็อกอินไม่สำเร็จ
            } finally {
                this.loading = false;
            }
        },

        /**
         * ลงชื่อเข้าใช้ (สำหรับความเข้ากันได้กับโค้ดเดิม)
         * @param {string} username รหัสผู้ใช้
         * @param {string} password รหัสผ่าน
         * @param {string} returnUrl URL สำหรับ redirect หลังจากลงชื่อเข้าใช้สำเร็จ
         */
        async login(username, password, returnUrl = '') {
            // ใช้ login ลูกค้าเป็นค่าเริ่มต้น
            await this.loginCustomer(username, password, returnUrl);
        },

        /**
         * ออกจากระบบ
         */
        logout() {
            // ล้างข้อมูลออกจาก state
            this.token = '';
            this.userType = '';
            this.userData = {};
            this.empData = {};
            this.userCode = '';
            this.empCode = '';
            this.loginSuccess = false;

            // ล้างข้อมูลออกจาก localStorage
            localStorage.removeItem('_token');
            localStorage.removeItem('_userType');
            localStorage.removeItem('_userData');
            localStorage.removeItem('_empData');
            localStorage.removeItem('_userCode');
            localStorage.removeItem('_empCode');

            // นำทางกลับไปยังหน้า login
            router.push('/auth/login');
        },

        /**
         * ตรวจสอบสถานะการลงชื่อเข้าใช้
         * @returns {boolean} สถานะการลงชื่อเข้าใช้
         */
        checkAuth() {
            if (!this.token) {
                router.push('/auth/login');
                return false;
            }
            return true;
        }
    }
});
