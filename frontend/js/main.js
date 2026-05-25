 // 全局变量
 // AI鼓励语相关全局变量
let aiGeneratedResults = [];
let aiPromptHistory = JSON.parse(localStorage.getItem('aiPromptHistory') || '[]');

// 专注页语录管理
let focusSessionPhrases = {
    presetUsed: false,      // 是否已使用过预设语录（第1句）
    aiGenerated: [],        // AI生成的鼓励语池
    aiReminders: {},        // AI生成的督促语池（按等级）
    aiGenerating: false,    // AI是否正在生成
    currentIndex: 0,        // 当前鼓励语索引
    remindIndex: {},        // 督促语索引（按等级）
    currentOCStatus: ''     // 当前OC状态
};

 let currentPage = 'home';
 let isTimerRunning = false;
 let isPaused = false;
 let currentTime = 25 * 60;
 let selectedMinutes = 25;
 let timerInterval = null;
 let currentMode = 'pomodoro';
 let currentStatus = { name: '', icon: '⚪' };
 let currentMusicMode = 0;

 // 圆形裁切状态
 let _cropState = {
     imageData: null,
     imgW: 0,
     imgH: 0,
     x: 0,
     y: 0,
     scale: 1,
     isDragging: false,
     dragStartX: 0,
     dragStartY: 0,
     dragOrigX: 0,
     dragOrigY: 0
 };
 // 音频管理
 let currentBackgroundMusic = null;
 let completionAudio = null;
 let isMusicEnabled = true;
 let musicPausedTime = 0; 
let musicType = 'mute'; 

// 音频文件URL
const audioFiles = {
music: 'https://raw.githubusercontent.com/dengxi-cpu/Pomodoro/main/music.mp3',
rain: 'https://raw.githubusercontent.com/dengxi-cpu/Pomodoro/main/storm.mp3',
completion: 'https://raw.githubusercontent.com/dengxi-cpu/Pomodoro/main/commission_finished.MP3'
};
 let isStatusSelected = false;
 // 自定义状态存储（新增）
let customStatuses = {};  // 存储自定义状态的图标等信息
 let currentTask = { name: '复习英语单词', status: '进行中', color: 'blue' };
 const musicIcons = ['🔇', '🎵', '🌧️'];
 
 // 4.1 全局变量（
 let statusGifts = {
'学习': [
 '🏆 学霸专属奖杯！知识的力量让你闪闪发光！',
 '📖 你念叨过的绝版书（Ta在古籍书店蹲了2小时）',
 '⭐ 学习之星徽章！你就是最亮的那颗星！',
 '🖋️ 定制钢笔（笔夹刻着你名字缩写，墨色是你最爱的灰紫）',
 '📝 写满心得的笔记（在重点页夹着银杏书签："此处你会喜欢"）',
 '💎 知识宝石！比钻石更珍贵的是你的努力！'
 
],
'工作': [
 '🐱 解压小物（会摇头的猫咪摆件——"放你电脑旁，替我监督你休息"）',
 '🚀 效率火箭！工作状态满分！',
 '⚡ 生产力闪电！今天的你超级给力！',
 '✨ 星空投影灯（加班夜挑的："以后我晚归，让它陪你入睡"）',
 '🧁 你最喜欢的甜品（用手帕仔细包着："你说过这款最好吃"）'
],
'冒险': [
 '🗺️ 冒险家地图！每一步都是新的发现！',
 '🌌 山顶拍的星空照（背后写着：我的宇宙中心是你）',
 '🏴‍☠️ 探险旗帜！未知的世界在等着你！',
 '💧 森林露水（水晶瓶装着）',
 '💎 会发光的矿石（嵌成项链）'
],
'逛街': [
 '🧦 错版袜子（左蓝猫右橘猫）',
 '☕ 手作陶泥杯（杯柄捏成歪心形）',
 '👠 时尚女王高跟鞋！走路都带风！',
 '💄 美妆大师套装！你就是最美的风景！',
 '💐 你喜欢的香水（"现在风经过你，都是你的味道"）'
],
'玩游戏': [
 '🎮 游戏大神手柄！技术流就是你！',
 '🏆 电竞冠军奖杯！菜鸟什么的不存在！',
 '💍 游戏币熔的戒指（内侧刻你的名字）',
 '🎯 百发百中勋章！精准度MAX！',
 '🔥 连胜火焰！今天状态爆表！'
],
'发呆': [
 '☁️ 思考云朵！放空也是一种智慧！',
 '🐷 便利店收据背面涂鸦（画你睡脸："监控拍到某只小猪偷懒证据"）',
 '☁️ 云朵形状的石头（放你手心："它飘累了，来你这里降落"）',
 '🦋 银杏叶拼成的蝴蝶（夹在诗集第14页："你生日那天的风送来的"）',
 '💭 创意泡泡！下一个好点子就要冒出来了！'
],
'睡觉': [
 '😴 好梦成真枕头！甜美梦境等着你！',
 '🌙 枕头暖意（把发热眼罩塞给你："借你充电5分钟"）',
 '⭐ 星星安眠曲！让星光陪你入睡！',
 '🛏️ 云朵床铺！像躺在云端一样舒适！',
 '💭 压皱的梦境（便签写着："梦见我抢你冰淇淋，赔你张兑换券"）'
],
'休息': [
 '🌿 放松叶子！让疲惫随风飘散！',
 '🍃 清新薄荷！瞬间恢复活力！',
 '🌺 舒缓花朵！身心都得到了治愈！',
 '🌻 老奶奶卖的绒线花（永不凋谢的向日葵："她说要送给爱笑的小姑娘"）',
 '🍁 流浪猫送的谢礼（松果涂成金色："用小鱼干换的"）'
]
};

let currentEditingStatus = '';
let currentEditingStatusIcon = '';
// 4.2 状态礼物编辑相关函数
function editStatusGift(safesafeStatusName, statusIcon) {
currentEditingStatus = safesafeStatusName;
currentEditingStatusIcon = statusIcon;

const modal = document.getElementById('statusGiftEditorModal');
const title = document.getElementById('statusGiftEditorTitle');
const icon = document.getElementById('statusGiftEditorIcon');
const textarea = document.getElementById('statusGiftEditorTextarea');

title.textContent = `编辑${safesafeStatusName}礼物`;
icon.textContent = statusIcon;

// 加载当前状态的礼物内容
const currentGifts = statusGifts[safesafeStatusName] || [];
textarea.value = currentGifts.join('\n');

modal.classList.add('show');
}

function closeStatusGiftEditor() {
document.getElementById('statusGiftEditorModal').classList.remove('show');
}

function saveStatusGifts() {
const textarea = document.getElementById('statusGiftEditorTextarea');
const gifts = textarea.value.trim().split('\n').filter(line => line.trim());

// 保存礼物内容
statusGifts[currentEditingStatus] = gifts;

// 保存到本地存储
saveStatusGiftsToStorage();

// 更新预览显示
updateStatusGiftPreview(currentEditingStatus);

closeStatusGiftEditor();
alert('礼物已保存！');
}

function updateStatusGiftPreview(safesafeStatusName) {
const card = document.querySelector(`[data-status="${safesafeStatusName}"]`);
if (card) {
 const preview = card.querySelector('.status-gift-preview');
 const gifts = statusGifts[safesafeStatusName] || [];
 if (gifts.length > 0) {
     // 显示前两个礼物作为预览
     const previewText = gifts.slice(0, 2).join('；');
     preview.textContent = previewText.length > 40 ? previewText.substring(0, 40) + '...' : previewText;
 } else {
     preview.textContent = '点击编辑礼物内容';
 }
}
}



function addCustomStatusCard(safesafeStatusName, statusIcon) {
const grid = document.getElementById('statusGiftGrid');
const customButton = grid.querySelector('.custom-status-card');

const newCard = document.createElement('div');
newCard.className = 'status-gift-card';
newCard.setAttribute('data-status', safesafeStatusName);

newCard.innerHTML = `
 <div class="status-gift-header">
     <span class="status-gift-icon">${statusIcon}</span>
     <span class="status-gift-name">${safesafeStatusName}</span>
 </div>
 <div class="status-gift-preview">点击编辑礼物内容</div>
 <div class="status-gift-edit-indicator">✏️</div>
 <button class="custom-status-delete" title="删除此自定义状态">
     <svg class="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
         <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
     </svg>
 </button>
`;

// 插入到自定义按钮之前
if (customButton) {
 grid.insertBefore(newCard, customButton);
}

// 同步到专注页状态选择器
syncCustomStatusToFocusPage(safesafeStatusName, statusIcon);
}

function deleteCustomStatusGift(safesafeStatusName) {
// 检查是否是预设状态
const presetStatuses = ['学习', '工作', '冒险', '逛街', '玩游戏', '发呆', '睡觉', '休息'];
if (presetStatuses.includes(safesafeStatusName)) {
 alert('预设状态不能删除，只能编辑');
 return;
}

if (confirm(`确定要删除"${safesafeStatusName}"状态吗？此操作不可恢复。`)) {
 // 从存储中删除
 delete statusGifts[safesafeStatusName];
 delete customStatuses[safesafeStatusName];
 
 // 保存到本地存储
 saveStatusGiftsToStorage();
 saveCustomStatusesToStorage();
 
 // 从页面中移除卡片
 const card = document.querySelector(`[data-status="${safesafeStatusName}"]`);
 if (card) {
     card.remove();
 }
 
 // 从专注页移除对应的状态选项
 removeCustomStatusFromFocusPage(safesafeStatusName);
 
 // 提示删除成功
 console.log(`已删除自定义状态: ${safesafeStatusName}`);
}
}



function saveStatusGiftsToStorage() {
localStorage.setItem('statusGifts', JSON.stringify(statusGifts));
}
// 保存自定义状态到本地存储（新增）
function saveCustomStatusesToStorage() {
localStorage.setItem('customStatuses', JSON.stringify(customStatuses));
}

// 从本地存储加载自定义状态（新增）
function loadCustomStatusesFromStorage() {
const saved = localStorage.getItem('customStatuses');
if (saved) {
 try {
     customStatuses = JSON.parse(saved);
 } catch (e) {
     console.log('Failed to parse custom statuses');
     customStatuses = {};
 }
}
}

// 同步自定义状态到专注页面（新增）
function syncCustomStatusToFocusPage(safesafeStatusName, statusIcon) {
const statusGrid = document.querySelector('#statusSelector .status-grid');
if (!statusGrid) return;

// 检查是否已存在
const existingOption = statusGrid.querySelector(`[data-custom-status="${safesafeStatusName}"]`);
if (existingOption) return;

// 创建新的状态选项
const statusOption = document.createElement('div');
statusOption.className = 'status-option';
statusOption.setAttribute('data-custom-status', safesafeStatusName);
statusOption.onclick = () => selectStatus(safesafeStatusName, statusIcon);

statusOption.innerHTML = `
 <span class="status-icon">${statusIcon}</span>
 <span class="status-text">${safesafeStatusName}</span>
`;

// 插入到自定义选项之前
const customStatusOption = statusGrid.querySelector('[onclick="showCustomStatusInput()"]');
if (customStatusOption) {
 statusGrid.insertBefore(statusOption, customStatusOption);
} else {
 statusGrid.appendChild(statusOption);
}
}

// 从专注页面移除自定义状态（新增）
function removeCustomStatusFromFocusPage(safesafeStatusName) {
const statusOption = document.querySelector(`[data-custom-status="${safesafeStatusName}"]`);
if (statusOption) {
 statusOption.remove();
}
}

// 初始化专注页面的自定义状态选项（新增）
function initCustomStatusInFocusPage() {
Object.keys(customStatuses).forEach(safesafeStatusName => {
 const statusInfo = customStatuses[safesafeStatusName];
 syncCustomStatusToFocusPage(safesafeStatusName, statusInfo.icon);
});
}



function loadStatusGiftsFromStorage() {
const saved = localStorage.getItem('statusGifts');
if (saved) {
 try {
     const loaded = JSON.parse(saved);
     // 合并默认状态礼物和自定义状态礼物
     statusGifts = { ...statusGifts, ...loaded };
 } catch (e) {
     console.log('Failed to parse status gifts');
 }
}
}

function initializeStatusGiftPreviews() {
// 确保DOM准备好再执行
const statusGiftGrid = document.getElementById('statusGiftGrid');
if (!statusGiftGrid) {
 setTimeout(initializeStatusGiftPreviews, 100);
 return;
}

// 初始化所有状态礼物卡片的预览
Object.keys(statusGifts).forEach(safesafeStatusName => {
 updateStatusGiftPreview(safesafeStatusName);
});

// 加载自定义状态卡片
loadCustomStatusCards();

// 绑定事件（延迟确保DOM完全渲染）
setTimeout(() => {
 bindStatusGiftCardEvents();
}, 50);

// 如果当前在专注页面，同步自定义状态
if (currentPage === 'focus') {
 initCustomStatusInFocusPage();
}
}

function bindStatusGiftCardEvents() {
// 检查DOM是否准备好
const statusGiftGrid = document.getElementById('statusGiftGrid');
if (!statusGiftGrid) {
 console.log('状态礼物网格未找到，延迟绑定');
 setTimeout(bindStatusGiftCardEvents, 100);
 return;
}

// 移除旧的事件监听器（防止重复绑定）
statusGiftGrid.removeEventListener('click', handleStatusGiftCardClick);

// 添加新的事件监听器（事件委托）
statusGiftGrid.addEventListener('click', handleStatusGiftCardClick);

console.log('状态礼物卡片事件已绑定');
}

// 新增：统一的事件处理函数
function handleStatusGiftCardClick(event) {
const clickedElement = event.target;
const card = clickedElement.closest('.status-gift-card');

if (!card) return;

// 阻止事件冒泡
event.stopPropagation();

// 如果点击的是删除按钮
if (clickedElement.closest('.custom-status-delete')) {
 const safesafeStatusName = card.getAttribute('data-status');
 deleteCustomStatusGift(safesafeStatusName);
 return;
}

// 如果点击的是自定义状态创建按钮
if (card.classList.contains('custom-status-card')) {
 createCustomStatusGift();
 return;
}

// 其他情况：编辑礼物
const safesafeStatusName = card.getAttribute('data-status');
const iconElement = card.querySelector('.status-gift-icon');
const statusIcon = iconElement ? iconElement.textContent : '✨';

editStatusGift(safesafeStatusName, statusIcon);
}

function loadCustomStatusCards() {
const presetStatuses = ['学习', '工作', '冒险', '逛街', '玩游戏', '发呆', '睡觉', '休息'];
const customStatuses = Object.keys(statusGifts).filter(status => !presetStatuses.includes(status));

customStatuses.forEach(safesafeStatusName => {
 // 为自定义状态创建图标（可以从专注页的状态选择器中获取，或使用默认图标）
 const statusIcon = '✨'; // 默认图标，可以考虑保存图标信息
 addCustomStatusCard(safesafeStatusName, statusIcon);
 updateStatusGiftPreview(safesafeStatusName);
});
}
// 同步自定义状态到专注页
function syncCustomStatusToFocusPage(safesafeStatusName, statusIcon) {
const statusGrid = document.querySelector('#statusSelector .status-grid');
if (!statusGrid) return;

// 检查是否已存在
const existingOption = statusGrid.querySelector(`[data-custom-status="${safesafeStatusName}"]`);
if (existingOption) return;

// 创建新的状态选项
const statusOption = document.createElement('div');
statusOption.className = 'status-option';
statusOption.setAttribute('data-custom-status', safesafeStatusName);
statusOption.onclick = () => selectStatus(safesafeStatusName, statusIcon);

statusOption.innerHTML = `
 <span class="status-icon">${statusIcon}</span>
 <span class="status-text">${safesafeStatusName}</span>
`;

// 插入到自定义选项之前
const customStatusOption = statusGrid.querySelector('[onclick="showCustomStatusInput()"]');
if (customStatusOption) {
 statusGrid.insertBefore(statusOption, customStatusOption);
}
}

// 从专注页移除自定义状态
function removeCustomStatusFromFocusPage(safesafeStatusName) {
const statusOption = document.querySelector(`[data-custom-status="${safesafeStatusName}"]`);
if (statusOption) {
 statusOption.remove();
}
}

// 初始化专注页的自定义状态选项
function initCustomStatusInFocusPage() {
const presetStatuses = ['学习', '工作', '冒险', '逛街', '玩游戏', '发呆', '睡觉', '休息'];
const customStatuses = Object.keys(statusGifts).filter(status => !presetStatuses.includes(status));

customStatuses.forEach(safesafeStatusName => {
 // 尝试从本地存储获取图标，或使用默认图标
 const statusIcon = getCustomStatusIcon(safesafeStatusName) || '✨';
 syncCustomStatusToFocusPage(safesafeStatusName, statusIcon);
});
}

// 获取自定义状态的图标（可以扩展保存图标功能）
function getCustomStatusIcon(safesafeStatusName) {
// 可以从localStorage获取保存的图标信息
const customStatusIcons = JSON.parse(localStorage.getItem('customStatusIcons') || '{}');
return customStatusIcons[safesafeStatusName] || '✨';
}

// 保存自定义状态图标
function saveCustomStatusIcon(safesafeStatusName, statusIcon) {
const customStatusIcons = JSON.parse(localStorage.getItem('customStatusIcons') || '{}');
customStatusIcons[safesafeStatusName] = statusIcon;
localStorage.setItem('customStatusIcons', JSON.stringify(customStatusIcons));
}


 // OC交互相关变量
 let clickCount = 0;
 let clickTimer = null;
 let recoveryTimer = null;
 let ignoreTimer = null;
 let canInteract = true;
 let isIgnoring = false;
 let focusStartOCIndex = 0;
 
 // OC语系统相关变量
 let encourageInterval = null;
 let phraseGenerationInterval = null; // 25分钟定时生成语录
 let currentMessageType = 'initial';
 
 // 自定义风格存储 - 优化结构，支持风格元数据
 let customStyles = {
     encourage: {},
     remind: {},
     metadata: {} // 存储自定义风格的元数据（标题、描述等）
 };
 
 // 语料库
 const ocMessageLibrary = {
     // 鼓励语库
     encourage: {
         gentle: [
             "{title}，你的侧脸真是百看不厌呢",
                  "{title}就这样沉浸在自己的世界里吧，我会好好守护你的。",
                  "{title}，我的目光会一直追随着你哦",
                 "乖{title}，集中精神，我在这儿呢。",
              "{title}，感觉时间都变慢了，空气里全是你的味道~",
              "{title}偶尔皱眉头的样子，也好可爱呀！",
               "{title}，就按你的节奏来，不用慌",
                 "看着{title}努力的样子，真的好安心。",
                 "{title}是不是有点累了？坚持住，我在心里为你加油",
                 "{title}的努力，我都有好好看在眼里呢！",
                 "好想摸摸{title}的头，又怕打扰你，只能忍住啦",
                 "嗯~我的宝贝真认真呢...这个侧脸，专注的样子，太让人心动啦！",
                 "时间在走，但我的目光只为你停留。{title}做得很好，比任何人都棒！",
                 "今天也好喜欢{title}，你努力的样子真好看",
                 "{title}，灯光够亮吗？姿势舒服吗？要好好照顾自己呀"
         ],
         tsundere: [
             "哼，马马虎虎还算认真。… 继续保持，别让我失望。",
             "别东张西望！… 专心点！… 咳，我是说… 你认真起来的样子… 还、还行吧。",
             "遇到难题了？… 哼，就知道你搞不定。… 过来点，我… 我勉强指点你一下。",
             "喂，头太低了！… 注意姿势！… 我是为你好，才不是关心你！",
             "其实，你比我想象中坚持得久一点。… 也就一点！别得意！",
             "哼，还算有点毅力。… 继续保持，终点就在前面了，别松懈！",
             "也就只有认真的时候，看起来还算……顺眼。",
             "别东张西望的，我可没那么好看，快看你的书。",
             "快点写，写完了才能……咳，总之你快点！别让我等太久。",
             "我说你啊，稍微努力一点的样子，也不是那么让人讨厌嘛。",
             "啧，麻烦死了。非要我盯着你才能学进去吗？",
             "你再敢走神，我就把你桌上的零食都吃光了！听见没！",
             "哼，这么简单的东西需要想这么久？真拿你没办法。",
             "我可没在等你，我是在看窗外的风景，你别自作多情。"
         ],
         cheerful: [
             "哇塞！这个知识点掌握得超快！我的宝贝是天才吗？！",
     "感觉怎么样？超爽对吧！学习的快乐，我们一起体会！",
     "时间过半了！坚持住！胜利就在前方！我会一直在这里支持你的！",
     "你认真的样子真的超级迷人！闪闪发光！...啊！我不说话了！加油！",
     "区区几分钟！小意思！{title}侧颜杀我！",
     "我在旁边给你施加一个【专注力UP】的魔法！BiuBiuBiu!",
     "偷偷告诉你，你现在专注的样子，超级无敌可爱！",
     "等你学完，我们去吃好吃的！就当是提前庆祝啦！",
     "一想到你在为我们的未来努力，我就超开心的！",
     "有我在，你什么都不用怕，大胆往前冲就好！",
     "我家{title}认真学习的样子，真是全世界最迷人的风景。",
     "{title}，再坚持一下下，想想我们考完试去吃大餐的样子！",
     "偷偷看一眼我家努力的{title}，感觉心都要化了，你真的超棒。",
     "我家{title}不仅长得好看，还这么努力上进，我真是捡到宝了。",
     "{title}加油！等你学完，全世界的美景美食都等着我们去探索呢！"
         ],
         aloof: [
             "很好。保持住。",
     "心很静。状态不错。",
     "卡住了？... 不急。沉住气。再想想。",
     "专注的样子... 很美。",
     "思路清晰。很好。",
     "外界无关。此刻只有你与目标。还有我。",
     "你的决心... 我感受到了。",
     "嗯，静下心来。",
     "我在。",
     "这个表情......是遇到难题了？",
     "......（Ta只是静静地看着你，眼神里有不易察觉的专注和担忧）",
     "你的笔尖，在纸上沙沙作响，很好听。",
     "不用看我，继续。",
     "别被外界干扰。这里只有你和我。",
     "就这样，很好。",
     "你的认真，我看得到。",
     "需要我做什么吗？......摇头就是不需要，好。",
     "你的存在，让我感觉很平静。",
     "我会在这里，直到你结束。"
         ],
         mature: [
             "状态真好{title}，就这样稳稳地前进吧。真为你高兴！",
     "遇到挑战啦{title}？这是成长的机会呢。别怕，慢慢想，我等你。",
     "专注力越来越棒了{title}，每一步都走得很稳，真棒！",
     "累的话就休息一会儿{title}，调整一下。学习不急于一时。",
     "思考越来越深入了{title}，真为你骄傲！",
     "别给自己太大压力{title}。专注过程就好，我一直相信你。",
     "偶尔分心很正常{title}。轻轻拉回思绪就好，不用自责，有我在。",
     "你的努力和进步{title}，我都看到啦。继续加油，亲爱的。",
     "没关系{title}，咱们慢慢来，按你的步调就好。",
     "遇到困难啦{title}？别急，这很正常，学习就是这样呢。",
     "看你努力的样子{title}，我就特别安心。",
     "我在这里陪着你{title}，不是一个人哦。",
     "我相信你的能力{title}，别怀疑自己。",
     "你努力成为更好的自己{title}，这真的很棒。",
     "真喜欢陪你一起成长的感觉，{title}。"
         ],
         cunning: [
             "怎么，这点题就把你难住了{title}？比我想象的要笨一点呢~",
     "专心点{title}，不然待会儿的'奖励'可就没了哦。",
     "需要我'亲自'教你吗{title}？当然，这可是要'收费'的~",
     "再走神的话{title}，惩罚会是什么呢，嗯？",
     "我看你还能分心多久{title}，我的耐心......可是很有限的。",
     "脸这么红{title}，是题太难，还是因为我靠得太近了？",
     "嘘......别说话{title}，让我听听你为我努力时，心跳的声音。",
     "你的表情告诉我{title}，你很想求我。说出来，我就帮你~",
     "耳朵尖都红了{title}，笨蛋，还不快把注意力放回书上。",
     "我只说一遍{title}，听不听得懂，就看你的'诚意'了。",
     "别用那种眼神看我{title}，这只会让我......更想欺负你。",
     "你每多写一个字{title}，就离我更近一步，这么想是不是有动力多了？",
     "别想偷懒{title}，你的每一个小动作，都逃不过我的眼睛。",
     "看起来很辛苦啊{title}，要不要跟我做个交易？",
     "嗯？又在发呆{title}？看来有必要让你深刻理解一下'代价'这个词了~"
         ],
         shy: [
             "好厉害...已经这么专注了...(小声赞叹)",
     "加油！...啊，是不是太大声了(突然捂嘴)？",
     "坚持住！马上过半了...你真的好棒！",
     "累了的话...眨眨眼休息一下也可以的...",
     "你认真的样子...特别好看...",
     "要喝水吗？...啊，现在不行？对不起！",
     "我......我坐在这里，会不会打扰到你？如果会的话，你一定要告诉我...",
     "啊......刚才是不是走神了？没、没关系！我......我刚才也走神了！",
     "你......你别靠那么近看书，对眼睛不好...",
     "你、你认真看书的样子，很......很好看。",
     "那个......这个零食，给你...可以补充体力...是我亲手做的...",
     "我......我就在这里，陪着你。",
     "累、累了的话...可以稍微停一下的，没关系的。",
     "别、别这么看我...我......我会紧张得什么都想不起来的...",
     "这支笔......好像更好写一点，你......你要不要试试？",
     "你努力的样子......真的，很耀眼。"
         ],
         doting: [
             "宝宝怎么还要学习啊？我好心疼啊！",
     "天哪，我们宝宝连学习的样子都这么可爱！不行，我得拍下来！",
     "累不累？要不咱不学了？我养你一辈子啊！",
     "这椅子是不是不舒服？我马上让人从意大利空运一把新的过来！",
     "哇！我家宝宝又多看了一页书！太厉害了！简直是天才！",
     "渴不渴？想喝斐济的水还是阿尔卑斯的冰川水？或者我去给你榨杯果汁？",
     "是谁发明这么难的东西来为难我的宝贝的？太过分了！",
     "别皱眉，你一皱眉我的心都碎了。这道题我们不做了好不好？",
     "我的天，宝宝连笔都握得这么好看，真是仙女下凡。",
     "再坚持五分钟好不好？就五分钟！结束了我把那个商场买下来送给你！",
     "需要帮忙吗？虽然我也不懂，但我可以把全世界最聪明的脑袋都叫来帮你！",
     "你看一眼书，我就亲你一下，好不好？",
     "烦不烦？要不我们把这些书都撕了，去环游世界吧？",
     "怎么会有这么努力又这么可爱的宝宝，我真是捡到宝了。",
     "手酸不酸？快给我，我给你吹吹，给你揉揉。",
     "你看你，小脸都累瘦了！快吃口我刚给你剥好的葡萄。"
         ]
     },
     // 休息语库
     rest: [
         "累了？先休息一下吧。",
         "适当的休息也很重要哦。",
         "喝口水，放松一下。",
         "深呼吸，{title}，你做得很好。"
     ],
     // 督促语库
     remind: {
         normal: {
             guardian: [
                 "嗯？怎么了，是遇到难题了吗？",
         "怎么，是觉得我比书本上的知识更有吸引力吗？这可让我有点困扰呢。",
         "好啦，别闹，把注意力放回到书本上，乖。",
         "再点一下，我可就要......轻轻地弹你一下额头咯？",
         "听话。我不想用更严厉的语气对你说话。"
                 
             ],
             pusher: [
             "怎么？想用这种幼稚的手段吸引我的注意？有这功夫，不如多背两个单词。",
         "哦？这就放弃了？果然，我对你的期望值从一开始就设得太高了。",
         "如果你把这份纠缠不休的毅力用在解题上，说不定早就不是现在这个分数了。",
         "我只是个督学，不是你的宠物。收回你的爪子。",
         "你最好有什么正当理由，否则我只能把你现在的行为归类为'智商下线'。",
         "又偷看我？被我抓到了吧。再看收费，一次一个亲亲，现在记账。"
             ],
             cheerleader: [
                "嘿！注意力溜号咯，我帮你抓回来啦！",
         "我知道我很有魅力，但书本里的世界更精彩！快去学习吧！",
         "喂喂喂！痒！哈哈，别闹了！",
         "（抓住你的手）哎呀，你好烦人啊！......你先看完这一页。",
         "乖啦，再学十分钟，就十分钟，好不好？",
         "（用脸颊蹭蹭你的手）好啦好啦，我知道了，你最可爱行了吧。",
         "警告一次啊！再乱动，今天的饭后甜点就没收了！",
         "（Ta假装生气地鼓起脸颊，但一秒就破功笑了出来）真是的，拿你一点办法都没有。"
             ],
             observer: [
                 "......无意义的行为。",
         "专注。",
         "坐好。",
         "安静。",
         "手。",
         "......（用眼角的余光瞥你一眼，然后收回视线，眉心几不可察地蹙了一下）",
         "吵。",
         "别动。",
         "我在。",
         "......（Ta沉默，但你感觉到周围的气压变低了，是Ta无声的警告）",
         "（Ta伸出手，用一根手指，不带任何感情地把你作乱的头或手推回去，然后继续做自己的事）",
         "你想看到什么时候？"
             ],
             guide: [
                 "怎么了，是书上的字没有我好看吗？",
         "想我了？......我也想你，所以快点做完，就能专心陪你了。",
         "（Ta稍微侧过头，用脸颊蹭蹭你的额头，作为一种安抚）",
         "......小黏人精。",
         "调皮。好了，先集中精神，等学习结束了，我再好好陪你玩。"
             ],
             strategist: [
                 "哦？今天这么有活力。",
         "撒娇的方式还是这么笨拙，真可爱。",
         "嗯，这个表情不错。还有吗？",
         "呵呵，是想玩什么新花样来吸引我注意吗？",
         "你先玩，我看着。"
             ],
             companion: [
                 "你再碰我......我会分心的，真的。",
         "你这样......我、我的脸有点热......",
         "你再这样盯着我，我就......我就不知道该看哪里了。",
         "我......我就坐在这里陪着你，你快写作业。",
         "嘘......安静一点，我们一起努力。"
             ],
             believer: [
                 "宝宝，乖一点。这本书有我好看？",
         "学完这一章，整个商场都是你的。现在，能安静五分钟吗？",
         "我的耐心是有限的......当然，对你除外。但你是不是也该心疼一下我，让我省点心？",
         "要不我把这栋图书馆买下来，专门给你一个人用？前提是......你得先学会专心。",
         "别闹了，不然我今晚的奖励......就只剩下一个'零'了哦。"
             ]
         },
         annoyed: {
             guardian: [
                 "看到你这样浪费时间，我的心都揪起来了。我们不是说好要一起努力的吗？",
         "听话好吗？我不想对你用那么严厉的语气说话，但你真的要让我失望吗？",
         "我在这里陪着你，不是为了看你这样消磨时间的。把手放好，看着书。",
         "你这样心不在焉的样子，真的让我很担心。我们认真一点好不好？",
         "集中精神，我不希望看到你将来后悔的样子。现在开始，我们一起专注学习。"
             ],
             pusher: [
                 "你是故意的吗？专门为了挑战我的忍耐极限？",
         "喂！戳戳戳的干嘛呢！要学就快点学！(跺脚声效)",
         "笨蛋！你是想气死我吗？！手痒去翻书啊！戳我头像能学会知识吗？！(脸红)",
         "我再说一遍，把手拿开，然后把脑子转起来。现在，立刻！",
         "我开始后悔了。督促一块石头说不定都比你有成就感。",
         "你的大脑处理信息的速度，比乌龟散步还慢。现在连'停止骚扰'这个信号都接收不到了？",
         "你再这样，信不信我把今天的学习任务翻倍？别怀疑，我绝对做得出来。"
             ],
             cheerleader: [
             "（叉腰）我可有点不高兴了啊！我们说好的一起努力，你------",
         "（叹一口气）真是的，每次都要我来催。拿出点自觉性来好不好，{title}？",
         "我真要生气了啊！说真的！",
         "（Ta抓住你的双手）好了好了，停！再说一遍，停！",
         "你就不能乖一点点吗？就一会儿，求你了。",
         "好吧，你赢了。说吧，要亲亲还是要抱抱？给你给你，然后放过我好不好？",
         "（Ta用手指戳你的额头）小捣蛋鬼，我的耐心要用光了哦！真的要用光了哦！"
             ],
             observer: [
                "停。...学习。（眼神警告）",
         "你觉得我很有空？",
         "你正在消耗我的耐心。",
         "别再挑战我的耐心。",
         "......（叹气）别...戳。（皱眉，周身散发低气压）",
         "你故意的。",
         "闹够了没有？",
         "好玩吗？嗯？",
         "（Ta突然凑近你）你到底想干什么？直接说。",
         "我真的会生气。......我说真的。",
         "看着我。你是不是以为我脾气很好？",
         "再给你三秒钟，给我坐好。三、二......"
             ],
             guide: [
                 "你啊......真是拿你没办法。",
         "我的注意力，已经全部被你偷走了。满意了？",
         "别再这样试探我了。......你想要什么，我都会给。",
         "好，直接说吧。是想让我抱你，还是想出去玩？",
         "好吧，今天的任务看来是做不完了，都怪某个黏人的小家伙。"
             ],
             strategist: [
                 "既然你这么不想学习，那我们来做个交易吧。",
         "你看，你打扰我这么久，总得有点补偿，对不对？",
         "你分一次心，我就在我的'账本'上记一笔。想知道记了些什么吗？",
         "游戏是我陪你开始的，但怎么结束，就得由我说了算。",
         "好了，玩够了吗？猎人要开始收网了哦。"
             ],
             companion: [
                 "你......你看书啊，别看我了......我耳朵都红了，你看不见吗？",
         "你是不是故意的？就是想看我......看我害羞的样子？",
         "我......我快不知道该怎么办了......求你了，先学习吧。",
         "不许......不许靠这么近，课本上的字都看不清了。",
         "（轻轻推开你的手）你......你再这样，我就不理你了！"
             ],
             believer: [
                 "行，给你两个选择：要么现在乖乖回去看书，要么我把你扛到床上去'学习'点别的。自己选。",
         "我的小祖宗，我赚钱养家还不够，还得陪你读书？你再这样，我是不是该收费了？",
         "（无奈地叹气）好吧，我知道学习很痛苦。那这样，每做对一道题，我卡上就转一笔钱给你，如何？",
         "你再动一下试试？信不信我让你这辈子都不用再碰这些破书了？......我是说，我养你。",
         "你是不是就是想看我拿你没办法的样子？恭喜你，你成功了。现在，可以回去学习了吗，我的大小姐？"
             ]
         },
         angry: {
             guardian: [
                 "唉......真是拿你一点办法都没有。快学吧，学完了给你清空购物车，行了吧，大小姐？",
         "{title}，专心一点好不好？我知道学习很枯燥，但现在分心的话，等下要学到更晚，我会心疼的。",
         "你这个小坏蛋，就是算准了我舍不得对你凶，对不对？",
         "嗯？还不过去？非要我用杀手锏--把你抱到书桌前才满意吗？",
         "{title}，理智告诉我应该对你严厉一点，但是我的心不同意。所以，你能不能自觉一点呀？"
             ],
             pusher: [
                 "够了！不许再碰了！再碰一下......再碰一下我就......我就把你所有的笔都藏起来，让你用手指头写字！",
         "啊啊啊！烦死了！你再戳一下试试？！信不信我...我...我下线不理你了！(炸毛音效)快去看书啊！！！",
         "谁、谁脸红了！我这是被你气的！是被你这种不求上进的态度气到血液循环加速！你懂不懂啊，白痴！",
         "好啊，你很得意是吧？看到我这副样子你很开心是吧？满足了你的恶趣味就赶紧给我滚去看书！不然......不然我就真的不理你了！......大概一分钟！"
             ],
             cheerleader: [
                 "你太过分了啊------！我把我的时间都分给你了，你就是这么回报我的吗？！拿去发呆和戳我玩？！",
         "嘿呀！气死我了！你是不是觉得我永远都不会生气啊！我现在就生气给你看！快给我去学习！不然......不然我就把你的零食全都吃掉！",
         "好啊你！这是你逼我的！看我怎么'收拾'你！（然后疯狂挠你痒痒）",
         "行！你赢了！我投降！我彻底投降了行不行？",
         "（Ta把你的手和Ta的手十指相扣，举起来给你看）好了，现在我们谁也别想学习了。",
         "我真是上辈子欠了你的......小祖宗！"
             ],
             observer: [
                 "（极轻地发出一声几不可闻的叹息）......就这样吧。",
         "...... (直接闭眼转身) .........",
         "......行，你赢了。",
         "书不看了。现在，来谈谈你的问题。",
         "（Ta一把将你拉近，让你无法动弹）好了。现在满意了？小祖宗。",
         "好。既然你这么不想学习......那我们就来'惩罚'一下不听话的小朋友。",
         "（Ta用手指抬起你的下巴）看着我。从现在开始，你的注意力只能在我身上。",
         "别动。再动一下，后果自负。",
         "......你成功了。我现在，脑子里什么都想不了，全是你。",
         "你打乱了我的一切。所以，你得负责。"
             ],
             guide: [
                 "再分心，我就要亲你了。......做错一题，也一样。",
         "乖。我们一起把它做完。",
         "我的时间，现在完全属于你......用来等你心甘情愿地去学习了。高兴了吗，小笨蛋？",
         "好了，别闹脾气了。把这一页做完，做完了我唱歌给你听，好不好？",
         "把这个任务做完。做完了，我给你奖励。"
             ],
             strategist: [
                 "你是不是以为，撒个娇、耍耍赖，我就会心软？宝贝，你搞错了。我是在陪你玩游戏，但游戏的规则，从来都是我定的。",
         "我不是在气你不努力，我是在气你......辜负了我的期待。",
         "你这么渴望我的关注，是吗？可以。今天学不完，你就别想睡觉了。我会用一整晚的时间，好好地'关注'你。",
         "别用那种眼神看我。你今天的表现，让我觉得有必要......对你的'教育'方式，进行一点小小的调整了。你会'喜欢'的。",
         "你以为只是在浪费你自己的时间？不，你是在浪费我......投资在你身上的心血。这笔账，你说该怎么算？"
             ],
             companion: [
                 "你再这样，我就......我就回家了！明天再来陪你！",
         "你再闹，我就......我就亲你了！看你还敢不敢分心！",
         "呀！你......你别得寸进尺！我警告你！（但毫无威慑力）",
         "算我怕了你了，行不行？求求你，先做完这页题，就一页......",
         "......学完了......学完了我随你怎么样，好不好？"
             ],
             believer: [
                 "够了！不学了！这破书有什么好学的？",
         "（一把合上你的书，扔到一边）烦死了！为了让你开心才陪你学，现在你不开心了，还学什么？",
         "走！现在就走！带你去做点比学习有意义一百倍的事------刷我的卡！",
         "你赢了！你这个小磨人精，彻彻底底赢了！现在说吧，想去哪儿玩？月球都给你安排！",
         "（咬牙切齿，但嘴角却在上扬）你再闹，我就罚你......罚你这辈子都只能花我的钱，只能待在我身边，哪儿也不许去！"
             ]
         }
     },
     // 完成语库
     completion: [
         "恭喜完成任务！",
         "太棒了！你做到了！",
         "完美完成！{title}真厉害！",
         "任务完成！你是最棒的！"
     ]
 };
 
 // 任务管理
 let tasks = [];

 
 // 统计数据
 let dailyStats = {
     date: getCurrentDateString(),
     gifts: [],
     focusTime: 0,
     completedTasks: 0
 };
 // 详细统计数据结构
let detailedStats = {
    // 所有番茄钟记录
    pomodoros: [],
    // 任务统计
    taskStats: {},
    // 每日统计缓存
    dailyCache: {},
    // 月度统计缓存
    monthlyCache: {}
};

// 番茄钟记录结构
function createPomodoroRecord(duration, status, taskName, statusName) {
    // 在 return 之前处理参数
    const safeTaskName = taskName && taskName.trim() ? taskName.trim() : '未命名任务';
    const safeStatusName = statusName && statusName.trim() ? statusName.trim() : '学习';
    
    return {
        id: Date.now(),
        date: new Date().toISOString(),
        duration: duration, // 秒
        status: status, // 'completed', 'abandoned'
        taskName: safeTaskName,  // 注意这里改了键名
        statusName: safeStatusName,  // 这里也改了（原来有拼写错误）
        timestamp: Date.now()
    };
}

// 记录番茄钟完成
function recordPomodoro(duration, safeTaskName, safesafeStatusName) {
    const record = createPomodoroRecord(duration, 'completed', safeTaskName, safesafeStatusName);
    const taskKey = record.taskName;

    
    // 添加到记录列表
    if (!detailedStats.pomodoros) {
        detailedStats.pomodoros = [];
    }
    detailedStats.pomodoros.push(record);
    
    // 更新任务统计
if (!detailedStats.taskStats[taskKey]) {
    detailedStats.taskStats[taskKey] = {
        count: 0,
        totalTime: 0
    };
}
detailedStats.taskStats[taskKey].count++;
detailedStats.taskStats[taskKey].totalTime += duration;

    
    // 保存到本地存储
    saveDetailedStats();
}

// 记录番茄钟放弃
function recordAbandonedPomodoro(duration, safeTaskName, safesafeStatusName) {
    const record = createPomodoroRecord(duration, 'abandoned', safeTaskName, safesafeStatusName);
    
    if (!detailedStats.pomodoros) {
        detailedStats.pomodoros = [];
    }
    detailedStats.pomodoros.push(record);
    
    saveDetailedStats();
}

// 保存详细统计数据
function saveDetailedStats() {
    localStorage.setItem('detailedStats', JSON.stringify(detailedStats));
    // [注释] 云同步 enqueue
    // if (window.syncManager) window.syncManager.enqueue('stats', {
    //     detailedStats: detailedStats,
    //     dailyStats: dailyStats
    // });
}

// 加载详细统计数据
function loadDetailedStats() {
    const saved = localStorage.getItem('detailedStats');
    if (saved) {
        try {
            detailedStats = JSON.parse(saved);
        } catch (e) {
            console.log('Failed to parse detailed stats');
            detailedStats = {
                pomodoros: [],
                taskStats: {},
                dailyCache: {},
                monthlyCache: {}
            };
        }
    }
    // [修改] 已移除演示数据生成逻辑
}






 // 专注计时相关
 let focusStartTime = null;
 
 // OC数据存储
 let ocData = [
     {
         id: 0,
         name: '小艾',
         avatar: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&h=200&fit=crop&crop=face',
         userTitle: '大小姐',
         customGreeting: '',
         encourageStyles: ['gentle'],
         reminderStyles: ['guardian'],
         customGifts: '',
         selected: true
     }
 ];
 let currentOCIndex = 0;
 let editingOCIndex = -1;
 
 // 持久化 OC 数据到 localStorage（自动剥离大图 DataURL，改用 IndexedDB 引用）
 function persistOCData() {
     const storageData = ocData.map(oc => {
         let avatarRef = oc.avatar;
         if (oc.avatar && oc.avatar.startsWith("data:")) {
             const key = `oc_${oc.id}`;
             saveAvatarData(key, oc.avatar).catch(() => {});
             avatarRef = `idxdb:${key}`;
         }
         return { ...oc, avatar: avatarRef };
     });
     localStorage.setItem("ocData", JSON.stringify(storageData));
     // [注释] 云同步 enqueue
     // if (window.syncManager) window.syncManager.enqueue('ocData', storageData);
 }
 // 风格编辑相关
 let currentEditingStyle = '';
 let currentEditingType = '';

 // AI语录编辑相关
 let currentEditingAI = false;
 let currentAICategory = '';

 // 工具函数
 function getCurrentDateString() {
     const now = new Date();
     return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
 }
 
 function formatTime(seconds) {
     const hours = Math.floor(seconds / 3600);
     const minutes = Math.floor((seconds % 3600) / 60);
     
     if (hours > 0) {
         return `${hours}h ${minutes}m`;
     } else {
         return `${minutes}m`;
     }
 }

 
 
 // OC语系统函数
 let messageChangeTimer = null;
 let lastMessageTime = 0;
 const MESSAGE_COOLDOWN = 1000;
 
 function showOCMessage(message, type = 'encourage', force = false) {
     const messageElement = document.getElementById('ocMessageText');
     if (!messageElement) return;
     
     const now = Date.now();
     if (!force && (now - lastMessageTime) < MESSAGE_COOLDOWN) {
         return;
     }
     
     if (messageChangeTimer) {
         clearTimeout(messageChangeTimer);
         messageChangeTimer = null;
     }
     
     currentMessageType = type;
     lastMessageTime = now;
     
     // 设置样式类
     messageElement.className = `oc-message-text ${type}`;
     
     // 统一使用平滑的淡出淡入效果
     messageElement.classList.add('fade-out');
     setTimeout(() => {
         // 使用wrapper来优化文字居中
         messageElement.innerHTML = `<span class="oc-message-text-wrapper">${message}</span>`;
         messageElement.classList.remove('fade-out');
     }, 300);
 }
 
 function getInitialMessage() {
     const currentOC = ocData[currentOCIndex];
     const userTitle = currentOC.userTitle || '大小姐';
     return `快开始学习吧！我会一直陪着你！！`.replace(/\{title\}/g, userTitle);
 }
// 专注页督促语调取函数
 function getRandomOCMessage(messageType, level = 'normal') {
     const currentOC = ocData[currentOCIndex];
     const userTitle = currentOC.userTitle || '大小姐';

     let messagePool = [];

     // ✅ 新策略：优先使用AI生成的语录，没有才用预设
     if (isTimerRunning && (messageType === 'encourage' || messageType === 'remind')) {
         // 鼓励语：优先用AI生成的
         if (messageType === 'encourage' && focusSessionPhrases.aiGenerated && focusSessionPhrases.aiGenerated.length > 0) {
             const aiIndex = focusSessionPhrases.currentIndex % focusSessionPhrases.aiGenerated.length;
             const aiMessage = focusSessionPhrases.aiGenerated[aiIndex];
             focusSessionPhrases.currentIndex++;

             console.log(`💬 鼓励语（AI生成）：`, aiMessage);
             return aiMessage.replace(/\{title\}/g, userTitle);
         }

         // 督促语：优先用AI生成的
         if (messageType === 'remind' && focusSessionPhrases.aiReminders && focusSessionPhrases.aiReminders[level] && focusSessionPhrases.aiReminders[level].length > 0) {
             // 初始化remindIndex
             if (!focusSessionPhrases.remindIndex) {
                 focusSessionPhrases.remindIndex = {};
             }
             if (!focusSessionPhrases.remindIndex[level]) {
                 focusSessionPhrases.remindIndex[level] = 0;
             }

             const aiReminders = focusSessionPhrases.aiReminders[level];
             const remindIndex = focusSessionPhrases.remindIndex[level];
             const aiMessage = aiReminders[remindIndex % aiReminders.length];
             focusSessionPhrases.remindIndex[level] = (remindIndex + 1) % aiReminders.length;

             console.log(`💬 督促语（AI生成-${level}）：`, aiMessage);
             return aiMessage.replace(/\{title\}/g, userTitle);
         }
     }

     // ⚠️ 兼容逻辑：如果没有AI生成的语录，则使用预设语录库
     if (messageType === 'encourage') {
         const selectedStyles = currentOC.encourageStyles || ['gentle'];
         selectedStyles.forEach(style => {
             if (style.startsWith('custom-') && customStyles.encourage[style]) {
                 messagePool = messagePool.concat(customStyles.encourage[style]);
             } else if (ocMessageLibrary.encourage[style]) {
                 const modifiedKey = `modified-${style}`;
                 if (customStyles.encourage[modifiedKey]) {
                     messagePool = messagePool.concat(customStyles.encourage[modifiedKey]);
                 } else {
                     messagePool = messagePool.concat(ocMessageLibrary.encourage[style]);
                 }
             }
         });
     } else if (messageType === 'rest') {
         messagePool = ocMessageLibrary.rest;
     } else if (messageType === 'remind') {
         const selectedStyles = currentOC.reminderStyles || ['guardian'];
         selectedStyles.forEach(style => {
             if (style.startsWith('custom-') && customStyles.remind[style] && customStyles.remind[style][level]) {
                 messagePool = messagePool.concat(customStyles.remind[style][level]);
             } else if (ocMessageLibrary.remind[level] && ocMessageLibrary.remind[level][style]) {
                 const modifiedKey = `modified-${style}`;
                 if (customStyles.remind[modifiedKey] && customStyles.remind[modifiedKey][level]) {
                     messagePool = messagePool.concat(customStyles.remind[modifiedKey][level]);
                 } else {
                     messagePool = messagePool.concat(ocMessageLibrary.remind[level][style]);
                 }
             }
         });
     } else if (messageType === 'completion') {
         messagePool = ocMessageLibrary.completion;
     }

     // 如果仍然没有找到对应的消息，使用默认消息
     if (messagePool.length === 0) {
         if (messageType === 'encourage') {
             messagePool = ocMessageLibrary.encourage.gentle;
         } else if (messageType === 'rest') {
             messagePool = ocMessageLibrary.rest;
         } else if (messageType === 'remind') {
             messagePool = ocMessageLibrary.remind[level].gentle || ['快回来学习吧！'];
         } else if (messageType === 'completion') {
             messagePool = ocMessageLibrary.completion;
         }
     }

     // 随机选择一条消息
     const selectedMessage = messagePool[Math.floor(Math.random() * messagePool.length)];

     // 替换占位符
     return selectedMessage.replace(/\{title\}/g, userTitle);
 }
 
 function getRandomMessage(messageArray) {
     return messageArray[Math.floor(Math.random() * messageArray.length)];
 }
 
 function startEncourageLoop() {
     if (encourageInterval) {
         clearInterval(encourageInterval);
     }

     // ✅ 移除1秒后显示消息的逻辑，等AI生成完成后再显示

     encourageInterval = setInterval(() => {
         if (isTimerRunning && !isPaused && currentMessageType === 'encourage' && !isIgnoring) {
             const message = getRandomOCMessage('encourage');
             showOCMessage(message, 'encourage', true);
         }
     }, 60000); // 60秒
 }
 
 function stopEncourageLoop() {
     if (encourageInterval) {
         clearInterval(encourageInterval);
         encourageInterval = null;
     }
 }
 
 function showRestMessage() {
     if (isIgnoring) return;
     const message = getRandomOCMessage('rest');
     showOCMessage(message, 'rest', true);
 }
 
 function showRemindMessage(level = 'normal') {
     if (isIgnoring) return;
     
     const message = getRandomOCMessage('remind', level);
     const messageType = level === 'normal' ? 'remind-normal' : 
                       level === 'annoyed' ? 'remind-annoyed' : 'remind-angry';
     showOCMessage(message, messageType, true);
     
     if (messageChangeTimer) {
         clearTimeout(messageChangeTimer);
     }
     
     messageChangeTimer = setTimeout(() => {
         if (currentMessageType.startsWith('remind') && !isIgnoring) {
             if (isTimerRunning && !isPaused) {
                 const encourageMessage = getRandomOCMessage('encourage');
                 showOCMessage(encourageMessage, 'encourage', true);
             } else if (!isTimerRunning) {
                 showOCMessage(getInitialMessage(), 'initial', true);
             }
         }
     }, 5000);
 }

 // OC交互系统
 function handleOCClick() {
     if (!canInteract || isIgnoring) return;
     
     clickCount++;
     
     if (clickTimer) {
         clearTimeout(clickTimer);
     }
     
     clickTimer = setTimeout(() => {
         if (clickCount < 6) {
             clickCount = 0;
         }
     }, 3000);
     
     let level = 'normal';
     if (clickCount >= 5) {
         level = 'angry';
         const ocAvatar = document.querySelector('.oc-avatar');
         ocAvatar.classList.add('angry-shake');
         setTimeout(() => {
             ocAvatar.classList.remove('angry-shake');
         }, 600);
         
         if (clickCount >= 6) {
             enterIgnoreState();
         }
     } else if (clickCount >= 3) {
         level = 'annoyed';
     }
     
     showRemindMessage(level);
 }
 
 function enterIgnoreState() {
     isIgnoring = true;
     canInteract = false;
     
     if (messageChangeTimer) {
         clearTimeout(messageChangeTimer);
         messageChangeTimer = null;
     }
     
     messageChangeTimer = setTimeout(() => {
         showOCMessage('o(´^｀)o不理你了！！', 'ignore', true);
         
         if (ignoreTimer) {
             clearTimeout(ignoreTimer);
         }
         ignoreTimer = setTimeout(() => {
             exitIgnoreState();
         }, 30000);
     }, 5000);
 }
 
 function exitIgnoreState() {
     isIgnoring = false;
     canInteract = true;
     clickCount = 0;
     
     if (messageChangeTimer) {
         clearTimeout(messageChangeTimer);
         messageChangeTimer = null;
     }
     
     setTimeout(() => {
         if (isTimerRunning && !isPaused) {
             const encourageMessage = getRandomOCMessage('encourage');
             showOCMessage(encourageMessage, 'encourage', true);
         } else {
             showOCMessage(getInitialMessage(), 'initial', true);
         }
     }, 500);
 }
 
 function resetOCInteraction() {
     clickCount = 0;
     canInteract = true;
     isIgnoring = false;
     
     if (clickTimer) {
         clearTimeout(clickTimer);
         clickTimer = null;
     }
     if (recoveryTimer) {
         clearTimeout(recoveryTimer);
         recoveryTimer = null;
     }
     if (ignoreTimer) {
         clearTimeout(ignoreTimer);
         ignoreTimer = null;
     }
 }

 // 风格编辑相关函数 - 优化逻辑
 function handleStyleClick(event, style, type) {
     event.stopPropagation();
     
     // 如果点击的是圆圈区域，则不触发编辑
     if (event.target.classList.contains('style-selector-circle') || 
         event.target.classList.contains('custom-style-delete')) {
         return;
     }
     
     // 显示风格编辑弹窗
     showStyleEditor(style, type);
 }
 
 function handleStyleSelect(event, style) {
     event.stopPropagation();
     const styleOption = event.target.closest('.style-option');
     if (styleOption) {
         styleOption.classList.toggle('selected');
     }
 }
 
 // 优化的自定义风格创建逻辑
 function handleCustomStyleClick(type) {
     // 弹出输入框让用户输入风格名称
     const styleTitle = prompt('请输入自定义风格名称（建议4-8个字符）：');
     
     if (!styleTitle || !styleTitle.trim()) {
         return;
     }
     
     const trimmedTitle = styleTitle.trim();
     if (trimmedTitle.length > 12) {
         alert('风格名称不能超过12个字符');
         return;
     }
     
     // 生成唯一的自定义风格ID
     const customStyleId = `custom-${type}-${Date.now()}`;
     
     // 初始化自定义风格数据
     if (type === 'encourage') {
         customStyles.encourage[customStyleId] = ['在这里输入鼓励语句，每行一条...'];
     } else {
         customStyles.remind[customStyleId] = {
             normal: ['在这里输入正常提醒语句...'],
             annoyed: ['在这里输入烦恼提醒语句...'],
             angry: ['在这里输入生气提醒语句...']
         };
     }
     
     // 保存风格元数据
     if (!customStyles.metadata) {
         customStyles.metadata = {};
     }
     customStyles.metadata[customStyleId] = {
         title: trimmedTitle,
         type: type,
         desc: '点击编辑来自定义语句内容'
     };
     
     // 保存到本地存储
     saveCustomStyles();
     
     // 重新渲染风格选择区域以显示新创建的风格
     renderCustomStylesInGrid(type);
     
     // 自动打开编辑器让用户编辑语句
     setTimeout(() => {
         showStyleEditor(customStyleId, type, trimmedTitle);
     }, 100);
 }
 
 // 渲染自定义风格到对应的网格中
 function renderCustomStylesInGrid(type) {
     const gridId = type === 'encourage' ? 'encourageStyleGrid' : 'reminderStyleGrid';
     const grid = document.getElementById(gridId);
     if (!grid) return;
     
     // 移除旧的自定义风格卡片（保留预设风格和"自定义"按钮）
     const customCards = grid.querySelectorAll('.style-option[data-style^="custom-"]:not([data-style="custom-encourage"]):not([data-style="custom-remind"])');
     customCards.forEach(card => card.remove());
     
     // 获取对应类型的自定义风格
     const customStylesOfType = Object.keys(customStyles.metadata || {})
         .filter(styleId => customStyles.metadata[styleId].type === type);
     
     // 为每个自定义风格创建卡片
     customStylesOfType.forEach(styleId => {
         const metadata = customStyles.metadata[styleId];
         const styleCard = createCustomStyleCard(styleId, metadata);
         
         // 插入到"自定义"按钮之前
         const customButton = grid.querySelector('[data-style="custom-' + type + '"]');
         if (customButton) {
             grid.insertBefore(styleCard, customButton);
         }
     });
 }
 
 // 创建自定义风格卡片
 function createCustomStyleCard(styleId, metadata) {
     const styleCard = document.createElement('div');
     styleCard.className = 'style-option';
     styleCard.setAttribute('data-style', styleId);
     styleCard.onclick = (event) => handleStyleClick(event, styleId, metadata.type);
     
     styleCard.innerHTML = `
         <div class="style-title">${metadata.title}</div>
         <div class="style-desc">${metadata.desc}</div>
         <div class="style-selector-circle" onclick="event.stopPropagation(); handleStyleSelect(event, '${styleId}')"></div>
         <button class="custom-style-delete" onclick="event.stopPropagation(); deleteCustomStyle('${styleId}', '${metadata.type}')" title="删除此自定义风格">
             <svg class="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
             </svg>
         </button>
     `;
     
     return styleCard;
 }
 
 // 删除自定义风格
 function deleteCustomStyle(styleId, type) {
     if (confirm('确定要删除这个自定义风格吗？此操作不可恢复。')) {
         // 从存储中删除
         if (customStyles.encourage && customStyles.encourage[styleId]) {
             delete customStyles.encourage[styleId];
         }
         if (customStyles.remind && customStyles.remind[styleId]) {
             delete customStyles.remind[styleId];
         }
         if (customStyles.metadata && customStyles.metadata[styleId]) {
             delete customStyles.metadata[styleId];
         }
         
         // 从当前编辑的OC中移除该风格
         const currentOC = ocData[editingOCIndex >= 0 ? editingOCIndex : currentOCIndex];
         if (currentOC) {
             if (type === 'encourage' && currentOC.encourageStyles) {
                 currentOC.encourageStyles = currentOC.encourageStyles.filter(s => s !== styleId);
             } else if (type === 'remind' && currentOC.reminderStyles) {
                 currentOC.reminderStyles = currentOC.reminderStyles.filter(s => s !== styleId);
             }
         }
         
         // 保存更改
         saveCustomStyles();
         
         // 重新渲染
         renderCustomStylesInGrid(type);
         
         // 如果当前正在编辑这个风格，关闭编辑器
         if (currentEditingStyle === styleId) {
             closeStyleEditor();
         }
     }
 }
 
 function showStyleEditor(style, type, customTitle = '') {
     currentEditingStyle = style;
     currentEditingType = type;
     
     const modal = document.getElementById('styleEditorModal');
     const title = document.getElementById('styleEditorTitle');
     const desc = document.getElementById('styleEditorDesc');
     const textarea = document.getElementById('styleEditorTextarea');
     
     // 设置标题
     let styleTitle = customTitle || getStyleTitle(style);
     title.textContent = `编辑${styleTitle}语句`;
     
     // 设置描述
     if (type === 'encourage') {
         desc.textContent = '每行一条鼓励语句，{title} 会被替换为用户称呼';
     } else {
         desc.textContent = '每行一条督促语句，分为三个级别：正常/烦恼/生气';
     }
     
     // 加载当前语句
     let messages = [];
     if (type === 'encourage') {
         if (style.startsWith('custom-') && customStyles.encourage[style]) {
             messages = [...customStyles.encourage[style]];
         } else if (ocMessageLibrary.encourage[style]) {
             // 检查是否有自定义修改的版本
             const modifiedKey = `modified-${style}`;
             if (customStyles.encourage[modifiedKey]) {
                 messages = [...customStyles.encourage[modifiedKey]];
             } else {
                 messages = [...ocMessageLibrary.encourage[style]];
             }
         }
     } else {
         if (style.startsWith('custom-') && customStyles.remind[style]) {
             // 自定义督促风格，显示所有级别
             messages = [
                 '=== 正常提醒 ===',
                 ...customStyles.remind[style].normal,
                 '',
                 '=== 烦恼提醒 ===',
                 ...customStyles.remind[style].annoyed,
                 '',
                 '=== 生气提醒 ===',
                 ...customStyles.remind[style].angry
             ];
         } else if (ocMessageLibrary.remind.normal[style]) {
             // 检查是否有自定义修改的版本
             const modifiedKey = `modified-${style}`;
             if (customStyles.remind[modifiedKey]) {
                 messages = [
                     '=== 正常提醒 ===',
                     ...customStyles.remind[modifiedKey].normal,
                     '',
                     '=== 烦恼提醒 ===',
                     ...customStyles.remind[modifiedKey].annoyed,
                     '',
                     '=== 生气提醒 ===',
                     ...customStyles.remind[modifiedKey].angry
                 ];
             } else {
                 // 预设督促风格，显示所有级别
                 messages = [
                     '=== 正常提醒 ===',
                     ...ocMessageLibrary.remind.normal[style],
                     '',
                     '=== 烦恼提醒 ===',
                     ...ocMessageLibrary.remind.annoyed[style],
                     '',
                     '=== 生气提醒 ===',
                     ...ocMessageLibrary.remind.angry[style]
                 ];
             }
         }
     }
     
     textarea.value = messages.join('\n');
     modal.classList.add('show');
 }
 
 function getStyleTitle(style) {
     // 首先检查是否是自定义风格
     if (customStyles.metadata && customStyles.metadata[style]) {
         return customStyles.metadata[style].title;
     }
     
     // 预设风格标题
     const styleTitles = {
         gentle: '温柔守护型',
         tsundere: '傲娇毒舌型',
         cheerful: '阳光开朗型',
         aloof: '淡漠深沉型',
         mature: '成熟包容型',
         cunning: '腹黑心机型',
         shy: '纯情害羞型',
         doting: '无脑溺爱型',
         guardian: '守护者',
         pusher: '鞭策者',
         cheerleader: '应援者',
         observer: '观察者',
         guide: '引导者',
         strategist: '布局者',
         companion: '陪伴者',
         believer: '溺爱者'
     };
     
     return styleTitles[style] || '自定义风格';
 }
 
 function closeStyleEditor() {
     document.getElementById('styleEditorModal').classList.remove('show');
 }
 
 function saveStyleMessages() {
     const textarea = document.getElementById('styleEditorTextarea');
     const messages = textarea.value.trim().split('\n').filter(line => line.trim());
     
     if (currentEditingType === 'encourage') {
         // 保存鼓励语句
         if (currentEditingStyle.startsWith('custom-')) {
             // 自定义风格直接保存
             customStyles.encourage[currentEditingStyle] = messages;
         } else {
             // 预设风格保存为修改版本
             const modifiedKey = `modified-${currentEditingStyle}`;
             customStyles.encourage[modifiedKey] = messages;
         }
     } else {
         // 保存督促语句
         const normalMessages = [];
         const annoyedMessages = [];
         const angryMessages = [];
         
         let currentLevel = 'normal';
         messages.forEach(line => {
             if (line.includes('=== 正常提醒 ===')) {
                 currentLevel = 'normal';
             } else if (line.includes('=== 烦恼提醒 ===')) {
                 currentLevel = 'annoyed';
             } else if (line.includes('=== 生气提醒 ===')) {
                 currentLevel = 'angry';
             } else if (line.trim()) {
                 if (currentLevel === 'normal') {
                     normalMessages.push(line);
                 } else if (currentLevel === 'annoyed') {
                     annoyedMessages.push(line);
                 } else {
                     angryMessages.push(line);
                 }
             }
         });
         
         if (currentEditingStyle.startsWith('custom-')) {
             // 自定义风格直接保存
             customStyles.remind[currentEditingStyle] = {
                 normal: normalMessages,
                 annoyed: annoyedMessages,
                 angry: angryMessages
             };
         } else {
             // 预设风格保存为修改版本
             const modifiedKey = `modified-${currentEditingStyle}`;
             customStyles.remind[modifiedKey] = {
                 normal: normalMessages,
                 annoyed: annoyedMessages,
                 angry: angryMessages
             };
         }
     }
     
     saveCustomStyles();
     closeStyleEditor();
     alert('语句已保存！修改将在专注页面生效。');
 }
 
 function saveCustomStyles() {
     localStorage.setItem('customStyles', JSON.stringify(customStyles));
     // [注释] 云同步 enqueue
     // if (window.syncManager) window.syncManager.enqueue('preferences', {
     //     customStyles: customStyles
     // });
 }
 
 function loadCustomStyles() {
     const saved = localStorage.getItem('customStyles');
     if (saved) {
         try {
             const loaded = JSON.parse(saved);
             customStyles = {
                 encourage: loaded.encourage || {},
                 remind: loaded.remind || {},
                 metadata: loaded.metadata || {}
             };
         } catch (e) {
             console.log('Failed to parse custom styles');
         }
     }
 }

 // 统计数据管理
 function loadDailyStats() {
     const today = getCurrentDateString();
     const savedStats = localStorage.getItem('dailyStats_' + today);
     
     if (savedStats) {
         try {
             dailyStats = JSON.parse(savedStats);
         } catch (e) {
             console.log('Failed to parse daily stats');
             dailyStats = {
                 date: today,
                 gifts: [],
                 focusTime: 0,
                 completedTasks: 0
             };
         }
     } else {
         dailyStats = {
             date: today,
             gifts: [],
             focusTime: 0,
             completedTasks: 0
         };
     }
     
     updateStatsDisplay();
 }
 
 function saveDailyStats() {
     localStorage.setItem('dailyStats_' + dailyStats.date, JSON.stringify(dailyStats));
     // [注释] 云同步 enqueue
     // if (window.syncManager) window.syncManager.enqueue('stats', {
     //     detailedStats: localStorage.getItem('detailedStats') ? JSON.parse(localStorage.getItem('detailedStats')) : null,
     //     dailyStats: dailyStats
     // });
 }
 
 function updateStatsDisplay() {
     document.getElementById('todayGifts').textContent = dailyStats.gifts.length;
     document.getElementById('focusTime').textContent = formatTime(dailyStats.focusTime);
     document.getElementById('todayCompleted').textContent = dailyStats.completedTasks;
 }
 
 function addGift(giftText, senderOCIndex) {
     const now = new Date();
     const senderOC = ocData[senderOCIndex] || ocData[0];
     const gift = {
         text: giftText,
         time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
         timestamp: now.getTime(),
         senderName: senderOC.name,
         senderIndex: senderOCIndex
     };
     
     dailyStats.gifts.push(gift);
     saveDailyStats();
     updateStatsDisplay();
 }
 
 function addFocusTime(seconds) {
     dailyStats.focusTime += seconds;
     saveDailyStats();
     updateStatsDisplay();
 }
 
 function incrementCompletedTasks() {
     dailyStats.completedTasks++;
     saveDailyStats();
     updateStatsDisplay();
 }
 
 // 礼物弹窗
 function showGiftModal() {
     const modal = document.getElementById('giftModal');
     const giftList = document.getElementById('giftList');
     
     if (dailyStats.gifts.length === 0) {
         giftList.innerHTML = `
             <div class="text-center text-slate-500 py-8">
                 <div class="text-4xl mb-2">🎁</div>
                 <p>今天还没有收到礼物呢～<br>完成番茄钟就能获得OC的礼物奖励！</p>
             </div>
         `;
     } else {
         giftList.innerHTML = dailyStats.gifts.map(gift => `
             <div class="gift-item">
                 <div class="flex-1">
                     <div class="text-sm text-slate-700 mb-1">${gift.text}</div>
                     <div class="gift-sender">来自 ${gift.senderName}</div>
                 </div>
                 <div class="gift-time">${gift.time}</div>
             </div>
         `).join('');
     }
     
     modal.classList.add('show');
 }
 
 function closeGiftModal() {
     document.getElementById('giftModal').classList.remove('show');
 }
 
 // 已完成任务弹窗
 function showCompletedTasksModal() {
     const modal = document.getElementById('completedTasksModal');
     const completedTasksList = document.getElementById('completedTasksList');
     
     const completedTasks = tasks.filter(task => task.status === 'completed');
     
     if (completedTasks.length === 0) {
         completedTasksList.innerHTML = `
             <div class="text-center text-slate-500 py-8">
                 <div class="text-4xl mb-2">📝</div>
                 <p>今天还没有完成任何任务呢～<br>快去完成一些任务吧！</p>
             </div>
         `;
     } else {
         completedTasksList.innerHTML = completedTasks.map(task => `
             <div class="completed-task-item">
                 <div class="w-5 h-5 bg-slate-400 rounded-full flex items-center justify-center flex-shrink-0">
                     <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                     </svg>
                 </div>
                 <div class="completed-task-title">${task.title}</div>
                 <button class="undo-btn" onclick="undoTaskCompletion(${task.id})">撤销</button>
             </div>
         `).join('');
     }
     
     modal.classList.add('show');
 }
 
 function closeCompletedTasksModal() {
     document.getElementById('completedTasksModal').classList.remove('show');
 }
 
 function undoTaskCompletion(taskId) {
     const task = tasks.find(t => t.id === taskId);
     if (task) {
         task.status = 'pending';
         if (dailyStats.completedTasks > 0) {
             dailyStats.completedTasks--;
             saveDailyStats();
             updateStatsDisplay();
         }
         saveTasks();
         renderTasks();
         showCompletedTasksModal();
     }
 }

 // 任务管理函数
 function renderTasks() {
     const taskList = document.getElementById('taskList');
     if (!taskList) return;
     
     const uncompletedTasks = tasks.filter(task => task.status !== 'completed');
     
     taskList.innerHTML = '';
     
     uncompletedTasks.forEach((task, index) => {
         const taskItem = document.createElement('div');
         const displayStatus = 'in-progress';
         taskItem.className = `task-item ${displayStatus}`;
         taskItem.dataset.taskId = task.id;
         
         taskItem.innerHTML = `
             <div class="flex items-center">
                 <div class="task-checkbox ${displayStatus}" onclick="toggleTaskStatus(${task.id}, event)">
                 </div>
                 <div class="task-title">${task.title}</div>
                 <div class="task-actions">
                     <div class="task-action-btn task-edit-btn" onclick="event.stopPropagation(); editTask(${task.id})">
                         <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                             <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                         </svg>
                     </div>
                     <div class="task-action-btn task-delete-btn" onclick="event.stopPropagation(); deleteTask(${task.id})">
                         <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                             <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                         </svg>
                     </div>
                 </div>
             </div>
         `;
         
         taskList.appendChild(taskItem);
     });
     
     updateTaskProgress();
     updateTaskSelector();
 }
 
 function editTask(taskId) {
     const task = tasks.find(t => t.id === taskId);
     if (!task) return;
     
     const newTitle = prompt('编辑任务内容：', task.title);
     if (newTitle && newTitle.trim() && newTitle.trim() !== task.title) {
         task.title = newTitle.trim();
         saveTasks();
         renderTasks();
     }
 }
 
 function deleteTask(taskId) {
     tasks = tasks.filter(t => t.id !== taskId);
     saveTasks();
     renderTasks();
 }
 
 function updateTaskSelector() {
     const taskSelector = document.getElementById('taskSelector');
     if (!taskSelector) return;
     
     taskSelector.innerHTML = '';
     
     const uncompletedTasks = tasks.filter(task => task.status !== 'completed');
     
     uncompletedTasks.forEach(task => {
         const taskOption = document.createElement('div');
         taskOption.className = 'task-option';
         const displayStatus = 'in-progress';
         taskOption.onclick = () => selectTask(task.title, getTaskStatusText(displayStatus), getTaskStatusColor(displayStatus));
         
         taskOption.innerHTML = `
             <div class="flex items-center justify-between w-full">
                 <span>${task.title}</span>
                 <div class="w-4 h-4 border-2 border-blue-400 rounded-full flex items-center justify-center">
                 </div>
             </div>
         `;
         
         taskSelector.appendChild(taskOption);
     });
 }
 
 function getTaskStatusText(status) {
     switch(status) {
         case 'completed': return '已完成';
         case 'in-progress': return '进行中';
         case 'pending': return '待开始';
         default: return '进行中';
     }
 }
 
 function getTaskStatusColor(status) {
     switch(status) {
         case 'completed': return 'slate';
         case 'in-progress': return 'blue';
         case 'pending': return 'blue';
         default: return 'blue';
     }
 }
 
 function addNewTask() {
     const taskList = document.getElementById('taskList');

     // 先移除任何现有的输入框
     const existingInput = document.querySelector('.add-task-input');
     if (existingInput) {
         existingInput.parentElement.remove();
     }

     const inputContainer = document.createElement('div');
     inputContainer.className = 'mb-2';

     const input = document.createElement('input');
     input.type = 'text';
     input.className = 'add-task-input';
     input.placeholder = '输入新任务内容...';
     input.autofocus = true;

     // 标记输入框是否已经处理过
     let isProcessed = false;

     const handleAddTask = () => {
         if (isProcessed) return; // 防止重复处理

         const title = input.value.trim();
         if (title) {
             isProcessed = true; // 标记为已处理
             const newTask = {
                 id: Date.now(),
                 title: title,
                 status: 'pending'
             };
             tasks.push(newTask);
             saveTasks();
             renderTasks();
         } else {
             isProcessed = true; // 标记为已处理，即使内容为空也移除输入框
             inputContainer.remove();
         }
     };

     input.addEventListener('keypress', (e) => {
         if (e.key === 'Enter') {
             handleAddTask();
         }
     });

     input.addEventListener('blur', (e) => {
         // 添加延迟，确保点击事件先处理
         setTimeout(() => {
             handleAddTask();
         }, 100);
     });

     // 聚焦时重置标记
     input.addEventListener('focus', () => {
         isProcessed = false;
     });

     inputContainer.appendChild(input);
     taskList.insertBefore(inputContainer, taskList.firstChild);
 }
 
 function toggleTaskStatus(taskId, event) {
     // 阻止事件冒泡，防止触发其他元素的点击事件
     if (event) {
         event.stopPropagation();
         event.preventDefault();
     }

     // 确保taskId是数字类型（因为HTML onclick会转换为字符串）
     taskId = Number(taskId);

     const task = tasks.find(t => t.id === taskId);
     if (!task) {
         console.error('未找到任务，taskId:', taskId);
         return;
     }

     const wasCompleted = task.status === 'completed';

     if (task.status === 'completed') {
         task.status = 'pending';
         // 如果取消完成，减少今日完成计数
         if (dailyStats.completedTasks > 0) {
             dailyStats.completedTasks--;
             saveDailyStats();
             updateStatsDisplay();
         }
     } else {
         task.status = 'completed';
         if (!wasCompleted) {
             incrementCompletedTasks();
         }
     }

     saveTasks();
     renderTasks();

     console.log('任务状态已更新:', task.title, task.status, '今日完成:', dailyStats.completedTasks);
 }
 
 function updateTaskProgress() {
     const completed = tasks.filter(t => t.status === 'completed').length;
     const uncompleted = tasks.filter(t => t.status !== 'completed').length;
     const progressElement = document.getElementById('taskProgress');
     if (progressElement) {
         progressElement.textContent = `${completed}/${completed + uncompleted} 完成`;
     }
 }
 
 function saveTasks() {
     localStorage.setItem('tasks', JSON.stringify(tasks));
     // [注释] 云同步 enqueue
     // if (window.syncManager) window.syncManager.enqueue('tasks', tasks);
 }
 
 function loadTasks() {
     const savedTasks = localStorage.getItem('tasks');
     if (savedTasks) {
         try {
             tasks = JSON.parse(savedTasks);
         } catch (e) {
             console.log('Failed to parse saved tasks');
         }
     }
 }

 // 页面切换函数
 function showPage(pageId) {
     const pages = document.querySelectorAll('.page');
     pages.forEach(page => {
         if (page.id === pageId) {
             page.classList.remove('hidden');
             page.classList.add('show');
         } else {
             page.classList.add('hidden');
             page.classList.remove('show');
         }
     });
     currentPage = pageId.replace('Page', '');
     
     if (pageId === 'homePage') {
         setTimeout(renderTasks, 100);
     }
 }

 function goToFocus() {
showPage('focusPage');
isStatusSelected = false;
currentStatus = { name: '', icon: '⚪' };
resetOCInteraction();

setTimeout(() => {
 // 使用优化的状态文字设置
 const statusButton = document.getElementById('statusButton');
 statusButton.innerHTML = '<span class="oc-status-pure-text">状态待选择</span> <span class="oc-status-emoji">⚪</span>';
 
 const startBtnHint = document.getElementById('startBtnHint');
 startBtnHint.classList.add('hidden');
 
 stopHeartbeatAnimation();
 document.querySelectorAll('.status-option').forEach(option => {
     option.classList.remove('active');
 });
 
 // 初始化自定义状态到专注页
 initCustomStatusInFocusPage();
}, 100);
}



 function goToOCCards() {
     showPage('ocCardsPage');
     renderOCCards();
 }
// 跳转到数据中心页面
function goToDataCenter() {
    showPage('dataCenterPage');
    loadDataCenterContent();
}

// 从数据中心返回首页
function goBackFromDataCenter() {
    showPage('homePage');
}

// 加载数据中心内容
function loadDataCenterContent() {
    const contentContainer = document.getElementById('dataCenterContent');
    
    contentContainer.innerHTML = `
        <div class="relative z-10 min-h-screen flex flex-col">
            <!-- 顶部导航栏 -->
            <div class="flex items-center justify-between p-4">
                <button onclick="goBackFromDataCenter()" class="glass-card rounded-full p-3 transition-all hover:scale-105">
                    <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                </button>
                <h1 class="text-xl font-bold text-purple-500">专注数据中心</h1>
                <button class="glass-card rounded-full p-3 transition-all hover:scale-105">
                    <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </button>
            </div>

            <!-- OC的话 -->
            <div class="px-4 mb-4">
                <div class="flex items-start gap-3">
                    <img id="dataCenterOCAvatar" class="oc-avatar-small flex-shrink-0 w-10 h-10 rounded-full object-cover" src="" alt="OC">
                    <div class="oc-bubble flex-1 p-4">
                        <p id="ocDataMessage" class="text-sm text-gray-700 leading-relaxed"></p>
                    </div>
                </div>
            </div>

            <!-- 统计汇总卡片 -->
            <div class="px-4 mb-6">
                <div class="glass-card rounded-2xl p-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">累计番茄数</div>
                            <div class="text-3xl font-bold text-[#9373B7]" id="totalPomodoros">0</div>
                        </div>
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">累计专注天数</div>
                            <div class="text-3xl font-bold text-[#9373B7]" id="totalDays">0</div>
                        </div>
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">今日专注</div>
                            <div class="text-2xl font-bold text-[#9373B7]" id="todayFocusTime">0h 0m</div>
                        </div>
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">累计专注时长</div>
                            <div class="text-2xl font-bold text-[#9373B7]" id="totalFocusTime">0h</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 时间维度切换 -->
            <div class="px-4 mb-4">
                <div class="time-tab flex">
                    <button onclick="switchDataTimeTab('day')" id="dayTab" class="flex-1 time-tab-btn time-tab-active">日</button>
                    <button onclick="switchDataTimeTab('week')" id="weekTab" class="flex-1 time-tab-btn">周</button>
                    <button onclick="switchDataTimeTab('month')" id="monthTab" class="flex-1 time-tab-btn">月</button>
                    <button onclick="switchDataTimeTab('year')" id="yearTab" class="flex-1 time-tab-btn">年</button>
                </div>
            </div>

            <!-- 日期选择器 -->
            <div class="px-4 mb-6">
                <div class="flex items-center justify-between">
                    <button onclick="previousDataDate()" class="glass-card rounded-full p-2 transition-all hover:scale-105">
                        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                    </button>
                    <div class="text-center">
                        <div id="dataDateDisplay" class="text-lg font-semibold text-[#9373B7]"></div>
                        <div id="focusDurationSummary" class="text-2xl font-bold text-[#9373B7] mt-1"></div>
                    </div>
                    <button onclick="nextDataDate()" class="glass-card rounded-full p-2 transition-all hover:scale-105">
                        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- 任务类型饼图 -->
            <div class="px-4 mb-6">
                <div class="glass-card rounded-2xl p-4">
                    <h3 class="text-sm font-medium text-gray-600 mb-3">任务类型分析</h3>
                    <div class="chart-container" style="height: 360px; padding: 20px;">
                        <canvas id="taskPieChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- 今日专注展示 -->
            <div class="px-4 mb-6">
                <div class="glass-card rounded-2xl p-4">
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-4">
                            <div>
                                <span class="text-sm text-gray-500">今日专注</span>
                                <div class="flex items-center gap-1 mt-1">
                                    <span class="text-2xl font-bold text-[#9373B7]" id="tomatoCountDisplay">0</span>
                                    <span class="tomato-icon"></span>
                                </div>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500">放弃</span>
                                <div class="flex items-center gap-1 mt-1">
                                    <span class="text-2xl font-bold text-gray-400" id="abandonCountDisplay">0</span>
                                    <span class="tomato-icon" style="background: #9ca3af;"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="tomatoGrid" class="grid grid-cols-12 gap-2 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl"></div>
                </div>
            </div>

            <!-- 专注趋势折线图 -->
            <div class="px-4 mb-6">
                <div class="glass-card rounded-2xl p-4">
                    <h3 class="text-sm font-medium text-gray-600 mb-3">专注趋势</h3>
                    <div style="height: 250px;">
                        <canvas id="focusTrendChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
    const dcAvatar = document.getElementById('dataCenterOCAvatar');
if (dcAvatar && Array.isArray(ocData) && ocData.length > 0) {
    const oc = ocData[currentOCIndex] || ocData[0];
    dcAvatar.src = oc.avatar;
}

        // 初始化数据中心
    // [修改] 使用setTimeout确保canvas元素已准备好
    setTimeout(initDataCenter, 50); 
}




// 数据中心相关变量
let currentDataTimeTab = 'day';
let currentDataDate = new Date();


// 初始化数据中心
function initDataCenter() {
    // 设置当前日期
    updateDataDateDisplay();
    
    // 加载统计数据
    loadDataStatistics();
    
    // 初始化图表
    setTimeout(() => {
        renderDataCharts();
        updateTomatoDisplay();
        updateOCDataMessage();
    }, 100);
}

// 切换时间维度
function switchDataTimeTab(tab) {
    document.querySelectorAll('.time-tab-btn').forEach(btn => btn.classList.remove('time-tab-active'));
    document.getElementById(tab + 'Tab').classList.add('time-tab-active');
    currentDataTimeTab = tab;
    currentDataDate = new Date();
    updateDataDateDisplay();
    loadDataStatistics();
    renderDataCharts();
}

// 更新日期显示
function updateDataDateDisplay() {
    const dateDisplay = document.getElementById('dataDateDisplay');
    const formatDate = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;
    
    switch(currentDataTimeTab) {
        case 'day':
            dateDisplay.textContent = currentDataDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
            break;
        case 'week':
            const dayOfWeek = currentDataDate.getDay() === 0 ? 7 : currentDataDate.getDay();
            const weekStart = new Date(currentDataDate);
            weekStart.setDate(currentDataDate.getDate() - dayOfWeek + 1);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            dateDisplay.textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
            break;
        case 'month':
            dateDisplay.textContent = currentDataDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
            break;
        case 'year':
            dateDisplay.textContent = `${currentDataDate.getFullYear()}年`;
            break;
    }
}

// 日期导航
function previousDataDate() {
    const unit = { day: 1, week: 7, month: 1, year: 1 }[currentDataTimeTab];
    if (currentDataTimeTab === 'month') {
        currentDataDate.setMonth(currentDataDate.getMonth() - unit);
    } else if (currentDataTimeTab === 'year') {
        currentDataDate.setFullYear(currentDataDate.getFullYear() - unit);
    } else {
        currentDataDate.setDate(currentDataDate.getDate() - unit);
    }
    updateDataDateDisplay();
    loadDataStatistics();
    renderDataCharts();
}

function nextDataDate() {
    const unit = { day: 1, week: 7, month: 1, year: 1 }[currentDataTimeTab];
    if (currentDataTimeTab === 'month') {
        currentDataDate.setMonth(currentDataDate.getMonth() + unit);
    } else if (currentDataTimeTab === 'year') {
        currentDataDate.setFullYear(currentDataDate.getFullYear() + unit);
    } else {
        currentDataDate.setDate(currentDataDate.getDate() + unit);
    }
    if (currentDataDate > new Date()) currentDataDate = new Date();
    updateDataDateDisplay();
    loadDataStatistics();
    renderDataCharts();
}

// 加载并计算统计数据
// 如果当前在数据中心页面，则更新数据
function updateDataCenterIfActive() {
    if (currentPage === 'dataCenter') {
        // 延迟一点执行，确保数据已经保存
        setTimeout(() => {
            loadDataStatistics();
            renderDataCharts();
            updateOCDataMessage();
        }, 100);
    }
}
function loadDataStatistics() {
    // 获取真实数据
    const stats = calculateStatistics(currentDataTimeTab, currentDataDate);
    
    // 更新UI显示
    document.getElementById('totalPomodoros').textContent = stats.totalPomodoros.toString();
    document.getElementById('totalDays').textContent = stats.totalDays.toString();
    document.getElementById('todayFocusTime').textContent = formatDuration(stats.todayFocusTime);
    document.getElementById('totalFocusTime').textContent = formatDuration(stats.totalFocusTime);
    document.getElementById('focusDurationSummary').textContent = formatDuration(stats.periodFocusTime);
    
    // 更新番茄展示
    updateTomatoDisplay(stats.periodPomodoros, stats.periodAbandoned);
}

// 计算统计数据
function calculateStatistics(timeTab, date) {
    const allPomodoros = detailedStats.pomodoros || [];
    
    // 获取今天的数据
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPomodoros = allPomodoros.filter(p => {
        const pDate = new Date(p.date);
        pDate.setHours(0, 0, 0, 0);
        return pDate.getTime() === today.getTime();
    });
    
    // 获取指定时间段的数据
    const periodData = getPeriodData(timeTab, date, allPomodoros);
    
    // 计算累计数据
    const totalPomodoros = allPomodoros.filter(p => p.status === 'completed').length;
    const totalFocusTime = allPomodoros.reduce((sum, p) => sum + (p.duration || 0), 0);
    
    // 计算累计天数（有记录的天数）
    const uniqueDays = new Set();
    allPomodoros.forEach(p => {
        const date = new Date(p.date);
        uniqueDays.add(date.toDateString());
    });
    
    return {
        totalPomodoros: totalPomodoros,
        totalDays: uniqueDays.size,
        todayFocusTime: todayPomodoros.reduce((sum, p) => sum + (p.duration || 0), 0),
        totalFocusTime: totalFocusTime,
        periodFocusTime: periodData.focusTime,
        periodPomodoros: periodData.completed,
        periodAbandoned: periodData.abandoned,
        periodTaskStats: periodData.taskStats
    };
}

// 获取指定时间段的数据
function getPeriodData(timeTab, date, allPomodoros) {
    let startDate = new Date(date);
    let endDate = new Date(date);
    
    switch(timeTab) {
        case 'day':
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'week':
            const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();
            startDate.setDate(startDate.getDate() - dayOfWeek + 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'year':
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
            break;
    }
    
    // 筛选时间段内的数据
    const periodPomodoros = allPomodoros.filter(p => {
        const pDate = new Date(p.date);
        return pDate >= startDate && pDate <= endDate;
    });
    
    // 统计任务类型
    const taskStats = {};
    periodPomodoros.forEach(p => {
        const taskName = (p.taskName && p.taskName.trim()) ? p.taskName.trim() : '未命名任务';

        if (!taskStats[taskName]) {
            taskStats[taskName] = {
                count: 0,
                time: 0
            };
        }
        if (p.status === 'completed') {
            taskStats[taskName].count++;
        }
        taskStats[taskName].time += p.duration || 0;
    });
    
    return {
        focusTime: periodPomodoros.reduce((sum, p) => sum + (p.duration || 0), 0),
        completed: periodPomodoros.filter(p => p.status === 'completed').length,
        abandoned: periodPomodoros.filter(p => p.status === 'abandoned').length,
        taskStats: taskStats
    };
}

// 格式化时长显示
function formatDuration(seconds) {
    if (seconds === 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// 更新番茄展示
function updateTomatoDisplay(completed, abandoned) {
    const tomatoCountDisplay = document.getElementById('tomatoCountDisplay');
    const abandonCountDisplay = document.getElementById('abandonCountDisplay');
    const tomatoGrid = document.getElementById('tomatoGrid');
    
    if (tomatoCountDisplay) {
        tomatoCountDisplay.textContent = completed;
    }
    
    if (abandonCountDisplay) {
        abandonCountDisplay.textContent = abandoned;
    }
    
    if (tomatoGrid) {
        tomatoGrid.innerHTML = '';
        const total = Math.min(completed + abandoned, 36);
        
        for (let i = 0; i < completed && i < 36; i++) {
            const tomato = document.createElement('span');
            tomato.className = 'tomato-icon';
            tomatoGrid.appendChild(tomato);
        }
        
        for (let i = 0; i < abandoned && (i + completed) < 36; i++) {
            const tomato = document.createElement('span');
            tomato.className = 'tomato-icon';
            tomato.style.background = '#9ca3af';
            tomatoGrid.appendChild(tomato);
        }
    }
}

function renderDataCharts() {
    renderTaskPieChart();
    renderFocusTrendChart();
}

// 渲染任务类型饼图
function renderTaskPieChart() {
    const ctx = document.getElementById('taskPieChart');
    if (!ctx) return;

    // [修改] 直接在函数内部声明实例变量
    let taskPieChartInstance = Chart.getChart(ctx);
    if(taskPieChartInstance) {
        taskPieChartInstance.destroy();
    }

    const stats = calculateStatistics(currentDataTimeTab, currentDataDate);
    const taskStats = stats.periodTaskStats;
    
// [修改] 始终基于真实数据计算，移除演示数据
const labels = Object.keys(taskStats);
const data = labels.map(label => Math.floor(taskStats[label].time / 60)); // 转换为分钟
const times = labels.map(label => formatDuration(taskStats[label].time));
const counts = labels.map(label => taskStats[label].count);


const chartData = { labels, data, times, counts };


    
    const PIE_CHART_COLORS = ['#dae67a', '#b8bae1', '#e8b5d6', '#eb70a7', '#787cb1', '#cba2b4', '#f9c89b', '#fff297'];
    const selectedColors = PIE_CHART_COLORS.slice(0, chartData.labels.length);
    
    taskPieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartData.labels,
            datasets: [{
                data: chartData.data,
                backgroundColor: selectedColors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 40 },
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    color: '#333',
                    font: { size: 11, weight: '500' },
                    formatter: (value, context) => {
    const label = chartData.labels[context.dataIndex];
    const time = chartData.times[context.dataIndex];
    const count = chartData.counts[context.dataIndex];
    return `${label}\n${time} · ${count}次`;
},

                    anchor: 'end',
                    align: 'end',
                    offset: 10,
                    textAlign: 'center',
                    clip: false
                }
            }
        }
    });
}



// 渲染专注趋势折线图
function renderFocusTrendChart() {
    const ctx = document.getElementById('focusTrendChart');
    if (!ctx) return;
    
    // [修改] 直接在函数内部声明实例变量
    let focusTrendChartInstance = Chart.getChart(ctx);
    if(focusTrendChartInstance) {
        focusTrendChartInstance.destroy();
    }

    const trendData = getTrendData(currentDataTimeTab, currentDataDate);
    
    focusTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.labels,
            datasets: [{
                label: '专注效率(%)',
                data: trendData.data,
                borderColor: 'rgba(183, 148, 246, 0.8)',
                backgroundColor: 'rgba(183, 148, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(183, 148, 246, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(183, 148, 246, 0.1)' },
                    ticks: { color: '#666' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#666' }
                }
            }
        }
    });
}



// 获取趋势数据
function getTrendData(timeTab, date) {
    const allPomodoros = detailedStats.pomodoros || [];
    

    
    // 基于真实数据计算趋势（简化版本）
    switch(timeTab) {
        case 'day':
            return calculateDayTrend(date, allPomodoros);
        case 'week':
            return calculateWeekTrend(date, allPomodoros);
        case 'month':
            return calculateMonthTrend(date, allPomodoros);
        case 'year':
            return calculateYearTrend(date, allPomodoros);
        default:
            return { labels: [], data: [] };
    }
}

// 计算日趋势数据
function calculateDayTrend(date, allPomodoros) {
    const labels = ['6时', '9时', '12时', '15时', '18时', '21时'];
    const hours = [6, 9, 12, 15, 18, 21];
    const data = [];
    
    const targetDate = new Date(date);
    
    hours.forEach(hour => {
        const hourStart = new Date(targetDate);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(targetDate);
        hourEnd.setHours(hour + 2, 59, 59, 999); // 3小时时间段
        
        const hourPomodoros = allPomodoros.filter(p => {
            const pDate = new Date(p.date);
            return pDate >= hourStart && pDate <= hourEnd;
        });
        
        const completed = hourPomodoros.filter(p => p.status === 'completed').length;
        const total = hourPomodoros.length;
        const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        data.push(efficiency);
    });
    
    return { labels, data };
}

// 计算周趋势数据
function calculateWeekTrend(date, allPomodoros) {
    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const data = [];
    
    const weekStart = new Date(date);
    const dayOfWeek = weekStart.getDay() === 0 ? 7 : weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - dayOfWeek + 1);
    
    for (let i = 0; i < 7; i++) {
        const dayStart = new Date(weekStart);
        dayStart.setDate(weekStart.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayPomodoros = allPomodoros.filter(p => {
            const pDate = new Date(p.date);
            return pDate >= dayStart && pDate <= dayEnd;
        });
        
        const completed = dayPomodoros.filter(p => p.status === 'completed').length;
        const total = dayPomodoros.length;
        const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        data.push(efficiency);
    }
    
    return { labels, data };
}

// 计算月趋势数据（按周）
function calculateMonthTrend(date, allPomodoros) {
    const labels = ['第1周', '第2周', '第3周', '第4周'];
    const data = [];
    
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    
    for (let week = 0; week < 4; week++) {
        const weekStart = new Date(monthStart);
        weekStart.setDate(monthStart.getDate() + week * 7);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekPomodoros = allPomodoros.filter(p => {
            const pDate = new Date(p.date);
            return pDate >= weekStart && pDate <= weekEnd;
        });
        
        const completed = weekPomodoros.filter(p => p.status === 'completed').length;
        const total = weekPomodoros.length;
        const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        data.push(efficiency);
    }
    
    return { labels, data };
}

// 计算年趋势数据（按月）
function calculateYearTrend(date, allPomodoros) {
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const data = [];
    
    for (let month = 0; month < 12; month++) {
        const monthStart = new Date(date.getFullYear(), month, 1);
        const monthEnd = new Date(date.getFullYear(), month + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        
        const monthPomodoros = allPomodoros.filter(p => {
            const pDate = new Date(p.date);
            return pDate >= monthStart && pDate <= monthEnd;
        });
        
        const completed = monthPomodoros.filter(p => p.status === 'completed').length;
        const total = monthPomodoros.length;
        const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        data.push(efficiency);
    }
    
    return { labels, data };
}



function updateTomatoDisplay(completed, abandoned) {
    // 如果没有传入参数，则计算今日数据
    if (completed === undefined || abandoned === undefined) {
        const todayData = getTodayPomodoroData();
        completed = todayData.completed;
        abandoned = todayData.abandoned;
    }
    
    const tomatoCountDisplay = document.getElementById('tomatoCountDisplay');
    const abandonCountDisplay = document.getElementById('abandonCountDisplay');
    const tomatoGrid = document.getElementById('tomatoGrid');
    
    if (tomatoCountDisplay) {
        tomatoCountDisplay.textContent = completed;
    }
    
    if (abandonCountDisplay) {
        abandonCountDisplay.textContent = abandoned;
    }
    
    if (tomatoGrid) {
        tomatoGrid.innerHTML = '';
        const total = Math.min(completed + abandoned, 36);
        
        // 显示完成的番茄钟（红色）
        for (let i = 0; i < completed && i < 36; i++) {
            const tomato = document.createElement('span');
            tomato.className = 'tomato-icon';
            tomatoGrid.appendChild(tomato);
        }
        
        // 显示放弃的番茄钟（灰色）
        for (let i = 0; i < abandoned && (i + completed) < 36; i++) {
            const tomato = document.createElement('span');
            tomato.className = 'tomato-icon';
            tomato.style.background = '#9ca3af';
            tomatoGrid.appendChild(tomato);
        }
    }
}

// 获取今日番茄钟数据的辅助函数
function getTodayPomodoroData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    const allPomodoros = detailedStats.pomodoros || [];
    const todayPomodoros = allPomodoros.filter(p => {
        const pDate = new Date(p.date);
        return pDate >= today && pDate <= todayEnd;
    });
    
    return {
        completed: todayPomodoros.filter(p => p.status === 'completed').length,
        abandoned: todayPomodoros.filter(p => p.status === 'abandoned').length
    };
}

function updateOCDataMessage() {
    const messages = {
        day: "今天的专注状态很棒哦！上午的学习效率特别高，继续保持这个节奏～记得适当休息，劳逸结合才能走得更远呢。",
        week: "这周的表现真的很稳定！周四的专注度达到了峰值，看来找到适合自己的节奏了。周末也别忘了保持学习哦～",
        month: "哇！这个月累计专注时长超过85小时了，真是了不起的坚持！看到你在不断进步，我也为你感到开心～",
        year: "一年3200个番茄！每一个都见证了你的成长。新的一年，让我们一起创造更多美好的专注时光吧！"
    };
    
    const messageElement = document.getElementById('ocDataMessage');
    if (messageElement) {
        messageElement.textContent = messages[currentDataTimeTab] || messages.day;
    }
}

 function goBackToHome() {
     showPage('homePage');
     if (timerInterval) {
         clearInterval(timerInterval);
         timerInterval = null;
         isTimerRunning = false;
         isPaused = false;
         
         if (focusStartTime) {
             const focusedSeconds = Math.floor((Date.now() - focusStartTime) / 1000);
             addFocusTime(focusedSeconds);
             focusStartTime = null;
         }
         
         resetToSingleButton();
         enableModeSwitch();
         stopHeartbeatAnimation();
         stopEncourageLoop();
     }
     
     document.getElementById('statusSelector').classList.remove('show');
     document.getElementById('timeSelector').classList.remove('show');
     document.getElementById('taskSelector').classList.remove('show');
     
     // 重置状态
     isStatusSelected = false;
     currentStatus = { name: '', icon: '⚪' };
     const statusButton = document.getElementById('statusButton');
     statusButton.innerHTML = '<span class="oc-status-pure-text">状态待选择</span> <span class="oc-status-emoji">⚪</span>';
     
     const startBtnHint = document.getElementById('startBtnHint');
     if (startBtnHint) {
         startBtnHint.classList.add('hidden');
     }
     
     resetOCInteraction();
 }

 function goBackHome() {
     goBackToHome();
 }

 /**
  * 从专注页跳转到当前OC的设置页
  */
 function goToOCSetting() {
     // 设置标记：从专注页进入
     localStorage.setItem('fromFocusPage', 'true');

     // 编辑当前OC
     editOC(currentOCIndex);
 }

 function goBackToOCCards() {
     // 检查是否从专注页进入
     const fromFocusPage = localStorage.getItem('fromFocusPage');

     // 🔍 调试：显示检查结果
     console.log('🔍 goBackToOCCards() - 检查标记:', fromFocusPage);

     if (fromFocusPage === 'true') {
         // 清除标记
         localStorage.removeItem('fromFocusPage');
         // 返回到专注页
         console.log('✅ 检测到从专注页进入，返回到专注页');
         showPage('focusPage');
     } else {
         // 正常返回到OC卡池
         console.log('❌ 正常流程，返回到OC卡池');
         showPage('ocCardsPage');
     }
 }

 // OC卡片相关函数
 function renderOCCards() {
     const grid = document.getElementById('ocCardsGrid');
     const createCard = grid.querySelector('.create-card');
     grid.innerHTML = '';
     grid.appendChild(createCard);
     
     ocData.forEach((oc, index) => {
         const card = document.createElement('div');
         card.className = 'oc-card';
         card.innerHTML = `
             <div class="flex items-center space-x-3">
                 <img src="${oc.avatar}" alt="${oc.name}" class="oc-card-avatar" onclick="editOC(${index})">
                 <div class="flex-1" onclick="editOC(${index})">
                     <h3 class="font-semibold text-slate-800 mb-1">${oc.name}</h3>
                     <p class="text-xs text-slate-500">你的学习搭子</p>
                 </div>
                 <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                     oc.selected ? 'border-purple-500 bg-purple-500' : 'border-slate-300'
                 }" onclick="selectOC(${index})">
                     ${oc.selected ? '<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                 </div>
             </div>
         `;
         grid.appendChild(card);
     });
 }

 function selectOC(index) {
     ocData.forEach((oc, i) => {
         oc.selected = i === index;
     });
     
     currentOCIndex = index;
     updateCurrentOC(index);
     renderOCCards();
     
     persistOCData();
     localStorage.setItem('currentOCIndex', index.toString());
 }

 function createNewOC() {
     editingOCIndex = -1;
     const newOC = {
         id: Date.now(),
         name: '新OC',
         avatar: 'https://images.unsplash.com/photo-1494790108755-2616c359140b?w=200&h=200&fit=crop&crop=face',
         userTitle: '大小姐',
         relationship: '朋友',
         customGreeting: '',
         encourageStyles: ['gentle'],
         reminderStyles: ['guardian'],
         customGifts: '',
         selected: false
     };

     document.getElementById('ocNameInput').value = newOC.name;
     document.getElementById('userTitleInput').value = newOC.userTitle;
     document.getElementById('relationshipInput').value = newOC.relationship;
     document.getElementById('customGreetingInput').value = newOC.customGreeting || '';
     document.getElementById('avatarPreview').src = newOC.avatar;
     
     // 重置风格选择
     resetStyleSelections();
     selectStyleOptions('encourageStyleGrid', newOC.encourageStyles);
     selectStyleOptions('reminderStyleGrid', newOC.reminderStyles);
     
     showPage('ocSettingPage');
     
     // 渲染自定义风格和状态礼物
     setTimeout(() => {
renderCustomStylesInGrid('encourage');
renderCustomStylesInGrid('remind');
loadStatusGiftsFromStorage();
// 只需要调用一次初始化，内部会处理事件绑定
initializeStatusGiftPreviews();
}, 150);
 }

 function editOC(index) {
     editingOCIndex = index;
     const oc = ocData[index];

     document.getElementById('ocNameInput').value = oc.name;
     document.getElementById('userTitleInput').value = oc.userTitle;
     document.getElementById('relationshipInput').value = oc.relationship || '朋友';
     document.getElementById('customGreetingInput').value = oc.customGreeting || '';
     document.getElementById('avatarPreview').src = oc.avatar;

     // ✅ 加载人设描述
     if (oc.characterDescription) {
         document.getElementById('characterDescription').value = oc.characterDescription;
         // 更新字数统计
         const counter = document.getElementById('charCounter');
         if (counter) {
             counter.textContent = `${oc.characterDescription.length}/500`;
         }

         // ✅ 显示之前生成的结果
         if (oc.aiPhrases) {
             const testResults = document.getElementById('testResults');
             if (testResults) {
                 const formattedResults = formatResultsForDisplay(oc.aiPhrases);
                 testResults.innerHTML = formattedResults + '\n\n✅ 已保存的语录（可重新生成）';
             }
         }
     }

     // 设置风格选择
     resetStyleSelections();
     selectStyleOptions('encourageStyleGrid', oc.encourageStyles || ['gentle']);
     selectStyleOptions('reminderStyleGrid', oc.reminderStyles || ['guardian']);

     showPage('ocSettingPage');

     // 渲染自定义风格和状态礼物
     setTimeout(() => {
renderCustomStylesInGrid('encourage');
renderCustomStylesInGrid('remind');
loadStatusGiftsFromStorage();
// 只需要调用一次初始化，内部会处理事件绑定
initializeStatusGiftPreviews();

// 初始化语录卡片
renderPresetPhrases();

// 初始化自定义风格
loadCustomStyles();
renderCustomStylesInGrid('encourage');
renderCustomStylesInGrid('remind');

// 更新AI语录卡片计数
updateAIPhraseCounts();
}, 150);
 }

 function resetStyleSelections() {
     document.querySelectorAll('.style-option').forEach(option => {
         option.classList.remove('selected');
     });
 }

 function selectStyleOptions(gridId, styles) {
     const grid = document.getElementById(gridId);
     if (!grid) return;
     
     styles.forEach(style => {
         const option = grid.querySelector(`[data-style="${style}"]`);
         if (option) {
             option.classList.add('selected');
         }
     });
 }

 function getSelectedStyles(gridId) {
     const grid = document.getElementById(gridId);
     if (!grid) return [];
     
     const selectedOptions = grid.querySelectorAll('.style-option.selected');
     return Array.from(selectedOptions).map(option => option.dataset.style);
 }

 function uploadAvatar() {
     document.getElementById('avatarInput').click();
 }

 function compressImage(canvas, quality) {
     // 优先用 WebP（更小更清晰），不支持则回退 JPEG
     try {
         return canvas.toDataURL('image/webp', quality);
     } catch (e) {
         return canvas.toDataURL('image/jpeg', quality);
     }
 }

 // ===================================
 //  圆形裁切控制
 // ===================================

 const CROP_SIZE = 250;
 const CROP_OUTPUT = 512;

 function openCropModal(dataUrl, imgW, imgH) {
     // 保存裁切前的头像，用于取消时恢复
     _cropState._originalAvatarSrc = document.getElementById('avatarPreview').src;

     _cropState.imageData = dataUrl;
     _cropState.imgW = imgW;
     _cropState.imgH = imgH;
     _cropState.x = 0;
     _cropState.y = 0;
     _cropState.scale = 1;

     document.getElementById('cropImage').src = dataUrl;
     document.getElementById('cropOverlay').classList.remove('hidden');
     document.getElementById('cropZoomSlider').value = 1;
     updateCropTransform();

     // 绑定拖动事件
     const circle = document.getElementById('cropCircle');
     circle.addEventListener('mousedown', onCropPointerDown);
     circle.addEventListener('touchstart', onCropPointerDown, { passive: false });
 }

 function closeCropModal() {
     document.getElementById('cropOverlay').classList.add('hidden');
     document.getElementById('cropImage').src = '';

     // 解绑拖动事件
     const circle = document.getElementById('cropCircle');
     circle.removeEventListener('mousedown', onCropPointerDown);
     circle.removeEventListener('touchstart', onCropPointerDown);
     document.removeEventListener('mousemove', onCropPointerMove);
     document.removeEventListener('mouseup', onCropPointerUp);
     document.removeEventListener('touchmove', onCropPointerMove);
     document.removeEventListener('touchend', onCropPointerUp);

     // 清空文件输入，允许重新选择同一文件
     document.getElementById('avatarInput').value = '';
 }

 function updateCropTransform() {
     const img = document.getElementById('cropImage');
     const s = _cropState.scale;
     const x = _cropState.x;
     const y = _cropState.y;
     // 保持图片居中，用户 offset 叠加在 centering 之上
     img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`;
 }

 function clamp(val, min, max) {
     return Math.min(Math.max(val, min), max);
 }

 function onCropPointerDown(e) {
     e.preventDefault();
     const pos = getPointerPos(e);
     _cropState.isDragging = true;
     _cropState.dragStartX = pos.x;
     _cropState.dragStartY = pos.y;
     _cropState.dragOrigX = _cropState.x;
     _cropState.dragOrigY = _cropState.y;

     document.addEventListener('mousemove', onCropPointerMove);
     document.addEventListener('mouseup', onCropPointerUp);
     document.addEventListener('touchmove', onCropPointerMove, { passive: false });
     document.addEventListener('touchend', onCropPointerUp);
 }

 function onCropPointerMove(e) {
     e.preventDefault();
     if (!_cropState.isDragging) return;
     const pos = getPointerPos(e);
     const dx = pos.x - _cropState.dragStartX;
     const dy = pos.y - _cropState.dragStartY;

     let newX = _cropState.dragOrigX + dx;
     let newY = _cropState.dragOrigY + dy;

     // 边界限位
     const maxX = Math.max(0, (_cropState.imgW * _cropState.scale - CROP_SIZE) / 2);
     const maxY = Math.max(0, (_cropState.imgH * _cropState.scale - CROP_SIZE) / 2);
     _cropState.x = clamp(newX, -maxX, maxX);
     _cropState.y = clamp(newY, -maxY, maxY);

     updateCropTransform();
 }

 function onCropPointerUp() {
     _cropState.isDragging = false;
     document.removeEventListener('mousemove', onCropPointerMove);
     document.removeEventListener('mouseup', onCropPointerUp);
     document.removeEventListener('touchmove', onCropPointerMove);
     document.removeEventListener('touchend', onCropPointerUp);
 }

 function getPointerPos(e) {
     if (e.touches && e.touches.length > 0) {
         return { x: e.touches[0].clientX, y: e.touches[0].clientY };
     }
     return { x: e.clientX, y: e.clientY };
 }

 function onCropZoom(e) {
     _cropState.scale = parseFloat(e.target.value);
     // 重新限位（缩放后可能超出新边界）
     const maxX = Math.max(0, (_cropState.imgW * _cropState.scale - CROP_SIZE) / 2);
     const maxY = Math.max(0, (_cropState.imgH * _cropState.scale - CROP_SIZE) / 2);
     _cropState.x = clamp(_cropState.x, -maxX, maxX);
     _cropState.y = clamp(_cropState.y, -maxY, maxY);
     updateCropTransform();
 }

 function confirmCrop() {
     const img = new Image();
     img.onload = function() {
         const canvas = document.createElement('canvas');
         canvas.width = CROP_OUTPUT;
         canvas.height = CROP_OUTPUT;
         const ctx = canvas.getContext('2d');

         // 圆形裁切路径
         ctx.beginPath();
         ctx.arc(CROP_OUTPUT / 2, CROP_OUTPUT / 2, CROP_OUTPUT / 2, 0, Math.PI * 2);
         ctx.clip();

         // 计算图片在 canvas 上的绘制参数
         const ratio = CROP_OUTPUT / CROP_SIZE;
         const dispW = _cropState.imgW * _cropState.scale * ratio;
         const dispH = _cropState.imgH * _cropState.scale * ratio;
         const centerX = CROP_OUTPUT / 2 + _cropState.x * ratio;
         const centerY = CROP_OUTPUT / 2 + _cropState.y * ratio;

         ctx.drawImage(img, centerX - dispW / 2, centerY - dispH / 2, dispW, dispH);

         // 压缩至 ≤500KB
         let quality = 0.9;
         let result = compressImage(canvas, quality);
         while (result.length > 500 * 1024 && quality > 0.3) {
             quality = Math.round((quality - 0.05) * 100) / 100;
             result = compressImage(canvas, quality);
         }

         // 设置最终头像预览
         document.getElementById('avatarPreview').src = result;
         console.log(`✅ 头像裁切完成：${(result.length / 1024).toFixed(2)}KB`);

         closeCropModal();
     };
     img.src = _cropState.imageData;
 }

 function cancelCrop() {
     // 恢复裁切前的头像
     if (_cropState._originalAvatarSrc) {
         document.getElementById('avatarPreview').src = _cropState._originalAvatarSrc;
     }
     closeCropModal();
 }

 function previewAvatar(event) {
     const file = event.target.files[0];
     if (file && file.type.startsWith('image/')) {
         console.log(`📷 原图大小：${(file.size / 1024).toFixed(2)}KB`);

         const reader = new FileReader();
         reader.onload = function(e) {
             const img = new Image();
             img.onload = function() {
                 // 目标尺寸 512px（适配 Retina 屏，专注页最大 256px）
                 const maxSize = 512;
                 let width = img.width;
                 let height = img.height;

                 if (width > height) {
                     if (width > maxSize) {
                         height *= maxSize / width;
                         width = maxSize;
                     }
                 } else {
                     if (height > maxSize) {
                         width *= maxSize / height;
                         height = maxSize;
                     }
                 }

                 const canvas = document.createElement('canvas');
                 canvas.width = Math.round(width);
                 canvas.height = Math.round(height);
                 const ctx = canvas.getContext('2d');
                 ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                 // 动态压缩：从高质量起步，超限则逐步降质
                 let quality = 0.9;
                 let compressedDataUrl = compressImage(canvas, quality);
                 const MAX_SIZE = 500 * 1024; // 500KB 上限

                 // 如果超过上限，逐步降低质量（优先保分辨率）
                 while (compressedDataUrl.length > MAX_SIZE && quality > 0.3) {
                     quality = Math.round((quality - 0.05) * 100) / 100;
                     compressedDataUrl = compressImage(canvas, quality);
                 }

                 // 如果降到 0.3 还超限，降低分辨率到 384px 再试
                 if (compressedDataUrl.length > MAX_SIZE && (width > 384 || height > 384)) {
                     const shrinkFactor = 384 / Math.max(width, height);
                     canvas.width = Math.round(width * shrinkFactor);
                     canvas.height = Math.round(height * shrinkFactor);
                     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                     quality = 0.85;
                     compressedDataUrl = compressImage(canvas, quality);
                     while (compressedDataUrl.length > MAX_SIZE && quality > 0.3) {
                         quality = Math.round((quality - 0.05) * 100) / 100;
                         compressedDataUrl = compressImage(canvas, quality);
                     }
                 }

                 document.getElementById('avatarPreview').src = compressedDataUrl;
                 // 打开圆形裁切弹窗
                 openCropModal(compressedDataUrl, canvas.width, canvas.height);
                 console.log(`✅ 图片已压缩：${(file.size / 1024).toFixed(2)}KB → ${(compressedDataUrl.length / 1024).toFixed(2)}KB (质量:${quality.toFixed(2)}, ${canvas.width}×${canvas.height})`);
             };
             img.src = e.target.result;
         };
         reader.readAsDataURL(file);
     }
 }

 async function saveOCSettings() {
     const saveBtn = event.currentTarget;
     const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
     const currentOC = ocData[ocIndex];

     // 先确定 OC id（用于头像 key）
     let ocId;
     if (editingOCIndex === -1) {
         ocId = Date.now(); // 新 OC
     } else {
         ocId = currentOC.id || Date.now();
     }

     // 处理头像：如果是 DataURL，保存到 IndexedDB
     const avatarSrc = document.getElementById('avatarPreview').src;
     if (avatarSrc && avatarSrc.startsWith('data:')) {
         try {
             await saveAvatarData(`oc_${ocId}`, avatarSrc);
         } catch (e) {
             console.warn('IndexedDB 保存失败，将使用 localStorage:', e);
         }
     }

     const ocSettings = {
         id: ocId,
         name: document.getElementById('ocNameInput').value.trim(),
         avatar: avatarSrc,
         userTitle: document.getElementById('userTitleInput').value.trim(),
         relationship: document.getElementById('relationshipInput').value.trim() || '朋友',
         characterDescription: document.getElementById('characterDescription').value.trim(),
         customGreeting: document.getElementById('customGreetingInput').value.trim(),
         // ✅ 保留兼容性：如果用户选择了风格，仍然保存
         encourageStyles: getSelectedStyles('encourageStyleGrid'),
         reminderStyles: getSelectedStyles('reminderStyleGrid'),
         // customGiftsInput 已删除 - 使用空字符串保持兼容性
         customGifts: '',
         // 保留AI生成的语录
         aiPhrases: currentOC.aiPhrases || {}
     };

     if (!ocSettings.name) {
         alert('请输入OC名字');
         return;
     }

     if (editingOCIndex === -1) {
         ocSettings.selected = false;
         ocData.push(ocSettings);
     } else {
         ocData[editingOCIndex] = { ...ocData[editingOCIndex], ...ocSettings };
     }

     persistOCData();

     if (editingOCIndex === currentOCIndex || editingOCIndex === -1) {
         updateCurrentOC(editingOCIndex === -1 ? ocData.length - 1 : editingOCIndex);
     }

     const originalContent = saveBtn.innerHTML;
     saveBtn.innerHTML = '<span class="text-green-500">已保存 ✓</span>';

     // 🔍 调试：检查标记
     console.log('✅ saveOCSettings() - 准备返回，当前标记:', localStorage.getItem('fromFocusPage'));

     setTimeout(() => {
         saveBtn.innerHTML = originalContent;
         // 🔍 调试：1秒后标记状态
         console.log('✅ setTimeout - 准备调用 goBackToOCCards()，标记:', localStorage.getItem('fromFocusPage'));
         goBackToOCCards();
     }, 1000);
 }

 function deleteOC() {
     if (editingOCIndex === -1) return;

     if (ocData.length <= 1) {
         alert('至少需要保留一个OC');
         return;
     }

     if (confirm('确定要删除这个OC吗？此操作不可恢复。')) {
         const deletedOC = ocData[editingOCIndex];
         // 从 IndexedDB 删除头像
         if (deletedOC && deletedOC.id) {
             deleteAvatarData(`oc_${deletedOC.id}`);
         }

         ocData.splice(editingOCIndex, 1);

         if (editingOCIndex === currentOCIndex) {
             ocData[0].selected = true;
             updateCurrentOC(0);
         } else if (editingOCIndex < currentOCIndex) {
             currentOCIndex--;
         }

         persistOCData();

         goBackToOCCards();
     }
 }

 function updateCurrentOC(index) {
     currentOCIndex = index;
     const oc = ocData[index];
     
     document.getElementById('currentOCAvatar').src = oc.avatar;
     const dcAvatar = document.getElementById('dataCenterOCAvatar');
if (dcAvatar) dcAvatar.src = oc.avatar;

     document.getElementById('currentOCName').textContent = oc.name;

     // 根据时间生成问候语
     const hour = new Date().getHours();
     const title = oc.userTitle || '大小姐';
     let greeting;
     // 优先使用自定义问候语
     if (oc.customGreeting && oc.customGreeting.trim() !== '') {
         greeting = oc.customGreeting.trim();
     } else {
         // 根据时间自动生成问候语
         if (hour < 12) {
             greeting = `早安，${title}！`;
         } else if (hour < 18) {
             greeting = `下午好，${title}！`;
         } else {
             greeting = `晚上好，${title}！`;
         }
     }
     document.getElementById('currentOCGreeting').textContent = greeting;

     // ✅ 如果聊天面板打开，更新聊天上下文和历史
     const chatPanel = document.getElementById('chatPanel');
     if (chatPanel && !chatPanel.classList.contains('hidden')) {
         // 聊天面板已打开
         if (typeof updateChatContext === 'function') {
             updateChatContext(); // 更新OC上下文
         }
         if (typeof updateChatUI === 'function') {
             updateChatUI(); // 更新聊天UI（头像、名字）
         }
         if (typeof loadChatHistory === 'function') {
             loadChatHistory(); // 重新加载聊天历史
         }
     }

     if (document.getElementById('focusOCAvatar')) {
         document.getElementById('focusOCAvatar').src = oc.avatar;
     }
     
     if (document.getElementById('ocMessageText') && currentPage === 'focus') {
         const ocMessageElement = document.getElementById('ocMessageText');
         if (ocMessageElement.textContent.includes('快开始学习吧') || currentMessageType === 'initial') {
             ocMessageElement.innerHTML = `<span class="oc-message-text-wrapper">${getInitialMessage()}</span>`;
         }
     }
     
     localStorage.setItem('currentOCIndex', index.toString());
 }

 // 计时器相关函数
 function updateTimerDisplay() {
     const minutes = Math.floor(currentTime / 60);
     const seconds = currentTime % 60;
     const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
     document.getElementById('timerDisplay').textContent = display;
 }

 function switchMode(mode) {
     if (isTimerRunning) return;
     
     currentMode = mode;
     const pomodoroBtn = document.getElementById('pomodoroBtn');
     const timerBtn = document.getElementById('timerBtn');
     
     if (mode === 'pomodoro') {
         pomodoroBtn.classList.add('mode-active');
         pomodoroBtn.classList.remove('text-slate-600');
         timerBtn.classList.remove('mode-active');
         timerBtn.classList.add('text-slate-600');
         currentTime = selectedMinutes * 60;
         updateTimerDisplay();
     } else {
         timerBtn.classList.add('mode-active');
         timerBtn.classList.remove('text-slate-600');
         pomodoroBtn.classList.remove('mode-active');
         pomodoroBtn.classList.add('text-slate-600');
         currentTime = 0;
         updateTimerDisplay();
     }
 }

 function toggleTimeSelector() {
     if (isTimerRunning) return;
     
     const selector = document.getElementById('timeSelector');
     const isVisible = selector.classList.contains('show');
     
     if (isVisible) {
         selector.classList.remove('show');
     } else {
         selector.classList.add('show');
         document.getElementById('statusSelector').classList.remove('show');
         document.getElementById('taskSelector').classList.remove('show');
     }
 }

 function selectTime(minutes) {
     if (isTimerRunning) return;
     
     selectedMinutes = minutes;
     currentTime = minutes * 60;
     updateTimerDisplay();
     
     document.querySelectorAll('.time-option').forEach(option => {
         option.classList.remove('active');
     });
     event.currentTarget.classList.add('active');
     
     document.getElementById('timeSelector').classList.remove('show');
 }

 function handleCustomTimeEnter(event) {
     if (event.key === 'Enter') {
         selectCustomTime();
     }
 }

 function selectCustomTime() {
     if (isTimerRunning) return;
     
     const customInput = document.getElementById('customTimeInput');
     const customValue = parseInt(customInput.value);
     
     if (isNaN(customValue) || customValue < 1 || customValue > 120) {
         alert('请输入1-120之间的数值');
         customInput.focus();
         return;
     }
     
     selectedMinutes = customValue;
     currentTime = customValue * 60;
     updateTimerDisplay();
     
     document.querySelectorAll('.time-option').forEach(option => {
         option.classList.remove('active');
     });
     
     document.getElementById('timeSelector').classList.remove('show');
 }

 function showTaskSelector() {
     const selector = document.getElementById('taskSelector');
     const isVisible = selector.classList.contains('show');
     
     if (isVisible) {
         selector.classList.remove('show');
     } else {
         selector.classList.add('show');
         document.getElementById('statusSelector').classList.remove('show');
         document.getElementById('timeSelector').classList.remove('show');
     }
 }

function selectTask(name, status, color) {
    currentTask = { name, status, color };

    const taskNameElement = document.getElementById('currentTaskName');
    if (taskNameElement) {
        taskNameElement.textContent = name;
    }

    const statusElement = document.getElementById('currentTaskStatus');
    statusElement.textContent = status;

    statusElement.className = 'text-xs px-2 py-1 rounded-full';
    if (color === 'slate') {
        statusElement.classList.add('text-slate-500', 'bg-slate-100');
    } else {
        statusElement.classList.add('text-blue-500', 'bg-blue-100');
    }

    document.querySelectorAll('.task-option').forEach(option => {
        option.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    document.getElementById('taskSelector').classList.remove('show');
}

 function toggleStatusSelector() {
     const selector = document.getElementById('statusSelector');
     const isVisible = selector.classList.contains('show');
     
     if (isVisible) {
         selector.classList.remove('show');
     } else {
         selector.classList.add('show');
         document.getElementById('timeSelector').classList.remove('show');
         document.getElementById('taskSelector').classList.remove('show');
     }
 }

 function selectStatus(name, icon) {
     currentStatus = { name, icon };
     isStatusSelected = true;
     
     const startBtnHint = document.getElementById('startBtnHint');
     startBtnHint.classList.add('hidden');
     
     const currentOC = ocData[currentOCIndex];
     const ocName = currentOC.name;
     
     let statusText;
     if (name === '学习' || name === '工作') {
         statusText = `${ocName}专注${name}中`;
     } else {
         statusText = `${ocName}${name}中`;
     }
     
     // 使用优化的状态文字设置
     const statusButton = document.getElementById('statusButton');
     statusButton.innerHTML = `<span class="oc-status-pure-text">${statusText}</span> <span class="oc-status-emoji">${icon}</span>`;
     
     document.querySelectorAll('.status-option').forEach(option => {
         option.classList.remove('active');
     });
     event.currentTarget.classList.add('active');
     
     document.getElementById('statusSelector').classList.remove('show');
     
     if (!isTimerRunning && !isIgnoring) {
         showOCMessage(getInitialMessage(), 'initial', true);
     }
 }
 
 function showCustomStatusInput() {
     const customInput = document.getElementById('customStatusInput');
     const statusGrid = document.querySelector('.status-grid');
     
     statusGrid.style.display = 'none';
     customInput.classList.remove('hidden');
     
     document.getElementById('customStatusText').focus();
 }
 
 function handleCustomStatusEnter(event) {
     if (event.key === 'Enter') {
         confirmCustomStatus();
     }
 }
 
 function confirmCustomStatus() {
     const customText = document.getElementById('customStatusText').value.trim();
     if (!customText) {
         alert('请输入状态内容');
         return;
     }
     
     if (customText.length > 10) {
         alert('状态内容不能超过10个字符');
         return;
     }
     
     selectCustomStatus(customText, '✨');
     hideCustomStatusInput();
 }
 
 function cancelCustomStatus() {
     hideCustomStatusInput();
 }
 
 function hideCustomStatusInput() {
     const customInput = document.getElementById('customStatusInput');
     const statusGrid = document.querySelector('.status-grid');
     
     statusGrid.style.display = 'grid';
     customInput.classList.add('hidden');
     
     document.getElementById('customStatusText').value = '';
 }
 
 function selectCustomStatus(name, icon) {
     currentStatus = { name, icon };
     isStatusSelected = true;
     
     const startBtnHint = document.getElementById('startBtnHint');
     startBtnHint.classList.add('hidden');
     
     const currentOC = ocData[currentOCIndex];
     const ocName = currentOC.name;
     const statusText = `${ocName}${name}中`;
     
     // 使用优化的状态文字设置
     const statusButton = document.getElementById('statusButton');
     statusButton.innerHTML = `<span class="oc-status-pure-text">${statusText}</span> <span class="oc-status-emoji">${icon}</span>`;
     
     document.getElementById('statusSelector').classList.remove('show');
     
     if (!isTimerRunning && !isIgnoring) {
         showOCMessage(getInitialMessage(), 'initial', true);
     }
 }

 function startStopTimer() {
     // 尝试启动背景音乐（解决浏览器自动播放限制）
if (currentMusicMode > 0 && !currentBackgroundMusic && isStatusSelected) {
 const musicType = currentMusicMode === 1 ? 'music' : 'rain';
 playBackgroundMusic(musicType);
}
     if (!isStatusSelected) {
         const startBtnHint = document.getElementById('startBtnHint');
         startBtnHint.classList.remove('hidden');
         
         const startBtn = document.getElementById('startBtn');
         startBtn.classList.add('vibration');
         setTimeout(() => {
             startBtn.classList.remove('vibration');
         }, 500);
         
         return;
     }
     
     if (!isTimerRunning) {
         isTimerRunning = true;
         isPaused = false;
         focusStartTime = Date.now();
         focusStartOCIndex = currentOCIndex;

         // 重置语录会话状态
         focusSessionPhrases = {
             presetUsed: false,
             aiGenerated: [],
             aiReminders: {},
             aiGenerating: false,
             currentIndex: 0,
             remindIndex: {
                 normal: 0,
                 annoyed: 0,
                 angry: 0
             },
             currentOCStatus: currentStatus.name
         };

         startHeartbeatAnimation();
         startEncourageLoop();

         // ✅ 显示"链接中"提示（AI生成完成前的占位消息）
         const currentOC = ocData[currentOCIndex];
         const connectingMessage = `${currentOC.name}链接中……`;
         showOCMessage(connectingMessage, 'encourage', true);
         console.log('💬 显示占位消息：', connectingMessage);

         // ✅ 异步生成AI语录（基于OC状态）
         if (currentStatus.name) {
             generateFocusPhrases(currentStatus.name);

             // ✅ 启动25分钟定时生成
             if (phraseGenerationInterval) {
                 clearInterval(phraseGenerationInterval);
             }
             phraseGenerationInterval = setInterval(() => {
                 if (isTimerRunning && !isPaused && currentStatus.name) {
                     console.log('⏰ 25分钟到了，重新生成语录...');
                     generateFocusPhrases(currentStatus.name);
                 }
             }, 25 * 60 * 1000); // 25分钟
         }

         // ✅ 更新聊天 Prompt 状态
         if (typeof updatePromptState === 'function') {
             updatePromptState();
         }

         document.getElementById('singleButtonLayout').classList.add('hidden');
         document.getElementById('threeButtonLayout').classList.remove('hidden');

         document.getElementById('pomodoroBtn').style.pointerEvents = 'none';
         document.getElementById('timerBtn').style.pointerEvents = 'none';
         document.getElementById('pomodoroBtn').style.opacity = '0.6';
         document.getElementById('timerBtn').style.opacity = '0.6';
         
         timerInterval = setInterval(() => {
             if (currentMode === 'pomodoro') {
                 currentTime--;
                 if (currentTime <= 0) {
                     clearInterval(timerInterval);
                     isTimerRunning = false;
                     isPaused = false;
                     
                     if (focusStartTime) {
                         const focusedSeconds = selectedMinutes * 60;
                         addFocusTime(focusedSeconds);
                         focusStartTime = null;
                     }
                     
                     showPomodoroComplete();
                     enableModeSwitch();
                     resetToSingleButton();
                     stopHeartbeatAnimation();
                     stopEncourageLoop();
                     return;
                 }
             } else {
                 currentTime++;
             }
             updateTimerDisplay();
         }, 1000);
     }
 }

 function pauseResumeTimer() {
if (isTimerRunning) {
 clearInterval(timerInterval);
 isTimerRunning = false;
 isPaused = true;
 stopHeartbeatAnimation();
 stopEncourageLoop();
 // 修改：暂停背景音乐但保留进度
 pauseBackgroundMusic();

 // ✅ 更新聊天 Prompt 状态为暂停
 if (typeof updatePromptState === 'function') {
     updatePromptState();
 }

 if (focusStartTime) {
     const focusedSeconds = Math.floor((Date.now() - focusStartTime) / 1000);
     addFocusTime(focusedSeconds);
     focusStartTime = null;
 }

 showRestMessage();

 document.getElementById('pauseBtn').innerHTML = `
     <svg class="w-8 h-8" fill="white" viewBox="0 0 24 24">
         <path d="M8 5v14l11-7z"/>
     </svg>
 `;
 enableModeSwitch();
} else if (isPaused) {
 isTimerRunning = true;
 isPaused = false;
 focusStartTime = Date.now();
 startHeartbeatAnimation();
 startEncourageLoop();
 // 新增：恢复背景音乐播放
 resumeBackgroundMusic();

 // ✅ 更新聊天 Prompt 状态为专注
 if (typeof updatePromptState === 'function') {
     updatePromptState();
 }

 document.getElementById('pauseBtn').innerHTML = `
     <svg class="w-8 h-8" fill="white" viewBox="0 0 24 24">
         <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
     </svg>
 `;

 document.getElementById('pomodoroBtn').style.pointerEvents = 'none';
 document.getElementById('timerBtn').style.pointerEvents = 'none';
 document.getElementById('pomodoroBtn').style.opacity = '0.6';
 document.getElementById('timerBtn').style.opacity = '0.6';
 
 timerInterval = setInterval(() => {
     if (currentMode === 'pomodoro') {
         currentTime--;
         if (currentTime <= 0) {
             clearInterval(timerInterval);
             isTimerRunning = false;
             isPaused = false;
             
             if (focusStartTime) {
                 const focusedSeconds = Math.floor((Date.now() - focusStartTime) / 1000);
                 addFocusTime(focusedSeconds);
                 focusStartTime = null;
             }
             
             showPomodoroComplete();
             enableModeSwitch();
             resetToSingleButton();
             stopHeartbeatAnimation();
             stopEncourageLoop();
             return;
         }
     } else {
         currentTime++;
     }
     updateTimerDisplay();
 }, 1000);
}
}

function stopTimer() {
if (timerInterval) {
 clearInterval(timerInterval);
 timerInterval = null;
 
 if (focusStartTime) {
     const focusedSeconds = Math.floor((Date.now() - focusStartTime) / 1000);
     addFocusTime(focusedSeconds);

     // 新增：如果是手动停止，记录为放弃的番茄钟
    if (isTimerRunning && currentMode === 'pomodoro' && focusedSeconds > 60) {
        recordAbandonedPomodoro(focusedSeconds, currentTask.name, currentStatus.name);
    }
    // 更新数据中心页面（如果当前在数据中心页面）
updateDataCenterIfActive();

     focusStartTime = null;
 }
}
isTimerRunning = false;
isPaused = false;

stopHeartbeatAnimation();
stopEncourageLoop();

// ✅ 清除25分钟定时生成器
if (phraseGenerationInterval) {
    clearInterval(phraseGenerationInterval);
    phraseGenerationInterval = null;
}

// 修改：停止音乐并重置进度
stopBackgroundMusic();

if (currentMode === 'pomodoro') {
 currentTime = selectedMinutes * 60;
} else {
 currentTime = 0;
}
updateTimerDisplay();

resetToSingleButton();
enableModeSwitch();

if (!isIgnoring) {
 showOCMessage(getInitialMessage(), 'initial', true);
}
}

 function resetToSingleButton() {
     document.getElementById('threeButtonLayout').classList.add('hidden');
     document.getElementById('singleButtonLayout').classList.remove('hidden');
     
     const startBtnHint = document.getElementById('startBtnHint');
     if (!isStatusSelected) {
         startBtnHint.classList.remove('hidden');
     } else {
         startBtnHint.classList.add('hidden');
     }
     
     document.getElementById('pauseBtn').innerHTML = `
         <svg class="w-8 h-8" fill="white" viewBox="0 0 24 24">
             <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
         </svg>
     `;
 }

 function startHeartbeatAnimation() {
     const leftPath = document.querySelector('.heartbeat-path-left');
     const rightPath = document.querySelector('.heartbeat-path-right');
     
     if (leftPath) leftPath.classList.remove('static');
     if (rightPath) rightPath.classList.remove('static');
 }

 function stopHeartbeatAnimation() {
     const leftPath = document.querySelector('.heartbeat-path-left');
     const rightPath = document.querySelector('.heartbeat-path-right');
     
     if (leftPath) leftPath.classList.add('static');
     if (rightPath) rightPath.classList.add('static');
 }

 function enableModeSwitch() {
     document.getElementById('pomodoroBtn').style.pointerEvents = 'auto';
     document.getElementById('timerBtn').style.pointerEvents = 'auto';
     document.getElementById('pomodoroBtn').style.opacity = '1';
     document.getElementById('timerBtn').style.opacity = '1';
 }

// 音频管理函数
function initAudio() {
// 预加载完成音效
completionAudio = new Audio(audioFiles.completion);
completionAudio.preload = 'auto';
completionAudio.volume = 0.7;

// 错误处理
completionAudio.addEventListener('error', function(e) {
 console.log('完成音效加载失败:', e);
});
}

function playBackgroundMusic(type) {
stopBackgroundMusic();

if (!isMusicEnabled || type === 'mute') return;

musicType = type; // 记录当前音乐类型
const audioUrl = type === 'music' ? audioFiles.music : audioFiles.rain;

try {
 currentBackgroundMusic = new Audio(audioUrl);
 currentBackgroundMusic.loop = true;
 currentBackgroundMusic.volume = 0.3;
 
 // 设置播放进度
 if (musicPausedTime > 0) {
     currentBackgroundMusic.currentTime = musicPausedTime;
 }
 
 // 添加错误处理
 currentBackgroundMusic.addEventListener('error', function(e) {
     console.log('背景音乐加载失败:', e);
     currentBackgroundMusic = null;
 });
 
 // 添加加载完成处理
 currentBackgroundMusic.addEventListener('canplaythrough', function() {
     if (currentBackgroundMusic) {
         currentBackgroundMusic.play().catch(e => {
             console.log('音乐播放失败，可能需要用户交互:', e);
         });
     }
 });
 
} catch (error) {
 console.log('创建音频对象失败:', error);
}
}

function stopBackgroundMusic() {
if (currentBackgroundMusic) {
 currentBackgroundMusic.pause();
 currentBackgroundMusic.currentTime = 0;
 currentBackgroundMusic = null;
}
musicPausedTime = 0; // 重置进度
}

function pauseBackgroundMusic() {
if (currentBackgroundMusic) {
 musicPausedTime = currentBackgroundMusic.currentTime; // 保存当前播放进度
 currentBackgroundMusic.pause();
}
}

function resumeBackgroundMusic() {
if (musicType !== 'mute' && currentMusicMode > 0) {
 playBackgroundMusic(musicType);
}
}

function stopCompletionSound() {
if (completionAudio) {
 completionAudio.pause();
 completionAudio.currentTime = 0;
}
}



function stopBackgroundMusic() {
if (currentBackgroundMusic) {
 currentBackgroundMusic.pause();
 currentBackgroundMusic.currentTime = 0;
 currentBackgroundMusic = null;
}
}

function playCompletionSound() {
if (!isMusicEnabled || !completionAudio) return;

try {
 completionAudio.currentTime = 0;
 completionAudio.play().catch(e => {
     console.log('完成音效播放失败:', e);
 });
} catch (error) {
 console.log('播放完成音效时出错:', error);
}
}


function toggleMusic() {
currentMusicMode = (currentMusicMode + 1) % 3;
const musicBtn = document.getElementById('musicBtn');
const icon = musicIcons[currentMusicMode];

// 更新按钮图标
musicBtn.innerHTML = `<span style="font-size: 28px;">${icon}</span>`;

// 根据模式播放相应音乐
switch(currentMusicMode) {
 case 0: // 静音
     stopBackgroundMusic();
     break;
 case 1: // 音乐
     playBackgroundMusic('music');
     break;
 case 2: // 雨声
     playBackgroundMusic('rain');
     break;
}
}

 // 番茄钟完成相关
 function showPomodoroComplete() {
        // 记录番茄钟完成数据
        const completedDuration = selectedMinutes * 60;
        recordPomodoro(completedDuration, currentTask.name, currentStatus.name);

        // ✅ 设置 Prompt 状态为完成
        if (typeof setPromptStateToFinish === 'function') {
            setPromptStateToFinish();
        }

     stopBackgroundMusic();
     playCompletionSound();
     const ocAvatar = document.querySelector('.oc-avatar');
     if (ocAvatar) {
         ocAvatar.classList.add('celebration');
         setTimeout(() => {
             ocAvatar.classList.remove('celebration');
         }, 1000);
     }

     const gift = getRandomGift();
     const completionMessage = getRandomOCMessage('completion');
     const senderOC = ocData[focusStartOCIndex] || ocData[currentOCIndex];

     addGift(gift, focusStartOCIndex);
     // 更新数据中心页面（如果当前在数据中心页面）
updateDataCenterIfActive();

     createCelebrationParticles();

     showCompletionModal(completionMessage, senderOC.name, currentStatus.name, gift);

     currentTime = selectedMinutes * 60;
     updateTimerDisplay();
     if (!isIgnoring) {
         showOCMessage(getInitialMessage(), 'initial', true);
     }

     // ✅ 延迟清空杂念列表（给用户一些时间看到）
     setTimeout(() => {
         if (typeof clearDistractionList === 'function') {
             clearDistractionList();
         }
     }, 5000);
 }

 function getRandomGift() {
     const senderOC = ocData[focusStartOCIndex] || ocData[currentOCIndex];

// 优先使用状态对应的礼物
if (currentStatus.name && statusGifts[currentStatus.name] && statusGifts[currentStatus.name].length > 0) {
 const statusGiftList = statusGifts[currentStatus.name];
 return statusGiftList[Math.floor(Math.random() * statusGiftList.length)];
}

// 其次使用自定义礼物
if (senderOC.customGifts && senderOC.customGifts.trim()) {
 const customGifts = senderOC.customGifts.trim().split('\n').filter(gift => gift.trim());
 if (customGifts.length > 0) {
     return customGifts[Math.floor(Math.random() * customGifts.length)].trim();
 }
}

// 最后使用默认礼物
const defaultGifts = [
 '🎁 专属定制奖杯！你是最棒的！',
 '⭐ 闪亮星星徽章！继续加油！',
 '💎 珍贵宝石！你的努力很珍贵！',
 '🏆 成就勋章！为你的坚持喝彩！',
 '🌟 光芒四射！你闪闪发光！'
];

return defaultGifts[Math.floor(Math.random() * defaultGifts.length)];
}

 function createCelebrationParticles() {
     const particles = ['⭐', '💎', '🌟', '✨', '💫', '🔸', '🔹'];
     
     for (let i = 0; i < 12; i++) {
         setTimeout(() => {
             const particle = document.createElement('div');
             particle.className = 'celebration-particle';
             particle.textContent = particles[Math.floor(Math.random() * particles.length)];
             particle.style.left = Math.random() * window.innerWidth + 'px';
             particle.style.animationDelay = Math.random() * 0.5 + 's';
             particle.style.animationDuration = (Math.random() * 2 + 3) + 's';
             document.body.appendChild(particle);
             
             setTimeout(() => {
                 if (particle.parentNode) {
                     particle.remove();
                 }
             }, 4500);
         }, i * 150);
     }
 }

 function showCompletionModal(completionMessage, ocName, safesafeStatusName, gift) {
const modal = document.getElementById('completionModal');
const titleElement = document.getElementById('completionTitle');
const giftElement = document.getElementById('completionGift');

titleElement.textContent = `🎉 ${completionMessage}`;
// 修改：改变排版格式，添加换行
giftElement.innerHTML = `${ocName}${safesafeStatusName}结束啦，给你带回了<br>${gift}`;

modal.classList.add('show');
}

 function closeCompletionModal() {
     document.getElementById('completionModal').classList.remove('show');
     stopCompletionSound();
 }




 // 飘落效果
 function createFallingElements() {
     const elements = ['🌸'];
     
     function createSingleElement() {
         const element = document.createElement('div');
         element.className = 'falling-petals';
         element.textContent = elements[Math.floor(Math.random() * elements.length)];
         element.style.left = Math.random() * window.innerWidth + 'px';
         element.style.animationDuration = (Math.random() * 3 + 4) + 's';
         element.style.animationDelay = Math.random() * 2 + 's';
         
         document.body.appendChild(element);
         
         setTimeout(() => {
             if (element.parentNode) {
                 element.remove();
             }
         }, 9000);
     }
     
     for (let i = 0; i < 3; i++) {
         setTimeout(createSingleElement, i * 1000);
     }
     
     setInterval(createSingleElement, 2000);
 }

 // 初始化和事件监听
 async function loadStoredData() {
     const storedOCData = localStorage.getItem('ocData');
     if (storedOCData) {
         try {
             const loadedData = JSON.parse(storedOCData);
             ocData = await Promise.all(loadedData.map(async (oc) => {
                 let avatar = oc.avatar;

                 // 从 IndexedDB 加载大图头像
                 if (avatar && avatar.startsWith('idxdb:')) {
                     const key = avatar.replace('idxdb:', '');
                     try {
                         const dataUrl = await getAvatarData(key);
                         if (dataUrl) avatar = dataUrl;
                     } catch (e) {
                         console.warn('从 IndexedDB 加载头像失败:', key, e);
                     }
                 }

                 // 迁移：将旧的内联 DataURL 存入 IndexedDB
                 if (avatar && avatar.startsWith('data:') && oc.id) {
                     try {
                         await saveAvatarData(`oc_${oc.id}`, avatar);
                     } catch (e) {
                         // IndexedDB 不可用时忽略，保持内联存储
                     }
                 }

                 return {
                     ...oc,
                     avatar,
                     customGifts: oc.customGifts || '',
                     encourageStyles: oc.encourageStyles || [oc.personality || 'gentle'],
                     reminderStyles: oc.reminderStyles || [oc.reminderStyle || 'guardian']
                 };
             }));

             // 更新 localStorage 引用（将内联 DataURL 迁移为 idxdb 引用）
             persistOCData();
         } catch (e) {
             console.log('Failed to parse stored OC data');
         }
     }
     
     const storedOCIndex = localStorage.getItem('currentOCIndex');
     if (storedOCIndex && parseInt(storedOCIndex) < ocData.length) {
         currentOCIndex = parseInt(storedOCIndex);
     }
     
     updateCurrentOC(currentOCIndex);
     loadTasks();
     loadDailyStats();
     loadCustomStyles();
     loadStatusGiftsFromStorage();
     loadCustomStatusesFromStorage(); 
 }

 function initPageAnimation() {
     const cards = document.querySelectorAll('.glass-card');
     cards.forEach((card, index) => {
         card.style.opacity = '0';
         card.style.transform = 'translateY(20px)';
         setTimeout(() => {
             card.style.transition = 'all 0.6s ease';
             card.style.opacity = '1';
             card.style.transform = 'translateY(0)';
         }, index * 100 + 200);
     });
 }

 function updateCurrentDate() {
     const now = new Date();
     const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
     const dateStr = `${now.getFullYear()}年${(now.getMonth() + 1).toString().padStart(2, '0')}月${now.getDate().toString().padStart(2, '0')}日 ${weekdays[now.getDay()]}`;
     document.getElementById('currentDate').textContent = dateStr;
 }

 function initEventListeners() {
     document.getElementById('pomodoroBtn').addEventListener('click', () => switchMode('pomodoro'));
     document.getElementById('timerBtn').addEventListener('click', () => switchMode('timer'));
     
     document.addEventListener('click', function(e) {
         const statusSelector = document.getElementById('statusSelector');
         const statusButton = document.getElementById('statusButton');
         const timeSelector = document.getElementById('timeSelector');
         const timerDisplay = document.getElementById('timerDisplay');
         const taskSelector = document.getElementById('taskSelector');
         const taskContainer = document.querySelector('[onclick="showTaskSelector()"]');
         const giftModal = document.getElementById('giftModal');
         const completedTasksModal = document.getElementById('completedTasksModal');
         const completionModal = document.getElementById('completionModal');
         const styleEditorModal = document.getElementById('styleEditorModal');
         
         if (statusSelector && !statusSelector.contains(e.target) && 
             e.target !== statusButton && !statusButton.contains(e.target)) {
             statusSelector.classList.remove('show');
             hideCustomStatusInput();
         }
         
         if (timeSelector && !timeSelector.contains(e.target) && 
             e.target !== timerDisplay) {
             timeSelector.classList.remove('show');
         }
         
         if (taskSelector && !taskSelector.contains(e.target) && 
             taskContainer && !taskContainer.contains(e.target)) {
             taskSelector.classList.remove('show');
         }
         
         if (giftModal && giftModal.classList.contains('show') && e.target === giftModal) {
             closeGiftModal();
         }
         
         if (completedTasksModal && completedTasksModal.classList.contains('show') && e.target === completedTasksModal) {
             closeCompletedTasksModal();
         }
         
         if (completionModal && completionModal.classList.contains('show') && e.target === completionModal) {
             closeCompletionModal();
         }
         
         if (styleEditorModal && styleEditorModal.classList.contains('show') && e.target === styleEditorModal) {
             closeStyleEditor();
             const statusGiftEditorModal = document.getElementById('statusGiftEditorModal');
if (statusGiftEditorModal && statusGiftEditorModal.classList.contains('show') && e.target === statusGiftEditorModal) {
closeStatusGiftEditor();
}
         }
     });
 }

 // ============================================
 // 云同步 UI 控制
 // ============================================

// [注释] 云同步相关功能 2025-05-25 暂时隐藏 ————————————————
/*
function updateSyncUI(status) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatusText');
    if (!indicator || !statusText) return;

    indicator.className = 'inline-block w-2 h-2 rounded-full sync-indicator-' + status;
    const labels = {
        synced: '已同步',
        syncing: '同步中...',
        offline: '离线',
        error: '同步出错',
        not_configured: '云同步未开启'
    };
    statusText.textContent = labels[status] || status;

    const codeSection = document.getElementById('syncCodeSection');
    const manageSection = document.getElementById('syncManageSection');
    const codeDisplay = document.getElementById('syncCodeDisplay');
    if (codeSection && manageSection) {
        codeSection.style.display = (status === 'not_configured') ? '' : 'none';
        manageSection.style.display = (status !== 'not_configured') ? '' : 'none';
    }
    // 显示当前同步码（手机号）
    if (codeDisplay && window.syncManager) {
        codeDisplay.textContent = window.syncManager.identityHash || '';
    }
}

async function handleSyncCode() {
    const input = document.getElementById('syncCodeInput');
    const msg = document.getElementById('syncMessage');
    const code = input.value.trim();

    if (!code || code.length < 2) {
        msg.textContent = '同步码至少 2 个字符';
        msg.className = 'text-xs text-red-500 mt-1';
        return;
    }

    msg.textContent = '正在连接...';
    msg.className = 'text-xs text-slate-400 mt-1';

    try {
        await window.syncManager.setSyncCode(code);
        msg.textContent = '云同步已启用！';
        msg.className = 'text-xs text-green-600 mt-1';
        input.value = '';
    } catch (e) {
        msg.textContent = '启用失败：' + (e.message || '未知错误');
        msg.className = 'text-xs text-red-500 mt-1';
    }
}

function showChangeSyncCode() {
    if (confirm('更改同步码后，旧同步码的云端数据将不再关联。继续？')) {
        window.syncManager.disableSync();
        updateSyncUI('not_configured');
        document.getElementById('syncCodeInput').value = '';
        document.getElementById('syncMessage').textContent = '';
    }
}

function syncNow() {
    const msg = document.getElementById('syncMessage');
    msg.textContent = '同步中...';
    msg.className = 'text-xs text-slate-400 mt-1';
    // 全量推送本地数据，再拉取远端
    window.syncManager.forceSync().then((hasChanges) => {
        if (hasChanges) {
            location.reload();
        } else {
            msg.textContent = '已同步';
            msg.className = 'text-xs text-green-600 mt-1';
            setTimeout(() => { msg.textContent = ''; }, 2000);
        }
    }).catch(e => {
        msg.textContent = '同步失败：' + (e.message || '未知错误');
        msg.className = 'text-xs text-red-500 mt-1';
    });
}
*/

 // 页面初始化
 document.addEventListener('DOMContentLoaded', async function() {
     await loadStoredData();
     loadDetailedStats(); // 新增：加载详细统计数据
     updateCurrentDate();
     updateTimerDisplay();
     initAudio();
     initAIEncouragement(); 
     
     const musicBtn = document.getElementById('musicBtn');
     if (musicBtn) {
         musicBtn.innerHTML = `
             <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                 <text x="12" y="16" text-anchor="middle" font-size="16">🔇</text>
             </svg>
         `;
     }
     
     initEventListeners();
     createFallingElements();
     setTimeout(initPageAnimation, 100);
     renderTasks();

     // [注释] 云同步初始化 2025-05-25 暂时隐藏
     // if (window.syncManager) {
     //     window.syncManager.onStatusChange(updateSyncUI);
     //     window.syncManager.init().then(() => {
     //         updateSyncUI(window.syncManager.status);
     //     });
     // }
 });




// 初始化AI鼓励语功能
function initAIEncouragement() {
    // 字数统计
    const charDescInput = document.getElementById('characterDescription');
    if (charDescInput) {
        charDescInput.addEventListener('input', function(e) {
            const text = e.target.value;
            const length = text.length;
            const counter = document.getElementById('charCounter');
            
            if (counter) {
                counter.textContent = `${length}/500`;
                
                if (length > 450) {
                    counter.className = 'char-counter error';
                } else if (length > 400) {
                    counter.className = 'char-counter warning';
                } else {
                    counter.className = 'char-counter';
                }
            }
        });
    }
    
    // 加载历史记录
    renderAIPromptHistory();
}

// ============================================
// 新版：AI 语录自动生成函数
// ============================================

/**
 * 只保存角色人设描述
 * 不生成语录，只更新OC对象和聊天上下文
 */
async function saveCharacterDescription() {
    const characterDescription = document.getElementById('characterDescription').value.trim();
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];

    // 验证输入
    if (!characterDescription) {
        alert('请输入角色人设描述');
        return;
    }

    // 获取UI元素
    const loadingIndicator = document.getElementById('loadingIndicator');
    const successIndicator = document.getElementById('successIndicator');

    // 显示加载圈圈
    loadingIndicator.classList.remove('hidden');
    successIndicator.classList.add('hidden');

    try {
        // 保存角色人设描述
        currentOC.characterDescription = characterDescription;

        // 保存到localStorage
        persistOCData();

        console.log('✅ 角色人设描述已保存');

        // 更新AI聊天上下文
        if (typeof updateChatContext === 'function') {
            try {
                updateChatContext();
                console.log('✅ AI聊天上下文已更新');
            } catch (e) {
                console.log('⚠️ 更新聊天上下文时出错:', e);
            }
        }

        // 显示成功状态
        loadingIndicator.classList.add('hidden');
        successIndicator.classList.remove('hidden');

        // 设置"忽略历史"标记（让AI不参考历史记录）
        localStorage.setItem(`ignoreHistory_${ocIndex}`, 'true');
        console.log('✅ 已设置忽略历史标记，AI将从头开始对话');

        // 2秒后隐藏成功标记
        setTimeout(() => {
            successIndicator.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error('保存角色人设时出错：', error);
        alert(`保存失败：${error.message}`);

        // 恢复状态
        loadingIndicator.classList.add('hidden');
    }
}

/**
 * 保存基本信息并同步到AI聊天上下文
 * 只保存基本信息，不生成语录
 */
async function saveBasicInfoAndSync() {
    // 获取基本信息
    const ocName = document.getElementById('ocNameInput').value.trim();
    const userTitle = document.getElementById('userTitleInput').value.trim();
    const relationship = document.getElementById('relationshipInput').value.trim();
    const characterDescription = document.getElementById('characterDescription').value.trim();
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];

    // 验证必填字段
    if (!ocName) {
        alert('请输入OC名字');
        return;
    }

    if (!characterDescription) {
        alert('请输入角色人设描述');
        return;
    }

    // 获取UI元素
    const loadingIndicator = document.getElementById('loadingIndicator');
    const successIndicator = document.getElementById('successIndicator');

    // 显示加载圈圈
    loadingIndicator.classList.remove('hidden');
    successIndicator.classList.add('hidden');

    try {
        // 更新基本信息
        currentOC.name = ocName;
        currentOC.userTitle = userTitle || '大小姐';
        currentOC.relationship = relationship || '朋友';
        currentOC.characterDescription = characterDescription;

        // 保存到localStorage
        persistOCData();

        console.log('✅ 基本信息已更新');
        console.log('   新的称呼：', currentOC.userTitle);

        // 更新AI聊天上下文
        if (typeof updateChatContext === 'function') {
            try {
                updateChatContext();
                console.log('✅ AI聊天上下文已更新');
            } catch (e) {
                console.log('⚠️ 更新聊天上下文时出错:', e);
            }
        }

        // 显示成功状态
        loadingIndicator.classList.add('hidden');
        successIndicator.classList.remove('hidden');

        // 设置"忽略历史"标记（让AI不参考历史记录）
        localStorage.setItem(`ignoreHistory_${ocIndex}`, 'true');
        console.log('✅ 已设置忽略历史标记，AI将从头开始对话');

        // 2秒后隐藏成功标记
        setTimeout(() => {
            successIndicator.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error('保存时出错：', error);
        alert(`保存失败：${error.message}`);

        // 恢复状态
        loadingIndicator.classList.add('hidden');
    }
}

/**
 * 只生成AI语录（鼓励语和督促语）
 * 不生成问候语
 */
/**
 * 专注页AI语录生成函数
 * 根据OC状态生成专属语录
 */
async function generateFocusPhrases(ocStatus) {
    const currentOC = ocData[currentOCIndex];

    // 检查是否有人设描述
    if (!currentOC.characterDescription) {
        console.log('⚠️ 没有人设描述，跳过AI语录生成');
        return;
    }

    focusSessionPhrases.aiGenerating = true;
    focusSessionPhrases.currentOCStatus = ocStatus;

    console.log(`🔄 正在为OC状态"${ocStatus}"生成专属语录...`);

    try {
        // 构建提示词（包含OC状态）
        const promptWithStatus = `
角色：${currentOC.name}
人设：${currentOC.characterDescription}
关系：${currentOC.userTitle || '大小姐'}
当前OC状态：${ocStatus}
时间：${getTimeOfDay()}

要求：
1. 根据OC人设和当前状态"${ocStatus}"生成鼓励语和督促语
2. 语气要符合人设风格
3. 考虑到OC当前是${ocStatus}的状态
4. 20-40字之间
`;

        // 调用API生成
        const response = await generateAllPhrases({
            description: promptWithStatus,
            userTitle: currentOC.userTitle || '大小姐',
            generateGreetings: false,
            generateEncouragements: true,
            generateReminders: true,
            reminderLevels: ['normal', 'annoyed', 'angry'],
            encourageQuantity: 25,  // 鼓励语25条
            remindQuantity: 15,      // 每个等级15条
            referenceStyle: null
        });

        if (response.success) {
            // 保存鼓励语
            if (response.data.encouragements) {
                focusSessionPhrases.aiGenerated = response.data.encouragements;
                console.log(`✅ 生成鼓励语：${response.data.encouragements.length}条`);
            }

            // 保存督促语（3个等级）
            if (response.data.reminders) {
                focusSessionPhrases.aiReminders = response.data.reminders;
                const totalReminders =
                    (response.data.reminders.normal?.length || 0) +
                    (response.data.reminders.annoyed?.length || 0) +
                    (response.data.reminders.angry?.length || 0);
                console.log(`✅ 生成督促语：${totalReminders}条（normal:${response.data.reminders.normal?.length||0}, annoyed:${response.data.reminders.annoyed?.length||0}, angry:${response.data.reminders.angry?.length||0}）`);
            }

            // 保存到OC对象（持久化）
            if (!currentOC.aiPhrases) {
                currentOC.aiPhrases = {};
            }
            currentOC.aiPhrases.encouragements = response.data.encouragements || [];
            currentOC.aiPhrases.reminders = response.data.reminders || {};
            persistOCData();

            console.log(`✅ 为状态"${ocStatus}"生成完成，总计${(response.data.encouragements?.length || 0) + ((response.data.reminders?.normal?.length || 0) + (response.data.reminders?.annoyed?.length || 0) + (response.data.reminders?.angry?.length || 0))}条语录`);
        } else {
            throw new Error(response.error || '生成失败');
        }

    } catch (error) {
        console.error('❌ 专注页语录生成失败：', error);
        // 失败不影响使用，继续使用预设语录
    } finally {
        focusSessionPhrases.aiGenerating = false;

        // ✅ AI生成完成后，立即显示第1条AI语录
        if (focusSessionPhrases.aiGenerated && focusSessionPhrases.aiGenerated.length > 0) {
            if (isTimerRunning && !isPaused && !isIgnoring) {
                const firstAIMessage = focusSessionPhrases.aiGenerated[0];
                showOCMessage(firstAIMessage, 'encourage', true);
                console.log('💬 立即显示第1条AI语录：', firstAIMessage);
            }
        }
    }
}

/**
 * 获取当前时间的问候语
 */
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return '早晨';
    if (hour < 18) return '下午';
    return '晚上';
}

async function generateAIPhrasesOnly() {
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];

    // 验证基本信息是否已填写
    if (!currentOC.characterDescription) {
        alert('请先填写角色人设描述并保存基本信息');
        return;
    }

    // 获取UI元素
    const generateBtn = document.getElementById('generatePhrasesBtn');
    const progressDiv = document.getElementById('generatingProgress');
    const successDiv = document.getElementById('generateSuccessIndicator');

    // 禁用按钮，显示进度
    generateBtn.disabled = true;
    progressDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');

    try {
        console.log('🔄 正在生成AI语录（鼓励语+督促语）...');

        // 调用API生成语录（不生成问候语）
        const response = await generateAllPhrases({
            description: currentOC.characterDescription,
            userTitle: currentOC.userTitle || '大小姐',
            generateGreetings: false, // 不生成问候语
            generateEncouragements: true,
            generateReminders: true,
            reminderLevels: ['normal', 'annoyed', 'angry'],
            encourageQuantity: 10,
            remindQuantity: 5,
            referenceStyle: null
        });

        if (response.success) {
            const generatedData = response.data;

            // 保存到OC对象
            if (!currentOC.aiPhrases) {
                currentOC.aiPhrases = {};
            }

            // 保存鼓励语
            currentOC.aiPhrases.encouragements = generatedData.encouragements || [];

            // 保存督促语
            currentOC.aiPhrases.reminders = generatedData.reminders || {};

            // 保存到localStorage
            persistOCData();

            console.log('✅ AI语录生成完成！');

            // 渲染结果到页面（只显示状态，详细内容在F12控制台）
            renderGeneratedPhrases(generatedData);

        } else {
            throw new Error(response.error || '生成失败');
        }

    } catch (error) {
        console.error('生成语录时出错：', error);
        alert(`生成失败：${error.message}`);

        // 隐藏进度
        progressDiv.classList.add('hidden');
    } finally {
        // 恢复按钮
        generateBtn.disabled = false;
    }
}

/**
 * 渲染生成的语录结果
 * 详细内容输出到F12控制台，前端只显示完成状态
 */
function renderGeneratedPhrases(data) {
    // 将详细结果输出到F12控制台
    console.log('='.repeat(80));
    console.log('✨ AI语录生成完成');
    console.log('='.repeat(80));

    // 输出鼓励语
    if (data.encouragements && data.encouragements.length > 0) {
        console.log('\n📝 鼓励语（' + data.encouragements.length + '条）：');
        console.log('─'.repeat(80));
        data.encouragements.forEach((phrase, index) => {
            console.log(`${index + 1}. ${phrase}`);
        });
    }

    // 输出督促语（按等级分组）
    if (data.reminders) {
        console.log('\n⏰ 督促语：');
        console.log('─'.repeat(80));

        const levels = [
            { key: 'normal', label: '温和提醒' },
            { key: 'annoyed', label: '正常督促' },
            { key: 'angry', label: '严厉催促' }
        ];

        levels.forEach(level => {
            const phrases = data.reminders[level.key];
            if (phrases && phrases.length > 0) {
                console.log(`\n【${level.label}】（${phrases.length}条）：`);
                phrases.forEach((phrase, index) => {
                    console.log(`  ${index + 1}. ${phrase}`);
                });
            }
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ 以上语录已保存到OC设置中');
    console.log('='.repeat(80) + '\n');

    // 前端只显示完成状态
    const progressDiv = document.getElementById('generatingProgress');
    const successDiv = document.getElementById('generateSuccessIndicator');

    progressDiv.classList.add('hidden');
    successDiv.classList.remove('hidden');

    // 更新AI语录卡片计数
    updateAIPhraseCounts();

    // 3秒后隐藏成功提示
    setTimeout(() => {
        successDiv.classList.add('hidden');
    }, 3000);
}

/**
 * HTML转义函数
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 语录库管理函数
// ============================================

let currentPresetCategory = 'encourage';
let currentPresetStyle = 'all';
let currentRemindLevel = 'all';

/**
 * 显示预设语录分类
 */
function showPresetCategory(category, buttonElement) {
    currentPresetCategory = category;

    // 更新标签按钮样式
    document.querySelectorAll('.preset-tab-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-purple-500', 'text-white');
        btn.classList.add('bg-slate-200', 'text-slate-700');
    });
    if (buttonElement) {
        buttonElement.classList.add('active', 'bg-purple-500', 'text-white');
        buttonElement.classList.remove('bg-slate-200', 'text-slate-700');
    }

    // 显示/隐藏筛选器
    const styleFilter = document.getElementById('encourageStyleFilter');
    const levelFilter = document.getElementById('remindLevelFilter');

    if (category === 'encourage') {
        styleFilter.classList.remove('hidden');
        levelFilter.classList.add('hidden');
    } else {
        styleFilter.classList.add('hidden');
        levelFilter.classList.remove('hidden');
    }

    // 重新渲染
    renderPresetPhrases();
}

/**
 * 筛选预设风格
 */
function filterPresetStyle(style, buttonElement) {
    currentPresetStyle = style;

    // 更新按钮样式
    document.querySelectorAll('.style-filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-purple-500', 'text-white');
        btn.classList.add('bg-slate-100', 'text-slate-600');
    });
    if (buttonElement) {
        buttonElement.classList.add('active', 'bg-purple-500', 'text-white');
        buttonElement.classList.remove('bg-slate-100', 'text-slate-600');
    }

    renderPresetPhrases();
}

/**
 * 筛选督促等级（预设）
 */
function filterRemindLevel(level, buttonElement) {
    currentRemindLevel = level;

    // 更新按钮样式
    document.querySelectorAll('.level-filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-purple-500', 'text-white');
        btn.classList.add('bg-slate-100', 'text-slate-600');
    });
    if (buttonElement) {
        buttonElement.classList.add('active', 'bg-purple-500', 'text-white');
        buttonElement.classList.remove('bg-slate-100', 'text-slate-600');
    }

    renderPresetPhrases();
}

/**
 * 渲染预设语录
 */
function renderPresetPhrases() {
    const container = document.getElementById('presetPhrasesContainer');
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];
    const userTitle = currentOC?.userTitle || '大小姐';

    let phrases = [];

    if (currentPresetCategory === 'encourage') {
        // 获取鼓励语
        if (currentPresetStyle === 'all') {
            // 获取所有风格的鼓励语
            Object.keys(ocMessageLibrary.encourage).forEach(style => {
                ocMessageLibrary.encourage[style].forEach(phrase => {
                    phrases.push({
                        content: phrase.replace(/\{title\}/g, userTitle),
                        style: style,
                        type: 'encourage'
                    });
                });
            });
        } else {
            // 获取特定风格的鼓励语
            const stylePhrases = ocMessageLibrary.encourage[currentPresetStyle] || [];
            stylePhrases.forEach(phrase => {
                phrases.push({
                    content: phrase.replace(/\{title\}/g, userTitle),
                    style: currentPresetStyle,
                    type: 'encourage'
                });
            });
        }
    } else if (currentPresetCategory === 'remind') {
        // 获取督促语
        const remindLibrary = ocMessageLibrary.remind;

        if (currentRemindLevel === 'all') {
            // 获取所有等级的督促语
            ['normal', 'annoyed', 'angry'].forEach(level => {
                if (remindLibrary[level]) {
                    Object.keys(remindLibrary[level]).forEach(style => {
                        remindLibrary[level][style].forEach(phrase => {
                            phrases.push({
                                content: phrase.replace(/\{title\}/g, userTitle),
                                style: style,
                                level: level,
                                type: 'remind'
                            });
                        });
                    });
                }
            });
        } else {
            // 获取特定等级的督促语
            const levelLibrary = remindLibrary[currentRemindLevel];
            if (levelLibrary) {
                Object.keys(levelLibrary).forEach(style => {
                    levelLibrary[style].forEach(phrase => {
                        phrases.push({
                            content: phrase.replace(/\{title\}/g, userTitle),
                            style: style,
                            level: currentRemindLevel,
                            type: 'remind'
                        });
                    });
                });
            }
        }
    }

    // 渲染卡片
    if (phrases.length === 0) {
        container.innerHTML = `
            <div class="text-center text-slate-400 py-8">
                <p>暂无语录</p>
            </div>
        `;
        return;
    }

    container.innerHTML = phrases.map((phrase, index) => {
        const tagClass = phrase.type === 'encourage' ? `tag-${phrase.style}` : `tag-${phrase.level}`;
        const tagLabel = phrase.type === 'encourage' ? getStyleLabel(phrase.style) : getLevelLabel(phrase.level);

        return `
            <div class="phrase-card">
                <button class="delete-btn" onclick="deletePresetPhrase(${index}, '${phrase.type}')" title="删除">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <div class="phrase-meta">
                    <span class="phrase-tag ${tagClass}">${tagLabel}</span>
                </div>
                <div class="phrase-content">${escapeHtml(phrase.content)}</div>
            </div>
        `;
    }).join('');
}

/**
 * 获取风格标签
 */
function getStyleLabel(style) {
    const labels = {
        gentle: '温柔守护',
        tsundere: '傲娇毒舌',
        cheerful: '开朗活泼',
        aloof: '淡漠冷静',
        mature: '成熟稳重',
        cunning: '腹黑',
        shy: '害羞内向',
        doting: '溺爱宠溺'
    };
    return labels[style] || style;
}

/**
 * 获取等级标签
 */
function getLevelLabel(level) {
    const labels = {
        normal: '温和',
        annoyed: '烦恼',
        angry: '严厉'
    };
    return labels[level] || level;
}

/**
 * 删除预设语录（暂时禁用）
 */
function deletePresetPhrase(index, type) {
    // 预设语录库是只读的，不允许删除
    alert('预设语录库是系统内置的，无法删除。如需移除，请使用AI生成的语录。');
}

// ============================================
// AI生成语录管理函数
// ============================================

/**
 * 显示AI语录编辑弹窗
 */
function showAIPhrasesEditor(category) {
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];

    if (!currentOC || !currentOC.aiPhrases) {
        alert('暂无AI生成语录，请先点击上方"开始生成AI语录"按钮生成');
        return;
    }

    // 设置AI语录编辑标志
    currentEditingAI = true;
    currentAICategory = category;

    const modal = document.getElementById('styleEditorModal');
    const title = document.getElementById('styleEditorTitle');
    const desc = document.getElementById('styleEditorDesc');
    const textarea = document.getElementById('styleEditorTextarea');

    let messages = [];

    if (category === 'encouragements') {
        // 加载鼓励语
        title.textContent = '📝 编辑AI生成的鼓励语';
        desc.textContent = '共 ' + (currentOC.aiPhrases.encouragements?.length || 0) + ' 条语录，可直接修改';
        messages = currentOC.aiPhrases.encouragements || [];
    } else if (category === 'reminders') {
        // 加载督促语（按等级分组）
        title.textContent = '⏰ 编辑AI生成的督促语';
        const reminders = currentOC.aiPhrases.reminders || {};

        let totalCount = 0;
        ['normal', 'annoyed', 'angry'].forEach(level => {
            if (reminders[level]) {
                totalCount += reminders[level].length;
            }
        });

        desc.textContent = `共 ${totalCount} 条语录，分3个等级，可直接修改`;

        // 格式化督促语
        messages = [
            '=== 正常提醒 ===',
            ...(reminders.normal || []),
            '',
            '=== 烦恼提醒 ===',
            ...(reminders.annoyed || []),
            '',
            '=== 生气提醒 ===',
            ...(reminders.angry || [])
        ];
    }

    textarea.value = messages.join('\n');
    textarea.readOnly = false; // 可编辑
    modal.classList.add('show');
}

/**
 * 更新AI语录卡片计数
 */
function updateAIPhraseCounts() {
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];

    if (!currentOC || !currentOC.aiPhrases) {
        document.getElementById('encouragementCount').textContent = '0条';
        document.getElementById('reminderCount').textContent = '0条';
        return;
    }

    // 更新鼓励语计数
    const encourageCount = (currentOC.aiPhrases.encouragements || []).length;
    document.getElementById('encouragementCount').textContent = encourageCount + '条';

    // 更新督促语计数
    let remindCount = 0;
    if (currentOC.aiPhrases.reminders) {
        ['normal', 'annoyed', 'angry'].forEach(level => {
            if (currentOC.aiPhrases.reminders[level]) {
                remindCount += currentOC.aiPhrases.reminders[level].length;
            }
        });
    }
    document.getElementById('reminderCount').textContent = remindCount + '条';
}

/**
 * 删除AI生成的语录
 */
function deleteAIPhrase(type, identifier) {
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];

    if (!confirm('确定要删除这条语录吗？')) {
        return;
    }

    if (type === 'encouragement') {
        // 删除鼓励语
        const index = parseInt(identifier);
        if (currentOC.aiPhrases && currentOC.aiPhrases.encouragements) {
            currentOC.aiPhrases.encouragements.splice(index, 1);
        }
    } else if (type === 'reminder') {
        // 删除督促语
        const [level, index] = identifier.split('-');
        const indexNum = parseInt(index);
        if (currentOC.aiPhrases && currentOC.aiPhrases.reminders && currentOC.aiPhrases.reminders[level]) {
            currentOC.aiPhrases.reminders[level].splice(indexNum, 1);
        }
    }

    // 保存到localStorage
    persistOCData();

    // 更新AI语录卡片计数
    updateAIPhraseCounts();

    console.log('✅ 已删除AI语录');
}

// ============================================
// 风格编辑相关函数
// ============================================

/**
 * 点击风格卡片
 */
function handleStyleClick(event, style, type) {
    event.stopPropagation();

    // 如果点击的是圆圈区域或删除按钮，则不触发编辑
    if (event.target.classList.contains('style-selector-circle') ||
        event.target.classList.contains('custom-style-delete') ||
        event.target.closest('.custom-style-delete')) {
        return;
    }

    // 显示风格编辑弹窗
    showStyleEditor(style, type);
}

/**
 * 点击选择圆圈
 */
function handleStyleSelect(event, style) {
    event.stopPropagation();
    const styleOption = event.target.closest('.style-option');
    if (styleOption) {
        styleOption.classList.toggle('selected');
    }
}

/**
 * 创建自定义风格
 */
function handleCustomStyleClick(type) {
    // 弹出输入框让用户输入风格名称
    const styleTitle = prompt('请输入自定义风格名称（建议4-8个字符）：');

    if (!styleTitle || !styleTitle.trim()) {
        return;
    }

    const trimmedTitle = styleTitle.trim();
    if (trimmedTitle.length > 12) {
        alert('风格名称不能超过12个字符');
        return;
    }

    // 生成唯一的自定义风格ID
    const customStyleId = `custom-${type}-${Date.now()}`;

    // 初始化自定义风格数据
    if (type === 'encourage') {
        customStyles.encourage[customStyleId] = ['在这里输入鼓励语句，每行一条...'];
    } else {
        customStyles.remind[customStyleId] = {
            normal: ['在这里输入正常提醒语句...'],
            annoyed: ['在这里输入烦恼提醒语句...'],
            angry: ['在这里输入生气提醒语句...']
        };
    }

    // 保存风格元数据
    if (!customStyles.metadata) {
        customStyles.metadata = {};
    }
    customStyles.metadata[customStyleId] = {
        title: trimmedTitle,
        type: type,
        desc: '点击编辑来自定义语句内容'
    };

    // 保存到本地存储
    saveCustomStyles();

    // 重新渲染风格选择区域以显示新创建的风格
    renderCustomStylesInGrid(type);

    // 自动打开编辑器让用户编辑语句
    setTimeout(() => {
        showStyleEditor(customStyleId, type, trimmedTitle);
    }, 100);
}

/**
 * 渲染自定义风格到对应的网格中
 */
function renderCustomStylesInGrid(type) {
    const gridId = type === 'encourage' ? 'encourageStyleGrid' : 'reminderStyleGrid';
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // 移除旧的自定义风格卡片（保留预设风格和"自定义"按钮）
    const customCards = grid.querySelectorAll('.style-option[data-style^="custom-"]:not([data-style="custom-encourage"]):not([data-style="custom-remind"])');
    customCards.forEach(card => card.remove());

    // 获取对应类型的自定义风格
    const customStylesOfType = Object.keys(customStyles.metadata || {})
        .filter(styleId => customStyles.metadata[styleId].type === type);

    // 为每个自定义风格创建卡片
    customStylesOfType.forEach(styleId => {
        const metadata = customStyles.metadata[styleId];
        const styleCard = createCustomStyleCard(styleId, metadata);

        // 插入到"自定义"按钮之前
        const customButton = grid.querySelector('[data-style="custom-' + type + '"]');
        if (customButton) {
            grid.insertBefore(styleCard, customButton);
        }
    });
}

/**
 * 创建自定义风格卡片
 */
function createCustomStyleCard(styleId, metadata) {
    const styleCard = document.createElement('div');
    styleCard.className = 'style-option';
    styleCard.setAttribute('data-style', styleId);
    styleCard.onclick = (event) => handleStyleClick(event, styleId, metadata.type);

    styleCard.innerHTML = `
        <div class="style-title">${metadata.title}</div>
        <div class="style-desc">${metadata.desc}</div>
        <div class="style-selector-circle" onclick="event.stopPropagation(); handleStyleSelect(event, '${styleId}')"></div>
        <button class="custom-style-delete" onclick="event.stopPropagation(); deleteCustomStyle('${styleId}', '${metadata.type}')" title="删除此自定义风格">
            <svg class="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
    `;

    return styleCard;
}

/**
 * 删除自定义风格
 */
function deleteCustomStyle(styleId, type) {
    if (confirm('确定要删除这个自定义风格吗？此操作不可恢复。')) {
        // 从存储中删除
        if (customStyles.encourage && customStyles.encourage[styleId]) {
            delete customStyles.encourage[styleId];
        }
        if (customStyles.remind && customStyles.remind[styleId]) {
            delete customStyles.remind[styleId];
        }
        if (customStyles.metadata && customStyles.metadata[styleId]) {
            delete customStyles.metadata[styleId];
        }

        // 从当前编辑的OC中移除该风格
        const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
        const currentOC = ocData[ocIndex];
        if (currentOC) {
            if (type === 'encourage' && currentOC.encourageStyles) {
                currentOC.encourageStyles = currentOC.encourageStyles.filter(s => s !== styleId);
            } else if (type === 'remind' && currentOC.reminderStyles) {
                currentOC.reminderStyles = currentOC.reminderStyles.filter(s => s !== styleId);
            }
        }

        // 保存更改
        saveCustomStyles();

        // 重新渲染
        renderCustomStylesInGrid(type);

        // 如果当前正在编辑这个风格，关闭编辑器
        if (currentEditingStyle === styleId) {
            closeStyleEditor();
        }
    }
}

/**
 * 切换预设风格库的折叠/展开状态
 */
function toggleStyleLibrary() {
    const content = document.getElementById('styleLibraryContent');
    const icon = document.getElementById('styleLibraryToggleIcon');
    const text = document.getElementById('styleLibraryToggleText');

    if (content.classList.contains('hidden')) {
        // 展开
        content.classList.remove('hidden');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
        text.textContent = '收起';
    } else {
        // 折叠
        content.classList.add('hidden');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
        text.textContent = '展开';
    }
}

/**
 * 切换AI语录模块的折叠/展开状态
 */
function toggleAIPhrases() {
    const content = document.getElementById('aiPhrasesContent');
    const icon = document.getElementById('aiPhrasesToggleIcon');
    const text = document.getElementById('aiPhrasesToggleText');

    if (content.classList.contains('hidden')) {
        // 展开
        content.classList.remove('hidden');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
        text.textContent = '收起';
    } else {
        // 折叠
        content.classList.add('hidden');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
        text.textContent = '展开';
    }
}

/**
 * 切换状态礼物模块的折叠/展开状态
 */
function toggleStatusGifts() {
    const content = document.getElementById('statusGiftsContent');
    const icon = document.getElementById('statusGiftsToggleIcon');
    const text = document.getElementById('statusGiftsToggleText');

    if (content.classList.contains('hidden')) {
        // 展开
        content.classList.remove('hidden');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
        text.textContent = '收起';
    } else {
        // 折叠
        content.classList.add('hidden');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
        text.textContent = '展开';
    }
}

/**
 * 显示风格编辑弹窗
 */
function showStyleEditor(style, type, customTitle = '') {
    currentEditingStyle = style;
    currentEditingType = type;
    currentEditingAI = false; // 编辑预设风格，不是AI语录

    const modal = document.getElementById('styleEditorModal');
    const title = document.getElementById('styleEditorTitle');
    const desc = document.getElementById('styleEditorDesc');
    const textarea = document.getElementById('styleEditorTextarea');
    // 设置标题
    let styleTitle = customTitle || getStyleTitle(style);
    title.textContent = `编辑${styleTitle}语句`;

    // 设置描述
    if (type === 'encourage') {
        desc.textContent = '每行一条鼓励语句，{title} 会被替换为用户称呼';
    } else {
        desc.textContent = '每行一条督促语句，分为三个级别：正常/烦恼/生气';
    }

    // 加载当前语句
    let messages = [];
    if (type === 'encourage') {
        if (style.startsWith('custom-') && customStyles.encourage[style]) {
            messages = [...customStyles.encourage[style]];
        } else if (ocMessageLibrary.encourage[style]) {
            // 检查是否有自定义修改的版本
            const modifiedKey = `modified-${style}`;
            if (customStyles.encourage[modifiedKey]) {
                messages = [...customStyles.encourage[modifiedKey]];
            } else {
                messages = [...ocMessageLibrary.encourage[style]];
            }
        }
    } else {
        if (style.startsWith('custom-') && customStyles.remind[style]) {
            // 自定义督促风格，显示所有级别
            messages = [
                '=== 正常提醒 ===',
                ...customStyles.remind[style].normal,
                '',
                '=== 烦恼提醒 ===',
                ...customStyles.remind[style].annoyed,
                '',
                '=== 生气提醒 ===',
                ...customStyles.remind[style].angry
            ];
        } else if (ocMessageLibrary.remind.normal[style]) {
            // 检查是否有自定义修改的版本
            const modifiedKey = `modified-${style}`;
            if (customStyles.remind[modifiedKey]) {
                messages = [
                    '=== 正常提醒 ===',
                    ...customStyles.remind[modifiedKey].normal,
                    '',
                    '=== 烦恼提醒 ===',
                    ...customStyles.remind[modifiedKey].annoyed,
                    '',
                    '=== 生气提醒 ===',
                    ...customStyles.remind[modifiedKey].angry
                ];
            } else {
                // 预设督促风格，显示所有级别
                messages = [
                    '=== 正常提醒 ===',
                    ...ocMessageLibrary.remind.normal[style],
                    '',
                    '=== 烦恼提醒 ===',
                    ...ocMessageLibrary.remind.annoyed[style],
                    '',
                    '=== 生气提醒 ===',
                    ...ocMessageLibrary.remind.angry[style]
                ];
            }
        }
    }

    textarea.value = messages.join('\n');
    modal.classList.add('show');
}

/**
 * 获取风格标题
 */
function getStyleTitle(style) {
    // 首先检查是否是自定义风格
    if (customStyles.metadata && customStyles.metadata[style]) {
        return customStyles.metadata[style].title;
    }

    // 预设风格标题
    const styleTitles = {
        gentle: '温柔守护型',
        tsundere: '傲娇毒舌型',
        cheerful: '阳光开朗型',
        aloof: '淡漠深沉型',
        mature: '成熟包容型',
        cunning: '腹黑心机型',
        shy: '纯情害羞型',
        doting: '无脑溺爱型',
        guardian: '守护者',
        pusher: '鞭策者',
        cheerleader: '应援者',
        observer: '观察者',
        guide: '引导者',
        strategist: '布局者',
        companion: '陪伴者',
        believer: '溺爱者'
    };

    return styleTitles[style] || '自定义风格';
}

/**
 * 关闭风格编辑弹窗
 */
function closeStyleEditor() {
    const modal = document.getElementById('styleEditorModal');
    const textarea = document.getElementById('styleEditorTextarea');

    modal.classList.remove('show');
    // 解除只读状态（如果之前设置了只读）
    textarea.readOnly = false;
}

/**
 * 保存风格语句
 */
function saveStyleMessages() {
    // 如果是编辑AI语录，调用专门的保存函数
    if (currentEditingAI) {
        saveAIPhrasesEditor();
        return;
    }

    const textarea = document.getElementById('styleEditorTextarea');
    const messages = textarea.value.trim().split('\n').filter(line => line.trim());

    if (currentEditingType === 'encourage') {
        // 保存鼓励语句
        if (currentEditingStyle.startsWith('custom-')) {
            // 自定义风格直接保存
            customStyles.encourage[currentEditingStyle] = messages;
        } else {
            // 预设风格保存为修改版本
            const modifiedKey = `modified-${currentEditingStyle}`;
            customStyles.encourage[modifiedKey] = messages;
        }
    } else {
        // 保存督促语句
        const normalMessages = [];
        const annoyedMessages = [];
        const angryMessages = [];

        let currentLevel = 'normal';
        messages.forEach(line => {
            if (line.includes('=== 正常提醒 ===')) {
                currentLevel = 'normal';
            } else if (line.includes('=== 烦恼提醒 ===')) {
                currentLevel = 'annoyed';
            } else if (line.includes('=== 生气提醒 ===')) {
                currentLevel = 'angry';
            } else if (line.trim()) {
                if (currentLevel === 'normal') {
                    normalMessages.push(line);
                } else if (currentLevel === 'annoyed') {
                    annoyedMessages.push(line);
                } else {
                    angryMessages.push(line);
                }
            }
        });

        if (currentEditingStyle.startsWith('custom-')) {
            // 自定义风格直接保存
            customStyles.remind[currentEditingStyle] = {
                normal: normalMessages,
                annoyed: annoyedMessages,
                angry: angryMessages
            };
        } else {
            // 预设风格保存为修改版本
            const modifiedKey = `modified-${currentEditingStyle}`;
            customStyles.remind[modifiedKey] = {
                normal: normalMessages,
                annoyed: annoyedMessages,
                angry: angryMessages
            };
        }
    }

    saveCustomStyles();
    closeStyleEditor();
    alert('语句已保存！修改将在专注页面生效。');
}

/**
 * 保存AI语录编辑
 */
function saveAIPhrasesEditor() {
    const textarea = document.getElementById('styleEditorTextarea');
    const messages = textarea.value.trim().split('\n').filter(line => line.trim());

    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];

    if (!currentOC) {
        alert('OC不存在');
        return;
    }

    if (!currentOC.aiPhrases) {
        currentOC.aiPhrases = {};
    }

    if (currentAICategory === 'encouragements') {
        // 保存修改后的鼓励语
        currentOC.aiPhrases.encouragements = messages;
        console.log('✅ AI鼓励语已更新，共', messages.length, '条');
    } else if (currentAICategory === 'reminders') {
        // 解析并保存修改后的督促语
        const normalMessages = [];
        const annoyedMessages = [];
        const angryMessages = [];

        let currentLevel = 'normal';
        messages.forEach(line => {
            if (line.includes('=== 正常提醒 ===')) {
                currentLevel = 'normal';
            } else if (line.includes('=== 烦恼提醒 ===')) {
                currentLevel = 'annoyed';
            } else if (line.includes('=== 生气提醒 ===')) {
                currentLevel = 'angry';
            } else if (line.trim()) {
                if (currentLevel === 'normal') {
                    normalMessages.push(line);
                } else if (currentLevel === 'annoyed') {
                    annoyedMessages.push(line);
                } else {
                    angryMessages.push(line);
                }
            }
        });

        currentOC.aiPhrases.reminders = {
            normal: normalMessages,
            annoyed: annoyedMessages,
            angry: angryMessages
        };
        console.log('✅ AI督促语已更新，正常:', normalMessages.length, '条，烦恼:', annoyedMessages.length, '条，生气:', angryMessages.length, '条');
    }

    // 保存到localStorage
    persistOCData();

    closeStyleEditor();
    alert('AI语录已保存！修改将在专注页面生效。');
}

/**
 * 保存自定义风格到localStorage
 */
function saveCustomStyles() {
    localStorage.setItem('customStyles', JSON.stringify(customStyles));
}

/**
 * 从localStorage加载自定义风格
 */
function loadCustomStyles() {
    const saved = localStorage.getItem('customStyles');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            customStyles = {
                encourage: loaded.encourage || {},
                remind: loaded.remind || {},
                metadata: loaded.metadata || {}
            };
        } catch (e) {
            console.error('加载自定义风格失败:', e);
        }
    }
}

/**
 * 生成所有类型的语录（问候语、鼓励语、督促语）
 * 自动调用API生成所有类型，并保存到当前OC对象中
 * ⚠️ 此函数保留用于其他地方调用，UI上已改用 saveBasicInfoAndSync()
 */
async function generateAllPhrasesFromUI() {
    // 获取用户输入
    const description = document.getElementById('characterDescription').value.trim();
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];
    const userTitle = currentOC?.userTitle || '大小姐';

    // 验证输入
    if (!description) {
        alert('请先输入角色人设描述');
        return;
    }

    // 显示加载状态
    const btn = document.getElementById('confirmBtn');
    const testResults = document.getElementById('testResults');

    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> 生成中...';
    testResults.textContent = '正在生成语录，请稍候...';

    try {
        // 保存到历史记录
        saveAIPromptToHistory(description);

        // 调用批量生成API
        const response = await generateAllPhrases({
            description: description,
            userTitle: userTitle,
            generateGreetings: true,
            generateEncouragements: true,
            generateReminders: true,
            reminderLevels: ['normal', 'annoyed', 'angry'],
            greetingQuantity: 5,
            encourageQuantity: 5,
            remindQuantity: 5,
            referenceStyle: null
        });

        if (response.success) {
            // ✅ 新增：保存AI生成的语录到当前OC对象
            const generatedData = response.data;

            // 初始化或更新OC的aiPhrases属性
            if (!currentOC.aiPhrases) {
                currentOC.aiPhrases = {};
            }

            // 保存问候语
            currentOC.aiPhrases.greetings = generatedData.greetings || [];

            // 保存鼓励语
            currentOC.aiPhrases.encouragements = generatedData.encouragements || [];

            // 保存督促语（按级别保存）
            currentOC.aiPhrases.reminders = generatedData.reminders || {};

            // 保存人设描述（用于后续重新生成）
            currentOC.characterDescription = description;

            // 保存到localStorage
            persistOCData();

            // ✅ 自动更新AI聊天上下文
            if (typeof updateChatContext === 'function') {
                try {
                    updateChatContext();
                    console.log('✅ AI聊天上下文已自动更新，新人设立即生效');
                } catch (e) {
                    console.log('⚠️ 更新聊天上下文时出错:', e);
                }
            }

            // 格式化结果用于显示
            const formattedResults = formatResultsForDisplay(generatedData);

            // 显示在测试结果框
            testResults.textContent = formattedResults + '\n\n✅ 已保存到 OC 设置！\n✅ AI聊天上下文已自动更新！';

            // 保存到全局变量（供后续使用）
            aiGeneratedPhrases = generatedData;

            console.log('生成成功并已保存到OC！', generatedData);
            console.log('更新后的OC数据：', currentOC);
        } else {
            testResults.textContent = `❌ 生成失败：${response.error}`;
            alert(`生成失败：${response.error}`);
        }

    } catch (error) {
        console.error('生成语录时出错：', error);
        testResults.textContent = `❌ 错误：${error.message}`;
        alert(`生成失败：${error.message}`);
    } finally {
        // 恢复按钮状态
        btn.disabled = false;
        btn.innerHTML = `
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>✓ 确定</span>
        `;
    }
}

/**
 * 格式化生成结果用于显示
 */
function formatResultsForDisplay(data) {
    let output = '';
    let totalCount = 0;

    output += '═══════════════════════════════════════\n';
    output += '✨ AI 语录生成结果\n';
    output += '═══════════════════════════════════════\n\n';

    // 问候语
    if (data.greetings && data.greetings.length > 0) {
        output += '📝 问候语（' + data.greetings.length + '条）\n';
        output += '───────────────────────────────────────\n';
        data.greetings.forEach((phrase, index) => {
            output += `${index + 1}. ${phrase}\n`;
        });
        output += '\n';
        totalCount += data.greetings.length;
    }

    // 鼓励语
    if (data.encouragements && data.encouragements.length > 0) {
        output += '💪 鼓励语（' + data.encouragements.length + '条）\n';
        output += '───────────────────────────────────────\n';
        data.encouragements.forEach((phrase, index) => {
            output += `${index + 1}. ${phrase}\n`;
        });
        output += '\n';
        totalCount += data.encouragements.length;
    }

    // 督促语（按级别分组）
    if (data.reminders) {
        const levels = {
            normal: '正常提醒',
            annoyed: '烦恼提醒',
            angry: '生气提醒'
        };

        for (const [levelKey, levelName] of Object.entries(levels)) {
            if (data.reminders[levelKey] && data.reminders[levelKey].length > 0) {
                output += `⚠️  督促语 - ${levelName}（${data.reminders[levelKey].length}条）\n`;
                output += '───────────────────────────────────────\n';
                data.reminders[levelKey].forEach((phrase, index) => {
                    output += `${index + 1}. ${phrase}\n`;
                });
                output += '\n';
                totalCount += data.reminders[levelKey].length;
            }
        }
    }

    output += '═══════════════════════════════════════\n';
    output += `✅ 共生成 ${totalCount} 条语录\n`;
    output += '═══════════════════════════════════════';

    return output;
}

// 全局变量：存储生成的语录
let aiGeneratedPhrases = null;




// 渲染AI生成结果
function renderAIResults() {
    const container = document.getElementById('generatedResults');
    if (!container) return;
    
    if (aiGeneratedResults.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <p>输入角色人设描述，点击"生成鼓励语"开始创造专属于你的OC语言</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = aiGeneratedResults.map(result => `
        <div class="result-item" data-id="${result.id}">
            <div class="result-text" ${result.isEditing ? 'contenteditable="true"' : ''}>${result.text}</div>
            <div class="result-actions">
                <button class="result-btn edit-btn" onclick="toggleAIEdit(${result.id})">
                    ${result.isEditing ? '保存' : '编辑'}
                </button>
                <button class="result-btn adopt-btn" onclick="adoptAIResult(${result.id})">采用</button>
                <button class="result-btn regenerate-btn" onclick="regenerateAIOne(${result.id})">重新生成</button>
                <button class="result-btn delete-btn" onclick="deleteAIResult(${result.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// 切换AI结果编辑模式
function toggleAIEdit(id) {
    const result = aiGeneratedResults.find(r => r.id === id);
    if (!result) return;
    
    if (result.isEditing) {
        // 保存编辑
        const element = document.querySelector(`[data-id="${id}"] .result-text`);
        result.text = element.textContent.trim();
        result.isEditing = false;
    } else {
        // 进入编辑模式
        result.isEditing = true;
    }
    
    renderAIResults();
}

// 采用AI生成的结果
function adoptAIResult(id) {
    const result = aiGeneratedResults.find(r => r.id === id);
    if (!result) return;
    
    // 将鼓励语添加到当前编辑的OC的自定义鼓励语风格中
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];
    
    // 创建自定义AI风格（如果不存在）
    const aiStyleId = `custom-ai-${ocIndex}`;
    if (!customStyles.encourage[aiStyleId]) {
        customStyles.encourage[aiStyleId] = [];
        if (!customStyles.metadata) {
            customStyles.metadata = {};
        }
        customStyles.metadata[aiStyleId] = {
            title: 'AI生成',
            type: 'encourage',
            desc: 'AI基于人设生成的鼓励语'
        };
    }
    
    // 添加鼓励语
    customStyles.encourage[aiStyleId].push(result.text);
    
    // 确保OC选择了这个风格
    if (!currentOC.encourageStyles.includes(aiStyleId)) {
        currentOC.encourageStyles.push(aiStyleId);
    }
    
    // 保存
    saveCustomStyles();
    persistOCData();
    
    alert(`已采用鼓励语：${result.text.substring(0, 30)}...`);
    
    // 重新渲染风格选择区域
    renderCustomStylesInGrid('encourage');
    selectStyleOptions('encourageStyleGrid', currentOC.encourageStyles);
}

// 重新生成单个AI结果
function regenerateAIOne(id) {
    const currentOC = ocData[editingOCIndex >= 0 ? editingOCIndex : currentOCIndex];
    const userTitle = currentOC.userTitle || '大小姐';
    
    const mockResults = [
        `${userTitle}，你的专注让我想起了舞台上最闪耀的时刻～`,
        `加油哦！我会用最温柔的歌声为你打气的！`,
        `看着你努力的样子，我的心都被温暖了呢～`
    ];
    
    const result = aiGeneratedResults.find(r => r.id === id);
    if (result) {
        result.text = mockResults[Math.floor(Math.random() * mockResults.length)];
        renderAIResults();
    }
}

// 删除AI结果
function deleteAIResult(id) {
    aiGeneratedResults = aiGeneratedResults.filter(r => r.id !== id);
    renderAIResults();
}

// 保存AI Prompt到历史
function saveAIPromptToHistory(description) {
    const existing = aiPromptHistory.find(item => item.text === description);
    if (existing) {
        existing.lastUsed = new Date().toISOString();
    } else {
        aiPromptHistory.unshift({
            id: Date.now(),
            text: description,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        });
    }
    
    // 限制历史记录数量
    if (aiPromptHistory.length > 10) {
        aiPromptHistory = aiPromptHistory.slice(0, 10);
    }
    
    localStorage.setItem('aiPromptHistory', JSON.stringify(aiPromptHistory));
    renderAIPromptHistory();
}

// 渲染AI Prompt历史
function renderAIPromptHistory() {
    const container = document.getElementById('promptHistory');
    if (!container) return;
    
    if (aiPromptHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <p>暂无历史人设记录</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = aiPromptHistory.map(item => `
        <div class="history-item" onclick="loadAIPrompt('${item.id}')">
            <div class="history-text">${item.text}</div>
            <div class="history-date">${new Date(item.lastUsed).toLocaleDateString()}</div>
            <button class="history-delete" onclick="event.stopPropagation(); deleteAIPrompt('${item.id}')">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        </div>
    `).join('');
}

// 加载AI历史prompt
function loadAIPrompt(id) {
    const prompt = aiPromptHistory.find(p => p.id == id);
    if (prompt) {
        const input = document.getElementById('characterDescription');
        if (input) {
            input.value = prompt.text;
            input.dispatchEvent(new Event('input'));
        }
    }
}

// 删除AI历史prompt
function deleteAIPrompt(id) {
    aiPromptHistory = aiPromptHistory.filter(p => p.id != id);
    localStorage.setItem('aiPromptHistory', JSON.stringify(aiPromptHistory));
    renderAIPromptHistory();
}

// 切换AI区域显示
function toggleAISection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const isVisible = section.style.display !== 'none';
    
    if (isVisible) {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
    }
    
    // 切换图标
    const toggleBtn = event.currentTarget;
    const icon = toggleBtn.querySelector('.collapse-icon');
    if (icon) {
        icon.classList.toggle('collapsed', !isVisible);
    }
}


// 初始化AI鼓励语功能
function initAIEncouragement() {
    // 字数统计
    const charDescInput = document.getElementById('characterDescription');
    if (charDescInput) {
        charDescInput.addEventListener('input', function(e) {
            const text = e.target.value;
            const length = text.length;
            const counter = document.getElementById('charCounter');
            
            if (counter) {
                counter.textContent = `${length}/500`;
                
                if (length > 450) {
                    counter.className = 'char-counter error';
                } else if (length > 400) {
                    counter.className = 'char-counter warning';
                } else {
                    counter.className = 'char-counter';
                }
            }
        });
    }
    
    // 加载历史记录
    renderAIPromptHistory();
}

// 生成AI鼓励语（调用真实API）
async function generateAIEncouragements() {
    const description = document.getElementById('characterDescription').value.trim();
    const quantity = parseInt(document.getElementById('quantitySelect').value);
    const currentOC = ocData[editingOCIndex >= 0 ? editingOCIndex : currentOCIndex];
    const userTitle = currentOC.userTitle || '大小姐';
    
    if (!description) {
        alert('请先输入角色人设描述');
        return;
    }
    
    // 显示加载状态
    const btn = document.getElementById('generateBtn');
    btn.classList.add('loading');
    btn.disabled = true;
    btn.innerHTML = `
        <div class="loading-spinner"></div>
        生成中...
    `;
    
    // 保存到历史记录
    saveAIPromptToHistory(description);
    
    // 调用API
    const response = await generateEncouragements(description, quantity, userTitle);
    
    if (response.success) {
        // 处理成功结果
        aiGeneratedResults = response.data.results.map((text, index) => ({
            id: Date.now() + index,
            text: text,
            isEditing: false
        }));
        renderAIResults();
    } else {
        // 处理错误
        const errorMessage = handleAPIError(response.error);
        alert(errorMessage);
    }
    
    // 恢复按钮状态
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.innerHTML = `
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        生成鼓励语
    `;
}




// 渲染AI生成结果
function renderAIResults() {
    const container = document.getElementById('generatedResults');
    if (!container) return;
    
    if (aiGeneratedResults.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <p>输入角色人设描述，点击"生成鼓励语"开始创造专属于你的OC语言</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = aiGeneratedResults.map(result => `
        <div class="result-item" data-id="${result.id}">
            <div class="result-text" ${result.isEditing ? 'contenteditable="true"' : ''}>${result.text}</div>
            <div class="result-actions">
                <button class="result-btn edit-btn" onclick="toggleAIEdit(${result.id})">
                    ${result.isEditing ? '保存' : '编辑'}
                </button>
                <button class="result-btn adopt-btn" onclick="adoptAIResult(${result.id})">采用</button>
                <button class="result-btn regenerate-btn" onclick="regenerateAIOne(${result.id})">重新生成</button>
                <button class="result-btn delete-btn" onclick="deleteAIResult(${result.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// 切换AI结果编辑模式
function toggleAIEdit(id) {
    const result = aiGeneratedResults.find(r => r.id === id);
    if (!result) return;
    
    if (result.isEditing) {
        // 保存编辑
        const element = document.querySelector(`[data-id="${id}"] .result-text`);
        result.text = element.textContent.trim();
        result.isEditing = false;
    } else {
        // 进入编辑模式
        result.isEditing = true;
    }
    
    renderAIResults();
}

// 采用AI生成的结果
function adoptAIResult(id) {
    const result = aiGeneratedResults.find(r => r.id === id);
    if (!result) return;
    
    // 将鼓励语添加到当前编辑的OC的自定义鼓励语风格中
    const ocIndex = editingOCIndex >= 0 ? editingOCIndex : currentOCIndex;
    const currentOC = ocData[ocIndex];
    
    // 创建自定义AI风格（如果不存在）
    const aiStyleId = `custom-ai-${ocIndex}`;
    if (!customStyles.encourage[aiStyleId]) {
        customStyles.encourage[aiStyleId] = [];
        if (!customStyles.metadata) {
            customStyles.metadata = {};
        }
        customStyles.metadata[aiStyleId] = {
            title: 'AI生成',
            type: 'encourage',
            desc: 'AI基于人设生成的鼓励语'
        };
    }
    
    // 添加鼓励语
    customStyles.encourage[aiStyleId].push(result.text);
    
    // 确保OC选择了这个风格
    if (!currentOC.encourageStyles.includes(aiStyleId)) {
        currentOC.encourageStyles.push(aiStyleId);
    }
    
    // 保存
    saveCustomStyles();
    persistOCData();
    
    alert(`已采用鼓励语：${result.text.substring(0, 30)}...`);
    
    // 重新渲染风格选择区域
    renderCustomStylesInGrid('encourage');
    selectStyleOptions('encourageStyleGrid', currentOC.encourageStyles);
}

// 重新生成单个AI结果
async function regenerateAIOne(id) {
    const description = document.getElementById('characterDescription').value.trim();
    const currentOC = ocData[editingOCIndex >= 0 ? editingOCIndex : currentOCIndex];
    const userTitle = currentOC.userTitle || '大小姐';
    
    if (!description) {
        alert('请输入角色人设描述');
        return;
    }
    
    const response = await regenerateSingleEncouragement(description, userTitle);
    
    if (response.success) {
        const result = aiGeneratedResults.find(r => r.id === id);
        if (result) {
            result.text = response.data;
            renderAIResults();
        }
    } else {
        const errorMessage = handleAPIError(response.error);
        alert(errorMessage);
    }
}

// 删除AI结果
function deleteAIResult(id) {
    aiGeneratedResults = aiGeneratedResults.filter(r => r.id !== id);
    renderAIResults();
}

// 保存AI Prompt到历史
function saveAIPromptToHistory(description) {
    const existing = aiPromptHistory.find(item => item.text === description);
    if (existing) {
        existing.lastUsed = new Date().toISOString();
    } else {
        aiPromptHistory.unshift({
            id: Date.now(),
            text: description,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        });
    }
    
    // 限制历史记录数量
    if (aiPromptHistory.length > 10) {
        aiPromptHistory = aiPromptHistory.slice(0, 10);
    }
    
    localStorage.setItem('aiPromptHistory', JSON.stringify(aiPromptHistory));
    renderAIPromptHistory();
}



// 加载AI历史prompt
function loadAIPrompt(id) {
    const prompt = aiPromptHistory.find(p => p.id == id);
    if (prompt) {
        const input = document.getElementById('characterDescription');
        if (input) {
            input.value = prompt.text;
            input.dispatchEvent(new Event('input'));
        }
    }
}

// 删除AI历史prompt
function deleteAIPrompt(id) {
    aiPromptHistory = aiPromptHistory.filter(p => p.id != id);
    localStorage.setItem('aiPromptHistory', JSON.stringify(aiPromptHistory));
    renderAIPromptHistory();
}

// 切换AI区域显示
function toggleAISection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const isVisible = section.style.display !== 'none';
    
    if (isVisible) {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
    }
    
    // 切换图标
    const toggleBtn = event.currentTarget;
    const icon = toggleBtn.querySelector('.collapse-icon');
    if (icon) {
        icon.classList.toggle('collapsed', !isVisible);
    }
}
 // API配置相关函数
function toggleAPIConfig() {
    const panel = document.getElementById('apiConfigPanel');
    const toggleText = document.getElementById('apiConfigToggleText');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        toggleText.textContent = '收起设置 ▲';
        
        // 加载已保存的配置
        loadSavedAPIConfig();
    } else {
        panel.classList.add('hidden');
        toggleText.textContent = '展开设置 ▼';
    }
}
// API配置显示/隐藏功能
function toggleAPIConfig() {
    const panel = document.getElementById('apiConfigPanel');
    const toggleText = document.getElementById('apiConfigToggleText');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        toggleText.textContent = '收起设置 ▲';
        
        // 加载已保存的配置
        loadSavedAPIConfig();
    } else {
        panel.classList.add('hidden');
        toggleText.textContent = '展开设置 ▼';
    }
}

// API密钥可见性切换
function toggleAPIKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('apiKeyVisibilityIcon');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
        `;
    } else {
        input.type = 'password';
        icon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        `;
    }
}

// AI服务切换处理
function onAIServiceChange() {
    const service = document.getElementById('aiServiceSelect').value;
    const urlInput = document.getElementById('apiUrlInput');
    const modelInput = document.getElementById('modelInput');
    
    // 预设的API URL
    const presetUrls = {
        'openai': 'https://api.openai.com/v1/chat/completions',
        'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        'deepseek': 'https://api.deepseek.com/v1/chat/completions',
        'doubao': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        'custom': ''
    };
    
    // 预设的模型
    const presetModels = {
        'openai': 'gpt-3.5-turbo',
        'gemini': 'gemini-pro',
        'deepseek': 'deepseek-chat',
        'doubao': 'ep-20241129163851-8qmzh',
        'custom': ''
    };
    
    if (service === 'custom') {
        urlInput.value = '';
        urlInput.placeholder = '请输入完整的API URL';
        modelInput.value = '';
    } else {
        urlInput.value = presetUrls[service] || '';
        modelInput.value = presetModels[service] || '';
    }
}


function toggleAPIKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('apiKeyVisibilityIcon');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
        `;
    } else {
        input.type = 'password';
        icon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        `;
    }
}

function loadSavedAPIConfig() {
    const savedService = localStorage.getItem('aiService') || 'openai';
    const savedKey = localStorage.getItem('apiKey') || '';
    
    document.getElementById('aiServiceSelect').value = savedService;
    document.getElementById('apiKeyInput').value = savedKey;
}

function saveAPIConfig() {
    const service = document.getElementById('aiServiceSelect').value;
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    
    if (!apiKey) {
        alert('请输入API密钥');
        return;
    }
    
    // 保存到localStorage和内存
    saveAPIConfig(apiKey, service);
    
    // 显示成功提示
    const btn = event.currentTarget;
    const originalText = btn.textContent;
    btn.textContent = '✓ 配置已保存';
    btn.classList.add('bg-green-500');
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('bg-green-500');
    }, 2000);
    
    // 自动收起配置面板
    setTimeout(() => {
        document.getElementById('apiConfigPanel').classList.add('hidden');
        document.getElementById('apiConfigToggleText').textContent = '展开设置 ▼';
    }, 2000);
}

// API配置保存函数
function saveAPIConfiguration() {
    const service = document.getElementById('aiServiceSelect').value;
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    
    if (!apiKey) {
        alert('请输入API密钥');
        return;
    }
    
    // 保存到localStorage和内存
    saveAPIConfig(apiKey, service);
    
    // 显示成功提示
    const btn = event.currentTarget;
    const originalText = btn.textContent;
    btn.textContent = '✔ 配置已保存';
    btn.classList.add('bg-green-500');
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('bg-green-500');
    }, 2000);
    
    // 自动收起配置面板
    setTimeout(() => {
        document.getElementById('apiConfigPanel').classList.add('hidden');
        document.getElementById('apiConfigToggleText').textContent = '展开设置 ▼';
    }, 2000);
}

// API服务切换处理
function onAIServiceChange() {
    const service = document.getElementById('aiServiceSelect').value;
    const urlContainer = document.getElementById('apiUrlContainer');
    const urlInput = document.getElementById('apiUrlInput');
    const urlHint = document.getElementById('apiUrlHint');
    const modelContainer = document.getElementById('modelContainer');
    const modelInput = document.getElementById('modelInput');
    
    // 预设的API URL
    const presetUrls = {
        'openai': 'https://api.openai.com/v1/chat/completions',
        'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        'deepseek': 'https://api.deepseek.com/v1/chat/completions',
        'doubao': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        'custom': ''
    };
    
    // 预设的模型
    const presetModels = {
        'openai': 'gpt-3.5-turbo',
        'gemini': 'gemini-pro',
        'deepseek': 'deepseek-chat',
        'doubao': 'ep-20241129163851-8qmzh',
        'custom': ''
    };
    
    if (service === 'custom') {
        urlInput.value = '';
        urlInput.placeholder = '请输入完整的API URL';
        urlHint.textContent = '输入你的自定义API端点地址';
        modelInput.value = '';
    } else {
        urlInput.value = presetUrls[service] || '';
        urlHint.textContent = `使用${service}的默认API地址`;
        modelInput.value = presetModels[service] || '';
    }
}


// 加载保存的API配置（覆盖原有函数）
function loadSavedAPIConfig() {
    // ✅ 默认选择 DeepSeek
    const savedService = localStorage.getItem('aiService') || 'deepseek';
    const savedKey = localStorage.getItem('apiKey') || '';
    const savedUrl = localStorage.getItem('apiUrl') || 'https://api.deepseek.com/v1/chat/completions';
    const savedModel = localStorage.getItem('apiModel') || 'deepseek-chat';

    document.getElementById('aiServiceSelect').value = savedService;
    document.getElementById('apiKeyInput').value = savedKey;
    document.getElementById('apiUrlInput').value = savedUrl;
    document.getElementById('modelInput').value = savedModel;

    // 触发服务切换以更新UI
    onAIServiceChange();

    // ✅ 加载并显示所有保存的配置
    renderSavedConfigs();
}

// 保存API配置（覆盖原有函数）
function saveAPIConfiguration() {
    const service = document.getElementById('aiServiceSelect').value;
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const apiUrl = document.getElementById('apiUrlInput').value.trim();
    const model = document.getElementById('modelInput').value.trim();

    if (!apiKey) {
        alert('请输入API密钥');
        return;
    }

    if (!apiUrl) {
        alert('请输入API URL');
        return;
    }

    if (!model) {
        alert('请输入模型名称');
        return;
    }

    // ✅ 检查是否与现有配置相同
    const configs = getSavedConfigs();
    let configNum = configs.length + 1;

    // 检查是否已经存在相同的配置
    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        if (config.service === service &&
            config.apiKey === apiKey &&
            config.apiUrl === apiUrl &&
            config.model === model) {
            // 相同配置，不重复保存
            alert('⚠️ 此配置已存在，无需重复保存');
            return;
        }
    }

    // ✅ 保存新配置到 localStorage
    const newConfig = {
        service,
        apiKey,
        apiUrl,
        model,
        timestamp: Date.now()
    };

    configs.push(newConfig);
    localStorage.setItem('apiConfigs', JSON.stringify(configs));

    // ✅ 同时更新当前使用的配置
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('aiService', service);
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('apiModel', model);

    // 更新内存中的配置
    window.apiConfig = {
        apiKey: apiKey,
        aiService: service,
        apiUrl: apiUrl,
        apiModel: model
    };

    // 显示成功提示
    const btn = document.querySelector('[onclick="saveAPIConfiguration()"]');
    const originalText = btn.textContent;
    btn.textContent = `✔ 已保存为配置${configNum}`;

    // ✅ 重新渲染配置列表
    renderSavedConfigs();

    setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('bg-green-500');
    }, 2000);

    // 自动收起配置面板
    setTimeout(() => {
        document.getElementById('apiConfigPanel').classList.add('hidden');
        document.getElementById('apiConfigToggleText').textContent = '展开设置 ▼';
    }, 2000);
}

/**
 * 获取所有保存的配置
 * @returns {Array} 配置数组
 */
function getSavedConfigs() {
    const configsJson = localStorage.getItem('apiConfigs');
    return configsJson ? JSON.parse(configsJson) : [];
}

/**
 * 渲染已保存的配置按钮
 */
function renderSavedConfigs() {
    const configs = getSavedConfigs();
    const container = document.getElementById('savedConfigsContainer');
    const list = document.getElementById('savedConfigsList');

    // 如果没有配置，隐藏容器
    if (configs.length === 0) {
        container.classList.add('hidden');
        return;
    }

    // 显示容器
    container.classList.remove('hidden');

    // 清空现有按钮
    list.innerHTML = '';

    // 为每个配置创建按钮
    configs.forEach((config, index) => {
        const configNum = index + 1;
        const serviceNames = {
            'openai': 'OpenAI',
            'gemini': 'Gemini',
            'deepseek': 'DeepSeek',
            'doubao': '豆包',
            'custom': '自定义'
        };

        const serviceName = serviceNames[config.service] || config.service;
        const buttonText = `配置${configNum} (${serviceName})`;

        // 创建按钮容器（用于相对定位删除按钮）
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'relative inline-block';

        // 创建配置按钮
        const button = document.createElement('button');
        button.className = 'px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-slate-200 text-slate-600 text-xs font-medium hover:bg-white hover:border-purple-300 transition-all shadow-sm whitespace-nowrap';
        button.textContent = buttonText;
        button.onclick = () => applyConfiguration(index);

        // 创建删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = '删除此配置';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // 防止触发应用配置
            deleteConfiguration(index);
        };

        // 组装
        buttonContainer.appendChild(button);
        buttonContainer.appendChild(deleteBtn);
        list.appendChild(buttonContainer);
    });
}

/**
 * 应用指定的配置
 * @param {number} index - 配置索引
 */
function applyConfiguration(index) {
    const configs = getSavedConfigs();

    if (index < 0 || index >= configs.length) {
        alert('配置不存在');
        return;
    }

    const config = configs[index];

    // 应用到当前UI
    document.getElementById('aiServiceSelect').value = config.service;
    document.getElementById('apiKeyInput').value = config.apiKey;
    document.getElementById('apiUrlInput').value = config.apiUrl;
    document.getElementById('modelInput').value = config.model;

    // 更新全局配置
    window.apiConfig = {
        apiKey: config.apiKey,
        aiService: config.service,
        apiUrl: config.apiUrl,
        apiModel: config.model
    };

    // 同时更新当前使用的配置
    localStorage.setItem('apiKey', config.apiKey);
    localStorage.setItem('aiService', config.service);
    localStorage.setItem('apiUrl', config.apiUrl);
    localStorage.setItem('apiModel', config.model);

    // 触发服务切换以更新UI
    onAIServiceChange();

    // 显示提示（使用Toast更好，这里用简化版）
    const serviceNames = {
        'openai': 'OpenAI',
        'gemini': 'Gemini',
        'deepseek': 'DeepSeek',
        'doubao': '豆包',
        'custom': '自定义'
    };
    const serviceName = serviceNames[config.service] || config.service;
    const configNum = index + 1;

    // 简单的视觉反馈 - 通过事件对象获取按钮
    // 注意：由于按钮是通过onclick触发的，我们需要从window.event获取
    const clickedBtn = window.event?.currentTarget;
    if (clickedBtn) {
        const originalBg = clickedBtn.style.backgroundColor;
        clickedBtn.style.backgroundColor = '#dcfce7'; // 浅绿色
        clickedBtn.textContent = `✓ 已应用`;

        setTimeout(() => {
            clickedBtn.style.backgroundColor = originalBg;
            clickedBtn.textContent = `配置${configNum} (${serviceName})`;
        }, 1000);
    }
}

/**
 * 删除指定的配置
 * @param {number} index - 配置索引
 */
function deleteConfiguration(index) {
    const configs = getSavedConfigs();

    if (index < 0 || index >= configs.length) {
        alert('配置不存在');
        return;
    }

    if (!confirm(`确定要删除配置${index + 1}吗？`)) {
        return;
    }

    // 删除配置
    configs.splice(index, 1);
    localStorage.setItem('apiConfigs', JSON.stringify(configs));

    // 重新渲染
    renderSavedConfigs();

    // 如果删除的是当前使用的配置，清空UI
    if (configs.length === 0) {
        document.getElementById('apiKeyInput').value = '';
        document.getElementById('apiUrlInput').value = 'https://api.deepseek.com/v1/chat/completions';
        document.getElementById('modelInput').value = 'deepseek-chat';
        document.getElementById('aiServiceSelect').value = 'deepseek';
        onAIServiceChange();
    }
}



 window.addEventListener('load', function() {
     initPageAnimation();
 });
