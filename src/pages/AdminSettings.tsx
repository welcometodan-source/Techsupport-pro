import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Wrench,
  LogOut,
  Settings,
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Search,
  Filter,
  Key,
  Mail,
  Shield,
  Phone,
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Headphones,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

type TechnicianWithStatus = Profile & {
  technician_status?: string;
  technician_application_date?: string;
  technician_approved_at?: string;
  technician_approved_by?: string;
  rejection_reason?: string;
  on_hold_reason?: string;
  on_hold_at?: string;
  on_hold_by?: string;
  approver?: { full_name: string };
};

export default function AdminSettings() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<TechnicianWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianWithStatus | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'on_hold' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    on_hold: 0,
    rejected: 0
  });

  const [activeTab, setActiveTab] = useState<'technicians' | 'account' | 'system'>('technicians');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paymentContactPhone, setPaymentContactPhone] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);

  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportCountry, setSupportCountry] = useState('');
  const [supportCity, setSupportCity] = useState('');
  const [supportHours, setSupportHours] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<any>(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    method_name: '',
    method_type: '',
    description: '',
    is_active: true,
    display_order: 0
  });

  // Bank Transfer Details
  const [bankTransferDetails, setBankTransferDetails] = useState({
    bank_name: '',
    account_holder: '',
    account_number: '',
    iban: '',
    swift_code: ''
  });
  const [loadingBankDetails, setLoadingBankDetails] = useState(false);

  useEffect(() => {
    loadTechnicians();
    loadSystemSettings();
    loadPaymentMethods();
  }, []);

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'technician')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const techsWithApprover = await Promise.all(
          data.map(async (tech) => {
            if ((tech as any).technician_approved_by) {
              const { data: approver } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', (tech as any).technician_approved_by)
                .single();

              return { ...tech, approver } as TechnicianWithStatus;
            }
            return tech as TechnicianWithStatus;
          })
        );

        setTechnicians(techsWithApprover);

        const counts = {
          pending: data.filter(t => (t as any).technician_status === 'pending').length,
          approved: data.filter(t => (t as any).technician_status === 'approved').length,
          on_hold: data.filter(t => (t as any).technician_status === 'on_hold').length,
          rejected: data.filter(t => (t as any).technician_status === 'rejected').length
        };
        setStats(counts);
      }
    } catch (error) {
      console.error('Error loading technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedTechnician || !actionType) return;

    try {
      const updates: any = {};

      if (actionType === 'approve') {
        updates.technician_status = 'approved';
        updates.technician_approved_by = profile?.id;
        updates.technician_approved_at = new Date().toISOString();
        updates.rejection_reason = null;
        updates.on_hold_reason = null;
      } else if (actionType === 'on_hold') {
        updates.technician_status = 'on_hold';
        updates.on_hold_by = profile?.id;
        updates.on_hold_at = new Date().toISOString();
        updates.on_hold_reason = reason || 'Under review';
      } else if (actionType === 'reject') {
        updates.technician_status = 'rejected';
        updates.rejection_reason = reason || 'Application rejected';
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', selectedTechnician.id);

      if (error) throw error;

      setSelectedTechnician(null);
      setActionType(null);
      setReason('');
      loadTechnicians();
    } catch (error) {
      console.error('Error updating technician status:', error);
    }
  };

  const handleEmailChange = async () => {
    setUpdateMessage(null);

    if (!newEmail) {
      setUpdateMessage({ type: 'error', text: 'Please enter a new email address' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) throw error;

      setUpdateMessage({
        type: 'success',
        text: 'Email update initiated! Please check both your old and new email for confirmation links.'
      });
      setNewEmail('');
    } catch (error: any) {
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to update email' });
    }
  };

  const handlePasswordChange = async () => {
    setUpdateMessage(null);

    if (!newPassword || !confirmPassword) {
      setUpdateMessage({ type: 'error', text: 'Please fill in all password fields' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setUpdateMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setUpdateMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setUpdateMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to update password' });
    }
  };

  const loadSystemSettings = async () => {
    setLoadingSettings(true);
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['payment_contact_phone', 'support_phone', 'support_email', 'support_country', 'support_city', 'support_hours', 'payment_bank_transfer_details']);

      if (data) {
        data.forEach(setting => {
          switch (setting.setting_key) {
            case 'payment_contact_phone':
              setPaymentContactPhone(setting.setting_value);
              break;
            case 'support_phone':
              setSupportPhone(setting.setting_value);
              break;
            case 'support_email':
              setSupportEmail(setting.setting_value);
              break;
            case 'support_country':
              setSupportCountry(setting.setting_value);
              break;
            case 'support_city':
              setSupportCity(setting.setting_value);
              break;
            case 'support_hours':
              setSupportHours(setting.setting_value);
              break;
            case 'payment_bank_transfer_details':
              try {
                const details = JSON.parse(setting.setting_value);
                setBankTransferDetails({
                  bank_name: details.bank_name || '',
                  account_holder: details.account_holder || '',
                  account_number: details.account_number || '',
                  iban: details.iban || '',
                  swift_code: details.swift_code || ''
                });
              } catch (e) {
                console.error('Error parsing bank transfer details:', e);
              }
              break;
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleUpdateBankTransferDetails = async () => {
    setLoadingBankDetails(true);
    setUpdateMessage(null);

    if (!bankTransferDetails.bank_name || !bankTransferDetails.account_holder || !bankTransferDetails.account_number) {
      setUpdateMessage({ type: 'error', text: 'Please fill in Bank Name, Account Holder, and Account Number' });
      setLoadingBankDetails(false);
      return;
    }

    try {
      const detailsJson = JSON.stringify(bankTransferDetails);
      
      // Check if setting exists
      const { data: existing } = await supabase
        .from('admin_settings')
        .select('id')
        .eq('setting_key', 'payment_bank_transfer_details')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('admin_settings')
          .update({
            setting_value: detailsJson,
            updated_by: profile?.id,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', 'payment_bank_transfer_details');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('admin_settings')
          .insert({
            setting_key: 'payment_bank_transfer_details',
            setting_value: detailsJson,
            description: 'Bank transfer payment details shown to customers',
            updated_by: profile?.id
          });

        if (error) throw error;
      }

      setUpdateMessage({ type: 'success', text: 'Bank transfer details updated successfully!' });
    } catch (error: any) {
      console.error('Error updating bank transfer details:', error);
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to update bank transfer details' });
    } finally {
      setLoadingBankDetails(false);
    }
  };

  const handleUpdatePaymentPhone = async () => {
    setUpdateMessage(null);

    if (!paymentContactPhone) {
      setUpdateMessage({ type: 'error', text: 'Please enter a phone number' });
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_settings')
        .update({
          setting_value: paymentContactPhone,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('setting_key', 'payment_contact_phone');

      if (error) throw error;

      setUpdateMessage({ type: 'success', text: 'Payment contact number updated successfully!' });
    } catch (error: any) {
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to update contact number' });
    }
  };

  const handleUpdateSupportContact = async () => {
    setUpdateMessage(null);
    setLoadingSettings(true);

    if (!supportPhone || !supportEmail) {
      setUpdateMessage({ type: 'error', text: 'Phone and email are required' });
      setLoadingSettings(false);
      return;
    }

    try {
      const updates = [
        { key: 'support_phone', value: supportPhone, description: 'Customer support phone number displayed on contact page' },
        { key: 'support_email', value: supportEmail, description: 'Customer support email address' },
        { key: 'support_country', value: supportCountry, description: 'Business location country' },
        { key: 'support_city', value: supportCity, description: 'Business location city' },
        { key: 'support_hours', value: supportHours, description: 'Business hours description (e.g., "24/7" or "Mon-Fri: 9AM-6PM")' }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('admin_settings')
          .upsert({
            setting_key: update.key,
            setting_value: update.value,
            description: update.description,
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          }, {
            onConflict: 'setting_key'
          });

        if (error) throw error;
      }

      setUpdateMessage({ type: 'success', text: 'Support contact details updated successfully!' });
      setTimeout(() => setUpdateMessage(null), 3000);
    } catch (error: any) {
      console.error('Error updating support contact:', error);
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to update support contact' });
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const handlePaymentMethodSubmit = async () => {
    setUpdateMessage(null);

    if (!paymentMethodForm.method_name || !paymentMethodForm.method_type) {
      setUpdateMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      if (editingPaymentMethod) {
        const { error } = await supabase
          .from('payment_methods')
          .update(paymentMethodForm)
          .eq('id', editingPaymentMethod.id);

        if (error) throw error;
        setUpdateMessage({ type: 'success', text: 'Payment method updated successfully!' });
      } else {
        const { error } = await supabase
          .from('payment_methods')
          .insert([paymentMethodForm]);

        if (error) throw error;
        setUpdateMessage({ type: 'success', text: 'Payment method added successfully!' });
      }

      setShowPaymentMethodModal(false);
      setEditingPaymentMethod(null);
      setPaymentMethodForm({
        method_name: '',
        method_type: '',
        description: '',
        is_active: true,
        display_order: 0
      });
      loadPaymentMethods();
    } catch (error: any) {
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to save payment method' });
    }
  };

  const handleDeletePaymentMethod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    setUpdateMessage(null);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setUpdateMessage({ type: 'success', text: 'Payment method deleted successfully!' });
      loadPaymentMethods();
    } catch (error: any) {
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to delete payment method' });
    }
  };

  const handleEditPaymentMethod = (method: any) => {
    setEditingPaymentMethod(method);
    setPaymentMethodForm({
      method_name: method.method_name,
      method_type: method.method_type,
      description: method.description || '',
      is_active: method.is_active,
      display_order: method.display_order
    });
    setShowPaymentMethodModal(true);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'on_hold':
        return (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium flex items-center gap-1">
            <Pause className="w-3 h-3" />
            On Hold
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-medium flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const filteredTechnicians = technicians.filter(tech => {
    const matchesSearch = tech.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tech.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || tech.technician_status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
            <div className="relative w-12 h-12 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-200 text-sm">Loading admin settings...</p>
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
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">Admin</p>
                <h1 className="text-white text-lg font-bold">System Settings</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-slate-200">
              <button
                onClick={() => navigate('/admin/management')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-sky-400/50 transition-all"
              >
                <Users className="w-4 h-4" />
                Management
              </button>
              <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all" title="Settings">
                <Settings className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-2xl">
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
        <div className="mb-3">
          <h1 className="text-xl font-bold text-white mb-2">Settings</h1>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setActiveTab('technicians')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'technicians'
                  ? 'bg-orange-500 text-white'
                  : 'bg-black/60 backdrop-blur-sm text-slate-300 hover:bg-slate-700 border border-slate-800/50'
              }`}
            >
              <Users className="w-3 h-3" />
              Technicians
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'account'
                  ? 'bg-orange-500 text-white'
                  : 'bg-black/60 backdrop-blur-sm text-slate-300 hover:bg-slate-700 border border-slate-800/50'
              }`}
            >
              <Shield className="w-3 h-3" />
              Account Settings
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'system'
                  ? 'bg-orange-500 text-white'
                  : 'bg-black/60 backdrop-blur-sm text-slate-300 hover:bg-slate-700 border border-slate-800/50'
              }`}
            >
              <Settings className="w-3 h-3" />
              System
            </button>
          </div>
        </div>

        {activeTab === 'technicians' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-lg font-bold text-white">{stats.pending}</span>
            </div>
            <p className="text-slate-400 text-[10px]">Pending</p>
          </div>

          <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-lg font-bold text-white">{stats.approved}</span>
            </div>
            <p className="text-slate-400 text-[10px]">Approved</p>
          </div>

          <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <Pause className="w-4 h-4 text-blue-400" />
              <span className="text-lg font-bold text-white">{stats.on_hold}</span>
            </div>
            <p className="text-slate-400 text-[10px]">On Hold</p>
          </div>

          <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-lg font-bold text-white">{stats.rejected}</span>
            </div>
            <p className="text-slate-400 text-[10px]">Rejected</p>
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-3">
          <div className="flex flex-col md:flex-row gap-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-8 pr-6 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="on_hold">On Hold</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[10px]">Technician</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[10px]">Contact</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[10px]">Status</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[10px]">Applied Date</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTechnicians.map((tech) => (
                  <tr key={tech.id} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-2">
                      <div>
                        <p className="text-white font-medium text-xs">{tech.full_name}</p>
                        <p className="text-slate-500 text-[10px]">ID: {tech.id.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-300 text-sm">{tech.phone || 'N/A'}</p>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(tech.technician_status)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-300 text-sm">
                        {tech.technician_application_date
                          ? new Date(tech.technician_application_date).toLocaleDateString()
                          : new Date(tech.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {tech.technician_status !== 'approved' && (
                          <button
                            onClick={() => {
                              setSelectedTechnician(tech);
                              setActionType('approve');
                            }}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-medium transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        {tech.technician_status !== 'on_hold' && (
                          <button
                            onClick={() => {
                              setSelectedTechnician(tech);
                              setActionType('on_hold');
                            }}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
                          >
                            Hold
                          </button>
                        )}
                        {tech.technician_status !== 'rejected' && (
                          <button
                            onClick={() => {
                              setSelectedTechnician(tech);
                              setActionType('reject');
                            }}
                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-colors"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredTechnicians.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No technicians found</p>
              </div>
            )}
          </div>
        </div>
          </>
        )}

        {activeTab === 'account' && (
          <div className="max-w-2xl">
            {updateMessage && (
              <div className={`mb-6 p-4 rounded-lg border ${
                updateMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'bg-red-500/10 border-red-500 text-red-400'
              }`}>
                {updateMessage.text}
              </div>
            )}

            <div className="bg-[#1e293b] rounded-lg border border-slate-700 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-white">Change Email</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Update your email address. You will receive confirmation emails at both your old and new addresses.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Current Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">New Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  onClick={handleEmailChange}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Update Email
                </button>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-white">Change Password</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Update your password to keep your account secure.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  onClick={handlePasswordChange}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Update Password
                </button>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-semibold text-white">Reset Application</h2>
              </div>
              <p className="text-slate-300 text-sm mb-4">
                Delete all non-admin users (customers, technicians, and other roles) from the system. This will permanently remove all user accounts except admins, along with all their associated data including tickets, subscriptions, visits, payments, and messages.
              </p>
              <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-4 mb-4">
                <p className="text-red-200 text-sm font-semibold mb-2">⚠️ Warning:</p>
                <p className="text-red-100 text-xs">
                  This action cannot be undone. All customer and technician accounts will be permanently deleted. Only admin accounts will remain.
                </p>
              </div>
              <button
                onClick={() => navigate('/admin/delete-all-customers')}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Delete All Non-Admin Users
              </button>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="max-w-2xl">
            {updateMessage && (
              <div className={`mb-6 p-4 rounded-lg border ${
                updateMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'bg-red-500/10 border-red-500 text-red-400'
              }`}>
                {updateMessage.text}
              </div>
            )}

            <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-white">Payment Contact Number</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                This phone number will be displayed to customers when they make payments. Customers can contact this number via call or WhatsApp to get bank transfer details and other payment information.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Admin Contact Phone Number</label>
                  <input
                    type="tel"
                    value={paymentContactPhone}
                    onChange={(e) => setPaymentContactPhone(e.target.value)}
                    placeholder="+971525277492"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loadingSettings}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Include country code (e.g., +971 for UAE)
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300 mb-2">
                    <strong>How it works:</strong>
                  </p>
                  <ul className="text-xs text-blue-200 space-y-1 list-disc list-inside">
                    <li>Customers will see this number in the payment modal</li>
                    <li>They can click "Call" to dial directly or "WhatsApp" to chat</li>
                    <li>Use this to share bank account details and accept payment confirmations</li>
                  </ul>
                </div>

                <button
                  onClick={handleUpdatePaymentPhone}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  disabled={loadingSettings}
                >
                  {loadingSettings ? 'Loading...' : 'Update Contact Number'}
                </button>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-white">Bank Transfer Details</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Configure bank account details that will be displayed to customers when they select "Bank Transfer" as their payment method.
              </p>

              {updateMessage && (
                <div className={`mb-4 p-3 rounded-lg ${
                  updateMessage.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-red-500/20 text-red-300 border border-red-500/50'
                }`}>
                  {updateMessage.text}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Bank Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankTransferDetails.bank_name}
                    onChange={(e) => setBankTransferDetails({ ...bankTransferDetails, bank_name: e.target.value })}
                    placeholder="e.g., Emirates NBD"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loadingBankDetails}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Account Holder <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankTransferDetails.account_holder}
                    onChange={(e) => setBankTransferDetails({ ...bankTransferDetails, account_holder: e.target.value })}
                    placeholder="e.g., AutoSupport Pro LLC"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loadingBankDetails}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Account Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankTransferDetails.account_number}
                    onChange={(e) => setBankTransferDetails({ ...bankTransferDetails, account_number: e.target.value })}
                    placeholder="e.g., 1234567890"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loadingBankDetails}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={bankTransferDetails.iban}
                    onChange={(e) => setBankTransferDetails({ ...bankTransferDetails, iban: e.target.value })}
                    placeholder="e.g., AE070331234567890123456"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loadingBankDetails}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    SWIFT Code
                  </label>
                  <input
                    type="text"
                    value={bankTransferDetails.swift_code}
                    onChange={(e) => setBankTransferDetails({ ...bankTransferDetails, swift_code: e.target.value })}
                    placeholder="e.g., EBILAEAD"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loadingBankDetails}
                  />
                </div>

                <button
                  onClick={handleUpdateBankTransferDetails}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  disabled={loadingBankDetails}
                >
                  {loadingBankDetails ? 'Saving...' : 'Save Bank Transfer Details'}
                </button>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-semibold text-white">Payment Methods</h2>
                </div>
                <button
                  onClick={() => {
                    setEditingPaymentMethod(null);
                    setPaymentMethodForm({
                      method_name: '',
                      method_type: '',
                      description: '',
                      is_active: true,
                      display_order: paymentMethods.length + 1
                    });
                    setShowPaymentMethodModal(true);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Method
                </button>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Manage payment methods available to customers. These options will appear in the payment dropdown on the customer dashboard.
              </p>

              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{method.method_name}</h3>
                        {method.is_active ? (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded text-xs font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm">{method.description || 'No description'}</p>
                      <p className="text-slate-500 text-xs mt-1">Type: {method.method_type} | Order: {method.display_order}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditPaymentMethod(method)}
                        className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePaymentMethod(method.id)}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {paymentMethods.length === 0 && (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No payment methods configured</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-slate-800/50 p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Headphones className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-white">Support Contact Details</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Configure contact information displayed on the Customer Support page.
              </p>

              {updateMessage && (
                <div className={`mb-4 p-3 rounded-lg ${updateMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-red-500/20 text-red-300 border border-red-500/50'}`}>
                  {updateMessage.text}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Support Phone <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={supportPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      placeholder="+971525277492"
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={loadingSettings}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Support Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="support@company.com"
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={loadingSettings}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={supportCountry}
                      onChange={(e) => setSupportCountry(e.target.value)}
                      placeholder="United Arab Emirates"
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={loadingSettings}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={supportCity}
                      onChange={(e) => setSupportCity(e.target.value)}
                      placeholder="Dubai"
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={loadingSettings}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Business Hours
                  </label>
                  <input
                    type="text"
                    value={supportHours}
                    onChange={(e) => setSupportHours(e.target.value)}
                    placeholder="24/7 or Mon-Fri: 9AM-6PM"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loadingSettings}
                  />
                </div>

                <button
                  onClick={handleUpdateSupportContact}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loadingSettings}
                >
                  {loadingSettings ? 'Updating...' : 'Update Support Contact'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedTechnician && actionType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {actionType === 'approve' && 'Approve Technician'}
              {actionType === 'on_hold' && 'Put On Hold'}
              {actionType === 'reject' && 'Reject Application'}
            </h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Technician</p>
              <p className="font-semibold text-gray-900">{selectedTechnician.full_name}</p>
              <p className="text-sm text-gray-600">{selectedTechnician.phone}</p>
            </div>

            {actionType !== 'approve' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {actionType === 'on_hold' ? 'Reason for Hold' : 'Reason for Rejection'}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={4}
                  placeholder={
                    actionType === 'on_hold'
                      ? 'e.g., Waiting for additional documentation...'
                      : 'e.g., Insufficient qualifications...'
                  }
                />
              </div>
            )}

            {actionType === 'approve' && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-800">
                  This technician will be approved and can start handling customer support tickets immediately.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedTechnician(null);
                  setActionType(null);
                  setReason('');
                }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors text-white ${
                  actionType === 'approve'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : actionType === 'on_hold'
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentMethodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl max-w-md w-full my-8 border border-slate-700 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">
                {editingPaymentMethod ? 'Edit Payment Method' : 'Add Payment Method'}
              </h2>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Method Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={paymentMethodForm.method_name}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, method_name: e.target.value })}
                  placeholder="e.g., Cash, PayPal"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Method Type <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={paymentMethodForm.method_type}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, method_type: e.target.value })}
                  placeholder="e.g., paypal, bank_transfer"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Lowercase, underscores for spaces
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={paymentMethodForm.description}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={paymentMethodForm.display_order}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Lower numbers appear first
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={paymentMethodForm.is_active}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 rounded focus:ring-orange-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-300">
                  Active (visible to customers)
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 flex gap-2">
              <button
                onClick={() => {
                  setShowPaymentMethodModal(false);
                  setEditingPaymentMethod(null);
                  setPaymentMethodForm({
                    method_name: '',
                    method_type: '',
                    description: '',
                    is_active: true,
                    display_order: 0
                  });
                }}
                className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentMethodSubmit}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {editingPaymentMethod ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
