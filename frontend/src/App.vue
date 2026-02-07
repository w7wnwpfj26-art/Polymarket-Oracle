<script setup lang="ts">
import { RouterView } from 'vue-router';
import Sidebar from './components/layout/Sidebar.vue';
import Header from './components/layout/Header.vue';
import { useSystemStore } from './stores/system';
import { onMounted } from 'vue';

const systemStore = useSystemStore();

onMounted(() => {
  systemStore.initialize();
});
</script>

<template>
  <div class="min-h-screen bg-cyber-black text-white flex">
    <!-- Sidebar -->
    <Sidebar />
    
    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <!-- Header -->
      <Header />
      
      <!-- Page Content -->
      <main class="flex-1 p-6 overflow-auto">
        <RouterView v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
    
    <!-- Background Effects -->
    <div class="fixed inset-0 pointer-events-none">
      <div class="absolute inset-0 grid-bg opacity-30"></div>
      <div class="absolute inset-0 bg-gradient-to-b from-cyber-neon/5 to-transparent"></div>
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
