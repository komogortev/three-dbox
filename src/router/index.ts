import { createRouter, createWebHistory } from 'vue-router'
import { getAppBaseUrl } from '@/utils/resolvePublicUrl'

export const router = createRouter({
  history: createWebHistory(getAppBaseUrl()),
  routes: [
    {
      path: '/',
      name: 'menu',
      component: () => import('@/views/MenuView.vue'),
    },
    {
      path: '/dbox',
      name: 'dbox',
      component: () => import('@/views/DboxView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})
