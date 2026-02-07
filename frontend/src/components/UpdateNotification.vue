<template>
  <Transition name="slide-fade">
    <div v-if="visible" class="update-notification" :class="`status-${status}`">
      <div class="notification-content">
        <!-- 检查更新中 -->
        <div v-if="status === 'checking'" class="status-checking">
          <div class="spinner"></div>
          <span>正在检查更新...</span>
        </div>

        <!-- 发现更新 -->
        <div v-else-if="status === 'available'" class="status-available">
          <div class="update-icon">🎉</div>
          <div class="update-info">
            <h3>发现新版本 {{ updateInfo.version }}</h3>
            <p class="update-notes">{{ updateInfo.releaseNotes || '包含性能优化和bug修复' }}</p>
            <div class="update-actions">
              <button @click="downloadUpdate" class="btn-primary">
                立即下载
              </button>
              <button @click="dismiss" class="btn-secondary">
                稍后提醒
              </button>
            </div>
          </div>
        </div>

        <!-- 下载中 -->
        <div v-else-if="status === 'downloading'" class="status-downloading">
          <div class="download-info">
            <span>正在下载更新...</span>
            <span class="progress-text">{{ Math.round(progress) }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
          </div>
        </div>

        <!-- 下载完成 -->
        <div v-else-if="status === 'downloaded'" class="status-downloaded">
          <div class="success-icon">✅</div>
          <div class="update-info">
            <h3>更新已就绪</h3>
            <p>更新将在重启应用后生效</p>
            <div class="update-actions">
              <button @click="installUpdate" class="btn-primary">
                立即重启
              </button>
              <button @click="dismiss" class="btn-secondary">
                稍后重启
              </button>
            </div>
          </div>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="status === 'error'" class="status-error">
          <div class="error-icon">❌</div>
          <div class="error-info">
            <h3>更新失败</h3>
            <p>{{ errorMessage }}</p>
            <button @click="dismiss" class="btn-secondary">
              关闭
            </button>
          </div>
        </div>

        <!-- 已是最新版本 -->
        <div v-else-if="status === 'up-to-date'" class="status-uptodate">
          <div class="success-icon">✓</div>
          <span>您已使用最新版本</span>
        </div>
      </div>

      <!-- 关闭按钮 -->
      <button @click="dismiss" class="close-btn" v-if="!['downloading'].includes(status)">
        ×
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const visible = ref(false);
const status = ref<'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up-to-date'>('checking');
const progress = ref(0);
const updateInfo = ref<any>({});
const errorMessage = ref('');

// 监听自动更新状态
const handleUpdaterStatus = (data: any) => {
  console.log('[UpdateNotification] Status:', data);

  switch (data.status) {
    case 'checking':
      visible.value = true;
      status.value = 'checking';
      setTimeout(() => {
        if (status.value === 'checking') {
          visible.value = false;
        }
      }, 3000);
      break;

    case 'available':
      visible.value = true;
      status.value = 'available';
      updateInfo.value = data.data;
      break;

    case 'not-available':
      if (data.manualCheck) {
        visible.value = true;
        status.value = 'up-to-date';
        setTimeout(() => {
          visible.value = false;
        }, 3000);
      }
      break;

    case 'progress':
      status.value = 'downloading';
      progress.value = data.data.percent || 0;
      break;

    case 'downloaded':
      status.value = 'downloaded';
      updateInfo.value = data.data;
      break;

    case 'error':
      visible.value = true;
      status.value = 'error';
      errorMessage.value = data.data?.message || '未知错误';
      setTimeout(() => {
        visible.value = false;
      }, 5000);
      break;
  }
};

// 下载更新
const downloadUpdate = async () => {
  status.value = 'downloading';
  progress.value = 0;
  
  try {
    await window.electronAPI?.downloadUpdate();
  } catch (error: any) {
    status.value = 'error';
    errorMessage.value = error.message;
  }
};

// 安装更新
const installUpdate = async () => {
  try {
    await window.electronAPI?.installUpdate();
  } catch (error: any) {
    status.value = 'error';
    errorMessage.value = error.message;
  }
};

// 关闭通知
const dismiss = () => {
  visible.value = false;
};

onMounted(() => {
  if (window.electronAPI?.onAutoUpdaterStatus) {
    window.electronAPI.onAutoUpdaterStatus(handleUpdaterStatus);
  }
});

// 暴露手动检查更新方法
defineExpose({
  checkForUpdates: async () => {
    visible.value = true;
    status.value = 'checking';
    await window.electronAPI?.checkForUpdates();
  }
});
</script>

<style scoped>
.update-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  max-width: 400px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  padding: 20px;
  color: white;
  z-index: 9999;
  animation: slideIn 0.3s ease-out;
}

.notification-content {
  position: relative;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 20px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 检查更新状态 */
.status-checking {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 发现更新状态 */
.status-available {
  display: flex;
  gap: 15px;
}

.update-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.update-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.update-notes {
  margin: 0 0 15px 0;
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.4;
}

.update-actions {
  display: flex;
  gap: 10px;
}

.btn-primary,
.btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 下载中状态 */
.status-downloading {
  padding: 10px 0;
}

.download-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.progress-text {
  font-weight: 600;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: white;
  transition: width 0.3s ease;
  border-radius: 4px;
}

/* 下载完成状态 */
.status-downloaded {
  display: flex;
  gap: 15px;
}

.success-icon {
  font-size: 40px;
  flex-shrink: 0;
}

/* 错误状态 */
.status-error {
  display: flex;
  gap: 15px;
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
}

.error-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.error-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.error-info p {
  margin: 0 0 15px 0;
  font-size: 14px;
  opacity: 0.9;
}

/* 已是最新版本 */
.status-uptodate {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.status-uptodate .success-icon {
  font-size: 24px;
}

/* 动画 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes slideIn {
  from {
    transform: translateX(120%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s ease-in;
}

.slide-fade-enter-from {
  transform: translateX(120%);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(120%);
  opacity: 0;
}
</style>
