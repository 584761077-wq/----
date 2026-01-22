const { createApp, ref, reactive, onMounted, watch } = Vue;

createApp({
    setup() {
        const currentView = ref('desktop'); 
        const switchView = (view) => currentView.value = view;
        const hour = ref('12'); const minute = ref('00'); const fullDate = ref(''); const statusTime = ref('');
        const batteryLevel = ref(60); const charging = ref(false); const storagePct = ref(20);
        
        const wallpaperUrl = ref('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop');
        const chatWallpaperUrl = ref('https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=2670&auto=format&fit=crop'); // 默认白色背景
        const imgUrl = ref('https://images.unsplash.com/photo-1517423568366-028c4974d016?q=80&w=2670&auto=format&fit=crop'); 
        const standeeUrl = ref('https://cdn-icons-png.flaticon.com/512/9440/9440474.png');
        const spinning = ref(false);
        const fileInput = ref(null); 
        const standeeInput = ref(null);
        const wallpaperInput = ref(null);
        const chatWallpaperInput = ref(null);
        const isDarkText = ref(false);

        // --- 数据持久化 ---
        const STORAGE_KEY = 'ios26-liquid-settings';

        // Chat App State
        const currentChatTab = ref('chat');
        const contacts = ref([]);
        const showAddRoleModal = ref(false);
        const newRoleName = ref('');
        const switchChatTab = (tab) => currentChatTab.value = tab;
        
        // Chat Conversation State
        const currentConversation = ref({});
        const messages = ref({}); // { contactId: [ { text, type, time } ] }
        const newMessage = ref('');

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
        const presets = ref([]);
        const selectedPresetId = ref('');
        const showSaveModal = ref(false); const showDeleteModal = ref(false); const newPresetName = ref('');

        // Chat Settings (基于联系人ID)
        const chatSettings = reactive({}); // { contactId: { char: {...}, user: {...}, worldbook: 'default' } }
        
        // 当前聊天设置（用于UI绑定）
        const currentChatSettings = reactive({
            char: {
                avatar: '',
                realName: 'Char',
                nickname: 'Char昵称',
                personality: '这是一个Char的人设描述...'
            },
            user: {
                avatar: '',
                realName: 'User',
                nickname: 'User昵称',
                personality: '这是一个User的人设描述...'
            },
            worldbook: 'default'
        });

        // User Presets
        const userPresets = ref([]);
        const selectedUserPresetId = ref('');
        
        // Avatar Modal
        const showAvatarModal = ref(false);
        const avatarModalTarget = ref(''); // 'char' or 'user'
        const avatarPreviewUrl = ref('');
        const avatarUrlInput = ref('');
        const avatarFileInput = ref(null);
        
        // User Preset Modals
        const showSaveUserPresetModal = ref(false);
        const showDeleteUserPresetModal = ref(false);
        const newUserPresetName = ref('');

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
        const saveAndExit = () => { 
            saveState(); // 保存并退出
            switchView('desktop'); 
        };

        const confirmAddRole = () => {
            if (!newRoleName.value.trim()) return;
            contacts.value.push({
                id: Date.now(),
                name: newRoleName.value,
                signature: '这个人很懒，什么都没留下...'
            });
            newRoleName.value = '';
            showAddRoleModal.value = false;
        };

        // Chat Functions
        const openChat = (contact) => {
            currentConversation.value = contact;
            // 确保该联系人有消息数组
            if (!messages.value[contact.id]) {
                messages.value[contact.id] = [];
            }
            switchView('conversation');
        };

        // 获取有消息的联系人（用于消息列表）
        const getContactsWithMessages = () => {
            return contacts.value.filter(contact => {
                const contactMessages = messages.value[contact.id];
                return contactMessages && contactMessages.length > 0;
            });
        };

        const sendMessage = () => {
            if (!newMessage.value.trim() || !currentConversation.value.id) return;
            
            const contactId = currentConversation.value.id;
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            
            // 确保该联系人有消息数组
            if (!messages.value[contactId]) {
                messages.value[contactId] = [];
            }
            
            // 添加发送的消息
            messages.value[contactId].push({
                text: newMessage.value,
                type: 'sent',
                time: timeStr
            });
            
            // 清空输入框
            newMessage.value = '';
            
            // 自动回复（模拟）
            setTimeout(() => {
                messages.value[contactId].push({
                    text: '已收到你的消息！',
                    type: 'received',
                    time: new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0')
                });
            }, 1000);
        };

        // --- 数据持久化核心函数 ---
        const saveState = () => {
            try {
                const state = {
                    apiConfig: apiConfig,
                    presets: presets.value,
                    wallpaperUrl: wallpaperUrl.value,
                    chatWallpaperUrl: chatWallpaperUrl.value,
                    imgUrl: imgUrl.value,
                    standeeUrl: standeeUrl.value,
                    selectedPresetId: selectedPresetId.value,
                    contacts: contacts.value,
                    isDarkText: isDarkText.value,
                    messages: messages.value,
                    chatSettings: chatSettings,
                    userPresets: userPresets.value
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                console.log("状态已保存。");
            } catch (e) {
                console.error("保存状态失败:", e);
            }
        };

        const loadState = () => {
            try {
                const savedState = localStorage.getItem(STORAGE_KEY);
                if (savedState) {
                    const state = JSON.parse(savedState);
                    Object.assign(apiConfig, state.apiConfig);
                    presets.value = state.presets || [];
                    wallpaperUrl.value = state.wallpaperUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop';
                    chatWallpaperUrl.value = state.chatWallpaperUrl || 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=2670&auto=format&fit=crop';
                    imgUrl.value = state.imgUrl || 'https://images.unsplash.com/photo-1517423568366-028c4974d016?q=80&w=2670&auto=format&fit=crop';
                    standeeUrl.value = state.standeeUrl || 'https://cdn-icons-png.flaticon.com/512/9440/9440474.png';
                    selectedPresetId.value = state.selectedPresetId || '';
                    contacts.value = state.contacts || [];
                    isDarkText.value = state.isDarkText || false;
                    messages.value = state.messages || {};
                    
                    // 加载聊天设置
                    if (state.chatSettings) {
                        Object.assign(chatSettings, state.chatSettings);
                    }
                    if (state.userPresets) {
                        userPresets.value = state.userPresets || [];
                    }
                    
                    console.log("状态已加载。");
                } else {
                    // 如果没有保存的状态，设置一个默认预设
                    presets.value = [{ name: 'Default Local', endpoint: 'http://localhost:1234/v1', key: 'lm-studio', model: 'local-model', temperature: 0.7 }];
                }
            } catch (e) {
                console.error("加载状态失败:", e);
            }
        };

        // 监听所有需要持久化的数据
        watch([apiConfig, presets, wallpaperUrl, imgUrl, standeeUrl, selectedPresetId, contacts, chatWallpaperUrl, isDarkText, messages, chatSettings, userPresets], saveState, { deep: true });


        // --- 聊天设置功能 ---
        
        // 打开聊天设置
        const openChatSettings = () => {
            const contactId = currentConversation.value.id;
            if (!contactId) return;
            
            // 加载或初始化该联系人的设置
            if (!chatSettings[contactId]) {
                chatSettings[contactId] = {
                    char: {
                        avatar: '',
                        realName: 'Char',
                        nickname: 'Char昵称',
                        personality: '这是一个Char的人设描述...'
                    },
                    user: {
                        avatar: '',
                        realName: 'User',
                        nickname: 'User昵称',
                        personality: '这是一个User的人设描述...'
                    },
                    worldbook: 'default'
                };
            }
            
            // 更新当前聊天设置用于UI绑定
            Object.assign(currentChatSettings, chatSettings[contactId]);
            
            // 切换到聊天设置视图
            switchView('chat-settings');
        };

        // 打开头像上传模态框
        const openAvatarModal = (target) => {
            avatarModalTarget.value = target;
            avatarPreviewUrl.value = currentChatSettings[target].avatar || '';
            avatarUrlInput.value = currentChatSettings[target].avatar || '';
            showAvatarModal.value = true;
        };

        // 触发文件输入
        const triggerAvatarFileInput = () => {
            avatarFileInput.value.click();
        };

        // 处理头像文件上传
        const handleAvatarFile = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    avatarPreviewUrl.value = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };

        // 确认头像更改
        const confirmAvatarChange = () => {
            if (avatarModalTarget.value) {
                const newAvatarUrl = avatarPreviewUrl.value || avatarUrlInput.value;
                const contactId = currentConversation.value.id;
                
                if (contactId && chatSettings[contactId]) {
                    currentChatSettings[avatarModalTarget.value].avatar = newAvatarUrl;
                    chatSettings[contactId][avatarModalTarget.value].avatar = newAvatarUrl;
                    
                    // 同步到通讯录和消息列表
                    syncAvatarToContacts(avatarModalTarget.value, newAvatarUrl);
                    
                    showAvatarModal.value = false;
                    avatarPreviewUrl.value = '';
                    avatarUrlInput.value = '';
                }
            }
        };

        // 取消头像更改
        const cancelAvatarModal = () => {
            showAvatarModal.value = false;
            avatarPreviewUrl.value = '';
            avatarUrlInput.value = '';
        };

        // 同步头像到通讯录和消息列表
        const syncAvatarToContacts = (target, avatarUrl) => {
            const targetName = target === 'char' ? currentChatSettings.char.realName : currentChatSettings.user.realName;
            
            // 更新通讯录中对应的联系人
            contacts.value.forEach(contact => {
                if (contact.name === targetName) {
                    contact.avatar = avatarUrl;
                }
            });
            
            // 注意：消息列表中的头像通常通过联系人数据获取，所以更新通讯录即可
        };

        // 同步备注到通讯录
        const syncNicknameToContacts = (target) => {
            const targetName = target === 'char' ? currentChatSettings.char.realName : currentChatSettings.user.realName;
            const nickname = target === 'char' ? currentChatSettings.char.nickname : currentChatSettings.user.nickname;
            
            contacts.value.forEach(contact => {
                if (contact.name === targetName) {
                    contact.nickname = nickname;
                }
            });
        };

        // 保存聊天设置
        const saveChatSettings = () => {
            const contactId = currentConversation.value.id;
            if (contactId && chatSettings[contactId]) {
                // 将当前聊天设置保存到基于联系人ID的设置中
                Object.assign(chatSettings[contactId], currentChatSettings);
            }
            
            // 同步备注到通讯录
            syncNicknameToContacts('char');
            syncNicknameToContacts('user');
            
            // 保存状态
            saveState();
            
            // 返回聊天界面
            switchView('chat');
        };

        // --- 用户预设管理 ---
        
        // 打开保存用户预设模态框
        const openSaveUserPresetModal = () => {
            newUserPresetName.value = '';
            showSaveUserPresetModal.value = true;
        };

        // 确认保存用户预设
        const confirmSaveUserPreset = () => {
            if (!newUserPresetName.value.trim()) return;
            
            userPresets.value.push({
                id: Date.now().toString(),
                name: newUserPresetName.value,
                personality: currentChatSettings.user.personality
            });
            
            selectedUserPresetId.value = userPresets.value.length - 1;
            showSaveUserPresetModal.value = false;
            newUserPresetName.value = '';
        };

        // 打开删除用户预设模态框
        const openDeleteUserPresetModal = () => {
            if (selectedUserPresetId.value === '') return;
            showDeleteUserPresetModal.value = true;
        };

        // 确认删除用户预设
        const confirmDeleteUserPreset = () => {
            if (selectedUserPresetId.value !== '') {
                userPresets.value.splice(selectedUserPresetId.value, 1);
                selectedUserPresetId.value = '';
                showDeleteUserPresetModal.value = false;
            }
        };

        // 加载用户预设
        const loadUserPreset = () => {
            const preset = userPresets.value[selectedUserPresetId.value];
            if (preset) {
                currentChatSettings.user.personality = preset.personality;
            }
        };

        // 应用用户预设
        const applyUserPreset = () => {
            loadUserPreset();
        };

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
        const uploadChatWallpaper = () => chatWallpaperInput.value.click();
        const handleChatWallpaperFile = (e) => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=v=>chatWallpaperUrl.value=v.target.result;r.readAsDataURL(f);} };
        const spinAction = () => { if(!spinning.value){spinning.value=true;setTimeout(()=>spinning.value=false,1500);} };
        
        onMounted(() => {
            loadState(); // 应用启动时加载数据
            updateTime(); setInterval(updateTime, 1000);
            if('getBattery' in navigator) navigator.getBattery().then(b=>{const u=()=>{batteryLevel.value=Math.floor(b.level*100);charging.value=b.charging};u();b.addEventListener('levelchange',u);b.addEventListener('chargingchange',u);});
        });

            return { 
                currentView, switchView, hour, minute, fullDate, statusTime, batteryLevel, charging, storagePct,
                wallpaperUrl, wallpaperInput, uploadWallpaper, handleWallpaperFile,
                chatWallpaperUrl, chatWallpaperInput, uploadChatWallpaper, handleChatWallpaperFile,
                isDarkText,
                imgUrl, fileInput, uploadImage, handleFile, standeeUrl, standeeInput, uploadStandee, handleStandeeFile, spinning, spinAction,
                apiConfig, modelList, loadingModels, fetchModels, presets, selectedPresetId, loadPreset,
                showSaveModal, newPresetName, openSaveModal, confirmSavePreset, showDeleteModal, openDeleteModal, confirmDeletePreset, saveAndExit,
                // Chat App
                currentChatTab, switchChatTab, contacts, showAddRoleModal, newRoleName, confirmAddRole,
                // Chat Conversation
                currentConversation, messages, newMessage, openChat, sendMessage, getContactsWithMessages,
                // Chat Settings
                chatSettings, currentChatSettings, userPresets, selectedUserPresetId,
                showAvatarModal, avatarModalTarget, avatarPreviewUrl, avatarUrlInput,
                showSaveUserPresetModal, showDeleteUserPresetModal, newUserPresetName,
                openChatSettings, openAvatarModal, triggerAvatarFileInput, handleAvatarFile, confirmAvatarChange, cancelAvatarModal,
                saveChatSettings, openSaveUserPresetModal, confirmSaveUserPreset,
                openDeleteUserPresetModal, confirmDeleteUserPreset, loadUserPreset, applyUserPreset
            };
    }
}).mount('#app');
