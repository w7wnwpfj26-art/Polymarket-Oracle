<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const navItems = [
  { name: '仪表板', path: '/', icon: 'dashboard' },
  { name: '市场', path: '/markets', icon: 'markets' },
  { name: '套利机会', path: '/arbitrage', icon: 'arbitrage' },
  { name: 'AI 代理', path: '/agents', icon: 'agents' },
  { name: '跟单交易', path: '/copy', icon: 'copy' },
  { name: '情绪分析', path: '/sentiment', icon: 'sentiment' },
  { name: '传统平台', path: '/betting', icon: 'betting' },
  { name: '执行历史', path: '/history', icon: 'history' },
  { name: '配置', path: '/config', icon: 'config' },
];

const isActive = (path: string) => route.path === path;
</script>

<template>
  <aside class="w-64 bg-cyber-dark border-r border-white/5 flex flex-col z-20">
    <!-- Logo -->
    <div class="h-16 flex items-center px-6 border-b border-white/5">
      <div class="flex items-center gap-3">
        <div class="relative">
          <div class="absolute -inset-1 bg-gradient-to-r from-cyber-neon to-cyber-blue rounded-full blur opacity-50"></div>
          <div class="relative w-10 h-10 bg-cyber-black rounded-full flex items-center justify-center border border-white/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
        </div>
        <div>
          <h1 class="font-bold text-lg">AEGIS</h1>
          <p class="text-xs text-white/40">Arbitrage System</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 py-4">
      <ul class="space-y-1 px-3">
        <li v-for="item in navItems" :key="item.path">
          <RouterLink
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
              isActive(item.path)
                ? 'bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/20'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            ]"
          >
            <!-- Icons -->
            <svg v-if="item.icon === 'dashboard'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            <svg v-else-if="item.icon === 'markets'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <svg v-else-if="item.icon === 'arbitrage'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v12M6 12h12"/>
            </svg>
            <svg v-else-if="item.icon === 'agents'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            </svg>
            <svg v-else-if="item.icon === 'history'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <svg v-else-if="item.icon === 'betting'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
            <svg v-else-if="item.icon === 'copy'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <svg v-else-if="item.icon === 'sentiment'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <svg v-else-if="item.icon === 'config'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <span>{{ item.name }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <!-- Footer -->
    <div class="p-4 border-t border-white/5">
      <div class="text-xs text-white/30 text-center">
        <p>AEGIS v2.0</p>
        <p class="mt-1">Bun + Hono | Vue 3 + Tailwind 4</p>
      </div>
    </div>
  </aside>
</template>
