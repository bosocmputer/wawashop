<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

// นำเข้า Component ที่แยกออกมา
import CategorySelection from '@/components/catalog/CategorySelection.vue';
import ProductList from '@/components/catalog/ProductList.vue';
import RecommendedProducts from '@/components/catalog/RecommendedProducts.vue';

// ข้อมูลหมวดหมู่
const selectedCategory = ref('all');

// สถานะการแสดงปุ่มกลับขึ้นด้านบน
const showBackToTop = ref(false);

// เลือกหมวดหมู่
function handleSelectCategory(categoryCode) {
    selectedCategory.value = categoryCode;
}

// ฟังก์ชันกลับขึ้นด้านบน
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// ตรวจสอบการเลื่อนหน้าเพื่อแสดง/ซ่อนปุ่มกลับขึ้นด้านบน
function handleScroll() {
    showBackToTop.value = window.scrollY > 300;
}

// เพิ่ม event listener เมื่อ component ถูกเรียกใช้
onMounted(() => {
    window.addEventListener('scroll', handleScroll);
});

// ลบ event listener เมื่อ component ถูกทำลาย
onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
    <Toast />
    <div class="flex justify-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div class="w-full max-w-full md:max-w-4xl lg:max-w-6xl overflow-y-auto">
            <!-- 1. ส่วนสินค้าแนะนำ -->
            <RecommendedProducts />

            <!-- ส่วนหัวแคตตาล็อก -->
            <header class="sticky top-0 bg-white dark:bg-gray-800 z-20 shadow-sm">
                <!-- 2. ส่วนแสดงหมวดหมู่ -->
                <CategorySelection :selectedCategory="selectedCategory" @select-category="handleSelectCategory" />

                <!-- 3. ส่วนค้นหาและแสดงรายการสินค้า -->
                <ProductList :selectedCategory="selectedCategory" />
            </header>
        </div>
    </div>

    <!-- ปุ่มกลับขึ้นด้านบน -->
    <transition name="fade">
        <button
            v-show="showBackToTop"
            @click="scrollToTop"
            class="fixed bottom-6 right-6 bg-primary rounded-full w-12 h-12 flex items-center justify-center shadow-lg z-50 text-white hover:bg-primary-dark transition-all duration-300"
            aria-label="กลับขึ้นด้านบน"
        >
            <i class="pi pi-arrow-up"></i>
        </button>
    </transition>
</template>

<style scoped>
/* Animation สำหรับปุ่มกลับขึ้นด้านบน */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* สีปุ่มกลับขึ้นด้านบนสำหรับ hover */
.hover\:bg-primary-dark:hover {
    filter: brightness(90%);
}
</style>
