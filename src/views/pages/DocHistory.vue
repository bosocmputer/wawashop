<script setup>
import DocHistoryService from '@/services/DocHistoryService';
import Card from 'primevue/card';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const documents = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedDoc = ref(null);
const selectedDocDetails = ref(null);
const displayDocDetails = ref(false);
const loadingDetails = ref(false);

// รหัสลูกค้า
const userData = JSON.parse(localStorage.getItem('_userData') || '{}');
const userCode = userData.user_code || '';

// ประเภทเอกสาร
const transTypes = {
    40: { label: 'การรับเงินล่วงหน้า', color: 'info', icon: 'pi pi-wallet' },
    44: { label: 'การขาย', color: 'success', icon: 'pi pi-shopping-cart' },
    46: { label: 'เพิ่มหนี้', color: 'danger', icon: 'pi pi-arrow-up' },
    48: { label: 'ลดหนี้', color: 'warning', icon: 'pi pi-arrow-down' }
};

// กรองเอกสาร
const filters = reactive({
    transFlag: '44',
    dateRange: null,
    searchTerm: ''
});

// ดึงข้อมูลเอกสารจาก API
async function fetchDocuments() {
    try {
        loading.value = true;
        error.value = null;

        if (!userCode) {
            router.push('/auth/login');
            return;
        }

        const response = await DocHistoryService.getDocList(userCode, filters.transFlag || '');

        if (response?.data?.success) {
            documents.value = response.data.data || [];
        } else {
            error.value = 'ไม่สามารถดึงข้อมูลเอกสารได้';
        }
    } catch (err) {
        console.error('Error fetching document history:', err);
        error.value = 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร';
    } finally {
        loading.value = false;
    }
}

// ดึงรายละเอียดของเอกสาร
async function fetchDocDetails(docNo) {
    try {
        loadingDetails.value = true;
        const response = await DocHistoryService.getDocDetail(userCode, docNo);

        if (response?.data?.success) {
            selectedDoc.value = {
                ...selectedDoc.value,
                ...response.data.data
            };

            // เก็บเฉพาะรายการสินค้าลงใน selectedDocDetails
            selectedDocDetails.value = response.data.data.items || [];
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error fetching document details:', err);
        return false;
    } finally {
        loadingDetails.value = false;
    }
}

// แสดงรายละเอียดเอกสาร
async function showDocDetails(doc) {
    selectedDoc.value = doc;
    displayDocDetails.value = true;
    selectedDocDetails.value = null;

    const success = await fetchDocDetails(doc.doc_no);
    if (!success) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถดึงรายละเอียดเอกสารได้',
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

// ฟังก์ชันเมื่อมีการเปลี่ยนแปลงประเภทเอกสาร
async function handleTransTypeChange() {
    fetchDocuments();
}

// เอกสารที่ผ่านการกรอง
const filteredDocuments = computed(() => {
    if (!documents.value) return [];

    return documents.value.filter((doc) => {
        // กรองตามคำค้นหา
        if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            const docNoMatch = doc.doc_no.toLowerCase().includes(searchLower);
            const transTypeLabel = transTypes[doc.trans_flag]?.label.toLowerCase() || '';
            const transTypeMatch = transTypeLabel.includes(searchLower);
            const empNameMatch = doc.emp_name ? doc.emp_name.toLowerCase().includes(searchLower) : false;

            return docNoMatch || transTypeMatch || empNameMatch;
        }

        // กรองตามช่วงวันที่
        if (filters.dateRange && filters.dateRange.length === 2) {
            const docDate = new Date(doc.doc_date).setHours(0, 0, 0, 0);
            const startDate = new Date(filters.dateRange[0]).setHours(0, 0, 0, 0);
            const endDate = new Date(filters.dateRange[1]).setHours(23, 59, 59, 999);

            if (docDate < startDate || docDate > endDate) {
                return false;
            }
        }

        return true;
    });
});

// รีเซ็ตการกรอง
function resetFilters() {
    filters.transFlag = '44';
    filters.dateRange = null;
    filters.searchTerm = '';
    fetchDocuments();
}

// ดึงข้อมูลเมื่อโหลดคอมโพเนนต์
onMounted(fetchDocuments);
</script>

<template>
    <div class="doc-history-page">
        <div class="doc-history-container">
            <!-- Header -->
            <div class="page-header mb-4">
                <h1 class="text-2xl font-bold">ประวัติเอกสาร</h1>
                <p class="text-gray-500 dark:text-gray-400 mt-1">ตรวจสอบและดูรายละเอียดเอกสารของคุณ</p>
            </div>

            <!-- Filters -->
            <div class="filters-container mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1">ค้นหา</label>
                        <IconField iconPosition="left" class="w-full">
                            <InputText v-model="filters.searchTerm" placeholder="ค้นหาตามรหัสเอกสาร, ประเภท, พนักงาน..." class="w-full" />
                            <InputIcon class="pi pi-search" />
                        </IconField>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">ประเภทเอกสาร <span class="text-red-500">*</span></label>
                        <Dropdown
                            v-model="filters.transFlag"
                            :options="Object.keys(transTypes)"
                            optionLabel="label"
                            placeholder="เลือกประเภทเอกสาร"
                            class="w-full"
                            :class="{ 'p-invalid': !filters.transFlag && submitted }"
                            @change="handleTransTypeChange"
                            required
                        >
                            <template #value="slotProps">
                                <div v-if="slotProps.value" class="flex align-items-center">
                                    <span>{{ transTypes[slotProps.value].label }}</span>
                                </div>
                                <span v-else>เลือกประเภทเอกสาร</span>
                            </template>
                            <template #option="slotProps">
                                <div class="flex align-items-center">
                                    <span>{{ transTypes[slotProps.option].label }}</span>
                                </div>
                            </template>
                        </Dropdown>
                        <small v-if="!filters.transFlag && submitted" class="p-error">กรุณาเลือกประเภทเอกสาร</small>
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
                <Button label="ลองใหม่" icon="pi pi-refresh" @click="fetchDocuments" />
            </div>

            <!-- Empty state -->
            <div v-else-if="filteredDocuments.length === 0" class="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <i class="pi pi-file-o text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                <h3 class="text-xl font-medium mb-2">ไม่พบเอกสาร</h3>
                <p v-if="filters.transFlag || filters.dateRange || filters.searchTerm" class="text-gray-500 dark:text-gray-400 mb-4 text-center">ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา<br />ลองเปลี่ยนตัวกรองหรือล้างตัวกรองและลองอีกครั้ง</p>
                <p v-else class="text-gray-500 dark:text-gray-400 mb-4 text-center">คุณยังไม่มีประวัติเอกสาร</p>
            </div>

            <!-- Document list -->
            <div v-else class="documents-list grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                    v-for="doc in filteredDocuments"
                    :key="doc.doc_no"
                    class="shadow-sm transition-all duration-200 hover:shadow-md"
                    :class="{
                        'border-left-2 border-info-500 status-info': doc.trans_flag === '40',
                        'border-left-2 border-success-500 status-success': doc.trans_flag === '44',
                        'border-left-2 border-danger-500 status-danger': doc.trans_flag === '46',
                        'border-left-2 border-warning-500 status-warning': doc.trans_flag === '48'
                    }"
                >
                    <!-- 1. ส่วนหัวการ์ด -->
                    <template #header>
                        <div
                            class="grid grid-cols-12 gap-2 p-3 border-bottom-1 border-200 relative"
                            :class="{
                                'bg-blue-50 dark:bg-blue-900/10': doc.trans_flag === '40',
                                'bg-green-50 dark:bg-green-900/10': doc.trans_flag === '44',
                                'bg-red-50 dark:bg-red-900/10': doc.trans_flag === '46',
                                'bg-yellow-50 dark:bg-yellow-900/10': doc.trans_flag === '48'
                            }"
                        >
                            <!-- ซ้าย: รหัสเอกสารและวันที่ -->
                            <div class="col-span-8">
                                <div class="flex flex-wrap items-center gap-2 mb-2">
                                    <span class="text-base sm:text-lg font-semibold text-900">{{ doc.doc_no }}</span>
                                    <Tag :value="transTypes[doc.trans_flag]?.label" :severity="transTypes[doc.trans_flag]?.color" class="text-xs" />
                                </div>
                                <div class="flex flex-col sm:flex-row sm:gap-3 text-xs sm:text-sm text-600">
                                    <div class="mb-1 sm:mb-0"><i class="pi pi-calendar mr-1"></i> {{ formatDate(doc.doc_date, doc.doc_time) }}</div>
                                    <div v-if="doc.emp_name"><i class="pi pi-user mr-1"></i> {{ doc.emp_name }}</div>
                                </div>
                            </div>

                            <!-- ขวา: ราคา -->
                            <div class="col-span-4 flex flex-col items-end justify-center">
                                <div class="text-xs sm:text-sm text-500">ยอดรวม</div>
                                <div class="text-base sm:text-xl font-bold text-primary">฿{{ formatCurrency(doc.total_amount) }}</div>
                            </div>
                        </div>
                    </template>

                    <!-- 2. เนื้อหาการ์ด -->
                    <template #content>
                        <div class="p-3">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <!-- รหัสลูกค้า -->
                                <div class="flex items-center p-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                                    <i class="pi pi-id-card text-primary p-2 bg-primary-50 dark:bg-primary-900/30 rounded-full mr-2 text-xs"></i>
                                    <div>
                                        <div class="text-xs text-500">รหัสลูกค้า</div>
                                        <div class="font-medium text-sm">{{ doc.cust_code }}</div>
                                    </div>
                                </div>

                                <!-- ประเภทการรับสินค้า -->
                                <div class="flex items-center p-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                                    <i :class="doc.send_type === '1' ? 'pi pi-send' : 'pi pi-home'" class="text-primary p-2 bg-primary-50 dark:bg-primary-900/30 rounded-full mr-2 text-xs"></i>
                                    <div>
                                        <div class="text-xs text-500">ประเภทการรับสินค้า</div>
                                        <div class="font-medium text-sm">{{ doc.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน' }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- 3. ส่วนท้ายการ์ด -->
                    <template #footer>
                        <div
                            class="p-3 border-top-1 border-200 flex flex-wrap gap-2 justify-end"
                            :class="{
                                'bg-blue-50/70 dark:bg-blue-900/5': doc.trans_flag === '40',
                                'bg-green-50/70 dark:bg-green-900/5': doc.trans_flag === '44',
                                'bg-red-50/70 dark:bg-red-900/5': doc.trans_flag === '46',
                                'bg-yellow-50/70 dark:bg-yellow-900/5': doc.trans_flag === '48'
                            }"
                        >
                            <Button label="รายละเอียด" icon="pi pi-eye" class="p-button-sm p-button-primary w-full" @click="showDocDetails(doc)" />
                        </div>
                    </template>
                </Card>
            </div>

            <!-- Document details dialog -->
            <Dialog v-model:visible="displayDocDetails" :header="`เอกสารเลขที่: ${selectedDoc?.doc_no || ''}`" :style="{ width: '90%', maxWidth: '900px' }" :modal="true" :closeOnEscape="true" :dismissableMask="true">
                <!-- Loading state for details -->
                <div v-if="loadingDetails" class="flex justify-center items-center p-8">
                    <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
                </div>

                <div v-else-if="selectedDoc" class="doc-details">
                    <!-- Doc Status and Basic Info -->
                    <div class="flex flex-col md:flex-row gap-4 mb-4">
                        <div
                            class="status-container p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex-1"
                            :class="{
                                'bg-blue-50 dark:bg-blue-900/20': selectedDoc.trans_flag === '40',
                                'bg-green-50 dark:bg-green-900/20': selectedDoc.trans_flag === '44',
                                'bg-red-50 dark:bg-red-900/20': selectedDoc.trans_flag === '46',
                                'bg-yellow-50 dark:bg-yellow-900/20': selectedDoc.trans_flag === '48',
                                'bg-gray-50 dark:bg-gray-800': !selectedDoc.trans_flag || !transTypes[selectedDoc.trans_flag]
                            }"
                        >
                            <div class="flex items-center">
                                <i :class="[transTypes[selectedDoc.trans_flag]?.icon || 'pi pi-file', 'text-xl mr-2', `text-${transTypes[selectedDoc.trans_flag]?.color || 'primary'}-500`]"></i>
                                <span class="font-semibold">{{ transTypes[selectedDoc.trans_flag]?.label || 'เอกสาร' }}</span>
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">วันที่: {{ formatDate(selectedDoc.doc_date, selectedDoc.doc_time) }}</div>
                        </div>

                        <div class="payment-summary p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 flex-1">
                            <div class="font-semibold mb-1">สรุปการชำระเงิน</div>
                            <div class="flex justify-between text-sm">
                                <span>ยอดรวม:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedDoc.total_amount) }}</span>
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
                                <div class="text-sm font-medium">{{ selectedDoc.cust_code }}</div>

                                <div class="text-sm text-gray-500">ประเภทการรับสินค้า:</div>
                                <div class="text-sm font-medium">
                                    <Tag :severity="selectedDoc.send_type === '1' ? 'info' : 'success'" :value="selectedDoc.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน'" />
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
                                <div class="text-sm font-medium">{{ selectedDoc.emp_code || '-' }}</div>

                                <div class="text-sm text-gray-500">ชื่อพนักงาน:</div>
                                <div class="text-sm font-medium">{{ selectedDoc.emp_name || 'ไม่มีพนักงานดูแล' }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Document Items -->
                    <div v-if="selectedDocDetails && selectedDocDetails.length > 0" class="mb-4">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-list mr-2 text-primary-500"></i>
                            รายการสินค้า
                        </h3>
                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div class="bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 text-sm font-medium">
                                <div class="grid grid-cols-12 gap-2">
                                    <div class="col-span-5">สินค้า</div>
                                    <div class="col-span-2">หน่วย</div>
                                    <div class="col-span-1 text-right">ราคา</div>
                                    <div class="col-span-1 text-center">จำนวน</div>
                                    <div class="col-span-3 text-right">รวม</div>
                                </div>
                            </div>

                            <div class="divide-y divide-gray-100 dark:divide-gray-700">
                                <div v-for="(item, index) in selectedDocDetails" :key="index" class="p-3">
                                    <div class="grid grid-cols-12 gap-2 items-center">
                                        <div class="col-span-5">
                                            <div class="font-medium text-primary-600 dark:text-primary-400">{{ item.item_name }}</div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">รหัส: {{ item.item_code }}</div>
                                        </div>
                                        <div class="col-span-2">{{ item.unit_code }}</div>
                                        <div class="col-span-1 text-right">฿{{ formatCurrency(item.price) }}</div>
                                        <div class="col-span-1 text-center">{{ item.qty }}</div>
                                        <div class="col-span-3 text-right font-semibold">฿{{ formatCurrency(item.sum_amount) }}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Document Items Summary -->
                            <div class="bg-gray-50 dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700">
                                <div class="grid grid-cols-12 gap-2">
                                    <div class="col-span-9 text-right font-medium">รวมทั้งสิ้น:</div>
                                    <div class="col-span-3 text-right font-bold text-primary-600 dark:text-primary-400">฿{{ formatCurrency(selectedDoc.total_amount) }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="!loadingDetails" class="mb-4 flex items-center justify-center p-6 border border-yellow-200 bg-yellow-50 rounded-lg text-yellow-800">
                        <i class="pi pi-exclamation-triangle mr-2"></i>
                        <span>ไม่พบรายการสินค้าในเอกสารนี้</span>
                    </div>

                    <!-- Document Notes -->
                    <div v-if="selectedDoc.remark" class="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-comment mr-2 text-primary-500"></i>
                            หมายเหตุ
                        </h3>
                        <p class="text-sm">{{ selectedDoc.remark }}</p>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-end gap-2">
                        <Button label="ปิด" icon="pi pi-times" outlined @click="displayDocDetails = false" />
                    </div>
                </template>
            </Dialog>
        </div>
    </div>
</template>
