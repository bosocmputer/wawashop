<!-- eslint-disable no-unused-vars -->
<script setup>
import CartService from '@/services/CartService';
import CustomerService from '@/services/CustomerService';
import EmployeeService from '@/services/EmployeeService';
import ProductService from '@/services/ProductService';
import { onMounted, ref } from 'vue';

const props = defineProps({
    cartItems: {
        type: Array,
        required: true
    },
    userType: {
        type: String,
        default: ''
    },
    userData: {
        type: Object,
        default: () => ({})
    },
    orderData: {
        type: Object,
        default: () => ({
            deliveryMethod: 'pickup',
            employeeCode: '',
            customerCode: '',
            deliveryAddress: '',
            deliveryTelephone: ''
        })
    },
    totals: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['prev-step', 'process-checkout']);

// Local states
const isCheckingOut = ref(false);
const errorMessage = ref('');
const confirmedItems = ref([]);

// Form data
const formData = ref({
    deliveryMethod: props.orderData.deliveryMethod,
    employeeCode: props.orderData.employeeCode,
    customerCode: props.orderData.customerCode || '',
    deliveryAddress: props.orderData.deliveryAddress || props.userData.address || '',
    deliveryTelephone: props.orderData.deliveryTelephone || props.userData.telephone || ''
});

// Employee selection
const selectedEmployee = ref(null);
const isSearchingEmployee = ref(false);
const employeeOptions = ref([]);
const selectedEmployeeCode = ref(localStorage.getItem('_empCode') || '');

// Customer selection
const selectedCustomer = ref(null);
const isSearchingCustomer = ref(false);
const customerOptions = ref([]);
const selectedCustomerCode = ref(localStorage.getItem('_userCode') || '');

// Terms and conditions
const termsDialog = ref(false);
const termsAccepted = ref(false);

onMounted(async () => {
    try {
        // ดึงข้อมูลราคายืนยัน
        if (props.userData && props.userData.user_code) {
            const response = await CartService.getCartOrder(props.userData.user_code);
            if (response && response.data && response.data.data) {
                confirmedItems.value = response.data.data;
            }
        }

        // ดึงข้อมูลพนักงานและลูกค้า
        if (selectedEmployeeCode.value) {
            formData.value.employeeCode = selectedEmployeeCode.value;
        }

        if (selectedCustomerCode.value) {
            formData.value.customerCode = selectedCustomerCode.value;
        }

        await Promise.all([loadInitialEmployees()]);
        // await Promise.all([loadInitialEmployees(), loadInitialCustomers()]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
    }
});

// โหลดข้อมูลพนักงานเริ่มต้น
const loadInitialEmployees = async () => {
    try {
        isSearchingEmployee.value = true;
        const data = await EmployeeService.getEmployees('', 50);

        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;

            if (selectedEmployeeCode.value) {
                selectedEmployee.value = data.find((emp) => emp.code === selectedEmployeeCode.value) || null;
            }
        } else {
            employeeOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน:', error);
        employeeOptions.value = [];
    } finally {
        isSearchingEmployee.value = false;
    }
};

// ค้นหาพนักงาน
const filterEmployees = async (event) => {
    try {
        isSearchingEmployee.value = true;
        const searchTerm = event.value || '';

        if (searchTerm.trim().length < 2) {
            await loadInitialEmployees();
            return;
        }

        const data = await EmployeeService.getEmployees(searchTerm, 100);

        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;
        } else {
            employeeOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาพนักงาน:', error);
        employeeOptions.value = [];
    } finally {
        isSearchingEmployee.value = false;
    }
};

// เมื่อมีการเลือกพนักงาน
const onEmployeeSelect = (employee) => {
    if (employee) {
        formData.value.employeeCode = employee.code;
        localStorage.setItem('_empCode', selectedEmployee.value.code);
        localStorage.setItem('_empData', JSON.stringify(selectedEmployee.value));
    } else {
        formData.value.employeeCode = '';
        localStorage.removeItem('_empCode');
        localStorage.removeItem('_empData');
    }
};

// โหลดข้อมูลลูกค้าเริ่มต้น
const loadInitialCustomers = async () => {
    try {
        isSearchingCustomer.value = true;
        const data = await CustomerService.getCustomers('', 50);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;

            if (selectedCustomerCode.value && selectedCustomerCode.value.trim() !== '') {
                const matchedCustomer = data.find((cust) => cust.code === selectedCustomerCode.value);
                if (matchedCustomer) {
                    selectedCustomer.value = matchedCustomer;
                    formData.value.customerCode = matchedCustomer.code;
                } else {
                    await searchCustomerByCode(selectedCustomerCode.value);
                }
            }
        } else {
            customerOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า:', error);
        customerOptions.value = [];
    } finally {
        isSearchingCustomer.value = false;
    }
};

// ค้นหาลูกค้าด้วยรหัส
const searchCustomerByCode = async (code) => {
    if (!code) return;

    try {
        isSearchingCustomer.value = true;
        const data = await CustomerService.getCustomers(code, 10);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
            const customer = data.find((cust) => cust.code === code);
            if (customer) {
                selectedCustomer.value = customer;
                formData.value.customerCode = customer.code;
            }
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาลูกค้าด้วยรหัส:', error);
    } finally {
        isSearchingCustomer.value = false;
    }
};

// ค้นหาลูกค้า
const filterCustomers = async (event) => {
    try {
        isSearchingCustomer.value = true;
        const searchTerm = event.value || '';

        if (searchTerm.trim().length < 2) {
            await loadInitialCustomers();
            return;
        }

        const data = await CustomerService.getCustomers(searchTerm, 100);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
        } else {
            customerOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาลูกค้า:', error);
        customerOptions.value = [];
    } finally {
        isSearchingCustomer.value = false;
    }
};

// เมื่อมีการเลือกลูกค้า
const onCustomerSelect = (customer) => {
    if (customer) {
        formData.value.customerCode = customer.code;
        localStorage.setItem('_userCode', customer.code);
        localStorage.setItem('_userData', JSON.stringify(customer));

        formData.value.deliveryAddress = customer.address || '';
        formData.value.deliveryTelephone = customer.telephone || '';
    } else {
        formData.value.customerCode = '';
        localStorage.removeItem('_userCode');
        localStorage.removeItem('_userData');

        formData.value.deliveryAddress = '';
        formData.value.deliveryTelephone = '';
    }
};

// Checkout process
async function handleCheckout() {
    // Reset error message
    errorMessage.value = '';

    // Validate form first - BEFORE showing terms dialog
    let isValid = true;
    let validationMessage = '';

    // Check if customer code is required (for employee users)
    if (props.userType === 'employee' && !formData.value.customerCode?.trim()) {
        isValid = false;
        validationMessage = 'กรุณาเลือกลูกค้า';
    }

    // Check delivery information if delivery method is selected
    if (formData.value.deliveryMethod === 'delivery') {
        if (!formData.value.deliveryAddress?.trim()) {
            isValid = false;
            validationMessage = 'กรุณากรอกที่อยู่สำหรับจัดส่ง';
        } else if (!formData.value.deliveryTelephone?.trim()) {
            isValid = false;
            validationMessage = 'กรุณากรอกเบอร์โทรศัพท์สำหรับติดต่อ';
        }
    }

    // If validation fails, show error message and exit
    if (!isValid) {
        errorMessage.value = validationMessage;
        return;
    }

    // Form is valid, now check for terms acceptance
    if (!termsAccepted.value) {
        termsDialog.value = true;
        return;
    }

    // ถ้าผ่านการ validate และยอมรับเงื่อนไขแล้ว ดำเนินการต่อ
    await proceedCheckout();
}

function confirmTerms() {
    termsAccepted.value = true;
    termsDialog.value = false;
    // ทำการสั่งซื้อต่อทันที
    proceedCheckout();
}

function cancelTerms() {
    termsAccepted.value = false;
    termsDialog.value = false;
}

async function proceedCheckout() {
    try {
        isCheckingOut.value = true;
        // Process checkout using the parent component's method
        const success = await emit('process-checkout', { ...formData.value });

        if (!success) {
            isCheckingOut.value = false;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        errorMessage.value = 'เกิดข้อผิดพลาดในการสั่งซื้อ โปรดลองใหม่อีกครั้ง';
        isCheckingOut.value = false;
    }
}

// Utility functions
function formatNumber(value) {
    if (value === undefined || value === null) return '0.00';
    const num = parseFloat(value);
    return !isNaN(num)
        ? num.toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
          })
        : '0.00';
}

function getProductImage(itemCode) {
    if (!itemCode) {
        return 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
    }
    return ProductService.getProductImageUrl(itemCode);
}

function handleImageError(event) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

// คำนวณยอดรวมโดยใช้ราคายืนยัน
function calculateConfirmedTotal() {
    return props.cartItems.reduce((total, item) => {
        const confirmedPrice = getConfirmedPrice(item.item_code);
        const price = confirmedPrice !== null ? confirmedPrice : item.price;
        return total + price * item.qty;
    }, 0);
}

function getConfirmedPrice(itemCode) {
    const confirmedItem = confirmedItems.value.find((item) => item.item_code === itemCode);
    return confirmedItem ? parseFloat(confirmedItem.price_confirm) : null;
}
</script>

<template>
    <div>
        <h2 class="text-xl font-bold mb-4">ยืนยันการสั่งซื้อ</h2>

        <!-- Order summary -->
        <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">สรุปรายการสั่งซื้อ</h3>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div v-for="(item, index) in cartItems" :key="item.id" :class="['flex items-center gap-3', index !== cartItems.length - 1 ? 'border-b border-gray-200 dark:border-gray-700 pb-3 mb-3' : '']">
                    <!-- Thumbnail -->
                    <div class="w-12 h-12 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                        <img :src="getProductImage(item.item_code)" :alt="item.item_name" class="w-full h-full object-cover" @error="handleImageError" />
                    </div>

                    <!-- Details -->
                    <div class="flex-grow">
                        <div class="font-medium">{{ item.item_name }}</div>
                        <div class="text-sm text-gray-500">{{ item.item_code }}</div>
                    </div>

                    <!-- Qty & Price -->
                    <div class="text-right">
                        <div class="font-medium">
                            <!-- แสดงราคาใหม่จาก price_confirm ถ้ามีความแตกต่าง -->
                            <template v-if="getConfirmedPrice(item.item_code) !== null && getConfirmedPrice(item.item_code) !== item.price">
                                <div class="font-medium text-green-600">฿{{ formatNumber(getConfirmedPrice(item.item_code) * item.qty) }}</div>
                                <div class="text-sm line-through text-gray-500">฿{{ formatNumber(item.price * item.qty) }}</div>
                            </template>
                            <template v-else>
                                <div class="font-medium">฿{{ formatNumber(item.price * item.qty) }}</div>
                            </template>
                        </div>
                        <div class="text-sm text-gray-500">
                            <!-- แสดงจำนวนและราคาต่อหน่วย -->
                            <template v-if="getConfirmedPrice(item.item_code) !== null && getConfirmedPrice(item.item_code) !== item.price">
                                {{ item.qty }} x <span class="text-green-600">฿{{ formatNumber(getConfirmedPrice(item.item_code)) }}</span>
                                <span class="line-through">฿{{ formatNumber(item.price) }}</span>
                            </template>
                            <template v-else> {{ item.qty }} x ฿{{ formatNumber(item.price) }} </template>
                        </div>
                    </div>
                </div>

                <!-- Totals -->
                <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-gray-600 dark:text-gray-400">จำนวนสินค้า:</span>
                        <span>{{ totals.totalItems }} ชิ้น</span>
                    </div>
                    <div class="flex justify-between items-center text-lg font-bold">
                        <span>ยอดรวมทั้งสิ้น:</span>
                        <span class="text-primary">฿{{ formatNumber(calculateConfirmedTotal()) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Customer/Employee information -->
        <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">ข้อมูลการสั่งซื้อ</h3>

            <!-- Customer form -->
            <div v-if="userType === 'customer'" class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <!-- Delivery method selection -->
                <div class="mb-4">
                    <label class="block font-medium mb-2">วิธีการรับสินค้า</label>
                    <div class="flex gap-2">
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'pickup' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'pickup'"
                        >
                            <i class="pi pi-shopping-bag mr-2 text-primary-500"></i>
                            <span>รับที่ร้าน</span>
                        </div>
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'delivery' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'delivery'"
                        >
                            <i class="pi pi-truck mr-2 text-primary-500"></i>
                            <span>จัดส่ง</span>
                        </div>
                    </div>
                </div>

                <!-- Employee code เปลี่ยนเป็นแบบ Select -->
                <div class="mb-4">
                    <label for="employee-code" class="block font-medium mb-2">รหัสพนักงานที่ดูแล (ถ้ามี)</label>
                    <div v-if="isSearchingEmployee && employeeOptions.length === 0" class="flex justify-center py-2">
                        <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
                    </div>
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
                        @change="onEmployeeSelect($event.value)"
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

                <!-- Delivery information (shown when delivery is selected) -->
                <div v-if="formData.deliveryMethod === 'delivery'">
                    <div class="mb-4">
                        <label for="delivery-address" class="block font-medium mb-2">ที่อยู่จัดส่ง <span class="text-red-500">*</span></label>
                        <Textarea id="delivery-address" v-model="formData.deliveryAddress" rows="3" class="w-full" placeholder="กรอกที่อยู่จัดส่ง" />
                    </div>

                    <div class="mb-4">
                        <label for="delivery-phone" class="block font-medium mb-2">เบอร์โทรศัพท์ <span class="text-red-500">*</span></label>
                        <InputText id="delivery-phone" v-model="formData.deliveryTelephone" class="w-full" placeholder="กรอกเบอร์โทรศัพท์" />
                    </div>
                </div>
            </div>

            <!-- Employee form -->
            <div v-else-if="userType === 'employee'" class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <!-- Delivery method selection -->
                <div class="mb-4">
                    <label class="block font-medium mb-2">วิธีการรับสินค้า</label>
                    <div class="flex gap-2">
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'pickup' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'pickup'"
                        >
                            <i class="pi pi-shopping-bag mr-2 text-primary-500"></i>
                            <span>รับที่ร้าน</span>
                        </div>
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'delivery' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'delivery'"
                        >
                            <i class="pi pi-truck mr-2 text-primary-500"></i>
                            <span>จัดส่ง</span>
                        </div>
                    </div>
                </div>
                <div class="mb-4">
                    <label for="customer-code" class="block font-medium mb-2">รหัสลูกค้า <span class="text-red-500">*</span></label>
                    <div v-if="isSearchingCustomer && customerOptions.length === 0" class="flex justify-center py-2">
                        <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
                    </div>
                    <Message severity="info" icon="pi pi-user">{{ selectedCustomerCode }}</Message>

                    <!-- <Select
                        v-model="selectedCustomer"
                        :options="customerOptions"
                        optionLabel="name"
                        placeholder="เลือกลูกค้า"
                        class="w-full"
                        :loading="isSearchingCustomer"
                        filter
                        @filter="filterCustomers"
                        filterPlaceholder="พิมพ์ชื่อหรือรหัสลูกค้า"
                        :virtualScrollerOptions="{ itemSize: 48, lazy: true, delay: 250 }"
                        :showClear="true"
                        @change="onCustomerSelect($event.value)"
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
                    <small class="text-color-secondary">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา หรือเลือกจากรายการ</small> -->
                </div>
                <!-- Delivery information (shown when delivery is selected) -->
                <div v-if="formData.deliveryMethod === 'delivery'">
                    <div class="mb-4">
                        <label for="delivery-address" class="block font-medium mb-2">ที่อยู่จัดส่ง <span class="text-red-500">*</span></label>
                        <Textarea id="delivery-address" v-model="formData.deliveryAddress" rows="3" class="w-full" placeholder="กรอกที่อยู่จัดส่ง" />
                    </div>

                    <div class="mb-4">
                        <label for="delivery-phone" class="block font-medium mb-2">เบอร์โทรศัพท์ <span class="text-red-500">*</span></label>
                        <InputText id="delivery-phone" v-model="formData.deliveryTelephone" class="w-full" placeholder="กรอกเบอร์โทรศัพท์" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Error message -->
        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

        <!-- Action buttons -->
        <div class="flex justify-between mt-6">
            <Button label="ย้อนกลับ" icon="pi pi-arrow-left" outlined @click="emit('prev-step')" />
            <Button label="ยืนยันการสั่งซื้อ" icon="pi pi-check" @click="handleCheckout" :loading="isCheckingOut" />
        </div>

        <!-- Terms and Conditions Dialog -->
        <Dialog v-model:visible="termsDialog" modal header="เงื่อนไขและข้อตกลง" :style="{ width: '90%', maxWidth: '500px' }" :closeOnEscape="false" :closable="false">
            <div class="p-2">
                <div class="mb-5 text-gray-700">
                    <ol class="list-decimal pl-5 space-y-3">
                        <li>สินค้าที่ได้รับอาจมีการเปลี่ยนแพ็คเกจและปริมาณจากผู้ผลิต</li>
                        <li>ราคาสินค้า จำนวนสต๊อก อาจมีการแสดงผลคลาดเคลื่อน ในสินค้ากลุ่ม น้ำมันพืช กาแฟ น้ำตาล และสินค้าขาดตลาด ทางบริษัทขออนุญาต เปลี่ยนแปลงโดยไม่แจ้งให้ทราบล่วงหน้า</li>
                    </ol>
                </div>

                <div class="flex items-center mb-5">
                    <Checkbox v-model="termsAccepted" :binary="true" inputId="terms" />
                    <label for="terms" class="ml-2 text-gray-700 cursor-pointer">ข้าพเจ้าได้อ่านและยอมรับเงื่อนไขการสั่งซื้อสินค้า</label>
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end">
                    <Button label="ยกเลิก" icon="pi pi-times" outlined @click="cancelTerms()" class="mr-2" />
                    <Button label="ยืนยัน" icon="pi pi-check" @click="confirmTerms()" :disabled="!termsAccepted" />
                </div>
            </template>
        </Dialog>
    </div>
</template>
