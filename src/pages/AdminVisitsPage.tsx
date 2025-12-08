import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  FileText,
  AlertCircle,
  UserPlus,
  Eye,
  Download,
  Image as ImageIcon
} from 'lucide-react';

interface Visit {
  id: string;
  visit_number: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  report: string | null;
  findings: string | null;
  recommendations: string | null;
  work_performed: string | null;
  location: string | null;
  duration_minutes: number | null;
  technician: {
    full_name: string;
    email: string;
  };
  subscription: {
    id: string;
    vehicle_count: number;
    user: {
      full_name: string;
      email: string;
    };
    plan: {
      plan_name: string;
    };
  };
  inspections?: Array<{
    category: string;
    item: string;
    status: string;
    notes: string;
  }>;
  photos?: Array<{
    id: string;
    photo_url: string;
    caption: string;
    category: string;
    uploaded_at: string;
  }>;
  parts_used?: any[];
  scheduled_date?: string;
}

interface Subscription {
  id: string;
  vehicle_count: number;
  status: string;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  plan: {
    plan_name: string;
    visits_per_month: number;
  };
}

interface Technician {
  id: string;
  full_name: string;
  email: string;
  status: string;
}

export default function AdminVisitsPage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [visitPhotos, setVisitPhotos] = useState<Array<{ id: string; photo_url: string; caption: string; category: string; uploaded_at: string }>>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load visits
      let visitQuery = supabase
        .from('subscription_visits')
        .select(`
          *,
          technician:profiles!subscription_visits_technician_id_fkey(full_name, email),
          subscription:customer_subscriptions(
            id,
            vehicle_count,
            user:profiles!customer_subscriptions_user_id_fkey(full_name, email),
            plan:subscription_plans(plan_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        visitQuery = visitQuery.eq('status', filterStatus);
      }

      const { data: visitsData, error: visitsError } = await visitQuery;
      if (visitsError) throw visitsError;

      // Load subscriptions for assignment
      const { data: subsData, error: subsError } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          vehicle_count,
          status,
          user:profiles!customer_subscriptions_user_id_fkey(id, full_name, email),
          plan:subscription_plans(plan_name, visits_per_month)
        `)
        .eq('status', 'active');

      if (subsError) throw subsError;

      // Load technicians
      const { data: techData, error: techError } = await supabase
        .from('profiles')
        .select('id, full_name, email, status')
        .eq('role', 'technician')
        .eq('status', 'active');

      if (techError) throw techError;

      setVisits(visitsData as any || []);
      setSubscriptions(subsData as any || []);
      setTechnicians(techData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignTechnician = async () => {
    if (!selectedSubscription || !selectedTechnician) {
      alert('Please select both a subscription and a technician');
      return;
    }

    try {
      const { error } = await supabase
        .from('subscription_assignments')
        .insert({
          subscription_id: selectedSubscription,
          technician_id: selectedTechnician,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          notes: assignmentNotes,
          status: 'active'
        });

      if (error) throw error;

      alert('Technician assigned successfully!');
      setShowAssignModal(false);
      setSelectedSubscription('');
      setSelectedTechnician('');
      setAssignmentNotes('');
      loadData();
    } catch (error: any) {
      console.error('Error assigning technician:', error);
      alert('Error assigning technician: ' + error.message);
    }
  };

  const confirmVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('subscription_visits')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', visitId);

      if (error) throw error;

      alert('Visit confirmed successfully!');
      loadData();
      setSelectedVisit(null);
    } catch (error: any) {
      console.error('Error confirming visit:', error);
      alert('Error confirming visit: ' + error.message);
    }
  };

  const rejectVisit = async (visitId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('subscription_visits')
        .update({
          status: 'rejected',
          rejection_reason: reason
        })
        .eq('id', visitId);

      if (error) throw error;

      alert('Visit rejected.');
      loadData();
      setSelectedVisit(null);
    } catch (error: any) {
      console.error('Error rejecting visit:', error);
      alert('Error rejecting visit: ' + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-100';
      case 'pending_confirmation': return 'text-yellow-600 bg-yellow-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getInspectionColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'needs_attention': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const downloadReport = async (visit: Visit) => {
    const partsUsedText = visit.parts_used && visit.parts_used.length > 0
      ? visit.parts_used.map((part: any, idx: number) => `  ${idx + 1}. ${part.name || part.part_name || 'Unknown'} - Qty: ${part.quantity || 1}${part.cost ? ` - Cost: $${part.cost}` : ''}`).join('\n')
      : 'No parts used';

    const inspectionsText = visit.inspections && visit.inspections.length > 0
      ? visit.inspections.map((inspection: any, idx: number) =>
          `  ${idx + 1}. ${inspection.category} - ${inspection.item}: ${inspection.status.toUpperCase()}${inspection.notes ? `\n     Notes: ${inspection.notes}` : ''}`
        ).join('\n')
      : 'No inspection data available';

    const photosText = visit.photos && visit.photos.length > 0
      ? visit.photos.map((photo: any, idx: number) => `  ${idx + 1}. ${photo.caption || 'Photo'} - ${photo.photo_url}\n     Category: ${photo.category || 'general'}`).join('\n')
      : 'No photos uploaded';

    const reportContent = `
SUBSCRIPTION VISIT REPORT
========================

Visit #${visit.visit_number}
Scheduled Date: ${visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleDateString() : 'Not scheduled'}
Status: ${visit.status.toUpperCase()}
${visit.started_at ? `Started: ${new Date(visit.started_at).toLocaleString()}` : ''}
${visit.completed_at ? `Completed: ${new Date(visit.completed_at).toLocaleString()}` : ''}
${visit.confirmed_at ? `Confirmed: ${new Date(visit.confirmed_at).toLocaleString()}` : ''}
${visit.duration_minutes ? `Duration: ${visit.duration_minutes} minutes` : ''}
${visit.location ? `Location: ${visit.location}` : ''}

Customer: ${(visit.subscription as any).user.full_name}
Email: ${(visit.subscription as any).user.email}
Plan: ${(visit.subscription as any).plan.plan_name}

Technician: ${(visit.technician as any).full_name}
Email: ${(visit.technician as any).email}

--- TECHNICIAN REPORT ---

${visit.report || 'No report provided'}

--- FINDINGS ---

${visit.findings || 'No findings recorded'}

--- WORK PERFORMED ---

${visit.work_performed || 'No work details provided'}

--- PARTS USED ---

${partsUsedText}

--- RECOMMENDATIONS ---

${visit.recommendations || 'No recommendations provided'}

--- INSPECTION RESULTS ---

${inspectionsText}

--- EVIDENCE PHOTOS & VIDEOS ---

${photosText}

========================
Generated: ${new Date().toLocaleString()}
    `.trim();

    const fileName = `visit-${visit.visit_number}-report-${Date.now()}.txt`;

    try {
      // Detect if we're on mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const anyWindow = window as any;
      const isNative = !!anyWindow?.Capacitor?.isNativePlatform;

      // For mobile devices, use a more reliable approach
      if (isMobile || isNative) {
        // Method 1: Open in new window with data URL (most reliable for mobile)
        const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(reportContent);
        const newWindow = window.open(dataUrl, '_blank');
        
        if (newWindow) {
          // Wait a moment then try to trigger download
          setTimeout(() => {
            try {
              // Try to create download link in the new window
              const downloadLink = newWindow.document.createElement('a');
              downloadLink.href = dataUrl;
              downloadLink.download = fileName;
              downloadLink.style.display = 'none';
              newWindow.document.body.appendChild(downloadLink);
              downloadLink.click();
              newWindow.document.body.removeChild(downloadLink);
            } catch (e) {
              // If that fails, at least the window is open with the content
              console.log('Download trigger failed, but content is visible');
            }
          }, 500);
        } else {
          // Popup blocked - show modal with copy option
          const modal = document.createElement('div');
          modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
          modal.innerHTML = `
            <div style="background:white;border-radius:10px;padding:20px;max-width:90%;max-height:80%;overflow:auto;">
              <h3 style="margin-top:0;">Visit Report</h3>
              <textarea readonly style="width:100%;height:300px;font-family:monospace;padding:10px;border:1px solid #ccc;border-radius:5px;">${reportContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
              <div style="margin-top:15px;display:flex;gap:10px;">
                <button id="copyBtn" style="flex:1;padding:10px;background:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;">Copy to Clipboard</button>
                <button id="closeBtn" style="flex:1;padding:10px;background:#6c757d;color:white;border:none;border-radius:5px;cursor:pointer;">Close</button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
          
          modal.querySelector('#copyBtn')?.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(reportContent);
              alert('Report copied to clipboard!');
              document.body.removeChild(modal);
            } catch (e) {
              alert('Could not copy to clipboard. Please select and copy the text manually.');
            }
          });
          
          modal.querySelector('#closeBtn')?.addEventListener('click', () => {
            document.body.removeChild(modal);
          });
        }

        // Method 2: Try Capacitor Share as additional option
        if (isNative) {
          try {
            // @ts-ignore - Capacitor plugin may not be installed
            const shareModule = '@capacitor/share';
            const capacitorShare = await import(/* @vite-ignore */ shareModule);
            const { Share } = capacitorShare as any;
            
            // Share the text content
            await Share.share({
              title: 'Subscription Visit Report',
              text: reportContent
            });
          } catch (e) {
            // Share not available, that's okay - we already opened the window
            console.log('Capacitor Share not available');
          }
        }
      } else {
        // Desktop browser - use standard download
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    } catch (error) {
      console.error('Error generating visit report for download:', error);
      alert('Unable to download report. Please try again or contact support.');
    }
  };

  const InfoCard = ({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-300 mb-1">{title}</p>
      <p className="text-sm font-semibold">{value}</p>
      {subtitle && <p className="text-xs text-slate-300">{subtitle}</p>}
    </div>
  );

  const SectionCard = ({ title, body }: { title: string; body: string }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-300 mb-1">{title}</p>
      <p className="text-sm text-slate-100 whitespace-pre-wrap">{body}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-12 h-12 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-200 text-sm">Loading subscription visits...</p>
        </div>
      </div>
    );
  }

  if (selectedVisit) {
    const parsedFindings = parseFindings(selectedVisit.findings);
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#031531] via-[#05294f] to-[#0a4373] py-4 px-3">
        <div className="max-w-5xl mx-auto space-y-4">
          <button
            onClick={() => setSelectedVisit(null)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-slate-100 hover:text-white hover:border-sky-300 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Visits
          </button>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-[6px] shadow-[0_30px_70px_rgba(1,8,20,0.55)] p-5 sm:p-6 space-y-5 text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-200 mb-1">Visit #{selectedVisit.visit_number}</p>
                <h2 className="text-2xl font-bold">
                  {(selectedVisit.subscription as any).user.full_name} • {(selectedVisit.subscription as any).plan.plan_name}
                </h2>
                <p className="text-xs text-slate-200 mt-1">
                  Technician: {(selectedVisit.technician as any).full_name} ({(selectedVisit.technician as any).email})
                </p>
              </div>
              <div className="text-right space-y-2">
                <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(selectedVisit.status)}`}>
                  {selectedVisit.status.replace('_', ' ').toUpperCase()}
                </span>
                <p className="text-[11px] text-slate-200">
                  Completed: {selectedVisit.completed_at ? new Date(selectedVisit.completed_at).toLocaleString() : 'Not completed'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard title="Technician" value={(selectedVisit.technician as any).full_name} subtitle={(selectedVisit.technician as any).email} />
              <InfoCard title="Location" value={selectedVisit.location || 'Not specified'} />
              {selectedVisit.started_at && <InfoCard title="Started At" value={new Date(selectedVisit.started_at).toLocaleString()} />}
              {selectedVisit.completed_at && <InfoCard title="Completed At" value={new Date(selectedVisit.completed_at).toLocaleString()} />}
              {selectedVisit.duration_minutes && <InfoCard title="Duration" value={`${selectedVisit.duration_minutes} minutes`} />}
            </div>

            {selectedVisit.report && (
              <SectionCard title="Technician Report" body={selectedVisit.report} />
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {selectedVisit.work_performed && <SectionCard title="Work Performed" body={selectedVisit.work_performed} />}
              {selectedVisit.recommendations && <SectionCard title="Recommendations" body={selectedVisit.recommendations} />}
            </div>

            {parsedFindings.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-sky-100 uppercase tracking-[0.2em]">Findings</h3>
                <div className="rounded-2xl border border-white/10 bg-white/5 max-h-72 overflow-y-auto p-3 space-y-2">
                  {parsedFindings.map((finding, idx) => {
                    const styles = getFindingStyles(finding.status);
                    return (
                      <div key={`${finding.label}-${idx}`} className={`rounded-xl px-3 py-2 border ${styles.card} flex flex-col gap-1`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{finding.label}</p>
                          <span className={`text-[11px] px-3 py-0.5 rounded-full font-semibold ${styles.badge}`}>{finding.status}</span>
                        </div>
                        {finding.needed && (
                          <p className="text-xs text-slate-200">
                            Needed: <span className="text-white">{finding.needed}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedVisit.inspections && selectedVisit.inspections.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-sky-100 uppercase tracking-[0.2em]">Inspection Results</h3>
                <div className="space-y-2">
                  {selectedVisit.inspections.map((inspection, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold">
                          {inspection.category} - {inspection.item}
                        </p>
                        {inspection.notes && <p className="text-xs text-slate-200 mt-1">{inspection.notes}</p>}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getInspectionColor(inspection.status)}`}>
                        {inspection.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedVisit.photos && selectedVisit.photos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-sky-100 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Evidence Photos & Videos
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                  {selectedVisit.photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <a
                        href={photo.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square rounded-md overflow-hidden border border-white/10 bg-white/5 hover:border-sky-400/50 transition-all"
                        style={{ maxWidth: '80px', maxHeight: '80px' }}
                      >
                        {photo.photo_url.endsWith('.mp4') || photo.photo_url.endsWith('.mov') || photo.photo_url.endsWith('.webm') ? (
                          <video
                            src={photo.photo_url}
                            className="w-full h-full object-cover"
                            controls
                            style={{ maxHeight: '80px', maxWidth: '80px' }}
                          />
                        ) : (
                          <img
                            src={photo.photo_url}
                            alt={photo.caption || 'Evidence photo'}
                            className="w-full h-full object-cover"
                            style={{ maxHeight: '80px', maxWidth: '80px', objectFit: 'cover' }}
                          />
                        )}
                      </a>
                      {photo.caption && (
                        <p className="text-[8px] text-slate-300 mt-0.5 truncate px-0.5">{photo.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => downloadReport(selectedVisit)}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold hover:from-sky-600 hover:to-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
              >
                <Download className="w-5 h-5" />
                Download Report
              </button>
              {selectedVisit.status === 'pending_confirmation' && (
                <>
                  <button
                    onClick={() => confirmVisit(selectedVisit.id)}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Confirm Visit
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason) rejectVisit(selectedVisit.id, reason);
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold hover:from-rose-600 hover:to-rose-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Visit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell theme-surface">
      <div className="relative z-10 max-w-7xl mx-auto px-3 py-2">
        <div className="mb-2">
          <button
            onClick={() => navigate('/admin/subscriptions')}
            className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Subscriptions
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Subscription Visits Management</h1>
              <p className="text-slate-300 mt-2">Assign technicians and confirm completed visits</p>
            </div>
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:from-sky-400 hover:to-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
            >
              <UserPlus className="w-5 h-5" />
              Assign Technician
            </button>
          </div>
        </div>

        <div className="glass-card p-2.5 mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('pending_confirmation')}
              className={`px-4 py-2 rounded-lg transition-colors ${filterStatus === 'pending_confirmation' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Pending Confirmation
            </button>
            <button
              onClick={() => setFilterStatus('confirmed')}
              className={`px-4 py-2 rounded-lg transition-colors ${filterStatus === 'confirmed' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-4 py-2 rounded-lg transition-colors ${filterStatus === 'in_progress' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              In Progress
            </button>
          </div>
        </div>

        {visits.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Visits Found</h3>
            <p className="text-gray-600">There are no visits matching your filter.</p>
          </div>
        ) : (
          <div className="glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Visit #</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Technician</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">#{visit.visit_number}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{(visit.subscription as any).user.full_name}</p>
                        <p className="text-sm text-gray-600">{(visit.subscription as any).plan.plan_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{(visit.technician as any).full_name}</p>
                        <p className="text-sm text-gray-600">{(visit.technician as any).email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(visit.status)}`}>
                          {visit.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {visit.completed_at ? new Date(visit.completed_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={async () => {
                            // Load inspections
                            const { data: inspectionsData } = await supabase
                              .from('visit_inspections')
                              .select('*')
                              .eq('visit_id', visit.id);

                            // Load photos
                            const { data: photosData } = await supabase
                              .from('visit_photos')
                              .select('*')
                              .eq('visit_id', visit.id)
                              .order('uploaded_at', { ascending: true });

                            setVisitPhotos(photosData || []);
                            setSelectedVisit({ ...visit, inspections: inspectionsData || [], photos: photosData || [] });
                          }}
                          className="text-orange-600 hover:text-orange-900 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="glass-card max-w-md w-full p-3">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Assign Technician to Subscription</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Subscription</label>
                  <select
                    value={selectedSubscription}
                    onChange={(e) => setSelectedSubscription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Choose a subscription...</option>
                    {subscriptions.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {(sub.user as any).full_name} - {(sub.plan as any).plan_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Technician</label>
                  <select
                    value={selectedTechnician}
                    onChange={(e) => setSelectedTechnician(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Choose a technician...</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name} - {tech.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Any special instructions..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={assignTechnician}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Assign
                </button>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedSubscription('');
                    setSelectedTechnician('');
                    setAssignmentNotes('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
