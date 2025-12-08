import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, FileText, Download, Calendar, DollarSign, Wrench, AlertCircle } from 'lucide-react';

interface ServiceRecord {
  id: string;
  ticket_id: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_vin: string | null;
  service_type: string;
  service_category: string;
  problem_description: string;
  diagnosis: string | null;
  work_performed: string | null;
  parts_used: any;
  labor_hours: number;
  parts_cost: number;
  labor_cost: number;
  total_cost: number;
  warranty_until: string | null;
  next_service_due: string | null;
  next_service_mileage: number | null;
  completed_at: string;
  technician: {
    full_name: string;
  } | null;
}

export default function ServiceHistoryPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    
    loadServiceHistory();

    // Set up real-time subscription for service records
    const channel = supabase
      .channel(`customer-service-history-${profile.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_records',
          filter: `customer_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('🔔 Service record updated in customer history:', payload);
          loadServiceHistory();
        }
      )
      .subscribe((status) => {
        console.log('Customer service history subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to customer service history updates');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Service history subscription issue, retrying...', status);
          setTimeout(() => {
            channel.subscribe();
          }, 2000);
        }
      });

    // Also refresh periodically (every 10 seconds) as backup
    const interval = setInterval(() => {
      console.log('🔄 Periodic refresh of service history');
      loadServiceHistory();
    }, 10000);

    return () => {
      console.log('Cleaning up customer service history subscription');
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile?.id]);

  const loadServiceHistory = async () => {
    if (!profile?.id) return;
    
    try {
      // Only show loading spinner on initial load, not on refreshes
      if (!hasLoadedOnce) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('service_records')
        .select(`
          *,
          technician:technician_id (
            full_name
          )
        `)
        .eq('customer_id', profile.id)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error loading service history:', error);
        throw error;
      }

      console.log(`✅ Loaded ${data?.length || 0} service records for customer`);
      setRecords(data || []);
      const total = (data || []).reduce((sum: number, record: any) => sum + parseFloat(record.total_cost || 0), 0);
      setTotalSpent(total);
    } catch (error) {
      console.error('Error loading service history:', error);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  };

  return (
    <div className="page-shell theme-surface">
      <header className="glass-card border border-white/10 px-2 sm:px-3 py-1 sm:py-2 shadow-[0_20px_60px_rgba(1,6,15,0.6)]">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 sm:p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            <div>
              <h1 className="text-xs sm:text-sm md:text-base font-bold text-white">Service History</h1>
              <p className="text-[8px] sm:text-[10px] text-slate-300">Complete record of all services</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] sm:text-[10px] text-slate-300">Total Spent</p>
            <p className="text-sm sm:text-base md:text-lg font-bold text-orange-300">${totalSpent.toFixed(2)}</p>
          </div>
        </div>
      </header>

      <div className="p-1.5 sm:p-2 md:p-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="relative mx-auto w-8 h-8">
              <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
              <div className="relative w-full h-full border-2 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-2 text-slate-300 text-xs">Loading service history...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 glass-card">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">No Service History</h3>
            <p className="text-slate-300 text-xs">Your completed services will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 sm:gap-2">
            {records.map((record) => (
              <div
                key={record.id}
                className="glass-card p-1.5 sm:p-2 md:p-2.5 border border-white/10 hover:border-sky-400/50 transition-all cursor-pointer"
                onClick={() => setSelectedRecord(record)}
              >
                <div className="flex items-start justify-between mb-1 sm:mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-[10px] sm:text-xs mb-0.5 line-clamp-1">
                      {record.vehicle_year} {record.vehicle_make} {record.vehicle_model}
                    </h3>
                    <p className="text-[8px] sm:text-[10px] text-slate-300">{record.service_category.replace('_', ' ').toUpperCase()}</p>
                  </div>
                  <div className="text-right shrink-0 ml-1 sm:ml-2">
                    <p className="text-sm sm:text-base font-bold text-orange-300">${record.total_cost.toFixed(2)}</p>
                  </div>
                </div>

                <div className="space-y-0.5 sm:space-y-1 text-[9px] sm:text-[10px] text-slate-200">
                  <div className="flex items-center">
                    <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 shrink-0" />
                    <span className="truncate">{new Date(record.completed_at).toLocaleDateString()}</span>
                  </div>
                  {record.technician && (
                    <div className="flex items-center">
                      <Wrench className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 shrink-0" />
                      <span className="truncate">Tech: {record.technician.full_name}</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 shrink-0" />
                    <span className="line-clamp-1">{record.problem_description.slice(0, 60)}...</span>
                  </div>
                </div>

                {record.warranty_until && new Date(record.warranty_until) > new Date() && (
                  <div className="mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-white/10">
                    <div className="flex items-center text-emerald-300 text-[9px] sm:text-[10px]">
                      <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 shrink-0" />
                      <span className="truncate">Warranty until {new Date(record.warranty_until).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}

                {record.next_service_due && (
                  <div className="mt-0.5 sm:mt-1">
                    <div className="flex items-center text-orange-300 text-[9px] sm:text-[10px]">
                      <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 shrink-0" />
                      <span className="truncate">Next: {new Date(record.next_service_due).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-1 sm:p-2 overflow-y-auto">
          <div className="glass-card max-w-2xl w-full my-2 sm:my-4 max-h-[95vh] overflow-y-auto">
            <div className="p-2 sm:p-3 border-b border-white/10 sticky top-0 bg-[#050f24]/90 backdrop-blur-xl rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-white">Service Details</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-slate-300 hover:text-white text-base sm:text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
              <div>
                <h3 className="font-semibold text-white mb-0.5 sm:mb-1 text-[10px] sm:text-xs">Vehicle Information</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 sm:p-2 space-y-0.5 sm:space-y-1 text-[9px] sm:text-[10px] text-slate-200">
                  <p><span className="font-medium">Make:</span> {selectedRecord.vehicle_make}</p>
                  <p><span className="font-medium">Model:</span> {selectedRecord.vehicle_model}</p>
                  <p><span className="font-medium">Year:</span> {selectedRecord.vehicle_year}</p>
                  {selectedRecord.vehicle_vin && (
                    <p className="truncate"><span className="font-medium">VIN:</span> {selectedRecord.vehicle_vin}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-1 text-xs">Service Information</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 space-y-1 text-[10px] text-slate-200">
                  <p><span className="font-medium">Type:</span> {selectedRecord.service_type}</p>
                  <p><span className="font-medium">Category:</span> {selectedRecord.service_category.replace('_', ' ')}</p>
                  <p><span className="font-medium">Completed:</span> {new Date(selectedRecord.completed_at).toLocaleString()}</p>
                  {selectedRecord.technician && (
                    <p><span className="font-medium">Technician:</span> {selectedRecord.technician.full_name}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-1 text-xs">Problem & Diagnosis</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-slate-200">
                  <p className="mb-1"><span className="font-medium">Problem:</span> {selectedRecord.problem_description}</p>
                  {selectedRecord.diagnosis && (
                    <p><span className="font-medium">Diagnosis:</span> {selectedRecord.diagnosis}</p>
                  )}
                </div>
              </div>

              {selectedRecord.work_performed && (
                <div>
                  <h3 className="font-semibold text-white mb-1 text-xs">Work Performed</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-slate-200">
                    <p>{selectedRecord.work_performed}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-white mb-1 text-xs">Cost Breakdown</h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 space-y-1 text-[10px] text-slate-200">
                  <div className="flex justify-between">
                    <span>Labor ({selectedRecord.labor_hours}h)</span>
                    <span className="font-medium">${selectedRecord.labor_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parts</span>
                    <span className="font-medium">${selectedRecord.parts_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/10 text-xs font-bold">
                    <span>Total</span>
                    <span className="text-orange-300">${selectedRecord.total_cost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedRecord.warranty_until && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                  <p className="text-[10px] text-emerald-300">
                    <strong>Warranty:</strong> Valid until {new Date(selectedRecord.warranty_until).toLocaleDateString()}
                  </p>
                </div>
              )}

              {selectedRecord.next_service_due && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                  <p className="text-[10px] text-orange-300">
                    <strong>Next Service:</strong> {new Date(selectedRecord.next_service_due).toLocaleDateString()}
                    {selectedRecord.next_service_mileage && ` or ${selectedRecord.next_service_mileage}mi`}
                  </p>
                </div>
              )}

              <button
                onClick={() => window.print()}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}