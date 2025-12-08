import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, FileText, Calendar, Wrench, CheckCircle, Clock, User, Car, MapPin, Download } from 'lucide-react';
import type { Database } from '../lib/database.types';

type ServiceRecord = Database['public']['Tables']['service_records']['Row'] & {
  customer: { full_name: string; email: string } | null;
  ticket: { id: string; title: string } | null;
};

type SubscriptionVisit = Database['public']['Tables']['subscription_visits']['Row'] & {
  subscription: {
    user: { full_name: string; email: string } | null;
    plan: { plan_name: string } | null;
  } | null;
};

export default function TechnicianServiceHistoryPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'tickets' | 'subscriptions'>('tickets');
  const [ticketRecords, setTicketRecords] = useState<ServiceRecord[]>([]);
  const [subscriptionVisits, setSubscriptionVisits] = useState<SubscriptionVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<SubscriptionVisit | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    
    loadData();

    // Set up real-time subscriptions
    const ticketChannel = supabase
      .channel('technician-ticket-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_records',
          filter: `technician_id=eq.${profile.id}`
        },
        () => {
          loadTicketHistory();
        }
      )
      .subscribe();

    const visitChannel = supabase
      .channel('technician-visit-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_visits',
          filter: `technician_id=eq.${profile.id}`
        },
        () => {
          loadSubscriptionHistory();
        }
      )
      .subscribe();

    // Periodic refresh as backup
    const interval = setInterval(() => {
      loadData();
    }, 10000);

    return () => {
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(visitChannel);
      clearInterval(interval);
    };
  }, [profile?.id]);

  const loadData = async () => {
    await Promise.all([loadTicketHistory(), loadSubscriptionHistory()]);
  };

  const loadTicketHistory = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('service_records')
        .select(`
          *,
          customer:customer_id (
            full_name,
            email
          ),
          ticket:ticket_id (
            id,
            title
          )
        `)
        .eq('technician_id', profile.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setTicketRecords(data || []);
    } catch (error) {
      console.error('Error loading ticket history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionHistory = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('subscription_visits')
        .select(`
          *,
          subscription:subscription_id (
            user:user_id (
              full_name,
              email
            ),
            plan:plan_id (
              plan_name
            )
          )
        `)
        .eq('technician_id', profile.id)
        .in('status', ['confirmed', 'pending_confirmation'])
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setSubscriptionVisits(data || []);
    } catch (error) {
      console.error('Error loading subscription history:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'resolved':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      case 'pending_confirmation':
        return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  };

  return (
    <div className="min-h-screen page-shell theme-surface">
      <header className="glass-card border-b border-white/10 px-3 py-2 shadow-[0_20px_60px_rgba(1,6,15,0.6)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white">Service History</h1>
              <p className="text-[10px] text-slate-300">Ticket & subscription service records</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-2 sm:p-3">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'tickets'
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ticket Services ({ticketRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'subscriptions'
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Subscription Visits ({subscriptionVisits.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="relative mx-auto w-12 h-12">
              <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
              <div className="relative w-full h-full border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-slate-300">Loading service history...</p>
          </div>
        ) : activeTab === 'tickets' ? (
          ticketRecords.length === 0 ? (
            <div className="text-center py-12 glass-card">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Ticket Services</h3>
              <p className="text-slate-300">Your completed ticket services will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {ticketRecords.map((record) => (
                <div
                  key={record.id}
                  className="glass-card p-4 border border-white/10 hover:border-sky-400/50 transition-all cursor-pointer"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm mb-1">
                        {record.vehicle_year} {record.vehicle_make} {record.vehicle_model}
                      </h3>
                      <p className="text-xs text-slate-300 mb-2">{record.service_category.replace('_', ' ').toUpperCase()}</p>
                      {record.customer && (
                        <div className="flex items-center text-xs text-slate-200 mb-1">
                          <User className="w-3 h-3 mr-1.5 shrink-0" />
                          <span className="truncate">{record.customer.full_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-lg font-bold text-orange-300">${parseFloat(record.total_cost?.toString() || '0').toFixed(2)}</p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor('resolved')}`}>
                        Completed
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-200">
                    <div className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-2 shrink-0" />
                      <span>{new Date(record.completed_at || '').toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <FileText className="w-3.5 h-3.5 mr-2 shrink-0" />
                      <span className="line-clamp-1">{record.problem_description}</span>
                    </div>
                    {record.ticket && (
                      <div className="flex items-center">
                        <FileText className="w-3.5 h-3.5 mr-2 shrink-0" />
                        <span className="truncate">Ticket: {record.ticket.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          subscriptionVisits.length === 0 ? (
            <div className="text-center py-12 glass-card">
              <CheckCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Subscription Visits</h3>
              <p className="text-slate-300">Your completed subscription visits will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {subscriptionVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="glass-card p-4 border border-white/10 hover:border-sky-400/50 transition-all cursor-pointer"
                  onClick={() => setSelectedVisit(visit)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm mb-1">
                        Visit #{visit.visit_number} - {visit.subscription?.plan?.plan_name || 'Subscription'}
                      </h3>
                      {visit.subscription?.user && (
                        <div className="flex items-center text-xs text-slate-200 mb-1">
                          <User className="w-3 h-3 mr-1.5 shrink-0" />
                          <span className="truncate">{visit.subscription.user.full_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(visit.status || '')}`}>
                        {visit.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-200">
                    {visit.completed_at && (
                      <div className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-2 shrink-0" />
                        <span>{new Date(visit.completed_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    {visit.location && (
                      <div className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-2 shrink-0" />
                        <span className="truncate">{visit.location}</span>
                      </div>
                    )}
                    {visit.duration_minutes && (
                      <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-2 shrink-0" />
                        <span>{visit.duration_minutes} minutes</span>
                      </div>
                    )}
                    {visit.findings && (
                      <div className="flex items-start">
                        <FileText className="w-3.5 h-3.5 mr-2 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{visit.findings}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Ticket Record Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-card max-w-2xl w-full my-4 max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b border-white/10 sticky top-0 bg-[#050f24]/90 backdrop-blur-xl rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Service Details</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-slate-300 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-white mb-2">Vehicle Information</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1 text-sm text-slate-200">
                  <p><span className="font-medium">Make:</span> {selectedRecord.vehicle_make}</p>
                  <p><span className="font-medium">Model:</span> {selectedRecord.vehicle_model}</p>
                  <p><span className="font-medium">Year:</span> {selectedRecord.vehicle_year}</p>
                  {selectedRecord.vehicle_vin && (
                    <p><span className="font-medium">VIN:</span> {selectedRecord.vehicle_vin}</p>
                  )}
                </div>
              </div>

              {selectedRecord.customer && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Customer</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                    <p><span className="font-medium">Name:</span> {selectedRecord.customer.full_name}</p>
                    <p><span className="font-medium">Email:</span> {selectedRecord.customer.email}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-white mb-2">Service Information</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1 text-sm text-slate-200">
                  <p><span className="font-medium">Type:</span> {selectedRecord.service_type}</p>
                  <p><span className="font-medium">Category:</span> {selectedRecord.service_category.replace('_', ' ')}</p>
                  <p><span className="font-medium">Completed:</span> {new Date(selectedRecord.completed_at || '').toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-2">Problem & Diagnosis</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                  <p className="mb-2"><span className="font-medium">Problem:</span> {selectedRecord.problem_description}</p>
                  {selectedRecord.diagnosis && (
                    <p><span className="font-medium">Diagnosis:</span> {selectedRecord.diagnosis}</p>
                  )}
                </div>
              </div>

              {selectedRecord.work_performed && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Work Performed</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                    <p>{selectedRecord.work_performed}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-white mb-2">Cost Breakdown</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1 text-sm text-slate-200">
                  <div className="flex justify-between">
                    <span>Labor ({selectedRecord.labor_hours}h)</span>
                    <span className="font-medium">${parseFloat(selectedRecord.labor_cost?.toString() || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parts</span>
                    <span className="font-medium">${parseFloat(selectedRecord.parts_cost?.toString() || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 text-base font-bold">
                    <span>Total</span>
                    <span className="text-orange-300">${parseFloat(selectedRecord.total_cost?.toString() || '0').toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Visit Detail Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-card max-w-2xl w-full my-4 max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b border-white/10 sticky top-0 bg-[#050f24]/90 backdrop-blur-xl rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Visit Details</h2>
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="text-slate-300 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-white mb-2">Visit Information</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1 text-sm text-slate-200">
                  <p><span className="font-medium">Visit Number:</span> #{selectedVisit.visit_number}</p>
                  <p><span className="font-medium">Plan:</span> {selectedVisit.subscription?.plan?.plan_name || 'N/A'}</p>
                  <p><span className="font-medium">Status:</span> {selectedVisit.status?.replace('_', ' ').toUpperCase()}</p>
                  {selectedVisit.completed_at && (
                    <p><span className="font-medium">Completed:</span> {new Date(selectedVisit.completed_at).toLocaleString()}</p>
                  )}
                  {selectedVisit.duration_minutes && (
                    <p><span className="font-medium">Duration:</span> {selectedVisit.duration_minutes} minutes</p>
                  )}
                  {selectedVisit.location && (
                    <p><span className="font-medium">Location:</span> {selectedVisit.location}</p>
                  )}
                </div>
              </div>

              {selectedVisit.subscription?.user && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Customer</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                    <p><span className="font-medium">Name:</span> {selectedVisit.subscription.user.full_name}</p>
                    <p><span className="font-medium">Email:</span> {selectedVisit.subscription.user.email}</p>
                  </div>
                </div>
              )}

              {selectedVisit.findings && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Findings</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                    <p>{selectedVisit.findings}</p>
                  </div>
                </div>
              )}

              {selectedVisit.work_performed && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Work Performed</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                    <p>{selectedVisit.work_performed}</p>
                  </div>
                </div>
              )}

              {selectedVisit.recommendations && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Recommendations</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                    <p>{selectedVisit.recommendations}</p>
                  </div>
                </div>
              )}

              {selectedVisit.report && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Report</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-200">
                    <p>{selectedVisit.report}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

