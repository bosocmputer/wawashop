<script setup>
import { useCartStore } from '@/stores/cartStore';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppMenuItem from './AppMenuItem.vue';

const cartStore = useCartStore();
const router = useRouter();

// คำนวณจำนวนสินค้าในตะกร้า
const cartItemCount = computed(() => cartStore.totalItems);
const isLoggedIn = ref(!!localStorage.getItem('_token'));

// ฟังก์ชันสำหรับออกจากระบบ
const handleLogout = () => {
    // Clear authentication token from localStorage
    localStorage.removeItem('_token');
    // Clear any other user data
    localStorage.clear();
    // อัพเดตสถานะการล็อกอิน
    isLoggedIn.value = false;
    // Redirect to login page
    router.push('/auth/login');
};
const model = ref([
    {
        label: 'ร้านค้า',
        items: [
            { label: 'สินค้าทั้งหมด', icon: 'pi pi-fw pi-shopping-bag', to: '/' },
            {
                label: 'ตะกร้าสินค้า',
                icon: 'pi pi-fw pi-shopping-cart',
                to: '/cart',
                badge: cartItemCount.value > 0 ? cartItemCount.value.toString() : null,
                badgeClass: 'p-badge-danger'
            }
        ]
    },
    // เมนูประวัติต่างๆ จะแสดงเฉพาะเมื่อล็อกอินแล้ว
    ...(isLoggedIn.value
        ? [
              {
                  label: 'ประวัติ',
                  items: [
                      { label: 'ประวัติการสั่งซื้อ', icon: 'pi pi-fw pi-history', to: '/orders-history' },
                      { label: 'ประวัติเอกสาร', icon: 'pi pi-fw pi-history', to: '/doc-history' }
                  ]
              }
          ]
        : []),
    {
        label: isLoggedIn.value ? 'ออกจากระบบ' : 'เข้าสู่ระบบ',
        items: [
            {
                label: isLoggedIn.value ? 'ออกจากระบบ' : 'เข้าสู่ระบบ',
                icon: isLoggedIn.value ? 'pi pi-sign-out' : 'pi pi-sign-in',
                command: () => (isLoggedIn.value ? handleLogout() : router.push('/auth/login'))
            }
        ]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
