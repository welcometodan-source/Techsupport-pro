import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { playNotificationSound, showBrowserNotification } from '../utils/soundNotification';
import { scheduleBackgroundNotification } from '../utils/backgroundNotifications';
import {
  Plus,
  Wrench,
  LogOut,
  Bell,
  User,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Upload,
  X,
  Image,
  Video,
  Music,
  FileText,
  History,
  Moon,
  Sun,
  DollarSign,
  Settings,
  Car,
  Zap
} from 'lucide-react';
import type { Database } from '../lib/database.types';
import { VipBadge } from '../components/VipBadge';
import UnreadBadge from '../components/UnreadBadge';
import CustomerSettings from '../components/CustomerSettings';
import SubscriptionPlans from '../components/SubscriptionPlans';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

type SupportTicket = Database['public']['Tables']['support_tickets']['Row'] & {
  unread_by_customer?: number;
};
type SubscriptionTier = Database['public']['Tables']['subscription_tiers']['Row'];
type CustomerSubscription = Database['public']['Tables']['customer_subscriptions']['Row'];

export default function CustomerDashboard() {
  // Updated with navy/sea blue design
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subscription, setSubscription] = useState<(CustomerSubscription & { tier: SubscriptionTier }) | null>(null);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);
  const [showSubscriptionPlans, setShowSubscriptionPlans] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('customerTheme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (!profile?.id) return;
    
    loadData();
    loadPreferences();
    const subscription = subscribeToTicketUpdates();
    const notificationSubscription = subscribeToNotifications();
    
    return () => {
      subscription();
      notificationSubscription();
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    // Less aggressive refresh - every 10 seconds instead of 5
    // Real-time subscriptions handle immediate updates
    const interval = setInterval(() => {
      console.log('Auto refreshing customer dashboard data');
      loadData();
    }, 10000);

    return () => clearInterval(interval);
  }, [profile?.id]);

  const subscribeToNotifications = () => {
    if (!profile?.id) return () => {};
    
    console.log('Setting up customer notifications real-time subscription');
    const channel = supabase
      .channel('customer-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('Notification updated:', payload);
          // Refresh notification count immediately
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .eq('read', false)
            .then(({ count }) => {
              if (count !== null) {
                setUnreadCount(count);
              }
            });
        }
      )
      .subscribe((status) => {
        console.log('Customer notifications subscription status:', status);
      });

    return () => {
      console.log('Cleaning up customer notifications subscription');
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    localStorage.setItem('customerTheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  const subscribeToTicketUpdates = () => {
    console.log('Setting up customer dashboard real-time subscription');
    const channel = supabase
      .channel('customer-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `customer_id=eq.${profile?.id}`
        },
        (payload) => {
          console.log('Ticket updated in customer dashboard:', payload);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=in.(${profile?.id ? `SELECT id FROM support_tickets WHERE customer_id=eq.${profile.id}` : ''})`
        },
        async (payload) => {
          console.log('🔔 New message in customer dashboard:', payload);
          
          // Check if message is for one of customer's tickets
          const { data: ticket } = await supabase
            .from('support_tickets')
            .select('customer_id')
            .eq('id', payload.new.ticket_id)
            .maybeSingle();
          
          if (ticket && ticket.customer_id === profile?.id) {
            // Check if message is from someone else
            if (payload.new.sender_id !== profile?.id) {
              // Get sender details
              const { data: sender } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', payload.new.sender_id)
                .maybeSingle();
              
              const senderName = sender?.full_name || 'Someone';
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
              scheduleBackgroundNotification(
                notificationTitle,
                notificationBody,
                { ticketId: payload.new.ticket_id, type: 'message' },
                true // Play sound
              ).catch(err => console.error('Background notification error:', err));
              
              // Show browser notification if app is in background (web fallback)
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_subscriptions',
          filter: `user_id=eq.${profile?.id}`
        },
        (payload) => {
          console.log('Subscription updated in customer dashboard:', payload);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_visits'
        },
        (payload) => {
          console.log('Visit updated in customer dashboard:', payload);
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('Customer dashboard subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to customer updates');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Subscription issue, retrying...', status);
          setTimeout(() => {
            channel.subscribe();
          }, 2000);
        }
      });

    return () => {
      console.log('Cleaning up customer dashboard subscription');
      supabase.removeChannel(channel);
    };
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

  const loadData = async () => {
    try {
      const [ticketsRes, subRes, notifRes, invoicesRes] = await Promise.all([
        supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('customer_subscriptions')
          .select('*, plan:subscription_plans(*)')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('read', false),
        supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', profile.id)
          .order('created_at', { ascending: false })
      ]);

      if (ticketsRes.data) setTickets(ticketsRes.data);
      if (subRes.data) {
        const subscriptionData = subRes.data as any;
        setSubscription(subscriptionData);
        setHasActiveSubscription(subscriptionData.status === 'active');
      } else {
        setHasActiveSubscription(false);
      }
      if (notifRes.count !== null) setUnreadCount(notifRes.count);
      
      // Debug invoice loading
      if (invoicesRes.error) {
        console.error('Error loading invoices:', invoicesRes.error);
      }
      if (invoicesRes.data) {
        console.log('Loaded invoices:', invoicesRes.data.length, 'invoices for customer:', profile.id);
        setInvoices(invoicesRes.data);
      } else {
        console.log('No invoices found for customer:', profile.id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'in_progress': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'awaiting_payment': return <DollarSign className="w-5 h-5 text-green-500" />;
      case 'resolved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'closed': return <CheckCircle className="w-5 h-5 text-gray-500" />;
      default: return <Ticket className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className={`page-shell theme-surface ${darkMode ? 'theme-alt' : ''} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-12 h-12 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-200 text-sm">{t('customerDashboard.loadingMessage')}</p>
        </div>
      </div>
    );
  }

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

  const getCardStyle = () => {
    if (!preferences) return '';
    switch (preferences.card_style) {
      case 'rounded': return 'rounded-2xl';
      case 'sharp': return 'rounded-none';
      case 'glass': return 'rounded-xl backdrop-blur-md bg-opacity-80';
      default: return 'rounded-lg';
    }
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
      className={`page-shell theme-surface ${darkMode ? 'theme-alt' : ''} ${getFontSize()}`}
      style={getBackgroundStyle()}
    >
      <nav className="bg-white/5 border-b border-white/10 backdrop-blur-2xl shadow-[0_20px_60px_rgba(1,6,15,0.6)]">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-6 py-0.5 sm:py-1">
          <div className="flex justify-between items-center h-9 sm:h-10">
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30">
                <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white hidden sm:inline">AutoSupport</span>
              <span className="text-xs sm:text-sm font-bold text-white sm:hidden">Auto</span>
            </div>
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              <LanguageSwitcher />
              <button
                onClick={() => setShowSettings(true)}
                className="p-0.5 sm:p-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
                title={t('customerDashboard.customizeDashboard')}
              >
                <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-0.5 sm:p-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
                title={darkMode ? t('customerDashboard.switchToLightMode') : t('customerDashboard.switchToDarkMode')}
              >
                {darkMode ? <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Moon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              </button>
              <button className="relative p-0.5 sm:p-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all">
                <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[8px] sm:text-[9px] rounded-full w-3 h-3 sm:w-3.5 sm:h-3.5 flex items-center justify-center font-semibold shadow-lg shadow-orange-900/40">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="flex items-center space-x-1 px-1 sm:px-1.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white backdrop-blur-sm hidden md:flex">
                <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="font-medium text-[9px] sm:text-[10px]">{profile?.full_name}</span>
                {profile?.vip_tier && <VipBadge tier={profile.vip_tier} size="sm" />}
              </div>
              <button
                onClick={signOut}
                className="p-0.5 sm:p-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-rose-400/50 transition-all"
              >
                <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1">
        <div className="mb-1">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1">
              <h1 className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-white'}`}>{t('customerDashboard.dashboard')}</h1>
              {profile?.vip_tier && <VipBadge tier={profile.vip_tier} size="sm" />}
            </div>
            {!hasActiveSubscription && (
              <button
                onClick={() => setShowSubscriptionPlans(true)}
                className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold transition-all shadow-lg flex items-center gap-1 text-[10px] min-h-[28px]"
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">{t('customerDashboard.subscribeNow')}</span>
                <span className="sm:hidden">Subscribe</span>
              </button>
            )}
          </div>
          <p className={`text-[8px] ${darkMode ? 'text-gray-300' : 'text-white/80'}`}>{t('customerDashboard.manageTickets')}</p>
        </div>

        {!hasActiveSubscription && (
          <div className={`rounded-lg border border-dashed p-1 sm:p-1.5 mb-0.5 sm:mb-1 text-center ${
            darkMode ? 'bg-navy-800/50 border-navy-600' : 'bg-navy-800/50 border-navy-600'
          } backdrop-blur-sm`}>
            <Car className={`w-3 h-3 sm:w-4 sm:h-4 mx-auto mb-0.5 ${darkMode ? 'text-navy-400' : 'text-navy-300'}`} />
            <h3 className={`text-[8px] sm:text-[9px] font-bold mb-0.5 ${darkMode ? 'text-white' : 'text-white'}`}>
              {t('customerDashboard.getRegularMaintenance')}
            </h3>
            <p className={`text-[7px] sm:text-[8px] mb-0.5 sm:mb-1 max-w-2xl mx-auto leading-tight ${darkMode ? 'text-gray-300' : 'text-white/90'}`}>
              {t('customerDashboard.subscribeWeekly')}
              <br />
              <span className="font-semibold text-navy-500">{t('customerDashboard.carDocFor1Car')}</span> {t('landing.or')} <span className="font-semibold text-navy-500">{t('customerDashboard.autoDocFor2to3Cars')}</span>
            </p>
            <button
              onClick={() => setShowSubscriptionPlans(true)}
              className="px-2 py-0.5 bg-gradient-to-r from-navy-600 to-navy-800 hover:from-navy-700 hover:to-navy-900 text-white rounded-lg font-semibold transition-all shadow-md inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] min-h-[24px] sm:min-h-[28px]"
            >
              <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">{t('customerDashboard.exploreSubscriptions')}</span>
              <span className="sm:hidden">Explore</span>
            </button>
          </div>
        )}

        {subscription && (subscription as any).plan && (
          <div className="bg-gradient-to-r from-navy-600 to-navy-800 rounded-lg p-1 sm:p-1.5 text-white mb-0.5 sm:mb-1 shadow-lg border border-navy-700">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 flex-wrap">
                  <h2 className="text-[8px] sm:text-[9px] font-bold truncate">{(subscription as any).plan.plan_name}</h2>
                  <span className={`px-0.5 sm:px-1 py-0.5 rounded-full text-[7px] sm:text-[8px] font-semibold shrink-0 ${
                    subscription.status === 'active'
                      ? 'bg-green-500 text-white'
                      : subscription.status === 'cancelled'
                      ? 'bg-red-500 text-white'
                      : subscription.payment_method && !subscription.payment_confirmed
                      ? 'bg-blue-600 text-white'
                      : 'bg-yellow-600 text-white'
                  }`}>
                    {subscription.status === 'pending_payment' && subscription.payment_method && !subscription.payment_confirmed
                      ? 'AWAITING'
                      : subscription.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <p className="text-white/90 text-[7px] sm:text-[8px]">
                  {(subscription as any).plan.visits_per_month} visits/mo • {(subscription as any).vehicle_count} vehicle{(subscription as any).vehicle_count > 1 ? 's' : ''}
                </p>
                {subscription.status === 'pending_payment' && subscription.payment_method && !subscription.payment_confirmed && (
                  <div className="mt-0.5 flex items-start gap-0.5 bg-navy-800/10 rounded p-0.5 border border-white/20">
                    <Clock className="w-1.5 h-1.5 sm:w-2 sm:h-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[7px] sm:text-[8px] font-semibold text-white">Payment Under Review</p>
                      <p className="text-[6px] sm:text-[7px] text-white/80 mt-0.5 leading-tight">
                        Payment submitted. Admin reviewing {subscription.payment_method.replace('_', ' ')} payment.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right ml-1 shrink-0">
                <p className="text-[9px] sm:text-[10px] font-bold">${(subscription as any).plan.price_monthly}</p>
                <p className="text-white/80 text-[7px] sm:text-[8px]">/{(subscription as any).plan.billing_cycle === 'yearly' ? 'yr' : 'mo'}</p>
              </div>
            </div>
            {subscription.end_date && (
              <div className="flex items-center gap-0.5 pt-0.5 border-t border-white/20">
                <Clock className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                <span className="text-[7px] sm:text-[8px] text-white/90">
                  {subscription.status === 'active' ? 'Valid until' : 'Ended'}: {new Date(subscription.end_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}


        <div className="grid grid-cols-2 md:grid-cols-4 gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
          <button
            onClick={() => navigate('/service-history')}
            className="glass-card rounded-lg border border-white/10 p-1.5 sm:p-2 flex flex-col items-start transition-all text-left min-h-[60px] sm:min-h-[70px] hover:border-sky-400/50 hover:shadow-xl backdrop-blur-md"
          >
            <div className="bg-white/10 p-0.5 sm:p-1 rounded-md mb-0.5 sm:mb-1">
              <History className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-semibold text-[9px] sm:text-[10px] mb-0.5 text-white leading-tight">{t('customerDashboard.serviceHistory')}</h3>
              <p className="text-[8px] sm:text-[9px] text-slate-300 leading-tight">{t('customerDashboard.viewAllHistory')}</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/subscription-visits')}
            className="glass-card rounded-lg border border-white/10 p-1.5 sm:p-2 flex flex-col items-start transition-all text-left min-h-[60px] sm:min-h-[70px] hover:border-sky-400/50 hover:shadow-xl backdrop-blur-md"
          >
            <div className="bg-white/10 p-0.5 sm:p-1 rounded-md mb-0.5 sm:mb-1">
              <Car className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-semibold text-[9px] sm:text-[10px] mb-0.5 text-white leading-tight">{t('customerDashboard.viewSubscriptionVisits')}</h3>
              <p className="text-[8px] sm:text-[9px] text-slate-300 leading-tight">Visit reports & history</p>
            </div>
          </button>
          <button
            onClick={() => setShowInvoices(true)}
            className="glass-card rounded-lg border border-white/10 p-1.5 sm:p-2 flex flex-col items-start transition-all text-left min-h-[60px] sm:min-h-[70px] hover:border-sky-400/50 hover:shadow-xl backdrop-blur-md"
          >
            <div className="bg-white/10 p-0.5 sm:p-1 rounded-md mb-0.5 sm:mb-1">
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-semibold text-[9px] sm:text-[10px] mb-0.5 text-white leading-tight">{t('customerDashboard.myInvoices')}</h3>
              <p className="text-[8px] sm:text-[9px] text-slate-300 leading-tight">Payment receipts ({invoices.length})</p>
            </div>
          </button>
          <button
            onClick={() => setShowCreateTicket(true)}
            className="glass-card rounded-lg border border-white/10 p-1.5 sm:p-2 flex flex-col items-start transition-all text-left min-h-[60px] sm:min-h-[70px] hover:border-sky-400/50 hover:shadow-xl backdrop-blur-md"
          >
            <div className="bg-white/10 p-0.5 sm:p-1 rounded-md mb-0.5 sm:mb-1">
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-semibold text-[9px] sm:text-[10px] mb-0.5 text-white leading-tight">New Support Request</h3>
              <p className="text-[8px] sm:text-[9px] text-slate-300 leading-tight">Get help with your vehicle</p>
            </div>
          </button>
        </div>

        <div className="glass-card rounded-lg border border-white/10 p-1 sm:p-1.5 mb-1 sm:mb-1.5 backdrop-blur-md">
          <div className="flex justify-between items-center mb-1 sm:mb-1.5">
            <h2 className="text-[9px] sm:text-[10px] font-semibold text-white">{t('customerDashboard.myTickets')}</h2>
            <button
              onClick={() => setShowCreateTicket(true)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-1.5 sm:px-2 py-0.5 rounded-lg font-medium flex items-center space-x-0.5 sm:space-x-1 transition-all shadow-lg text-[9px] sm:text-[10px] min-h-[24px] sm:min-h-[28px]"
            >
              <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">New Ticket</span>
              <span className="sm:hidden">+</span>
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="text-center py-2 sm:py-3">
              <Ticket className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-0.5 sm:mb-1 text-sky-400/60" />
              <h3 className="text-[9px] sm:text-[10px] font-semibold mb-0.5 text-white">{t('customerDashboard.noTicketsYet')}</h3>
              <p className="text-[8px] sm:text-[9px] mb-1 sm:mb-1.5 text-slate-300">{t('customerDashboard.createFirstTicket')}</p>
              <button
                onClick={() => setShowCreateTicket(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-2 sm:px-2.5 py-0.5 rounded-lg font-medium transition-all shadow-lg text-[9px] sm:text-[10px] min-h-[24px] sm:min-h-[28px]"
              >
                {t('customerDashboard.createTicket')}
              </button>
            </div>
          ) : (
            <div className="space-y-1 sm:space-y-1.5">
              {tickets.map((ticket) => {
                const ticketData = ticket as any;
                const hasEstimateNeedingPayment = ticketData.estimated_cost && !ticketData.payment_made;
                const hasFinalPaymentNeeded = ticketData.final_payment_amount > 0 && !ticketData.final_payment_made;
                const hasUnreadMessages = ticket.unread_by_customer && ticket.unread_by_customer > 0;
                const ticketStatus = ticket.status as string;

                return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  className={`glass-card border rounded-lg p-1 sm:p-1.5 hover:border-sky-400/50 hover:shadow-xl transition-all cursor-pointer relative backdrop-blur-md ${
                    hasEstimateNeedingPayment || hasFinalPaymentNeeded || hasUnreadMessages
                      ? 'border-orange-400/50 bg-orange-500/10 ring-2 ring-orange-500/30'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {(hasEstimateNeedingPayment || hasFinalPaymentNeeded || hasUnreadMessages) && (
                    <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                      {hasEstimateNeedingPayment && (
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[7px] sm:text-[8px] font-bold px-0.5 sm:px-1 py-0.5 rounded-full animate-pulse shadow-lg">
                          💰 NEW ESTIMATE
                        </div>
                      )}
                      {hasFinalPaymentNeeded && (
                        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white text-[7px] sm:text-[8px] font-bold px-0.5 sm:px-1 py-0.5 rounded-full animate-pulse shadow-lg">
                          ✅ FINAL PAYMENT
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-0.5">
                    <div className="flex items-start space-x-0.5 sm:space-x-1 flex-1">
                      <div className="mt-0.5">{getStatusIcon(ticketStatus)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <h3 className={`font-semibold text-[8px] sm:text-[9px] mb-0 truncate ${darkMode ? 'text-white' : 'text-white'}`}>{ticket.title}</h3>
                          {hasUnreadMessages && (
                            <UnreadBadge count={ticket.unread_by_customer!} />
                          )}
                        </div>
                        <p className={`text-[7px] sm:text-[8px] line-clamp-1 ${darkMode ? 'text-gray-300' : 'text-white/90'}`}>{ticket.description}</p>

                        {/* Action notifications */}
                        <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                          {hasEstimateNeedingPayment && (
                            <>
                              <span className="bg-navy-600 text-white text-[7px] sm:text-[8px] font-semibold px-0.5 sm:px-1 py-0.5 rounded-full shadow">
                                💵 ${parseFloat(ticketData.estimated_cost).toFixed(2)}
                              </span>
                              <span className={`text-[7px] sm:text-[8px] font-bold animate-pulse ${darkMode ? 'text-sea-400' : 'text-navy-400'}`}>
                                ⚡ ACTION REQUIRED: Submit Payment
                              </span>
                            </>
                          )}
                          {hasFinalPaymentNeeded && (
                            <>
                              <span className="bg-green-500 text-white text-[7px] sm:text-[8px] font-semibold px-0.5 sm:px-1 py-0.5 rounded-full shadow">
                                💵 Final: ${parseFloat(ticketData.final_payment_amount).toFixed(2)}
                              </span>
                              <span className={`text-[7px] sm:text-[8px] font-bold animate-pulse ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                                ⚡ ACTION REQUIRED: Submit Final Payment
                              </span>
                            </>
                          )}
                          {hasUnreadMessages && !hasEstimateNeedingPayment && !hasFinalPaymentNeeded && (
                            <span className={`text-[7px] sm:text-[8px] font-medium ${darkMode ? 'text-sea-400' : 'text-navy-400'}`}>
                              💬 New messages from technician
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`px-0.5 sm:px-1 py-0.5 rounded-full text-[7px] sm:text-[8px] font-medium border shrink-0 ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 text-[7px] sm:text-[8px]">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-navy-500'} truncate`}>
                      Category: <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-navy-700'}`}>{ticket.category.replace('_', ' ')}</span>
                    </span>
                    <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-navy-500'} hidden sm:inline`}>
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                      <span className={`${darkMode ? 'text-gray-400' : 'text-navy-500'} sm:hidden`}>
                        {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <button className="text-navy-500 hover:text-navy-400 font-medium flex items-center space-x-0.5">
                        <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateTicket && (
        <CreateTicketModal
          onClose={() => setShowCreateTicket(false)}
          onSuccess={() => {
            setShowCreateTicket(false);
            loadData();
          }}
        />
      )}

      {showInvoices && (
        <InvoicesModal
          invoices={invoices}
          onClose={() => setShowInvoices(false)}
          darkMode={darkMode}
        />
      )}

      <CustomerSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(newPreferences) => {
          setPreferences(newPreferences);
          loadPreferences();
        }}
        currentPreferences={preferences}
        darkMode={darkMode}
      />

      {showSubscriptionPlans && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-navy-900 rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto p-3 relative border border-[#1E9BD7]">
            <button
              onClick={() => setShowSubscriptionPlans(false)}
              className="absolute top-3 right-3 text-white/70 hover:text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <SubscriptionPlans
              customerId={profile!.id}
              onSubscribed={(subscriptionId) => {
                setShowSubscriptionPlans(false);
                navigate('/subscription-visits', { state: { showPayment: true } });
              }}
              onClose={() => setShowSubscriptionPlans(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTicketModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('engine');
  const [priority, setPriority] = useState('medium');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState({
    vin: ''
  });
  const [vinError, setVinError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // VIN validation: 17 alphanumeric characters, no special characters (required)
  const validateVIN = (vin: string): string | null => {
    if (!vin) return 'VIN is required';
    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length !== 17) {
      return 'VIN must be exactly 17 characters';
    }
    if (!/^[A-Z0-9]{17}$/.test(cleaned)) {
      return 'VIN must contain only letters and numbers (no special characters)';
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const validTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/x-msvideo',
        'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg',
        'application/pdf'
      ];
      const maxSize = 50 * 1024 * 1024;
      return validTypes.includes(file.type) && file.size <= maxSize;
    });
    setFiles([...files, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (fileType.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (fileType.startsWith('audio/')) return <Music className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  const uploadFiles = async (ticketId: string) => {
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${ticketId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ticket-attachments')
        .getPublicUrl(fileName);

      await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          user_id: user!.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: fileName,
          file_url: publicUrl
        });
    });

    await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate VIN before submitting (required field)
    const vinValidationError = validateVIN(vehicleInfo.vin);
    if (vinValidationError) {
      setVinError(vinValidationError);
      setError('Please fix VIN error: ' + vinValidationError);
      return;
    }
    
    setLoading(true);
    setUploadProgress(0);

    try {
      const { data: ticketData, error: insertError } = await supabase
        .from('support_tickets')
        .insert({
          customer_id: user!.id,
          title,
          description,
          category: category as any,
          priority: priority as any,
          vehicle_brand: vehicleBrand,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
          vehicle_info: vehicleInfo,
          status: 'open' as const
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      if (files.length > 0 && ticketData) {
        setUploadProgress(50);
        await uploadFiles(ticketData.id);
        setUploadProgress(100);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-navy-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1E9BD7]">
        <div className="p-3 border-b border-[#1E9BD7]/30">
          <h2 className="text-base font-bold text-white">{t('customerDashboard.newTicket')}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-3 space-y-2">
          <div>
            <label className="block text-[10px] font-medium text-white mb-1">{t('customerDashboard.ticketTitle')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] text-xs"
              placeholder={t('customerDashboard.briefDescription')}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-white mb-1">{t('customerDashboard.problemDescription')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] h-20 text-xs"
              placeholder={t('customerDashboard.describeProblem')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-white mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] text-xs"
              >
                <option value="engine">Engine</option>
                <option value="transmission">Transmission</option>
                <option value="electrical">Electrical</option>
                <option value="brakes">Brakes</option>
                <option value="suspension">Suspension</option>
                <option value="cooling">Cooling</option>
                <option value="fuel_system">Fuel System</option>
                <option value="exhaust">Exhaust</option>
                <option value="body">Body</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-white mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] text-xs"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="border-t border-[#1E9BD7]/30 pt-2">
            <h3 className="font-medium text-white mb-2 text-xs">{t('customerDashboard.vehicleInfo')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-white mb-1">{t('customerDashboard.vehicleMake')} *</label>
                <input
                  type="text"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] text-xs"
                  placeholder={t('customerDashboard.makeExample')}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-white mb-1">{t('customerDashboard.vehicleModel')} *</label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] text-xs"
                  placeholder={t('customerDashboard.modelExample')}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-white mb-1">{t('customerDashboard.vehicleYear')} *</label>
                <input
                  type="number"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] text-xs"
                  placeholder="2020"
                  min="1900"
                  max="2099"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-medium text-white mb-1">VIN *</label>
                <input
                  type="text"
                  value={vehicleInfo.vin}
                  onChange={(e) => {
                    // Remove special characters and convert to uppercase
                    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    // Limit to 17 characters
                    const limited = cleaned.slice(0, 17);
                    setVehicleInfo({ ...vehicleInfo, vin: limited });
                    
                    // Validate VIN
                    const error = validateVIN(limited);
                    setVinError(error || '');
                  }}
                  maxLength={17}
                  required
                  className={`w-full px-2 py-1.5 border ${
                    vinError 
                      ? 'border-red-500/60 bg-red-900/20' 
                      : 'border-[#1E9BD7]/40 bg-navy-800'
                  } text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E9BD7] text-xs uppercase`}
                  placeholder="1HGBH41JXMN109186"
                />
                {vinError && (
                  <p className="text-[9px] text-red-400 mt-0.5">{vinError}</p>
                )}
                {vehicleInfo.vin && !vinError && vehicleInfo.vin.length === 17 && (
                  <p className="text-[9px] text-green-400 mt-0.5">✓ Valid VIN</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-[#1E9BD7]/30 pt-2">
            <h3 className="font-medium text-white mb-2 text-xs">Attachments (Optional)</h3>
            <p className="text-[10px] text-white/80 mb-2">
              Upload images, videos, audio recordings, or diagnostic reports (PDF). Max 50MB per file.
            </p>

            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-[#1E9BD7]/40 border-dashed rounded-lg cursor-pointer hover:border-[#1E9BD7] hover:bg-[#1E9BD7]/10 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-6 h-6 text-[#1E9BD7] mb-1" />
                <p className="text-[10px] text-white/80">
                  <span className="font-semibold text-[#1E9BD7]">Click to upload</span> or drag and drop
                </p>
                <p className="text-[9px] text-white/60 mt-0.5">
                  Images, Videos, Audio, PDF (Max 50MB each)
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                multiple
                accept="image/*,video/*,audio/*,application/pdf"
                onChange={handleFileSelect}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-medium text-white">Selected Files ({files.length})</p>
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-navy-800 border border-[#1E9BD7]/40 rounded-lg p-2"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="text-[#1E9BD7]">
                        {getFileIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white truncate">{file.name}</p>
                        <p className="text-[9px] text-white/70">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-white mb-1">
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-navy-800 rounded-full h-1.5">
                  <div
                    className="bg-[#1E9BD7] h-1.5 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-white px-3 py-2 rounded-lg text-[10px]">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-[#1E9BD7]/40 rounded-lg text-white hover:bg-navy-800 transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-[#1E9BD7] hover:bg-[#1B8CC4] disabled:bg-[#1E9BD7]/50 text-white rounded-lg font-medium transition-colors text-xs"
            >
              {loading ? t('customerDashboard.creating') : t('customerDashboard.createTicket')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoicesModal({
  invoices,
  onClose,
  darkMode
}: {
  invoices: any[];
  onClose: () => void;
  darkMode: boolean;
}) {
  const { t } = useLanguage();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className={`rounded-xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col ${
        darkMode ? 'bg-[#02122b] border border-white/10' : 'bg-navy-800'
      }`}>
        <div className={`p-3 sm:p-4 md:p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex-1 min-w-0">
            <h2 className={`text-base sm:text-lg md:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {selectedInvoice ? t('customerDashboard.invoiceDetails') : t('customerDashboard.myInvoices')}
            </h2>
            <p className={`text-[10px] sm:text-xs md:text-sm mt-0.5 sm:mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {selectedInvoice ? `Invoice ${selectedInvoice.invoice_number}` : 'View and download your payment receipts'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {selectedInvoice && (
              <button
                onClick={() => setSelectedInvoice(null)}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg font-medium transition-colors text-[10px] sm:text-xs md:text-sm ${
                  darkMode ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">Back to List</span>
                <span className="sm:hidden">Back</span>
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className={`w-16 h-16 mx-auto mb-4 ${
                darkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-lg font-semibold mb-2 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                No Invoices Yet
              </h3>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                Your payment invoices will appear here after payments are confirmed
              </p>
            </div>
          ) : selectedInvoice ? (
            <div className={`${darkMode ? 'bg-[#02122b]/50' : 'bg-navy-800'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl p-3 sm:p-4 md:p-6 lg:p-8`}>
              {/* Company Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-4 sm:gap-0 mb-4 sm:mb-6 md:mb-8 pb-4 sm:pb-6 border-b border-white/10">
                <div className="flex-1 min-w-0">
                  <h1 className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedInvoice.company_name || 'AutoSupport Pro'}
                  </h1>
                  <p className={`text-[10px] sm:text-xs md:text-sm mt-1 sm:mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {selectedInvoice.company_address || '123 Auto Street, Car City, AC 12345'}
                  </p>
                  <p className={`text-[10px] sm:text-xs md:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {selectedInvoice.company_phone || '+1 (555) 123-4567'}
                  </p>
                  <p className={`text-[10px] sm:text-xs md:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {selectedInvoice.company_email || 'support@autosupportpro.com'}
                  </p>
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <h2 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                    INVOICE
                  </h2>
                  <p className={`text-sm sm:text-base md:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedInvoice.invoice_number}
                  </p>
                  <span className={`inline-block mt-1 sm:mt-2 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs md:text-sm font-bold ${
                    selectedInvoice.status === 'paid'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {selectedInvoice.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Bill To & Invoice Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-4 sm:mb-6 md:mb-8">
                <div>
                  <h3 className={`text-[10px] sm:text-xs md:text-sm font-bold mb-1 sm:mb-2 uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Bill To:
                  </h3>
                  <p className={`font-semibold text-xs sm:text-sm md:text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedInvoice.customer_name}
                  </p>
                  {selectedInvoice.customer_phone && (
                    <p className={`text-[10px] sm:text-xs md:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedInvoice.customer_phone}
                    </p>
                  )}
                  {selectedInvoice.customer_address && (
                    <p className={`text-[10px] sm:text-xs md:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedInvoice.customer_address}
                    </p>
                  )}
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs md:text-sm">
                    <span className={`font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Invoice Date:</span>
                    <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                      {new Date(selectedInvoice.issue_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    {selectedInvoice.payment_date && (
                      <>
                        <span className={`font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Payment Date:</span>
                        <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                          {new Date(selectedInvoice.payment_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </>
                    )}
                    <span className={`font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Payment Ref:</span>
                    <span className={`font-mono ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInvoice.payment_reference || 'N/A'}
                    </span>
                    {selectedInvoice.technician_name && (
                      <>
                        <span className={`font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Technician:</span>
                        <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                          {selectedInvoice.technician_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle Info */}
              {selectedInvoice.vehicle_info && (
                <div className={`mb-3 sm:mb-4 md:mb-6 p-2 sm:p-3 md:p-4 rounded-lg ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50'}`}>
                  <h3 className={`text-[10px] sm:text-xs md:text-sm font-bold mb-1 sm:mb-2 uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Vehicle Information:
                  </h3>
                  <p className={`font-semibold text-xs sm:text-sm md:text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedInvoice.vehicle_info.brand} {selectedInvoice.vehicle_info.model} ({selectedInvoice.vehicle_info.year})
                  </p>
                </div>
              )}

              {/* Service Details */}
              <div className="mb-4 sm:mb-6 md:mb-8 overflow-x-auto">
                <h3 className={`text-[10px] sm:text-xs md:text-sm font-bold mb-2 sm:mb-3 uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Service Description:
                </h3>
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className={`border-b-2 ${darkMode ? 'border-white/10' : 'border-gray-300'}`}>
                      <th className={`text-left py-1.5 sm:py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'} text-[9px] sm:text-xs md:text-sm font-bold uppercase`}>Description</th>
                      <th className={`text-right py-1.5 sm:py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'} text-[9px] sm:text-xs md:text-sm font-bold uppercase`}>Type</th>
                      <th className={`text-right py-1.5 sm:py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'} text-[9px] sm:text-xs md:text-sm font-bold uppercase`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={`border-b ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
                      <td className={`py-2 sm:py-3 text-xs sm:text-sm md:text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedInvoice.service_details || 'Automotive Service'}
                      </td>
                      <td className={`py-2 sm:py-3 text-right text-[10px] sm:text-xs md:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {selectedInvoice.payment_type === 'initial' && 'Initial Payment (50%)'}
                        {selectedInvoice.payment_type === 'final' && 'Final Payment (50%)'}
                        {selectedInvoice.payment_type === 'full' && 'Full Payment'}
                      </td>
                      <td className={`py-2 sm:py-3 text-right font-semibold text-xs sm:text-sm md:text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        ${parseFloat(selectedInvoice.subtotal || selectedInvoice.amount).toFixed(2)}
                      </td>
                    </tr>
                    {(selectedInvoice.labor_hours > 0 || selectedInvoice.parts_cost > 0) && (
                      <>
                        {selectedInvoice.labor_hours > 0 && (
                          <tr className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <td className={`py-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Labor ({selectedInvoice.labor_hours} hours @ ${parseFloat(selectedInvoice.labor_rate).toFixed(2)}/hr)
                            </td>
                            <td className={`py-3 text-right ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Labor</td>
                            <td className={`py-3 text-right ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              ${(parseFloat(selectedInvoice.labor_hours) * parseFloat(selectedInvoice.labor_rate)).toFixed(2)}
                            </td>
                          </tr>
                        )}
                        {selectedInvoice.parts_cost > 0 && (
                          <tr className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <td className={`py-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Parts & Materials</td>
                            <td className={`py-3 text-right ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Parts</td>
                            <td className={`py-3 text-right ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              ${parseFloat(selectedInvoice.parts_cost).toFixed(2)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end mb-4 sm:mb-6 md:mb-8">
                <div className="w-full sm:w-64 md:w-80">
                  <div className={`flex justify-between py-1.5 sm:py-2 text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <span>Subtotal:</span>
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${parseFloat(selectedInvoice.subtotal || selectedInvoice.amount).toFixed(2)}
                    </span>
                  </div>
                  {selectedInvoice.discount_amount > 0 && (
                    <div className="flex justify-between py-1.5 sm:py-2 text-xs sm:text-sm text-green-400">
                      <span>Discount {selectedInvoice.discount_reason && `(${selectedInvoice.discount_reason})`}:</span>
                      <span className="font-semibold">
                        -${parseFloat(selectedInvoice.discount_amount).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {selectedInvoice.tax_amount > 0 && (
                    <div className={`flex justify-between py-1.5 sm:py-2 text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span>Tax ({selectedInvoice.tax_rate}%):</span>
                      <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        ${parseFloat(selectedInvoice.tax_amount).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className={`flex justify-between py-2 sm:py-3 border-t-2 ${darkMode ? 'border-white/10' : 'border-gray-300'} text-base sm:text-lg md:text-xl font-bold`}>
                    <span className={darkMode ? 'text-white' : 'text-gray-900'}>Total:</span>
                    <span className="text-green-400">
                      ${parseFloat(selectedInvoice.amount).toFixed(2)} {selectedInvoice.currency || 'USD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'} border`}>
                  <h3 className={`text-sm font-bold mb-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Notes:</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {selectedInvoice.notes}
                  </p>
                </div>
              )}

              {/* Terms */}
              {selectedInvoice.terms_and_conditions && (
                <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} pt-4`}>
                  <p className="font-semibold mb-1">Terms & Conditions:</p>
                  <p>{selectedInvoice.terms_and_conditions}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={`rounded-lg border p-5 cursor-pointer transition-all hover:shadow-lg ${
                    darkMode
                      ? 'bg-gray-900 border-gray-700 hover:border-orange-500'
                      : 'bg-gray-50 border-gray-200 hover:border-orange-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className={`text-lg font-bold ${
                        darkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {invoice.invoice_number}
                      </h3>
                      <p className={`text-sm ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {new Date(invoice.issue_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        ${parseFloat(invoice.amount).toFixed(2)}
                      </p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoice.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className={`border-t pt-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {invoice.service_details || 'Automotive Service'}
                      </p>
                      <span className="text-orange-500 font-medium text-sm">
                        View Details →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`p-3 sm:p-4 md:p-6 border-t border-white/10 ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 sm:px-6 sm:py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
