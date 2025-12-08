import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { playNotificationSound, showBrowserNotification } from '../utils/soundNotification';
import { scheduleBackgroundNotification } from '../utils/backgroundNotifications';
import {
  Wrench,
  LogOut,
  Users,
  DollarSign,
  Activity,
  Settings,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Ban,
  Trash2,
  BarChart3,
  Award,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../lib/database.types';
import { VipBadge } from '../components/VipBadge';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type SupportTicket = Database['public']['Tables']['support_tickets']['Row'] & {
  customer?: Profile;
  assigned_technician?: Profile;
};

type TechnicianStats = {
  technician_id: string;
  technician_name: string;
  total_resolved: number;
  avg_resolution_minutes: number;
};

export default function AdminDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [pendingTechnicians, setPendingTechnicians] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [resolvedTickets, setResolvedTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState({
    total_customers: 0,
    total_technicians: 0,
    active_tickets: 0,
    total_revenue: 0,
    pending_technicians: 0
  });
  const [loading, setLoading] = useState(true);
  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [reviewingTechnicianId, setReviewingTechnicianId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingPayments, setPendingPayments] = useState<SupportTicket[]>([]);
  const [pendingFinalPayments, setPendingFinalPayments] = useState<SupportTicket[]>([]);
  const [pendingSubscriptionPayments, setPendingSubscriptionPayments] = useState<any[]>([]);
  const [editingVipCustomerId, setEditingVipCustomerId] = useState<string | null>(null);
  const [selectedVipTier, setSelectedVipTier] = useState<'vip' | 'vvip' | 'gold' | 'diamond' | 'silver' | 'cardoc' | 'autodoc' | null>(null);
  const [confirmingSubscriptionId, setConfirmingSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    // Initialize audio context for notifications (unlock on dashboard load)
    const initAudio = async () => {
      try {
        // Try to unlock audio context immediately by creating and resuming it
        if (typeof (window as any).AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
          const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContext();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          // Create a silent sound to unlock audio (required by browsers)
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          gainNode.gain.value = 0; // Silent
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscillator.start(0);
          oscillator.stop(0.001);
          console.log('✅ Admin dashboard audio context initialized and unlocked');
        }
      } catch (e) {
        console.warn('Could not initialize audio context:', e);
      }
    };
    initAudio();

    // Subscribe to payment changes for real-time updates
    const paymentsChannel = supabase
      .channel('admin-payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    // Subscribe to ticket changes for pending payments and new tickets
    const ticketsChannel = supabase
      .channel('admin-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_tickets'
        },
        async (payload) => {
          console.log('🔔 New ticket created:', payload);
          
          // Get customer name
          const { data: customer } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.customer_id)
            .maybeSingle();
          
          const customerName = customer?.full_name || 'Customer';
          const notificationTitle = 'New Ticket Created! 🎫';
          const notificationBody = `${customerName} created a new support ticket. Click to assign a technician.`;
          
          // Play sound notification (works when app is open)
          // Try multiple times with delays to ensure it plays
          const playSoundWithRetry = async (attempts = 3) => {
            for (let i = 0; i < attempts; i++) {
              try {
                await playNotificationSound();
                console.log('✅ Sound notification played successfully');
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
          
          // Schedule background notification (works even when screen is off or app is closed)
          scheduleBackgroundNotification(
            notificationTitle,
            notificationBody,
            { ticketId: payload.new.id, type: 'ticket' },
            true // Play sound
          ).catch(err => console.error('Background notification error:', err));
          
          // Show browser notification if app is in background (web fallback)
          if (document.hidden || !document.hasFocus()) {
            showBrowserNotification(notificationTitle, notificationBody)
              .catch(err => console.error('Browser notification error:', err));
          }
          
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets'
        },
        async (payload) => {
          const oldPaymentMade = (payload.old as any)?.payment_made;
          const newPaymentMade = payload.new?.payment_made;
          const newPaymentConfirmed = payload.new?.payment_confirmed;
          
          // Check if payment was just submitted (payment_made changed from false to true)
          if (!oldPaymentMade && newPaymentMade && !newPaymentConfirmed) {
            console.log('💰 Payment submitted - needs admin confirmation:', payload);
            
            // Get ticket details
            const { data: ticket } = await supabase
              .from('support_tickets')
              .select(`
                customer:profiles!support_tickets_customer_id_fkey(full_name),
                payment_amount
              `)
              .eq('id', payload.new.id)
              .maybeSingle();
            
            const customerName = (ticket as any)?.customer?.full_name || 'Customer';
            const amount = payload.new?.payment_amount || (ticket as any)?.payment_amount || 0;
            const notificationTitle = 'Payment Submitted! 💰';
            const notificationBody = `${customerName} submitted payment of $${parseFloat(amount).toFixed(2)}. Click to confirm.`;
            
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
              { ticketId: payload.new.id, type: 'payment' },
              true // Play sound
            ).catch(err => console.error('Background notification error:', err));
            
            // Show browser notification if app is in background (web fallback)
            if (document.hidden || !document.hasFocus()) {
              showBrowserNotification(notificationTitle, notificationBody)
                .catch(err => console.error('Browser notification error:', err));
            }
          }
          
          loadData();
        }
      )
      .subscribe();

    // Subscribe to subscription payment changes
    const subscriptionsChannel = supabase
      .channel('admin-subscriptions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_subscriptions'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    // Subscribe to new messages for admin notifications
    // ONLY notify admin for admin-related messages (payment, admin mentions, etc.)
    // NOT for regular technician-customer chat
    const messagesChannel = supabase
      .channel('admin-messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages'
        },
        async (payload) => {
          console.log('🔔 New message in admin dashboard:', payload);
          
          // Check if message is from someone else (not admin)
          if (payload.new.sender_id !== user?.id) {
            // Get sender and ticket details (including participants)
            const [senderRes, ticketRes] = await Promise.all([
              supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', payload.new.sender_id)
                .maybeSingle(),
              supabase
                .from('support_tickets')
                .select('status, payment_made, payment_confirmed, final_payment_made, estimated_cost, final_payment_amount, customer_id, assigned_technician_id')
                .eq('id', payload.new.ticket_id)
                .maybeSingle()
            ]);
            
            const sender = senderRes.data;
            const ticket = ticketRes.data;
            const messageText = (payload.new.message || '').toLowerCase();
            
            // Check if this is a regular technician-customer chat (should NOT notify admin)
            const isTechnicianCustomerChat = 
              ticket &&
              ((sender?.role === 'technician' && payload.new.sender_id === ticket.assigned_technician_id) ||
               (sender?.role === 'customer' && payload.new.sender_id === ticket.customer_id));
            
            // Determine if this is an admin-related message (STRICT filtering)
            const isAdminRelated = 
              // Message is FROM admin
              sender?.role === 'admin' ||
              // Message explicitly mentions admin or manager (not just "payment")
              messageText.includes('@admin') ||
              messageText.includes('admin please') ||
              messageText.includes('manager') ||
              messageText.includes('contact admin') ||
              // Payment confirmation messages (specific keywords)
              (messageText.includes('payment') && (
                messageText.includes('confirm') ||
                messageText.includes('submitted') ||
                messageText.includes('receipt') ||
                messageText.includes('transaction')
              )) ||
              // Ticket has payment pending confirmation (admin action needed)
              (ticket && (
                ticket.status === 'awaiting_payment' ||
                (ticket.payment_made && !ticket.payment_confirmed) ||
                (ticket.final_payment_amount > 0 && !ticket.final_payment_made)
              ));
            
            // Only notify admin for admin-related messages AND NOT for regular technician-customer chat
            if (isAdminRelated && !isTechnicianCustomerChat) {
              const senderName = sender?.full_name || 'User';
              const senderRole = sender?.role === 'customer' ? 'Customer' : sender?.role === 'technician' ? 'Technician' : 'User';
              const notificationTitle = 'Admin Action Required ⚠️';
              const notificationBody = `${senderName} (${senderRole}): ${(payload.new.message || '').substring(0, 50)}...`;
              
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
                { ticketId: payload.new.ticket_id, type: 'admin_message' },
                true // Play sound
              ).catch(err => console.error('Background notification error:', err));
              
              // Show browser notification if app is in background (web fallback)
              if (document.hidden || !document.hasFocus()) {
                showBrowserNotification(notificationTitle, notificationBody)
                  .catch(err => console.error('Browser notification error:', err));
              }
            } else {
              // Regular technician-customer chat - don't notify admin
              console.log('Regular chat message (technician-customer), skipping admin notification');
            }
          }
          
          loadData();
        }
      )
      .subscribe();
    
    // Subscribe to ticket assignment updates (to notify technicians)
    const ticketAssignmentsChannel = supabase
      .channel('admin-ticket-assignments')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          // This will trigger technician notification via their subscription
          console.log('Ticket assignment updated:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(subscriptionsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(ticketAssignmentsChannel);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Less aggressive refresh - every 5 seconds instead of 2
    // Real-time subscriptions handle immediate updates
    const interval = setInterval(() => {
      console.log('Auto refreshing admin dashboard data');
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  const loadData = async () => {
    try {
      const [profilesRes, ticketsRes, ticketsCountRes, paymentsRes, subscriptionsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('support_tickets')
          .select(`
            *,
            customer:profiles!support_tickets_customer_id_fkey(id, full_name, phone),
            assigned_technician:profiles!support_tickets_assigned_technician_id_fkey(id, full_name, phone)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('payments').select('amount', { count: 'exact', head: false }).eq('payment_status', 'completed'),
        supabase.from('customer_subscriptions')
          .select(`
            *,
            customer:profiles!customer_subscriptions_user_id_fkey(id, full_name, email, phone),
            subscription_plan:subscription_plans(plan_name, price_monthly)
          `)
          .eq('payment_confirmed', false)
          .not('payment_method', 'is', null)
          .order('created_at', { ascending: false })
      ]);

      if (profilesRes.data) {
        const techs = profilesRes.data.filter(p => p.role === 'technician' && (p as any).technician_status === 'approved');
        const pending = profilesRes.data.filter(p => p.role === 'technician' && (p as any).technician_status === 'pending');
        const custs = profilesRes.data.filter(p => p.role === 'customer');
        setTechnicians(techs);
        setPendingTechnicians(pending);
        setCustomers(custs);

        setStats(prev => ({
          ...prev,
          total_customers: custs.length,
          total_technicians: techs.length,
          pending_technicians: pending.length
        }));
      }

      if (ticketsRes.data) {
        const allTickets = ticketsRes.data as SupportTicket[];

        // Filter out resolved and closed tickets for the active tickets view
        const activeTickets = allTickets.filter(
          t => t.status !== 'resolved' && t.status !== 'closed'
        );
        setTickets(activeTickets);

        // Get resolved tickets for history
        const resolved = allTickets.filter(
          t => t.status === 'resolved' || t.status === 'closed'
        );
        setResolvedTickets(resolved);

        const paymentsNeedingConfirmation = allTickets.filter(
          t => (t as any).payment_made === true && (t as any).payment_confirmed === false
        );
        setPendingPayments(paymentsNeedingConfirmation);

        const finalPaymentsNeedingConfirmation = allTickets.filter(
          t => (t as any).final_payment_made === true && (t as any).final_payment_confirmed === false
        );
        setPendingFinalPayments(finalPaymentsNeedingConfirmation);
      }

      if (ticketsCountRes.count !== null) {
        setStats(prev => ({ ...prev, active_tickets: ticketsCountRes.count! }));
      }

      if (paymentsRes.data) {
        const revenue = paymentsRes.data.reduce((sum, p) => sum + Number(p.amount), 0);
        setStats(prev => ({ ...prev, total_revenue: revenue }));
      }

      if (subscriptionsRes.data) {
        setPendingSubscriptionPayments(subscriptionsRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'customer' | 'technician' | 'admin') => {
    try {
      const updates: any = { role: newRole };

      if (newRole === 'technician') {
        updates.technician_status = 'approved';
        updates.technician_application_date = new Date().toISOString();
        updates.technician_approved_by = profile?.id;
        updates.technician_approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update user role. Please try again.');
    }
  };

  const confirmPayment = async (ticketId: string) => {
    if (!confirm('Confirm that payment has been received?')) return;

    try {
      // Get full ticket details
      const { data: ticket } = await supabase
        .from('support_tickets')
        .select(`
          *,
          customer:profiles!support_tickets_customer_id_fkey(id, full_name, email)
        `)
        .eq('id', ticketId)
        .single();

      if (!ticket) throw new Error('Ticket not found');

      // Update ticket with payment confirmation
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({
          payment_confirmed: true,
          payment_confirmed_at: new Date().toISOString(),
          payment_confirmed_by: user?.id,
          work_authorized: true
        } as any)
        .eq('id', ticketId);

      if (ticketError) throw ticketError;

      // Determine payment type
      const isOnSite = (ticket as any).service_type === 'on_site';
      const paymentType = isOnSite ? 'initial' : 'full';
      const paymentRecordType = isOnSite ? 'partial_initial' : 'full';

      // Create payment record in payments table
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          customer_id: (ticket as any).customer_id,
          ticket_id: ticketId,
          amount: (ticket as any).payment_amount,
          currency: 'USD',
          payment_method: 'bank_transfer',
          payment_status: 'completed',
          payment_type: paymentRecordType
        } as any);

      if (paymentError) throw paymentError;

      // Generate invoice number with graceful fallback
      console.log('Generating invoice number...');
      let invoiceNumber = `INV-${Date.now()}`;
      try {
        const { data: invoiceNumberData, error: rpcError } = await supabase.rpc('generate_invoice_number');
        if (rpcError) {
          console.error('Error generating invoice number via RPC, falling back to timestamp:', rpcError);
        } else if (invoiceNumberData) {
          invoiceNumber = invoiceNumberData;
        }
      } catch (rpcError: any) {
        console.error('Unexpected error generating invoice number, using fallback:', rpcError);
      }
      console.log('Invoice number ready:', invoiceNumber);

      // Create invoice
      console.log('Creating invoice for ticket:', ticketId);
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: (ticket as any).customer_id,
          ticket_id: ticketId,
          payment_type: paymentType,
          amount: (ticket as any).payment_amount,
          currency: 'USD',
          issue_date: new Date().toISOString(),
          payment_date: new Date().toISOString(),
          status: 'paid',
          payment_reference: (ticket as any).payment_reference,
          vehicle_info: {
            brand: (ticket as any).vehicle_brand,
            model: (ticket as any).vehicle_model,
            year: (ticket as any).vehicle_year
          },
          service_details: `${ticket.title} - ${ticket.description}`,
          notes: isOnSite
            ? `Initial payment (50%) for on-site service. Remaining balance due upon completion.`
            : 'Full payment for online support service.'
        } as any);

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }
      console.log('Invoice created successfully:', invoiceNumber);

      // Add message to ticket with invoice info
      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user!.id,
          message: `Payment confirmed by admin. Work is now authorized.\n\nInvoice Generated: ${invoiceNumber}\nAmount: $${parseFloat((ticket as any).payment_amount).toFixed(2)}\n\nTechnician can begin working on this ticket.`,
          message_type: 'text' as const
        } as any);

      loadData();
      alert(`Payment confirmed! Invoice ${invoiceNumber} generated and sent to customer.`);
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Failed to confirm payment. Please try again.');
    }
  };

  const confirmFinalPayment = async (ticketId: string) => {
    if (!confirm('Confirm that final payment (remaining 50%) has been received?')) return;

    try {
      // Get full ticket details
      const { data: ticket } = await supabase
        .from('support_tickets')
        .select(`
          *,
          customer:profiles!support_tickets_customer_id_fkey(id, full_name, email)
        `)
        .eq('id', ticketId)
        .single();

      if (!ticket) throw new Error('Ticket not found');

      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({
          final_payment_confirmed: true,
          final_payment_confirmed_at: new Date().toISOString(),
          final_payment_confirmed_by: user?.id
        } as any)
        .eq('id', ticketId);

      if (ticketError) throw ticketError;

      const finalPaymentAmount = Number((ticket as any).final_payment_amount || 0);

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          customer_id: (ticket as any).customer_id,
          ticket_id: ticketId,
          amount: finalPaymentAmount,
          currency: 'USD',
          payment_method: 'bank_transfer',
          payment_status: 'completed',
          payment_type: 'partial_final'
        } as any);

      if (paymentError) throw paymentError;

      // Generate invoice number with graceful fallback
      console.log('Generating final payment invoice number...');
      let invoiceNumber = `INV-${Date.now()}`;
      try {
        const { data: invoiceNumberData, error: rpcError } = await supabase.rpc('generate_invoice_number');
        if (rpcError) {
          console.error('Error generating invoice number via RPC, falling back to timestamp:', rpcError);
        } else if (invoiceNumberData) {
          invoiceNumber = invoiceNumberData;
        }
      } catch (rpcError: any) {
        console.error('Unexpected error generating final payment invoice number, using fallback:', rpcError);
      }
      console.log('Final payment invoice number ready:', invoiceNumber);

      // Create invoice for final payment
      console.log('Creating final payment invoice for ticket:', ticketId);
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: (ticket as any).customer_id,
          ticket_id: ticketId,
          payment_type: 'final',
          amount: finalPaymentAmount,
          currency: 'USD',
          issue_date: new Date().toISOString(),
          payment_date: new Date().toISOString(),
          status: 'paid',
          payment_reference: (ticket as any).final_payment_reference,
          vehicle_info: {
            brand: (ticket as any).vehicle_brand,
            model: (ticket as any).vehicle_model,
            year: (ticket as any).vehicle_year
          },
          service_details: `${ticket.title} - ${ticket.description}`,
          notes: `Final payment (50%) for on-site service. Total cost: $${parseFloat((ticket as any).estimated_cost || '0').toFixed(2)}`
        } as any);

      if (invoiceError) {
        console.error('Error creating final payment invoice:', invoiceError);
        throw new Error(`Failed to create final payment invoice: ${invoiceError.message}`);
      }
      console.log('Final payment invoice created successfully:', invoiceNumber);

      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user!.id,
          message: `Final payment confirmed by admin.\n\nInvoice Generated: ${invoiceNumber}\nAmount: $${finalPaymentAmount.toFixed(2)}\n\nTechnician can now mark the job as complete.`,
          message_type: 'text' as const
        } as any);

      loadData();
      alert(`Final payment confirmed! Invoice ${invoiceNumber} generated and sent to customer.`);
    } catch (error) {
      console.error('Error confirming final payment:', error);
      alert('Failed to confirm final payment. Please try again.');
    }
  };

  const confirmSubscriptionPayment = async (subscriptionId: string) => {
    if (!confirm('Confirm that this subscription payment has been received?')) return;

    setConfirmingSubscriptionId(subscriptionId);
    try {
      const { data: subscription, error } = await supabase
        .from('customer_subscriptions')
        .select(`
          *,
          subscription_plan:subscription_plans(plan_name, price_monthly, billing_cycle),
          profile:profiles!customer_subscriptions_user_id_fkey(id, full_name, email, phone)
        `)
        .eq('id', subscriptionId)
        .single();

      if (error) throw error;
      if (!subscription) throw new Error('Subscription not found');

      const { error: updateError } = await supabase
        .from('customer_subscriptions')
        .update({
          payment_confirmed: true,
          status: 'active',
          last_payment_date: new Date().toISOString()
        } as any)
        .eq('id', subscriptionId);

      if (updateError) throw updateError;

      const { data: ticketsNeedingAuth } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('customer_id', subscription.user_id)
        .in('status', ['open', 'in_progress']);

      if (ticketsNeedingAuth && ticketsNeedingAuth.length > 0) {
        await supabase
          .from('support_tickets')
          .update({
            work_authorized: true,
            payment_confirmed: true,
            payment_confirmed_at: new Date().toISOString(),
            payment_confirmed_by: user?.id
          } as any)
          .in(
            'id',
            ticketsNeedingAuth.map((t) => t.id)
          );

        await supabase
          .from('ticket_messages')
          .insert(
            ticketsNeedingAuth.map((ticket) => ({
              ticket_id: ticket.id,
              sender_id: user?.id,
              message: 'Subscription payment confirmed by admin. Technician can now access this ticket.',
              message_type: 'text' as const
            }))
          );
      }

      const planPrice = subscription.subscription_plan?.price_monthly ?? 0;
      if (planPrice > 0) {
        await supabase
          .from('payments')
          .insert({
            customer_id: subscription.user_id,
            subscription_id: subscriptionId,
            amount: planPrice,
            currency: 'USD',
            payment_method: subscription.payment_method ?? 'cash',
            payment_status: 'completed',
            payment_type: 'subscription',
            payment_reference: subscription.payment_reference ?? 'subscription-payment'
          } as any);

        // Get vehicles for invoice
        const { data: vehicles } = await supabase
          .from('customer_vehicle_folders')
          .select('vehicle_make, vehicle_model, vehicle_year')
          .eq('customer_subscription_id', subscriptionId)
          .limit(1);

        // Generate invoice number
        let invoiceNumber = `INV-${Date.now()}`;
        try {
          const { data: invoiceNumberData, error: rpcError } = await supabase.rpc('generate_invoice_number');
          if (rpcError) {
            console.error('Error generating invoice number via RPC, falling back to timestamp:', rpcError);
          } else if (invoiceNumberData) {
            invoiceNumber = invoiceNumberData;
          }
        } catch (rpcError: any) {
          console.error('Unexpected error generating invoice number, using fallback:', rpcError);
        }

        // Create invoice for subscription payment
        const vehicleInfo = vehicles && vehicles.length > 0 ? {
          brand: vehicles[0].vehicle_make,
          model: vehicles[0].vehicle_model,
          year: vehicles[0].vehicle_year
        } : null;

        // Use user_id from subscription as customer_id (this is the actual customer's auth.uid())
        const customerId = subscription.user_id;
        
        if (!customerId) {
          console.error('Error: No user_id found in subscription');
          throw new Error('Cannot create invoice: Customer ID not found');
        }

        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            invoice_number: invoiceNumber,
            customer_id: customerId, // Use user_id from subscription (matches auth.uid())
            subscription_id: subscriptionId,
            ticket_id: null, // Subscription payments don't have tickets
            payment_type: 'subscription',
            amount: planPrice,
            currency: 'USD',
            issue_date: new Date().toISOString(),
            payment_date: new Date().toISOString(),
            status: 'paid',
            payment_reference: subscription.payment_reference || null,
            vehicle_info: vehicleInfo,
            service_details: `Subscription Payment - ${subscription.subscription_plan?.plan_name || 'Subscription Plan'} (${subscription.subscription_plan?.billing_cycle || 'monthly'})`,
            customer_name: (subscription.profile as any)?.full_name,
            customer_phone: (subscription.profile as any)?.phone,
            subtotal: planPrice,
            notes: `Subscription payment confirmed for ${subscription.subscription_plan?.plan_name || 'subscription plan'}. Payment method: ${subscription.payment_method || 'bank_transfer'}.`
          } as any);

        if (invoiceError) {
          console.error('Error creating invoice:', invoiceError);
          console.error('Invoice data:', {
            invoice_number: invoiceNumber,
            customer_id: customerId,
            subscription_id: subscriptionId,
            amount: planPrice
          });
          // Don't throw - invoice creation failure shouldn't block payment confirmation
          alert('Payment confirmed, but invoice creation failed. Please check console for details.');
        } else {
          console.log('Invoice created successfully:', invoiceNumber, 'for customer:', customerId);
        }
      }

      setPendingSubscriptionPayments(prev => prev.filter((sub) => sub.id !== subscriptionId));
      alert('Subscription payment confirmed! Subscription is now active. Invoice has been generated.');
      loadData();
    } catch (error) {
      console.error('Error confirming subscription payment:', error);
      alert('Failed to confirm subscription payment. Please try again.');
    } finally {
      setConfirmingSubscriptionId(null);
    }
  };

  const assignTicket = async (ticketId: string, technicianId: string) => {
    try {
      // Get current ticket to check if it's resolved
      const { data: ticket } = await supabase
        .from('support_tickets')
        .select('status')
        .eq('id', ticketId)
        .maybeSingle();

      const updates: any = {
        assigned_technician_id: technicianId
      };

      // If ticket is resolved/closed, reopen it when reassigning
      if (ticket && (ticket.status === 'resolved' || ticket.status === 'closed')) {
        updates.status = 'in_progress';
        updates.resolved_at = null; // Clear resolved timestamp
        updates.work_authorized = false; // Reset work authorization (admin can authorize separately)
      } else {
        updates.status = 'in_progress';
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;

      // Add system message about assignment/reassignment
      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user?.id,
          message: ticket && (ticket.status === 'resolved' || ticket.status === 'closed')
            ? `Ticket reopened and reassigned to technician by admin.`
            : `Ticket assigned to technician by admin.`,
          message_type: 'text'
        } as any);

      setAssigningTicketId(null);
      loadData();
      alert(ticket && (ticket.status === 'resolved' || ticket.status === 'closed')
        ? 'Ticket reopened and technician assigned successfully!'
        : 'Technician assigned successfully!');
    } catch (error) {
      console.error('Error assigning ticket:', error);
      alert('Failed to assign technician. Please try again.');
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus } as any)
        .eq('id', userId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      console.log('Starting complete deletion for user:', userId);

      // Call the database function to completely delete the user
      const { data, error } = await supabase.rpc('delete_user_completely', {
        target_user_id: userId
      });

      if (error) {
        console.error('User deletion error:', error);
        alert(`Failed to delete user: ${error.message}`);
        return;
      }

      console.log('User deleted completely from database and auth system');
      setShowDeleteConfirm(null);
      loadData();
      alert('Customer and all related data deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error.message || 'Unknown error'}`);
    }
  };

  const approveTechnician = async (technicianId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          technician_status: 'approved',
          technician_approved_by: profile?.id,
          technician_approved_at: new Date().toISOString()
        } as any)
        .eq('id', technicianId);

      if (error) throw error;
      setReviewingTechnicianId(null);
      loadData();
    } catch (error) {
      console.error('Error approving technician:', error);
    }
  };

  const rejectTechnician = async (technicianId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          technician_status: 'rejected',
          rejection_reason: rejectionReason || 'Application rejected'
        } as any)
        .eq('id', technicianId);

      if (error) throw error;
      setReviewingTechnicianId(null);
      setRejectionReason('');
      loadData();
    } catch (error) {
      console.error('Error rejecting technician:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'in_progress': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
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

  const pendingPaymentsTotal = pendingPayments.length + pendingFinalPayments.length + pendingSubscriptionPayments.length;

  const handlePendingTechniciansClick = () => {
    if (stats.pending_technicians > 0) {
      const element = document.getElementById('pending-technicians');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handlePendingPaymentsClick = () => {
    if (pendingPaymentsTotal > 0) {
      const element = pendingSubscriptionPayments.length > 0
        ? document.getElementById('pending-subscription-payments')
        : (pendingPayments.length > 0
          ? document.getElementById('pending-payments')
          : document.getElementById('pending-final-payments'));

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.style.animation = 'none';
        setTimeout(() => {
          element.style.animation = 'pulse-glow 2s ease-in-out 3';
        }, 10);
      }
    } else {
      alert('No pending payments at this time. When customers submit payments, they will appear here for confirmation.');
    }
  };

  const highlightCards = [
    {
      key: 'customers',
      label: 'Customers',
      display: stats.total_customers,
      icon: Users,
      iconColor: 'text-sky-300',
      accent: 'from-sky-500/20 via-sky-500/5 to-transparent'
    },
    {
      key: 'technicians',
      label: 'Technicians',
      display: stats.total_technicians,
      icon: UserCheck,
      iconColor: 'text-emerald-300',
      accent: 'from-emerald-500/20 via-emerald-500/5 to-transparent'
    },
    {
      key: 'pending-techs',
      label: 'Pending Review',
      display: stats.pending_technicians,
      icon: Clock,
      iconColor: 'text-amber-300',
      accent: stats.pending_technicians > 0 ? 'from-amber-500/20 via-amber-500/10 to-transparent' : 'from-white/5 via-white/0 to-transparent',
      onClick: handlePendingTechniciansClick,
      interactive: stats.pending_technicians > 0
    },
    {
      key: 'active-tickets',
      label: 'Active Tickets',
      display: stats.active_tickets,
      icon: Activity,
      iconColor: 'text-blue-300',
      accent: 'from-blue-500/20 via-blue-500/5 to-transparent'
    },
    {
      key: 'pending-payments',
      label: 'Pending Payments',
      display: pendingPaymentsTotal,
      icon: DollarSign,
      iconColor: 'text-amber-200',
      accent: pendingPaymentsTotal > 0 ? 'from-amber-500/20 via-orange-500/10 to-transparent' : 'from-white/5 via-white/0 to-transparent',
      onClick: handlePendingPaymentsClick,
      interactive: pendingPaymentsTotal > 0,
      note: pendingSubscriptionPayments.length > 0
        ? `${pendingSubscriptionPayments.length} subscription${pendingSubscriptionPayments.length > 1 ? 's' : ''}`
        : undefined
    },
    {
      key: 'revenue',
      label: 'Revenue',
      display: `$${stats.total_revenue.toFixed(2)}`,
      icon: DollarSign,
      iconColor: 'text-emerald-300',
      accent: 'from-cyan-500/20 via-emerald-500/10 to-transparent'
    }
  ];

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-12 h-12 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-200 text-sm">Loading admin insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell theme-surface">
      <nav className="bg-[#050f24]/80 border-b border-white/5 backdrop-blur-2xl sticky top-0 z-50 relative shadow-[0_20px_60px_rgba(1,6,15,0.6)]">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-1.5">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-900/40">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-rose-200/80">AutoSupport</p>
                <h1 className="text-white text-lg font-bold">Operations Command</h1>
              </div>
              <span className="px-2 py-0.5 rounded-xl text-[11px] font-semibold text-white bg-gradient-to-r from-rose-500 to-orange-500">
                ADMIN
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-slate-200">
              <button onClick={() => navigate('/admin/management')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-sky-400/50 transition-all">
                <BarChart3 className="w-4 h-4" />
                Management
              </button>
              <button onClick={() => navigate('/admin/customers')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-sky-400/50 transition-all">
                <Users className="w-4 h-4" />
                Customers
              </button>
              <button onClick={() => navigate('/admin/subscriptions')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-sky-400/50 transition-all">
                <Calendar className="w-4 h-4" />
                Subscriptions
              </button>
              <button
                onClick={() => {
                  const historySection = document.getElementById('history-section');
                  if (historySection) {
                    historySection.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    alert('No resolved tickets in history yet.');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-sky-400/50 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                History ({resolvedTickets.length})
              </button>
              <button
                onClick={() => navigate('/admin/settings')}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-slate-200">{profile?.full_name}</span>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-rose-400/50 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-2 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
          {highlightCards.map(card => (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              disabled={!card.onClick}
              className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${card.accent} p-3 text-left shadow-[0_20px_50px_rgba(2,9,27,0.65)] transition-all ${
                card.onClick ? 'hover:border-sky-400/50 cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg bg-white/10 ${card.iconColor}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-white">{card.display}</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                {card.label}
              </p>
              {card.note && (
                <p className="text-[10px] text-amber-200 mt-0.5">{card.note}</p>
              )}
            </button>
          ))}
        </div>

        {pendingSubscriptionPayments.length > 0 && (
          <div
            id="pending-subscription-payments"
            className="bg-gradient-to-br from-orange-900/40 to-red-900/40 backdrop-blur-sm rounded-lg border-2 border-orange-500 p-3 mb-3 shadow-xl shadow-orange-500/20"
            style={{
              boxShadow: '0 0 30px rgba(249, 115, 22, 0.4)'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Pending Subscription Payments</h2>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-[10px] font-medium animate-pulse">
                {pendingSubscriptionPayments.length} awaiting confirmation
              </span>
            </div>

            <div className="space-y-2">
              {pendingSubscriptionPayments.map((subscription) => (
                <div
                  key={subscription.id}
                  className="border-2 border-orange-400 rounded-lg p-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:border-orange-300 transition-all shadow-lg hover:shadow-xl relative"
                  style={{
                    boxShadow: '0 0 20px rgba(249, 115, 22, 0.4), 0 0 40px rgba(249, 115, 22, 0.2)',
                    animation: 'pulse-glow 2s ease-in-out infinite'
                  }}
                >
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full"></div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Customer</p>
                      <p className="text-xs font-semibold text-white">{subscription.customer?.full_name}</p>
                      <p className="text-[10px] text-slate-400">{subscription.customer?.email}</p>
                      {subscription.customer?.phone && (
                        <p className="text-[10px] text-slate-400">{subscription.customer.phone}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Subscription Plan</p>
                      <p className="text-xs font-semibold text-orange-300">{subscription.subscription_plan?.plan_name}</p>
                      <p className="text-[10px] text-green-400 font-semibold">${subscription.subscription_plan?.price_monthly}/month</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Payment Details</p>
                      <p className="text-xs font-medium text-white capitalize">{subscription.payment_method?.replace('_', ' ')}</p>
                      <p className="text-[10px] text-slate-300">Ref: {subscription.payment_reference}</p>
                      {subscription.last_payment_date && (
                        <p className="text-[10px] text-slate-400">{new Date(subscription.last_payment_date).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmSubscriptionPayment(subscription.id)}
                      disabled={confirmingSubscriptionId === subscription.id}
                      className="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      {confirmingSubscriptionId === subscription.id ? (
                        <>
                          <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Confirm Payment
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navigate('/admin/subscriptions')}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-xs font-semibold"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 text-[10px] text-slate-400 bg-slate-800/50 p-1.5 rounded">
              <strong className="text-orange-400">Note:</strong> These subscriptions require payment confirmation before technicians can access customer details and schedule visits.
            </div>
          </div>
        )}

        {pendingPayments.length > 0 && (
          <div
            id="pending-payments"
            className="bg-black/60 backdrop-blur-sm rounded-lg border-2 border-yellow-500 p-3 mb-3 shadow-xl shadow-yellow-500/20"
            style={{
              boxShadow: '0 0 30px rgba(234, 179, 8, 0.3)'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-semibold text-white">Pending Payment Confirmations</h2>
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-[10px] font-medium animate-pulse">
                {pendingPayments.length} awaiting confirmation
              </span>
            </div>

            <div className="space-y-2">
              {pendingPayments.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border-2 border-yellow-400 rounded-lg p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 hover:border-yellow-300 transition-all shadow-lg hover:shadow-xl relative"
                  style={{
                    boxShadow: '0 0 20px rgba(250, 204, 21, 0.4), 0 0 40px rgba(250, 204, 21, 0.2)',
                    animation: 'pulse-glow 2s ease-in-out infinite'
                  }}
                >
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-xs">{ticket.title}</h3>
                        {(ticket as any).estimated_cost && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px] font-semibold">
                            ${parseFloat((ticket as any).estimated_cost).toFixed(0)}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[10px] mb-1.5 line-clamp-2">{ticket.description}</p>

                      <div className="bg-[#0f172a] rounded p-1.5 mb-1.5">
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div>
                            <span className="text-slate-500">Customer:</span>
                            <p className="text-white font-medium">{ticket.customer?.full_name || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Technician:</span>
                            <p className="text-emerald-300 font-medium">
                              {ticket.assigned_technician?.full_name || 'Unassigned'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Amount Paid:</span>
                            <p className="text-yellow-300 font-bold text-xs">
                              ${parseFloat((ticket as any).payment_amount || '0').toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Reference:</span>
                            <p className="text-white font-medium truncate text-[10px]">
                              {(ticket as any).payment_reference || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Service Type:</span>
                            <p className="text-white font-medium text-[10px]">
                              {(ticket as any).service_type === 'on_site' ? '🚗 On-Site' : '💻 Online'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Submitted:</span>
                            <p className="text-slate-300 text-[10px]">
                              {new Date((ticket as any).payment_made_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {(ticket as any).vehicle_brand && (
                        <p className="text-slate-400 text-[10px]">
                          Vehicle: {(ticket as any).vehicle_brand} {(ticket as any).vehicle_model} ({(ticket as any).vehicle_year})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmPayment(ticket.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Confirm Payment
                    </button>
                    <button
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                      className="px-3 bg-slate-700 hover:bg-slate-600 text-white py-1.5 rounded text-xs font-medium transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingFinalPayments.length > 0 && (
          <div
            id="pending-final-payments"
            className="bg-black/60 backdrop-blur-sm rounded-lg border-2 border-orange-500 p-3 mb-3 shadow-xl shadow-orange-500/20"
            style={{
              boxShadow: '0 0 30px rgba(249, 115, 22, 0.3)'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Pending Final Payment Confirmations</h2>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-[10px] font-medium animate-pulse">
                {pendingFinalPayments.length} awaiting confirmation
              </span>
            </div>

            <div className="space-y-2">
              {pendingFinalPayments.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border-2 border-orange-400 rounded-lg p-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:border-orange-300 transition-all shadow-lg hover:shadow-xl relative"
                  style={{
                    boxShadow: '0 0 20px rgba(249, 115, 22, 0.4), 0 0 40px rgba(249, 115, 22, 0.2)',
                    animation: 'pulse-glow 2s ease-in-out infinite'
                  }}
                >
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full"></div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-xs">{ticket.title}</h3>
                        <span className="px-1.5 py-0.5 bg-orange-500/30 text-orange-200 rounded text-[10px] font-semibold">
                          FINAL PAYMENT
                        </span>
                      </div>
                      <p className="text-slate-400 text-[10px] mb-1.5 line-clamp-2">{ticket.description}</p>

                      <div className="bg-[#0f172a] rounded p-1.5 mb-1.5">
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div>
                            <span className="text-slate-500">Customer:</span>
                            <p className="text-white font-medium">{ticket.customer?.full_name || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Technician:</span>
                            <p className="text-emerald-300 font-medium">
                              {ticket.assigned_technician?.full_name || 'Unassigned'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Total Cost:</span>
                            <p className="text-white font-bold text-xs">
                              ${parseFloat((ticket as any).estimated_cost || '0').toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Initial Paid:</span>
                            <p className="text-green-300 font-bold text-xs">
                              ${parseFloat((ticket as any).initial_payment_amount || '0').toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Final Amount:</span>
                            <p className="text-orange-300 font-bold text-xs">
                              ${parseFloat((ticket as any).final_payment_amount || '0').toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Reference:</span>
                            <p className="text-white font-medium truncate text-[10px]">
                              {(ticket as any).final_payment_reference || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Service Type:</span>
                            <p className="text-white font-medium text-[10px]">
                              🚗 On-Site Visit
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Submitted:</span>
                            <p className="text-slate-300 text-[10px]">
                              {new Date((ticket as any).final_payment_made_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {(ticket as any).vehicle_brand && (
                        <p className="text-slate-400 text-[10px]">
                          Vehicle: {(ticket as any).vehicle_brand} {(ticket as any).vehicle_model} ({(ticket as any).vehicle_year})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmFinalPayment(ticket.id)}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Confirm Final Payment
                    </button>
                    <button
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                      className="px-3 bg-slate-700 hover:bg-slate-600 text-white py-1.5 rounded text-xs font-medium transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingTechnicians.length > 0 && (
          <div id="pending-technicians" className="bg-black/60 backdrop-blur-sm rounded-lg border border-amber-500/50 p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Pending Technician Applications</h2>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-medium">
                {pendingTechnicians.length} pending
              </span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {pendingTechnicians.map((tech) => (
                <div
                  key={tech.id}
                  className="border border-slate-700 rounded-lg p-2 hover:border-slate-600 transition-colors"
                >
                  <div className="mb-1.5">
                    <h3 className="font-medium text-white text-xs">{tech.full_name}</h3>
                    <p className="text-[10px] text-slate-400">{tech.phone}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Applied: {new Date((tech as any).technician_application_date || tech.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => approveTechnician(tech.id)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-1 rounded text-[10px] font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setReviewingTechnicianId(tech.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1 rounded text-[10px] font-medium transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#1e293b] rounded-lg border border-slate-700 p-2.5 mb-3">
          <h2 className="text-xs font-semibold text-white mb-2">Support Tickets</h2>

          {tickets.length === 0 ? (
            <p className="text-slate-500 text-center py-2 text-[10px]">No tickets yet</p>
          ) : (
            <div className="space-y-1.5">
              {tickets.map((ticket) => {
                const hasEstimateNeedingPayment = (ticket as any).estimated_cost && !(ticket as any).payment_made;
                const hasPaymentNeedingConfirmation = (ticket as any).payment_made && !(ticket as any).payment_confirmed;

                return (
                <div
                  key={ticket.id}
                  className={`border rounded p-2 transition-all ${
                    hasPaymentNeedingConfirmation
                      ? 'border-yellow-400 bg-yellow-500/5 hover:border-yellow-300'
                      : hasEstimateNeedingPayment
                      ? 'border-orange-400/60 bg-orange-500/5 hover:border-orange-400'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {getStatusIcon(ticket.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-semibold text-white text-[11px] truncate">{ticket.title}</h3>
                          {(ticket as any).estimated_cost && (
                            <span className="px-1 py-0.5 bg-green-500/20 text-green-300 rounded text-[9px] font-semibold shrink-0">
                              ${parseFloat((ticket as any).estimated_cost).toFixed(0)}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[10px] line-clamp-1 mb-0.5">{ticket.description}</p>
                        <div className="flex items-center gap-1.5 text-[9px] flex-wrap">
                          <span className="text-slate-400">
                            <span className="font-medium text-slate-300">{ticket.customer?.full_name || 'Unknown'}</span>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">
                            {ticket.category.replace('_', ' ')}
                          </span>
                          {(ticket as any).vehicle_brand && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-500">
                                {(ticket as any).vehicle_brand} {(ticket as any).vehicle_model}
                              </span>
                            </>
                          )}
                          {(ticket as any).service_type && (ticket as any).service_type !== 'pending' && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className={`${(ticket as any).service_type === 'on_site' ? 'text-orange-400' : 'text-blue-400'} font-medium`}>
                                {(ticket as any).service_type === 'on_site' ? 'On-Site' : 'Online'}
                              </span>
                            </>
                          )}
                          {(ticket as any).estimated_cost && !(ticket as any).payment_made && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-orange-400 font-medium animate-pulse">
                                💰 Awaiting Payment ($<span className="font-bold">{parseFloat((ticket as any).estimated_cost).toFixed(0)}</span>)
                              </span>
                            </>
                          )}
                          {(ticket as any).payment_made && !(ticket as any).payment_confirmed && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-yellow-400 font-medium animate-pulse">
                                ⚠ Payment Pending Confirmation
                              </span>
                            </>
                          )}
                          {(ticket as any).payment_confirmed && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-green-400 font-medium">
                                ✓ Paid
                              </span>
                            </>
                          )}
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border shrink-0 ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-700">
                    <div className="flex items-center gap-2">
                      {ticket.assigned_technician ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <UserCheck className="w-3 h-3 text-emerald-400" />
                          <span className="text-slate-400">
                            <span className="font-medium text-emerald-300">{ticket.assigned_technician.full_name}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Unassigned</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/ticket/${ticket.id}`)}
                        className="text-blue-400 hover:text-blue-300 text-[11px] font-medium"
                      >
                        View
                      </button>

                      {!ticket.assigned_technician && (
                        <button
                          onClick={() => setAssigningTicketId(ticket.id)}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Assign</span>
                        </button>
                      )}

                      {ticket.assigned_technician && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                        <button
                          onClick={() => setAssigningTicketId(ticket.id)}
                          className="text-orange-400 hover:text-orange-300 text-[11px] font-medium"
                        >
                          Reassign
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        <div id="history-section" className="bg-[#1e293b] rounded-lg border border-emerald-700/50 p-2.5 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Resolved Tickets History</h2>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium">
              {resolvedTickets.length} resolved
            </span>
          </div>

          {resolvedTickets.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-slate-600 mx-auto mb-1.5" />
              <p className="text-slate-500 text-xs">No resolved tickets yet</p>
              <p className="text-slate-600 text-[10px] mt-0.5">Resolved tickets will appear here for reference</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {resolvedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border border-slate-700 rounded p-2 transition-all hover:border-emerald-500/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-semibold text-white text-[11px] truncate">{ticket.title}</h3>
                          {(ticket as any).estimated_cost && (
                            <span className="px-1 py-0.5 bg-green-500/20 text-green-300 rounded text-[9px] font-semibold shrink-0">
                              ${parseFloat((ticket as any).estimated_cost).toFixed(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] flex-wrap">
                          <span className="text-slate-400">
                            <span className="font-medium text-slate-300">{ticket.customer?.full_name || 'Unknown'}</span>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-emerald-400">Resolved by: {ticket.assigned_technician?.full_name || 'N/A'}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">
                            {ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1.5 border-t border-slate-700">
                    <button
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                      className="text-emerald-400 hover:text-emerald-300 text-[11px] font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1e293b] rounded-lg border border-slate-700 p-2.5">
          <h2 className="text-xs font-semibold text-white mb-2">Customers</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[11px]">Name</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[11px]">Phone</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[11px]">VIP Tier</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[11px]">Status</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[11px]">Joined</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[11px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 10).map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-1.5 px-2 text-white text-[11px]">{customer.full_name}</td>
                    <td className="py-1.5 px-2 text-slate-400 text-[11px]">{customer.phone || 'N/A'}</td>
                    <td className="py-1.5 px-2">
                      {customer.vip_tier ? (
                        <VipBadge tier={customer.vip_tier} size="sm" />
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">Regular</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        (customer as any).status === 'blocked'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {(customer as any).status || 'active'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-slate-400 text-[11px]">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingVipCustomerId(customer.id);
                            setSelectedVipTier(customer.vip_tier);
                          }}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors"
                          title="Manage VIP Status"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateUserRole(customer.id, 'technician')}
                          className="text-orange-400 hover:text-orange-300 text-[11px] font-medium"
                          title="Make Technician"
                        >
                          → Tech
                        </button>
                        <button
                          onClick={() => toggleUserStatus(customer.id, (customer as any).status || 'active')}
                          className={`hover:opacity-80 transition-opacity ${
                            (customer as any).status === 'blocked' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                          title={(customer as any).status === 'blocked' ? 'Unblock' : 'Block'}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(customer.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 && (
              <p className="text-slate-500 text-center py-4 text-xs">No customers yet</p>
            )}
          </div>
        </div>
      </div>

      {assigningTicketId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl border border-white/10 max-w-md w-full p-4">
            <h2 className="text-xl font-bold text-white mb-3">Assign Technician</h2>
            <p className="text-slate-300 text-sm mb-3">
              Select a technician to assign to this support ticket:
            </p>

            {technicians.length === 0 ? (
              <div className="glass-card border border-amber-400/30 text-amber-300 px-3 py-2 rounded-lg mb-3 text-xs">
                No technicians available. Please promote a user to technician first.
              </div>
            ) : (
              <div className="space-y-1.5 mb-3">
                {technicians.map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => assignTicket(assigningTicketId, tech.id)}
                    className="w-full text-left glass-card border border-white/10 rounded-lg p-2.5 hover:border-orange-400/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white text-xs">{tech.full_name}</p>
                        <p className="text-[10px] text-slate-400">{tech.phone || 'No phone'}</p>
                      </div>
                      <UserCheck className="w-4 h-4 text-orange-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setAssigningTicketId(null)}
              className="w-full border border-white/10 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl border border-white/10 max-w-md w-full p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Delete Customer</h2>
                <p className="text-xs text-slate-300">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-slate-200 text-sm mb-4">
              Are you sure you want to permanently delete this customer? All their data, tickets, and payment history will be removed.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 border border-white/10 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(showDeleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewingTechnicianId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl border border-white/10 max-w-md w-full p-4">
            <h2 className="text-lg font-bold text-white mb-2">Reject Application</h2>
            <p className="text-slate-300 text-xs mb-3">
              Please provide a reason for rejecting this technician application. This will help them understand why their application was not accepted.
            </p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-white mb-1.5">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 text-white placeholder-slate-400 text-sm"
                rows={3}
                placeholder="e.g., Insufficient qualifications, incomplete application..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setReviewingTechnicianId(null);
                  setRejectionReason('');
                }}
                className="flex-1 border border-white/10 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectTechnician(reviewingTechnicianId)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVipCustomerId && (
        <VipTierModal
          customerId={editingVipCustomerId}
          currentTier={selectedVipTier}
          onClose={() => {
            setEditingVipCustomerId(null);
            setSelectedVipTier(null);
          }}
          onSuccess={() => {
            setEditingVipCustomerId(null);
            setSelectedVipTier(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function VipTierModal({
  customerId,
  currentTier,
  onClose,
  onSuccess
}: {
  customerId: string;
  currentTier: 'vip' | 'vvip' | 'gold' | 'diamond' | 'silver' | 'cardoc' | 'autodoc' | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState<'vip' | 'vvip' | 'gold' | 'diamond' | 'silver' | 'cardoc' | 'autodoc' | null>(currentTier);
  const [loading, setLoading] = useState(false);

  const tiers: Array<{ value: 'vip' | 'vvip' | 'gold' | 'diamond' | 'silver' | 'cardoc' | 'autodoc'; label: string; description: string }> = [
    { value: 'diamond', label: 'Diamond', description: 'Highest priority, premium support' },
    { value: 'gold', label: 'Gold', description: 'High priority, excellent support' },
    { value: 'silver', label: 'Silver', description: 'Priority support' },
    { value: 'cardoc', label: 'CarDoc', description: 'Single vehicle subscription tier' },
    { value: 'autodoc', label: 'AutoDoc', description: 'Multi-vehicle subscription tier' },
    { value: 'vvip', label: 'VVIP', description: 'Very important customer' },
    { value: 'vip', label: 'VIP', description: 'Valued customer' },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates: any = {
        vip_tier: selectedTier,
        vip_granted_at: selectedTier ? new Date().toISOString() : null,
        vip_granted_by: selectedTier ? user?.id : null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', customerId);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error updating VIP tier:', error);
      alert('Failed to update VIP tier. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full p-4 my-4">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          Manage VIP Status
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Upgrade loyal customers to VIP tiers
        </p>

        <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
          {tiers.map((tier) => (
            <button
              key={tier.value}
              onClick={() => setSelectedTier(tier.value)}
              className={`w-full text-left border-2 rounded-lg p-2.5 transition-all ${
                selectedTier === tier.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <VipBadge tier={tier.value} size="sm" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{tier.label}</p>
                    <p className="text-xs text-gray-600">{tier.description}</p>
                  </div>
                </div>
                {selectedTier === tier.value && (
                  <CheckCircle className="w-4 h-4 text-orange-500" />
                )}
              </div>
            </button>
          ))}

          <button
            onClick={() => setSelectedTier(null)}
            className={`w-full text-left border-2 rounded-lg p-2.5 transition-all ${
              selectedTier === null
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Regular Customer</p>
                <p className="text-xs text-gray-600">Remove VIP status</p>
              </div>
              {selectedTier === null && (
                <CheckCircle className="w-4 h-4 text-orange-500" />
              )}
            </div>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
