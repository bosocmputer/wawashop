<script setup>
import CartService from '@/services/CartService';
import { useCartStore } from '@/stores/cartStore';
import { useToast } from 'primevue/usetoast';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

// Import step components
import StepCart from '@/components/cart/StepCart.vue';
import StepComplete from '@/components/cart/StepComplete.vue';
import StepConfirmation from '@/components/cart/StepConfirmation.vue';

const activeStep = ref(0);
const toast = useToast();
const router = useRouter();
const cartStore = useCartStore();
const isLoading = ref(true);

// Order result data for completion page
const orderResult = ref({
    orderNumber: '',
    orderDate: '',
    orderTime: ''
});

// User data
const userType = ref('');
const userData = ref({});

// Cart data - will be passed to child components
const localCartItems = ref([]);
const hasCartChanges = ref(false);

// Order data - shared between steps
const orderData = ref({
    deliveryMethod: 'pickup',
    employeeCode: '',
    customerCode: '',
    deliveryAddress: '',
    deliveryTelephone: ''
});

// Initialize component
onMounted(() => checkAuthentication());

// Save changes before leaving
onBeforeUnmount(() => saveCartChanges());

// Authentication check
async function checkAuthentication() {
    isLoading.value = true;

    try {
        const token = localStorage.getItem('_token');

        if (!token) {
            toast.add({
                severity: 'warn',
                summary: 'กรุณาเข้าสู่ระบบ',
                detail: 'คุณจำเป็นต้องเข้าสู่ระบบก่อนเข้าถึงตะกร้าสินค้า',
                life: 3000
            });
            router.push('/auth/login');
            return;
        }

        // Get user type and data from storage
        userType.value = localStorage.getItem('_userType') || '';

        const userDataStr = localStorage.getItem('_userData');
        if (userDataStr) {
            try {
                userData.value = JSON.parse(userDataStr);

                // Pre-fill delivery info from user data
                orderData.value.deliveryAddress = userData.value.address || '';
                orderData.value.deliveryTelephone = userData.value.telephone || '';

                // Fetch cart items
                await fetchCartItems();
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        router.push('/auth/login');
    } finally {
        isLoading.value = false;
    }
}

// Fetch cart items from API
async function fetchCartItems() {
    try {
        const response = await CartService.getCartItems(userData.value.user_code);
        if (response?.data) {
            const cartData = response.data.data || [];
            // Update localCartItems
            localCartItems.value = cartData.map((item) => ({
                ...item,
                id: item.guid_code,
                qty: parseInt(item.qty),
                price: parseFloat(item.price)
            }));
        }
    } catch (error) {
        console.error('Error fetching cart items:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลตะกร้าสินค้าได้',
            life: 3000
        });
    }
}

// Format cart items for API
function formatCartItemsForApi(items) {
    return items.map((item) => ({
        creator_code: userData.value.user_code,
        cust_code: userData.value.user_code,
        item_code: item.item_code,
        item_name: item.item_name,
        qty: item.qty.toString(),
        price: item.price.toString(),
        unit_code: item.unit_code || 'ชิ้น',
        guid_code: item.guid_code || item.id,
        barcode: item.barcode || '',
        wh_code: item.wh_code || 'MMA01',
        shelf_code: item.shelf_code || 'SH101',
        ratio: item.ratio || '1',
        stand_value: item.stand_value || '1',
        divide_value: item.divide_value || '1',
        create_datetime: new Date().toISOString().replace('T', ' ').substring(0, 23)
    }));
}

// Save cart changes
async function saveCartChanges() {
    if (!hasCartChanges.value) return;

    try {
        const cartItemsData = formatCartItemsForApi(localCartItems.value);
        await CartService.updateCartItemQuantity(cartItemsData);
        hasCartChanges.value = false;
    } catch (error) {
        console.error('Error saving cart changes:', error);
    }
}

// Calculate totals
function calculateTotals() {
    const totalAmount = localCartItems.value.reduce((total, item) => total + parseFloat(item.price) * parseInt(item.qty), 0);

    const totalItems = localCartItems.value.reduce((count, item) => count + parseInt(item.qty), 0);

    return { totalAmount, totalItems };
}

// Update cart item
async function updateCartItem(item) {
    try {
        const cartItemData = formatCartItemsForApi([item]);
        await CartService.updateCartItemQuantity(cartItemData);
        hasCartChanges.value = false;

        // Update store
        const storeItem = {
            id: item.id || item.guid_code,
            name: item.item_name,
            price: parseFloat(item.price),
            quantity: parseInt(item.qty)
        };

        await cartStore.updateCartItem(storeItem);
    } catch (error) {
        console.error('Error updating cart item:', error);
        throw error;
    }
}

// Process checkout
async function processCheckout(finalOrderData) {
    try {
        // Save any pending changes
        await saveCartChanges();

        // Create final order data
        const checkoutData = {
            items: localCartItems.value,
            deliveryMethod: finalOrderData.deliveryMethod,
            employeeCode: finalOrderData.employeeCode,
            customerCode: finalOrderData.customerCode,
            deliveryAddress: finalOrderData.deliveryMethod === 'delivery' ? finalOrderData.deliveryAddress : null,
            deliveryTelephone: finalOrderData.deliveryMethod === 'delivery' ? finalOrderData.deliveryTelephone : null
        };

        const result = await cartStore.checkoutCart(checkoutData);

        if (result?.success) {
            // Store order details for completion page
            const now = new Date();
            orderResult.value = {
                orderNumber: result.orderNumber || cartStore.generateOrderNumber(),
                orderDate: now.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                orderTime: now.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };

            // Clear cart after successful checkout
            localCartItems.value = [];
            hasCartChanges.value = false;

            // Move to complete step
            activeStep.value = 2;

            toast.add({
                severity: 'success',
                summary: 'สั่งซื้อสำเร็จ',
                detail: 'ขอบคุณสำหรับการสั่งซื้อ',
                life: 3000
            });

            return true;
        } else {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: result?.message || 'ไม่สามารถดำเนินการสั่งซื้อได้',
                life: 3000
            });
            return false;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถดำเนินการสั่งซื้อได้',
            life: 3000
        });
        return false;
    }
}

// Step navigation
function nextStep() {
    if (activeStep.value < 2) activeStep.value++;
}

function prevStep() {
    if (activeStep.value > 0) activeStep.value--;
}

function goToShop() {
    saveCartChanges();
    router.push('/');
}

function resetStepper() {
    activeStep.value = 0;
    router.push('/');
}
</script>

<template>
    <div class="flex justify-center bg-gray-100 dark:bg-gray-900 w-full min-h-screen p-4">
        <!-- Loading state -->
        <div v-if="isLoading" class="flex justify-center items-center h-screen w-full">
            <ProgressSpinner style="width: 50px" />
        </div>

        <div v-else class="w-full max-w-6xl flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center p-3 sm:p-4 bg-white dark:bg-gray-800 shadow-sm rounded-t-lg">
                <h1 class="text-xl sm:text-2xl font-bold">
                    ตะกร้าสินค้า
                    <span v-if="userType === 'customer'" class="text-sm text-primary-500">(ลูกค้า)</span>
                    <span v-else-if="userType === 'employee'" class="text-sm text-orange-500">(พนักงาน)</span>
                </h1>
                <Button v-if="activeStep === 0" icon="pi pi-arrow-left" label="เลือกซื้อสินค้าต่อ" text @click="goToShop" class="hidden sm:flex" />
            </div>

            <!-- Stepper header -->
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <div key="steps-component">
                    <Steps
                        :model="[
                            { label: 'สินค้าในตะกร้า', icon: 'pi pi-shopping-cart' },
                            { label: 'ยืนยันการสั่งซื้อ', icon: 'pi pi-check-square' },
                            { label: 'สั่งซื้อสำเร็จ', icon: 'pi pi-check-circle' }
                        ]"
                        :activeStep="activeStep"
                        :readonly="true"
                    />
                </div>
            </div>

            <!-- Stepper content -->
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <div v-if="activeStep === 0">
                    <StepCart :cartItems="localCartItems" :userType="userType" @update-item="updateCartItem" @set-cart-changed="hasCartChanges = true" @refresh-cart="fetchCartItems" @next-step="nextStep" @go-to-shop="goToShop" />
                </div>

                <div v-else-if="activeStep === 1">
                    <StepConfirmation :cartItems="localCartItems" :userType="userType" :userData="userData" :orderData="orderData" :totals="calculateTotals()" @prev-step="prevStep" @process-checkout="processCheckout" />
                </div>

                <div v-else-if="activeStep === 2">
                    <StepComplete :orderNumber="orderResult.orderNumber" :orderDate="orderResult.orderDate" :orderTime="orderResult.orderTime" @go-to-shop="resetStepper" />
                </div>
            </div>
        </div>
    </div>
</template>
