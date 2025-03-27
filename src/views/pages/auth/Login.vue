<script setup>
import CustomerService from '@/services/CustomerService';
import EmployeeService from '@/services/EmployeeService'; // เพิ่ม import EmployeeService
import { useAuthenStore } from '@/stores/authen';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const appName = ref(import.meta.env.VITE_APP_NAME);

onMounted(() => {
    authenStore.loginErrorMsg = '';
});

// Add authentication store
const authenStore = useAuthenStore();

// Form refs
const username = ref('');
const password = ref('');
const userType = ref('customer'); // Default to customer login

// Customer search (for employee login)
const showCustomerSearch = ref(false);
const selectedCustomer = ref(null);
const isSearching = ref(false);
const customerOptions = ref([]);

// เพิ่มส่วนสำหรับเลือกพนักงาน (สำหรับลูกค้า)
const showEmployeeSelection = ref(false);
const selectedEmployee = ref(null);
const isSearchingEmployee = ref(false);
const employeeOptions = ref([]);
const skipEmployeeSelection = ref(false);

// Login function
// Login function
const doLogin = async (e) => {
    if (e) {
        e.preventDefault();
    }

    if (userType.value === 'customer') {
        // Login as customer
        const success = await authenStore.loginCustomer(username.value, password.value);

        // ตรวจสอบว่ามีพนักงานให้เลือกหรือไม่
        if (success && authenStore.isAuthenticated && authenStore.isCustomer) {
            try {
                // โหลดข้อมูลพนักงานเริ่มต้นเพื่อตรวจสอบ
                isSearchingEmployee.value = true;
                const data = await EmployeeService.getEmployees('', 50);

                // ถ้ามีพนักงานให้เลือก ให้แสดงหน้าเลือกพนักงาน
                if (Array.isArray(data) && data.length > 0) {
                    employeeOptions.value = data;
                    showEmployeeSelection.value = true;
                } else {
                    // ถ้าไม่มีพนักงาน ให้ข้ามไปหน้าหลักเลย
                    console.warn('ไม่พบข้อมูลพนักงาน ข้ามการเลือกพนักงาน');
                    router.push('/');
                }
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน:', error);
                // กรณีเกิดข้อผิดพลาด ให้ข้ามไปหน้าหลักเลย
                router.push('/');
            } finally {
                isSearchingEmployee.value = false;
            }
        }
    } else {
        // Login as employee
        const success = await authenStore.loginEmployee(username.value, password.value);

        // Check if login was successful for employee
        if (success && authenStore.isAuthenticated && authenStore.isEmployee) {
            try {
                // โหลดข้อมูลลูกค้าเริ่มต้นเพื่อตรวจสอบ
                isSearching.value = true;
                const data = await CustomerService.getCustomers('', 50);

                // ถ้ามีลูกค้าให้เลือก ให้แสดงหน้าเลือกลูกค้า
                if (Array.isArray(data) && data.length > 0) {
                    customerOptions.value = data;
                    showCustomerSearch.value = true;
                } else {
                    // ถ้าไม่มีลูกค้า ให้ข้ามไปหน้าหลักเลย
                    console.warn('ไม่พบข้อมูลลูกค้า ข้ามการเลือกลูกค้า');
                    router.push('/');
                }
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า:', error);
                // กรณีเกิดข้อผิดพลาด ให้ข้ามไปหน้าหลักเลย
                router.push('/');
            } finally {
                isSearching.value = false;
            }
        }
    }
};

// Switch user type
const switchUserType = (type) => {
    userType.value = type;
    // Clear form when switching
    username.value = '';
    password.value = '';
    authenStore.loginErrorMsg = '';
    showCustomerSearch.value = false;
    showEmployeeSelection.value = false; // เพิ่มการรีเซ็ตส่วนเลือกพนักงาน
    selectedCustomer.value = null;
    selectedEmployee.value = null; // เพิ่มการรีเซ็ตพนักงานที่เลือก
    skipEmployeeSelection.value = false; // รีเซ็ตการข้ามการเลือกพนักงาน
};

// Confirm customer selection and proceed
const confirmCustomerSelection = () => {
    if (!selectedCustomer.value) return;

    const customer = selectedCustomer.value;

    // Store customer data in localStorage แยกจากข้อมูลพนักงาน
    localStorage.setItem('_userCode', customer.code);
    localStorage.setItem(
        '_userData',
        JSON.stringify({
            user_code: customer.code,
            user_name: customer.name,
            address: customer.address,
            tax_id: customer.tax_id
        })
    );

    // อัพเดตค่าใน store ด้วย
    authenStore.userData = {
        user_code: customer.code,
        user_name: customer.name,
        address: customer.address,
        tax_id: customer.tax_id
    };
    authenStore.userCode = customer.code;

    // Close the search panel and navigate to home
    showCustomerSearch.value = false;
    router.push('/');
};

// เพิ่มฟังก์ชันยืนยันการเลือกพนักงานและดำเนินการต่อ
const confirmEmployeeSelection = () => {
    // บันทึกข้อมูลพนักงานที่เลือก
    if (selectedEmployee.value) {
        // บันทึกรหัสพนักงานที่ดูแลลูกค้านี้
        localStorage.setItem('_empCode', selectedEmployee.value.code);
        localStorage.setItem('_empData', JSON.stringify(selectedEmployee.value));
    }

    // ปิดหน้าค้นหาและนำทางไปหน้าหลัก
    showEmployeeSelection.value = false;
    router.push('/');
};

// เพิ่มฟังก์ชันข้ามการเลือกพนักงาน
const skipEmployeeSelectionFn = () => {
    // ล้างข้อมูลพนักงานที่เคยเลือกไว้ (ถ้ามี)
    localStorage.removeItem('_empCode');
    localStorage.removeItem('_empData');

    // ปิดหน้าค้นหาและนำทางไปหน้าหลัก
    showEmployeeSelection.value = false;
    router.push('/');
};

// Handle customer filtering in Select
const filterCustomers = async (event) => {
    try {
        isSearching.value = true;

        // ดึงค่าที่ผู้ใช้พิมพ์ค้นหาจาก event
        const searchTerm = event.value || '';

        // ถ้าข้อความค้นหาสั้นเกินไป ให้โหลดข้อมูลเริ่มต้น
        if (searchTerm.trim().length < 2) {
            const data = await CustomerService.getCustomers('', 50);
            if (Array.isArray(data) && data.length > 0) {
                customerOptions.value = data;
            } else {
                customerOptions.value = [];
            }
            return;
        }

        // เพิ่มการจำกัดจำนวนผลลัพธ์ที่จะแสดง
        const data = await CustomerService.getCustomers(searchTerm, 100);
        console.log('ผลการค้นหาลูกค้า (จำนวน):', data ? data.length : 0);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
            console.log('จำนวนลูกค้าที่ค้นพบ:', customerOptions.value.length);
        } else {
            console.warn('ไม่พบลูกค้าที่ตรงกับคำค้นหา');
            customerOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาลูกค้า:', error);
        customerOptions.value = [];
    } finally {
        isSearching.value = false;
    }
};

// เพิ่มฟังก์ชันค้นหาพนักงาน
const filterEmployees = async (event) => {
    try {
        isSearchingEmployee.value = true;

        // ดึงค่าที่ผู้ใช้พิมพ์ค้นหาจาก event
        const searchTerm = event.value || '';

        // ถ้าข้อความค้นหาสั้นเกินไป ให้โหลดข้อมูลเริ่มต้น
        if (searchTerm.trim().length < 2) {
            const data = await EmployeeService.getEmployees('', 50);
            if (Array.isArray(data) && data.length > 0) {
                employeeOptions.value = data;
            } else {
                employeeOptions.value = [];
            }
            return;
        }

        // เพิ่มการจำกัดจำนวนผลลัพธ์ที่จะแสดง
        const data = await EmployeeService.getEmployees(searchTerm, 100);
        console.log('ผลการค้นหาพนักงาน (จำนวน):', data ? data.length : 0);

        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;
            console.log('จำนวนพนักงานที่ค้นพบ:', employeeOptions.value.length);
        } else {
            console.warn('ไม่พบพนักงานที่ตรงกับคำค้นหา');
            employeeOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาพนักงาน:', error);
        employeeOptions.value = [];
    } finally {
        isSearchingEmployee.value = false;
    }
};
// Computed property to determine if the form should be shown
const showLoginForm = computed(() => {
    return !showCustomerSearch.value && !showEmployeeSelection.value;
});

/// logout function
function logout() {
    authenStore.logout();
    showCustomerSearch.value = false;
    showEmployeeSelection.value = false;
    selectedCustomer.value = null;
    selectedEmployee.value = null;
    username.value = '';
    password.value = '';
    authenStore.loginErrorMsg = '';
    skipEmployeeSelection.value = false;
}
</script>
<template>
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <!-- ปรับให้กล่อง login เต็มจอใน sm และ md, แต่ยังคงมีขนาดจำกัดใน lg ขึ้นไป -->
        <div class="flex flex-col items-center justify-center w-full px-3 sm:px-4 md:max-w-lg lg:max-w-lg">
            <div class="w-full" style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-4 sm:py-6 md:py-8 lg:py-20 px-4 sm:px-6 md:px-8 lg:px-10" style="border-radius: 53px">
                    <div class="text-center mb-5">
                        <div class="flex justify-center mb-3 sm:mb-4">
                            <img src="../../../assets/4670240.jpg" alt="sml-center" width="120" class="sm:w-150 md:w-180 lg:w-200" />
                        </div>
                        <div class="text-surface-900 dark:text-surface-0 text-2xl sm:text-2xl md:text-3xl font-medium mb-2 sm:mb-3">{{ appName }}</div>
                        <span class="text-muted-color font-medium text-sm sm:text-base">
                            <template v-if="showCustomerSearch">เลือกลูกค้า</template>
                            <template v-else-if="showEmployeeSelection">เลือกพนักงานที่ดูแล</template>
                            <template v-else>เข้าสู่ระบบเพื่อดำเนินการต่อ</template>
                        </span>
                    </div>

                    <!-- ส่วนค้นหาลูกค้า (สำหรับพนักงานที่ล็อกอินแล้ว) -->
                    <div v-if="showCustomerSearch" class="customer-search-section">
                        <!-- สถานะกำลังโหลดข้อมูลลูกค้าเริ่มต้น -->
                        <div v-if="isSearching && customerOptions.length === 0" class="flex flex-column align-items-center justify-content-center p-4 gap-3">
                            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                        </div>

                        <!-- การค้นหาลูกค้าด้วย Select -->
                        <!-- Customer Search with Optimizations -->
                        <div class="mb-4">
                            <label class="block text-surface-900 dark:text-surface-0 font-medium mb-2">ค้นหาลูกค้า</label>

                            <Select
                                v-model="selectedCustomer"
                                :options="customerOptions"
                                optionLabel="name"
                                placeholder="เลือกลูกค้า"
                                class="w-full"
                                :loading="isSearching"
                                filter
                                @filter="filterCustomers"
                                filterPlaceholder="พิมพ์ชื่อหรือรหัสลูกค้า"
                                :virtualScrollerOptions="{ itemSize: 48, lazy: true, delay: 250 }"
                                :showClear="true"
                            >
                                <template #value="slotProps">
                                    <div v-if="slotProps.value" class="flex items-center">
                                        <i class="pi pi-user mr-2 text-primary"></i>
                                        <div>{{ slotProps.value.code ? slotProps.value.code : '' }} {{ slotProps.value.name ? slotProps.value.name : '' }}</div>
                                    </div>
                                    <span v-else>
                                        {{ slotProps.placeholder }}
                                    </span>
                                </template>
                                <template #option="slotProps">
                                    <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                                        <div class="font-bold">{{ slotProps.option.code }}</div>
                                        <div>{{ slotProps.option.name }}</div>
                                    </div>
                                </template>
                            </Select>

                            <small class="text-color-secondary">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา หรือเลือกจากรายการ</small>
                        </div>

                        <!-- แสดงข้อมูลลูกค้าเพิ่มเติมและปุ่มยืนยัน -->
                        <div v-if="selectedCustomer" class="mt-4">
                            <Card class="border-1 border-primary-200 dark:border-primary-800 shadow-3">
                                <template #header>
                                    <div class="flex align-items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900">
                                        <i class="pi pi-user-edit text-primary" style="font-size: 1.5rem"></i>
                                        <h3 class="m-0 font-medium text-xl">ข้อมูลลูกค้า</h3>
                                    </div>
                                </template>
                                <template #content>
                                    <div class="grid">
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-2">
                                            <div class="font-bold text-lg text-primary mb-2">รหัส:</div>
                                            <div class="pl-3">{{ selectedCustomer.code }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-2">
                                            <div class="font-bold text-lg text-primary mb-2">ชื่อ:</div>
                                            <div class="pl-3">{{ selectedCustomer.name }}</div>
                                        </div>

                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-2" v-if="selectedCustomer.tax_id">
                                            <div class="font-bold text-lg text-primary mb-2">เลขประจำตัวผู้เสียภาษี:</div>
                                            <div class="pl-3">{{ selectedCustomer.tax_id }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-2">
                                            <div class="font-bold text-lg text-primary mb-2">ที่อยู่:</div>
                                            <div class="pl-3">{{ selectedCustomer.address }}</div>
                                        </div>
                                    </div>
                                </template>
                                <template #footer>
                                    <div class="flex flex-column sm:flex-row gap-2 justify-content-between">
                                        <Button icon="pi pi-times" label="ยกเลิก" severity="secondary" outlined class="w-full sm:w-auto" @click="selectedCustomer = null" />
                                        <Button icon="pi pi-check" label="ใช้ลูกค้านี้" severity="success" class="w-full sm:w-auto" @click="confirmCustomerSelection" />
                                    </div>
                                </template>
                            </Card>
                        </div>

                        <!-- ปุ่มล็อกเอาท์ -->
                        <div class="mt-4 mb-4">
                            <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                        </div>
                    </div>

                    <!-- เพิ่มส่วนค้นหาพนักงาน (สำหรับลูกค้าที่ล็อกอินแล้ว) -->
                    <div v-if="showEmployeeSelection" class="employee-search-section">
                        <!-- สถานะกำลังโหลดข้อมูลพนักงานเริ่มต้น -->
                        <div v-if="isSearchingEmployee && employeeOptions.length === 0" class="flex flex-column align-items-center justify-content-center p-4 gap-3">
                            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                        </div>

                        <!-- การค้นหาพนักงานด้วย Select -->
                        <div class="mb-4">
                            <label class="block text-surface-900 dark:text-surface-0 font-medium mb-2">เลือกพนักงานที่ดูแล (ไม่บังคับ)</label>

                            <Select
                                v-model="selectedEmployee"
                                :options="employeeOptions"
                                optionLabel="name"
                                placeholder="เลือกพนักงาน"
                                class="w-full"
                                :loading="isSearchingEmployee"
                                filter
                                @filter="filterEmployees"
                                filterPlaceholder="พิมพ์ชื่อหรือรหัสพนักงาน"
                                :virtualScrollerOptions="{ itemSize: 48, lazy: true, delay: 250 }"
                                :showClear="true"
                            >
                                <template #value="slotProps">
                                    <div v-if="slotProps.value" class="flex items-center">
                                        <i class="pi pi-user mr-2 text-primary"></i>
                                        <div>{{ slotProps.value.code ? slotProps.value.code : '' }} {{ slotProps.value.name ? slotProps.value.name : '' }}</div>
                                    </div>
                                    <span v-else>
                                        {{ slotProps.placeholder }}
                                    </span>
                                </template>
                                <template #option="slotProps">
                                    <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                                        <div class="font-bold">{{ slotProps.option.code }}</div>
                                        <div>{{ slotProps.option.name }}</div>
                                    </div>
                                </template>
                            </Select>

                            <small class="text-color-secondary">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา หรือเลือกจากรายการ</small>
                        </div>

                        <!-- แสดงข้อมูลพนักงานเพิ่มเติมและปุ่มยืนยัน -->
                        <div v-if="selectedEmployee" class="mt-4">
                            <Card class="border-1 border-primary-200 dark:border-primary-800 shadow-3">
                                <template #header>
                                    <div class="flex align-items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900">
                                        <i class="pi pi-id-card text-primary" style="font-size: 1.5rem"></i>
                                        <h3 class="m-0 font-medium text-xl">ข้อมูลพนักงาน</h3>
                                    </div>
                                </template>
                                <template #content>
                                    <div class="grid">
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-2">
                                            <div class="font-bold text-lg text-primary mb-2">รหัส:</div>
                                            <div class="pl-3">{{ selectedEmployee.code }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-2">
                                            <div class="font-bold text-lg text-primary mb-2">ชื่อ:</div>
                                            <div class="pl-3">{{ selectedEmployee.name }}</div>
                                        </div>
                                    </div>
                                </template>
                                <template #footer>
                                    <div class="flex flex-column sm:flex-row gap-2 justify-content-between">
                                        <Button icon="pi pi-times" label="ยกเลิก" severity="secondary" outlined class="w-full sm:w-auto" @click="selectedEmployee == null" />
                                        <Button icon="pi pi-check" label="ใช้พนักงานนี้" severity="success" class="w-full sm:w-auto" @click="confirmEmployeeSelection" />
                                    </div>
                                </template>
                            </Card>
                        </div>

                        <!-- ปุ่มยืนยันหรือข้าม -->
                        <div class="mt-4 flex flex-column sm:flex-row gap-2">
                            <Button label="ข้ามการเลือกพนักงาน" icon="pi pi-step-forward" severity="secondary" outlined class="w-full" @click="skipEmployeeSelectionFn" />
                        </div>

                        <!-- ปุ่มล็อกเอาท์ -->
                        <div class="mt-4 mb-4">
                            <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                        </div>
                    </div>

                    <!-- ส่วนฟอร์มล็อกอิน -->
                    <div v-if="showLoginForm">
                        <!-- Toggle buttons for user type -->
                        <div class="login-type-switch mb-5 flex justify-center">
                            <SelectButton
                                v-model="userType"
                                :options="[
                                    { label: 'ลูกค้า', value: 'customer' },
                                    { label: 'พนักงาน', value: 'employee' }
                                ]"
                                optionLabel="label"
                                optionValue="value"
                                class="login-type-buttons"
                                @change="switchUserType(userType)"
                            />
                        </div>

                        <form @submit="doLogin">
                            <label :for="userType === 'customer' ? 'customer-code' : 'employee-code'" class="block text-surface-900 dark:text-surface-0 text-lg sm:text-xl font-medium mb-1 sm:mb-2">
                                {{ userType === 'customer' ? 'รหัสลูกค้า' : 'รหัสพนักงาน' }}
                            </label>
                            <InputText
                                :id="userType === 'customer' ? 'customer-code' : 'employee-code'"
                                type="text"
                                :placeholder="userType === 'customer' ? 'รหัสลูกค้า (เช่น OR-XXXXX)' : 'รหัสพนักงาน'"
                                class="w-full mb-4 sm:mb-6"
                                v-model="username"
                                @keyup.enter="doLogin"
                            />

                            <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-lg sm:text-xl mb-1 sm:mb-2">รหัสผ่าน</label>
                            <Password id="password1" v-model="password" placeholder="รหัสผ่าน" :toggleMask="true" class="mb-4 sm:mb-6" fluid :feedback="false" @keyup.enter="doLogin"></Password>

                            <!-- Show error message if exists -->
                            <div v-if="authenStore.loginErrorMsg" class="p-3 bg-red-100 text-red-700 rounded mb-4 dark:bg-red-900 dark:text-red-100">
                                <i class="pi pi-exclamation-triangle mr-2"></i>
                                {{ authenStore.loginErrorMsg }}
                            </div>

                            <!-- Login button -->
                            <Button :label="userType === 'customer' ? 'เข้าสู่ระบบลูกค้า' : 'เข้าสู่ระบบพนักงาน'" icon="pi pi-sign-in" class="w-full" type="submit" :loading="authenStore.loading"></Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
