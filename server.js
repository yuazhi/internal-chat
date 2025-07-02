const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  // 处理静态文件请求
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  // 获取文件扩展名
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  
  // 设置内容类型
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
  }

  // 读取文件
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在
        res.writeHead(404);
        res.end(`File not found: ${req.url}`);
        console.log(`404: ${req.url}`);
      } else {
        // 服务器错误
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
        console.error(`Server Error: ${error.code} for ${req.url}`);
      }
    } else {
      // 成功响应
      // 设置 no-cache 头部
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 存储所有连接的客户端
const clients = new Map();

// WebSocket 连接处理
wss.on('connection', (ws) => {
  let userId = null;
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data.type);
      
      // 处理心跳包
      if (data.type === '9999') {
        ws.send(JSON.stringify({ type: '9999' }));
        return;
      }

      // 处理新用户连接
      if (data.type === '1000') {
        userId = data.uid || `user_${Math.random().toString(36).substr(2, 9)}`;
        clients.set(userId, ws);
        
        // 发送用户ID
        ws.send(JSON.stringify({
          type: '1001',
          data: { id: userId }
        }));

        console.log(`User connected: ${userId}`);
        
        // 广播用户列表
        broadcastUserList();
        
        // 通知用户加入房间
        ws.send(JSON.stringify({ type: '1003' }));
        return;
      }

      // 处理ICE候选
      if (data.type === '9001') {
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

      // 处理连接请求
      if (data.type === '9002') {
        const targetWs = clients.get(data.targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: '1005',
            data: {
              targetId: data.uid,
              offer: { sdp: data.data.targetAddr }
            }
          }));
        }
        return;
      }

      // 处理连接响应
      if (data.type === '9003') {
        const targetWs = clients.get(data.targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: '1006',
            data: {
              targetId: data.uid,
              answer: { sdp: data.data.targetAddr }
            }
          }));
        }
        return;
      }

    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      console.log(`User disconnected: ${userId}`);
      clients.delete(userId);
      broadcastUserList();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// 广播用户列表给所有客户端
function broadcastUserList() {
  const userList = Array.from(clients.keys()).map(id => ({ id }));
  const message = JSON.stringify({
    type: '1002',
    data: userList
  });

  console.log(`Broadcasting user list: ${userList.length} users`);
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 启动服务器
const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] server start on port ${PORT}`);
}); 