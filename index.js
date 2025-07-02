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
      
      // 显示进度条
      modal.style.display = 'block';
      document.getElementById('userSelectList').style.display = 'none';
      modal.querySelector('.modal-footer').style.display = 'block';
      modal.querySelector('.modal-footer button:last-child').style.display = 'none';
      progressContainer.style.display = 'block';
      
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
      modal.querySelector('.modal-footer').style.display = 'block';
      modal.querySelector('.modal-footer button:last-child').style.display = 'inline-block';
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
    }
    
    pendingFile = null;
    return;
  }
  
  showUserSelectModal();
}

function showUserSelectModal() {
  const modal = document.getElementById('userSelectModal');
  const userList = document.getElementById('userSelectList');
  
  // 清空之前的列表
  userList.innerHTML = '';
  
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
        <span>${user.id}</span>
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
  modal.style.display = 'none';
  pendingFile = null;
  currentTransferUser = null;
}

async function confirmSendFile() {
  const modal = document.getElementById('userSelectModal');
  const sendButton = modal.querySelector('.modal-footer button:last-child');
  const progressContainer = modal.querySelector('.progress-container');
  const progressBar = modal.querySelector('.progress-bar-inner');
  const progressText = modal.querySelector('.progress-text');
  const userList = document.getElementById('userSelectList');
  
  // 只选择同一局域网中的用户
  const selectedUsers = Array.from(document.querySelectorAll('#userSelectList input[type="checkbox"]:checked'))
    .map(checkbox => users.find(u => u.id === checkbox.value))
    .filter(u => u && u.isSameNetwork());
  
  if (selectedUsers.length > 0 && pendingFile) {
    sendButton.disabled = true;
    sendButton.textContent = '发送中...';
    userList.style.display = 'none';
    progressContainer.style.display = 'block';
    
    try {
      const fileInfo = { name: pendingFile.name, size: pendingFile.size };
      const totalUsers = selectedUsers.length;
      const startTime = Date.now();
      
      for (let i = 0; i < selectedUsers.length; i++) {
        const user = selectedUsers[i];
        progressText.textContent = `正在发送给 ${user.id}... (${i + 1}/${totalUsers})`;
        
        const onProgress = (sent, total) => {
          const userProgress = (sent / total) * 100;
          const totalProgress = ((i * 100) + userProgress) / totalUsers;
          progressBar.style.width = totalProgress + '%';
          // 计算传输速度
          const speed = sent / (Date.now() - startTime) * 1000; // 字节/秒
          const speedText = speed > 1024 * 1024 
            ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s`
            : `${(speed / 1024).toFixed(2)} KB/s`;
          progressText.textContent = `正在发送给 ${user.id}... (${i + 1}/${totalUsers}) ${speedText}`;
        };
        
        await user.sendFile(fileInfo, pendingFile, onProgress);
      }
      
      addChatItem(me.id, `[文件] ${fileInfo.name} (发送给: ${selectedUsers.map(u => u.id).join(', ')})`);
    } catch (error) {
      alert('发送文件失败，请重试');
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = '发送';
      userList.style.display = 'block';
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
    }
  }
  
  modal.style.display = 'none';
  pendingFile = null;
}

// 拖放文件处理
let droptarget = document.body;
    
async function handleEvent(event) {
  event.preventDefault();
  if (event.type === 'drop') {
    droptarget.classList.remove('dragover');
    if (event.dataTransfer.files.length > 0) {
      await sendFile(event.dataTransfer.files[0]);
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
  
  // 为昵称输入框添加回车键事件
  const nicknameInput = document.getElementById('nicknameInput');
  if (nicknameInput) {
    nicknameInput.addEventListener('keydown', checkEnterForNickname);
  }

  droptarget.addEventListener("dragenter", handleEvent);
  droptarget.addEventListener("dragover", handleEvent);
  droptarget.addEventListener("drop", handleEvent);
  droptarget.addEventListener("dragleave", handleEvent);

  document.querySelector('.file-btn').addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      if (e.target.files.length > 0) {
        await sendFile(e.target.files[0]);
      }
    };
    input.click();
  });

  document.querySelector('.send-btn').addEventListener('click', () => {
    if (document.getElementById('messageInput').value.trim()) {  // 只有当消息不为空时才发送
      sendMessage();
    }
  });

  // 移动端菜单处理
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const closeSidebarBtn = document.querySelector('.close-sidebar');

  mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
  closeSidebarBtn.addEventListener('click', toggleMobileSidebar);

  // 点击移动端侧边栏外部关闭侧边栏
  document.addEventListener('click', (e) => {
    const mobileSidebar = document.querySelector('.mobile-sidebar');
    if (mobileSidebar.classList.contains('active') &&
        !mobileSidebar.contains(e.target) &&
        !mobileMenuBtn.contains(e.target)) {
      toggleMobileSidebar();
    }
  });

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
});

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