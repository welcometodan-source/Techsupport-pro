// Sound notification utility for real-time message alerts

let audioContext: AudioContext | null = null;
let notificationSound: AudioBuffer | null = null;
let audioUnlocked = false;
let unlockAttempts = 0;
const MAX_UNLOCK_ATTEMPTS = 3;

// Unlock audio context on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = async () => {
    if (audioUnlocked) return;
    if (unlockAttempts >= MAX_UNLOCK_ATTEMPTS) return;
    unlockAttempts++;
    
    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioUnlocked = true;
      console.log('✅ Audio context unlocked successfully');
    } catch (error) {
      console.error('Error unlocking audio:', error);
      // Try again on next interaction
      audioUnlocked = false;
    }
  };

  // Unlock on any user interaction (multiple events for better coverage)
  ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown'].forEach(event => {
    document.addEventListener(event, unlockAudio, { once: false, passive: true });
  });
  
  // Also try to unlock immediately if page is already interactive
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    unlockAudio();
  }
}

// Initialize audio context (lazy loading)
const initAudioContext = (): AudioContext => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('Audio context initialized:', audioContext.state);
    } catch (error) {
      console.error('Failed to create audio context:', error);
      throw error;
    }
  }
  return audioContext;
};

// Generate a notification sound
const generateNotificationSound = async (): Promise<AudioBuffer> => {
  const ctx = initAudioContext();
  
  // Create a pleasant notification sound (two-tone beep)
  const sampleRate = ctx.sampleRate;
  const duration = 0.3; // 300ms
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  // Generate two-tone beep
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    // First tone (higher)
    const freq1 = t < duration / 2 ? 800 : 0;
    // Second tone (lower)
    const freq2 = t >= duration / 2 ? 600 : 0;
    
    const tone = freq1 > 0 
      ? Math.sin(2 * Math.PI * freq1 * t) 
      : Math.sin(2 * Math.PI * freq2 * (t - duration / 2));
    
    // Apply envelope to avoid clicks
    const envelope = t < 0.05 ? t / 0.05 : (t > duration - 0.05 ? (duration - t) / 0.05 : 1);
    data[i] = tone * envelope * 0.3; // 30% volume
  }
  
  return buffer;
};

// Play notification sound with multiple fallback methods
export const playNotificationSound = async (): Promise<void> => {
  console.log('🔔 Attempting to play notification sound...');
  
  // Method 1: Try Web Audio API with pre-generated buffer
  try {
    const ctx = initAudioContext();
    
    // Resume audio context if suspended
    if (ctx.state === 'suspended') {
      console.log('Audio context suspended, attempting to resume...');
      try {
        await ctx.resume();
        console.log('Audio context resumed:', ctx.state);
      } catch (resumeError) {
        console.warn('Failed to resume audio context, creating new one:', resumeError);
        // Create new context if resume fails
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }
    
    // Generate or reuse sound buffer
    if (!notificationSound) {
      console.log('Generating notification sound buffer...');
      notificationSound = await generateNotificationSound();
    }
    
    // Create and play sound
    const source = ctx.createBufferSource();
    source.buffer = notificationSound;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.6; // 60% volume for better audibility
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
    
    console.log('✅ Notification sound played via Web Audio API');
    
    // Clean up after sound finishes
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
    
    return; // Success, exit early
  } catch (webAudioError) {
    console.warn('Web Audio API method failed, trying fallback:', webAudioError);
  }
  
  // Method 2: Try simple oscillator (works even if buffer fails)
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
    
    console.log('✅ Notification sound played via Oscillator');
    return; // Success
  } catch (oscillatorError) {
    console.warn('Oscillator method failed, trying HTML5 Audio:', oscillatorError);
  }
  
  // Method 3: Try HTML5 Audio with generated WAV
  try {
    const sampleRate = 44100;
    const duration = 0.3;
    const numSamples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    // Generate two-tone beep
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = t < duration / 2 ? 800 : 600;
      const sample = Math.sin(2 * Math.PI * freq * t);
      const envelope = t < 0.05 ? t / 0.05 : (t > duration - 0.05 ? (duration - t) / 0.05 : 1);
      view.setInt16(44 + i * 2, sample * envelope * 32767, true);
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const audio = new Audio();
    audio.volume = 0.7;
    audio.src = URL.createObjectURL(blob);
    
    await audio.play();
    URL.revokeObjectURL(audio.src);
    
    console.log('✅ Notification sound played via HTML5 Audio');
    return; // Success
  } catch (html5Error) {
    console.error('❌ All sound notification methods failed:', html5Error);
    // Don't throw - just log the error so the app continues to work
  }
};

// Request notification permission (for browser notifications)
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Show browser notification (optional, for when app is in background)
export const showBrowserNotification = async (title: string, body: string, icon?: string) => {
  const hasPermission = await requestNotificationPermission();
  
  if (hasPermission) {
    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'autosupport-message',
        requireInteraction: false,
        silent: false
      });
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      // Handle click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  }
};

