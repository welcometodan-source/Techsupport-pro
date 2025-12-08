import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  User,
  Car,
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
  Eye,
  Check,
  X,
  Plus,
  RotateCw,
  Edit,
  ArrowLeft
} from 'lucide-react';

type SubscriptionWithDetails = {
  id: string;
  user_id: string;
  subscription_plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending_payment';
  start_date: string;
  end_date: string | null;
  auto_renew: boolean;
  created_at: string;
  vehicle_count: number;
  payment_confirmed: boolean;
  payment_method: string | null;
  payment_reference: string | null;
  last_payment_date: string | null;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
  };
  plan: {
    plan_name: string;
    plan_type: string;
    billing_cycle: string;
    plan_category: string;
    price_monthly: number;
    max_vehicles: number;
  };
  vehicles: Array<{
    id: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: number | null;
  }>;
};

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendMonths, setExtendMonths] = useState(1);
  const [extendNote, setExtendNote] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  useEffect(() => {
    loadSubscriptions();
    loadTechnicians();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const { data: subsData, error } = await supabase
        .from('customer_subscriptions')
        .select(`
          *,
          profile:profiles!customer_subscriptions_user_id_fkey(full_name, email, phone),
          plan:subscription_plans(plan_name, plan_type, billing_cycle, plan_category, price_monthly, max_vehicles)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load assignments for all subscriptions
      const { data: assignments } = await supabase
        .from('subscription_assignments')
        .select(`
          subscription_id,
          status,
          assigned_at,
          technician:profiles!subscription_assignments_technician_id_fkey(id, full_name, email)
        `)
        .eq('status', 'active');

      // Create a map of subscription_id -> assignment
      const assignmentMap = new Map();
      (assignments || []).forEach((assignment: any) => {
        assignmentMap.set(assignment.subscription_id, assignment);
      });

      // Load vehicles and add assignment info for each subscription
      const subscriptionsWithVehicles = await Promise.all(
        (subsData || []).map(async (sub) => {
          const { data: vehicles } = await supabase
            .from('customer_vehicle_folders')
            .select('id, vehicle_make, vehicle_model, vehicle_year')
            .eq('customer_subscription_id', sub.id);

          return {
            ...sub,
            vehicles: vehicles || [],
            assignment: assignmentMap.get(sub.id) || null
          };
        })
      );

      setSubscriptions(subscriptionsWithVehicles as any);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, status')
        .eq('role', 'technician')
        .eq('status', 'active');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const assignTechnician = async () => {
    if (!selectedSubscription || !selectedTechnician) {
      alert('Please select a technician');
      return;
    }

    try {
      const { error } = await supabase
        .from('subscription_assignments')
        .insert({
          subscription_id: selectedSubscription.id,
          technician_id: selectedTechnician,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          notes: assignmentNotes,
          status: 'active'
        });

      if (error) throw error;

      alert('Technician assigned successfully!');
      setShowAssignModal(false);
      setSelectedTechnician('');
      setAssignmentNotes('');
    } catch (error: any) {
      console.error('Error assigning technician:', error);
      alert('Error assigning technician: ' + error.message);
    }
  };

  const confirmPayment = async (subscriptionId: string) => {
    try {
      setConfirming(true);

      // Get full subscription details
      const { data: subscription, error: fetchError } = await supabase
        .from('customer_subscriptions')
        .select(`
          *,
          profile:profiles!customer_subscriptions_user_id_fkey(id, full_name, email, phone),
          plan:subscription_plans(plan_name, plan_type, price_monthly, billing_cycle)
        `)
        .eq('id', subscriptionId)
        .single();

      if (fetchError) throw fetchError;
      if (!subscription) throw new Error('Subscription not found');

      // Update subscription status
      const { error: subError } = await supabase
        .from('customer_subscriptions')
        .update({
          payment_confirmed: true,
          last_payment_date: new Date().toISOString(),
          status: 'active'
        })
        .eq('id', subscriptionId);

      if (subError) throw subError;

      // Update vehicles
      const { error: vehicleError } = await supabase
        .from('customer_vehicle_folders')
        .update({
          subscription_status: 'active'
        })
        .eq('customer_subscription_id', subscriptionId)
        .eq('subscription_status', 'pending_payment');

      if (vehicleError) throw vehicleError;

      // Create payment record in payments table (for revenue tracking and recent payments)
      const subscriptionAmount = (subscription.plan as any)?.price_monthly || 0;
      if (subscriptionAmount > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            customer_id: (subscription as any).user_id,
            subscription_id: subscriptionId,
            amount: subscriptionAmount,
            currency: 'USD',
            payment_method: (subscription as any).payment_method ?? 'bank_transfer',
            payment_status: 'completed',
            payment_type: 'subscription',
            payment_reference: (subscription as any).payment_reference ?? 'subscription-payment'
          } as any);

        if (paymentError) {
          console.error('Error creating payment record:', paymentError);
          // Don't throw - payment record creation failure shouldn't block payment confirmation
        } else {
          console.log('Payment record created successfully for subscription:', subscriptionId);
        }
      }

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
      const customerId = (subscription as any).user_id;
      
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
          amount: subscriptionAmount,
          currency: 'USD',
          issue_date: new Date().toISOString(),
          payment_date: new Date().toISOString(),
          status: 'paid',
          payment_reference: (subscription as any).payment_reference || null,
          vehicle_info: vehicleInfo,
          service_details: `Subscription Payment - ${(subscription.plan as any)?.plan_name || 'Subscription Plan'} (${(subscription.plan as any)?.billing_cycle || 'monthly'})`,
          customer_name: (subscription.profile as any)?.full_name,
          customer_phone: (subscription.profile as any)?.phone,
          subtotal: subscriptionAmount,
          notes: `Subscription payment confirmed for ${(subscription.plan as any)?.plan_name || 'subscription plan'}. Payment method: ${(subscription as any).payment_method || 'bank_transfer'}.`
        } as any);

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        console.error('Invoice data:', {
          invoice_number: invoiceNumber,
          customer_id: customerId,
          subscription_id: subscriptionId,
          amount: subscriptionAmount
        });
        // Don't throw - invoice creation failure shouldn't block payment confirmation
        // But log it for debugging
        alert('Payment confirmed, but invoice creation failed. Please check console for details.');
      } else {
        console.log('Invoice created successfully:', invoiceNumber, 'for customer:', customerId);
      }

      alert('Payment confirmed successfully! Subscription and vehicles are now active. Payment has been recorded and invoice has been generated.');
      loadSubscriptions();
      setShowDetails(false);
      
      // Note: Revenue and Recent Payments will update automatically via real-time subscriptions
      // If viewing Admin Dashboard, it will refresh within 2 seconds or on next page load
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      alert('Error confirming payment: ' + error.message);
    } finally {
      setConfirming(false);
    }
  };

  const updateSubscriptionStatus = async (subscriptionId: string, newStatus: string) => {
    try {
      setConfirming(true);

      const { error } = await supabase
        .from('customer_subscriptions')
        .update({ status: newStatus })
        .eq('id', subscriptionId);

      if (error) throw error;

      // Reload subscriptions
      await loadSubscriptions();

      // Update the selected subscription with new status
      if (selectedSubscription) {
        setSelectedSubscription({
          ...selectedSubscription,
          status: newStatus as any
        });
      }

      alert(`Subscription status updated to ${newStatus}!`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    } finally {
      setConfirming(false);
    }
  };

  const extendSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      setConfirming(true);

      const currentEndDate = selectedSubscription.end_date
        ? new Date(selectedSubscription.end_date)
        : new Date(selectedSubscription.start_date);

      const billingCycle = selectedSubscription.plan?.billing_cycle || 'monthly';
      let newEndDate: Date;

      if (billingCycle === 'yearly') {
        newEndDate = new Date(currentEndDate);
        newEndDate.setFullYear(newEndDate.getFullYear() + Math.floor(extendMonths / 12));
        newEndDate.setMonth(newEndDate.getMonth() + (extendMonths % 12));
      } else {
        newEndDate = new Date(currentEndDate);
        newEndDate.setMonth(newEndDate.getMonth() + extendMonths);
      }

      const newEndDateISO = newEndDate.toISOString();
      const lastPaymentISO = new Date().toISOString();

      const { error } = await supabase
        .from('customer_subscriptions')
        .update({
          end_date: newEndDateISO,
          status: 'active',
          last_payment_date: lastPaymentISO
        })
        .eq('id', selectedSubscription.id);

      if (error) throw error;

      // Update selected subscription state
      setSelectedSubscription({
        ...selectedSubscription,
        end_date: newEndDateISO,
        status: 'active',
        last_payment_date: lastPaymentISO
      });

      alert(`Subscription extended by ${extendMonths} month(s) successfully!`);
      await loadSubscriptions();
      setShowExtendModal(false);
      setExtendMonths(1);
      setExtendNote('');
    } catch (error: any) {
      console.error('Error extending subscription:', error);
      alert('Error extending subscription: ' + error.message);
    } finally {
      setConfirming(false);
    }
  };

  const renewSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      setConfirming(true);

      const today = new Date();
      const billingCycle = selectedSubscription.plan?.billing_cycle || 'monthly';
      const newEndDate = new Date(today);

      if (billingCycle === 'yearly') {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      } else {
        newEndDate.setMonth(newEndDate.getMonth() + 1);
      }

      const startDateISO = today.toISOString();
      const endDateISO = newEndDate.toISOString();
      const lastPaymentISO = new Date().toISOString();

      const { error } = await supabase
        .from('customer_subscriptions')
        .update({
          start_date: startDateISO,
          end_date: endDateISO,
          status: 'active',
          last_payment_date: lastPaymentISO
        })
        .eq('id', selectedSubscription.id);

      if (error) throw error;

      // Update selected subscription state
      setSelectedSubscription({
        ...selectedSubscription,
        start_date: startDateISO,
        end_date: endDateISO,
        status: 'active',
        last_payment_date: lastPaymentISO
      });

      alert('Subscription renewed successfully!');
      await loadSubscriptions();
    } catch (error: any) {
      console.error('Error renewing subscription:', error);
      alert('Error renewing subscription: ' + error.message);
    } finally {
      setConfirming(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch =
      (sub.profile?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.profile?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.plan?.plan_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending_payment: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    };

    const icons: Record<string, any> = {
      active: CheckCircle,
      pending_payment: Clock,
      cancelled: XCircle,
      expired: AlertCircle
    };

    const Icon = icons[status] || Clock;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    pending: subscriptions.filter(s => s.status === 'pending_payment').length,
    totalRevenue: subscriptions
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + (s.plan?.price_monthly || 0), 0)
  };

  return (
    <div className="page-shell theme-surface">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {/* Header */}
        <div className="mb-3">
          <button
            onClick={() => navigate('/admin')}
            className="mb-2 flex items-center gap-1.5 p-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs">Back</span>
          </button>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-white mb-0.5">Subscription Management</h1>
              <p className="text-slate-300 text-xs">Oversee CarDoc and AutoDoc subscriptions, payments, and technician assignments.</p>
            </div>
            <button
              onClick={() => navigate('/admin/visits')}
              className="px-3 py-1.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:from-sky-400 hover:to-blue-500 transition-all flex items-center gap-1.5 shadow-lg shadow-blue-900/30 text-xs"
            >
              <Calendar className="w-4 h-4" />
              Manage Visits
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Total Subscriptions', value: stats.total, icon: User, iconBg: 'from-sky-500/20 to-sky-500/5', textColor: 'text-white' },
            { label: 'Active', value: stats.active, icon: CheckCircle, iconBg: 'from-emerald-500/20 to-emerald-500/5', textColor: 'text-emerald-200' },
            { label: 'Pending Payment', value: stats.pending, icon: Clock, iconBg: 'from-amber-500/20 to-amber-500/5', textColor: 'text-amber-200' },
            { label: 'Monthly Revenue', value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, iconBg: 'from-orange-500/20 to-orange-500/5', textColor: 'text-orange-200' }
          ].map((card) => (
            <div key={card.label} className="glass-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-300">{card.label}</p>
                  <p className={`text-lg font-bold ${card.textColor}`}>{card.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${card.iconBg}`}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="glass-card p-3 mb-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by customer name, email, or plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white/5 text-white placeholder-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white/5 text-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <button
              onClick={loadSubscriptions}
              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors inline-flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="relative">
                <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
                <div className="relative w-10 h-10 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="text-center p-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No subscriptions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Vehicles
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Technician
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSubscriptions.map((subscription) => (
                    <tr key={subscription.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div>
                          <div className="text-xs font-medium text-gray-900">
                            {subscription.profile?.full_name || 'N/A'}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {subscription.profile?.email || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-900">
                          {subscription.plan?.plan_name || 'N/A'}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {subscription.plan?.plan_type} - {subscription.plan?.billing_cycle}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs text-gray-900">
                          <Car className="w-3 h-3" />
                          {subscription.vehicles.length} / {subscription.plan?.max_vehicles || 0}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-900">
                          ${subscription.plan?.price_monthly || 0}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          /{subscription.plan?.billing_cycle === 'yearly' ? 'year' : 'month'}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {getStatusBadge(subscription.status)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {subscription.payment_confirmed ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800">
                            <Clock className="w-2.5 h-2.5" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {(subscription as any).assignment ? (
                          <div>
                            <div className="text-xs font-medium text-gray-900 flex items-center gap-1">
                              <User className="w-3 h-3 text-blue-500" />
                              {(subscription as any).assignment.technician.full_name}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {(subscription as any).assignment.technician.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                        {new Date(subscription.start_date).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        <button
                          onClick={() => {
                            setSelectedSubscription(subscription);
                            setShowDetails(true);
                          }}
                          className="text-orange-600 hover:text-orange-900 inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedSubscription && (
        <div className="fixed inset-0 bg-[#011025]/85 backdrop-blur-lg flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#04132c] via-[#052a56] to-[#0a4373] shadow-[0_25px_80px_rgba(1,8,20,0.7)]">
            <div className="sticky top-0 bg-gradient-to-r from-[#031c3f] to-[#063463] px-6 py-4 flex items-center justify-between rounded-t-3xl border-b border-white/10 shadow-inner shadow-black/40">
              <h2 className="text-2xl font-bold text-white">Subscription Details</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 rounded-full text-slate-100 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-white">
              {/* Payment Warning */}
              {!selectedSubscription.payment_confirmed && (
                <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4 flex items-start gap-3 shadow-inner shadow-black/20">
                  <AlertCircle className="w-5 h-5 text-amber-300 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-200 mb-1">Payment Not Confirmed</h4>
                    <p className="text-sm text-amber-100/90">
                      This subscription payment has not been confirmed yet. The assigned technician cannot access this customer until payment is approved.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-5">
                {/* Customer Info */}
                <section className="space-y-3">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-sky-200">Customer Information</h3>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 shadow-inner shadow-black/30">
                    <Row label="Name" value={selectedSubscription.profile?.full_name || 'N/A'} />
                    <Row label="Email" value={selectedSubscription.profile?.email || 'N/A'} />
                    <Row label="Phone" value={selectedSubscription.profile?.phone || 'N/A'} />
                  </div>
                </section>

                {/* Assignment Info */}
                <section className="space-y-3">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-sky-200">Technician Assignment</h3>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    {(selectedSubscription as any).assignment ? (
                      <>
                        <Row label="Assigned To" value={(selectedSubscription as any).assignment.technician.full_name} />
                        <Row label="Technician Email" value={(selectedSubscription as any).assignment.technician.email} />
                        <Row
                          label="Assigned On"
                          value={new Date((selectedSubscription as any).assignment.assigned_at).toLocaleDateString()}
                        />
                        <div className="flex items-center gap-2 text-emerald-300 text-sm border-t border-white/10 pt-2">
                          <CheckCircle className="w-4 h-4" />
                          Technician Assigned
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-300">
                        <AlertCircle className="w-4 h-4" />
                        <span className="italic text-sm">No technician assigned yet</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Plan Info */}
                <section className="space-y-3">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-sky-200">Plan Details</h3>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <Row label="Plan Name" value={selectedSubscription.plan?.plan_name || 'N/A'} />
                    <Row label="Category" value={selectedSubscription.plan?.plan_category?.toUpperCase() || 'N/A'} />
                    <Row label="Type" value={selectedSubscription.plan?.plan_type || 'N/A'} />
                    <Row
                      label="Price"
                      value={`$${selectedSubscription.plan?.price_monthly || 0} / ${selectedSubscription.plan?.billing_cycle || 'month'}`}
                    />
                    <Row
                      label="Vehicle Slots"
                      value={`${selectedSubscription.vehicles.length} / ${selectedSubscription.plan?.max_vehicles || 0}`}
                    />
                  </div>
                </section>

                {/* Vehicles */}
                {selectedSubscription.vehicles.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs uppercase tracking-[0.2em] text-sky-200">Registered Vehicles</h3>
                    <div className="space-y-2">
                      {selectedSubscription.vehicles.map((vehicle) => (
                        <div
                          key={vehicle.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center gap-3"
                        >
                          <Car className="w-5 h-5 text-sky-200" />
                          <span className="text-sm font-medium text-white">
                            {vehicle.vehicle_year} {vehicle.vehicle_make} {vehicle.vehicle_model}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Subscription Status */}
                <section className="space-y-3">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-sky-200">Subscription Status</h3>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-200">Current Status:</span>
                      {getStatusBadge(selectedSubscription.status)}
                    </div>
                    <Row label="Start Date" value={new Date(selectedSubscription.start_date).toLocaleDateString()} />
                    <Row
                      label="End Date"
                      value={
                        selectedSubscription.end_date
                          ? new Date(selectedSubscription.end_date).toLocaleDateString()
                          : 'Not set'
                      }
                    />
                    <Row label="Auto Renew" value={selectedSubscription.auto_renew ? 'Yes' : 'No'} />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-200">Payment Confirmed:</span>
                      {selectedSubscription.payment_confirmed ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/40">
                          <CheckCircle className="w-4 h-4" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-100 border border-amber-400/40">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="text-xs text-slate-300 text-center">
                  Current Status: <span className="font-mono text-white">{selectedSubscription.status}</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!selectedSubscription.payment_confirmed && (
                    <button
                      onClick={() => confirmPayment(selectedSubscription.id)}
                      disabled={confirming}
                      className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {confirming ? 'Confirming...' : 'Confirm Payment'}
                    </button>
                  )}

                  {selectedSubscription.status === 'active' && (
                    <>
                      <button
                        onClick={() => setShowExtendModal(true)}
                        disabled={confirming}
                        className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold hover:from-sky-600 hover:to-cyan-500 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Extend
                      </button>
                      <button
                        onClick={() => updateSubscriptionStatus(selectedSubscription.id, 'cancelled')}
                        disabled={confirming}
                        className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold hover:from-rose-600 hover:to-rose-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        {confirming ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </>
                  )}

                  {selectedSubscription.status === 'cancelled' && (
                    <>
                      <button
                        onClick={() => renewSubscription()}
                        disabled={confirming}
                        className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold hover:from-sky-600 hover:to-cyan-500 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RotateCw className="w-4 h-4" />
                        {confirming ? 'Renewing...' : 'Renew'}
                      </button>
                      <button
                        onClick={() => updateSubscriptionStatus(selectedSubscription.id, 'active')}
                        disabled={confirming}
                        className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {confirming ? 'Reactivating...' : 'Reactivate'}
                      </button>
                    </>
                  )}

                  {selectedSubscription.status === 'expired' && (
                    <>
                      <button
                        onClick={() => renewSubscription()}
                        disabled={confirming}
                        className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold hover:from-sky-600 hover:to-cyan-500 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RotateCw className="w-4 h-4" />
                        {confirming ? 'Renewing...' : 'Renew'}
                      </button>
                      <button
                        onClick={() => updateSubscriptionStatus(selectedSubscription.id, 'active')}
                        disabled={confirming}
                        className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {confirming ? 'Reactivating...' : 'Reactivate'}
                      </button>
                    </>
                  )}

                  {/* Assign Technician - Available for all active/pending subscriptions */}
                  {(selectedSubscription.status === 'active' || selectedSubscription.status === 'pending_payment') && (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="flex-1 min-w-[150px] px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Assign Technician
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Technician Modal */}
      {showAssignModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card max-w-md w-full border border-white/10">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Assign Technician</h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedTechnician('');
                    setAssignmentNotes('');
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-300 mb-4">
                  Assigning technician for{' '}
                  <span className="font-semibold text-white">
                    {selectedSubscription.profile?.full_name}
                  </span>
                  's subscription ({selectedSubscription.plan?.plan_name})
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Select Technician
                </label>
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                >
                  <option value="" className="bg-slate-800 text-white">Choose a technician...</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id} className="bg-slate-800 text-white">
                      {tech.full_name} - {tech.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Add any special instructions for the technician...
                </label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Add any special instructions for the technician..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/10">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedTechnician('');
                    setAssignmentNotes('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700/50 text-white rounded-lg hover:bg-slate-700 transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={assignTechnician}
                  disabled={!selectedTechnician}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Assign Technician
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Subscription Modal */}
      {showExtendModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card max-w-md w-full border border-white/10">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Extend Subscription</h2>
                <button
                  onClick={() => {
                    setShowExtendModal(false);
                    setExtendMonths(1);
                    setExtendNote('');
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-300 mb-4">
                  Extending subscription for{' '}
                  <span className="font-semibold text-white">
                    {selectedSubscription.profile?.full_name}
                  </span>
                </p>

                <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4 mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-300">Current End Date:</span>
                    <span className="text-sm font-medium text-white">
                      {selectedSubscription.end_date
                        ? new Date(selectedSubscription.end_date).toLocaleDateString()
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-300">Plan:</span>
                    <span className="text-sm font-medium text-white">
                      {selectedSubscription.plan?.plan_name}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Extend by (months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={extendMonths}
                  onChange={(e) => setExtendMonths(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">
                  New end date will be{' '}
                  {(() => {
                    const currentEnd = selectedSubscription.end_date
                      ? new Date(selectedSubscription.end_date)
                      : new Date(selectedSubscription.start_date);
                    const newEnd = new Date(currentEnd);
                    newEnd.setMonth(newEnd.getMonth() + extendMonths);
                    return newEnd.toLocaleDateString();
                  })()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Note (optional)
                </label>
                <textarea
                  value={extendNote}
                  onChange={(e) => setExtendNote(e.target.value)}
                  placeholder="Add a note about this extension..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowExtendModal(false);
                    setExtendMonths(1);
                    setExtendNote('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700/50 text-white rounded-lg hover:bg-slate-700 transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={extendSubscription}
                  disabled={confirming || extendMonths < 1}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {confirming ? 'Extending...' : `Extend ${extendMonths} Month${extendMonths > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-slate-200">{label}:</span>
    <span className="text-white font-medium text-right">{value}</span>
  </div>
);
