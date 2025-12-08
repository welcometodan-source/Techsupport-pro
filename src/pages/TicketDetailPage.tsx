import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { playNotificationSound, showBrowserNotification } from '../utils/soundNotification';
import { scheduleBackgroundNotification } from '../utils/backgroundNotifications';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Video,
  Mic,
  Paperclip,
  Phone,
  MapPin,
  AlertCircle,
  CheckCircle,
  FileText,
  Download,
  Car,
  Settings,
  RotateCcw,
  X,
  FileVideo
} from 'lucide-react';
import type { Database } from '../lib/database.types';
import CustomerSettings from '../components/CustomerSettings';

type SupportTicket = Database['public']['Tables']['support_tickets']['Row'];
type TicketMessage = Database['public']['Tables']['ticket_messages']['Row'] & {
  sender: { full_name: string; role: string };
};
type ServiceRequest = Database['public']['Tables']['service_requests']['Row'];
type TicketAttachment = Database['public']['Tables']['ticket_attachments']['Row'];

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showServiceRequest, setShowServiceRequest] = useState(false);
  const [showCostEstimate, setShowCostEstimate] = useState(false);
  const [serviceType, setServiceType] = useState<'on_site' | 'online'>('online');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [submittingEstimate, setSubmittingEstimate] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [adminContactPhone, setAdminContactPhone] = useState('');
  const [showFinalPaymentModal, setShowFinalPaymentModal] = useState(false);
  const [finalPaymentReference, setFinalPaymentReference] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user'); // 'user' = front, 'environment' = rear
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);

  useEffect(() => {
    loadTicketData();
    loadAdminContact();
    if (profile?.role === 'customer') {
      loadPreferences();
    }

    // Mark messages as read when component mounts
    const timer = setTimeout(() => {
      markMessagesAsRead();
    }, 1000);

    // Set up auto-refresh for ticket metadata only (not messages - real-time handles those)
    const refreshInterval = setInterval(() => {
      refreshTicketMetadata();
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(refreshInterval);
    };
  }, [id]);

  // Set up real-time subscription separately to ensure it's always active
  useEffect(() => {
    if (!id || !user) return;

    console.log('Setting up real-time subscription for ticket:', id, 'user:', user.id);
    const cleanup = subscribeToMessages();

    return () => {
      console.log('Cleaning up real-time subscription');
      if (cleanup) cleanup();
    };
  }, [id, user?.id]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
    scrollToBottom();
    }
  }, [messages]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoStream && videoPreviewRef.current) {
      const video = videoPreviewRef.current;
      video.srcObject = videoStream;
      
      // Ensure video plays
      video.play().catch((error) => {
        console.error('Error playing video stream:', error);
        // Retry after a short delay
        setTimeout(() => {
          if (video && video.srcObject) {
            video.play().catch(e => console.error('Retry play failed:', e));
          }
        }, 200);
      });
    } else if (!videoStream && videoPreviewRef.current) {
      // Clear video when stream is removed
      videoPreviewRef.current.srcObject = null;
    }
  }, [videoStream]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTicketData = async (skipMessages = false) => {
    if (!id) return;

    try {
      const [ticketRes, messagesRes, serviceRes, attachmentsRes] = await Promise.all([
        supabase
          .from('support_tickets')
          .select('*')
          .eq('id', id)
          .maybeSingle(),
        skipMessages ? Promise.resolve({ data: null, error: null }) : supabase
          .from('ticket_messages')
          .select(`
            *,
            sender:profiles(full_name, role)
          `)
          .eq('ticket_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('service_requests')
          .select('*')
          .eq('ticket_id', id)
          .maybeSingle(),
        supabase
          .from('ticket_attachments')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: true })
      ]);

      // For technicians: verify ticket is assigned to them and not resolved
      if (profile?.role === 'technician' && ticketRes.data) {
        const ticket = ticketRes.data as any;
        // Check if ticket is resolved/closed (technician loses access after completion)
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          alert('This ticket has been completed. You no longer have access. Please contact admin if you need to reopen this ticket.');
          navigate('/dashboard');
          return;
        }
        // Check if ticket is assigned to this technician
        if (ticket.assigned_technician_id !== profile.id) {
          alert('You do not have access to this ticket. Only assigned technicians can view tickets.');
          navigate('/dashboard');
          return;
        }
      }

      if (ticketRes.data) setTicket(ticketRes.data);
      if (messagesRes.data && !skipMessages) {
        // Only update messages if we're not skipping (initial load)
        // For refreshes, rely on real-time updates to avoid overwriting
        setMessages((prev) => {
          const newMessages = messagesRes.data as any;
          // Create a map of existing message IDs
          const existingIds = new Set(prev.map(m => m.id));
          // Add only new messages that don't exist yet
          const uniqueNewMessages = newMessages.filter((m: any) => !existingIds.has(m.id));
          // Merge and sort by created_at
          const merged = [...prev, ...uniqueNewMessages].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return merged;
        });
      }
      if (serviceRes.data) setServiceRequest(serviceRes.data);
      if (attachmentsRes.data) setAttachments(attachmentsRes.data);
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  // Lightweight refresh that only updates ticket metadata, not messages
  const refreshTicketMetadata = async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (data) setTicket(data);
    } catch (error) {
      console.error('Error refreshing ticket metadata:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!id || !user) return;

    try {
      console.log('Marking messages as read for ticket:', id, 'user:', user.id);
      const { error } = await supabase.rpc('mark_ticket_messages_read', {
        ticket_id_param: id,
        user_id_param: user.id
      });

      if (error) {
        console.error('Error marking messages as read:', error);
      } else {
        console.log('Messages marked as read successfully');
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!id || !user) return () => {};

    console.log('Setting up real-time subscription for ticket:', id);

    const channel = supabase
      .channel(`ticket-${id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${id}`
        },
        async (payload) => {
          console.log('🔔 New message received via real-time:', payload);

          // Fetch the new message with sender information
          const { data: newMsg, error } = await supabase
            .from('ticket_messages')
            .select(`
              *,
              sender:profiles(full_name, role)
            `)
            .eq('id', payload.new.id)
            .maybeSingle();

          console.log('Fetched message data:', newMsg, 'Error:', error);

          if (newMsg && !error) {
            const isFromCurrentUser = (newMsg as any).sender_id === user.id;
            
            // Add message instantly using functional update to avoid race conditions
            setMessages((prev) => {
              // Check if message already exists to avoid duplicates
              const exists = prev.some(m => m.id === newMsg.id);
              if (exists) {
                console.log('Message already exists, skipping:', newMsg.id);
                return prev;
              }
              console.log('✅ Adding new message. Previous count:', prev.length, 'New count:', prev.length + 1);
              // Sort to maintain chronological order
              const updated = [...prev, newMsg as TicketMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return updated;
            });

            // Play sound and show notification only if message is from someone else
            if (!isFromCurrentUser) {
              const senderName = (newMsg as any).sender?.full_name || 'Someone';
              const messagePreview = (newMsg as any).message?.substring(0, 50) || 'New message';
              const notificationTitle = 'New Message';
              const notificationBody = `${senderName}: ${messagePreview}...`;
              
              // Play sound notification (works when app is open)
              playNotificationSound().catch(err => {
                console.error('Sound notification error:', err);
                setTimeout(() => {
                  playNotificationSound().catch(e => console.error('Retry sound failed:', e));
                }, 500);
              });
              
              // Schedule background notification (works even when screen is off or app is closed)
              scheduleBackgroundNotification(
                notificationTitle,
                notificationBody,
                { ticketId: id, type: 'message' },
                true // Play sound
              ).catch(err => console.error('Background notification error:', err));
              
              // Show browser notification if app is in background (web fallback)
              if (document.hidden || !document.hasFocus()) {
                showBrowserNotification(notificationTitle, notificationBody)
                  .catch(err => console.error('Browser notification error:', err));
              }
              
              // Scroll to bottom to show new message
              setTimeout(() => {
                scrollToBottom();
              }, 100);
              
              // Mark as read after a short delay
              setTimeout(() => {
                markMessagesAsRead();
              }, 500);
            } else {
              // If from current user, just scroll to bottom
              setTimeout(() => {
                scrollToBottom();
              }, 100);
            }
            
            // Don't reload all data - just refresh ticket metadata if needed
            // The message is already added to state above
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${id}`
        },
        (payload) => {
          // Update message if it was modified
          setMessages((prev) => 
            prev.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } as TicketMessage : msg)
          );
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to ticket messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to ticket messages');
          // Try to resubscribe after a delay
          setTimeout(() => {
            console.log('Retrying subscription...');
            channel.subscribe();
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Subscription timed out, retrying...');
          setTimeout(() => {
            channel.subscribe();
          }, 1000);
        }
      });

    return () => {
      console.log('Cleaning up subscription for ticket:', id);
      try {
      supabase.removeChannel(channel);
      } catch (error) {
        console.error('Error removing channel:', error);
      }
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: id,
          sender_id: user.id,
          message: newMessage,
          message_type: 'text' as const
        } as any);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File, fileType: 'image' | 'video' | 'audio' | 'file') => {
    if (!user || !id) {
      alert('You must be logged in to upload files.');
      return;
    }

    setUploading(true);
    try {
      console.log('Starting file upload:', { fileName: file.name, fileSize: file.size, fileType: file.type });

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const timestamp = Date.now();
      const fileName = `${user.id}/${timestamp}.${fileExt}`;

      console.log('Uploading to storage:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        
        // Check if it's a MIME type error
        if (uploadError.message?.includes('mime type') || uploadError.message?.includes('not supported')) {
          alert(`Upload failed: ${file.type} is not supported. Please try a different format or contact support.`);
        } else {
          alert(`Upload failed: ${uploadError.message || 'Unknown error'}. Please try again.`);
        }
        
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      const { data: { publicUrl } } = supabase.storage
        .from('ticket-attachments')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      const { error: attachmentError } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: id,
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: fileName,
          file_url: publicUrl
        } as any);

      if (attachmentError) {
        console.error('Attachment record error:', attachmentError);
        throw attachmentError;
      }

      const { error: messageError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: id,
          sender_id: user.id,
          message: `Uploaded ${fileType}: ${file.name}`,
          message_type: fileType,
          media_url: publicUrl
        } as any);

      if (messageError) {
        console.error('Message error:', messageError);
        throw messageError;
      }

      console.log('File upload complete');
      await loadTicketData();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const errorMessage = error.message || 'Failed to upload file. Please try again.';
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = () => {
    imageInputRef.current?.click();
  };

  const handleVideoUpload = () => {
    videoInputRef.current?.click();
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file, 'image');
      e.target.value = '';
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file, 'video');
      e.target.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file, 'file');
      e.target.value = '';
    }
  };

  const handleAudioRecord = async () => {
    if (!isRecording) {
      try {
        // Check if MediaRecorder is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Microphone access is not supported on this device.');
          return;
        }

        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        // Check if MediaRecorder is supported
        if (!MediaRecorder.isTypeSupported('audio/webm') && !MediaRecorder.isTypeSupported('audio/mp4')) {
          alert('Audio recording format not supported on this device.');
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm'; // fallback

        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          try {
            // Stop timer
            if (recordingTimerRef.current) {
              clearInterval(recordingTimerRef.current);
              recordingTimerRef.current = null;
            }
            
            if (chunks.length === 0) {
              alert('No audio recorded. Please try again.');
              stream.getTracks().forEach(track => track.stop());
              setIsRecording(false);
              setRecordingDuration(0);
              return;
            }

            const blob = new Blob(chunks, { type: mimeType });
            const file = new File([blob], `audio-${Date.now()}.${mimeType.split('/')[1]}`, { type: mimeType });
          await handleFileUpload(file, 'audio');
          stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            setRecordingDuration(0);
          } catch (error) {
            console.error('Error processing recording:', error);
            alert('Failed to process recording. Please try again.');
            stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            setRecordingDuration(0);
          }
        };

        recorder.onerror = (event: any) => {
          console.error('MediaRecorder error:', event);
          alert('Recording error occurred. Please try again.');
          stream.getTracks().forEach(track => track.stop());
          
          // Stop timer on error
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          
          setIsRecording(false);
          setMediaRecorder(null);
          setRecordingDuration(0);
        };

        recorder.start(1000); // Collect data every second
        setMediaRecorder(recorder);
        setIsRecording(true);
        setRecordingDuration(0);
        
        // Start timer
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } catch (error: any) {
        console.error('Error starting recording:', error);
        
        let errorMessage = 'Failed to start recording. ';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage += 'Please allow microphone access in your browser/app settings and try again.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage += 'No microphone found. Please connect a microphone and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage += 'Microphone is being used by another application. Please close other apps and try again.';
        } else {
          errorMessage += 'Please check your microphone settings and try again.';
        }
        
        alert(errorMessage);
        setIsRecording(false);
        setMediaRecorder(null);
      }
    } else {
      try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        
        // Stop timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
      setIsRecording(false);
      setMediaRecorder(null);
        setRecordingDuration(0);
      } catch (error) {
        console.error('Error stopping recording:', error);
        
        // Stop timer on error
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        setIsRecording(false);
        setMediaRecorder(null);
        setRecordingDuration(0);
      }
    }
  };
  
  // Format recording duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const cleanupVideoSession = (streamToStop?: MediaStream) => {
    const targetStream = streamToStop || videoStream;
    if (targetStream) {
      targetStream.getTracks().forEach(track => track.stop());
    }
    setVideoStream(null);
    setMediaRecorder(null);
    setIsRecordingVideo(false);
    setIsProcessingVideo(false);
    setIsVideoPreviewOpen(false);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setVideoPreview(null);
  };

  const openVideoPreview = async () => {
    try {
      setIsProcessingVideo(false);
      setIsVideoPreviewOpen(true);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Video recording is not supported on this device.');
        setIsVideoPreviewOpen(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: cameraFacing
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setVideoStream(stream);
    } catch (error: any) {
      console.error('Error starting camera preview:', error);
      let errorMessage = 'Failed to access camera. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera and microphone access in your app settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Camera is being used by another application. Please close other apps and try again.';
      } else {
        errorMessage += `Please check your camera settings. Error: ${error.message || 'Unknown error'}.`;
      }
      alert(errorMessage);
      setIsVideoPreviewOpen(false);
      cleanupVideoSession();
    }
  };

  const startVideoRecording = async (stream: MediaStream) => {
    try {
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else {
        alert('Video recording format not supported on this device.');
        cleanupVideoSession(stream);
        return;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        try {
          if (chunks.length === 0) {
            alert('No video recorded. Please try again.');
            cleanupVideoSession(stream);
            return;
          }

          const blob = new Blob(chunks, { type: mimeType });
          const baseMimeType = mimeType.split(';')[0];
          const ext = baseMimeType.includes('mp4') ? 'mp4' : baseMimeType.includes('webm') ? 'webm' : 'mp4';
          const file = new File([blob], `video-${Date.now()}.${ext}`, { type: baseMimeType });
          await handleFileUpload(file, 'video');
        } catch (error) {
          console.error('Error processing video recording:', error);
          alert('Failed to process video recording. Please try again.');
        } finally {
          cleanupVideoSession(stream);
        }
      };

      recorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event);
        const recError = (event as any).error || event;
        alert(`Recording error: ${recError.message || 'Unknown error'}. Please try again.`);
        cleanupVideoSession(stream);
      };

      setIsProcessingVideo(false);
      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecordingVideo(true);
    } catch (error: any) {
      console.error('Error preparing video recorder:', error);
      alert(`Failed to start recording: ${error.message || 'Unknown error'}. Please try again.`);
      cleanupVideoSession(stream);
    }
  };

  const stopVideoRecording = async () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        setIsRecordingVideo(false);
        setIsProcessingVideo(true);
        mediaRecorder.stop();
        // Hide preview while processing/uploading
        setIsVideoPreviewOpen(false);
      } catch (error) {
        console.error('Error stopping video recording:', error);
        cleanupVideoSession();
      }
    }
  };

  const closeVideoPreview = () => {
    if (isRecordingVideo) {
      alert('Stop recording before closing the camera preview.');
      return;
    }
    if (isProcessingVideo) {
      alert('Video is processing. Please wait a moment.');
      return;
    }
    cleanupVideoSession();
  };

  const handleVideoRecord = async () => {
    if (!isVideoPreviewOpen) {
      await openVideoPreview();
      return;
    }

    if (!videoStream) {
      alert('Camera preview is still loading. Please wait a moment.');
      return;
    }

    if (isProcessingVideo) {
      alert('Please wait until the current video finishes processing.');
      return;
    }

    if (!isRecordingVideo) {
      await startVideoRecording(videoStream);
    } else {
      await stopVideoRecording();
    }
  };

  const switchCamera = async () => {
    if (!isVideoPreviewOpen) {
      await openVideoPreview();
      return;
    }

    if (isRecordingVideo || isProcessingVideo) {
      alert('Please wait until recording finishes before switching camera.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera switching is not supported on this device.');
      return;
    }

    try {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }

      const newFacingMode = cameraFacing === 'user' ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: newFacingMode
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setCameraFacing(newFacingMode);
      setVideoStream(newStream);
    } catch (error: any) {
      console.error('Error switching camera:', error);
      alert(`Failed to switch camera: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleSubmitCostEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!estimatedCost || !user || !id || !ticket) {
      alert('Please fill in all required fields.');
      return;
    }

    const costValue = parseFloat(estimatedCost);
    if (isNaN(costValue) || costValue <= 0) {
      alert('Please enter a valid cost amount greater than 0.');
      return;
    }

    setSubmittingEstimate(true);
    try {
      console.log('Submitting cost estimate:', {
        ticketId: id,
        serviceType,
        estimatedCost: costValue,
        technicianNotes,
        userId: user.id
      });

      const { error, data } = await supabase
        .from('support_tickets')
        .update({
          service_type: serviceType,
          estimated_cost: costValue,
          technician_notes: technicianNotes,
          cost_assessed_at: new Date().toISOString(),
          cost_assessed_by: user.id,
          status: 'awaiting_payment'
        } as any)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error updating ticket:', error);
        throw error;
      }

      console.log('Ticket updated successfully:', data);

      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: id,
          sender_id: user.id,
          message: `Cost Estimate Submitted:\n- Service Type: ${serviceType === 'on_site' ? 'On-Site Visit' : 'Online Support'}\n- Estimated Cost: $${estimatedCost}\n- Notes: ${technicianNotes || 'None'}`,
          message_type: 'text' as const
        } as any);

      // Create notification for customer
      await supabase
        .from('notifications')
        .insert({
          user_id: ticket.customer_id,
          title: 'Cost Estimate Ready',
          message: `Your technician has provided a cost estimate of $${estimatedCost} for ticket "${ticket.title}". Please review and proceed with payment.`,
          type: 'ticket_update',
          related_id: id
        } as any);

      setShowCostEstimate(false);
      loadTicketData();
      alert('Cost estimate submitted successfully!');
    } catch (error) {
      console.error('Error submitting cost estimate:', error);
      alert('Failed to submit cost estimate. Please try again.');
    } finally {
      setSubmittingEstimate(false);
    }
  };

  const loadAdminContact = async () => {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_contact_phone')
        .maybeSingle();

      if (data) {
        setAdminContactPhone(data.setting_value);
      }
    } catch (error) {
      console.error('Error loading admin contact:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_preferences')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) setPreferences(data);
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !paymentReference || !user || !id) return;

    setSubmittingPayment(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          payment_made: true,
          payment_made_at: new Date().toISOString(),
          payment_amount: parseFloat(paymentAmount),
          payment_reference: paymentReference,
          initial_payment_amount: parseFloat(paymentAmount)
        } as any)
        .eq('id', id);

      if (error) throw error;

      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: id,
          sender_id: user.id,
          message: `Initial Payment Submitted:\n- Amount: $${paymentAmount}\n- Reference: ${paymentReference}\n\nWaiting for admin confirmation...`,
          message_type: 'text' as const
        } as any);

      setShowPaymentModal(false);
      loadTicketData();
      alert('Payment submitted successfully! Waiting for admin confirmation.');
    } catch (error) {
      console.error('Error submitting payment:', error);
      alert('Failed to submit payment. Please try again.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSubmitFinalPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPaymentReference || !user || !id || !hasEstimate) return;

    setSubmittingPayment(true);
    try {
      const finalAmount = parseFloat(hasEstimate) / 2;

      const { error } = await supabase
        .from('support_tickets')
        .update({
          final_payment_made: true,
          final_payment_made_at: new Date().toISOString(),
          final_payment_amount: finalAmount,
          final_payment_reference: finalPaymentReference
        } as any)
        .eq('id', id);

      if (error) throw error;

      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: id,
          sender_id: user.id,
          message: `Final Payment Submitted:\n- Amount: $${finalAmount.toFixed(2)}\n- Reference: ${finalPaymentReference}\n\nWaiting for admin confirmation to complete the job...`,
          message_type: 'text' as const
        } as any);

      setShowFinalPaymentModal(false);
      setFinalPaymentReference('');
      loadTicketData();
      alert('Final payment submitted successfully! Waiting for admin confirmation.');
    } catch (error) {
      console.error('Error submitting final payment:', error);
      alert('Failed to submit final payment. Please try again.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-sky-500/20 text-sky-300 border border-sky-400/30';
      case 'in_progress': return 'bg-amber-500/20 text-amber-300 border border-amber-400/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
      case 'closed': return 'bg-slate-500/20 text-slate-300 border border-slate-400/30';
      default: return 'bg-slate-500/20 text-slate-300 border border-slate-400/30';
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (fileType.startsWith('video/')) return <Video className="w-5 h-5 text-purple-500" />;
    if (fileType.startsWith('audio/')) return <Mic className="w-5 h-5 text-green-500" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    return <Paperclip className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell theme-surface">
        <div className="relative mx-auto w-12 h-12">
          <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
          <div className="relative w-full h-full border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell theme-surface">
        <div className="text-center glass-card p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Ticket not found</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sky-400 hover:text-sky-300 font-medium"
          >
            Go back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const vehicleInfo = ticket.vehicle_info as any;
  const vehicleBrand = (ticket as any).vehicle_brand;
  const vehicleModel = (ticket as any).vehicle_model;
  const vehicleYear = (ticket as any).vehicle_year;
  const jobType = (ticket as any).job_type;
  const hasEstimate = (ticket as any).estimated_cost;
  const paymentMade = (ticket as any).payment_made;
  const paymentConfirmed = (ticket as any).payment_confirmed;
  const workAuthorized = (ticket as any).work_authorized;
  const isTicketResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const isCustomer = profile?.role === 'customer';
  const needsFinalPayment =
    isCustomer &&
    (ticket as any).service_type === 'on_site' &&
    paymentMade &&
    paymentConfirmed &&
    !(ticket as any).final_payment_made &&
    !isTicketResolved;

  const getBackgroundStyle = () => {
    if (!preferences) return {};

    if (preferences.background_type === 'image' && preferences.background_image_url) {
      return {
        backgroundImage: `url(${preferences.background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      };
    } else if (preferences.background_type === 'gradient') {
      return { background: preferences.background_value };
    } else if (preferences.background_type === 'color') {
      return { backgroundColor: preferences.background_value };
    }
    return {};
  };

  const getFontSize = () => {
    if (!preferences) return '';
    switch (preferences.font_size) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      default: return 'text-base';
    }
  };

  return (
    <div
      className={`h-screen max-h-screen flex flex-col page-shell theme-surface overflow-hidden ${getFontSize()}`}
      style={{
        ...(profile?.role === 'customer' ? getBackgroundStyle() : {}),
        height: '100dvh', // Dynamic viewport height for mobile
        maxHeight: '100dvh'
      }}
    >
      <header className="glass-card border-b border-white/10 px-2 sm:px-3 py-1.5 sm:py-2 shadow-[0_20px_60px_rgba(1,6,15,0.6)] flex-shrink-0 z-10">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1 sm:p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm md:text-base font-bold text-white truncate">{ticket.title}</h1>
              <div className="flex items-center space-x-1 sm:space-x-1.5 mt-0.5 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-slate-300 truncate">
                  {vehicleBrand} {vehicleModel} {vehicleYear}
                </span>
                {jobType && (
                  <span className="text-[10px] text-slate-400">
                    • {jobType}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 flex-wrap gap-1">
            {profile?.role === 'customer' && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-1 sm:p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all shrink-0"
                title="Customize Page"
              >
                <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
            {profile?.role === 'technician' && !hasEstimate && (
              <button
                onClick={() => setShowCostEstimate(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-medium flex items-center space-x-1 transition-colors shrink-0"
              >
                <span className="hidden sm:inline">Cost Estimate</span>
                <span className="sm:hidden">Estimate</span>
              </button>
            )}
            {profile?.role === 'technician' && workAuthorized && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <button
                onClick={async () => {
                  const isOnSite = (ticket as any).service_type === 'on_site';
                  const finalPaymentConfirmed = (ticket as any).final_payment_confirmed;

                  if (isOnSite && !finalPaymentConfirmed) {
                    alert('Cannot complete job. Waiting for customer to make final payment (remaining 50%).');
                    return;
                  }

                  if (!confirm('Mark this job as complete and close the ticket? You will lose access to this ticket after completion.')) return;
                  try {
                    const { error } = await supabase
                      .from('support_tickets')
                      .update({
                        status: 'resolved',
                        resolved_at: new Date().toISOString(),
                        // Keep assigned_technician_id so ticket remains visible in dashboard for reference
                        work_authorized: false // Revoke work authorization
                      } as any)
                      .eq('id', id);

                    if (error) throw error;

                    await supabase
                      .from('ticket_messages')
                      .insert({
                        ticket_id: id!,
                        sender_id: user!.id,
                        message: 'Job completed. Ticket has been marked as resolved. Technician access has been revoked.',
                        message_type: 'text' as const
                      } as any);

                    // Redirect technician to dashboard after completion
                    setTimeout(() => {
                      alert('Job marked as complete! You no longer have access to this ticket.');
                      navigate('/dashboard');
                    }, 500);
                  } catch (error) {
                    console.error('Error completing job:', error);
                    alert('Failed to mark job as complete. Please try again.');
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors shrink-0"
              >
                <CheckCircle className="w-3 h-3" />
                <span>Complete</span>
              </button>
            )}
            {profile?.role === 'customer' && (
              <button
                onClick={() => setShowServiceRequest(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-medium flex items-center space-x-0.5 sm:space-x-1 transition-colors shrink-0"
              >
                <MapPin className="w-3 h-3" />
                <span className="hidden sm:inline">Visit</span>
              </button>
            )}
            <button
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-medium flex items-center space-x-0.5 sm:space-x-1 transition-colors shrink-0 ${
                workAuthorized
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!workAuthorized}
              title={!workAuthorized ? 'Call available after payment confirmation' : 'Start a call'}
            >
              <Phone className="w-3 h-3" />
              <span className="hidden sm:inline">Call</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div className="flex-1 flex flex-col min-h-0 w-full relative">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 min-h-0 pb-28 sm:pb-32" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom) + 7rem)' }}>
            <div className="glass-card border border-white/10 p-1.5 sm:p-2">
              <div className="flex items-start space-x-1.5 sm:space-x-2">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-0.5 text-[10px] sm:text-xs">Problem Description</h3>
                  <p className="text-slate-200 text-[9px] sm:text-[10px] leading-relaxed">{ticket.description}</p>
                  <div className="mt-1 text-[9px] sm:text-[10px] text-slate-300">
                    Category: <span className="font-medium">{ticket.category.replace('_', ' ')}</span>
                    {' • '}
                    Priority: <span className="font-medium">{ticket.priority}</span>
                  </div>
                </div>
              </div>
            </div>

            {(vehicleBrand || vehicleModel || vehicleYear) && (
              <div className="glass-card border border-white/10 p-1.5 sm:p-2">
                <div className="flex items-start space-x-1.5 sm:space-x-2">
                  <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-0.5 text-xs">Vehicle Information</h3>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      {vehicleBrand && (
                        <div>
                          <span className="text-slate-300">Brand:</span>
                          <span className="ml-1 font-medium text-white">{vehicleBrand}</span>
                        </div>
                      )}
                      {vehicleModel && (
                        <div>
                          <span className="text-slate-300">Model:</span>
                          <span className="ml-1 font-medium text-white">{vehicleModel}</span>
                        </div>
                      )}
                      {vehicleYear && (
                        <div>
                          <span className="text-slate-300">Year:</span>
                          <span className="ml-1 font-medium text-white">{vehicleYear}</span>
                        </div>
                      )}
                      {jobType && (
                        <div>
                          <span className="text-slate-300">Job:</span>
                          <span className="ml-1 font-medium text-white">{jobType}</span>
                        </div>
                      )}
                      {vehicleInfo?.vin && (
                        <div className="col-span-2">
                          <span className="text-slate-300">VIN:</span>
                          <span className="ml-1 font-medium text-white font-mono text-[9px] truncate block">{vehicleInfo.vin}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="glass-card border border-white/10 p-2">
                <div className="flex items-start space-x-2">
                  <Paperclip className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-1 text-xs">Attachments ({attachments.length})</h3>
                    <div className="space-y-1.5">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between glass-card p-1.5 border border-white/10 rounded"
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            {getFileIcon(attachment.file_type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium text-white truncate">
                                {attachment.file_name}
                              </p>
                              <p className="text-[9px] text-slate-300">
                                {formatFileSize(attachment.file_size)} • {attachment.file_type.split('/')[0]}
                              </p>
                            </div>
                          </div>
                          <a
                            href={attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 flex items-center space-x-0.5 text-purple-400 hover:text-purple-300 text-[10px] font-medium shrink-0"
                          >
                            <Download className="w-3 h-3" />
                            <span>View</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasEstimate && (
              <div className="glass-card border border-white/10 p-2">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-1 text-xs">Cost Estimate</h3>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300">Service:</span>
                        <span className="font-medium text-white text-[10px]">
                          {(ticket as any).service_type === 'on_site' ? 'On-Site' : 'Online'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300">Cost:</span>
                        <span className="font-bold text-emerald-300 text-sm">
                          ${parseFloat(hasEstimate).toFixed(2)}
                        </span>
                      </div>
                      {(ticket as any).technician_notes && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-sm text-slate-200">{(ticket as any).technician_notes}</p>
                        </div>
                      )}
                      {(ticket as any).service_type === 'on_site' && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-slate-300">
                            • 50% payment required upfront (${(parseFloat(hasEstimate) / 2).toFixed(2)})<br/>
                            • Remaining 50% due upon completion (${(parseFloat(hasEstimate) / 2).toFixed(2)})
                          </p>
                        </div>
                      )}
                      {(ticket as any).service_type === 'online' && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-slate-300">
                            • Full payment required before work begins
                          </p>
                        </div>
                      )}

                      {/* Payment Status */}
                      {paymentMade && !paymentConfirmed && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                              <span className="text-amber-300 font-medium">Payment pending confirmation</span>
                            </div>
                          </div>
                          <div className="glass-card rounded p-2 mb-2 border border-white/10">
                            <p className="text-xs text-slate-200">
                              <strong>Amount:</strong> ${parseFloat((ticket as any).payment_amount).toFixed(2)}<br/>
                              <strong>Reference:</strong> {(ticket as any).payment_reference}<br/>
                              <strong>Submitted:</strong> {new Date((ticket as any).payment_made_at).toLocaleString()}
                            </p>
                          </div>
                          {profile?.role === 'admin' && (
                            <button
                              onClick={async () => {
                                if (!confirm('Confirm that payment has been received?')) return;
                                try {
                                  // Update ticket with payment confirmation
                                  const { error: ticketError } = await supabase
                                    .from('support_tickets')
                                    .update({
                                      payment_confirmed: true,
                                      payment_confirmed_at: new Date().toISOString(),
                                      payment_confirmed_by: user!.id,
                                      work_authorized: true
                                    } as any)
                                    .eq('id', id);

                                  if (ticketError) throw ticketError;

                                  // Create payment record in payments table
                                  const { error: paymentError } = await supabase
                                    .from('payments')
                                    .insert({
                                      customer_id: (ticket as any).customer_id,
                                      ticket_id: id,
                                      amount: (ticket as any).payment_amount,
                                      currency: 'USD',
                                      payment_method: 'bank_transfer',
                                      payment_status: 'completed',
                                      payment_type: 'full'
                                    } as any);

                                  if (paymentError) throw paymentError;

                                  await supabase
                                    .from('ticket_messages')
                                    .insert({
                                      ticket_id: id,
                                      sender_id: user!.id,
                                      message: 'Payment confirmed by admin. Work is now authorized. Technician can begin working on this ticket.',
                                      message_type: 'text' as const
                                    } as any);

                                  loadTicketData();
                                  alert('Payment confirmed! Work is now authorized.');
                                } catch (error) {
                                  console.error('Error confirming payment:', error);
                                  alert('Failed to confirm payment. Please try again.');
                                }
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                              Confirm Payment Received
                            </button>
                          )}
                        </div>
                      )}

                      {paymentConfirmed && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-300 font-medium">Payment confirmed - Work authorized</span>
                          </div>
                        </div>
                      )}

                      {/* Pay Button for Customer */}
                      {profile?.role === 'customer' && hasEstimate && !paymentMade && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <button
                            onClick={() => {
                              const amount = (ticket as any).service_type === 'on_site'
                                ? (parseFloat(hasEstimate) / 2).toFixed(2)
                                : parseFloat(hasEstimate).toFixed(2);
                              setPaymentAmount(amount);
                              setShowPaymentModal(true);
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            Make Payment ${(ticket as any).service_type === 'on_site'
                              ? `(Initial: ${(parseFloat(hasEstimate) / 2).toFixed(2)})`
                              : parseFloat(hasEstimate).toFixed(2)}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Final Payment Section for On-Site Jobs */}
            {needsFinalPayment && (
              <div className="glass-card border border-amber-400/30 rounded-lg p-3">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">Final Payment Required</h3>
                    <p className="text-slate-200 text-sm mb-3">
                      Initial payment received. Final payment (remaining 50%) is required before job completion.
                    </p>
                    <div className="glass-card border border-white/10 rounded p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <span className="text-slate-300">Total Estimate:</span>
                          <p className="font-bold text-white">${parseFloat(hasEstimate || '0').toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-slate-300">Initial Paid:</span>
                          <p className="font-bold text-emerald-300">${parseFloat((ticket as any).initial_payment_amount || '0').toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-slate-300">Remaining:</span>
                          <p className="font-bold text-amber-300">${(parseFloat(hasEstimate || '0') / 2).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-slate-300">Status:</span>
                          <p className="font-medium text-amber-300">Awaiting Payment</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowFinalPaymentModal(true)}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Pay Remaining Balance (${(parseFloat(hasEstimate || '0') / 2).toFixed(2)})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Final Payment Submitted - Awaiting Confirmation */}
            {profile?.role === 'customer' &&
             (ticket as any).service_type === 'on_site' &&
             (ticket as any).final_payment_made &&
             !(ticket as any).final_payment_confirmed &&
             !isTicketResolved && (
              <div className="glass-card border border-sky-400/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">Final Payment Submitted</h3>
                    <p className="text-slate-200 text-sm">
                      Your final payment of ${parseFloat((ticket as any).final_payment_amount || '0').toFixed(2)} has been submitted and is awaiting admin confirmation.
                    </p>
                    <div className="mt-2 text-xs text-slate-300">
                      Reference: {(ticket as any).final_payment_reference || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {serviceRequest && (
              <div className="glass-card border border-orange-400/30 rounded-lg p-2">
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-0.5 text-xs">Service Visit Requested</h3>
                    <p className="text-slate-200 text-[10px]">{serviceRequest.address}</p>
                    <div className="mt-1 text-[10px] text-slate-300">
                      Status: <span className="font-medium">{serviceRequest.status.replace('_', ' ')}</span>
                      {serviceRequest.scheduled_date && (
                        <>
                          {' • '}
                          <span className="font-medium">{new Date(serviceRequest.scheduled_date).toLocaleDateString()}</span>
                        </>
                      )}
                      {serviceRequest.estimated_cost && (
                        <>
                          {' • '}
                          <span className="font-medium">${serviceRequest.estimated_cost}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 sm:mb-2`}
                >
                  <div className={`w-full max-w-[50%] sm:max-w-[60%] md:max-w-[50%] ${isOwn ? 'bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-md border border-slate-700/50 text-white shadow-lg' : 'glass-card border border-white/10 text-white'} rounded-lg p-2 sm:p-3 shadow-sm`}>
                    <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1.5">
                      <span className={`font-semibold text-sm sm:text-base px-2 py-1 rounded-lg border ${
                        message.sender.role === 'technician' 
                          ? 'text-orange-400 bg-orange-500/10 border-orange-400/30' 
                          : message.sender.role === 'customer' 
                          ? 'text-green-400 bg-green-500/10 border-green-400/30' 
                          : 'text-white bg-white/10 border-white/20'
                      }`}>
                        {message.sender.full_name}
                      </span>
                      {message.sender.role === 'technician' && (
                        <span className="bg-sky-500/30 text-sky-300 border border-sky-400/30 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full">
                          Tech
                        </span>
                      )}
                    </div>
                    {/* Only show message text if it's not a video, audio, or file message (hide "Uploaded video/audio/file: ..." text) */}
                    {(message as any).message_type !== 'video' && (message as any).message_type !== 'audio' && (message as any).message_type !== 'file' && (
                      <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{message.message}</p>
                    )}

                    {/* Display media if available */}
                    {(message as any).media_url && (
                      <div className="mt-1.5 sm:mt-2">
                        {(message as any).message_type === 'image' && (
                          <img
                            src={(message as any).media_url}
                            alt="Attached"
                            className="max-w-[200px] sm:max-w-[280px] max-h-[150px] sm:max-h-[200px] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open((message as any).media_url, '_blank')}
                          />
                        )}
                        {(message as any).message_type === 'video' && (
                          <div className="relative w-full max-w-full">
                          <video
                            src={(message as any).media_url}
                            controls
                              className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity bg-black/20 max-h-[180px] sm:max-h-[240px] md:max-h-[200px]"
                              style={{ 
                                aspectRatio: '16/9',
                                maxWidth: '100%',
                                width: '100%'
                              }}
                              onClick={(e) => {
                                // Allow clicking to open in fullscreen or new tab
                                const video = e.currentTarget;
                                if (video.requestFullscreen) {
                                  video.requestFullscreen().catch(() => {
                                    // Fallback to opening in new tab if fullscreen fails
                                    window.open((message as any).media_url, '_blank');
                                  });
                                } else {
                                  window.open((message as any).media_url, '_blank');
                                }
                              }}
                            />
                          </div>
                        )}
                        {(message as any).message_type === 'audio' && (
                          <audio
                            src={(message as any).media_url}
                            controls
                            className="w-full mt-1"
                          />
                        )}
                        {(message as any).message_type === 'file' && (
                          <a
                            href={(message as any).media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center space-x-1.5 sm:space-x-2 mt-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded ${
                              isOwn ? 'bg-slate-700/80 hover:bg-slate-800/80 border border-slate-600/50' : 'bg-white/10 hover:bg-white/20 border border-white/10'
                            }`}
                          >
                            <Paperclip className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="text-[10px] sm:text-sm">View File</span>
                          </a>
                        )}
                      </div>
                    )}

                    <span className={`text-[10px] sm:text-xs ${isOwn ? 'text-slate-200' : 'text-slate-300'} mt-1 block`}>
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} className="h-2 sm:h-4" />
          </div>

          {/* Video Preview Modal */}
          {isVideoPreviewOpen && (
            <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-md relative">
                {videoStream ? (
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full rounded-lg bg-black"
                    style={{ 
                      maxHeight: '70vh', 
                      minHeight: '50vh',
                      objectFit: 'cover',
                      transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'scaleX(1)' // Mirror front camera
                    }}
                    onLoadedMetadata={() => {
                      if (videoPreviewRef.current) {
                        videoPreviewRef.current.play().catch(e => {
                          console.error('Error playing video on metadata load:', e);
                        });
                      }
                    }}
                    onError={(e) => {
                      console.error('Video element error:', e);
                    }}
                  />
                ) : (
                  <div className="w-full h-64 rounded-lg bg-black flex items-center justify-center text-white text-sm">
                    Initializing camera...
                  </div>
                )}
                {/* Close button */}
                <button
                  onClick={closeVideoPreview}
                  disabled={isRecordingVideo}
                  className={`absolute top-4 left-4 p-2 rounded-full transition-all z-10 ${
                    isRecordingVideo
                      ? 'bg-white/10 text-white/50 cursor-not-allowed'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title="Close camera preview"
                >
                  <X className="w-5 h-5" />
                </button>
                {/* Camera flip button */}
                <button
                  onClick={switchCamera}
                  disabled={isRecordingVideo}
                  className={`absolute top-4 right-4 p-2 rounded-full transition-all z-10 ${
                    isRecordingVideo
                      ? 'bg-white/10 text-white/50 cursor-not-allowed'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title={
                    isRecordingVideo
                      ? 'Stop recording to switch camera'
                      : cameraFacing === 'user'
                        ? 'Switch to rear camera'
                        : 'Switch to front camera'
                  }
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isProcessingVideo
                          ? 'bg-amber-400 animate-pulse'
                          : isRecordingVideo
                          ? 'bg-red-500 animate-pulse'
                          : 'bg-sky-400'
                      }`}
                    ></div>
                    <span className="text-white text-sm font-medium">
                      {isProcessingVideo
                        ? 'Processing video...'
                        : isRecordingVideo
                        ? 'Recording...'
                        : 'Camera ready'}
                    </span>
                  </div>
                  <button
                    onClick={handleVideoRecord}
                    className={`px-5 py-2 rounded-lg font-medium flex items-center gap-2 text-sm transition-all ${
                      isProcessingVideo
                        ? 'bg-slate-500/60 text-white cursor-wait'
                        : isRecordingVideo
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-sky-500 hover:bg-sky-600 text-white'
                    }`}
                    disabled={!videoStream || isProcessingVideo}
                  >
                    <Video className="w-4 h-4" />
                    {isProcessingVideo
                      ? 'Processing...'
                      : isRecordingVideo
                      ? 'Stop Recording'
                      : 'Start Recording'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 glass-card border-t border-white/10 p-1.5 sm:p-2 flex-shrink-0 bg-[#02122b]/95 backdrop-blur-sm z-20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />

            <form onSubmit={handleSendMessage} className="flex items-end space-x-1 sm:space-x-1.5">
              <div className="flex space-x-0.5 sm:space-x-1">
                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={uploading || !workAuthorized || (isCustomer && isTicketResolved)}
                  className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                  title="Upload image"
                >
                  <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleVideoUpload}
                  disabled={uploading || !workAuthorized || (isCustomer && isTicketResolved)}
                  className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                  title="Upload saved video"
                >
                  <FileVideo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    if (isCustomer && isTicketResolved) {
                      e.preventDefault();
                      alert(`This ticket has been resolved. If you have any complaints, please contact the manager at ${adminContactPhone || 'the admin'} or open a new ticket. Thank you!`);
                      return;
                    }
                    handleVideoRecord();
                  }}
                  disabled={uploading || !workAuthorized || isRecording || isProcessingVideo || (isCustomer && isTicketResolved)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 ${
                    isRecordingVideo ? 'text-red-400 bg-red-500/20' : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={
                    isCustomer && isTicketResolved
                      ? 'This ticket has been resolved. Contact manager or open a new ticket.'
                      : isProcessingVideo
                      ? "Processing previous video..."
                      : isRecordingVideo
                      ? "Stop recording video"
                      : "Record instant video"
                  }
                >
                  <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {isRecording && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-400/30 rounded-lg">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-red-400 text-xs sm:text-sm font-mono font-semibold">
                        {formatDuration(recordingDuration)}
                      </span>
                    </div>
                  )}
                <button
                  type="button"
                  onClick={handleAudioRecord}
                    disabled={uploading || !workAuthorized || (isCustomer && isTicketResolved)}
                    className={`p-1 sm:p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 ${
                      isRecording ? 'text-red-400 bg-red-500/20' : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={isRecording ? "Stop recording" : "Record audio"}
                >
                    <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                </div>
                <button
                  type="button"
                  onClick={handleFileAttach}
                  disabled={uploading || !workAuthorized || (isCustomer && isTicketResolved)}
                  className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                  title="Attach file"
                >
                  <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && workAuthorized) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                className="flex-1 px-1.5 sm:px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/50 resize-none disabled:bg-white/5 disabled:cursor-not-allowed text-white placeholder-slate-400"
                placeholder={
                  isCustomer && isTicketResolved 
                    ? "This ticket has been resolved..." 
                    : workAuthorized 
                    ? "Type your message..." 
                    : "Chat available after payment confirmation"
                }
                rows={1}
                disabled={!workAuthorized || (isCustomer && isTicketResolved)}
                onClick={() => {
                  if (isCustomer && isTicketResolved) {
                    alert(`This ticket has been resolved. If you have any complaints, please contact the manager at ${adminContactPhone || 'the admin'} or open a new ticket. Thank you!`);
                  }
                }}
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim() || !workAuthorized || (isCustomer && isTicketResolved)}
                onClick={(e) => {
                  if (isCustomer && isTicketResolved) {
                    e.preventDefault();
                    alert(`This ticket has been resolved. If you have any complaints, please contact the manager at ${adminContactPhone || 'the admin'} or open a new ticket. Thank you!`);
                  }
                }}
                className="bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 disabled:bg-slate-500/30 disabled:cursor-not-allowed text-white p-1 sm:p-1.5 rounded-lg transition-colors shadow-md"
                title={
                  isCustomer && isTicketResolved
                    ? 'This ticket has been resolved. Contact manager or open a new ticket.'
                    : !workAuthorized 
                    ? 'Chat available after payment confirmation' 
                    : 'Send message'
                }
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </form>
            {uploading && (
              <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-sm text-slate-300 flex items-center gap-1.5 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                Uploading file...
              </div>
            )}
            {isCustomer && isTicketResolved && (
              <div className="mt-2 p-3 bg-amber-500/20 border border-amber-400/30 rounded-lg">
                <p className="text-xs sm:text-sm text-amber-200 mb-2">
                  <strong>This ticket has been resolved.</strong> If you have any complaints, please contact the manager or open a new ticket.
                </p>
                {adminContactPhone && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={`tel:${adminContactPhone}`}
                      className="text-xs sm:text-sm text-amber-300 hover:text-amber-200 underline flex items-center gap-1"
                    >
                      📞 Contact Manager: {adminContactPhone}
                    </a>
          </div>
                )}
                <p className="text-xs text-amber-300/80 mt-2">
                  Or open a new ticket from your dashboard.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="glass-card rounded-xl max-w-md w-full my-2 sm:my-8 max-h-[95vh] sm:max-h-[90vh] flex flex-col border border-white/10">
            <div className="p-3 sm:p-6 border-b border-white/10 flex-shrink-0">
              <h2 className="text-lg sm:text-2xl font-bold text-white">Make Payment</h2>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <div className="glass-card border border-white/10 rounded-lg p-2.5 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-200">
                  {(ticket as any).service_type === 'on_site'
                    ? 'Initial payment (50%) required to start work. Remaining balance due upon completion.'
                    : 'Full payment required before work begins.'}
                </p>
              </div>

              {adminContactPhone && (
                <div className="glass-card border border-emerald-400/30 rounded-lg p-2.5 sm:p-4">
                  <p className="text-xs sm:text-sm font-semibold text-white mb-2">Contact Admin for Payment Details</p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm text-slate-300 mb-1">Call or WhatsApp for bank transfer details:</p>
                      <p className="text-sm sm:text-base font-bold text-emerald-300 break-all">{adminContactPhone}</p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${adminContactPhone}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 flex-1 sm:flex-initial justify-center"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone className="w-3 h-3" />
                        Call
                      </a>
                      <a
                        href={`https://wa.me/${adminContactPhone.replace(/[^0-9]/g, '')}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-colors flex-1 sm:flex-initial text-center"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-white mb-1.5 sm:mb-2">Payment Amount (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-white placeholder-slate-400"
                  placeholder="0.00"
                  required
                  readOnly
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-white mb-1.5 sm:mb-2">Payment Reference / Transaction ID *</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-white placeholder-slate-400"
                  placeholder="e.g., TXN123456789"
                  required
                />
                <p className="mt-1 text-[10px] sm:text-xs text-slate-300">
                  After making payment, enter your bank transfer reference or receipt number here.
                </p>
              </div>

              <div className="glass-card border border-amber-400/30 rounded-lg p-2.5 sm:p-3">
                <p className="text-[10px] sm:text-xs text-slate-200">
                  <strong>Note:</strong> After submitting, please wait for admin to confirm your payment. You'll be able to chat and call with the technician once payment is confirmed.
                </p>
              </div>
            </form>

            <div className="p-3 sm:p-6 border-t border-white/10 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-3 flex-shrink-0 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 sm:px-6 py-2 border border-white/10 rounded-lg hover:bg-white/10 font-medium transition-colors text-white text-sm sm:text-base"
                disabled={submittingPayment}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmitPayment}
                className="bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-4 sm:px-6 py-2 rounded-lg font-medium transition-colors disabled:bg-slate-500/30 disabled:cursor-not-allowed text-sm sm:text-base flex-1 sm:flex-initial"
                disabled={submittingPayment}
              >
                {submittingPayment ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-card rounded-xl max-w-md w-full my-8 max-h-[90vh] flex flex-col border border-white/10">
            <div className="p-6 border-b border-white/10 flex-shrink-0">
              <h2 className="text-2xl font-bold text-white">Final Payment</h2>
              <p className="text-sm text-slate-300 mt-1">Complete the remaining balance</p>
            </div>

            <form onSubmit={handleSubmitFinalPayment} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="glass-card border border-amber-400/30 rounded-lg p-3">
                <p className="text-sm text-white font-semibold mb-2">
                  Final payment required to complete the job
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-300">Total Cost:</span>
                    <p className="font-bold text-white">${parseFloat(hasEstimate || '0').toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-slate-300">Already Paid:</span>
                    <p className="font-bold text-emerald-300">${parseFloat((ticket as any).initial_payment_amount || '0').toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-300">Remaining Balance:</span>
                    <p className="font-bold text-amber-300 text-lg">${(parseFloat(hasEstimate || '0') / 2).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {adminContactPhone && (
                <div className="glass-card border border-emerald-400/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-white mb-2">Contact Admin for Payment Details</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300 mb-1">Call or WhatsApp:</p>
                      <p className="text-base font-bold text-emerald-300">{adminContactPhone}</p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${adminContactPhone}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone className="w-3 h-3" />
                        Call
                      </a>
                      <a
                        href={`https://wa.me/${adminContactPhone.replace(/[^0-9]/g, '')}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white mb-2">Payment Reference / Transaction ID *</label>
                <input
                  type="text"
                  value={finalPaymentReference}
                  onChange={(e) => setFinalPaymentReference(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-white placeholder-slate-400"
                  placeholder="e.g., Bank transfer ref: TXN987654321"
                  required
                />
                <p className="mt-1 text-xs text-slate-300">
                  After making the final payment, enter your bank transfer reference or receipt number here.
                </p>
              </div>

              <div className="glass-card border border-sky-400/30 rounded-lg p-3">
                <p className="text-xs text-slate-200">
                  <strong>Note:</strong> After submitting, please wait for admin to confirm your final payment. The technician will then be able to mark the job as complete.
                </p>
              </div>
            </form>

            <div className="p-6 border-t border-white/10 flex justify-end space-x-3 flex-shrink-0 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowFinalPaymentModal(false)}
                className="px-6 py-2 border border-white/10 rounded-lg hover:bg-white/10 font-medium transition-colors text-white"
                disabled={submittingPayment}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmitFinalPayment}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={submittingPayment}
              >
                {submittingPayment ? 'Submitting...' : 'Submit Final Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCostEstimate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col border border-white/10">
            <div className="p-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Provide Cost Estimate</h2>
            </div>

            <form onSubmit={handleSubmitCostEstimate} className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-white mb-1.5">Service Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setServiceType('online')}
                      className={`p-2.5 border-2 rounded-lg transition-all ${
                        serviceType === 'online'
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-white/20 hover:border-white/30 bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-sm mb-0.5">Online Support</div>
                      <div className="text-xs text-slate-300">Remote assistance via chat/call</div>
                      <div className="text-xs text-sky-300 mt-1">Full payment upfront</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceType('on_site')}
                      className={`p-2.5 border-2 rounded-lg transition-all ${
                        serviceType === 'on_site'
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-white/20 hover:border-white/30 bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-sm mb-0.5">On-Site Visit</div>
                      <div className="text-xs text-slate-300">Physical visit to location</div>
                      <div className="text-xs text-sky-300 mt-1">50% upfront, 50% on completion</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1.5">Estimated Cost (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/50 text-sm text-white placeholder-slate-400"
                    placeholder="0.00"
                    required
                  />
                  {serviceType === 'on_site' && estimatedCost && (
                    <p className="mt-1.5 text-xs text-slate-300">
                      Initial: <span className="font-semibold">${(parseFloat(estimatedCost) / 2).toFixed(2)}</span>
                      {' • '}
                      Final: <span className="font-semibold">${(parseFloat(estimatedCost) / 2).toFixed(2)}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1.5">Assessment Notes</label>
                  <textarea
                    value={technicianNotes}
                    onChange={(e) => setTechnicianNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/50 h-24 text-sm resize-none text-white placeholder-slate-400"
                    placeholder="Provide details about the issue and recommended solution..."
                  />
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-end space-x-2 flex-shrink-0 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowCostEstimate(false)}
                  className="px-4 py-2 border border-white/10 rounded-lg hover:bg-white/10 font-medium transition-colors text-sm text-white"
                  disabled={submittingEstimate}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  disabled={submittingEstimate || !estimatedCost || parseFloat(estimatedCost) <= 0}
                >
                  {submittingEstimate ? 'Submitting...' : 'Submit Estimate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showServiceRequest && (
        <ServiceRequestModal
          ticketId={ticket.id}
          onClose={() => setShowServiceRequest(false)}
          onSuccess={() => {
            setShowServiceRequest(false);
            loadTicketData();
          }}
        />
      )}

      {profile?.role === 'customer' && (
        <CustomerSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={(newPreferences) => {
            setPreferences(newPreferences);
            loadPreferences();
          }}
          currentPreferences={preferences}
          darkMode={false}
        />
      )}
    </div>
  );
}

function ServiceRequestModal({
  ticketId,
  onClose,
  onSuccess
}: {
  ticketId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [serviceType, setServiceType] = useState<'home_visit' | 'garage_visit'>('home_visit');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('service_requests')
        .insert({
          ticket_id: ticketId,
          customer_id: user!.id,
          service_type: serviceType,
          address,
          notes,
          status: 'requested' as const
        } as any);

      if (insertError) throw insertError;
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create service request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-xl max-w-lg w-full border border-white/10">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">Request On-Site Visit</h2>
          <p className="text-slate-300 mt-1">Schedule a technician to visit your location</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Visit Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setServiceType('home_visit')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  serviceType === 'home_visit'
                    ? 'border-orange-400 bg-orange-500/20 text-white'
                    : 'border-white/20 hover:border-white/30 bg-white/5 text-slate-300'
                }`}
              >
                <MapPin className="w-6 h-6 mx-auto mb-2" />
                <span className="font-medium">Home Visit</span>
              </button>
              <button
                type="button"
                onClick={() => setServiceType('garage_visit')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  serviceType === 'garage_visit'
                    ? 'border-orange-400 bg-orange-500/20 text-white'
                    : 'border-white/20 hover:border-white/30 bg-white/5 text-slate-300'
                }`}
              >
                <MapPin className="w-6 h-6 mx-auto mb-2" />
                <span className="font-medium">Garage Visit</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 h-24 text-white placeholder-slate-400"
              placeholder="Enter the full address..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Additional Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 h-20 text-white placeholder-slate-400"
              placeholder="Any specific instructions or details..."
            />
          </div>

          {error && (
            <div className="glass-card border border-red-400/30 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:bg-slate-500/30 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Requesting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

