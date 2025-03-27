import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

class CartService {
    // เพิ่มสินค้าลงตะกร้า
    async addItemToCart(cartItems) {
        return apiClient.post('service/wawashopservice/additemtocart', cartItems);
    }

    // ดึงรายการสินค้าในตะกร้า
    async getCartItems(custCode) {
        return apiClient.get('service/wawashopservice/getcartitemlist', {
            params: {
                cust_code: custCode
            }
        });
    }

    // ลบสินค้าออกจากตะกร้า
    async removeItemFromCart(custCode, itemCode, unitCode) {
        return apiClient.post('service/wawashopservice/removeitemfromcart', {
            cust_code: custCode,
            item_code: itemCode,
            unit_code: unitCode
        });
    }

    // ลบสินค้าออกจากตะกร้า (ใหม่)
    async deleteItem(guidCode, custCode) {
        return apiClient.get('service/wawashopservice/deleteItem', {
            params: {
                guid_code: guidCode,
                cust_code: custCode
            }
        });
    }

    // ล้างตะกร้าทั้งหมด
    async deleteAllItems(custCode) {
        return apiClient.get('service/wawashopservice/deleteAllItems', {
            params: {
                cust_code: custCode
            }
        });
    }

    // อัปเดตจำนวนสินค้าในตะกร้า (ใช้ endpoint เดียวกับ addItemToCart)
    async updateCartItemQuantity(cartItems) {
        // ใช้ endpoint เดียวกับการเพิ่มสินค้า
        return apiClient.post('service/wawashopservice/additemtocart', cartItems);
    }

    // ดึงข้อมูลสินค้าในตะกร้าพร้อมราคายืนยัน
    async getCartOrder(custCode) {
        return apiClient.get('service/wawashopservice/getcartorder', {
            params: {
                cust_code: custCode
            }
        });
    }

    // สั่งซื้อสินค้า
    async sendOrder(orderData) {
        return apiClient.post('service/wawashopservice/sendorder', orderData);
    }

    async cancelOrder(orderData) {
        return apiClient.post('service/wawashopservice/cancelOrder', orderData);
    }
}

export default new CartService();
