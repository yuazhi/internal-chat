// PWA 注册和管理脚本
class PWA {
  constructor() {
    this.isInstalled = false;
    this.deferredPrompt = null;
    this.init();
  }

  async init() {
    console.log('PWA初始化开始...');
    
    // 检查是否支持Service Worker
    if ('serviceWorker' in navigator) {
      try {
        await this.registerServiceWorker();
        console.log('Service Worker 注册成功');
      } catch (error) {
        console.error('Service Worker 注册失败:', error);
      }
    } else {
      console.log('浏览器不支持Service Worker');
    }

    // 监听安装提示
    this.listenForInstallPrompt();
    
    // 检查是否已安装
    this.checkIfInstalled();
    
    // 显示安装按钮（如果适用）
    this.showInstallButton();
    
    console.log('PWA初始化完成');
  }

  async registerServiceWorker() {
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // 删除Service Worker更新监听
    return registration;
  }

  listenForInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('安装提示触发 - beforeinstallprompt事件');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    window.addEventListener('appinstalled', (evt) => {
      console.log('应用已安装 - appinstalled事件');
      this.isInstalled = true;
      this.hideInstallButton();
      this.deferredPrompt = null;
    });
  }

  checkIfInstalled() {
    // 检查是否以独立模式运行
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
      this.isInstalled = true;
      console.log('应用已安装');
    }
  }

  showInstallButton() {
    console.log('检查是否显示安装按钮:', {
      hasDeferredPrompt: !!this.deferredPrompt,
      isInstalled: this.isInstalled
    });
    
    if (this.deferredPrompt && !this.isInstalled) {
      console.log('创建安装按钮');
      // 创建安装按钮
      this.createInstallButton();
    } else {
      console.log('不显示安装按钮');
    }
  }

  createInstallButton() {
    // 检查是否已存在安装按钮
    if (document.getElementById('pwa-install-btn')) {
      return;
    }

    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.className = 'pwa-install-btn';
    installBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    `;
    installBtn.title = '将应用安装到主屏幕';
    
    installBtn.addEventListener('click', () => {
      this.installApp();
    });

    // 添加到页面
    const toolbar = document.querySelector('.toolbar-left');
    if (toolbar) {
      toolbar.appendChild(installBtn);
    }
  }

  hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.remove();
    }
  }

  async installApp() {
    if (!this.deferredPrompt) {
      console.log('没有可用的安装提示');
      return;
    }

    try {
      // 显示安装提示
      this.deferredPrompt.prompt();
      
      // 等待用户响应
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('用户接受了安装');
      } else {
        console.log('用户拒绝了安装');
      }
      
      this.deferredPrompt = null;
      this.hideInstallButton();
    } catch (error) {
      console.error('安装失败:', error);
    }
  }

  // 请求通知权限
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('此浏览器不支持通知');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.log('通知权限被拒绝');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  }

  // 发送通知
  sendNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    }
  }

  // 检查网络状态
  checkNetworkStatus() {
    if (!navigator.onLine) {
      this.showOfflineNotification();
    }
  }

  showOfflineNotification() {
    const notification = document.createElement('div');
    notification.className = 'pwa-notification offline';
    notification.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M24 8.98C20.93 5.9 16.69 4 12 4S3.07 5.9 0 8.98L12 21 24 8.98zM2.92 9.07C5.51 7.08 8.67 6 12 6s6.49 1.08 9.08 3.07l-9.08 9.08-9.08-9.08z"/>
      </svg>
      <span>当前处于离线模式</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// 初始化PWA
let pwa;
document.addEventListener('DOMContentLoaded', () => {
  pwa = new PWA();
  // 正确设置全局变量
  window.PWA = pwa;
});

// 监听网络状态变化
window.addEventListener('online', () => {
  console.log('网络已连接');
});

window.addEventListener('offline', () => {
  console.log('网络已断开');
  if (pwa) {
    pwa.showOfflineNotification();
  }
}); 