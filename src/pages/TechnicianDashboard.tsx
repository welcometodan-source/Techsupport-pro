import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { playNotificationSound, showBrowserNotification } from '../utils/soundNotification';
import { scheduleBackgroundNotification } from '../utils/backgroundNotifications';
import {
  Wrench,
  LogOut,
  Bell,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Activity,
  Zap,
  FileText
} from 'lucide-react';
import { VipBadge } from '../components/VipBadge';
import UnreadBadge from '../components/UnreadBadge';
import type { Database } from '../lib/database.types';

type SupportTicket = Database['public']['Tables']['support_tickets']['Row'] & {
  customer: { full_name: string; vip_tier: string | null };
  unread_by_technician?: number;
};
type ServiceRequest = Database['public']['Tables']['service_requests']['Row'];

export default function TechnicianDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState({
    open: 0,
    in_progress: 0,
    resolved_today: 0,
    total_assigned: 0
  });
  const [hasNewAssignmentAlert, setHasNewAssignmentAlert] = useState(false);
  const [newSubscriptionAssignmentsCount, setNewSubscriptionAssignmentsCount] = useState(0);
  const [lastCheckedAssignmentId, setLastCheckedAssignmentId] = useState<string | null>(null);

  // Initialize background notifications for technicians (critical for screen-off notifications)
  useEffect(() => {
    if (profile?.role === 'technician') {
      // Initialize immediately when technician dashboard loads
      // This MUST be done to enable notifications when screen is off
      const initNotifications = async () => {
        try {
          const module = await import('../utils/backgroundNotifications');
          if (module.initializeBackgroundNotifications) {
            await module.initializeBackgroundNotifications();
            console.log('✅ Technician background notifications initialized successfully');
          }
        } catch (err) {
          console.warn('Technician background notifications not available:', err);
          // Try again after a delay
          setTimeout(async () => {
            try {
              const module = await import('../utils/backgroundNotifications');
              if (module.initializeBackgroundNotifications) {
                await module.initializeBackgroundNotifications();
                console.log('✅ Technician background notifications initialized on retry');
              }
            } catch (retryErr) {
              console.error('Failed to initialize background notifications after retry:', retryErr);
            }
          }, 2000);
        }
      };
      
      initNotifications();
    }
  }, [profile?.role]);

  const subscribeToSubscriptionAssignments = () => {
    if (!profile?.id) return () => {};

    // Load initial assignments to set baseline
    const loadInitialAssignments = async () => {
      const { data } = await supabase
        .from('subscription_assignments')
        .select('id')
        .eq('technician_id', profile.id)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setLastCheckedAssignmentId(data[0].id);
      }
    };

    loadInitialAssignments();

    const channel = supabase
      .channel('technician-subscription-assignments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'subscription_assignments',
          filter: `technician_id=eq.${profile.id}`
        },
        async (payload) => {
          console.log('New subscription assignment detected:', payload);
          
          const newAssignment = payload.new as any;
          
          // Only alert if this is a new assignment (not one we've already seen)
          if (newAssignment.id !== lastCheckedAssignmentId && newAssignment.status === 'active') {
            console.log('🎯 New subscription assignment for technician!');
            
            // Increment count
            setNewSubscriptionAssignmentsCount(prev => prev + 1);
            setHasNewAssignmentAlert(true);
            
            // Get customer details for notification
            const { data: subscription } = await supabase
              .from('customer_subscriptions')
              .select(`
                user:profiles!customer_subscriptions_user_id_fkey(full_name)
              `)
              .eq('id', newAssignment.subscription_id)
              .maybeSingle();
            
            const customerName = (subscription as any)?.user?.full_name || 'Customer';
            const notificationTitle = 'New Job Assigned! 🚗';
            const notificationBody = `You've been assigned to ${customerName}'s subscription. Click to view details.`;
            
            // Play sound notification (works when app is open)
            playNotificationSound().catch(err => {
              console.error('Sound notification error:', err);
              setTimeout(() => {
                playNotificationSound().catch(e => console.error('Retry sound failed:', e));
              }, 300);
            });
            
            // Schedule background notification (works even when screen is off or app is closed)
            scheduleBackgroundNotification(
              notificationTitle,
              notificationBody,
              { subscriptionId: newAssignment.subscription_id, type: 'subscription' },
              true // Play sound
            ).catch(err => console.error('Background notification error:', err));
            
            // Show browser notification if app is in background (web fallback)
            if (document.hidden || !document.hasFocus()) {
              showBrowserNotification(notificationTitle, notificationBody)
                .catch(err => console.error('Browser notification error:', err));
            }
            
            // Update last checked ID
            setLastCheckedAssignmentId(newAssignment.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription assignments subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to subscription assignments');
        }
      });

    return () => {
      console.log('Cleaning up subscription assignments subscription');
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (!profile?.id) return;
    loadData();
    const subscription = subscribeToTicketUpdates();
    const assignmentSubscription = subscribeToSubscriptionAssignments();
    return () => {
      subscription();
      assignmentSubscription();
    };
  }, [filter, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    // Less aggressive refresh - every 5 seconds instead of 2
    // Real-time subscriptions handle immediate updates
    const interval = setInterval(() => {
      console.log('Auto refreshing technician dashboard data');
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [profile?.id, filter]);

  const subscribeToTicketUpdates = () => {
    const channel = supabase
      .channel('technician-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `assigned_technician_id=eq.${profile?.id}`
        },
        (payload) => {
          console.log('Ticket updated in technician dashboard:', payload);

          const previousTechnicianId = (payload.old as { [key: string]: any } | null)?.assigned_technician_id ?? null;
          const newAssignment =
            payload.eventType !== 'DELETE' &&
            payload.new?.assigned_technician_id === profile?.id &&
            previousTechnicianId !== profile?.id;

          if (newAssignment) {
            console.log('🎯 Detected new ticket assignment for technician');
            setHasNewAssignmentAlert(true);
            
            // Get ticket details for better notification
            const ticketId = payload.new?.id;
            const ticketTitle = payload.new?.title || 'Support Ticket';
            
            const notificationTitle = 'New Ticket Assigned! 🎫';
            const notificationBody = `A new support ticket "${ticketTitle}" has been assigned to you. Click to view details.`;
            
            // Play sound notification (works when app is open)
            const playSoundWithRetry = async (attempts = 3) => {
              for (let i = 0; i < attempts; i++) {
                try {
                  await playNotificationSound();
                  console.log('✅ Ticket assignment sound notification played successfully');
                  return;
                } catch (err) {
                  console.warn(`Sound notification attempt ${i + 1} failed:`, err);
                  if (i < attempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                  }
                }
              }
              console.error('❌ All sound notification attempts failed');
            };
            playSoundWithRetry();

            // CRITICAL: Always schedule background notification, even if screen is on
            // This ensures it works when screen goes off
            scheduleBackgroundNotification(
              notificationTitle,
              notificationBody,
              { ticketId, type: 'ticket_assignment' },
              true // Play sound
            )
            .then(() => {
              console.log('✅ Technician ticket assignment background notification scheduled successfully');
            })
            .catch(err => {
              console.error('Background notification error:', err);
              // Retry with delay
              setTimeout(() => {
                scheduleBackgroundNotification(
                  notificationTitle,
                  notificationBody,
                  { ticketId, type: 'ticket_assignment' },
                  true
                )
                .then(() => console.log('✅ Technician ticket assignment background notification retry successful'))
                .catch(e => {
                  console.error('Retry background notification failed:', e);
                  // Final fallback: browser notification
                  showBrowserNotification(notificationTitle, notificationBody)
                    .catch(notifErr => console.error('Browser notification error:', notifErr));
                });
              }, 500);
            });

            // Also show browser notification if app is in background (web fallback)
            if (document.hidden || !document.hasFocus()) {
              showBrowserNotification(notificationTitle, notificationBody)
                .catch(err => console.error('Browser notification error:', err));
            }
          }

          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages'
        },
        async (payload) => {
          console.log('🔔 New message in technician dashboard:', payload);
          
          // Check if message is for one of technician's assigned tickets
          const { data: ticket } = await supabase
            .from('support_tickets')
            .select('assigned_technician_id')
            .eq('id', payload.new.ticket_id)
            .maybeSingle();
          
          if (ticket && ticket.assigned_technician_id === profile?.id) {
            // Check if message is from someone else
            if (payload.new.sender_id !== profile?.id) {
            // Get sender details
            const { data: sender } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', payload.new.sender_id)
              .maybeSingle();
            
            const senderName = sender?.full_name || 'Customer';
            const notificationTitle = 'New Message 💬';
            const notificationBody = `${senderName} sent you a message`;
            
            // Play sound notification (works when app is open)
            playNotificationSound().catch(err => {
              console.error('Sound notification error:', err);
              setTimeout(() => {
                playNotificationSound().catch(e => console.error('Retry sound failed:', e));
              }, 300);
            });
            
            // Schedule background notification (works even when screen is off or app is closed)
            // CRITICAL: Always schedule, even if screen is on - this ensures it works when screen goes off
            scheduleBackgroundNotification(
              notificationTitle,
              notificationBody,
              { ticketId: payload.new.ticket_id, type: 'ticket_message' },
              true // Play sound
            )
            .then(() => {
              console.log('✅ Technician background notification scheduled successfully');
            })
            .catch(err => {
              console.error('Background notification error:', err);
              // Retry with delay
              setTimeout(() => {
                scheduleBackgroundNotification(
                  notificationTitle,
                  notificationBody,
                  { ticketId: payload.new.ticket_id, type: 'ticket_message' },
                  true
                )
                .then(() => console.log('✅ Technician background notification retry successful'))
                .catch(e => {
                  console.error('Retry background notification failed:', e);
                  // Final fallback: browser notification
                  showBrowserNotification(notificationTitle, notificationBody)
                    .catch(notifErr => console.error('Browser notification error:', notifErr));
                });
              }, 500);
            });
            
            // Also show browser notification if app is in background (web fallback)
            if (document.hidden || !document.hasFocus()) {
              showBrowserNotification(notificationTitle, notificationBody)
                .catch(err => console.error('Browser notification error:', err));
            }
            }
          }
          
          // Refresh data immediately when message arrives
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('Technician dashboard subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to technician updates');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Subscription issue, retrying...', status);
          setTimeout(() => {
            channel.subscribe();
          }, 2000);
        }
      });

    return () => {
      console.log('Cleaning up technician dashboard subscription');
      supabase.removeChannel(channel);
    };
  };

  const loadData = async () => {
    try {
      // Load ALL tickets assigned to this technician (including resolved ones)
      // This ensures "Total Assigned" count is accurate
      const allTicketsQuery = supabase
        .from('support_tickets')
        .select(`
          *,
          customer:profiles!support_tickets_customer_id_fkey(full_name, vip_tier)
        `)
        .eq('assigned_technician_id', profile?.id || '')
        .order('created_at', { ascending: false });

      // Filtered query for display
      let displayQuery = supabase
        .from('support_tickets')
        .select(`
          *,
          customer:profiles!support_tickets_customer_id_fkey(full_name, vip_tier)
        `)
        .eq('assigned_technician_id', profile?.id || '')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        displayQuery = displayQuery.eq('status', filter);
      }

      const [allTicketsRes, ticketsRes, serviceRes, notifRes] = await Promise.all([
        allTicketsQuery,
        displayQuery,
        supabase
          .from('service_requests')
          .select('*')
          .in('status', ['requested', 'approved', 'scheduled'])
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('read', false)
      ]);

      if (ticketsRes.data) {
        setTickets(ticketsRes.data as any);
      }

      // Calculate stats from ALL assigned tickets (not just filtered ones)
      if (allTicketsRes.data) {
        const today = new Date().toDateString();
        setStats({
          open: allTicketsRes.data.filter(t => t.status === 'open').length,
          in_progress: allTicketsRes.data.filter(t => t.status === 'in_progress').length,
          resolved_today: allTicketsRes.data.filter(t =>
            t.status === 'resolved' &&
            t.resolved_at &&
            new Date(t.resolved_at).toDateString() === today
          ).length,
          total_assigned: allTicketsRes.data.length // Count ALL assigned tickets
        });
      }
      if (serviceRes.data) setServiceRequests(serviceRes.data);
      if (notifRes.count !== null) setUnreadCount(notifRes.count);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Clock className="w-2.5 h-2.5" />Open
        </span>;
      case 'in_progress':
        return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Activity className="w-2.5 h-2.5" />Active
        </span>;
      case 'resolved':
        return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-2.5 h-2.5" />Done
        </span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-700 text-slate-400">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">URG</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">HIGH</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">MED</span>;
      case 'low':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">LOW</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-700 text-slate-400">-</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#02122b]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-12 h-12 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-300 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const handleSubscriptionVisitsClick = () => {
    setHasNewAssignmentAlert(false);
    setNewSubscriptionAssignmentsCount(0);
    navigate('/subscription-visits');
  };

  return (
    <div className="min-h-screen bg-[#02122b] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#031735] via-[#020f25] to-[#010814]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.18),transparent_45%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(147,197,253,0.14),transparent_55%)]"></div>
        <img
          src="/1681207234023.jpeg"
          alt="Automotive technology"
          className="w-full h-full object-cover opacity-[0.08] mix-blend-screen"
        />
      </div>

      <nav className="bg-[#050f24]/80 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50 relative shadow-[0_20px_60px_rgba(1,6,15,0.6)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1">
          <div className="flex justify-between items-center h-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                <Wrench className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold text-white hidden sm:inline">AutoSupport</span>
                <span className="text-sm font-bold text-white sm:hidden">Auto</span>
                <p className="text-[9px] uppercase tracking-wider text-blue-200/80">Technician</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="relative p-1 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white transition-all">
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[9px] font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 flex items-center justify-center shadow shadow-rose-900/40">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-lg hidden md:flex">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                  {profile?.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{profile?.full_name}</p>
                  <p className="text-[9px] text-slate-300">Tech</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 relative z-10">
        <div className="mb-2">
          <h1 className="text-lg sm:text-xl font-bold text-white mb-0.5">Technician Control Center</h1>
          <p className="text-slate-300 text-[10px]">Track tickets, assignments, and service activity.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          {[
            { icon: Clock, label: 'Open Tickets', value: stats.open, accent: 'from-blue-500/20 to-blue-500/5', iconColor: 'text-blue-300' },
            { icon: Activity, label: 'In Progress', value: stats.in_progress, accent: 'from-sky-500/20 to-sky-500/5', iconColor: 'text-sky-300' },
            { icon: Zap, label: 'Resolved Today', value: stats.resolved_today, accent: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-300' },
            { icon: TrendingUp, label: 'Total Assigned', value: stats.total_assigned, accent: 'from-cyan-500/20 to-cyan-500/5', iconColor: 'text-cyan-300' }
          ].map((card, idx) => (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-2.5 shadow-[0_20px_50px_rgba(3,12,27,0.6)]`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50"></div>
              <div className="relative flex items-center justify-between mb-1">
                <div className={`p-2 rounded-lg bg-white/10 ${card.iconColor}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-white">{card.value}</span>
              </div>
              <p className="text-[10px] font-semibold text-slate-200 leading-tight">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          {[
            {
              title: 'Subscription Visits',
              description: 'Manage scheduled service commitments',
              icon: CheckCircle,
              gradient: 'from-sky-500/30 via-blue-500/20 to-indigo-500/20',
              action: handleSubscriptionVisitsClick,
              alert: hasNewAssignmentAlert || newSubscriptionAssignmentsCount > 0,
              alertCount: newSubscriptionAssignmentsCount
            },
            {
              title: 'Service History',
              description: 'View ticket & subscription history',
              icon: FileText,
              gradient: 'from-cyan-400/30 via-blue-400/20 to-slate-500/20',
              action: () => navigate('/technician-service-history'),
              alert: false,
              alertCount: 0
            }
          ].map((quick: any, idx) => (
            <button
              key={idx}
              onClick={quick.action}
              className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r ${quick.gradient} p-2.5 text-left shadow-lg shadow-blue-900/30 group transition-all`}
            >
              {quick.alert && (
                <>
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                  </span>
                  <span className="absolute top-1 right-2 px-2 py-0.5 rounded-full bg-rose-500/80 text-[9px] font-semibold text-white shadow shadow-rose-900/40 animate-pulse">
                    {quick.alertCount && quick.alertCount > 0 ? `${quick.alertCount} NEW` : 'NEW'}
                  </span>
                </>
              )}
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-white/10 text-white">
                  <quick.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-white leading-tight flex items-center gap-1">
                    {quick.title}
                  </h3>
                  <p className="text-[10px] text-slate-200 leading-tight">{quick.description}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-2">
          <div className="lg:col-span-2">
            <div className="glass-card border border-white/10 rounded-xl p-3 shadow-[0_25px_60px_rgba(3,8,20,0.65)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">Support Tickets</h2>
                  <p className="text-[10px] text-slate-300">Monitor and action customer issues</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['all', 'open', 'in_progress', 'resolved'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f as any)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        filter === f
                          ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-blue-900/30'
                          : 'bg-white/5 text-slate-200 border border-white/10 hover:border-sky-500/40'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'in_progress' ? 'Active' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {tickets.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs">No tickets found</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">Assignments will appear here automatically.</p>
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                      className="glass-card border border-white/10 rounded-xl p-2.5 hover:border-sky-400/50 hover:bg-white/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                            {ticket.unread_by_technician && ticket.unread_by_technician > 0 && (
                              <UnreadBadge count={ticket.unread_by_technician} />
                            )}
                          </div>
                          <h3 className="font-semibold text-white text-xs mb-0.5 line-clamp-1 group-hover:text-sky-300 transition-colors">
                            {ticket.title}
                          </h3>
                          <p className="text-slate-300 text-[10px] line-clamp-2">{ticket.description}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-300 transition-colors flex-shrink-0" />
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-white/5">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          <span className="font-medium">{ticket.customer.full_name}</span>
                          {ticket.customer.vip_tier && (
                            <VipBadge tier={ticket.customer.vip_tier as 'vip' | 'vvip' | 'gold' | 'diamond' | 'silver' | 'cardoc' | 'autodoc'} size="sm" />
                          )}
                        </div>
                        <span className="text-slate-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="glass-card border border-white/10 rounded-xl p-3 shadow-[0_25px_60px_rgba(3,8,20,0.65)]">
              <h2 className="text-sm font-bold text-white mb-2">Service Requests</h2>

              {serviceRequests.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                  <p className="text-slate-400 text-xs">No pending requests</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">You're all caught up.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {serviceRequests.map((request) => (
                    <div
                      key={request.id}
                      className="glass-card border border-white/10 rounded-lg p-2 bg-white/5 hover:border-sky-400/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <h3 className="font-semibold text-white text-[10px] flex-1 leading-tight">
                          {request.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0 ${
                          request.status === 'requested'
                            ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-400/30'
                            : request.status === 'approved'
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                            : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 mb-0.5 line-clamp-2">{request.address}</p>
                      {request.scheduled_date && (
                        <p className="text-[9px] text-slate-400">
                          {new Date(request.scheduled_date).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
