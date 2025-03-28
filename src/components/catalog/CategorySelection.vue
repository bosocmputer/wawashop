<script setup>
import CategoryService from '@/services/CategoryService';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { defineEmits, defineProps, onMounted, ref } from 'vue';

const props = defineProps({
    selectedCategory: {
        type: String,
        default: 'all'
    }
});

const emit = defineEmits(['select-category']);

// สำหรับเก็บข้อมูลหมวดหมู่
const categories = ref([]);

// สำหรับ Skeleton Loading
const loading = ref(true);

// สำหรับแสดง Toast
const toast = useToast();

onMounted(async () => {
    try {
        // โหลดข้อมูลหมวดหมู่จาก CategoryService ที่เชื่อมต่อกับ API
        const response = await CategoryService.getCategories();
        categories.value = response.data;
        loading.value = false;
    } catch (error) {
        console.error('Error loading categories:', error);
        loading.value = false;

        // แสดงข้อความแจ้งเตือน
        const errorMessage = error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลหมวดหมู่';
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: errorMessage,
            life: 5000
        });
    }
});

// เลือกหมวดหมู่
function selectCategory(categoryCode) {
    emit('select-category', categoryCode);
}
</script>

<template>
    <Toast position="top-right" />
    <div class="category-section py-3 px-2">
        <!-- Category Header -->
        <div class="flex justify-content-between align-items-center mb-3 px-2">
            <h3 class="text-lg font-medium m-0"><i class="pi pi-list mr-2"></i>หมวดหมู่สินค้า</h3>
        </div>

        <!-- Desktop View - แบบแถบปุ่ม -->
        <div class="hidden md:block">
            <!-- Skeleton Loading -->
            <div v-if="loading" class="flex flex-wrap gap-2 px-2">
                <Skeleton v-for="i in 8" :key="i" width="120px" height="36px" class="mb-2" />
            </div>

            <!-- Actual Content -->
            <div v-else class="flex flex-wrap gap-2 px-2">
                <Button
                    v-for="category in categories"
                    :key="category.code"
                    :label="category.name"
                    :outlined="selectedCategory !== category.code"
                    :severity="selectedCategory === category.code ? 'primary' : 'secondary'"
                    size="small"
                    class="category-button"
                    @click="selectCategory(category.code)"
                />
            </div>
        </div>

        <!-- Mobile View - แบบแถบเลื่อนซ้าย-ขวา -->
        <div class="md:hidden">
            <!-- Skeleton Loading -->
            <div v-if="loading" class="overflow-x-auto hide-scrollbar">
                <div class="flex gap-2 px-2" style="min-width: max-content">
                    <Skeleton v-for="i in 8" :key="i" width="100px" height="32px" />
                </div>
            </div>

            <!-- Actual Content -->
            <div v-else class="overflow-x-auto hide-scrollbar">
                <div class="flex gap-2 px-2" style="min-width: max-content">
                    <Button
                        v-for="category in categories"
                        :key="category.code"
                        :label="category.name"
                        :outlined="selectedCategory !== category.code"
                        :severity="selectedCategory === category.code ? 'primary' : 'secondary'"
                        size="small"
                        class="category-button-mobile"
                        @click="selectCategory(category.code)"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.category-section {
    background-color: var(--surface-card);
    padding: 0.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.category-button {
    margin-bottom: 0.5rem;
    text-align: center;
    transition: all 0.2s;
    min-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

.category-button-mobile {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: auto;
}

.hide-scrollbar {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

.hide-scrollbar::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
}

@media (max-width: 640px) {
    .category-button {
        font-size: 0.8rem;
        padding: 0.4rem 0.8rem;
    }
}
</style>
