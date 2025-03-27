<script setup>
import ProductService from '@/services/ProductService';
import { useAuthenStore } from '@/stores/authen';
import { useCartStore } from '@/stores/cartStore';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import Galleria from 'primevue/galleria';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const product = ref(null);
const images = ref([]);
const quantity = ref(1);
const loading = ref(true);
const toast = useToast();
const cartStore = useCartStore();
const selectedUnitIndex = ref(0);

const authenStore = useAuthenStore();
const isLoggedIn = computed(() => authenStore.isAuthenticated);

// สไลด์กาลเลอรี่ responsive options
const galleryOptions = ref([
    {
        breakpoint: '992px',
        numVisible: 5
    },
    {
        breakpoint: '768px',
        numVisible: 4
    },
    {
        breakpoint: '576px',
        numVisible: 3
    }
]);

// ตรวจสอบว่าสินค้านี้อยู่ในตะกร้าหรือไม่
const isInCart = computed(() => {
    if (!product.value) return false;
    return cartStore.isInCart(product.value.id || product.value.code);
});

// จำนวนที่มีในตะกร้า
const quantityInCart = computed(() => {
    if (!product.value) return 0;
    const item = cartStore.cartItems.find((item) => item.item_code === (product.value.id || product.value.code));
    return item ? parseInt(item.qty) : 0;
});

// หน่วยสินค้าที่กำลังเลือก
const currentUnit = computed(() => {
    if (!product.value || !product.value.otherUnits) return null;

    if (selectedUnitIndex.value === 0) {
        return {
            unit_code: product.value.unit_code,
            price: product.value.price,
            sold_out: product.value.sold_out,
            balance_qty: product.value.balance_qty,
            sum_sale: product.value.sum_sale
        };
    } else {
        return product.value.otherUnits[selectedUnitIndex.value - 1];
    }
});

function goToLogin() {
    router.push('/auth/login');
}

// ฟังก์ชันสำหรับจัดรูปแบบตัวเลข
function formatNumber(value) {
    const num = parseFloat(value);
    return num.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

onMounted(async () => {
    try {
        loading.value = true;
        await fetchProductDetail();
    } catch (error) {
        console.error('Error fetching data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
});

// ดึงข้อมูลสินค้า
async function fetchProductDetail() {
    const itemCode = route.params.id;
    if (!itemCode) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่พบรหัสสินค้า',
            life: 3000
        });
        return;
    }

    try {
        const result = await ProductService.getProductByItemCode(itemCode);
        product.value = result.data;

        // สร้างรูปภาพสำหรับแกลลอรี่
        const mainImage = {
            itemImageSrc: product.value.image,
            thumbnailImageSrc: product.value.image,
            alt: product.value.name
        };

        // ถ้ามีหลายหน่วย ให้สร้างรูปภาพเดียวกันหลายๆ รูป
        images.value = [mainImage];

        // จำลองรูปภาพเพิ่มเติม (เพื่อให้แกลลอรี่ดูดีขึ้น) - ในสถานการณ์จริงควรใช้รูปภาพจริงของสินค้า
        if (product.value.otherUnits && product.value.otherUnits.length > 0) {
            // เพิ่มรูปภาพเดียวกันอีก 1-2 รูป เพื่อให้แกลลอรี่ดูดีขึ้น
            images.value.push(mainImage);
        }
    } catch (error) {
        console.error('Error fetching product detail:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
            life: 3000
        });
    }
}

function incrementQuantity() {
    if (product.value && product.value.inventoryStatus !== 'OUTOFSTOCK') {
        quantity.value++;
    }
}

function decrementQuantity() {
    if (quantity.value > 1) {
        quantity.value--;
    }
}

function addToCart() {
    if (!product.value) return;

    // เตรียมข้อมูลสินค้าสำหรับเพิ่มลงตะกร้า
    const unit = currentUnit.value;
    const cartItem = {
        id: product.value.id || product.value.code,
        item_code: product.value.code,
        code: product.value.code,
        name: product.value.name,
        item_name: product.value.name,
        price: parseFloat(unit.price) || 0,
        image: product.value.image,
        category: product.value.category || '',
        unit: unit.unit_code,
        unit_code: unit.unit_code,
        barcode: product.value.barcode || '',
        wh_code: product.value.wh_code || 'MMA01',
        shelf_code: product.value.shelf_code || 'SH101'
    };

    // แสดงการโหลดหรือปิดการใช้งานปุ่มขณะกำลังเพิ่มสินค้า
    loading.value = true;

    // ตรวจสอบว่าสินค้านี้มีในตะกร้าแล้วหรือไม่ โดยเช็คทั้ง item_code และ unit_code
    const existingCartItem = cartStore.cartItems.find((item) => item.item_code === cartItem.item_code && item.unit_code === cartItem.unit_code);

    let finalQty = quantity.value;

    console.log('===== ADD TO CART DEBUG LOGS =====');
    console.log('สินค้าที่ต้องการเพิ่ม:', cartItem.item_name, `(${cartItem.unit_code})`);
    console.log('จำนวนที่ต้องการเพิ่มในครั้งนี้:', quantity.value);

    // ถ้ามีสินค้านี้ในตะกร้าแล้ว ให้เพิ่มจำนวนเดิม + จำนวนที่ต้องการเพิ่ม
    if (existingCartItem) {
        console.log('พบสินค้านี้ในตะกร้าแล้ว!');
        console.log('จำนวนเดิมในตะกร้า:', existingCartItem.qty);
        finalQty = parseInt(existingCartItem.qty) + quantity.value;
        console.log('จำนวนรวมหลังเพิ่ม:', finalQty);

        // อัพเดทค่า cartItem.qty เพื่อให้ไปแสดงใน toast
        cartItem.qty = finalQty;
    } else {
        console.log('ไม่พบสินค้านี้ในตะกร้า เพิ่มเป็นรายการใหม่');
        console.log('จำนวนที่จะเพิ่ม:', finalQty);
    }

    console.log('รายการสินค้าในตะกร้าปัจจุบัน:', cartStore.cartItems.length, 'รายการ');
    console.log('==============================');

    cartStore
        .addToCart(cartItem, finalQty)
        .then(() => {
            toast.add({
                severity: 'success',
                summary: 'เพิ่มสินค้าแล้ว',
                detail: `${product.value.name} (${unit.unit_code}) x ${finalQty}`,
                life: 3000
            });

            // เพิ่ม log หลังจากเพิ่มสินค้าสำเร็จ
            console.log('===== AFTER ADD TO CART =====');
            console.log('การเพิ่มสินค้าสำเร็จ!');
            console.log('จำนวนรายการในตะกร้าหลังเพิ่ม:', cartStore.cartItems.length);
            console.log('จำนวนชิ้นสินค้าทั้งหมดในตะกร้า:', cartStore.totalItems);
            console.log('============================');
        })
        .catch((err) => {
            console.error('Error adding to cart:', err);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้',
                life: 3000
            });

            // เพิ่ม log เมื่อเกิดข้อผิดพลาด
            console.error('===== ADD TO CART ERROR =====');
            console.error('ข้อผิดพลาด:', err);
            console.error('==============================');
        })
        .finally(() => {
            loading.value = false;
        });
}
// เปลี่ยนหน่วยสินค้า
function changeUnit(index) {
    selectedUnitIndex.value = index;
    // รีเซ็ตจำนวนเมื่อเปลี่ยนหน่วย
    quantity.value = 1;
}

function goBack() {
    router.go(-1);
}

// ฟังก์ชันเปลี่ยนสถานะรายการโปรด
function toggleFavorite() {
    if (!product.value) return;

    // เก็บค่า favorite_item เดิมไว้
    const oldFavoriteStatus = product.value.favorite_item || '0';

    // สลับค่า favorite_item ระหว่าง "0" และ "1"
    product.value.favorite_item = product.value.favorite_item === '1' ? '0' : '1';

    toast.add({
        severity: 'success',
        summary: product.value.favorite_item === '1' ? 'เพิ่มในรายการโปรด' : 'นำออกจากรายการโปรด',
        detail: product.value.favorite_item === '1' ? `เพิ่ม ${product.value.name} ในรายการโปรดแล้ว` : `นำ ${product.value.name} ออกจากรายการโปรดแล้ว`,
        life: 3000
    });

    // เรียกใช้งาน API เพื่ออัปเดตสถานะรายการโปรด
    ProductService.updateFavoriteStatus(product.value.id || product.value.code, product.value.favorite_item).catch((error) => {
        console.error('Error updating favorite status:', error);
        // กรณีมีข้อผิดพลาด ให้คืนค่าสถานะเดิม
        product.value.favorite_item = oldFavoriteStatus;
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถอัปเดตสถานะรายการโปรดได้',
            life: 3000
        });
    });
}
</script>

<template>
    <div>
        <Toast position="top-right" />

        <!-- Header with back button -->
        <header class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm p-3 sm:p-4 flex items-center">
            <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="goBack" class="mr-2" />
            <h1 class="text-sm sm:text-lg font-semibold truncate flex-1">
                {{ product ? product.name : 'รายละเอียดสินค้า' }}
            </h1>
            <div class="flex gap-2">
                <div v-if="product" class="rounded-full w-8 h-8 flex items-center justify-center cursor-pointer" :class="product.favorite_item === '1' ? 'bg-red-500' : 'bg-white dark:bg-gray-700'" @click="toggleFavorite">
                    <i class="pi" :class="product.favorite_item === '1' ? 'pi-heart-fill text-white' : 'pi-heart text-gray-600 dark:text-gray-200'" style="font-size: 1rem"></i>
                </div>
            </div>
        </header>

        <!-- Loading state -->
        <div v-if="loading" class="flex justify-center items-center p-6 min-h-[50vh]">
            <ProgressSpinner style="width: 50px" />
        </div>

        <div v-else-if="product" class="pb-20 sm:pb-24">
            <!-- Product content - Flex layout for md screens -->
            <div class="md:flex">
                <!-- Product gallery - Full width on sm, 50% width on md -->
                <div class="md:w-1/2 relative pt-2 sm:p-5 md:p-6 md:w-1/2">
                    <Galleria v-if="images.length > 0" :value="images" :numVisible="5" :circular="true" :showThumbnails="false" :showItemNavigators="false" :responsiveOptions="galleryOptions" containerClass="w-full">
                        <template #item="slotProps">
                            <img :src="slotProps.item.itemImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = product.imageFallback" class="w-full object-cover sm:object-contain" style="max-height: 300px; height: 300px" />
                        </template>
                        <template #thumbnail="slotProps">
                            <img :src="slotProps.item.thumbnailImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = product.imageFallback" class="rounded-sm object-cover" style="width: 70px; height: 40px" />
                        </template>
                    </Galleria>

                    <!-- ถ้าไม่มีรูปภาพ ให้แสดงรูปภาพสำรอง -->
                    <div v-else class="w-full h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <img :src="product.imageFallback" :alt="product.name" class="max-h-[250px] max-w-full object-contain" />
                    </div>

                    <!-- Tags positioned on the gallery -->
                    <div class="absolute top-3 left-3 flex flex-col gap-2">
                        <Tag v-if="currentUnit" :value="currentUnit.sold_out === '1' ? 'สินค้าหมด' : 'มีสินค้า'" :severity="currentUnit.sold_out === '1' ? 'danger' : 'success'" class="text-xs sm:text-sm" />
                    </div>
                </div>

                <!-- Product info card -->
                <div class="product-info pt-2 sm:p-5 md:p-6 md:w-1/2">
                    <Card class="product-info-card shadow-sm border-none">
                        <template #content>
                            <div class="mb-4">
                                <div class="text-sm sm:text-base md:text-lg text-gray-500 dark:text-gray-400">
                                    รหัสสินค้า: <span class="font-medium">{{ product.code }}</span>
                                </div>
                                <h2 class="text-xl sm:text-2xl md:text-3xl font-bold mt-2">{{ product.name }}</h2>
                            </div>

                            <Divider />

                            <!-- ถ้ามีหลายหน่วยให้แสดงตัวเลือกหน่วย -->
                            <div v-if="product.otherUnits && product.otherUnits.length > 0" class="mb-4">
                                <div class="text-base sm:text-lg font-medium mb-3">เลือกหน่วย:</div>
                                <div class="flex flex-wrap gap-2">
                                    <!-- ปุ่มเลือกหน่วยหลัก -->
                                    <Button :label="product.unit_code" :outlined="selectedUnitIndex !== 0" @click="changeUnit(0)" class="text-base" size="small" />

                                    <!-- ปุ่มเลือกหน่วยอื่นๆ -->
                                    <Button v-for="(unitItem, idx) in product.otherUnits" :key="idx" :label="unitItem.unit_code" :outlined="selectedUnitIndex !== idx + 1" @click="changeUnit(idx + 1)" class="text-base" size="small" />
                                </div>
                            </div>

                            <div v-if="currentUnit && currentUnit.sold_out === '1'" class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg text-base sm:text-lg mb-4 flex items-center">
                                <i class="pi pi-exclamation-triangle mr-2"></i>
                                <span>สินค้าหน่วยนี้หมด ไม่สามารถสั่งซื้อได้</span>
                            </div>
                            <!-- Price section -->
                            <div class="flex items-center mb-4 mt-5" v-if="currentUnit">
                                <span class="text-2xl sm:text-3xl md:text-4xl font-bold text-primary"> ฿{{ parseFloat(currentUnit.price).toLocaleString() }} </span>
                                <span class="text-base sm:text-lg text-gray-500 ml-2"> / {{ currentUnit.unit_code }} </span>
                            </div>

                            <!-- In cart badge -->
                            <div v-if="isInCart" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 p-3 rounded-lg text-base sm:text-lg mb-4 flex items-center">
                                <i class="pi pi-info-circle mr-2"></i>
                                <span>มีในตะกร้าแล้ว <Badge :value="quantityInCart" severity="info" class="ml-1"></Badge></span>
                            </div>

                            <div class="product-stats grid grid-cols-2 gap-4 mb-4">
                                <!-- คงเหลือ -->
                                <div v-if="currentUnit" class="text-base sm:text-lg text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                                    <div class="font-medium mb-1">คงเหลือ:</div>
                                    <div :class="parseFloat(currentUnit.balance_qty) < 0 ? 'text-red-500 font-medium' : 'font-medium'">{{ formatNumber(currentUnit.balance_qty) }} {{ currentUnit.unit_code }}</div>
                                </div>

                                <!--ยอดขาย -->
                                <div v-if="currentUnit" class="text-base sm:text-lg text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                                    <div class="font-medium mb-1">ยอดขาย:</div>
                                    <div :class="parseFloat(currentUnit.sum_sale) < 0 ? 'text-red-500 font-medium' : 'font-medium'">{{ formatNumber(currentUnit.sum_sale) }} {{ currentUnit.unit_code }}</div>
                                </div>
                            </div>

                            <!-- Short description -->
                            <div class="mb-6 mt-4 bg-gray-50 dark:bg-gray-800/30 p-3 rounded-lg">
                                <div class="text-base sm:text-lg font-medium mb-2">รายละเอียด</div>
                                <p class="text-base sm:text-lg text-gray-600 dark:text-gray-300 whitespace-pre-line">
                                    {{ product.description || 'ไม่มีคำอธิบายสำหรับสินค้านี้' }}
                                </p>
                            </div>

                            <Divider />

                            <!-- Quantity Selector & Add to Cart Button -->
                            <div class="mb-6" v-if="currentUnit && currentUnit.sold_out !== '1'">
                                <div class="text-xs sm:text-sm font-medium mb-2">จำนวน</div>
                                <div class="flex items-center w-full max-w-[200px]">
                                    <Button icon="pi pi-minus" text rounded @click="decrementQuantity" :disabled="quantity <= 1" class="border border-gray-300 dark:border-gray-700 w-10 h-10 flex items-center justify-center" />
                                    <div class="mx-3 font-medium text-center w-12 text-lg">{{ quantity }}</div>
                                    <Button icon="pi pi-plus" text rounded @click="incrementQuantity" class="border border-gray-300 dark:border-gray-700 w-10 h-10 flex items-center justify-center" />
                                </div>
                            </div>

                            <!-- Add to Cart Button -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <!-- กรณีเข้าสู่ระบบแล้ว แสดงปุ่มเพิ่มลงตะกร้า -->
                                <Button v-if="isLoggedIn" icon="pi pi-shopping-cart" label="เพิ่มลงตะกร้า" @click="addToCart" :disabled="currentUnit && currentUnit.sold_out === '1'" class="w-full p-button-lg flex items-center justify-center" />

                                <!-- กรณียังไม่ได้เข้าสู่ระบบ แสดงปุ่มเข้าสู่ระบบ -->
                                <Button v-else icon="pi pi-sign-in" label="เข้าสู่ระบบเพื่อสั่งซื้อ" @click="goToLogin" class="w-full p-button-lg p-button-outlined flex items-center justify-center" />
                            </div>
                        </template>
                    </Card>
                </div>
            </div>
        </div>

        <div v-else class="p-4 text-center">
            <div class="text-gray-500">ไม่พบข้อมูลสินค้า</div>
        </div>
    </div>
</template>

<style scoped>
:deep(.p-galleria) {
    background: transparent;
    border: none;
}

:deep(.p-galleria-thumbnail-container) {
    background-color: rgba(0, 0, 0, 0.03);
    padding: 0.5rem 0;
}

:deep(.p-galleria-thumbnail-item-active) {
    border: 2px solid var(--primary-color) !important;
}

:deep(.p-galleria-thumbnail-item) {
    opacity: 0.7;
    transition: all 0.2s;
}

:deep(.p-galleria-thumbnail-item:hover),
:deep(.p-galleria-thumbnail-item-active) {
    opacity: 1;
}

.overflow-x-auto::-webkit-scrollbar {
    height: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
}

.cursor-pointer {
    transition: all 0.2s ease;
}
</style>
