import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generateVisitReportPdf, VisitForPdf } from '../utils/visitReportPdf';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Camera,
  Video,
  Upload,
  ArrowLeft,
  Plus,
  Save,
  Send,
  Download,
  Image as ImageIcon
} from 'lucide-react';

interface Assignment {
  id: string;
  subscription_id: string;
  status: string;
  notes: string;
  assigned_at: string;
  subscription: {
    id: string;
    vehicle_count: number;
    start_date: string;
    end_date: string;
    user: {
      full_name: string;
      email: string;
    };
    plan: {
      plan_name: string;
      visits_per_month: number;
    };
  };
}

interface Visit {
  id: string;
  visit_number: number;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  status: string;
  findings: string | null;
  recommendations: string | null;
  work_performed: string | null;
  location: string | null;
  duration_minutes: number | null;
  inspections?: any[];
  photos?: Array<{
    id: string;
    photo_url: string;
    caption: string;
    category: string;
    uploaded_at: string;
  }>;
}

interface InspectionItem {
  component: string;
  status: 'good' | 'fair' | 'needs_attention' | 'critical';
  notes: string;
}

export default function SubscriptionVisitsPage() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [showCreateVisit, setShowCreateVisit] = useState(false);
  const [showVisitDetails, setShowVisitDetails] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [visitInspections, setVisitInspections] = useState<any[]>([]);
  const [visitPhotos, setVisitPhotos] = useState<Array<{ id: string; photo_url: string; caption: string; category: string; uploaded_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Visit form state
  const [visitForm, setVisitForm] = useState({
    location: '',
    findings: '',
    recommendations: '',
    work_performed: '',
    duration_minutes: 0
  });
  type SystemStatus = 'pass' | 'needs_attention' | 'urgent_attention';
  const systems = [
    'Engine Management',
    'Transmission Management',
    'Braking Management',
    'Suspension Management',
    'Lighting Management',
    'Electrical Management',
    'Body Management',
    'Steering Management',
    'Coolant Management',
    'Lubrication Management',
    'Drive Assist Management',
    'Air Conditioning Management',
    'Heater Management',
    'Supplemental Restraint System',
    'Dashboard Warning System',
    'Major Service System',
    'Minor Service System'
  ];
  const buildInitialStatusState = () =>
    systems.reduce((acc, system) => {
      acc[system] = null;
      return acc;
    }, {} as Record<string, SystemStatus | null>);

  const buildInitialNotesState = () =>
    systems.reduce((acc, system) => {
      acc[system] = '';
      return acc;
    }, {} as Record<string, string>);

  const [systemStatuses, setSystemStatuses] = useState<Record<string, SystemStatus | null>>(buildInitialStatusState());
  const [systemNotes, setSystemNotes] = useState<Record<string, string>>(buildInitialNotesState());

  const [inspections, setInspections] = useState<InspectionItem[]>([
    { component: '', status: 'good', notes: '' }
  ]);

  const inspectionComponents = [
    'FR Lower Arm',
    'FL Lower Arm',
    'FR Controller Arm',
    'FL Controller Arm',
    'Engine Mounting',
    'Gearbox Mounting',
    'Front Brake Pad',
    'Rear Brake Pad',
    'Front Brake Disc',
    'Rear Brake Disc',
    'FR Upper Arm',
    'FL Upper Arm',
    'FR Shock Absorber',
    'FL Shock Absorber',
    'RR Shock Absorber',
    'RL Shock Absorber',
    'FR Axle Boot',
    'FL Axle Boot',
    'FR Axle',
    'FL Axle',
    'RR Axle Boot',
    'RL Axle Boot',
    'RR Axle',
    'RL Axle',
    'Front Link Rod',
    'Rear Link Rod',
    'Front Diff. Oil',
    'Rear Diff. Oil',
    'Transfer Case Oil',
    'Front Diff. Shaft',
    'Transfer Case Shaft',
    'Transfer Case',
    'Front Differential',
    'Rear Differential',
    'Front Stabilizer Bush',
    'FR Wheel Bearing',
    'FL Wheel Bearing',
    'RR Wheel Bearing',
    'RL Wheel Bearing',
    'Front Diff. Mounting',
    'Rear Diff. Mounting',
    'Front Wheel Nut',
    'Rear Wheel Nut',
    'Steering Rack Boot',
    'FR Tire',
    'FL Tire',
    'RR Tire',
    'RL Tire',
    'Battery',
    'FR Light',
    'FL Light',
    'RR Light',
    'RL Light',
    'Brake Light',
    'Reverse Light',
    'FR Indicator',
    'FL Indicator',
    'RR Indicator',
    'RL Indicator',
    'Horn',
    'FR Power Window',
    'FL Power Window',
    'RR Power Window',
    'RL Power Window',
    'Bonnet Shock',
    'Front Wiper',
    'Rear Wiper',
    'Wiper Water Tank',
    'FR Parking Sensor',
    'Rear Parking Sensor',
    'Number Plate Light',
    'Engine Light',
    'Tire Light',
    'Brake Warning Light',
    'Dynamic Light',
    'ABS Light',
    'Coolant Light',
    'Wiper Wash Light',
    'Parking Light',
    'Coolant Tank Cap',
    'Coolant Tank Pipe',
    'Radiator Hose',
    'Coolant Tank Return Hose',
    'Coolant Leaking',
    'Gear Oil Leaking',
    'Engine Oil Leaking',
    'Belt Tensioner',
    'Idlers',
    'Air Leaking',
    'Tappet Cover Seal',
    'Timing Cover Leak',
    'Engine Oil Cup',
    'Convertor Seal',
    'Rear Crank Seal',
    'Heater Pipe'
  ];

  useEffect(() => {
    if (profile && !authLoading) {
      console.log('Profile loaded, fetching assignments...');
      loadAssignments();
    }
  }, [profile, authLoading]);

  useEffect(() => {
    if (!profile || authLoading) return;

    // Subscribe to real-time updates for assignments
    const channel = supabase
      .channel('technician-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_assignments'
        },
        (payload) => {
          console.log('Assignment updated:', payload);
          loadAssignments();
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
          console.log('Visit updated:', payload);
          if (selectedAssignment) {
            loadVisits(selectedAssignment.subscription_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, authLoading, selectedAssignment]);

  useEffect(() => {
    if (selectedAssignment) {
      loadVisits(selectedAssignment.subscription_id);
    }
  }, [selectedAssignment]);

  const engineStatusOptions: Array<{
    value: SystemStatus;
    label: string;
    accent: string;
  }> = [
    { value: 'pass', label: 'Pass', accent: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200' },
    { value: 'needs_attention', label: 'Need Attention', accent: 'border-orange-400/60 bg-orange-500/15 text-orange-200' },
    { value: 'urgent_attention', label: 'Urgent Attention', accent: 'border-rose-400/60 bg-rose-500/15 text-rose-200' }
  ];

  const toggleSystemStatus = (system: string, value: SystemStatus) => {
    setSystemStatuses(prev => {
      const nextStatus = prev[system] === value ? null : value;
      if (!nextStatus || nextStatus === 'pass') {
        setSystemNotes(notes => ({ ...notes, [system]: '' }));
      }
      return {
        ...prev,
        [system]: nextStatus
      };
    });
  };

  const getStatusStyling = (status: string) => {
    switch (status) {
      case 'URGENT ATTENTION':
        return {
          badge: 'bg-rose-500/20 text-rose-300 border border-rose-400/40',
          card: 'border-rose-500/20 bg-rose-500/5'
        };
      case 'NEEDS ATTENTION':
        return {
          badge: 'bg-orange-500/20 text-orange-300 border border-orange-400/40',
          card: 'border-orange-500/20 bg-orange-500/5'
        };
      default:
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40',
          card: 'border-emerald-500/20 bg-emerald-500/5'
        };
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
        if (systemPart.includes('URGENT ATTENTION')) {
          status = 'URGENT ATTENTION';
        } else if (systemPart.includes('NEEDS ATTENTION')) {
          status = 'NEEDS ATTENTION';
        }

        return {
          label: systemPart.replace('System:', 'System').trim(),
          status,
          needed: neededPart || ''
        };
      });
  };

  const loadAssignments = async () => {
    if (!profile) {
      console.error('Cannot load assignments: profile not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading assignments for technician:', profile.id);

      const { data, error } = await supabase
        .from('subscription_assignments')
        .select(`
          *,
          subscription:customer_subscriptions(
            id,
            vehicle_count,
            start_date,
            end_date,
            payment_confirmed,
            user:profiles!customer_subscriptions_user_id_fkey(full_name, email),
            plan:subscription_plans!customer_subscriptions_subscription_plan_id_fkey(plan_name, visits_per_month)
          )
        `)
        .eq('technician_id', profile.id)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        alert('Error loading assignments: ' + error.message);
        throw error;
      }

      console.log('Loaded assignments:', data);
      // Filter to only show assignments where payment is confirmed
      const confirmedAssignments = (data || []).filter((assignment: any) =>
        assignment.subscription?.payment_confirmed === true
      );
      console.log('Confirmed payment assignments:', confirmedAssignments);
      setAssignments(confirmedAssignments as any || []);
    } catch (error: any) {
      console.error('Exception loading assignments:', error);
      alert('Failed to load assignments. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const addInspectionRow = () => {
    setInspections(prev => [...prev, { component: '', status: 'good', notes: '' }]);
  };

  const removeInspectionRow = (index: number) => {
    setInspections(prev => prev.filter((_, i) => i !== index));
  };

  const loadVisits = async (subscriptionId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscription_visits')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('visit_number', { ascending: false });

      if (error) throw error;
      console.log('Loaded visits:', data);

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

      setVisits(visitsWithInspections || []);
    } catch (error) {
      console.error('Error loading visits:', error);
    }
  };

  const statusLabels: Record<SystemStatus, string> = {
      pass: 'PASS',
      needs_attention: 'NEEDS ATTENTION',
      urgent_attention: 'URGENT ATTENTION'
    };

  const buildFindingsPayload = () => {
    const statusLines = systems
      .map((system) => {
        const status = systemStatuses[system];
        if (!status) return null;
        const note = systemNotes[system]?.trim();
        const noteSuffix = note && status !== 'pass' ? ` - Needed: ${note}` : '';
        return `${system} System: ${statusLabels[status]}${noteSuffix}`;
      })
      .filter(Boolean);

    return [...statusLines, visitForm.findings].filter(Boolean).join('\n\n');
  };

  const createVisit = async () => {
    if (!selectedAssignment) return;

    try {
      const nextVisitNumber = visits.length + 1;

      const { error } = await supabase
        .from('subscription_visits')
        .insert({
          subscription_id: selectedAssignment.subscription_id,
          assignment_id: selectedAssignment.id,
          technician_id: profile?.id,
          visit_number: nextVisitNumber,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          location: visitForm.location,
          recommendations: visitForm.recommendations,
          work_performed: visitForm.work_performed,
          duration_minutes: visitForm.duration_minutes,
          findings: buildFindingsPayload()
        });

      if (error) throw error;

      alert('Visit started successfully!');
      setShowCreateVisit(false);
      resetForm();
      loadVisits(selectedAssignment.subscription_id);
    } catch (error: any) {
      console.error('Error creating visit:', error);
      alert('Error starting visit: ' + error.message);
    }
  };

  const submitVisitReport = async (visitId: string) => {
    try {
      setSubmittingReport(true);
      const { error: visitError } = await supabase
        .from('subscription_visits')
        .update({
          completed_at: new Date().toISOString(),
          status: 'pending_confirmation',
          location: visitForm.location,
          recommendations: visitForm.recommendations,
          work_performed: visitForm.work_performed,
          duration_minutes: visitForm.duration_minutes,
          findings: buildFindingsPayload()
        })
        .eq('id', visitId);

      if (visitError) throw visitError;

      // Save inspections
      const filteredInspections = inspections.filter(inspection => inspection.component);
      if (filteredInspections.length > 0) {
        const inspectionData = filteredInspections.map(inspection => ({
          visit_id: visitId,
          category: inspection.component,
          item: inspection.component,
          status: inspection.status,
          notes: inspection.notes
        }));

        const { error: inspectionError } = await supabase
          .from('visit_inspections')
          .insert(inspectionData);

        if (inspectionError) throw inspectionError;
      }

      // Upload media evidence (photos/videos) if any
      if (mediaFiles.length > 0) {
        setUploadingMedia(true);
        const uploadPromises = mediaFiles.map(async (file) => {
          const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).slice(2, 8);
          const storagePath = `${visitId}/${timestamp}-${randomSuffix}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('visit-photos')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Error uploading visit media:', uploadError);
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('visit-photos')
            .getPublicUrl(storagePath);

          const category = file.type.startsWith('video/') ? 'issue' : 'issue';

          const { error: photoError } = await supabase
            .from('visit_photos')
            .insert({
              visit_id: visitId,
              photo_url: publicUrl,
              caption: file.name,
              category
            } as any);

          if (photoError) {
            console.error('Error saving visit media record:', photoError);
            throw photoError;
          }
        });

        await Promise.all(uploadPromises);
      }

      alert('Visit report submitted successfully! Waiting for admin confirmation.');
      setShowCreateVisit(false);
      resetForm();
      if (selectedAssignment) {
        loadVisits(selectedAssignment.subscription_id);
      }
    } catch (error: any) {
      console.error('Error submitting report:', error);
      alert('Error submitting report: ' + error.message);
    } finally {
      setSubmittingReport(false);
      setUploadingMedia(false);
    }
  };

  const resetForm = () => {
    setVisitForm({
      location: '',
      findings: '',
      recommendations: '',
      work_performed: '',
      duration_minutes: 0
    });
    setSystemStatuses(buildInitialStatusState());
    setSystemNotes(buildInitialNotesState());
    setInspections([{ component: '', status: 'good', notes: '' }]);
    setMediaFiles([]);
  };

  const loadVisitDetails = async (visit: Visit) => {
    try {
      console.log('Loading visit details for:', visit);
      console.log('Visit ID:', visit.id);

      // Load inspections
      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('visit_inspections')
        .select('*')
        .eq('visit_id', visit.id)
        .order('category', { ascending: true });

      if (inspectionsError) {
        console.error('Error loading inspections:', inspectionsError);
        throw inspectionsError;
      }

      // Load photos
      const { data: photosData, error: photosError } = await supabase
        .from('visit_photos')
        .select('*')
        .eq('visit_id', visit.id)
        .order('uploaded_at', { ascending: true });

      if (photosError) {
        console.error('Error loading photos:', photosError);
        // Don't throw - photos might not exist yet
      }

      console.log('Loaded inspections:', inspectionsData);
      console.log('Loaded photos:', photosData);
      setVisitPhotos(photosData || []);
      setSelectedVisit({ ...visit, inspections: inspectionsData || [], photos: photosData || [] });
      setVisitInspections(inspectionsData || []);
      setShowVisitDetails(true);
    } catch (error) {
      console.error('Error loading visit details:', error);
      alert('Failed to load visit details: ' + (error as any).message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-emerald-300 bg-emerald-500/20 border border-emerald-400/30';
      case 'pending_confirmation': return 'text-amber-300 bg-amber-500/20 border border-amber-400/30';
      case 'in_progress': return 'text-sky-300 bg-sky-500/20 border border-sky-400/30';
      case 'rejected': return 'text-red-300 bg-red-500/20 border border-red-400/30';
      default: return 'text-slate-300 bg-slate-500/20 border border-slate-400/30';
    }
  };

  const getInspectionColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
      case 'fair': return 'bg-amber-500/20 text-amber-300 border border-amber-400/30';
      case 'needs_attention': return 'bg-orange-500/20 text-orange-300 border border-orange-400/30';
      case 'critical': return 'bg-red-500/20 text-red-300 border border-red-400/30';
      default: return 'bg-slate-500/20 text-slate-300 border border-slate-400/30';
    }
  };

  const downloadReport = async (visit: Visit, inspections: any[]) => {
    try {
      console.log('Download report clicked for visit:', visit.id);
      
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
          console.log('Loaded photos for PDF:', photos.length);
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
        confirmed_at: (visit as any).confirmed_at || null,
        status: visit.status,
        findings: visit.findings,
        recommendations: visit.recommendations,
        work_performed: visit.work_performed,
        location: visit.location,
        duration_minutes: visit.duration_minutes,
        parts_used: (visit as any).parts_used || [],
        customer_name: (visit as any)?.subscription?.user?.full_name || null,
        customer_email: (visit as any)?.subscription?.user?.email || null,
        technician_name: (visit as any)?.technician?.full_name || 'Technician',
        technician_email: (visit as any)?.technician?.email || '',
        inspections: inspections || (visit as any).inspections || [],
        photos: photos as any
      };

      console.log('Generating PDF with data:', visitForPdf);
      const fileName = `visit-${visit.visit_number}-report-${Date.now()}.pdf`;

      await generateVisitReportPdf(visitForPdf, fileName);
      console.log('PDF generated successfully');
    } catch (error) {
      console.error('Error generating visit report for download:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Unable to download report: ${errorMessage}. Please check the console for details.`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen page-shell theme-surface flex items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto w-12 h-12">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-full h-full border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-slate-300">{authLoading ? 'Loading profile...' : 'Loading assignments...'}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen page-shell theme-surface flex items-center justify-center">
        <div className="text-center glass-card p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Profile Not Found</h3>
          <p className="text-slate-300 mb-4">Unable to load your profile. Please try logging in again.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (showCreateVisit && selectedAssignment) {
    return (
      <div className="min-h-screen page-shell theme-surface p-2 sm:p-3">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowCreateVisit(false)}
            className="mb-2 flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all text-xs"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Visits
          </button>

          <div className="glass-card border border-white/10 p-3">
            <h2 className="text-sm font-bold text-white mb-2">Submit Visit Report</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={visitForm.location}
                  onChange={(e) => setVisitForm({ ...visitForm, location: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 text-white placeholder-slate-400"
                  placeholder="Enter service location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={visitForm.duration_minutes}
                  onChange={(e) => setVisitForm({ ...visitForm, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 text-white placeholder-slate-400"
                  placeholder="How long did the visit take?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Work Performed
                </label>
                <textarea
                  value={visitForm.work_performed}
                  onChange={(e) => setVisitForm({ ...visitForm, work_performed: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 text-white placeholder-slate-400"
                  placeholder="Describe the work performed..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Findings
                </label>

                <div className="mb-4 space-y-3">
                  {systems.map((system) => (
                    <div
                      key={system}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border border-white/5 rounded-lg p-2"
                    >
                      <p className="text-sm font-semibold text-slate-200 sm:w-48">
                        {system} System
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {engineStatusOptions.map((option) => (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${option.accent} ${
                              systemStatuses[system] === option.value ? 'ring-2 ring-white/40' : 'opacity-80 hover:opacity-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="form-checkbox h-3 w-3 text-white rounded border-white/40 bg-transparent"
                              checked={systemStatuses[system] === option.value}
                              onChange={() => toggleSystemStatus(system, option.value)}
                            />
                            <span className="text-xs font-semibold text-white">
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      {systemStatuses[system] && systemStatuses[system] !== 'pass' && (
                        <input
                          type="text"
                          value={systemNotes[system]}
                          onChange={(e) =>
                            setSystemNotes(prev => ({
                              ...prev,
                              [system]: e.target.value
                            }))
                          }
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400/40"
                          placeholder="Specify parts or components needed for this system"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <textarea
                  value={visitForm.findings}
                  onChange={(e) => setVisitForm({ ...visitForm, findings: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 text-white placeholder-slate-400"
                  placeholder="What did you find during the inspection?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Recommendations
                </label>
                <textarea
                  value={visitForm.recommendations}
                  onChange={(e) => setVisitForm({ ...visitForm, recommendations: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 text-white placeholder-slate-400"
                  placeholder="What do you recommend?"
                />
              </div>

              {/* Media evidence upload (photos & videos) */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Evidence Photos & Videos
                </label>
                <p className="text-xs text-slate-300 mb-2">
                  Capture clear photos or short videos of oil leaks, damaged parts, or any important findings. These will be attached to the visit report for the customer and admin.
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-sky-400/60 text-sky-200 hover:border-sky-300 hover:bg-sky-500/10 cursor-pointer text-sm transition-colors">
                  <Camera className="w-4 h-4" />
                  <Video className="w-4 h-4" />
                  <span>Select Photos / Videos</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setMediaFiles(prev => [...prev, ...files]);
                      }
                    }}
                  />
                </label>

                {mediaFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-slate-300">
                      Selected files ({mediaFiles.length}):
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {mediaFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-100"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {file.type.startsWith('video/') ? (
                              <Video className="w-4 h-4 text-purple-300 shrink-0" />
                            ) : (
                              <Camera className="w-4 h-4 text-emerald-300 shrink-0" />
                            )}
                            <span className="truncate">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setMediaFiles(prev => prev.filter((_, i) => i !== index))
                            }
                            className="ml-2 text-[11px] text-rose-300 hover:text-rose-200"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-4">
                  Inspection Checklist
                </label>
                <div className="space-y-3">
                  {inspections.map((inspection, index) => (
                    <div key={index} className="glass-card border border-white/10 p-4 rounded-lg space-y-3">
                      <div className="grid gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-5">
                          <p className="text-xs font-semibold text-slate-300 mb-1">Component</p>
                          <select
                            value={inspection.component}
                            onChange={(e) => {
                              const newInspections = [...inspections];
                              newInspections[index].component = e.target.value;
                              setInspections(newInspections);
                            }}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50"
                          >
                            <option value="">Select a component</option>
                            {inspectionComponents.map((component) => (
                              <option key={component} value={component} className="text-slate-900">
                                {component}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <p className="text-xs font-semibold text-slate-300 mb-1">Condition</p>
                          <select
                            value={inspection.status}
                            onChange={(e) => {
                              const newInspections = [...inspections];
                              newInspections[index].status = e.target.value as any;
                              setInspections(newInspections);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${getInspectionColor(inspection.status)}`}
                          >
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="needs_attention">Needs Attention</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <p className="text-xs font-semibold text-slate-300 mb-1">Notes</p>
                          <input
                            type="text"
                            value={inspection.notes}
                            onChange={(e) => {
                              const newInspections = [...inspections];
                              newInspections[index].notes = e.target.value;
                              setInspections(newInspections);
                            }}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-400"
                            placeholder="Additional notes..."
                          />
                        </div>
                        <div className="sm:col-span-1 flex items-end justify-end">
                          {inspections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeInspectionRow(index)}
                              className="px-2 py-1 text-rose-400 hover:text-rose-300 text-xs font-semibold"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addInspectionRow}
                    className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-white/30 text-white text-sm hover:border-white/60 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Component
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const visitId = visits.find(v => v.status === 'in_progress')?.id;
                    if (visitId) {
                      submitVisitReport(visitId);
                    } else {
                      alert('No active visit found. Please start a visit first.');
                    }
                  }}
                  disabled={submittingReport || uploadingMedia}
                  className="flex-1 px-6 py-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  {submittingReport || uploadingMedia ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  onClick={() => setShowCreateVisit(false)}
                  className="px-6 py-3 bg-white/10 border border-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedAssignment) {
    return (
      <div className="min-h-screen page-shell theme-surface p-2 sm:p-3">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setSelectedAssignment(null)}
            className="mb-2 flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all text-xs"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Assignments
          </button>

          <div className="glass-card border border-white/10 p-3 mb-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {(selectedAssignment.subscription as any).user.full_name}
                </h2>
                <p className="text-slate-300">
                  {(selectedAssignment.subscription as any).plan.plan_name} - {(selectedAssignment.subscription as any).vehicle_count} vehicle(s)
                </p>
              </div>
              <button
                onClick={() => {
                  createVisit();
                  setShowCreateVisit(true);
                }}
                className="px-4 py-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Start New Visit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <span className="text-sm text-slate-300">Visits per Month:</span>
                <p className="font-semibold text-white">{(selectedAssignment.subscription as any).plan.visits_per_month}</p>
              </div>
              <div>
                <span className="text-sm text-slate-300">Completed Visits:</span>
                <p className="font-semibold text-white">{visits.filter(v => v.status === 'confirmed').length}</p>
              </div>
            </div>
          </div>

          <div className="glass-card border border-white/10 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Visit History</h3>

            {visits.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-300">No visits yet. Start your first visit!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {visits.map((visit) => (
                  <div key={visit.id} className="glass-card border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-white">Visit #{visit.visit_number}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(visit.status)}`}>
                          {visit.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      {visit.status === 'in_progress' && (
                        <button
                          onClick={() => setShowCreateVisit(true)}
                          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors text-sm"
                        >
                          Continue Report
                        </button>
                      )}
                      {(visit.completed_at || visit.status === 'confirmed' || visit.status === 'pending_confirmation') && visit.status !== 'in_progress' && (
                        <button
                          onClick={() => {
                            console.log('View Details button clicked!', visit);
                            loadVisitDetails(visit);
                          }}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          View Details
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {visit.started_at && (
                        <div>
                          <span className="text-slate-300">Started:</span>
                          <p className="font-medium text-white">{new Date(visit.started_at).toLocaleString()}</p>
                        </div>
                      )}
                      {visit.completed_at && (
                        <div>
                          <span className="text-slate-300">Completed:</span>
                          <p className="font-medium text-white">{new Date(visit.completed_at).toLocaleString()}</p>
                        </div>
                      )}
                      {visit.confirmed_at && (
                        <div>
                          <span className="text-slate-300">Confirmed:</span>
                          <p className="font-medium text-white">{new Date(visit.confirmed_at).toLocaleString()}</p>
                        </div>
                      )}
                      {visit.duration_minutes && (
                        <div>
                          <span className="text-slate-300">Duration:</span>
                          <p className="font-medium text-white">{visit.duration_minutes} minutes</p>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visit Details Modal */}
        {showVisitDetails && selectedVisit && (
          <div className="fixed inset-0 bg-[#02132a]/85 backdrop-blur-lg flex items-center justify-center p-4 z-50">
            <div className="rounded-2xl border border-white/10 max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-[0_25px_80px_rgba(1,8,20,0.7)] bg-gradient-to-br from-[#031530] via-[#05305a] to-[#0a4a79]">
              <div className="sticky top-0 bg-gradient-to-r from-[#042248] to-[#08406f] border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-2xl shadow-inner shadow-black/40">
                <h2 className="text-2xl font-bold text-white">Visit #{selectedVisit.visit_number} - Submitted Report</h2>
                <button
                  onClick={() => {
                    setShowVisitDetails(false);
                    setSelectedVisit(null);
                    setVisitInspections([]);
                  }}
                  className="p-2 text-slate-100 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-sky-200 mb-2">Visit Information</h3>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 shadow-inner shadow-black/30">
                      <p className="text-sm text-slate-100"><strong className="text-white">Status:</strong> <span className="capitalize">{selectedVisit.status.replace('_', ' ')}</span></p>
                      {selectedVisit.scheduled_date && (
                        <p className="text-sm text-slate-100"><strong className="text-white">Scheduled:</strong> {new Date(selectedVisit.scheduled_date).toLocaleDateString()}</p>
                      )}
                      {selectedVisit.started_at && (
                        <p className="text-sm text-slate-100"><strong className="text-white">Started:</strong> {new Date(selectedVisit.started_at).toLocaleString()}</p>
                      )}
                      {selectedVisit.completed_at && (
                        <p className="text-sm text-slate-100"><strong className="text-white">Completed:</strong> {new Date(selectedVisit.completed_at).toLocaleString()}</p>
                      )}
                      {selectedVisit.confirmed_at && (
                        <p className="text-sm text-slate-100"><strong className="text-white">Confirmed by Admin:</strong> {new Date(selectedVisit.confirmed_at).toLocaleString()}</p>
                      )}
                      {selectedVisit.duration_minutes && (
                        <p className="text-sm text-slate-100"><strong className="text-white">Duration:</strong> {selectedVisit.duration_minutes} minutes</p>
                      )}
                      {selectedVisit.location && (
                        <p className="text-sm text-slate-100"><strong className="text-white">Location:</strong> {selectedVisit.location}</p>
                      )}
                    </div>
                  </div>

                  {parseFindings(selectedVisit.findings).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-amber-300 mb-2">Findings</h3>
                      <div className="glass-card border border-amber-400/30 rounded-xl p-3 space-y-2 max-h-80 overflow-y-auto">
                        {parseFindings(selectedVisit.findings).map((finding, idx) => {
                          const styles = getStatusStyling(finding.status);
                          return (
                            <div
                              key={`${finding.label}-${idx}`}
                              className={`rounded-lg px-3 py-2 border ${styles.card} flex flex-col gap-1`}
                            >
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

                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedVisit.work_performed && (
                      <div>
                        <h3 className="text-lg font-semibold text-emerald-200 mb-2">Work Performed</h3>
                        <div className="rounded-2xl border border-emerald-400/30 bg-white/5 p-4">
                          <p className="text-sm text-slate-100 whitespace-pre-wrap">{selectedVisit.work_performed}</p>
                        </div>
                      </div>
                    )}

                    {selectedVisit.recommendations && (
                      <div>
                        <h3 className="text-lg font-semibold text-orange-200 mb-2">Recommendations</h3>
                        <div className="rounded-2xl border border-orange-400/30 bg-white/5 p-4">
                          <p className="text-sm text-slate-100 whitespace-pre-wrap">{selectedVisit.recommendations}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {visitInspections.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Detailed Inspection Checklist
                      </h3>
                      <div className="glass-card border border-white/10 rounded-lg p-4">
                        <div className="space-y-2">
                          {visitInspections.map((inspection: any) => {
                            const componentName = inspection.item || inspection.category || inspection.component || 'Component';
                            return (
                              <div key={inspection.id} className="flex items-start justify-between glass-card border border-white/10 p-3 rounded-lg">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">{componentName}</p>
                                  {inspection.notes && (
                                    <p className="text-sm text-slate-300 mt-1">{inspection.notes}</p>
                                  )}
                                </div>
                                <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${getInspectionColor(inspection.status)}`}>
                                  {inspection.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {visitPhotos.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        Evidence Photos & Videos
                      </h3>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                        {visitPhotos.map((photo) => (
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
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!selectedVisit) {
                        alert('No visit selected. Please select a visit first.');
                        return;
                      }
                      downloadReport(selectedVisit, visitInspections);
                    }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-500 to-cyan-400 text-white rounded-xl hover:from-sky-600 hover:to-cyan-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedVisit}
                  >
                    <Download className="w-5 h-5" />
                    Download Report
                  </button>
                  <button
                    onClick={() => {
                      setShowVisitDetails(false);
                      setSelectedVisit(null);
                      setVisitInspections([]);
                    }}
                    className="flex-1 px-4 py-2 border border-white/15 text-white rounded-xl hover:bg-white/5 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell theme-surface p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/technician-dashboard')}
            className="mb-4 flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">My Subscription Assignments</h1>
              <p className="text-slate-300 mt-2">Manage your assigned customer subscriptions and visits</p>
            </div>
            <button
              onClick={() => loadAssignments()}
              className="px-4 py-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-colors flex items-center gap-2"
            >
              <Clock className="w-5 h-5" />
              Refresh
            </button>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="glass-card border border-white/10 p-12 text-center">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Assignments Yet</h3>
            <p className="text-slate-300 mb-2">You don't have any active subscription assignments with confirmed payments.</p>
            <p className="text-sm text-slate-400">Note: Only assignments with admin-confirmed payments will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="glass-card border border-white/10 p-6 hover:border-sky-400/40 transition-all cursor-pointer"
                onClick={() => setSelectedAssignment(assignment)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {(assignment.subscription as any).user.full_name}
                    </h3>
                    <p className="text-slate-300 text-sm">{(assignment.subscription as any).user.email}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-semibold">
                    ACTIVE
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Plan:</span>
                    <span className="font-medium text-white">{(assignment.subscription as any).plan.plan_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Vehicles:</span>
                    <span className="font-medium text-white">{(assignment.subscription as any).vehicle_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Visits/Month:</span>
                    <span className="font-medium text-white">{(assignment.subscription as any).plan.visits_per_month}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-slate-400">
                    Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visit Details Modal */}
      {showVisitDetails && selectedVisit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-xl border border-white/10 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#050f24]/90 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-2xl font-bold text-white">Visit #{selectedVisit.visit_number} - Submitted Report</h2>
              <button
                onClick={() => {
                  setShowVisitDetails(false);
                  setSelectedVisit(null);
                  setVisitInspections([]);
                }}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Visit Information</h3>
                  <div className="glass-card border border-white/10 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-slate-200"><strong className="text-white">Status:</strong> <span className="capitalize">{selectedVisit.status.replace('_', ' ')}</span></p>
                    {selectedVisit.scheduled_date && (
                      <p className="text-sm text-slate-200"><strong className="text-white">Scheduled:</strong> {new Date(selectedVisit.scheduled_date).toLocaleDateString()}</p>
                    )}
                    {selectedVisit.started_at && (
                      <p className="text-sm text-slate-200"><strong className="text-white">Started:</strong> {new Date(selectedVisit.started_at).toLocaleString()}</p>
                    )}
                    {selectedVisit.completed_at && (
                      <p className="text-sm text-slate-200"><strong className="text-white">Completed:</strong> {new Date(selectedVisit.completed_at).toLocaleString()}</p>
                    )}
                    {selectedVisit.confirmed_at && (
                      <p className="text-sm text-slate-200"><strong className="text-white">Confirmed by Admin:</strong> {new Date(selectedVisit.confirmed_at).toLocaleString()}</p>
                    )}
                    {selectedVisit.duration_minutes && (
                      <p className="text-sm text-slate-200"><strong className="text-white">Duration:</strong> {selectedVisit.duration_minutes} minutes</p>
                    )}
                    {selectedVisit.location && (
                      <p className="text-sm text-slate-200"><strong className="text-white">Location:</strong> {selectedVisit.location}</p>
                    )}
                  </div>
                </div>

                {selectedVisit.findings && (
                  <div>
                    <h3 className="text-lg font-semibold text-amber-300 mb-2">Findings</h3>
                    <div className="glass-card border border-amber-400/30 rounded-lg p-4">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedVisit.findings}</p>
                    </div>
                  </div>
                )}

                {selectedVisit.work_performed && (
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-300 mb-2">Work Performed</h3>
                    <div className="glass-card border border-emerald-400/30 rounded-lg p-4">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedVisit.work_performed}</p>
                    </div>
                  </div>
                )}

                {selectedVisit.recommendations && (
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-2">Recommendations</h3>
                    <div className="glass-card border border-orange-400/30 rounded-lg p-4">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedVisit.recommendations}</p>
                    </div>
                  </div>
                )}

                {visitInspections.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Detailed Inspection Checklist
                    </h3>
                    <div className="glass-card border border-white/10 rounded-lg p-4">
                      <div className="grid gap-3">
                        {visitInspections.reduce((acc: any[], inspection) => {
                          const categoryGroup = acc.find(g => g.category === inspection.category);
                          if (categoryGroup) {
                            categoryGroup.items.push(inspection);
                          } else {
                            acc.push({ category: inspection.category, items: [inspection] });
                          }
                          return acc;
                        }, []).map((group, idx) => (
                          <div key={idx} className="border-b border-white/10 pb-3 last:border-0">
                            <h4 className="font-semibold text-white mb-2">{group.category}</h4>
                            <div className="space-y-2">
                              {group.items.map((inspection: any) => (
                                <div key={inspection.id} className="flex items-start justify-between glass-card border border-white/10 p-3 rounded-lg">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-white">{inspection.item}</p>
                                    {inspection.notes && (
                                      <p className="text-sm text-slate-300 mt-1">{inspection.notes}</p>
                                    )}
                                  </div>
                                  <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${getInspectionColor(inspection.status)}`}>
                                    {inspection.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {visitPhotos.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      Evidence Photos & Videos
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                      {visitPhotos.map((photo) => (
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
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selectedVisit) {
                      alert('No visit selected. Please select a visit first.');
                      return;
                    }
                    downloadReport(selectedVisit, visitInspections);
                  }}
                  className="flex-1 px-4 py-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedVisit}
                >
                  <Download className="w-5 h-5" />
                  Download Report
                </button>
                <button
                  onClick={() => {
                    setShowVisitDetails(false);
                    setSelectedVisit(null);
                    setVisitInspections([]);
                  }}
                  className="flex-1 px-4 py-2 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
