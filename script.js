const { createApp, ref, reactive, onMounted } = Vue;

createApp({
    setup() {
        const currentView = ref('desktop'); 
        const switchView = (view) => currentView.value = view;
        const hour = ref('12'); const minute = ref('00'); const fullDate = ref(''); const statusTime = ref('');
        const batteryLevel = ref(60); const charging = ref(false); const storagePct = ref(20);
        
        const wallpaperUrl = ref('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop');
        const imgUrl = ref('https://images.unsplash.com/photo-1517423568366-028c4974d016?q=80&w=2670&auto=format&fit=crop'); 
        const standeeUrl = ref('https://cdn-icons-png.flaticon.com/512/9440/9440474.png');
        const spinning = ref(false);
        const fileInput = ref(null); 
        const standeeInput = ref(null);
        const wallpaperInput = ref(null);

        // API Config
        const apiConfig = reactive({
            endpoint: '',
            key: '',
            model: '',
            temperature: 0.7 
        });
        const modelList = ref([]); 
        const loadingModels = ref(false);
        
        // 预设
        const presets = ref([
            { name: 'Default Local', endpoint: 'http://localhost:1234/v1', key: 'lm-studio', model: 'local-model', temperature: 0.7 }
        ]);
        const selectedPresetId = ref('');
        const showSaveModal = ref(false); const showDeleteModal = ref(false); const newPresetName = ref('');

        // --- 真实 API 拉取 ---
        const fetchModels = async () => {
            if (!apiConfig.endpoint) { alert('请输入 API 地址'); return; }
            let baseUrl = apiConfig.endpoint.replace(/\/+$/, "");
            loadingModels.value = true;
            modelList.value = [];
            try {
                const response = await fetch(`${baseUrl}/models`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiConfig.key}`, 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                const data = await response.json();
                if (data && data.data && Array.isArray(data.data)) {
                    modelList.value = data.data.map(m => m.id).sort();
                    if (modelList.value.length > 0) { apiConfig.model = modelList.value[0]; alert(`成功拉取 ${modelList.value.length} 个模型`); }
                } else { alert('API 返回格式无法识别 (非 OpenAI 标准)'); }
            } catch (error) { console.error(error); alert(`连接失败: ${error.message}`); } finally { loadingModels.value = false; }
        };

        const loadPreset = () => {
            const p = presets.value[selectedPresetId.value];
            if(p) {
                apiConfig.endpoint = p.endpoint; apiConfig.key = p.key; apiConfig.model = p.model; apiConfig.temperature = p.temperature || 0.7;
            }
        };
        const openSaveModal = () => { newPresetName.value = ''; showSaveModal.value = true; };
        const confirmSavePreset = () => {
            if(!newPresetName.value) return;
            presets.value.push({ name: newPresetName.value, ...apiConfig });
            selectedPresetId.value = presets.value.length - 1; showSaveModal.value = false;
        };
        const openDeleteModal = () => { if(selectedPresetId.value === '') return; showDeleteModal.value = true; };
        const confirmDeletePreset = () => {
            presets.value.splice(selectedPresetId.value, 1);
            selectedPresetId.value = ''; apiConfig.endpoint = ''; apiConfig.key = ''; apiConfig.model = ''; apiConfig.temperature = 0.7;
            showDeleteModal.value = false;
        };
        const saveAndExit = () => { switchView('desktop'); };

        // 基础功能
        const updateTime = () => {
            const now = new Date(); hour.value = String(now.getHours()).padStart(2,0); minute.value = String(now.getMinutes()).padStart(2,0);
            statusTime.value = now.toLocaleTimeString('en-US', {hour12:false,hour:'2-digit',minute:'2-digit'});
            fullDate.value = now.toLocaleDateString('en-US', {weekday:'long',day:'numeric',month:'short'}).toUpperCase();
        };
        const uploadImage = () => fileInput.value.click();
        const handleFile = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=v=>imgUrl.value=v.target.result;r.readAsDataURL(f);} };
        const uploadStandee = () => standeeInput.value.click();
        const handleStandeeFile = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=v=>standeeUrl.value=v.target.result;r.readAsDataURL(f);} };
        const uploadWallpaper = () => wallpaperInput.value.click();
        const handleWallpaperFile = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=v=>wallpaperUrl.value=v.target.result;r.readAsDataURL(f);} };
        const spinAction = () => { if(!spinning.value){spinning.value=true;setTimeout(()=>spinning.value=false,1500);} };
        
        onMounted(() => {
            updateTime(); setInterval(updateTime, 1000);
            if('getBattery' in navigator) navigator.getBattery().then(b=>{const u=()=>{batteryLevel.value=Math.floor(b.level*100);charging.value=b.charging};u();b.addEventListener('levelchange',u);b.addEventListener('chargingchange',u);});
        });

        return { 
            currentView, switchView, hour, minute, fullDate, statusTime, batteryLevel, charging, storagePct,
            wallpaperUrl, wallpaperInput, uploadWallpaper, handleWallpaperFile,
            imgUrl, fileInput, uploadImage, handleFile, standeeUrl, standeeInput, uploadStandee, handleStandeeFile, spinning, spinAction,
            apiConfig, modelList, loadingModels, fetchModels, presets, selectedPresetId, loadPreset,
            showSaveModal, newPresetName, openSaveModal, confirmSavePreset, showDeleteModal, openDeleteModal, confirmDeletePreset, saveAndExit
        };
    }
}).mount('#app');
