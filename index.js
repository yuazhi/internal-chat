// 创建 WebSocket 连接
const wsUrl = 'wss://transmit.rjjr.cn/ws';

// 初始化全局变量
var users = [];
var me = new XChatUser();
let pendingFile = null;
let currentTransferUser = null;
let notificationPermission = false;
let userNickname = ""; // 存储用户昵称
let currentChatUser = null; // 当前私聊的用户
let privateChatMessages = {}; // 存储私聊消息 {userId: [{sender, content, time}, ...]}
var groupMessages = []; // 存储群聊消息
let pendingMultipleFiles = null; // 存储多文件数据

// 关闭使用须知模态框
function closeUsageInfoModal() {
  document.getElementById('usageInfoModal').style.display = 'none';
  
  // 保存当前时间到localStorage，5小时后再次显示
  localStorage.setItem('usageInfoModalLastShown', Date.now().toString());
}

// 检查当前网络是否支持传输
function checkNetworkStatus() {
  // 模态框中的网络状态指示器
  updateNetworkStatusIndicator('networkStatusIndicator');
  
  // 聊天界面上的网络状态指示器
  updateNetworkStatusIndicator('chatNetworkStatusIndicator');
}

// 更新网络状态指示器
function updateNetworkStatusIndicator(indicatorId) {
  const statusIndicator = document.getElementById(indicatorId);
  if (!statusIndicator) return;
  
  const statusIcon = statusIndicator.querySelector('.status-icon');
  const statusMessage = statusIndicator.querySelector('.status-message');
  
  // 初始状态为检测中
  statusIcon.className = 'status-icon pending';
  statusIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </svg>
  `;
  statusMessage.textContent = indicatorId === 'chatNetworkStatusIndicator' ? '正在检测...' : '正在检测网络连接状态...';
  
  // 检查是否有其他连接的用户，以及是否与他们在同一网络中
  setTimeout(() => {
    const otherUsers = users.filter(u => !u.isMe);
    
    if (otherUsers.length === 0) {
      // 没有其他用户在线
      statusIcon.className = 'status-icon warning';
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <path d="M12 16c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm1-5h-2V7h2v4z"/>
        </svg>
      `;
      
      // 为工具栏提供更简短的消息
      if (indicatorId === 'chatNetworkStatusIndicator') {
        statusMessage.textContent = '未检测到其他用户';
      } else {
        statusMessage.innerHTML = '<strong>未检测到其他用户</strong><br>无法确定网络兼容性，请等待其他用户加入后再尝试传输';
      }
      return;
    }
    
    const sameNetworkUsers = otherUsers.filter(u => u.isSameNetwork());
    const connectedUsers = otherUsers.filter(u => u.isConnected());
    
    if (sameNetworkUsers.length > 0 && connectedUsers.length > 0) {
      // 有同一网络的用户且已连接
      statusIcon.className = 'status-icon success';
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      `;
      
      // 为工具栏提供更简短的消息
      if (indicatorId === 'chatNetworkStatusIndicator') {
        statusMessage.textContent = `网络可用 (${sameNetworkUsers.length}设备)`;
      } else {
        statusMessage.innerHTML = `<strong>网络支持传输</strong><br>检测到 ${sameNetworkUsers.length} 个同网络设备，可以互相传输文件`;
      }
    } else if (sameNetworkUsers.length > 0) {
      // 有同一网络的用户但未连接
      statusIcon.className = 'status-icon warning';
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <path d="M12 16c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm1-5h-2V7h2v4z"/>
        </svg>
      `;
      
      // 为工具栏提供更简短的消息
      if (indicatorId === 'chatNetworkStatusIndicator') {
        statusMessage.textContent = '等待连接建立';
      } else {
        statusMessage.innerHTML = '<strong>网络可能支持传输</strong><br>检测到同网络设备，但尚未建立连接，请稍后再试';
      }
    } else if (otherUsers.length > 0) {
      // 有其他用户但不在同一网络
      statusIcon.className = 'status-icon error';
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
      `;
      
      // 为工具栏提供更简短的消息
      if (indicatorId === 'chatNetworkStatusIndicator') {
        statusMessage.textContent = '网络不兼容';
      } else {
        statusMessage.innerHTML = '<strong>网络不支持传输</strong><br>检测到其他设备，但不在同一网络中，无法传输文件';
      }
    } else {
      // 没有足够信息判断
      statusIcon.className = 'status-icon warning';
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <path d="M12 16c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm1-5h-2V7h2v4z"/>
        </svg>
      `;
      
      // 为工具栏提供更简短的消息
      if (indicatorId === 'chatNetworkStatusIndicator') {
        statusMessage.textContent = '未知网络状态';
      } else {
        statusMessage.innerHTML = '<strong>未知网络状态</strong><br>无法确定网络兼容性，请稍后再试';
      }
    }
  }, 1000); // 延迟1秒检测，以便连接建立
}

// 检查是否需要显示使用须知模态框
function checkShowUsageInfoModal() {
  const lastShownTime = localStorage.getItem('usageInfoModalLastShown');
  
  // 如果从未显示过，或者已经过了5小时，则显示模态框
  if (!lastShownTime || (Date.now() - parseInt(lastShownTime)) > 5 * 60 * 60 * 1000) {
    document.getElementById('usageInfoModal').style.display = 'block';
    // 检查网络状态
    checkNetworkStatus();
  }
}

// 创建音频对象
const notificationSound = new Audio('line.mp3');
notificationSound.volume = 0.5; // 设置音量为50%

// 播放提示音
function playNotificationSound() {
  // 如果页面可见，不播放声音
  if (document.visibilityState === 'visible') return;
  
  // 重置音频到开始位置
  notificationSound.currentTime = 0;
  // 播放音频
  notificationSound.play().catch(error => {});
}

// 请求通知权限
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    notificationPermission = permission === 'granted';
  } catch (error) {}
}

// 发送通知
function sendNotification(title, options = {}) {
  if (!notificationPermission) return;
  
  // 如果页面可见，不发送通知
  if (document.visibilityState === 'visible') return;
  
  const defaultOptions = {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%2364B5F6" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%2364B5F6" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
    silent: false,
    requireInteraction: true
  };

  new Notification(title, { ...defaultOptions, ...options });
  playNotificationSound();
}

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    document.title = '局域网文字/文件P2P传输工具';
  }
});

// 初始化时请求通知权限
requestNotificationPermission();

// 添加消息和链接项的函数
function addLinkItem(uid, file, isPrivate = false, toUser = null) {
  const chatBox = document.querySelector('.chat-wrapper');
  const chatItem = document.createElement('div');
  chatItem.className = `chat-item${uid === me.id ? ' self' : ''}`;
  
  // 生成消息ID用于去重
  const messageId = `file-${uid}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  // 如果是私聊，添加私聊标记
  if (isPrivate) {
    chatItem.classList.add('private-chat');
  } else {
    // 如果不是私聊文件，保存到群聊消息数组中
    groupMessages.push({
      id: messageId,
      sender: uid,
      type: 'file',
      content: file,
      time: new Date().getTime()
    });
    
    // 只保留最近50条群聊消息
    if (groupMessages.length > 50) {
      groupMessages.shift();
    }
  }
  
  // 获取发送者的昵称
  const sender = users.find(u => u.id === uid);
  const displayName = uid === me.id ? 
                    (userNickname ? `${userNickname}（我）` : `${uid}（我）`) : 
                    (sender && sender.nickname ? sender.nickname : uid);
  
  let headerText = displayName;
  
  // 如果是私聊，添加私聊标记
  if (isPrivate) {
    const targetUser = toUser || currentChatUser;
    const targetUserObj = users.find(u => u.id === targetUser);
    const targetName = targetUserObj && targetUserObj.nickname ? targetUserObj.nickname : targetUser;
    
    if (uid === me.id) {
      // 我发送给别人的私聊
      headerText = `${displayName} → ${targetName} (私聊)`;
    } else {
      // 别人发给我的私聊
      headerText = `${displayName} → 我 (私聊)`;
    }
  }
  
  chatItem.innerHTML = `
    <div class="chat-item_user">${headerText}</div>
    <div class="chat-item_content"><a class="file" href="${file.url}" download="${file.name}">[文件] ${getShortFileName(file.name)}</a></div>
  `;
  
  // 添加消息ID属性，用于识别重复消息
  chatItem.dataset.messageId = messageId;
  
  chatBox.appendChild(chatItem);
  chatBox.scrollTop = chatBox.scrollHeight;

  // 保存私聊消息
  if (isPrivate) {
    const targetUserId = toUser || currentChatUser;
    if (!privateChatMessages[targetUserId]) {
      privateChatMessages[targetUserId] = [];
    }
    
    privateChatMessages[targetUserId].push({
      id: messageId,
      sender: uid,
      type: 'file',
      content: file,
      time: new Date().getTime()
    });
  }

  // 发送文件通知
  if (uid !== me.id) {
    const notificationName = sender && sender.nickname ? sender.nickname : uid;
    sendNotification(`新文件 - ${notificationName}`, {
      body: `发送了文件: ${file.name}`,
      tag: 'file-message'
    });
    document.title = `[新文件] ${notificationName}`;
  }
}

function addChatItem(uid, message, isPrivate = false, toUser = null) {
  const chatBox = document.querySelector('.chat-wrapper');
  const chatItem = document.createElement('div');
  chatItem.className = `chat-item${uid === me.id ? ' self' : ''}`;
  
  // 生成消息ID用于去重
  const messageId = `${uid}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  // 如果是私聊，添加私聊标记
  if (isPrivate) {
    chatItem.classList.add('private-chat');
  } else {
    // 如果不是私聊消息，保存到群聊消息数组中
    // 添加messageId用于去重
    groupMessages.push({
      id: messageId,
      sender: uid,
      content: message,
      time: new Date().getTime()
    });
    
    // 只保留最近50条群聊消息
    if (groupMessages.length > 50) {
      groupMessages.shift();
    }
  }
  
  let msg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 判断是否url，兼容端口号的网址,http://127.0.0.1:8080/
  if (/(http|https):\/\/[a-zA-Z0-9\.\-\/\?=\:_]+/g.test(msg)) {
    msg = msg.replace(/(http|https):\/\/[a-zA-Z0-9\.\-\/\?=\:_]+/g, (url) => {
      return `<a href="${url}" target="_blank">${url}</a>`;
    });
  }

  // 获取发送者的昵称
  const sender = users.find(u => u.id === uid);
  const displayName = uid === me.id ? 
                    (userNickname ? `${userNickname}（我）` : `${uid}（我）`) : 
                    (sender && sender.nickname ? sender.nickname : uid);
  
  let headerText = displayName;
  
  // 如果是私聊，添加私聊标记
  if (isPrivate) {
    const targetUser = toUser || currentChatUser;
    const targetUserObj = users.find(u => u.id === targetUser);
    const targetName = targetUserObj && targetUserObj.nickname ? targetUserObj.nickname : targetUser;
    
    if (uid === me.id) {
      // 我发送给别人的私聊
      headerText = `${displayName} → ${targetName} (私聊)`;
    } else {
      // 别人发给我的私聊
      headerText = `${displayName} → 我 (私聊)`;
    }
  }

  chatItem.innerHTML = `
    <div class="chat-item_user">${headerText}</div>
    <div class="chat-item_content"><pre>${msg}</pre></div>
  `;
  
  // 添加消息ID属性，用于识别重复消息
  chatItem.dataset.messageId = messageId;
  
  chatBox.appendChild(chatItem);
  chatBox.scrollTop = chatBox.scrollHeight;

  // 保存私聊消息
  if (isPrivate) {
    const targetUserId = toUser || currentChatUser;
    if (!privateChatMessages[targetUserId]) {
      privateChatMessages[targetUserId] = [];
    }
    
    privateChatMessages[targetUserId].push({
      id: messageId,
      sender: uid,
      type: 'text',
      content: message,
      time: new Date().getTime()
    });
  }

  // 发送通知
  if (uid !== me.id) {
    const notificationName = sender && sender.nickname ? sender.nickname : uid;
    sendNotification(`新消息 - ${notificationName}`, {
      body: message,
      tag: 'chat-message'
    });
    document.title = `[新消息] ${notificationName}`;
  }
}

async function sendMessage(msg) {
  const messageInput = document.getElementById('messageInput');
  const message = msg ?? messageInput.value;
  // 检查消息是否为空或只包含空白字符
  if (!message || !message.trim()) {
    return;
  }

  addChatItem(me.id, message);
  
  // 收集发送失败的用户
  const failedUsers = [];
  
  // 发送消息给所有连接的用户
  const sendPromises = users
    .filter(u => !u.isMe && u.isSameNetwork()) // 只向同一局域网的用户发送
    .map(async u => {
      const success = await u.sendMessage(message);
      if (!success) {
        failedUsers.push(u.id);
      }
    });

  await Promise.all(sendPromises);
  
  // 如果有发送失败的用户，显示提示
  if (failedUsers.length > 0) {
    addChatItem('system', `消息发送失败，以下用户未收到: ${failedUsers.join(', ')}`);
  }
  
  messageInput.value = '';
}

// WebRTC 连接和信令相关函数
function refreshUsers(data) {
  resUsers = data.map(
    u => {
      let uOld = users.find(uOld => uOld.id === u.id)
      if (uOld) {
        // 保留昵称，除非服务器有更新
        if (u.nickname) {
          uOld.nickname = u.nickname;
          // 保存昵称到localStorage
          saveUserNickname(u.id, u.nickname);
        } else {
          // 尝试从localStorage中获取昵称
          const savedNickname = getUserNickname(u.id);
          if (savedNickname) {
            uOld.nickname = savedNickname;
          }
        }
        return uOld;
      }
      let xchatUser = new XChatUser();
      xchatUser.id = u.id;
      xchatUser.isMe = u.id === me.id;
      
      // 优先使用服务器下发的昵称
      if (u.nickname) {
        xchatUser.nickname = u.nickname;
        // 保存昵称到localStorage
        saveUserNickname(u.id, u.nickname);
      } else {
        // 尝试从localStorage中获取昵称
        const savedNickname = getUserNickname(u.id);
        if (savedNickname) {
          xchatUser.nickname = savedNickname;
        }
      }
      
      // 添加连接状态变化监听
      xchatUser.onConnectionStateChange = (state) => {
        refreshUsersHTML(); // 更新用户列表显示
        checkNetworkStatus(); // 更新网络状态指示器
        
        // 如果连接已建立，并且我们有昵称，则发送昵称更新消息
        if (state === 'connected' && userNickname && me.nickname) {
          if (!xchatUser.isMe) {
            xchatUser.sendMessage(JSON.stringify({
              type: 'nickname-update',
              userId: me.id,
              nickname: userNickname
            }));
          }
        }
      };
      
      return xchatUser;
    }
  );

  // 找出删除的用户
  const delUsers = users.filter(u => !resUsers.find(u2 => u2.id === u.id));
  delUsers.forEach(u => {
    u.closeConnection();
  });

  users = resUsers;
  for (const u of users) {
    u.onmessage = (msg) => {
      // 尝试解析消息，查看是否为昵称更新
      try {
        const msgObj = JSON.parse(msg);
        
        // 如果是昵称更新消息
        if (msgObj.type === 'nickname-update') {
          // 找到对应的用户并更新昵称
          const targetUser = users.find(user => user.id === msgObj.userId);
          if (targetUser) {
            targetUser.nickname = msgObj.nickname;
            
            // 保存昵称到localStorage
            saveUserNickname(msgObj.userId, msgObj.nickname);
            
            // 更新UI
            refreshUsersHTML();
          }
          return;
        }
      } catch (e) {
        // 如果不是JSON格式，则当作普通消息处理
      }
      
      // 普通消息
      addChatItem(u.id, msg);
    }
    u.onReviceFile = (file) => {
      addLinkItem(u.id, file);
    }
  }
  refreshUsersHTML();
  checkNetworkStatus(); // 在用户列表更新时刷新网络状态
}

function joinedRoom() {
  connectAllOther();
  
  // 如果有昵称，在加入房间后发送昵称到服务器
  if (userNickname) {
    signalingServer.send(JSON.stringify({
      type: '9004',
      data: {
        id: me.id,
        nickname: userNickname
      }
    }));
  }
}

function connectAllOther() {
  if (users.length <= 1) {
    return;
  }
  const targets = users.filter(u => u.id !== me.id);
  for (const target of targets) {
    target.onicecandidate = (candidate) => {
      signalingServer.send(JSON.stringify({uid: me.id, targetId: target.id, type: '9001', data: { candidate }}));
    }
    target.createConnection().then(() => {
      signalingServer.send(JSON.stringify({uid: me.id, targetId: target.id, type: '9002', data: { targetAddr: target.connAddressMe }}));
    })
  }
}

function addCandidate(data) {
  users.find(u => u.id === data.targetId).addIceCandidate(data.candidate);
}

async function joinConnection(data) {
  const user = users.find(u => u.id === data.targetId)
  if (!user) {
    return;
  }
  user.onicecandidate = (candidate) => {
    signalingServer.send(JSON.stringify({uid: me.id, targetId: user.id, type: '9001', data: { candidate }}));
  }
  await user.connectTarget(data.offer.sdp)
  signalingServer.send(JSON.stringify({uid: me.id, targetId: user.id, type: '9003', data: { targetAddr: user.connAddressMe }}));
}

async function joinedConnection(data) {
  const target = users.find(u => u.id === data.targetId)
  if (!target) {
    return;
  }
  await target.setRemoteSdp(data.answer.sdp);
  refreshUsersHTML();
}

// UI 相关函数
function refreshUsersHTML() {
  // 筛选同一局域网的用户
  const sameNetworkUsers = users.filter(u => u.isSameNetwork());
  
  const onlineCount = sameNetworkUsers.length;
  document.querySelector('.user-count').textContent = `(${onlineCount})`;
  
  const userListHTML = sameNetworkUsers.map(u => {
    const isConnected = u.isMe || u.isConnected();
    
    const statusClass = isConnected ? 'connected' : 'disconnected';
    const statusIcon = isConnected ? 
      `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>` : 
      `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.43-.98 2.63-2.31 2.98l1.46 1.46C20.88 15.61 22 13.95 22 12c0-2.76-2.24-5-5-5zm-1 4h-2.19l2 2H16zM2 4.27l3.11 3.11C3.29 8.12 2 9.91 2 12c0 2.76 2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1 0-1.59 1.21-2.9 2.76-3.07L8.73 11H8v2h2.73L13 15.27V17h1.73l4.01 4L20 19.74 3.27 3 2 4.27z"/></svg>`;
    
    // 显示用户ID或昵称
    const displayName = u.isMe ? 
      (userNickname ? `${userNickname}（我）` : `${u.id}（我）`) :
      (u.nickname ? u.nickname : u.id);
    
    return `
      <li data-user-id="${u.id}" ${!u.isMe ? 'class="clickable"' : ''}>
        <span class="connection-status ${statusClass}">
          ${statusIcon}
        </span>
        ${displayName}
      </li>
    `;
  }).join('');

  document.querySelector('#users').innerHTML = userListHTML;
  updateMobileUsersList();
  
  // 为用户列表项添加右键事件
  if (document.querySelector('#users')) {
    const userItems = document.querySelectorAll('#users li.clickable');
    userItems.forEach(item => {
      item.addEventListener('contextmenu', function(e) {
        e.preventDefault(); // 阻止默认的右键菜单
        
        const userId = this.getAttribute('data-user-id');
        if (userId) {
          const user = users.find(u => u.id === userId);
          if (user && user.isConnected()) {
            showUserActionMenu(user, e); // 传入事件对象而不是元素
          }
        }
      });
    });
  }
}

function enterTxt(event) {
  if (event.ctrlKey || event.shiftKey) {
    return;
  }
  if (event.keyCode === 13) {
    event.preventDefault();
    const message = document.getElementById('messageInput').value.trim();
    if (message) {
      sendMessage(message);
    }
  }
}

// 文件传输相关函数
// 多文件发送函数
async function sendMultipleFiles(files) {
  // 获取所有其他用户，不限制网络
  const otherUsers = users.filter(u => !u.isMe);
  
  // 显示多文件发送模态框，即使没有用户也可以选择文件
  showMultipleFilesModal(files, otherUsers);
}

// 显示多文件发送模态框
function showMultipleFilesModal(files, users) {
  const modal = document.getElementById('userSelectModal');
  const userList = document.getElementById('userSelectList');
  const modalTitle = modal.querySelector('h3');
  
  // 更新模态框标题
  modalTitle.textContent = `选择接收用户 (${files.length} 个文件将直接发送)`;
  
  // 清空之前的列表
  userList.innerHTML = '';
  
  // 显示文件列表
  const filesList = document.createElement('div');
  filesList.className = 'files-list';
  
  // 计算总大小
  let totalSize = 0;
  Array.from(files).forEach((file, index) => {
    totalSize += file.size;
  });
  
  // 在标题中显示总计信息
  filesList.innerHTML = `<h4>选择的文件（将直接发送）：总计 <span style="color: #4CAF50;">${formatFileSize(totalSize)}</span></h4>`;
  
  const filesContainer = document.createElement('div');
  filesContainer.className = 'files-container';
  
  Array.from(files).forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span class="file-icon">📄</span>
      <span class="file-name">${getShortFileName(file.name)}</span>
      <span class="file-size" style="color: #4CAF50;">(${formatFileSize(file.size)})</span>
    `;
    filesContainer.appendChild(fileItem);
  });
  
  filesList.appendChild(filesContainer);
  userList.appendChild(filesList);
  
  // 添加用户选择列表
  const usersList = document.createElement('div');
  usersList.className = 'users-list';
  usersList.innerHTML = '<h4>选择接收用户：</h4>';
  
  if (users.length === 0) {
    const noUsersMsg = document.createElement('div');
    noUsersMsg.className = 'no-users-msg';
    noUsersMsg.innerHTML = '<p>当前没有其他用户在线，无法发送文件。</p>';
    usersList.appendChild(noUsersMsg);
  } else {
    users.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      userItem.innerHTML = `
        <label>
          <input type="checkbox" value="${user.id}" ${user.isSameNetwork() && user.isConnected() ? '' : 'disabled'}>
          <span class="user-name">${getUserNickname(user.id) || user.id}</span>
          <span class="user-status ${user.isSameNetwork() && user.isConnected() ? 'online' : 'offline'}">
            ${user.isSameNetwork() && user.isConnected() ? '在线' : '离线'}
          </span>
        </label>
      `;
      usersList.appendChild(userItem);
    });
  }
  
  userList.appendChild(usersList);
  
  // 保存文件数据供后续使用
  window.pendingMultipleFiles = Array.from(files);
  
  // 显示模态框
  modal.style.display = 'block';
  
  // 更新按钮文本
  const sendButton = modal.querySelector('.modal-footer button:last-child');
  if (sendButton) {
    sendButton.textContent = `发送 ${files.length} 个文件`;
  }
}

async function sendFile(file) {
  pendingFile = file;
  
  // 只获取同一局域网的其他用户
  const otherUsers = users.filter(u => !u.isMe && u.isSameNetwork());
  
  if (otherUsers.length === 0) {
    alert('没有可用的用户。请确保其他用户在同一网络中并且已连接。');
    pendingFile = null;
    return;
  }
  
  if (otherUsers.length === 1) {
    const modal = document.getElementById('userSelectModal');
    const progressContainer = modal.querySelector('.progress-container');
    const progressBar = modal.querySelector('.progress-bar-inner');
    const progressText = modal.querySelector('.progress-text');
    
    try {
      const user = otherUsers[0];
      currentTransferUser = user; // 保存当前传输用户的引用
      const fileInfo = { name: file.name, size: file.size };
      
      // 显示进度条 - 只有一个用户时隐藏选择界面
      modal.style.display = 'block';
      document.getElementById('userSelectList').style.display = 'none';
      modal.querySelector('h3').textContent = '正在发送文件'; // 修改标题
      progressContainer.style.display = 'block';
      
      // 隐藏发送按钮
      const sendButton = modal.querySelector('.modal-footer button:last-child');
      if (sendButton) {
        sendButton.style.display = 'none';
      }
      
      // 单文件发送时隐藏详细的进度信息，只显示简单进度
      const progressDetails = modal.querySelector('.progress-details');
      const progressHeader = modal.querySelector('.progress-header');
      if (progressDetails) progressDetails.style.display = 'none';
      if (progressHeader) progressHeader.style.display = 'none';
      
      // 创建进度回调
      const onProgress = (sent, total) => {
        const progress = (sent / total) * 100;
        progressBar.style.width = progress + '%';
        // 计算传输速度
        const speed = sent / (Date.now() - startTime) * 1000; // 字节/秒
        const speedText = speed > 1024 * 1024 
          ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s`
          : `${(speed / 1024).toFixed(2)} KB/s`;
        progressText.textContent = `正在发送给 ${user.id}... ${speedText}`;
      };
      
      const startTime = Date.now();
      await user.sendFile(fileInfo, file, onProgress);
      addChatItem(me.id, `[文件] ${fileInfo.name} (发送给: ${user.id})`);
    } catch (error) {
      alert('发送文件失败，请重试');
    } finally {
      currentTransferUser = null; // 清除当前传输用户的引用
      // 恢复界面状态
      modal.style.display = 'none';
      document.getElementById('userSelectList').style.display = 'block';
      modal.querySelector('h3').textContent = '选择接收用户'; // 恢复标题文本
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
      
      // 恢复发送按钮显示
      const sendButton = modal.querySelector('.modal-footer button:last-child');
      if (sendButton) {
        sendButton.style.display = 'block';
      }
      
      // 恢复详细进度信息的显示
      const progressDetails = modal.querySelector('.progress-details');
      const progressHeader = modal.querySelector('.progress-header');
      if (progressDetails) progressDetails.style.display = 'block';
      if (progressHeader) progressHeader.style.display = 'flex';
    }
    
    pendingFile = null;
    return;
  }
  
  showUserSelectModal();
}

function showUserSelectModal() {
  const modal = document.getElementById('userSelectModal');
  const userList = document.getElementById('userSelectList');
  const modalTitle = modal.querySelector('h3');
  const confirmBtn = modal.querySelector('.modal-footer button:last-child');
  
  // 只在初始化时设置标题，不重置
  if (modalTitle.textContent !== '正在发送文件') {
    modalTitle.textContent = '选择接收用户';
  }
  confirmBtn.textContent = '发送';
  
  // 清除多文件数据
  pendingMultipleFiles = null;
  
  // 清空之前的列表
  userList.innerHTML = '';
  
  // 单文件发送时隐藏详细的进度信息
  const progressDetails = modal.querySelector('.progress-details');
  const progressHeader = modal.querySelector('.progress-header');
  if (progressDetails) progressDetails.style.display = 'none';
  if (progressHeader) progressHeader.style.display = 'none';
  
  // 添加用户选项 - 只显示同一局域网的用户
  const sameNetworkUsers = users.filter(user => !user.isMe && user.isSameNetwork());
  
  if (sameNetworkUsers.length === 0) {
    userList.innerHTML = '<div class="no-users-message">没有可用的用户。请确保其他用户在同一网络中并且已连接。</div>';
    return;
  }
  
  sameNetworkUsers.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-select-item';
    
    // 不使用 label 的 for 属性，改用包裹的方式
    item.innerHTML = `
      <label>
        <input type="checkbox" value="${user.id}">
        <span>${user.nickname || user.id}</span>
      </label>
    `;
    
    // 点击整行时切换复选框状态
    item.addEventListener('click', (e) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      // 如果点击的是复选框本身，不需要额外处理
      if (e.target === checkbox) return;
      
      checkbox.checked = !checkbox.checked;
      e.preventDefault(); // 阻止事件冒泡
    });
    
    userList.appendChild(item);
  });
  
  modal.style.display = 'block';
}

function cancelSendFile() {
  if (currentTransferUser) {
    currentTransferUser.cancelTransfer();
  }
  const modal = document.getElementById('userSelectModal');
  
  // 清除多文件数据
  pendingMultipleFiles = null;
  
  // 重置模态框标题和按钮文本
  const modalTitle = modal.querySelector('h3');
  const confirmBtn = modal.querySelector('.modal-footer button:last-child');
  modalTitle.textContent = '选择接收用户';
  confirmBtn.textContent = '发送';
  
  // 重置按钮状态
  confirmBtn.disabled = false;
  confirmBtn.style.opacity = '1';
  confirmBtn.style.pointerEvents = 'auto';
  
  // 重置其他元素状态
  const userList = document.getElementById('userSelectList');
  const progressContainer = modal.querySelector('.progress-container');
  const progressBar = modal.querySelector('.progress-bar-inner');
  
  if (userList) userList.style.display = 'block';
  if (progressContainer) progressContainer.style.display = 'none';
  if (progressBar) progressBar.style.width = '0%';
  
  // 确保modal-footer布局正确
  const modalFooter = modal.querySelector('.modal-footer');
  if (modalFooter) {
    modalFooter.style.display = 'flex';
    modalFooter.style.justifyContent = 'flex-end';
    modalFooter.style.alignItems = 'center';
  }
  
  modal.style.display = 'none';
  pendingFile = null;
  currentTransferUser = null;
}

// 确认发送多文件
async function confirmSendMultipleFiles() {
  const modal = document.getElementById('userSelectModal');
  const sendButton = modal.querySelector('.modal-footer button:last-child');
  const progressContainer = modal.querySelector('.progress-container');
  const progressBar = modal.querySelector('.progress-bar-inner');
  const progressText = modal.querySelector('.progress-text');
  const userList = document.getElementById('userSelectList');
  
  // 获取选择的用户 - 只选择同一网络且已连接的用户
  const selectedUsers = Array.from(document.querySelectorAll('#userSelectList input[type="checkbox"]:checked'))
    .map(checkbox => users.find(u => u.id === checkbox.value))
    .filter(u => u && u.isSameNetwork() && u.isConnected());
  
  // 获取文件列表 - 直接获取文件数组
  const filesData = window.pendingMultipleFiles;
  
  if (selectedUsers.length === 0) {
    alert('请选择至少一个接收用户');
    return;
  }
  
  if (filesData && filesData.length > 0) {
    sendButton.disabled = true;
    sendButton.textContent = '正在发送文件...';
    sendButton.style.opacity = '0.5'; // 使用透明度而不是隐藏，避免布局问题
    sendButton.style.pointerEvents = 'none'; // 禁用点击
    userList.style.display = 'none';
    progressContainer.style.display = 'block';
    
    // 修改标题为正在发送文件
    modal.querySelector('h3').textContent = '正在发送文件';
    
    // 多文件发送时显示完整的进度信息
    const progressDetails = modal.querySelector('.progress-details');
    const progressHeader = modal.querySelector('.progress-header');
    if (progressDetails) progressDetails.style.display = 'block';
    if (progressHeader) progressHeader.style.display = 'flex';
    
    try {
      // 验证文件数据
      if (!Array.isArray(filesData) || filesData.length === 0) {
        throw new Error('文件数据无效');
      }
      
      // 显示发送文件的进度
      progressText.textContent = `正在发送 ${filesData.length} 个文件给 ${selectedUsers.length} 个用户...`;
      progressBar.style.width = '0%';
      
      // 记录开始时间
      const startTime = Date.now();
      
      // 初始化进度详细信息
      const currentFileEl = document.getElementById('currentFile');
      const fileProgressEl = document.getElementById('fileProgress');
      const processingSpeedEl = document.getElementById('processingSpeed');
      const estimatedTimeEl = document.getElementById('estimatedTime');
      const progressPercentage = modal.querySelector('.progress-percentage');
      
      if (currentFileEl) currentFileEl.textContent = '准备中...';
      if (fileProgressEl) fileProgressEl.textContent = '0/' + (selectedUsers.length * filesData.length);
      if (processingSpeedEl) processingSpeedEl.textContent = '等待中...';
      if (estimatedTimeEl) estimatedTimeEl.textContent = '计算中...';
      if (progressPercentage) progressPercentage.textContent = '0%';
      
      // 发送文件给所有选中的用户
      const totalUsers = selectedUsers.length;
      const totalFiles = filesData.length;
      const totalOperations = totalUsers * totalFiles; // 总操作数 = 用户数 × 文件数
      let successCount = 0;
      let completedOperations = 0;
      let totalBytesSent = 0;
      
      // 初始化进度显示
      progressBar.style.width = '0%';
      if (fileProgressEl) fileProgressEl.textContent = `0/${totalOperations}`;
      
      for (let i = 0; i < selectedUsers.length; i++) {
        const user = selectedUsers[i];
        progressText.textContent = `正在发送文件给 ${getUserNickname(user.id) || user.id}... (${i + 1}/${totalUsers})`;
        
        try {
          // 为每个用户发送所有文件
          for (let j = 0; j < filesData.length; j++) {
            const file = filesData[j];
            const currentFileIndex = j + 1;
            const currentOperation = completedOperations + 1;
            
            // 更新进度 - 基于总操作数计算真实进度
            const totalProgress = (completedOperations / totalOperations) * 100;
            progressBar.style.width = totalProgress + '%';
            
            // 更新进度百分比显示
            if (progressPercentage) {
              progressPercentage.textContent = Math.round(totalProgress) + '%';
            }
            
            // 更新详细信息 - 显示总体进度
            if (currentFileEl) currentFileEl.textContent = getShortFileName(file.name);
            if (fileProgressEl) fileProgressEl.textContent = `${currentOperation}/${totalOperations}`;
            
            // 计算传输速度
            const elapsedTime = (Date.now() - startTime) / 1000;
            const speed = elapsedTime > 0 ? totalBytesSent / elapsedTime : 0;
            const speedText = speed > 1024 * 1024 
              ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s`
              : `${(speed / 1024).toFixed(2)} KB/s`;
            
            if (processingSpeedEl) processingSpeedEl.textContent = speedText;
            
            // 估算剩余时间
            if (elapsedTime > 0 && completedOperations > 0) {
              const avgTimePerOperation = elapsedTime / completedOperations;
              const remainingOperations = totalOperations - completedOperations;
              const estimatedTime = remainingOperations * avgTimePerOperation;
              const timeText = estimatedTime > 60 
                ? `${Math.round(estimatedTime / 60)}分${Math.round(estimatedTime % 60)}秒`
                : `${Math.round(estimatedTime)}秒`;
              
              if (estimatedTimeEl) estimatedTimeEl.textContent = timeText;
            }
            
            progressText.textContent = `正在发送文件给 ${getUserNickname(user.id) || user.id}`;
            
            const onProgress = (sent, total) => {
              // 计算当前文件进度
              const fileProgress = sent / total;
              const currentOperationProgress = (completedOperations + fileProgress) / totalOperations;
              const currentTotalProgress = currentOperationProgress * 100;
              
              progressBar.style.width = currentTotalProgress + '%';
              
              // 更新进度百分比显示
              if (progressPercentage) {
                progressPercentage.textContent = Math.round(currentTotalProgress) + '%';
              }
              
              // 更新进度文本 - 只显示用户信息
              progressText.textContent = `正在发送文件给 ${getUserNickname(user.id) || user.id}`;
              
              // 更新传输速度
              const currentElapsedTime = (Date.now() - startTime) / 1000;
              const currentTotalBytes = totalBytesSent + sent;
              const currentSpeed = currentElapsedTime > 0 ? currentTotalBytes / currentElapsedTime : 0;
              const currentSpeedText = currentSpeed > 1024 * 1024 
                ? `${(currentSpeed / (1024 * 1024)).toFixed(2)} MB/s`
                : `${(currentSpeed / 1024).toFixed(2)} KB/s`;
              
              if (processingSpeedEl) processingSpeedEl.textContent = currentSpeedText;
            };
            
            const fileInfo = { name: file.name, size: file.size };
            await user.sendFile(fileInfo, file, onProgress);
            completedOperations++;
            totalBytesSent += file.size;
            
            // 文件发送完成后更新进度
            const finalProgress = (completedOperations / totalOperations) * 100;
            progressBar.style.width = finalProgress + '%';
            
            // 更新进度百分比显示
            if (progressPercentage) {
              progressPercentage.textContent = Math.round(finalProgress) + '%';
            }
            
            console.log(`成功发送文件: ${file.name} 给用户: ${getUserNickname(user.id) || user.id}`);
          }
          
          successCount++;
          console.log(`成功发送所有文件给用户: ${getUserNickname(user.id) || user.id}`);
        } catch (userError) {
          console.error(`发送给用户 ${getUserNickname(user.id) || user.id} 失败:`, userError);
          // 继续发送给其他用户，不中断整个过程
          // 即使失败也要更新进度
          completedOperations += filesData.length;
          
          // 更新失败后的进度
          const finalProgress = (completedOperations / totalOperations) * 100;
          progressBar.style.width = finalProgress + '%';
          
          // 更新进度百分比显示
          if (progressPercentage) {
            progressPercentage.textContent = Math.round(finalProgress) + '%';
          }
        }
      }
      
      // 显示发送完成消息
      if (successCount > 0) {
        const userNames = selectedUsers.map(u => getUserNickname(u.id) || u.id).join(', ');
        addChatItem(me.id, `[批量文件] 发送了 ${filesData.length} 个文件给: ${userNames} (成功: ${successCount}/${totalUsers})`);
        
        if (successCount < totalUsers) {
          addChatItem('system', `部分用户发送失败，成功发送给 ${successCount} 个用户，失败 ${totalUsers - successCount} 个用户`);
        }
      } else {
        throw new Error('所有用户发送都失败了');
      }
      
    } catch (error) {
      console.error('发送文件失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '发送文件失败';
      if (error.message.includes('所有用户发送都失败了')) {
        errorMessage = '所有用户发送都失败了，请检查网络连接';
      }
      
      alert(errorMessage);
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = '发送';
      sendButton.style.opacity = '1'; // 恢复透明度
      sendButton.style.pointerEvents = 'auto'; // 恢复点击
      userList.style.display = 'block';
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
      
      // 恢复标题文本
      modal.querySelector('h3').textContent = '选择接收用户';
      
      // 恢复详细进度信息的显示
      const progressDetails = modal.querySelector('.progress-details');
      const progressHeader = modal.querySelector('.progress-header');
      if (progressDetails) progressDetails.style.display = 'block';
      if (progressHeader) progressHeader.style.display = 'flex';
      
      // 确保modal-footer布局正确
      const modalFooter = modal.querySelector('.modal-footer');
      if (modalFooter) {
        modalFooter.style.display = 'flex';
        modalFooter.style.justifyContent = 'flex-end';
        modalFooter.style.alignItems = 'center';
      }
    }
  }
  
  modal.style.display = 'none';
}

// 拖放文件处理
let droptarget = document.body;
    
async function handleEvent(event) {
  event.preventDefault();
  if (event.type === 'drop') {
    droptarget.classList.remove('dragover');
    if (event.dataTransfer.files.length > 0) {
      // 如果只拖放了一个文件，直接发送
      if (event.dataTransfer.files.length === 1) {
      await sendFile(event.dataTransfer.files[0]);
      } else {
        // 如果拖放了多个文件，批量发送
        await sendMultipleFiles(event.dataTransfer.files);
      }
    }
  } else if (event.type === 'dragleave') {
    droptarget.classList.remove('dragover');
  } else {
    droptarget.classList.add('dragover');
  }
}

// 移动端相关函数
function updateMobileUsersList() {
  const usersList = document.getElementById('users');
  const mobileUsersList = document.querySelector('.mobile-users');
  
  // 直接复制PC端用户列表的HTML到移动端
  mobileUsersList.innerHTML = usersList.innerHTML;
  
  // 为移动端用户列表项添加点击事件
  const mobileUserItems = mobileUsersList.querySelectorAll('li.clickable');
  mobileUserItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // 阻止事件冒泡，避免同时触发侧边栏关闭
      e.stopPropagation();
      
      const userId = this.getAttribute('data-user-id');
      if (userId) {
        const user = users.find(u => u.id === userId);
        if (user && user.isConnected()) {
          showUserActionMenu(user, e); // 传递事件对象，保证菜单弹出在点击处
          
          // 在菜单关闭时关闭侧边栏
          const menuClosedHandler = function() {
            if (!document.querySelector('.user-action-menu')) {
              toggleMobileSidebar();
              document.removeEventListener('click', menuClosedHandler);
            }
          };
          
          // 延迟添加点击事件，防止立即触发
          setTimeout(() => {
            document.addEventListener('click', menuClosedHandler);
          }, 300);
        }
      }
    });
  });
}

function toggleMobileSidebar() {
  document.querySelector('.mobile-sidebar').classList.toggle('active');
}

// 设置用户昵称
function setUserNickname() {
  const nicknameInput = document.getElementById('nicknameInput');
  const nickname = nicknameInput.value.trim();
  
  if (nickname) {
    // 最多20个字符
    const trimmedNickname = nickname.substring(0, 20);
    userNickname = trimmedNickname;
    
    // 保存到localStorage
    localStorage.setItem('userNickname', trimmedNickname);
    
    // 更新本地用户对象
    me.nickname = trimmedNickname;
    
    // 保存到用户昵称映射表中
    saveUserNickname(me.id, trimmedNickname);
    
    // 发送昵称更新到服务器
    signalingServer.send(JSON.stringify({
      type: '9004',
      data: {
        id: me.id,
        nickname: trimmedNickname
      }
    }));
    
    // 向所有已连接的用户广播昵称更新
    const connectedUsers = users.filter(u => !u.isMe && u.isConnected());
    connectedUsers.forEach(user => {
      user.sendMessage(JSON.stringify({
        type: 'nickname-update',
        userId: me.id,
        nickname: trimmedNickname
      }));
    });
    
    // 更新用户列表
    refreshUsersHTML();
    
    // 关闭模态框
    document.getElementById('nicknameModal').style.display = 'none';
  }
}

// 显示昵称设置模态框
function showNicknameModal() {
  const nicknameModal = document.getElementById('nicknameModal');
  const nicknameInput = document.getElementById('nicknameInput');
  
  // 如果有已保存的昵称，填充到输入框
  nicknameInput.value = userNickname || '';
  
  // 显示模态框
  nicknameModal.style.display = 'block';
  
  // 聚焦输入框
  setTimeout(() => {
    nicknameInput.focus();
  }, 100);
}

// 关闭昵称设置模态框
function closeNicknameModal() {
  document.getElementById('nicknameModal').style.display = 'none';
}

// 检查回车键提交昵称
function checkEnterForNickname(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    setUserNickname();
  }
}

// 保存用户昵称到localStorage
function saveUserNickname(userId, nickname) {
  if (!userId || !nickname) return;
  
  try {
    // 获取现有的用户昵称映射
    let userNicknames = JSON.parse(localStorage.getItem('userNicknames') || '{}');
    
    // 更新昵称
    userNicknames[userId] = nickname;
    
    // 保存回localStorage
    localStorage.setItem('userNicknames', JSON.stringify(userNicknames));
  } catch (e) {
    console.error('保存用户昵称失败', e);
  }
}

// 从localStorage获取用户昵称
function getUserNickname(userId) {
  if (!userId) return null;
  
  try {
    // 获取现有的用户昵称映射
    const userNicknames = JSON.parse(localStorage.getItem('userNicknames') || '{}');
    
    // 返回该用户的昵称
    return userNicknames[userId] || null;
  } catch (e) {
    console.error('获取用户昵称失败', e);
    return null;
  }
}

// 更新进度详细信息
function updateProgressDetails(message, progress) {
  const currentFileEl = document.getElementById('currentFile');
  const fileProgressEl = document.getElementById('fileProgress');
  const processingSpeedEl = document.getElementById('processingSpeed');
  const estimatedTimeEl = document.getElementById('estimatedTime');
  
  if (!currentFileEl || !fileProgressEl || !processingSpeedEl || !estimatedTimeEl) {
    return;
  }
  
  // 解析消息中的信息
  if (message.includes('正在读取文件:')) {
    // 提取文件名
    const fileNameMatch = message.match(/正在读取文件: ([^(]+)/);
    if (fileNameMatch) {
      currentFileEl.textContent = fileNameMatch[1].trim();
    }
    
    // 提取处理进度
    const progressMatch = message.match(/(\d+)\/(\d+) - 已处理:/);
    if (progressMatch) {
      const current = progressMatch[1];
      const total = progressMatch[2];
      fileProgressEl.textContent = `${current}/${total}`;
    }
    
    // 提取处理速度
    const speedMatch = message.match(/速度: ([^-]+)/);
    if (speedMatch) {
      processingSpeedEl.textContent = speedMatch[1].trim();
    }
    
    // 提取文件进度
    const fileProgressMatch = message.match(/文件进度: (\d+)%/);
    if (fileProgressMatch) {
      const fileProgress = fileProgressMatch[1];
      // 更新处理进度显示，包含文件内部进度
      const progressMatch = message.match(/(\d+)\/(\d+) - 已处理:/);
      if (progressMatch) {
        const current = progressMatch[1];
        const total = progressMatch[2];
        fileProgressEl.textContent = `${current}/${total} (文件: ${fileProgress}%)`;
      }
    }
    
    // 计算预计时间
    if (progress > 0 && progress < 80) {
      const remainingProgress = 80 - progress;
      const elapsedTime = Date.now() - window.zipStartTime;
      const estimatedTotalTime = (elapsedTime / progress) * 100;
      const remainingTime = estimatedTotalTime - elapsedTime;
      
      if (remainingTime > 0) {
        const timeText = remainingTime > 60000 
          ? `${Math.round(remainingTime / 60000)}分${Math.round((remainingTime % 60000) / 1000)}秒`
          : `${Math.round(remainingTime / 1000)}秒`;
        estimatedTimeEl.textContent = timeText;
      } else {
        estimatedTimeEl.textContent = '计算中...';
      }
    }
  } else if (message.includes('正在压缩文件')) {
    currentFileEl.textContent = '压缩处理中';
    
    // 提取压缩进度
    const compressionMatch = message.match(/压缩进度: (\d+)%/);
    if (compressionMatch) {
      fileProgressEl.textContent = `压缩: ${compressionMatch[1]}%`;
    }
    
    // 提取处理速度
    const speedMatch = message.match(/速度: ([^-]+)/);
    if (speedMatch) {
      processingSpeedEl.textContent = speedMatch[1].trim();
    }
    
    // 计算预计时间
    if (progress > 80 && progress < 95) {
      const remainingProgress = 95 - progress;
      const elapsedTime = Date.now() - window.zipStartTime;
      const estimatedTotalTime = (elapsedTime / progress) * 100;
      const remainingTime = estimatedTotalTime - elapsedTime;
      
      if (remainingTime > 0) {
        const timeText = remainingTime > 60000 
          ? `${Math.round(remainingTime / 60000)}分${Math.round((remainingTime % 60000) / 1000)}秒`
          : `${Math.round(remainingTime / 1000)}秒`;
        estimatedTimeEl.textContent = timeText;
      } else {
        estimatedTimeEl.textContent = '计算中...';
      }
    }
  } else if (message.includes('正在生成压缩包')) {
    currentFileEl.textContent = '压缩处理中';
    fileProgressEl.textContent = '压缩阶段';
    
    // 提取预计时间
    const timeMatch = message.match(/预计剩余时间: ([^)]+)/);
    if (timeMatch) {
      estimatedTimeEl.textContent = timeMatch[1];
    }
    
    processingSpeedEl.textContent = '压缩中...';
  } else if (message.includes('压缩包创建完成')) {
    currentFileEl.textContent = '已完成';
    fileProgressEl.textContent = '100%';
    
    // 提取压缩率
    const ratioMatch = message.match(/压缩率: (\d+)%/);
    if (ratioMatch) {
      processingSpeedEl.textContent = `压缩率: ${ratioMatch[1]}%`;
    }
    
    // 提取总耗时
    const timeMatch = message.match(/总耗时: ([^)]+)/);
    if (timeMatch) {
      estimatedTimeEl.textContent = timeMatch[1];
    }
  }
}



// 事件监听
document.addEventListener('DOMContentLoaded', function() {
  // 检查是否需要显示使用须知模态框
  checkShowUsageInfoModal();
  
  // 从localStorage中获取自己的昵称
  userNickname = localStorage.getItem('userNickname') || "";
  
  // 如果有昵称，设置到me对象上
  if (userNickname) {
    me.nickname = userNickname;
  }
  
  // 尝试从localStorage加载所有保存的用户昵称
  try {
    const savedNicknames = JSON.parse(localStorage.getItem('userNicknames') || '{}');
    // 在此点我们还没有用户列表，稍后会在refreshUsers中应用这些昵称
  } catch (e) {
    console.error('加载用户昵称失败', e);
  }
  
  // 初始化检查网络状态
  checkNetworkStatus();

  // 为聊天界面上的网络状态指示器添加点击事件
  const chatNetworkIndicator = document.getElementById('chatNetworkStatusIndicator');
  if (chatNetworkIndicator) {
    chatNetworkIndicator.addEventListener('click', function() {
      checkNetworkStatus();
    });
  }
  
  // 初始化其他功能
  initializeFileHandling();
  initializeMobileMenu();
  initializeWebSocket();
});

// 初始化文件处理功能
function initializeFileHandling() {
  const droptarget = document.querySelector('.chat-container');
  
  // 为昵称输入框添加回车键事件
  const nicknameInput = document.getElementById('nicknameInput');
  if (nicknameInput) {
    nicknameInput.addEventListener('keydown', checkEnterForNickname);
  }

  // 添加拖拽事件监听
  if (droptarget) {
    droptarget.addEventListener("dragenter", handleEvent);
    droptarget.addEventListener("dragover", handleEvent);
    droptarget.addEventListener("drop", handleEvent);
    droptarget.addEventListener("dragleave", handleEvent);
  }

  // 文件按钮事件监听
  const fileBtn = document.querySelector('.file-btn');
  if (fileBtn) {
    fileBtn.addEventListener('click', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true; // 支持多选
      input.accept = 'image/*,video/*,audio/*,application/*'; // 支持图片、视频、音频和其他文件类型
      input.onchange = async (e) => {
        if (e.target.files.length > 0) {
          // 如果只选择了一个文件，直接发送
          if (e.target.files.length === 1) {
            await sendFile(e.target.files[0]);
          } else {
            // 如果选择了多个文件，批量发送
            await sendMultipleFiles(e.target.files);
          }
        }
      };
      input.click();
    });
  }

  // 发送按钮事件监听
  const sendBtn = document.querySelector('.send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const messageInput = document.getElementById('messageInput');
      if (messageInput && messageInput.value.trim()) {  // 只有当消息不为空时才发送
        sendMessage();
      }
    });
  }
  
  // 添加设置昵称按钮事件监听
  const nicknameBtn = document.querySelector('.nickname-btn');
  if (nicknameBtn) {
    nicknameBtn.addEventListener('click', showNicknameModal);
  }
  
  // 添加确认和取消昵称按钮的事件监听
  const confirmNicknameBtn = document.getElementById('confirmNickname');
  if (confirmNicknameBtn) {
    confirmNicknameBtn.addEventListener('click', setUserNickname);
  }
  
  const cancelNicknameBtn = document.getElementById('cancelNickname');
  if (cancelNicknameBtn) {
    cancelNicknameBtn.addEventListener('click', closeNicknameModal);
  }
}

// 初始化移动端菜单
function initializeMobileMenu() {
  // 移动端菜单处理
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const closeSidebarBtn = document.querySelector('.close-sidebar');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
  }
  
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', toggleMobileSidebar);
  }

  // 点击移动端侧边栏外部关闭侧边栏
  document.addEventListener('click', (e) => {
    const mobileSidebar = document.querySelector('.mobile-sidebar');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    if (mobileSidebar && mobileMenuBtn && 
        mobileSidebar.classList.contains('active') &&
        !mobileSidebar.contains(e.target) &&
        !mobileMenuBtn.contains(e.target)) {
      toggleMobileSidebar();
    }
  });
}

// 初始化WebSocket连接
function initializeWebSocket() {
  // 初始化 WebSocket 连接
  const signalingServer = new WebSocket(wsUrl);
  window.signalingServer = signalingServer; // 保存为全局变量以便其他函数使用

  signalingServer.onopen = () => {
    // 生成6位随机数字作为用户ID
    const randomId = Math.floor(100000 + Math.random() * 900000);
    // 发送初始连接消息
    signalingServer.send(JSON.stringify({
      type: '1000',
      uid: randomId.toString()
    }));
    
    setInterval(() => {
      signalingServer.send(JSON.stringify({type: '9999'}));
    }, 1000 * 10);
  };

  signalingServer.onmessage = ({ data: responseStr }) => {
    try {
      const response = JSON.parse(responseStr);
      
      // 处理心跳消息
      if (response.type === '9999') {
        return;
      }

      const { type, data } = response;

      if (!type) {
        return;
      }

      if (type === '1001') {
        me.id = data.id;
        
        // 如果有昵称，连接成功后立即发送昵称到服务器，不使用延迟
        if (userNickname) {
          signalingServer.send(JSON.stringify({
            type: '9004',
            data: {
              id: me.id,
              nickname: userNickname
            }
          }));
        }
        
        checkNetworkStatus(); // 用户ID更新时检查网络
        return;
      }
      if (type === '1002') {
        refreshUsers(data);
        // 用户数据更新后已经在refreshUsers中调用了checkNetworkStatus
        return;
      }
      if (type === '1003') {
        joinedRoom();
        checkNetworkStatus(); // 加入房间时检查网络
        return;
      }
      if (type === '1004') {
        addCandidate(data);
        return;
      }
      if (type === '1005') {
        joinConnection(data);
        return;
      }
      if (type === '1006') {
        joinedConnection(data);
        checkNetworkStatus(); // 连接建立时检查网络
        return;
      }
      if (type === '1007') {
        const user = users.find(u => u.id === data.id);
        if (user) {
          user.nickname = data.nickname;
          refreshUsersHTML();
        }
        return;
      }

      // 处理连接请求
      if (data && data.type === '9002') {
        const targetWs = clients.get(data.targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: '1005',
            data: {
              targetId: data.uid,
              offer: data.data.targetAddr
            }
          }));
        }
        return;
      }

      // 处理连接响应
      if (data && data.type === '9003') {
        const targetWs = clients.get(data.targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: '1006',
            data: {
              targetId: data.uid,
              answer: data.data.targetAddr
            }
          }));
        }
        return;
      }

      // 处理ICE候选
      if (data && data.type === '9001') {
        const targetWs = clients.get(data.targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: '1004',
            data: {
              targetId: data.uid,
              candidate: data.data.candidate
            }
          }));
        }
        return;
      }
    } catch (error) {}
  };

  signalingServer.onerror = (error) => {};

  signalingServer.onclose = () => {};
}

// 文件名截断显示函数
function getShortFileName(name, maxLen = 20) {
  if (!name) return '';
  if (name.length <= maxLen) return name;
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx !== -1 ? name.slice(dotIdx) : '';
  const base = dotIdx !== -1 ? name.slice(0, dotIdx) : name;
  if (base.length <= 12) return name; // 基本名不长就不截断
  return base.slice(0, 8) + '...' + base.slice(-4) + ext;
}

// 确认发送单文件
async function confirmSendFile() {
  const modal = document.getElementById('userSelectModal');
  const sendButton = modal.querySelector('.modal-footer button:last-child');
  const progressContainer = modal.querySelector('.progress-container');
  const progressBar = modal.querySelector('.progress-bar-inner');
  const progressText = modal.querySelector('.progress-text');
  const userList = document.getElementById('userSelectList');
  
  // 检查是否有多文件数据
  const filesData = window.pendingMultipleFiles;
  
  if (filesData && filesData.length > 0) {
    // 多文件发送
    await confirmSendMultipleFiles();
    return;
  }
  
  // 单文件发送（原有逻辑）
  const selectedUsers = Array.from(document.querySelectorAll('#userSelectList input[type="checkbox"]:checked'))
    .map(checkbox => users.find(u => u.id === checkbox.value))
    .filter(u => u && u.isSameNetwork());
  
  if (selectedUsers.length > 0 && pendingFile) {
    sendButton.disabled = true;
    sendButton.textContent = '发送中...';
    userList.style.display = 'none';
    progressContainer.style.display = 'block';
    
    // 修改标题为正在发送文件
    modal.querySelector('h3').textContent = '正在发送文件';
    
    // 单文件发送时隐藏详细的进度信息，只显示简单进度
    const progressDetails = modal.querySelector('.progress-details');
    const progressHeader = modal.querySelector('.progress-header');
    if (progressDetails) progressDetails.style.display = 'none';
    if (progressHeader) progressHeader.style.display = 'none';
    
    try {
      const fileInfo = { name: pendingFile.name, size: pendingFile.size };
      const totalUsers = selectedUsers.length;
      const startTime = Date.now();
      
      for (let i = 0; i < selectedUsers.length; i++) {
        const user = selectedUsers[i];
        progressText.textContent = `正在发送给 ${getUserNickname(user.id) || user.id}... (${i + 1}/${totalUsers})`;
        
        const onProgress = (sent, total) => {
          const userProgress = (sent / total) * 100;
          const totalProgress = ((i * 100) + userProgress) / totalUsers;
          progressBar.style.width = totalProgress + '%';
          // 计算传输速度
          const speed = sent / (Date.now() - startTime) * 1000; // 字节/秒
          const speedText = speed > 1024 * 1024 
            ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s`
            : `${(speed / 1024).toFixed(2)} KB/s`;
          progressText.textContent = `正在发送给 ${getUserNickname(user.id) || user.id}... (${i + 1}/${totalUsers}) ${speedText}`;
        };
        
        await user.sendFile(fileInfo, pendingFile, onProgress);
      }
      
      const userNames = selectedUsers.map(u => getUserNickname(u.id) || u.id).join(', ');
      addChatItem(me.id, `[文件] ${fileInfo.name} (发送给: ${userNames})`);
    } catch (error) {
      alert('发送文件失败，请重试');
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = '发送';
      sendButton.style.opacity = '1'; // 恢复透明度
      sendButton.style.pointerEvents = 'auto'; // 恢复点击
      userList.style.display = 'block';
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
      
      // 恢复标题文本
      modal.querySelector('h3').textContent = '选择接收用户';
    }
  }
  
  modal.style.display = 'none';
  pendingFile = null;
}
