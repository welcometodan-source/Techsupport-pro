import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Wrench,
  LogOut,
  Settings,
  UserPlus,
  DollarSign,
  Timer,
  Clock,
  UserCheck,
  ArrowLeft
} from 'lucide-react';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];

type TechnicianStats = {
  technician_id: string;
  technician_name: string;
  total_resolved: number;
  avg_resolution_minutes: number;
};

export default function AdminManagement() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [technicianStats, setTechnicianStats] = useState<TechnicianStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTechnician, setShowAddTechnician] = useState(false);

  useEffect(() => {
    loadData();
    loadTechnicianStats();

    // Subscribe to payment changes
    const paymentsChannel = supabase
      .channel('payments-changes')
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

    return () => {
      supabase.removeChannel(paymentsChannel);
    };
  }, []);

  const loadData = async () => {
    try {
      const [profilesRes, paymentsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'technician').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('payment_status', 'completed').order('created_at', { ascending: false }).limit(20)
      ]);

      if (profilesRes.data) {
        const approvedTechs = profilesRes.data.filter(p => (p as any).technician_status === 'approved');
        setTechnicians(approvedTechs);
      }

      if (paymentsRes.data) {
        setRecentPayments(paymentsRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicianStats = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          assigned_technician_id,
          created_at,
          resolved_at,
          assigned_technician:profiles!support_tickets_assigned_technician_id_fkey(full_name)
        `)
        .eq('status', 'resolved')
        .not('assigned_technician_id', 'is', null)
        .not('resolved_at', 'is', null);

      if (error) throw error;

      const statsMap = new Map<string, { name: string; times: number[]; count: number }>();

      data?.forEach((ticket: any) => {
        if (ticket.assigned_technician_id && ticket.resolved_at) {
          const resolutionMinutes = Math.round(
            (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60)
          );

          if (!statsMap.has(ticket.assigned_technician_id)) {
            statsMap.set(ticket.assigned_technician_id, {
              name: ticket.assigned_technician?.full_name || 'Unknown',
              times: [],
              count: 0
            });
          }

          const stat = statsMap.get(ticket.assigned_technician_id)!;
          stat.times.push(resolutionMinutes);
          stat.count++;
        }
      });

      const stats: TechnicianStats[] = Array.from(statsMap.entries()).map(([id, data]) => ({
        technician_id: id,
        technician_name: data.name,
        total_resolved: data.count,
        avg_resolution_minutes: Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length)
      }));

      setTechnicianStats(stats.sort((a, b) => b.total_resolved - a.total_resolved));
    } catch (error) {
      console.error('Error loading technician stats:', error);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-12 h-12 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-200 text-sm">Loading management data...</p>
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
              <button
                onClick={() => navigate('/admin')}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">Admin</p>
                <h1 className="text-white text-lg font-bold">Technician Management</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/admin/settings')}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-slate-200">
                <span className="font-medium">{profile?.full_name}</span>
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
        <div className="grid lg:grid-cols-2 gap-3 mb-3">
          <div className="glass-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Technicians</h2>
              </div>
              <button
                onClick={() => setShowAddTechnician(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors"
              >
                + Add
              </button>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {technicians.map((tech) => (
                <div
                  key={tech.id}
                  className="flex items-center justify-between border border-slate-700 rounded-lg p-2 hover:border-slate-600 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white text-xs truncate">{tech.full_name}</h3>
                    <p className="text-[10px] text-slate-400 truncate">{tech.phone || 'No phone'}</p>
                  </div>
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-medium ml-2 shrink-0">
                    Tech
                  </span>
                </div>
              ))}
              {technicians.length === 0 && (
                <p className="text-slate-500 text-center py-4 text-xs">No technicians yet</p>
              )}
            </div>
          </div>

          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Performance</h2>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {technicianStats.map((stat) => (
                <div
                  key={stat.technician_id}
                  className="border border-slate-700 rounded-lg p-2 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-white text-xs truncate">{stat.technician_name}</h3>
                    <span className="text-[10px] text-emerald-300 font-medium bg-emerald-500/20 px-1.5 py-0.5 rounded">
                      {stat.total_resolved} resolved
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-400">Avg: </span>
                    <span className="text-[10px] text-white font-medium">{formatDuration(stat.avg_resolution_minutes)}</span>
                  </div>
                </div>
              ))}
              {technicianStats.length === 0 && (
                <p className="text-slate-500 text-center py-4 text-xs">No performance data yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Recent Payments</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-1 px-2 text-slate-400 font-semibold text-[10px]">Amount</th>
                  <th className="text-left py-1 px-2 text-slate-400 font-semibold text-[10px]">Status</th>
                  <th className="text-left py-1 px-2 text-slate-400 font-semibold text-[10px]">Method</th>
                  <th className="text-left py-1 px-2 text-slate-400 font-semibold text-[10px]">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-1 px-2 text-white font-semibold text-xs">
                      ${Number(payment.amount).toFixed(2)}
                    </td>
                    <td className="py-1 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        payment.payment_status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                        payment.payment_status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {payment.payment_status}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-slate-400 text-[10px]">
                      {payment.payment_method || 'N/A'}
                    </td>
                    <td className="py-1 px-2 text-slate-400 text-[10px]">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentPayments.length === 0 && (
              <p className="text-slate-500 text-center py-4 text-xs">No payments yet</p>
            )}
          </div>
        </div>
      </div>

      {showAddTechnician && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl border border-white/10 max-w-md w-full p-4">
            <h2 className="text-lg font-bold text-white mb-2">Add Technician</h2>
            <p className="text-slate-300 text-sm mb-3">
              To add a technician, have them sign up first as a customer, then use the "→ Tech" button in the admin dashboard customers table to promote them.
            </p>
            <button
              onClick={() => setShowAddTechnician(false)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
