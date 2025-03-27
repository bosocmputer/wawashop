<script setup>
import CartService from '@/services/CartService';
import OrderHistoryService from '@/services/OrderHistoryService';
import ProductService from '@/services/ProductService';
import { useCartStore } from '@/stores/cartStore';

import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const orders = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedOrder = ref(null);
const selectedOrderDetails = ref(null);
const displayOrderDetails = ref(false);
const loadingDetails = ref(false);

// Dialog ยืนยันการยกเลิกคำสั่งซื้อ
const confirmCancelDialog = ref(false);
const orderToCancel = ref(null);

// รหัสลูกค้า
const userCode = localStorage.getItem('_userCode');

const cartStore = useCartStore();
const reorderLoading = ref(false);

// สถานะของออเดอร์และสีที่ใช้แสดง
const orderStatuses = {
    success: { label: 'สำเร็จ', color: 'success', icon: 'pi pi-check-circle' },
    partial: { label: 'ชำระแล้วบางส่วน', color: 'info', icon: 'pi pi-credit-card' },
    payment: { label: 'กำลังจัดส่ง / รอรับชำระ', color: 'primary', icon: 'pi pi-send' },
    packing: { label: 'กำลังจัดสินค้า', color: 'primary', icon: 'pi pi-sync' },
    cancel: { label: 'ยกเลิก', color: 'danger', icon: 'pi pi-times-circle' },
    pending: { label: 'รอตรวจสอบ', color: 'warning', icon: 'pi pi-clock' }
};

// กรองออเดอร์
const filters = reactive({
    status: '',
    dateRange: null,
    searchTerm: ''
});

// ดึงข้อมูลประวัติการสั่งซื้อจาก API
async function fetchOrderHistory() {
    try {
        loading.value = true;
        error.value = null;

        const userData = localStorage.getItem('_userData');
        if (!userData) {
            router.push('/auth/login');
            return;
        }

        const userObj = JSON.parse(userData);
        const custCode = userObj.user_code;

        if (!custCode) {
            error.value = 'ไม่พบข้อมูลลูกค้า';
            return;
        }

        const response = await OrderHistoryService.getOrderHistory(custCode, filters.status || '');

        if (response?.data?.success) {
            orders.value = response.data.data || [];
        } else {
            error.value = 'ไม่สามารถดึงข้อมูลประวัติการสั่งซื้อได้';
        }
    } catch (err) {
        console.error('Error fetching order history:', err);
        error.value = 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการสั่งซื้อ';
    } finally {
        loading.value = false;
    }
}

// ดึงรายละเอียดของคำสั่งซื้อ
async function fetchOrderDetails(docNo) {
    try {
        loadingDetails.value = true;
        const response = await OrderHistoryService.getOrderDetail(userCode, docNo);

        if (response?.data?.success) {
            // เก็บข้อมูลทั้งหมดของออเดอร์ลงใน selectedOrder
            selectedOrder.value = {
                ...selectedOrder.value,
                ...response.data.data
            };

            // เก็บเฉพาะรายการสินค้าลงใน selectedOrderDetails
            selectedOrderDetails.value = response.data.data.items || [];
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error fetching order details:', err);
        return false;
    } finally {
        loadingDetails.value = false;
    }
}

// แสดงรายละเอียดออเดอร์
async function showOrderDetails(order) {
    selectedOrder.value = order;
    displayOrderDetails.value = true;
    selectedOrderDetails.value = null;

    const success = await fetchOrderDetails(order.doc_no);
    if (!success) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถดึงรายละเอียดคำสั่งซื้อได้',
            life: 3000
        });
    }
}

// ฟังก์ชันแปลงวันที่
function formatDate(dateStr, timeStr) {
    if (!dateStr) return '';

    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const date = new Date(year, month, day);

    const thaiDate = date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return timeStr ? `${thaiDate} ${timeStr} น.` : thaiDate;
}

// ฟอร์แมตตัวเลขเป็นรูปแบบเงินบาท
function formatCurrency(value) {
    if (value === undefined || value === null) return '0.00';
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(parseFloat(value));
}

// ฟังก์ชันเมื่อมีการเปลี่ยนแปลงสถานะกรอง
async function handleStatusChange() {
    fetchOrderHistory();
}

// ออเดอร์ที่ผ่านการกรอง
const filteredOrders = computed(() => {
    if (!orders.value) return [];

    return orders.value.filter((order) => {
        // กรองตามคำค้นหา
        if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            const docNoMatch = order.doc_no.toLowerCase().includes(searchLower);
            const statusLabel = orderStatuses[order.status]?.label.toLowerCase() || '';
            const statusMatch = statusLabel.includes(searchLower);

            return docNoMatch || statusMatch;
        }

        // กรองตามช่วงวันที่
        if (filters.dateRange && filters.dateRange.length === 2) {
            const orderDate = new Date(order.doc_date).setHours(0, 0, 0, 0);
            const startDate = new Date(filters.dateRange[0]).setHours(0, 0, 0, 0);
            const endDate = new Date(filters.dateRange[1]).setHours(23, 59, 59, 999);

            if (orderDate < startDate || orderDate > endDate) {
                return false;
            }
        }

        return true;
    });
});

// รีเซ็ตการกรอง
function resetFilters() {
    filters.status = '';
    filters.dateRange = null;
    filters.searchTerm = '';
    fetchOrderHistory();
}

// สร้างเลขที่เอกสารยกเลิก
function generateCancelOrderNumber() {
    // รูปแบบ MSOC20250323-XXXXX
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // สร้างเลขสุ่ม 5 หลัก
    const randomNum = Math.floor(Math.random() * 90000) + 10000;

    return `MSOC${dateStr}-${randomNum}`;
}

// แสดง dialog ยืนยันการยกเลิกคำสั่งซื้อ
function showCancelConfirmation(order) {
    orderToCancel.value = order;
    confirmCancelDialog.value = true;
}

function getProductImage(itemCode) {
    return itemCode ? ProductService.getProductImageUrl(itemCode) : 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}
// ดำเนินการยกเลิกคำสั่งซื้อ
async function processCancelOrder() {
    if (!orderToCancel.value) return;

    try {
        loading.value = true;

        // ต้องดึงรายละเอียดออเดอร์ก่อนยกเลิก เพื่อให้ได้รายการสินค้า
        const success = await fetchOrderDetails(orderToCancel.value.doc_no);

        if (!success || !selectedOrderDetails.value) {
            throw new Error('ไม่สามารถดึงรายละเอียดคำสั่งซื้อได้');
        }

        // สร้างเลขที่เอกสารยกเลิก
        const cancelDocNo = generateCancelOrderNumber();
        const now = new Date();
        const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const formattedTime = now.toTimeString().slice(0, 5); // HH:MM

        // จัดเตรียมข้อมูลสำหรับยกเลิกคำสั่งซื้อ
        const cancelOrderData = {
            doc_date: formattedDate,
            doc_no: cancelDocNo,
            doc_ref: orderToCancel.value.doc_no, // เลขที่เอกสารเดิมที่ต้องการยกเลิก
            doc_time: formattedTime,
            cust_code: orderToCancel.value.cust_code,
            emp_code: orderToCancel.value.emp_code || '',
            total_value: orderToCancel.value.total_amount,
            total_amount: orderToCancel.value.total_amount,
            telephone: orderToCancel.value.telephone || '',
            remark: `ยกเลิกคำสั่งซื้อ: ${orderToCancel.value.doc_no}`,
            items: selectedOrderDetails.value.map((item) => ({
                item_code: item.item_code,
                item_name: item.item_name,
                unit_code: item.unit_code,
                barcode: item.barcode || '',
                qty: item.qty,
                price: item.price,
                sum_amount: (parseFloat(item.qty) * parseFloat(item.price)).toString(),
                wh_code: item.wh_code || 'MMA01',
                shelf_code: item.shelf_code || 'SH101',
                stand_value: item.stand_value || '1',
                divide_value: item.divide_value || '1',
                ratio: item.ratio || '1'
            }))
        };

        console.log('Cancelling order with data:', cancelOrderData);

        // ส่งข้อมูลไปยกเลิกที่ API
        const response = await CartService.cancelOrder(cancelOrderData);

        if (response.data && response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'ยกเลิกคำสั่งซื้อสำเร็จ',
                detail: `ยกเลิกคำสั่งซื้อเลขที่ ${orderToCancel.value.doc_no} เรียบร้อยแล้ว`,
                life: 3000
            });

            // หากกำลังแสดงรายละเอียดออเดอร์นี้อยู่ ให้ปิด dialog
            if (displayOrderDetails.value && selectedOrder.value?.doc_no === orderToCancel.value.doc_no) {
                displayOrderDetails.value = false;
            }

            // โหลดข้อมูลประวัติการสั่งซื้อใหม่
            await fetchOrderHistory();
        } else {
            throw new Error(response.data?.message || 'ไม่สามารถยกเลิกคำสั่งซื้อได้');
        }
    } catch (err) {
        console.error('Error cancelling order:', err);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถยกเลิกคำสั่งซื้อได้',
            life: 3000
        });
    } finally {
        loading.value = false;
        confirmCancelDialog.value = false;
        orderToCancel.value = null;
    }
}

async function reorderItems(order) {
    if (!order || !order.doc_no) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่พบข้อมูลคำสั่งซื้อ',
            life: 3000
        });
        return;
    }

    try {
        reorderLoading.value = true;

        // ดึงรายละเอียดออเดอร์เพื่อให้ได้รายการสินค้า
        const success = await fetchOrderDetails(order.doc_no);

        if (!success || !selectedOrderDetails.value || selectedOrderDetails.value.length === 0) {
            throw new Error('ไม่พบรายการสินค้าในคำสั่งซื้อ');
        }

        // ดึงข้อมูล userData เพื่อใช้ตอนเรียก API
        const userData = localStorage.getItem('_userData');
        if (!userData) {
            throw new Error('กรุณาเข้าสู่ระบบใหม่');
        }

        const userObj = JSON.parse(userData);
        const custCode = userObj.user_code;

        // สร้าง toast สำหรับแสดงความก้าวหน้า
        toast.add({
            severity: 'info',
            summary: 'กำลังดำเนินการ',
            detail: 'กำลังตรวจสอบราคาและจำนวนสินค้า...',
            life: 3000
        });

        // วนลูปเพื่อตรวจสอบราคาและสต็อกของแต่ละสินค้า
        const itemsToAdd = [];
        const unavailableItems = [];

        for (const item of selectedOrderDetails.value) {
            try {
                // เรียก API เพื่อตรวจสอบราคาและสต็อกล่าสุด
                const response = await ProductService.getProductBalancePrice(custCode, item.item_code, item.unit_code);

                if (response?.data?.success && response.data.data && response.data.data.length > 0) {
                    const product = response.data.data[0];

                    // ตรวจสอบว่ามีสินค้าในสต็อกหรือไม่
                    if (product.sold_out === '1' || parseFloat(product.balance_qty) <= 0) {
                        unavailableItems.push({
                            ...item,
                            reason: 'สินค้าหมด'
                        });
                        continue;
                    }

                    // ตรวจสอบว่าจำนวนที่ต้องการสั่งเกินสต็อกหรือไม่
                    const requestedQty = parseInt(item.qty);
                    const availableQty = parseFloat(product.balance_qty);

                    if (requestedQty > availableQty) {
                        // ถ้าสินค้ามีไม่พอ ให้ใช้จำนวนที่มีในสต็อก
                        itemsToAdd.push({
                            ...product,
                            id: product.item_code,
                            code: product.item_code,
                            name: product.item_name,
                            image: getProductImage(product.item_code),
                            qty: availableQty
                        });

                        toast.add({
                            severity: 'warn',
                            summary: 'สินค้ามีจำนวนจำกัด',
                            detail: `${product.item_name} มีในสต็อกเพียง ${availableQty} ${product.unit_code}`,
                            life: 5000
                        });
                    } else {
                        // ถ้าสินค้ามีพอ ให้ใช้จำนวนเดิม
                        itemsToAdd.push({
                            ...product,
                            id: product.item_code,
                            code: product.item_code,
                            name: product.item_name,
                            image: getProductImage(product.item_code),
                            qty: requestedQty
                        });
                    }
                } else {
                    unavailableItems.push({
                        ...item,
                        reason: 'ไม่พบข้อมูลสินค้า'
                    });
                }
            } catch (err) {
                console.error('Error checking product availability:', err);
                unavailableItems.push({
                    ...item,
                    reason: 'เกิดข้อผิดพลาดในการตรวจสอบ'
                });
            }
        }

        // ถ้าไม่มีสินค้าที่สามารถสั่งได้เลย
        if (itemsToAdd.length === 0) {
            toast.add({
                severity: 'error',
                summary: 'ไม่สามารถสั่งซื้อซ้ำได้',
                detail: 'ไม่มีสินค้าที่สามารถสั่งซื้อได้ในขณะนี้',
                life: 5000
            });
            return;
        }

        // เพิ่มสินค้าลงตะกร้า
        for (const item of itemsToAdd) {
            await cartStore.addToCart(item, item.qty);
        }

        // แสดงผล
        if (unavailableItems.length > 0) {
            toast.add({
                severity: 'warn',
                summary: 'สั่งซื้อซ้ำบางส่วน',
                detail: `เพิ่ม ${itemsToAdd.length} รายการลงตะกร้าแล้ว, ไม่พบ ${unavailableItems.length} รายการ`,
                life: 5000
            });
        } else {
            toast.add({
                severity: 'success',
                summary: 'สั่งซื้อซ้ำสำเร็จ',
                detail: `เพิ่ม ${itemsToAdd.length} รายการลงตะกร้าแล้ว`,
                life: 3000
            });
        }
    } catch (err) {
        console.error('Error reordering items:', err);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: err.message || 'ไม่สามารถสั่งซื้อซ้ำได้',
            life: 3000
        });
    } finally {
        reorderLoading.value = false;
    }
}

// ดึงข้อมูลเมื่อโหลดคอมโพเนนต์
onMounted(fetchOrderHistory);
</script>

<template>
    <div class="order-history-page">
        <div class="order-history-container">
            <!-- Header -->
            <div class="page-header mb-4">
                <h1 class="text-2xl font-bold">ประวัติการสั่งซื้อ</h1>
                <p class="text-gray-500 dark:text-gray-400 mt-1">ตรวจสอบสถานะและรายละเอียดคำสั่งซื้อของคุณ</p>
            </div>

            <!-- Filters -->
            <div class="filters-container mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1">ค้นหา</label>
                        <IconField iconPosition="left" class="w-full">
                            <InputText v-model="filters.searchTerm" placeholder="ค้นหาตามรหัสคำสั่งซื้อ, สถานะ..." class="w-full" />
                            <InputIcon class="pi pi-search" />
                        </IconField>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">สถานะ</label>
                        <Dropdown v-model="filters.status" :options="Object.keys(orderStatuses)" optionLabel="label" placeholder="ทุกสถานะ" class="w-full" @change="handleStatusChange">
                            <template #value="slotProps">
                                <div v-if="slotProps.value" class="flex align-items-center">
                                    <span>{{ orderStatuses[slotProps.value].label }}</span>
                                </div>
                                <span v-else>ทุกสถานะ</span>
                            </template>
                            <template #option="slotProps">
                                <div class="flex align-items-center">
                                    <span>{{ orderStatuses[slotProps.option].label }}</span>
                                </div>
                            </template>
                        </Dropdown>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">ช่วงวันที่</label>
                        <DatePicker v-model="filters.dateRange" selectionMode="range" dateFormat="dd/mm/yy" placeholder="เลือกช่วงวันที่" showIcon class="w-full" />
                    </div>
                </div>

                <div class="flex justify-end mt-3">
                    <Button label="ล้างตัวกรอง" icon="pi pi-filter-slash" class="p-button-outlined p-button-sm w-full" @click="resetFilters" />
                </div>
            </div>

            <!-- Loading state -->
            <div v-if="loading" class="flex justify-center items-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
            </div>

            <!-- Error state -->
            <div v-else-if="error" class="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <i class="pi pi-exclamation-triangle text-5xl text-yellow-500 mb-4"></i>
                <h3 class="text-xl font-medium mb-2">เกิดข้อผิดพลาด</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-4 text-center">{{ error }}</p>
                <Button label="ลองใหม่" icon="pi pi-refresh" @click="fetchOrderHistory" />
            </div>

            <!-- Empty state -->
            <div v-else-if="filteredOrders.length === 0" class="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <i class="pi pi-shopping-bag text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                <h3 class="text-xl font-medium mb-2">ไม่พบประวัติการสั่งซื้อ</h3>
                <p v-if="filters.status || filters.dateRange || filters.searchTerm" class="text-gray-500 dark:text-gray-400 mb-4 text-center">ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไขการค้นหา<br />ลองเปลี่ยนตัวกรองหรือล้างตัวกรองและลองอีกครั้ง</p>
                <p v-else class="text-gray-500 dark:text-gray-400 mb-4 text-center">คุณยังไม่มีประวัติการสั่งซื้อ<br />เริ่มต้นช้อปปิ้งเพื่อสร้างประวัติการสั่งซื้อ</p>
                <Button label="เริ่มต้นช้อปปิ้ง" icon="pi pi-shopping-cart" @click="router.push('/products')" />
            </div>

            <!-- Order list -->
            <div v-else class="orders-list">
                <div v-for="order in filteredOrders" :key="order.doc_no" class="order-card bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4 overflow-hidden">
                    <!-- Order header -->
                    <div class="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
                        <div>
                            <div class="flex items-center">
                                <span class="text-lg font-semibold">{{ order.doc_no }}</span>
                                <Tag :value="orderStatuses[order.status].label" :severity="orderStatuses[order.status].color" class="ml-3" />
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {{ formatDate(order.doc_date, order.doc_time) }}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-lg font-bold">฿{{ formatCurrency(order.total_amount) }}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                {{ order.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน' }}
                            </div>
                        </div>
                    </div>
                    <!-- ส่วนหัวข้อ -->
                    <div v-if="order.remark_5 != ''" class="mr-4 ml-4 mt-4">
                        <!-- ส่วนหัวข้อ -->
                        <div class="flex items-center mb-2">
                            <h3 class="font-medium flex items-center">
                                <i class="pi pi-truck mr-2 text-primary-500"></i>
                                สถานะการจัดส่ง
                            </h3>
                        </div>

                        <!-- ส่วนลิงก์ติดตามพัสดุ -->
                        <div class="mt-2">
                            <div v-if="order.remark_5" class="text-sm">
                                <a :href="order.remark_5" target="_blank" class="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                    <span class="truncate mr-1">{{ order.remark_5 }}</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- Order summary -->
                    <div class="p-4">
                        <div class="flex items-start">
                            <!-- Order info -->
                            <div class="flex-grow">
                                <div class="flex flex-col sm:flex-row sm:justify-between">
                                    <div class="mb-2 sm:mb-0">
                                        <div v-if="order.emp_name" class="text-sm text-gray-700 dark:text-gray-300">
                                            <i class="pi pi-user mr-2"></i>
                                            <span>{{ order.emp_name }}</span>
                                        </div>
                                        <div v-if="order.balance && parseFloat(order.balance) > 0" class="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                            <i class="pi pi-wallet mr-2"></i>
                                            <span>ยอดคงค้าง: ฿{{ formatCurrency(order.balance) }}</span>
                                        </div>
                                    </div>
                                    <div class="flex gap-2">
                                        <!-- เพิ่มปุ่มยกเลิกคำสั่งซื้อ สำหรับออเดอร์ที่มีสถานะเป็น pending -->
                                        <Button v-if="order.status === 'pending'" label="ยกเลิก" icon="pi pi-times-circle  " class="p-button-danger p-button-sm" @click="showCancelConfirmation(order)" :disabled="loading" />
                                        <Button label="รายละเอียด" icon="pi pi-eye" class="p-button-outlined p-button-info p-button-sm" @click="showOrderDetails(order)" />
                                        <Button label="สั่งซื้อซ้ำ" icon="pi pi-refresh" class="p-button-outlined p-button-success p-button-sm" @click="reorderItems(order)" :disabled="loading || reorderLoading" :loading="reorderLoading" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Order details dialog -->
            <Dialog v-model:visible="displayOrderDetails" :header="`${selectedOrder?.doc_no || ''}`" :style="{ width: '90%', maxWidth: '800px' }" :modal="true" :closeOnEscape="true" :dismissableMask="true">
                <!-- Loading state for details -->
                <div v-if="loadingDetails" class="flex justify-center items-center p-8">
                    <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
                </div>

                <div v-else-if="selectedOrder" class="order-details">
                    <!-- Order Status and Basic Info -->
                    <div class="flex flex-col md:flex-row gap-4 mb-4">
                        <div
                            class="status-container p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex-1"
                            :class="{
                                'bg-green-50 dark:bg-green-900/20': selectedOrder.status === 'success',
                                'bg-blue-50 dark:bg-blue-900/20': selectedOrder.status === 'partial' || selectedOrder.status === 'payment' || selectedOrder.status === 'packing',
                                'bg-red-50 dark:bg-red-900/20': selectedOrder.status === 'cancel',
                                'bg-yellow-50 dark:bg-yellow-900/20': selectedOrder.status === 'pending',
                                'bg-gray-50 dark:bg-gray-800': !selectedOrder.status || !orderStatuses[selectedOrder.status]
                            }"
                        >
                            <div class="flex items-center">
                                <i :class="[orderStatuses[selectedOrder.status].icon, 'text-xl mr-2', `text-${orderStatuses[selectedOrder.status].color}-500`]"></i>
                                <span class="font-semibold">{{ orderStatuses[selectedOrder.status].label }}</span>
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">วันที่สั่งซื้อ: {{ formatDate(selectedOrder.doc_date, selectedOrder.doc_time) }}</div>
                        </div>

                        <div class="payment-summary p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 flex-1">
                            <div class="font-semibold mb-1">สรุปการชำระเงิน</div>
                            <div class="flex justify-between text-sm">
                                <span>ยอดรวม:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedOrder.total_amount) }}</span>
                            </div>
                            <div v-if="parseFloat(selectedOrder.balance) > 0" class="flex justify-between text-sm text-red-600">
                                <span>ยอดค้างชำระ:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedOrder.balance) }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Customer and Employee Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 class="text-lg font-semibold mb-2 flex items-center">
                                <i class="pi pi-user mr-2 text-primary-500"></i>
                                ข้อมูลลูกค้า
                            </h3>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="text-sm text-gray-500">รหัสลูกค้า:</div>
                                <div class="text-sm font-medium">{{ selectedOrder.cust_code }}</div>

                                <div class="text-sm text-gray-500">ประเภทการรับสินค้า:</div>
                                <div class="text-sm font-medium">
                                    <Tag :severity="selectedOrder.send_type === '1' ? 'info' : 'success'" :value="selectedOrder.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน'" />
                                </div>
                            </div>
                        </div>

                        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 class="text-lg font-semibold mb-2 flex items-center">
                                <i class="pi pi-briefcase mr-2 text-primary-500"></i>
                                ข้อมูลพนักงาน
                            </h3>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="text-sm text-gray-500">รหัสพนักงาน:</div>
                                <div class="text-sm font-medium">{{ selectedOrder.emp_code || '-' }}</div>

                                <div class="text-sm text-gray-500">ชื่อพนักงาน:</div>
                                <div class="text-sm font-medium">{{ selectedOrder.emp_name || 'ไม่มีพนักงานดูแล' }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Order Items -->
                    <div v-if="selectedOrderDetails && selectedOrderDetails.length > 0" class="mb-4">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-shopping-cart mr-2 text-primary-500"></i>
                            รายการสินค้า
                        </h3>
                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div class="bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 text-sm font-medium">
                                <div class="grid grid-cols-12 gap-2">
                                    <div class="col-span-6">สินค้า</div>
                                    <div class="col-span-2 text-right">ราคา</div>
                                    <div class="col-span-2 text-center">จำนวน</div>
                                    <div class="col-span-2 text-right">รวม</div>
                                </div>
                            </div>

                            <div class="divide-y divide-gray-100 dark:divide-gray-700">
                                <div v-for="(item, index) in selectedOrderDetails" :key="index" class="p-3">
                                    <div class="grid grid-cols-12 gap-2 items-center">
                                        <div class="col-span-6">
                                            <div class="font-medium text-primary-600 dark:text-primary-400">{{ item.item_name }}</div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">รหัส: {{ item.item_code }}</div>
                                        </div>
                                        <div class="col-span-2 text-right">฿{{ formatCurrency(item.price) }}</div>
                                        <div class="col-span-2 text-center">{{ item.qty }}</div>
                                        <div class="col-span-2 text-right font-semibold">฿{{ formatCurrency(parseFloat(item.qty) * parseFloat(item.price)) }}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Order Items Summary -->
                            <div class="bg-gray-50 dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700">
                                <div class="grid grid-cols-12 gap-2">
                                    <div class="col-span-8 text-right font-medium">รวมทั้งสิ้น:</div>
                                    <div class="col-span-4 text-right font-bold text-primary-600 dark:text-primary-400">฿{{ formatCurrency(selectedOrder.total_amount) }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="!loadingDetails" class="mb-4 flex items-center justify-center p-6 border border-yellow-200 bg-yellow-50 rounded-lg text-yellow-800">
                        <i class="pi pi-exclamation-triangle mr-2"></i>
                        <span>ไม่พบรายการสินค้าในคำสั่งซื้อนี้</span>
                    </div>

                    <!-- Order Notes -->
                    <div v-if="selectedOrder.remark" class="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-comment mr-2 text-primary-500"></i>
                            หมายเหตุ
                        </h3>
                        <p class="text-sm">{{ selectedOrder.remark }}</p>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-between gap-2">
                        <Button label="ปิด" icon="pi pi-times" outlined @click="displayOrderDetails = false" />
                    </div>
                </template>
            </Dialog>

            <!-- Dialog ยืนยันการยกเลิกคำสั่งซื้อ -->
            <Dialog v-model:visible="confirmCancelDialog" :modal="true" :closable="false" header="ยืนยันการยกเลิกคำสั่งซื้อ" :style="{ width: '90%', maxWidth: '800px' }" :closeOnEscape="true" :dismissableMask="true">
                <div class="flex items-center">
                    <i class="pi pi-exclamation-triangle text-yellow-500 mr-4" style="font-size: 2rem" />
                    <span>
                        คุณต้องการยกเลิกคำสั่งซื้อเลขที่ <br />
                        <span class="font-medium">{{ orderToCancel?.doc_no }}</span> ใช่หรือไม่?</span
                    >
                </div>
                <template #footer>
                    <div class="flex justify-end gap-2">
                        <Button label="ยกเลิก" icon="pi pi-times" outlined @click="confirmCancelDialog = false" :disabled="loading" />
                        <Button label="ยืนยัน" icon="pi pi-check" @click="processCancelOrder" :loading="loading" severity="danger" />
                    </div>
                </template>
            </Dialog>
        </div>
    </div>
</template>
