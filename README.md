# 局域网文字/文件P2P传输工具

一个基于WebRTC的局域网内文字和文件P2P传输工具，支持多设备间实时通信和文件传输。
基于https://github.com/sunzsh/internal-chat添加新功能界面美化
## 功能特性

- 🔄 **实时文字聊天** - 支持多用户实时文字消息传输
- 📁 **文件传输** - 支持任意类型文件的P2P传输
- 📱 **PWA支持** - 可安装为桌面/移动应用
- 🌐 **局域网传输** - 仅支持同一局域网内设备间传输
- 👥 **用户管理** - 显示在线用户列表，支持自定义昵称
- 🎨 **现代化UI** - 响应式设计，支持桌面和移动端
- 🔒 **安全传输** - 基于WebRTC的端到端传输

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **通信**: WebRTC, WebSocket
- **PWA**: Service Worker, Manifest
- **服务器**: Node.js (Express)

## 安装和运行

### 1. 克隆仓库
```bash
git clone https://github.com/yuazhi/internal-chat.git
cd internal-chat
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动服务器
```bash
npm start
```

### 4. 访问应用
打开浏览器访问 `http://localhost:3000`

## 使用说明

### 基本使用
1. 确保所有设备连接**同一个局域网**
2. 在浏览器中访问应用地址
3. 设置昵称（可选）
4. 开始聊天或传输文件

### 文件传输
1. 点击文件按钮或拖拽文件到聊天区域
2. 选择接收用户
3. 等待传输完成

### 注意事项
- ⚠️ **重要**: 仅支持同一局域网内设备间传输
- 📱 支持移动端和桌面端
- 🔄 支持PWA安装，提供更好的用户体验

## 项目结构

```
internal-chat/
├── index.html          # 主页面
├── style.css           # 样式文件
├── index.js            # 主逻辑
├── xchatuser.js        # 用户管理
├── server.js           # 服务器
├── sw.js              # Service Worker
├── pwa.js             # PWA相关
├── manifest.json      # PWA配置
├── icons/             # 应用图标
├── public/            # 静态资源
└── screenshots/       # 截图
```

## 开发

### 本地开发
```bash
npm run dev
```

### 构建
```bash
npm run build
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持文字聊天和文件传输
- PWA支持
- 响应式设计 
