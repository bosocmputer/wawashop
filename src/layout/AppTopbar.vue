<script setup>
import { useLayout } from '@/layout/composables/layout';
import { useCartStore } from '@/stores/cartStore';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const { toggleMenu } = useLayout();
const router = useRouter();
const appName = ref(import.meta.env.VITE_APP_NAME);
const cartStore = useCartStore();
const showMiniCart = ref(false);
const miniCartTimeout = ref(null);
const miniCartRef = ref(null);
const cartButtonRef = ref(null);

// ตรวจสอบการล็อกอิน
const isAuthenticated = computed(() => {
    return !!localStorage.getItem('_token');
});

// ตัวช่วยแสดงจำนวนในรูปแบบที่เหมาะสม
const formatTotal = (value) => {
    return new Intl.NumberFormat('th-TH').format(value);
};

// คำนวณจำนวนสินค้าในตะกร้า
const totalItems = computed(() => cartStore.totalItems);
const totalAmount = computed(() => cartStore.totalAmount);

// แสดงเฉพาะ 3 รายการล่าสุด
const recentItems = computed(() => {
    return [...cartStore.cartItems].slice(0, 3);
});

// มีรายการที่ไม่แสดงอีกกี่รายการ
const hiddenItemsCount = computed(() => {
    return Math.max(0, totalItems.value - recentItems.value.length);
});

const goToCart = async () => {
    showMiniCart.value = false;

    // ตรวจสอบว่ามีการล็อกอินหรือไม่
    if (!isAuthenticated.value) {
        // ถ้ายังไม่ได้ล็อกอิน ให้ไปที่หน้า login พร้อม redirect กลับมาที่หน้า cart
        router.push('/auth/login?redirect=/cart');
        return;
    }

    try {
        // ตรวจสอบให้แน่ใจว่าข้อมูลตะกร้าถูกโหลดก่อนนำทางไป
        await cartStore.loadCartItems();
        // นำทางไปยังหน้าตะกร้า
        router.push('/cart');
    } catch (error) {
        console.error('Error loading cart items:', error);
    }
};

const goToLogin = () => {
    showMiniCart.value = false;
    router.push('/auth/login?redirect=/cart');
};

// ตรวจสอบขนาดจอ
const isMobileScreen = () => {
    return window.innerWidth < 640; // sm breakpoint คือ 640px ใน Tailwind
};

// เปลี่ยนจากการนำทางไปหน้าตะกร้าเป็นการแสดง MiniCart
const toggleMiniCart = async (event) => {
    event.stopPropagation(); // ป้องกันการทำงานของ event อื่นๆ

    // ถ้าเป็นหน้าจอขนาด sm หรือเล็กกว่า ให้ไปหน้าตะกร้าโดยตรง
    if (isMobileScreen()) {
        goToCart();
        return;
    }

    try {
        // ตรวจสอบให้แน่ใจว่าข้อมูลตะกร้าถูกโหลดก่อนแสดงมินิคาร์ท
        await cartStore.loadCartItems();
        // แสดงมินิคาร์ท
        showMiniCart.value = !showMiniCart.value;
    } catch (error) {
        console.error('Error loading cart items for mini cart:', error);
    }
};

// แสดง MiniCart
const showMiniCartHandler = () => {
    clearTimeout(miniCartTimeout.value);
    showMiniCart.value = true;
};

// ซ่อน MiniCart หลังจากผ่านไป 300ms
const hideMiniCartWithDelay = () => {
    miniCartTimeout.value = setTimeout(() => {
        showMiniCart.value = false;
    }, 300);
};

// ลบสินค้าออกจากตะกร้า
const removeItem = (itemId, event) => {
    event.stopPropagation(); // ป้องกันการนำทางไปยังหน้ารายละเอียดสินค้า
    cartStore.removeFromCart(itemId);
};

// ตรวจสอบการคลิกนอก MiniCart
const handleClickOutside = (event) => {
    if (showMiniCart.value) {
        // ตรวจสอบว่าคลิกข้างนอก MiniCart และไม่ได้คลิกที่ปุ่มตะกร้า
        if (miniCartRef.value && !miniCartRef.value.contains(event.target) && cartButtonRef.value && !cartButtonRef.value.contains(event.target)) {
            showMiniCart.value = false;
        }
    }
};

// ตรวจสอบขนาดหน้าจอเมื่อมีการเปลี่ยนแปลง
const handleResize = () => {
    // ปิด MiniCart บนหน้าจอขนาดเล็กเสมอ
    if (isMobileScreen() && showMiniCart.value) {
        showMiniCart.value = false;
    }
};

// ลงทะเบียน event listener เมื่อคอมโพเนนต์ถูกโหลด
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleResize);

    // ตรวจสอบเริ่มต้น
    handleResize();

    // ตรวจสอบการเปลี่ยนแปลงของ localStorage
    window.addEventListener('storage', checkAuthStatus);
});

// ลบ event listener เมื่อคอมโพเนนต์ถูกทำลาย
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('storage', checkAuthStatus);
    clearTimeout(miniCartTimeout.value);
});

// ตรวจสอบสถานะการล็อกอิน
const checkAuthStatus = () => {
    // อัพเดทสถานะการล็อกอินเมื่อมีการเปลี่ยนแปลงใน localStorage
    console.log('Auth status changed:', isAuthenticated.value);
};
</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <!-- <img src="../assets/cloud-storage.png" alt="sml-center" width="35" /> -->
                <span>{{ appName }}</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions" :class="isAuthenticated ? 'mt-3' : ''">
            <div class="layout-config-menu">
                <!-- Cart Icon with OverlayBadge and MiniCart -->
                <div class="relative">
                    <!-- OverlayBadge แสดงเฉพาะเมื่อล็อกอินแล้วและมีสินค้าในตะกร้า -->
                    <OverlayBadge v-if="isAuthenticated" :value="totalItems" severity="danger">
                        <button ref="cartButtonRef" type="button" class="layout-topbar-action flex items-center justify-center" @click="toggleMiniCart" @mouseenter="showMiniCartHandler" @mouseleave="hideMiniCartWithDelay">
                            <i class="pi pi-shopping-cart" style="font-size: 1.5rem" />
                            <span class="hidden sm:inline-block ml-2">ตะกร้าสินค้า</span>
                        </button>
                    </OverlayBadge>

                    <!-- ปุ่มล็อกอินเมื่อไม่มี token -->
                    <button v-else ref="cartButtonRef" type="button" class="layout-topbar-action flex items-center justify-center" @click="goToLogin">
                        <i class="pi pi-sign-in" />
                        <span class="hidden sm:inline-block ml-2">เข้าสู่ระบบ</span>
                    </button>

                    <!-- Mini Cart Dropdown - แสดงเฉพาะเมื่อมี token -->
                    <div
                        v-if="showMiniCart && isAuthenticated"
                        ref="miniCartRef"
                        class="absolute top-full right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 p-4 mt-2"
                        @mouseenter="showMiniCartHandler"
                        @mouseleave="hideMiniCartWithDelay"
                    >
                        <div class="flex justify-between items-center pb-2 mb-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-base font-semibold m-0">ตะกร้าสินค้า</h3>
                            <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 py-1 px-2 rounded-full"> {{ totalItems }} รายการ </span>
                        </div>

                        <div v-if="recentItems.length === 0" class="flex flex-col items-center justify-center py-8 text-gray-500">
                            <i class="pi pi-shopping-cart text-3xl text-gray-300 mb-2"></i>
                            <p>ตะกร้าของคุณว่างเปล่า</p>
                        </div>

                        <div v-else>
                            <div class="max-h-72 overflow-y-auto">
                                <router-link
                                    v-for="item in recentItems"
                                    :key="item.id"
                                    :to="`/products/${item.id}`"
                                    class="flex items-center py-3 border-b border-gray-100 dark:border-gray-700 no-underline text-inherit hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <div class="w-12 h-12 mr-3 rounded overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <img :src="item.image" :alt="item.name" class="w-full h-full object-cover" />
                                    </div>
                                    <div class="flex-1">
                                        <div class="text-sm font-medium mb-1 truncate max-w-[180px]">{{ item.name }}</div>
                                        <div class="text-xs text-gray-500 dark:text-gray-400">{{ item.quantity }} x ฿{{ formatTotal(item.price) }}</div>
                                    </div>
                                    <button class="bg-transparent border-0 cursor-pointer p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" @click="(e) => removeItem(item.id, e)">
                                        <i class="pi pi-times text-xs"></i>
                                    </button>
                                </router-link>
                            </div>

                            <div v-if="hiddenItemsCount > 0" class="text-center text-xs text-gray-500 py-2 italic">และอีก {{ hiddenItemsCount }} รายการ</div>

                            <div class="flex justify-between items-center py-3 mt-2 border-t border-gray-100 dark:border-gray-700 font-medium">
                                <span>ยอดรวม:</span>
                                <span class="text-base font-semibold text-primary">฿{{ formatTotal(totalAmount) }}</span>
                            </div>

                            <div class="grid grid-cols-2 gap-2 mt-4">
                                <Button label="ดูตะกร้า" class="p-button-outlined text-sm p-2" @click="goToCart" />
                                <Button label="ชำระเงิน" severity="success" class="text-sm p-2" @click="goToCart" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
