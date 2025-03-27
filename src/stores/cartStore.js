import CartService from '@/services/CartService';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useCartStore = defineStore('cart', () => {
    const cartItems = ref([]);
    const isLoading = ref(false);
    const error = ref(null);

    // ตั้งค่า user data
    const custCode = ref('');
    const empCode = ref('');

    // Load user data from local storage
    function loadUserData() {
        try {
            const userData = localStorage.getItem('_userData');
            if (userData) {
                const userObj = JSON.parse(userData);
                if (userObj.user_code) {
                    custCode.value = userObj.user_code;
                    return true;
                }
            }
            return false;
        } catch (err) {
            console.error('Error loading user data:', err);
            return false;
        }
    }

    // เก็บรูปแบบข้อมูลสำหรับส่ง API ให้คงเส้นคงวา
    function formatCartItemForApi(item) {
        return {
            creator_code: custCode.value,
            cust_code: custCode.value,
            emp_code: empCode.value,
            guid_code: item.guid_code || item.id || generateGUID(),
            item_code: item.item_code || item.id || item.code,
            item_name: item.item_name || item.name,
            unit_code: item.unit_code || item.unit || 'ชิ้น',
            barcode: item.barcode || '',
            qty: (item.qty || item.quantity || 1).toString(),
            price: (item.price || 0).toString(),
            wh_code: item.wh_code || 'MMA01',
            shelf_code: item.shelf_code || 'SH101',
            ratio: item.ratio || '1',
            stand_value: item.stand_value || '1',
            divide_value: item.divide_value || '1',
            create_datetime: new Date().toISOString().replace('T', ' ').substring(0, 23)
        };
    }

    // คำนวณจำนวนรวมของสินค้าในตะกร้า
    const totalItems = computed(() => {
        if (!cartItems.value || cartItems.value.length === 0) return 0;
        return cartItems.value.reduce((total, item) => total + parseInt(item.qty || item.quantity || 0), 0);
    });

    // คำนวณราคารวมในตะกร้า
    const totalPrice = computed(() => {
        if (!cartItems.value || cartItems.value.length === 0) return 0;
        return cartItems.value.reduce((total, item) => {
            return total + parseFloat(item.price || 0) * parseInt(item.qty || item.quantity || 0);
        }, 0);
    });

    // รวมเป็นยอดเงินทั้งหมด
    const totalAmount = computed(() => totalPrice.value);

    // โหลดข้อมูลตะกร้าจาก API
    async function loadCartItems() {
        try {
            isLoading.value = true;
            error.value = null;

            // ตรวจสอบและโหลดข้อมูลผู้ใช้ถ้าจำเป็น
            if (!custCode.value && !loadUserData()) {
                cartItems.value = [];
                return [];
            }

            const response = await CartService.getCartItems(custCode.value);
            if (response.data && response.data.success && response.data.data) {
                // แปลงข้อมูลให้มีรูปแบบเดียวกัน
                cartItems.value = (response.data.data || []).map((item) => ({
                    ...item,
                    id: item.guid_code,
                    qty: parseInt(item.qty),
                    price: parseFloat(item.price)
                }));
                return cartItems.value;
            } else {
                cartItems.value = [];
                return [];
            }
        } catch (err) {
            console.error('Error loading cart items:', err);
            error.value = 'ไม่สามารถโหลดข้อมูลตะกร้าได้';
            cartItems.value = [];
            return [];
        } finally {
            isLoading.value = false;
        }
    }

    // เพิ่มสินค้าลงตะกร้า
    // เพิ่มสินค้าลงตะกร้า
    async function addToCart(product, quantity) {
        try {
            isLoading.value = true;
            error.value = null;

            // ตรวจสอบว่ามี custCode หรือไม่
            if (!custCode.value && !loadUserData()) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }

            // เพิ่ม logs เพื่อตรวจสอบค่าที่รับเข้ามา
            console.log('CART STORE - ADD TO CART:', {
                product,
                requestedQuantity: quantity,
                currentCartItems: JSON.parse(JSON.stringify(cartItems.value))
            });

            // ตรวจสอบว่าสินค้านี้มีในตะกร้าแล้วหรือไม่ โดยเช็คทั้ง item_code และ unit_code
            const existingItemIndex = cartItems.value.findIndex((item) => item.item_code === (product.item_code || product.id || product.code) && item.unit_code === (product.unit_code || product.unit));

            if (existingItemIndex !== -1) {
                // กรณีมีสินค้าอยู่แล้ว ให้ใช้ค่า quantity ที่ส่งมาเป็นค่าใหม่ทั้งหมด (ไม่ต้องบวกเพิ่ม)
                // เนื่องจากเราได้รวมค่าไว้แล้วจาก ProductDetail
                console.log('CART STORE - พบสินค้าในตะกร้า:', {
                    existingItem: cartItems.value[existingItemIndex],
                    newQuantity: quantity
                });

                // อัปเดตจำนวนสินค้าที่มีอยู่แล้วด้วยค่าใหม่ที่ส่งมา
                cartItems.value[existingItemIndex].qty = parseInt(quantity);

                // สร้าง cartItem สำหรับส่งไป API
                const cartItem = [
                    formatCartItemForApi({
                        ...cartItems.value[existingItemIndex],
                        qty: parseInt(quantity)
                    })
                ];

                // ส่ง API request เพื่ออัพเดทข้อมูล
                const response = await CartService.updateCartItemQuantity(cartItem);

                if (response.data && response.data.success) {
                    console.log('CART STORE - อัปเดตสำเร็จ:', {
                        updatedCartItems: JSON.parse(JSON.stringify(cartItems.value))
                    });
                    return { success: true, message: 'อัปเดตสินค้าในตะกร้าแล้ว' };
                }

                throw new Error(response.data?.message || 'อัปเดตสินค้าไม่สำเร็จ');
            } else {
                // กรณีเพิ่มสินค้าใหม่ ไม่มีในตะกร้า
                console.log('CART STORE - เพิ่มสินค้าใหม่:', {
                    newItem: product,
                    quantity: quantity
                });

                // เพิ่มข้อมูลเพิ่มเติมที่จำเป็นให้กับสินค้าใหม่
                const newProduct = {
                    ...product,
                    quantity: parseInt(quantity),
                    id: product.id || product.guid_code || generateGUID(),
                    item_code: product.item_code || product.id || product.code,
                    unit_code: product.unit_code || product.unit
                };

                // สร้างข้อมูลสินค้าสำหรับส่งไปยัง API
                const cartItem = [formatCartItemForApi(newProduct)];

                // เรียก API เพื่อเพิ่มสินค้าลงตะกร้า
                const response = await CartService.addItemToCart(cartItem);

                if (response.data && response.data.success) {
                    // เพิ่มสินค้าลงใน local state เพื่อหลีกเลี่ยงการเรียก API ซ้ำ
                    const formattedItem = {
                        ...newProduct,
                        guid_code: cartItem[0].guid_code,
                        qty: parseInt(quantity)
                    };
                    cartItems.value.push(formattedItem);

                    console.log('CART STORE - เพิ่มสินค้าใหม่สำเร็จ:', {
                        updatedCartItems: JSON.parse(JSON.stringify(cartItems.value))
                    });
                    return { success: true, message: 'เพิ่มสินค้าลงตะกร้าแล้ว' };
                }

                throw new Error(response.data?.message || 'เพิ่มสินค้าไม่สำเร็จ');
            }
        } catch (err) {
            console.error('Error adding item to cart:', err);
            error.value = err.message || 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    // อัพเดทจำนวนสินค้าในตะกร้า
    async function updateCartItem(itemToUpdate) {
        try {
            isLoading.value = true;
            error.value = null;

            // ตรวจสอบว่ามี custCode หรือไม่
            if (!custCode.value && !loadUserData()) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }

            // ค้นหาสินค้าในตะกร้า
            const existingItemIndex = cartItems.value.findIndex((item) => item.id === itemToUpdate.id || item.guid_code === itemToUpdate.id || item.item_code === itemToUpdate.item_code);

            // กำหนดข้อมูลที่จะส่งไป API
            const qty = itemToUpdate.quantity || itemToUpdate.qty;
            const cartItemData = [formatCartItemForApi(existingItemIndex !== -1 ? { ...cartItems.value[existingItemIndex], qty } : itemToUpdate)];

            // ส่ง API request เพื่ออัพเดทข้อมูล
            const response = await CartService.updateCartItemQuantity(cartItemData);

            if (response.data && response.data.success) {
                if (existingItemIndex !== -1) {
                    // อัปเดตข้อมูลในตะกร้า local
                    cartItems.value[existingItemIndex] = {
                        ...cartItems.value[existingItemIndex],
                        qty: parseInt(qty)
                    };
                } else {
                    // ถ้าไม่พบรายการในตะกร้า local ให้เพิ่มเข้าไป
                    const newItem = {
                        ...itemToUpdate,
                        id: cartItemData[0].guid_code,
                        guid_code: cartItemData[0].guid_code,
                        qty: parseInt(qty)
                    };
                    cartItems.value.push(newItem);
                }

                return { success: true, message: 'อัปเดตสินค้าในตะกร้าแล้ว' };
            }

            throw new Error(response.data?.message || 'อัปเดตสินค้าไม่สำเร็จ');
        } catch (error) {
            console.error('Error updating cart item:', error);
            error.value = error.message || 'ไม่สามารถอัปเดตสินค้าในตะกร้าได้';
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    // ลบสินค้าออกจากตะกร้า
    async function removeFromCart(itemId) {
        try {
            isLoading.value = true;
            error.value = null;

            if (!custCode.value && !loadUserData()) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }

            const itemToRemove = cartItems.value.find((item) => item.id === itemId || item.guid_code === itemId);

            if (!itemToRemove) {
                throw new Error('ไม่พบสินค้าในตะกร้า');
            }

            // ใช้ endpoint ใหม่สำหรับการลบสินค้า
            const response = await CartService.deleteItem(itemToRemove.guid_code || itemId, custCode.value);

            if (response.data && response.data.success) {
                // ดึงข้อมูลตะกร้าใหม่จาก API หลังจากลบสินค้า
                await loadCartItems();
                return { success: true, message: 'ลบสินค้าออกจากตะกร้าแล้ว' };
            }

            throw new Error(response.data?.message || 'ลบสินค้าไม่สำเร็จ');
        } catch (error) {
            console.error('Error removing item from cart:', error);
            error.value = error.message || 'ไม่สามารถลบสินค้าออกจากตะกร้าได้';
            // Reload cart to ensure consistency with database
            await loadCartItems();
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    // ล้างตะกร้าทั้งหมด
    async function clearCart() {
        try {
            isLoading.value = true;
            error.value = null;

            if (!custCode.value && !loadUserData()) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }

            if (cartItems.value.length === 0) {
                return { success: true, message: 'ตะกร้าว่างเปล่าอยู่แล้ว' };
            }

            // ใช้ endpoint สำหรับการล้างตะกร้า
            const response = await CartService.deleteAllItems(custCode.value);

            if (response.data && response.data.success) {
                // ดึงข้อมูลตะกร้าใหม่จาก API หลังจากล้างตะกร้า
                await loadCartItems();
                return { success: true, message: 'ล้างตะกร้าเรียบร้อยแล้ว' };
            }

            throw new Error(response.data?.message || 'ล้างตะกร้าไม่สำเร็จ');
        } catch (error) {
            console.error('Error clearing cart:', error);
            error.value = error.message || 'ไม่สามารถล้างตะกร้าได้';
            // เรียกข้อมูลตะกร้าใหม่เพื่อให้แน่ใจว่าข้อมูลตรงกับฐานข้อมูล
            await loadCartItems();
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    async function checkoutCart(checkoutData) {
        try {
            isLoading.value = true;
            error.value = null;

            if (!custCode.value && !loadUserData()) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }

            // จัดเตรียมข้อมูลสำหรับ API sendOrder
            const now = new Date();
            const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const formattedTime = now.toTimeString().slice(0, 5); // HH:MM

            // สร้างเลขที่เอกสาร (doc_no)
            const docNo = generateOrderNumber();

            // จัดเตรียมข้อมูลสินค้า
            const items = checkoutData.items.map((item) => {
                // คำนวณยอดรวมสำหรับแต่ละรายการ
                const sumAmount = (parseFloat(item.price) * parseInt(item.qty)).toString();

                return {
                    item_code: item.item_code,
                    item_name: item.item_name,
                    barcode: item.barcode || '',
                    qty: item.qty.toString(),
                    price: item.price.toString(),
                    sum_amount: sumAmount,
                    unit_code: item.unit_code || 'ชิ้น',
                    wh_code: item.wh_code || 'MMA01',
                    shelf_code: item.shelf_code || 'SH101',
                    ratio: item.ratio || '1',
                    stand_value: item.stand_value || '1',
                    divide_value: item.divide_value || '1'
                };
            });

            // คำนวณยอดรวม
            const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.sum_amount) || 0), 0).toString();

            // สร้างข้อมูลสำหรับส่งไป API
            const orderData = {
                cust_code: checkoutData.customerCode,
                emp_code: checkoutData.employeeCode || '',
                doc_date: formattedDate,
                doc_time: formattedTime,
                doc_no: docNo,
                items: items,
                total_amount: totalValue,
                total_value: totalValue,
                telephone: checkoutData.deliveryTelephone || '',
                remark: checkoutData.deliveryMethod === 'delivery' ? `จัดส่งที่: ${checkoutData.deliveryAddress || ''}` : 'รับที่ร้าน'
            };

            console.log('Sending order data:', orderData);

            // ส่งข้อมูลไปยัง API
            const response = await CartService.sendOrder(orderData);

            if (response.data && response.data.success) {
                // ล้างตะกร้าหลังจากสั่งซื้อสำเร็จ
                await clearCart();

                return {
                    success: true,
                    message: 'ทำรายการสั่งซื้อเรียบร้อยแล้ว',
                    orderNumber: docNo
                };
            }

            throw new Error(response.data?.msg || 'ไม่สามารถทำรายการสั่งซื้อได้');
        } catch (error) {
            console.error('Error during checkout:', error);
            error.value = error.message || 'ไม่สามารถทำรายการชำระเงินได้';
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    // สร้าง GUID แบบง่าย
    function generateGUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // สร้างเลขที่คำสั่งซื้อ
    function generateOrderNumber() {
        // Get current date in yyyymmdd format
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        // Generate a simple GUID-like string (3 letters followed by 2 digits)
        // You can modify this part based on your specific GUID requirements
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let guid = '';

        // Generate 3 random uppercase letters
        for (let i = 0; i < 3; i++) {
            guid += letters.charAt(Math.floor(Math.random() * letters.length));
        }

        // Add 2 random digits
        guid += Math.floor(Math.random() * 100)
            .toString()
            .padStart(2, '0');

        // Return the final order number in the format MQTyyyymmdd-guid
        return `MQT${dateStr}-${guid}`;
    }

    // ตรวจสอบว่าสินค้าอยู่ในตะกร้าหรือไม่
    function isInCart(itemCode) {
        return cartItems.value.some((item) => item.item_code === itemCode);
    }

    // โหลดข้อมูลตะกร้าตั้งแต่เริ่มต้น
    loadUserData();
    loadCartItems();

    return {
        cartItems,
        isLoading,
        error,
        custCode,
        totalItems,
        totalPrice,
        totalAmount,
        loadCartItems,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
        checkoutCart,
        isInCart
    };
});
