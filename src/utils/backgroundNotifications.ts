// Background Notifications - Works even when screen is off or app is closed
// Uses Capacitor Local Notifications for Android/iOS

import { Capacitor } from '@capacitor/core';
import { playNotificationSound } from './soundNotification';

// Cache for loaded module (only loaded when needed)
let LocalNotificationsModule: any = null;
let notificationInitialized = false;

// Helper to load the LocalNotifications module dynamically
// Using eval to prevent Vite from statically analyzing the import
const loadLocalNotifications = async () => {
  if (LocalNotificationsModule) {
    return LocalNotificationsModule;
  }

  try {
    // Dynamic import - Vite will handle this gracefully
    // If the package doesn't exist, it will return null
    const moduleSpecifier = '@capacitor/local-notifications';
    const module = await import(/* @vite-ignore */ moduleSpecifier);
    LocalNotificationsModule = module.LocalNotifications;
    return LocalNotificationsModule;
  } catch (error) {
    // Plugin not installed - this is expected if not using native platform
    return null;
  }
};

// Initialize background notifications
export const initializeBackgroundNotifications = async () => {
  // Only works on native platforms (Android/iOS)
  if (!Capacitor.isNativePlatform()) {
    console.log('Background notifications only available on native platforms');
    return;
  }

  if (notificationInitialized) {
    return;
  }

  // Load the plugin dynamically
  const LocalNotifications = await loadLocalNotifications();
  if (!LocalNotifications) {
    console.warn('@capacitor/local-notifications not installed. Background notifications disabled.');
    console.warn('Install with: npm install @capacitor/local-notifications');
    return;
  }

  try {
    // Request permission
    const permissionStatus = await LocalNotifications.requestPermissions();
    
    if (permissionStatus.display !== 'granted') {
      console.warn('Local notification permission denied');
      return;
    }

    console.log('✅ Background notifications initialized');
    notificationInitialized = true;

    // Handle notification actions
    LocalNotifications.addListener('localNotificationActionPerformed', (notification: any) => {
      console.log('Notification action performed:', notification);
      // Navigate based on notification data
      if (notification.notification.data) {
        const data = notification.notification.data;
        if (data.ticketId) {
          window.location.href = `/ticket/${data.ticketId}`;
        } else if (data.type === 'subscription') {
          window.location.href = '/subscription-visits';
        } else if (data.type === 'dashboard') {
          window.location.href = '/dashboard';
        }
      }
    });

    // Handle notification received (when app is in foreground)
    LocalNotifications.addListener('localNotificationReceived', (notification: any) => {
      console.log('Notification received:', notification);
      // Play sound even in foreground
      playNotificationSound().catch(err => console.error('Sound error:', err));
    });

  } catch (error) {
    console.error('Error initializing background notifications:', error);
  }
};

// Schedule a background notification (works even when screen is off)
export const scheduleBackgroundNotification = async (
  title: string,
  body: string,
  data?: any,
  sound: boolean = true
) => {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to browser notifications for web
    const { showBrowserNotification } = await import('./soundNotification');
    showBrowserNotification(title, body);
    playNotificationSound();
    return;
  }

  // Load the plugin dynamically
  const LocalNotifications = await loadLocalNotifications();
  if (!LocalNotifications) {
    // Plugin not installed - use fallback
    console.warn('LocalNotifications plugin not available, using fallback');
    const { showBrowserNotification } = await import('./soundNotification');
    showBrowserNotification(title, body);
    playNotificationSound();
    return;
  }

  try {
    // Check permission
    const permissionStatus = await LocalNotifications.checkPermissions();
    if (permissionStatus.display !== 'granted') {
      console.warn('Notification permission not granted');
      // Fallback to browser notification
      const { showBrowserNotification } = await import('./soundNotification');
      showBrowserNotification(title, body);
      playNotificationSound();
      return;
    }

    // Schedule notification immediately (for screen-off notifications)
    // Use schedule.at with current time to trigger immediately
    const notificationId = Date.now();
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: notificationId,
          sound: sound ? 'default' : undefined,
          schedule: { at: new Date(Date.now() + 100) }, // Schedule 100ms from now to trigger immediately
          data: data || {},
          // Android-specific options
          android: {
            channelId: 'autosupport-notifications',
            priority: 2, // High priority (0-2, where 2 is highest)
            sound: sound ? 'default' : undefined,
            vibrate: true,
            smallIcon: 'ic_notification',
            largeIcon: 'ic_launcher',
            // Show even when screen is off
            visibility: 1, // Public
            wakeUp: true,
            // Play sound even in silent mode
            soundName: sound ? 'default' : undefined,
            // Critical for screen-off notifications
            importance: 4, // High importance (1-5, where 5 is highest)
            ongoing: false,
            autoCancel: true,
            // Force notification to show and play sound
            sticky: false,
            lockScreenVisibility: 1, // Show on lock screen
          },
          // iOS-specific options
          ios: {
            sound: sound ? 'default' : undefined,
            attachments: [],
            // Critical for background notifications
            threadIdentifier: 'autosupport-messages',
            summaryArgument: body,
            summaryArgumentCount: 1,
          },
        },
      ],
    });

    console.log('✅ Background notification scheduled:', { title, body });
  } catch (error) {
    console.error('Error scheduling background notification:', error);
    // Fallback to browser notification on error
    const { showBrowserNotification } = await import('./soundNotification');
    showBrowserNotification(title, body);
    playNotificationSound();
  }
};

// Cancel all notifications
export const cancelAllNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  const LocalNotifications = await loadLocalNotifications();
  if (!LocalNotifications) {
    return; // Plugin not available
  }
  
  try {
    await LocalNotifications.cancel({
      notifications: []
    });
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
};

