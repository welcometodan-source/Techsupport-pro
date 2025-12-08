import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { generateVisitReportPdf, VisitForPdf } from '../utils/visitReportPdf';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  Eye,
  Car,
  X,
  CreditCard,
  Receipt
} from 'lucide-react';

interface Visit {
  id: string;
  subscription_id: string;
  visit_number: number;
  scheduled_date: string;
  completed_at: string | null;
  started_at: string | null;
  status: string;
  report: string | null;
  findings: string | null;
  recommendations: string | null;
  work_performed: string | null;
  parts_used: any[] | null;
  duration_minutes: number | null;
  location: string | null;
  created_at: string;
  technician: {
    full_name: string;
    email: string;
  };
  inspections?: InspectionItem[];
}

interface VisitReport {
  id: string;
  visit_id: string;
  report_data: any;
  created_at: string;
}

interface InspectionItem {
  id: string;
  visit_id: string;
  category: string;
  item: string;
  status: string;
  notes: string;
  created_at: string;
}

export default function CustomerSubscriptionVisitsPage() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [visitReport, setVisitReport] = useState<VisitReport | null>(null);
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [pendingSubscription, setPendingSubscription] = useState<any>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const fallbackPaymentMethods = [
    { id: 'cash', method_type: 'cash', method_name: 'Cash' },
    { id: 'bank_transfer', method_type: 'bank_transfer', method_name: 'Bank Transfer' },
    { id: 'mobile_money', method_type: 'mobile_money', method_name: 'Mobile Money' },
    { id: 'credit_card', method_type: 'credit_card', method_name: 'Credit Card' }
  ];
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<any[]>(fallbackPaymentMethods);

  const renderDetailRow = (label: string, value?: string | null) => {
    if (!value) return null;
    return (
      <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-300">{label}</span>
        <span className="text-xs sm:text-sm font-semibold text-white break-all">{value}</span>
      </div>
    );
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!profile || authLoading || !isMounted) return;
      await Promise.all([loadVisits(), checkPendingPayment(), loadPaymentMethods()]);
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [profile, authLoading]);

  useEffect(() => {
    if (paymentMethod) {
      loadPaymentDetails(paymentMethod);
    } else {
      setPaymentDetails(null);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (location.state?.showPayment && profile && !authLoading) {
      checkPendingPayment();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, profile, authLoading]);

  useEffect(() => {
    if (!profile || authLoading) return;

    const channel = supabase
      .channel('customer-visits')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_visits'
        },
        (payload) => {
          console.log('Visit updated:', payload);
          loadVisits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, authLoading]);

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setAvailablePaymentMethods(data);
      } else {
        setAvailablePaymentMethods(fallbackPaymentMethods);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setAvailablePaymentMethods(fallbackPaymentMethods);
    }
  };

  const loadPaymentDetails = async (method: string) => {
    try {
      const settingKey = `payment_${method}_details`;
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', settingKey)
        .maybeSingle();

      if (error) {
        console.error('Error loading payment details:', error);
      }

      if (data?.setting_value) {
        try {
        setPaymentDetails(JSON.parse(data.setting_value));
        } catch (parseError) {
          console.error('Error parsing payment details JSON:', parseError);
          setPaymentDetails(null);
        }
      } else {
        console.warn(`No instructions stored for ${method}. Showing default instructions only.`);
        setPaymentDetails(null);
      }
    } catch (error) {
      console.error('Error loading payment details:', error);
      setPaymentDetails(null);
    }
  };

  const checkPendingPayment = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('customer_subscriptions')
        .select('*, subscription_plan:subscription_plans(*)')
        .eq('user_id', profile.id)
        .eq('payment_confirmed', false)
        .is('payment_method', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPendingSubscription(data);
        setShowPaymentForm(true);
      } else {
        const { data: waitingData } = await supabase
          .from('customer_subscriptions')
          .select('*, subscription_plan:subscription_plans(*)')
          .eq('user_id', profile.id)
          .eq('payment_confirmed', false)
          .not('payment_method', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (waitingData) {
          setWaitingConfirmation(waitingData);
        }
      }
    } catch (error) {
      console.error('Error checking pending payment:', error);
    }
  };

  const loadVisits = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      const { data: subscriptionData, error: subError } = await supabase
        .from('customer_subscriptions')
        .select('id, status')
        .eq('user_id', profile.id)
        .in('status', ['active', 'pending_payment'])
        .maybeSingle();

      if (subError) throw subError;

      if (!subscriptionData) {
        setVisits([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscription_visits')
        .select(`
          *,
          technician:profiles!subscription_visits_technician_id_fkey(full_name, email)
        `)
        .eq('subscription_id', subscriptionData.id)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;

      // Load inspections for each visit
      const visitsWithInspections = await Promise.all(
        (data || []).map(async (visit) => {
          const { data: inspectionsData } = await supabase
            .from('visit_inspections')
            .select('*')
            .eq('visit_id', visit.id)
            .order('category', { ascending: true });

          return { ...visit, inspections: inspectionsData || [] };
        })
      );

      setVisits(visitsWithInspections as any);
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!profile || !pendingSubscription || !paymentMethod || !paymentReference) {
      alert('Please enter both payment method and receipt number');
      return;
    }

    setSubmittingPayment(true);
    try {
      const { error } = await supabase
        .from('customer_subscriptions')
        .update({
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          last_payment_date: new Date().toISOString()
        })
        .eq('id', pendingSubscription.id)
        .eq('user_id', profile.id);

      if (error) throw error;

      alert('Payment information submitted successfully! Waiting for admin confirmation.');
      setShowPaymentForm(false);
      setPaymentMethod('');
      setPaymentReference('');
      checkPendingPayment();
    } catch (error) {
      console.error('Error submitting payment:', error);
      const message =
        (error as any)?.message ||
        (error as any)?.error_description ||
        'Failed to submit payment information. Please try again.';
      alert(`Failed to submit payment information: ${message}`);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const loadVisitReport = async (visitId: string) => {
    try {
      const [reportRes, inspectionsRes] = await Promise.all([
        supabase
          .from('service_history')
          .select('*')
          .eq('visit_id', visitId)
          .maybeSingle(),
        supabase
          .from('visit_inspections')
          .select('*')
          .eq('visit_id', visitId)
          .order('category', { ascending: true })
      ]);

      if (reportRes.error) throw reportRes.error;
      if (inspectionsRes.error) throw inspectionsRes.error;

      setVisitReport(reportRes.data);
      setInspections(inspectionsRes.data || []);
      setShowReportModal(true);
    } catch (error) {
      console.error('Error loading visit report:', error);
      alert('Failed to load visit report');
    }
  };

  const downloadReport = async (visit: Visit) => {
    // Load evidence photos/videos for this visit
    let photos: Array<{ id: string; photo_url: string; caption: string | null; category: string | null }> = [];
    try {
      const { data: photoRows, error: photoError } = await supabase
        .from('visit_photos')
        .select('*')
        .eq('visit_id', visit.id)
        .order('uploaded_at', { ascending: true });

      if (!photoError && photoRows) {
        photos = photoRows as any;
      } else if (photoError) {
        console.warn('Error loading visit photos for report:', photoError);
      }
    } catch (e) {
      console.warn('Unexpected error loading visit photos for report:', e);
    }

    const visitForPdf: VisitForPdf = {
      id: visit.id,
      visit_number: visit.visit_number,
      scheduled_date: visit.scheduled_date,
      started_at: visit.started_at,
      completed_at: visit.completed_at,
      confirmed_at: (visit as any).confirmed_at ?? null,
      status: visit.status,
      findings: visit.findings,
      recommendations: visit.recommendations,
      work_performed: visit.work_performed,
      location: visit.location,
      duration_minutes: visit.duration_minutes,
      parts_used: visit.parts_used || [],
      customer_name: (visit as any).subscription?.user?.full_name || (visit as any).customer_name || null,
      customer_email: (visit as any).subscription?.user?.email || (visit as any).customer_email || null,
      technician_name: visit.technician.full_name,
      technician_email: visit.technician.email,
      inspections: visit.inspections as any,
      photos: photos as any
    };

    const fileName = `visit-${visit.visit_number}-report-${Date.now()}.pdf`;

    try {
      // Detect if we're on mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const anyWindow = window as any;
      const isNative = !!anyWindow?.Capacitor?.isNativePlatform;

      // Generate a PDF report (best format for multi-page reports and printing)
      await generateVisitReportPdf(visitForPdf, fileName);
    } catch (error) {
      console.error('Error generating visit report for download:', error);
      alert('Unable to download report. Please try again or contact support.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'scheduled':
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'pending_confirmation':
        return 'text-yellow-600 bg-yellow-100';
      case 'in_progress':
      case 'scheduled':
        return 'text-blue-600 bg-blue-100';
      case 'rejected':
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getInspectionColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'needs_attention':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const parseFindings = (findings?: string | null) => {
    if (!findings) return [];
    return findings
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [systemPart, neededPart] = line.split(' - Needed:').map(part => part?.trim());
        let status: 'PASS' | 'NEEDS ATTENTION' | 'URGENT ATTENTION' = 'PASS';
        if (systemPart.includes('URGENT ATTENTION')) status = 'URGENT ATTENTION';
        else if (systemPart.includes('NEEDS ATTENTION')) status = 'NEEDS ATTENTION';

        return {
          label: systemPart.replace('System:', 'System').trim(),
          status,
          needed: neededPart || ''
        };
      });
  };

  const getFindingStyles = (status: string) => {
    switch (status) {
      case 'URGENT ATTENTION':
        return {
          badge: 'bg-rose-500/20 text-rose-200 border border-rose-400/30',
          card: 'border-rose-500/30 bg-rose-500/10'
        };
      case 'NEEDS ATTENTION':
        return {
          badge: 'bg-amber-500/20 text-amber-100 border border-amber-400/30',
          card: 'border-amber-500/30 bg-amber-500/10'
        };
      default:
        return {
          badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
          card: 'border-emerald-500/30 bg-emerald-500/10'
        };
    }
  };

  const InfoCard = ({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 sm:p-3 md:p-4">
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-300 mb-0.5 sm:mb-1">{title}</p>
      <p className="text-xs sm:text-sm font-semibold text-white">{value}</p>
      {subtitle && <p className="text-[10px] sm:text-xs text-slate-300">{subtitle}</p>}
    </div>
  );

  const SectionCard = ({ title, body, titleColor = 'text-slate-300' }: { title: string; body: string; titleColor?: string }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 sm:p-3 md:p-4">
      <p className={`text-[10px] sm:text-xs uppercase tracking-[0.2em] ${titleColor} mb-1 sm:mb-2`}>{title}</p>
      <p className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap">{body}</p>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="page-shell theme-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-12 h-12 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-200 text-sm">Loading visits...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-shell theme-surface flex items-center justify-center">
        <div className="text-center glass-card px-3 py-4">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="text-slate-200 text-xs">Please log in to view your visits</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell theme-surface">
      <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-6 py-1 sm:py-2 relative z-10">
        <div className="mb-1 sm:mb-2">
          <button
            onClick={() => navigate('/customer')}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all mb-1 sm:mb-2 text-[10px] sm:text-xs"
          >
            <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Back
          </button>
          <div className="flex items-center gap-1 sm:gap-2">
            <Car className="w-4 h-4 sm:w-5 sm:h-5 text-sky-300" />
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-white">Subscription Visits</h1>
          </div>
        </div>

        {waitingConfirmation && !showPaymentForm && (
          <div className="glass-card border border-blue-500/30 rounded-xl shadow-lg p-2 sm:p-3 mb-1 sm:mb-2">
            <div className="flex items-start gap-1.5 sm:gap-2">
              <div className="bg-blue-500 text-white p-1.5 sm:p-2 rounded-full shrink-0">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-white mb-0.5 sm:mb-1">Payment Awaiting Confirmation</h2>
                <p className="text-slate-300 text-[9px] sm:text-[10px] mb-1 sm:mb-2">
                  Subscription to <span className="font-semibold text-blue-300">{waitingConfirmation.subscription_plan?.plan_name}</span> pending admin confirmation.
                </p>

                <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                  <div className="grid md:grid-cols-2 gap-1.5 text-[10px]">
                    <div>
                      <span className="text-slate-400">Method:</span>
                      <span className="ml-1 font-semibold text-white capitalize">{waitingConfirmation.payment_method?.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Ref:</span>
                      <span className="ml-1 font-semibold text-white">{waitingConfirmation.payment_reference}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Plan:</span>
                      <span className="ml-1 font-semibold text-white">{waitingConfirmation.subscription_plan?.plan_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Price:</span>
                      <span className="ml-1 font-semibold text-blue-300">
                        ${waitingConfirmation.subscription_plan?.price_monthly}/mo
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-300">
                  <AlertCircle className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>Payment being reviewed. You'll be notified once confirmed.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPaymentForm && pendingSubscription && (
          <div className="glass-card border border-orange-500/30 rounded-xl shadow-lg p-2 sm:p-3 mb-1 sm:mb-2">
            <div className="flex items-start gap-1.5 sm:gap-2">
              <div className="bg-orange-500 text-white p-1.5 sm:p-2 rounded-full shrink-0">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-white mb-0.5 sm:mb-1">Complete Your Payment</h2>
                <p className="text-slate-300 text-[9px] sm:text-[10px] mb-1 sm:mb-2">
                  Subscribed to <span className="font-semibold text-orange-300">{pendingSubscription.subscription_plan?.plan_name}</span>.
                  Provide payment details below.
                </p>

                <div className="bg-white/5 rounded-lg p-2 mb-2 border border-white/10">
                  <div className="grid md:grid-cols-2 gap-1.5 text-[10px]">
                    <div>
                      <span className="text-slate-400">Plan:</span>
                      <span className="ml-1 font-semibold text-white">{pendingSubscription.subscription_plan?.plan_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Price:</span>
                      <span className="ml-1 font-semibold text-orange-300">
                        ${pendingSubscription.subscription_plan?.price_monthly}/mo
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-300 mb-1">
                      <Receipt className="w-3 h-3 inline mr-1" />
                      Payment Method <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-white/20 rounded-lg bg-[#07142a]/90 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        backgroundImage: 'none'
                      }}
                      required
                    >
                      <option value="" className="text-slate-900" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                        Select payment method
                      </option>
                      {availablePaymentMethods.map((method) => (
                        <option
                          key={method.id}
                          value={method.method_type}
                          className="text-slate-900"
                          style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                        >
                          {method.method_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {paymentMethod ? (
                    <>
                  {paymentDetails && (
                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#041836]/95 via-[#05294f]/95 to-[#083b73]/95 p-3 sm:p-4 shadow-lg shadow-blue-900/30">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-5 h-5 text-sky-300" />
                              <h3 className="text-sm sm:text-base font-semibold text-white">Payment Details</h3>
                          </div>
                            <span className="text-[10px] text-slate-300">
                              Carefully review these instructions before paying
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {paymentMethod === 'bank_transfer' && (
                              <>
                                {renderDetailRow('Bank Name', paymentDetails.bank_name)}
                                {renderDetailRow('Account Holder', paymentDetails.account_holder)}
                                {renderDetailRow('Account Number', paymentDetails.account_number)}
                                {renderDetailRow('IBAN', paymentDetails.iban)}
                                {renderDetailRow('SWIFT Code', paymentDetails.swift_code)}
                              </>
                      )}

                      {paymentMethod === 'mobile_money' && (
                              <>
                                {renderDetailRow('Provider', paymentDetails.provider)}
                                {renderDetailRow('Mobile Number', paymentDetails.mobile_number)}
                                {renderDetailRow('Account Name', paymentDetails.account_name)}
                                {renderDetailRow('Instructions', paymentDetails.instructions || paymentDetails.message)}
                              </>
                      )}

                      {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                              <>
                                {renderDetailRow('Instructions', paymentDetails.message)}
                                {renderDetailRow('Contact Phone', paymentDetails.contact_phone)}
                                {renderDetailRow('Support Email', paymentDetails.contact_email)}
                              </>
                      )}

                      {paymentMethod === 'cash' && (
                              <>
                                {renderDetailRow('Instructions', paymentDetails.message)}
                                {renderDetailRow('Office Address', paymentDetails.office_address)}
                                {renderDetailRow('Contact Phone', paymentDetails.contact_phone)}
                              </>
                            )}
                          </div>
                    </div>
                  )}

                  <div>
                        <label className="block text-[10px] font-medium text-slate-300 mb-1">
                          Receipt/Transaction Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Enter your receipt or transaction reference number"
                          className="w-full px-2 py-1.5 text-xs border border-white/20 rounded-lg bg-[#07142a]/90 text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                        <p className="text-[10px] text-slate-400 mt-0.5">
                      This will be used by the admin to verify your payment
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handlePaymentSubmit}
                          disabled={submittingPayment || !paymentReference}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submittingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Submit Payment Details
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowPaymentForm(false)}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                    >
                      Later
                    </button>
                  </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      Select a payment method to view instructions and enter your receipt number.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {visits.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-12 text-center">
            <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 mx-auto mb-1 sm:mb-2" />
            <h3 className="text-xs sm:text-sm font-semibold text-white mb-0.5 sm:mb-1">No Visits Yet</h3>
            <p className="text-slate-300 text-[10px] sm:text-xs">
              Your subscription visits will appear here once scheduled
            </p>
          </div>
        ) : (
          <div className="grid gap-1.5 sm:gap-2">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className="glass-card border border-white/10 rounded-xl p-1.5 sm:p-2 md:p-2.5 hover:border-sky-400/50 transition-all"
              >
                <div className="flex items-start justify-between mb-1 sm:mb-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                    <div className="shrink-0">{getStatusIcon(visit.status)}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[10px] sm:text-xs font-semibold text-white">
                        Visit #{visit.visit_number}
                      </h3>
                      <span className={`inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-medium mt-0.5 ${getStatusColor(visit.status)}`}>
                        {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedVisit(visit);
                        setInspections(visit.inspections || []);
                        setShowReportModal(true);
                      }}
                      className="p-1 sm:p-1.5 text-sky-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <button
                      onClick={() => downloadReport(visit)}
                      className="p-1.5 text-orange-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Download Report"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-1 sm:gap-1.5 mb-1 sm:mb-2 text-[9px] sm:text-[10px] text-slate-300">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                    <span className="truncate">
                      Scheduled: {new Date(visit.scheduled_date).toLocaleDateString()}
                    </span>
                  </div>
                  {visit.completed_at && (
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span className="truncate">
                        Completed: {new Date(visit.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {visit.duration_minutes && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        Duration: {visit.duration_minutes} min
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-1.5">
                  <p className="text-[10px] text-slate-300 truncate">
                    <strong>Tech:</strong> {visit.technician.full_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReportModal && selectedVisit && (() => {
        const parsedFindings = parseFindings(selectedVisit.findings || null);
        return (
          <div className="fixed inset-0 bg-gradient-to-br from-[#031735]/90 via-[#020f25]/90 to-[#010814]/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="relative glass-card rounded-xl border border-sky-400/30 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-sky-900/50">
              <div className="sticky top-0 bg-gradient-to-r from-sky-800/90 to-blue-900/90 backdrop-blur-xl border-b border-sky-700/50 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
                <h2 className="text-2xl font-bold text-white">Visit #{selectedVisit.visit_number} - Details</h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setSelectedVisit(null);
                  setVisitReport(null);
                  setInspections([]);
                }}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

              <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sky-200 mb-1">Visit #{selectedVisit.visit_number}</p>
                    <h2 className="text-2xl font-bold text-white">
                      {profile?.full_name || 'Customer'}
                    </h2>
                    <p className="text-xs text-slate-200 mt-1">
                      Technician: {selectedVisit.technician.full_name} ({selectedVisit.technician.email})
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(selectedVisit.status)}`}>
                      {selectedVisit.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <p className="text-[11px] text-slate-200">
                      {selectedVisit.completed_at ? `Completed: ${new Date(selectedVisit.completed_at).toLocaleString()}` : 'Not completed'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard title="Technician" value={selectedVisit.technician.full_name} subtitle={selectedVisit.technician.email} />
                  {selectedVisit.location && <InfoCard title="Location" value={selectedVisit.location} />}
                  {selectedVisit.scheduled_date && <InfoCard title="Scheduled" value={new Date(selectedVisit.scheduled_date).toLocaleDateString()} />}
                  {selectedVisit.started_at && <InfoCard title="Started At" value={new Date(selectedVisit.started_at).toLocaleString()} />}
                  {selectedVisit.completed_at && <InfoCard title="Completed At" value={new Date(selectedVisit.completed_at).toLocaleString()} />}
                  {selectedVisit.duration_minutes && <InfoCard title="Duration" value={`${selectedVisit.duration_minutes} minutes`} />}
                    </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {selectedVisit.work_performed && <SectionCard title="Work Performed" body={selectedVisit.work_performed} titleColor="text-emerald-300" />}
                  {selectedVisit.recommendations && <SectionCard title="Recommendations" body={selectedVisit.recommendations} titleColor="text-orange-300" />}
                  </div>

                {parsedFindings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-[0.2em]">Findings</h3>
                    <div className="rounded-2xl border border-amber-400/30 bg-white/5 max-h-80 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                      {parsedFindings.map((finding, idx) => {
                        const styles = getFindingStyles(finding.status);
                        return (
                          <div key={`${finding.label}-${idx}`} className={`rounded-lg px-3 py-2 border ${styles.card} flex flex-col gap-1`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">{finding.label}</p>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${styles.badge}`}>
                                {finding.status}
                              </span>
                    </div>
                            {finding.needed && (
                              <p className="text-xs text-slate-300">
                                Needed: <span className="text-white">{finding.needed}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedVisit.report && (
                  <SectionCard title="Full Technician Report" body={selectedVisit.report} titleColor="text-sky-300" />
                )}

                {selectedVisit.parts_used && selectedVisit.parts_used.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-[0.2em]">Parts Used</h3>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                        {selectedVisit.parts_used.map((part: any, idx: number) => (
                        <div key={idx} className="flex items-start justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">{part.name || part.part_name || 'Unknown Part'}</p>
                            <p className="text-xs text-slate-300 mt-1">
                                Quantity: {part.quantity || 1}
                                {part.cost && <span> • Cost: ${part.cost}</span>}
                              </p>
                            </div>
                        </div>
                        ))}
                    </div>
                  </div>
                )}

                {inspections.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-sky-100 uppercase tracking-[0.2em] flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Detailed Inspection Checklist
                    </h3>
                    <div className="space-y-2">
                        {inspections.reduce((acc: any[], inspection) => {
                          const categoryGroup = acc.find(g => g.category === inspection.category);
                          if (categoryGroup) {
                            categoryGroup.items.push(inspection);
                          } else {
                            acc.push({ category: inspection.category, items: [inspection] });
                          }
                          return acc;
                        }, []).map((group, idx) => (
                        <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                          <h4 className="text-sm font-semibold text-white mb-2">{group.category}</h4>
                            <div className="space-y-2">
                              {group.items.map((inspection: InspectionItem) => (
                              <div
                                key={inspection.id}
                                className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-start justify-between gap-3"
                              >
                                  <div className="flex-1">
                                  <p className="font-semibold text-white">{inspection.item}</p>
                                  {inspection.notes && <p className="text-xs text-slate-200 mt-1">{inspection.notes}</p>}
                                  </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getInspectionColor(inspection.status)}`}>
                                    {inspection.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-gradient-to-r from-sky-800/90 to-blue-900/90 backdrop-blur-xl border-t border-sky-700/50 px-6 py-4 flex gap-3 rounded-b-xl z-10">
                <button
                  onClick={() => downloadReport(selectedVisit)}
                  className="flex-1 px-4 py-2 bg-gradient-to-br from-sky-600 to-blue-700 text-white rounded-lg hover:from-sky-700 hover:to-blue-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-900/40"
                >
                  <Download className="w-5 h-5" />
                  Download Report
                </button>
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setSelectedVisit(null);
                    setVisitReport(null);
                    setInspections([]);
                  }}
                  className="flex-1 px-4 py-2 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
