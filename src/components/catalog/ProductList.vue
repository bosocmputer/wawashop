<script setup>
import ProductService from '@/services/ProductService';
import { useAuthenStore } from '@/stores/authen';
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
    selectedCategory: {
        type: String,
        default: 'all'
    }
});

const authenStore = useAuthenStore();
const isAuthenticated = computed(() => authenStore.isAuthenticated);

const router = useRouter();
const toast = useToast();

// ข้อมูลสินค้าและการค้นหา
const products = ref([]);
const searchQuery = ref('');
const loadingProducts = ref(true);

// สำหรับ Skeleton Loading
const initialLoading = ref(true);

// ข้อมูลการเพจจิเนชั่น
const pagination = ref({
    total: 0,
    perPage: 10,
    totalPage: 0,
    page: 0
});
const isLoadingMore = ref(false);
const hasMoreItems = ref(true);
const observerTarget = ref(null); // element ที่จะถูกสังเกตสำหรับ Infinite Scroll

onMounted(() => {
    // โหลดข้อมูลสินค้าทันที (ไม่ต้องรอ 2 วินาที)
    loadProducts();

    // ตั้งค่า Intersection Observer หลังจากโหลดข้อมูลเสร็จ
    nextTick(() => {
        setupInfiniteScroll();
    });
});

onUnmounted(() => {
    // ทำความสะอาด observer เมื่อออกจากหน้า
    if (observer) {
        observer.disconnect();
    }
});

// ตั้งค่า Intersection Observer สำหรับการโหลดข้อมูลแบบ Infinite Scroll
let observer;
function setupInfiniteScroll() {
    // สร้าง IntersectionObserver ใหม่
    observer = new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting && !isLoadingMore.value && hasMoreItems.value && !initialLoading.value) {
                console.log('Loading more products from observer');
                loadMoreProducts();
            }
        },
        { threshold: 0.1, rootMargin: '100px' }
    );

    // เริ่มสังเกต element เมื่อมีการสร้าง element แล้ว
    setTimeout(() => {
        if (observerTarget.value) {
            observer.observe(observerTarget.value);
            console.log('Observer attached to target');
        } else {
            console.warn('Observer target not found');
        }
    }, 500);
}

// โหลดข้อมูลสินค้าหน้าแรก
async function loadProducts() {
    loadingProducts.value = true;
    try {
        const filters = {
            category: props.selectedCategory !== 'all' ? props.selectedCategory : '',
            search: searchQuery.value
        };

        const result = await ProductService.getProducts(filters, 0);

        // รีเซ็ตและเพิ่มข้อมูลใหม่
        products.value = result.data;
        pagination.value = result.pagination;

        // ตรวจสอบว่ายังมีข้อมูลให้โหลดต่อหรือไม่
        hasMoreItems.value = pagination.value.page < pagination.value.totalPage - 1;

        // หลังจากโหลดข้อมูลเสร็จ ยกเลิกสถานะการโหลด
        initialLoading.value = false;

        // หลังจากโหลดข้อมูลแล้ว ลองติดตั้ง observer อีกครั้ง
        nextTick(() => {
            if (observer) {
                observer.disconnect();
            }
            setupInfiniteScroll();
        });
    } catch (error) {
        console.error('Error loading products:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
            life: 3000
        });
        // แม้จะมีข้อผิดพลาด ก็ยังต้องยกเลิกสถานะการโหลด
        initialLoading.value = false;
    } finally {
        loadingProducts.value = false;
    }
}

// โหลดข้อมูลสินค้าเพิ่มเติม (สำหรับ infinite scroll)
async function loadMoreProducts() {
    if (isLoadingMore.value || !hasMoreItems.value) return;

    isLoadingMore.value = true;
    console.log('Loading more products, current page:', pagination.value.page);

    try {
        const filters = {
            category: props.selectedCategory !== 'all' ? props.selectedCategory : '',
            search: searchQuery.value
        };

        const nextPage = pagination.value.page + 1;
        const result = await ProductService.getProducts(filters, nextPage);

        // เพิ่มข้อมูลลงในอาร์เรย์ products เดิม
        products.value = [...products.value, ...result.data];
        pagination.value = result.pagination;

        // ตรวจสอบว่ายังมีข้อมูลให้โหลดต่อหรือไม่
        hasMoreItems.value = pagination.value.page < pagination.value.totalPage - 1;
        console.log('Has more items:', hasMoreItems.value);
    } catch (error) {
        console.error('Error loading more products:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าเพิ่มเติมได้',
            life: 3000
        });
    } finally {
        isLoadingMore.value = false;
    }
}

// ฟังก์ชันที่เรียกจากปุ่มเพื่อโหลดข้อมูลเพิ่มเติม (กรณี infinite scroll ไม่ทำงาน)
function handleLoadMore() {
    if (!isLoadingMore.value && hasMoreItems.value) {
        loadMoreProducts();
    }
}

function getInventoryStatus(soldOut) {
    return soldOut === '1' ? 'OUTOFSTOCK' : 'INSTOCK';
}

// สำหรับค้นหาสินค้า
function handleSearch() {
    filterProducts();
}

// กรองและเรียงลำดับสินค้า
function filterProducts() {
    // รีเซ็ตการเพจจิเนชั่น
    pagination.value.page = 0;
    hasMoreItems.value = true;

    // โหลดข้อมูลใหม่
    loadProducts();
}

// ดูรายละเอียดสินค้า
function viewProductDetail(product) {
    // นำทางไปยังหน้ารายละเอียดสินค้าโดยใช้ item_code
    router.push(`/product-detail/${product.item_code}`);
}

// ล้างตัวกรองทั้งหมด
function clearFilters() {
    searchQuery.value = '';
    filterProducts();
}

// ฟังก์ชันเปลี่ยนสถานะรายการโปรด
function toggleFavorite(product, event) {
    // หยุดการกระจายของ event
    if (event) {
        event.stopPropagation();
    }

    // เก็บค่า favorite_item เดิมไว้
    const oldFavoriteStatus = product.favorite_item;

    // สลับค่า favorite_item ระหว่าง "0" และ "1"
    product.favorite_item = product.favorite_item === '1' ? '0' : '1';

    // แสดงข้อความแจ้งเตือน
    toast.add({
        severity: 'success',
        summary: product.favorite_item === '1' ? 'เพิ่มในรายการโปรด' : 'นำออกจากรายการโปรด',
        detail: product.favorite_item === '1' ? `เพิ่ม ${product.item_name} ในรายการโปรดแล้ว` : `นำ ${product.item_name} ออกจากรายการโปรดแล้ว`,
        life: 3000
    });

    // เรียกใช้งาน API เพื่ออัปเดตสถานะรายการโปรด
    ProductService.updateFavoriteStatus(product.item_code, product.favorite_item).catch((error) => {
        console.error('Error updating favorite status:', error);
        // กรณีมีข้อผิดพลาด ให้คืนค่าสถานะเดิม
        product.favorite_item = oldFavoriteStatus;
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถอัปเดตสถานะรายการโปรดได้',
            life: 3000
        });
    });
}

// ติดตามการเปลี่ยนแปลงของตัวกรอง
watch(
    [() => props.selectedCategory, searchQuery],
    () => {
        filterProducts();
    },
    { deep: true }
);

// ติดตามการเปลี่ยนแปลงของ products เพื่อตรวจสอบ observer
watch(
    products,
    () => {
        nextTick(() => {
            // ตรวจสอบและรีเซ็ต observer เมื่อข้อมูลเปลี่ยน
            if (observerTarget.value && !initialLoading.value) {
                if (observer) {
                    observer.disconnect();
                }
                setupInfiniteScroll();
            }
        });
    },
    { deep: false }
);
</script>

<template>
    <div>
        <Toast position="top-right" />

        <!-- ช่องค้นหา -->
        <div class="px-3 py-2 sm:py-3 border-t border-gray-100 dark:border-gray-700">
            <IconField iconPosition="left" class="w-full">
                <InputText v-model="searchQuery" type="text" placeholder="ค้นหาสินค้า" class="w-full" @keyup.enter="handleSearch" />
                <InputIcon class="pi pi-search" />
            </IconField>
        </div>

        <!-- เนื้อหาหลัก -->
        <main class="pb-6">
            <!-- Skeleton Loading -->
            <div v-if="initialLoading" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                <div v-for="i in 8" :key="i" class="border border-surface-200 dark:border-surface-700 rounded overflow-hidden shadow-sm">
                    <Skeleton height="200px" />
                    <div class="p-3">
                        <Skeleton width="30%" height="12px" class="mb-1" />
                        <Skeleton width="90%" height="16px" class="mb-2" />
                        <Skeleton width="50%" height="12px" class="mb-2" />
                        <div class="flex justify-between items-center">
                            <Skeleton width="40%" height="24px" />
                            <Skeleton shape="circle" size="36px" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- ตารางแสดงสินค้า -->
            <div v-else-if="products && products.length > 0" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                <!-- ส่วนแสดงสินค้า -->
                <div
                    v-for="product in products"
                    :key="product.item_code"
                    class="border border-surface-200 dark:border-surface-700 rounded overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                    @click="viewProductDetail(product)"
                >
                    <div class="relative">
                        <img :src="product.image" :alt="product.item_name" class="w-full aspect-square object-cover" @error="$event.target.src = product.imageFallback" />

                        <!-- สถานะสินค้า -->
                        <div class="dark:bg-surface-900 absolute rounded-border" style="left: 5px; top: 5px">
                            <Tag :value="product.sold_out === '1' ? 'OUTOFSTOCK' : 'INSTOCK'" :severity="getInventoryStatus(product.sold_out === '1' ? 'OUTOFSTOCK' : 'INSTOCK')" />
                        </div>

                        <!-- แสดงปุ่มรายการโปรด (สามารถคลิกได้) -->
                        <div
                            v-if="isAuthenticated"
                            class="absolute right-2 top-2 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
                            :class="product.favorite_item === '1' ? 'bg-red-500' : 'bg-white bg-opacity-80 dark:bg-gray-700'"
                            @click.stop="toggleFavorite(product, $event)"
                        >
                            <i class="pi" :class="product.favorite_item === '1' ? 'pi-heart-fill text-white' : 'pi-heart text-gray-600 dark:text-gray-200'" style="font-size: 1rem"></i>
                        </div>
                    </div>

                    <div class="p-3">
                        <!-- รหัสสินค้า -->
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">รหัส: {{ product.item_code }}</div>

                        <!-- ชื่อสินค้า -->
                        <div class="mb-2 font-medium text-sm line-clamp-2 product-name" v-tooltip="product.item_name">
                            {{ product.item_name }}
                        </div>

                        <!-- หมวดหมู่ -->
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {{ product.category }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- สถานะว่าง (ไม่พบสินค้า) -->
            <div v-else-if="!loadingProducts && !initialLoading && products && products.length === 0" class="flex justify-center p-8">
                <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 w-full max-w-md">
                    <div class="flex flex-col items-center text-center">
                        <i class="pi pi-search text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                        <h3 class="text-xl font-medium mb-2">ไม่พบสินค้า</h3>
                        <p class="text-gray-500 dark:text-gray-400 mb-4">ลองปรับเงื่อนไขการค้นหาหรือตัวกรองดูใหม่</p>
                        <Button label="ล้างตัวกรองทั้งหมด" icon="pi pi-filter-slash" outlined class="w-full sm:w-auto" @click="clearFilters" />
                    </div>
                </div>
            </div>

            <!-- สถานะกำลังโหลด -->
            <div v-else-if="loadingProducts && !initialLoading" class="flex justify-center p-8">
                <div class="text-center">
                    <ProgressSpinner style="width: 50px" class="mb-4" />
                    <p class="text-gray-500">กำลังโหลดสินค้า...</p>
                </div>
            </div>

            <!-- ส่วนแสดงการโหลดเพิ่มเติม -->
            <div v-if="products && products.length > 0" class="p-4 flex justify-center">
                <div ref="observerTarget" id="observer-target" class="w-full text-center">
                    <div v-if="isLoadingMore" class="flex justify-center items-center">
                        <ProgressSpinner style="width: 30px" />
                        <span class="ml-2 text-gray-500">กำลังโหลดเพิ่มเติม...</span>
                    </div>
                    <div v-else-if="!hasMoreItems" class="text-gray-500">-- แสดงสินค้าทั้งหมดแล้ว --</div>
                    <div v-else>
                        <p class="text-gray-500 mb-2">เลื่อนลงเพื่อโหลดเพิ่มเติม</p>
                        <!-- เพิ่มปุ่มโหลดเพิ่มเติม กรณี infinite scroll ไม่ทำงาน -->
                        <Button label="โหลดเพิ่มเติม" icon="pi pi-arrow-down" outlined @click="handleLoadMore" :disabled="isLoadingMore || !hasMoreItems" />
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
/* สไตล์สำหรับ infinite scroll */
#observer-target {
    min-height: 100px;
    margin: 20px 0;
    position: relative;
}
</style>
