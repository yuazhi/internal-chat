const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  FAILED: 'failed',
  CLOSED: 'closed'
};

const connOption = { 
  ordered: true, 
  maxRetransmits: 10, // 最大重传次数
  bufferedAmountLowThreshold: 1024 * 16 // 设置缓冲区低阈值为 16KB
};

// 添加更多的STUN/TURN服务器配置
const rtcConfig = {
  iceServers: [],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

class XChatUser {
  id = null;
  isMe = false;

  rtcConn = null;
  connAddressTarget = null;
  connAddressMe = null;
  chatChannel = null;
  candidateArr = [];

  onicecandidate = () => { };
  onmessage = () => { };
  onReviceFile = () => { };
  onConnectionStateChange = () => { };

  receivedSize = 0;
  receivedChunks = [];
  fileInfo = null;

  #isTransferCancelled = false;

  async createConnection() {
    this.rtcConn = new RTCPeerConnection(rtcConfig);
    this.chatChannel = this.rtcConn.createDataChannel('chat', connOption);
    this.dataChannel_initEvent();
    // this.dataChannel.onopen = () => console.log('DataChannel is open');
    // this.dataChannel.onclose = () => console.log('DataChannel is closed');
    const offer = await this.rtcConn.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });
    await this.rtcConn.setLocalDescription(offer);
    this.connAddressMe = this.rtcConn.localDescription;

    this.rtcConn.onicecandidate = event => {
      if (event.candidate) {
        this.candidateArr.push(event.candidate);
        this.onicecandidate(event.candidate, this.candidateArr);
      }
    };

    this.rtcConn.onconnectionstatechange = () => {
      this.onConnectionStateChange(this.rtcConn.connectionState);
      if (this.rtcConn.connectionState === 'failed') {
        this.reconnect();
      }
    };

    return this;
  }

  closeConnection() {
    if (this.rtcConn) {
      this.rtcConn.onconnectionstatechange = null;
      this.rtcConn.close();
    }
    this.rtcConn = null;
    this.chatChannel = null;
    this.connAddressTarget = null;
    this.connAddressMe = null;
    this.onicecandidate = () => { };
    this.onConnectionStateChange(CONNECTION_STATES.CLOSED);
  }

  async connectTarget(target) {
    if (!target) {
      throw new Error('connAddressTarget is null');
    }
    if (this.isMe || !this.id) {
      return this;
    }

    if (this.rtcConn) {
      this.closeConnection();
    }

    this.rtcConn = new RTCPeerConnection(rtcConfig);

    this.rtcConn.onicecandidate = event => {
      if (event.candidate) {
        this.candidateArr.push(event.candidate);
        this.onicecandidate(event.candidate, this.candidateArr);
      }
    };

    this.rtcConn.ondatachannel = (event) => {
      if (event.channel) {
        this.chatChannel = event.channel;
        this.dataChannel_initEvent();
      }
    };

    try {
      const sdp = typeof target === 'string' ? target : target.sdp;
      if (!sdp) {
        throw new Error('Invalid SDP format');
      }

      this.connAddressTarget = new RTCSessionDescription({ 
        type: 'offer', 
        sdp: sdp 
      });
      
      await this.rtcConn.setRemoteDescription(this.connAddressTarget);
      const answer = await this.rtcConn.createAnswer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      await this.rtcConn.setLocalDescription(answer);
      this.connAddressMe = this.rtcConn.localDescription;
    } catch (error) {
      throw error;
    }

    this.rtcConn.onconnectionstatechange = () => {
      this.onConnectionStateChange(this.rtcConn.connectionState);
      if (this.rtcConn.connectionState === 'failed') {
        this.reconnect();
      }
    };

    return this;
  }

  addIceCandidate(candidate) {
    if (!this.rtcConn) {
      return;
    }
    this.rtcConn.addIceCandidate(new RTCIceCandidate(candidate))
  }

  async setRemoteSdp(target) {
    if (!this.rtcConn) {
      return;
    }

    if (this.rtcConn.signalingState === 'have-local-offer' && !this.rtcConn.remoteDescription) {
      try {
        const sdp = typeof target === 'string' ? target : target.sdp;
        if (!sdp) {
          throw new Error('Invalid SDP format');
        }

        await this.rtcConn.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: sdp
        }));
      } catch (err) {
        throw err;
      }
    }
  }

  dataChannel_initEvent() {
    // 接收消息
    this.chatChannel.onmessage = e => {
      try {
        const message = e.data;
        if (typeof message === 'string') {
          if (message.startsWith('##FILE_S##')) {
            // 文件传输前的头信息
            this.receivedChunks = [];
            this.receivedSize = 0;
            this.fileInfo = JSON.parse(message.substring(10));
          } else if (message === '##FILE_E##') {
            if (this.receivedChunks && this.fileInfo) {
              // 文件传输结束的尾信息
              let blob = new Blob(this.receivedChunks);
              let url = URL.createObjectURL(blob);
              this.onReviceFile({ 
                url, 
                name: this.fileInfo.name,
                size: this.fileInfo.size
              });
              blob = null;
              this.receivedChunks = null;
              this.receivedSize = 0;
              this.fileInfo = null;
            }
          } else {
            if (this.chatChannel && this.chatChannel.readyState === 'open') {
              this.onmessage(message);
            }
          }
        } else if (this.receivedChunks) {
          if (message instanceof ArrayBuffer) {
            this.receivedChunks.push(message);
          } else if (message instanceof Uint8Array) {
            this.receivedChunks.push(message.buffer);
          } else {
            // 处理未知类型
          }
          this.receivedSize += message.byteLength;
        }
      } catch (error) {
        // 处理消息错误
      }
    };

    this.chatChannel.onopen = () => {
      this.onConnectionStateChange(CONNECTION_STATES.CONNECTED);
    };
    
    this.chatChannel.onclose = () => {
      this.onConnectionStateChange(CONNECTION_STATES.CLOSED);
      if (this.rtcConn && this.rtcConn.connectionState !== 'closed') {
        setTimeout(() => {
          this.createDataChannel();
        }, 1000);
      }
    };

    this.chatChannel.onerror = (error) => {
      this.onConnectionStateChange(CONNECTION_STATES.FAILED);
      if (this.rtcConn && this.rtcConn.connectionState !== 'closed') {
        setTimeout(() => {
          this.createDataChannel();
        }, 1000);
      }
    };

    // 添加缓冲状态监控
    this.chatChannel.onbufferedamountlow = () => {};
  }
  checkBufferedAmount() {
    const maxBufferedAmount = 1024 * 64; // 降低最大缓冲区限制到 64KB
    return new Promise(resolve => {
      if (this.chatChannel.bufferedAmount > maxBufferedAmount) {
        // 如果缓冲区超过阈值，等待 bufferedamountlow 事件
        const handleBufferedAmountLow = () => {
          this.chatChannel.removeEventListener('bufferedamountlow', handleBufferedAmountLow);
          resolve();
        };
        this.chatChannel.addEventListener('bufferedamountlow', handleBufferedAmountLow);
      } else {
        // 缓冲区未满，立即解析
        resolve();
      }
    });
  }
  sendFileBytes(file, onProgress) {
    return new Promise((resolve, reject) => {
      const chunkSize = 8 * 1024; // 降低每个块的大小到 8KB
      const totalChunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      let totalSent = 0;
      let lastProgressUpdate = Date.now();

      const fileReader = new FileReader();
      
      fileReader.onerror = () => {
        reject(new Error('File reading failed'));
      };

      fileReader.onload = async () => {
        try {
          if (this.#isTransferCancelled) {
            return;
          }

          await this.checkBufferedAmount();
          
          if (this.chatChannel.readyState !== 'open') {
            throw new Error('Connection closed');
          }

          this.chatChannel.send(fileReader.result);
          totalSent += fileReader.result.byteLength;

          // 限制进度更新频率，避免过于频繁的UI更新
          const now = Date.now();
          if (now - lastProgressUpdate > 100) { // 每 100ms 最多更新一次
            if (onProgress) {
              onProgress(totalSent, file.size);
            }
            lastProgressUpdate = now;
          }

          currentChunk++;

          if (currentChunk < totalChunks) {
            // 使用 setTimeout 来避免调用栈过深
            setTimeout(() => sendNextChunk(), 0);
          } else {
            if (onProgress) {
              onProgress(totalSent, file.size); // 确保最后一次进度更新
            }
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      };

      const sendNextChunk = () => {
        try {
          const start = currentChunk * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = file.slice(start, end);
          fileReader.readAsArrayBuffer(chunk);
        } catch (e) {
          reject(e);
        }
      };

      sendNextChunk();
    });
  }

  async sendFile(fileInfo, file, onProgress) {
    try {
      this.#isTransferCancelled = false; // 重置取消标志
      if (this.chatChannel.readyState !== 'open') {
        throw new Error('Connection not open');
      }

      const fileInfoStr = '##FILE_S##' + JSON.stringify(fileInfo);
      await this.sendMessage(fileInfoStr);
      
      await this.sendFileBytes(file, onProgress);
      
      if (!this.#isTransferCancelled) { // 只有在未取消时才发送结束标记
        await this.sendMessage('##FILE_E##');
      }
    } catch (e) {
      throw e;
    }
  }
  
  async sendMessage(message) {
    if (!this.chatChannel) {
      return false;
    }

    // 添加重试机制
    const maxRetries = 3;
    let retryCount = 0;

    const trySend = async () => {
      try {
        if (this.chatChannel.readyState === 'open') {
          await this.chatChannel.send(message);
          return true;
        } else if (this.chatChannel.readyState === 'connecting') {
          // 如果正在连接中，等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
          return false;
        } else {
          // 如果连接已关闭，尝试重新建立连接
          if (this.rtcConn && this.rtcConn.connectionState !== 'closed') {
            this.createDataChannel();
            await new Promise(resolve => setTimeout(resolve, 1000));
            return false;
          }
          return false;
        }
      } catch (error) {
        return false;
      }
    };

    while (retryCount < maxRetries) {
      try {
        const success = await trySend();
        if (success) return true;
        retryCount++;
      } catch (error) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 而不是抛出错误，返回false表示发送失败
    return false;
  }

  // 添加取消传输方法
  cancelTransfer() {
    this.#isTransferCancelled = true;
    if (this.chatChannel) {
      // 关闭并重新创建数据通道，确保传输被中断
      this.chatChannel.close();
      this.createDataChannel();
    }
  }

  // 创建新的数据通道
  createDataChannel() {
    if (this.rtcConn) {
      this.chatChannel = this.rtcConn.createDataChannel('chat', connOption);
      this.dataChannel_initEvent();
    }
  }

  // 添加重连方法
  async reconnect() {
    if (this.connAddressTarget) {
      try {
        await this.connectTarget(this.connAddressTarget.sdp);
      } catch (error) {
        // 重连失败处理
      }
    }
  }

  // 获取当前连接状态
  getConnectionState() {
    if (!this.rtcConn) {
      return CONNECTION_STATES.DISCONNECTED;
    }
    return this.rtcConn.connectionState;
  }

  // 检查是否已连接
  isConnected() {
    if (this.isMe) return true;
    if (!this.rtcConn) return false;
    
    return this.rtcConn.connectionState === 'connected' && 
           this.chatChannel && 
           this.chatChannel.readyState === 'open';
  }

  // 检查是否在同一局域网
  isSameNetwork() {
    if (this.isMe) return true;
    
    // 如果没有RTCPeerConnection，说明还没有尝试连接，应该允许尝试
    if (!this.rtcConn) return true;
    
    // 如果连接状态是connecting或connected，认为在同一网络
    if (this.rtcConn.connectionState === 'connecting' || 
        this.rtcConn.connectionState === 'connected') {
      return true;
    }
    
    // 如果连接失败，但之前有过连接尝试，也认为可能在同一网络
    if (this.rtcConn.connectionState === 'failed') {
      return true;
    }
    
    // 其他情况（如disconnected）也允许尝试
    return true;
  }
}

function addLinkItem(uid, file) {
  const chatBox = document.querySelector('.chat-wrapper');
  const chatItem = document.createElement('div');
  chatItem.className = `chat-item${uid === me.id ? ' self' : ''}`;
  
  // 获取文件扩展名
  const fileExt = file.name.split('.').pop().toLowerCase();
  
  // 根据文件类型选择图标
  let fileIcon = '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
    fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"/></svg>';
  } else if (['mp4', 'webm', 'avi', 'mov'].includes(fileExt)) {
    fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 6.47L5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4z"/></svg>';
  } else if (['mp3', 'wav', 'ogg'].includes(fileExt)) {
    fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
  } else if (['pdf'].includes(fileExt)) {
    fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>';
  } else if (['doc', 'docx', 'txt'].includes(fileExt)) {
    fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>';
  } else if (['zip', 'rar', '7z'].includes(fileExt)) {
    fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 6h-2v2h2v2h-2v2h2v2h-2v2h2v-2h2v2h2V8h-4v4z"/></svg>';
  } else {
    fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>';
  }

  chatItem.innerHTML = `
    <div class="chat-item_user">${uid === me.id ? '（我）': ''}${uid}</div>
    <div class="chat-item_content">
      <a class="file" href="${file.url}" download="${file.name}">
        <div class="file-icon">${fileIcon}</div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-type">${fileExt.toUpperCase()}</div>
          ${file.size ? `<div class="file-size">${formatFileSize(file.size)}</div>` : ''}
        </div>
      </a>
    </div>
  `;
  chatBox.appendChild(chatItem);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function confirmSendFile() {
  const modal = document.getElementById('userSelectModal');
  const sendButton = modal.querySelector('.modal-footer button:last-child');
  const progressContainer = modal.querySelector('.progress-container');
  const progressBar = modal.querySelector('.progress-bar-inner');
  const progressText = modal.querySelector('.progress-text');
  const userList = document.getElementById('userSelectList');
  const selectedUsers = Array.from(document.querySelectorAll('#userSelectList input[type="checkbox"]:checked'))
    .map(checkbox => users.find(u => u.id === checkbox.value));
  
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
      
      // 为发送方显示文件消息
      const url = URL.createObjectURL(pendingFile);
      addLinkItem(me.id, {
        url,
        name: pendingFile.name,
        size: pendingFile.size
      });
      
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
