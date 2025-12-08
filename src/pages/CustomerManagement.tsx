import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Search,
  Mail,
  MessageCircle,
  Phone,
  User,
  Filter,
  Download,
  MoreVertical,
  X,
  Send,
  CheckSquare,
  Square,
  Crown,
  Moon,
  Sun
} from 'lucide-react';
import { VipBadge } from '../components/VipBadge';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  status: string;
  vip_tier: string | null;
  email?: string;
  ticket_count?: number;
}

export default function CustomerManagement() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVipTier, setFilterVipTier] = useState('all');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('adminCustomerTheme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/');
      return;
    }
    loadCustomers();
  }, [profile]);

  useEffect(() => {
    applyFilters();
  }, [customers, searchTerm, filterStatus, filterVipTier]);

  useEffect(() => {
    localStorage.setItem('adminCustomerTheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('customer_id');

      const ticketCounts = tickets?.reduce((acc: any, ticket) => {
        acc[ticket.customer_id] = (acc[ticket.customer_id] || 0) + 1;
        return acc;
      }, {});

      const { data: subscriptionCustomers } = await supabase
        .from('customer_subscriptions')
        .select(`
          user_id,
          customer:profiles!customer_subscriptions_user_id_fkey(*)
        `)
        .not('status', 'eq', 'cancelled');

      const customerMap = new Map<string, Customer>();

      const mapProfileToCustomer = (profileData: any): Customer => ({
        id: profileData.id,
        full_name: profileData.full_name || 'Unnamed Customer',
        phone: profileData.phone || null,
        avatar_url: profileData.avatar_url || null,
        created_at: profileData.created_at,
        status: profileData.status || 'active',
        vip_tier: profileData.vip_tier || null,
        email: profileData.email || '',
        ticket_count: ticketCounts?.[profileData.id] || 0
      });

      profiles?.forEach((profile: any) => {
        customerMap.set(profile.id, mapProfileToCustomer(profile));
      });

      subscriptionCustomers?.forEach((subscription: any) => {
        if (subscription.customer) {
          customerMap.set(subscription.customer.id, mapProfileToCustomer(subscription.customer));
        }
      });

      setCustomers(Array.from(customerMap.values()));
    } catch (error) {
      console.error('Error loading customers:', error);
      alert('Failed to load customers. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...customers];

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(customer => customer.status === filterStatus);
    }

    if (filterVipTier !== 'all') {
      if (filterVipTier === 'none') {
        filtered = filtered.filter(customer => !customer.vip_tier);
      } else {
        filtered = filtered.filter(customer => customer.vip_tier === filterVipTier);
      }
    }

    setFilteredCustomers(filtered);
  };

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  const getSelectedCustomersData = () => {
    return customers.filter(c => selectedCustomers.includes(c.id));
  };

  const handleSendEmail = (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setSelectedCustomers([customer.id]);
    }
    setShowEmailModal(true);
  };

  const handleSendWhatsApp = (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setSelectedCustomers([customer.id]);
    }
    setShowWhatsAppModal(true);
  };

  const exportCustomers = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Status', 'VIP Tier', 'Tickets', 'Joined Date'],
      ...filteredCustomers.map(c => [
        c.full_name,
        c.email || '',
        c.phone || '',
        c.status,
        c.vip_tier || 'None',
        c.ticket_count || 0,
        new Date(c.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className={`page-shell theme-surface ${darkMode ? 'theme-alt' : ''}`}>
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6">
        <header className="glass-card px-4 py-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/admin')}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Customer Management</h1>
                <p className="text-xs text-slate-300">Manage and communicate with all customers</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all"
                title={darkMode ? 'Switch to light mode' : 'Switch to vibrant mode'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={exportCustomers}
                className="px-3 py-1.5 rounded-xl font-semibold flex items-center space-x-1.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-900/30 hover:from-sky-400 hover:to-blue-500 transition-all text-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </header>

        <div className="pb-8">
        <div className={`rounded-lg shadow-sm border p-3 mb-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className={`w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
            <select
              value={filterVipTier}
              onChange={(e) => setFilterVipTier(e.target.value)}
              className={`px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="all">All VIP Tiers</option>
              <option value="none">No VIP</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="diamond">Diamond</option>
              <option value="vip">VIP</option>
              <option value="vvip">VVIP</option>
            </select>
          </div>

          {selectedCustomers.length > 0 && (
            <div className="mt-4 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg p-3">
              <span className="text-sm font-medium text-orange-900">
                {selectedCustomers.length} customer{selectedCustomers.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSendEmail()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span>Email All</span>
                </button>
                <button
                  onClick={() => handleSendWhatsApp()}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp All</span>
                </button>
                <button
                  onClick={() => setSelectedCustomers([])}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <User className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>No customers found</h3>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className={`rounded-lg shadow-sm border overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${darkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button onClick={toggleSelectAll}>
                        {selectedCustomers.length === filteredCustomers.length ? (
                          <CheckSquare className="w-5 h-5 text-orange-500" />
                        ) : (
                          <Square className={`w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                      </button>
                    </th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Customer</th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Email</th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Phone</th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>VIP Tier</th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tickets</th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Joined</th>
                    <th className={`px-2 py-1.5 text-left text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className={darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                      <td className="px-2 py-1.5">
                        <button onClick={() => toggleCustomerSelection(customer.id)}>
                          {selectedCustomers.includes(customer.id) ? (
                            <CheckSquare className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Square className={`w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold text-xs">
                            {customer.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-medium text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>{customer.full_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-2 py-1.5 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{customer.email || '-'}</td>
                      <td className={`px-2 py-1.5 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{customer.phone || '-'}</td>
                      <td className="px-2 py-1.5">
                        {customer.vip_tier ? (
                          <VipBadge tier={customer.vip_tier as 'vip' | 'vvip' | 'gold' | 'diamond' | 'silver' | 'cardoc' | 'autodoc'} size="sm" />
                        ) : (
                          <span className="text-[10px] text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
                          {customer.ticket_count || 0} tickets
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          customer.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className={`px-2 py-1.5 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleSendEmail(customer)}
                            className={`p-1.5 rounded transition-colors ${
                              darkMode
                                ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30'
                                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                            title="Send Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          {customer.phone && (
                            <>
                              <button
                                onClick={() => handleSendWhatsApp(customer)}
                                className={`p-1.5 rounded transition-colors ${
                                  darkMode
                                    ? 'text-green-400 hover:text-green-300 hover:bg-green-900/30'
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                }`}
                                title="Send WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                              <a
                                href={`tel:${customer.phone}`}
                                className={`p-1.5 rounded transition-colors ${
                                  darkMode
                                    ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-900/30'
                                    : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                                }`}
                                title="Call"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`rounded-lg shadow-sm border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Customers</p>
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{customers.length}</p>
              </div>
              <User className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className={`rounded-lg shadow-sm border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>VIP Customers</p>
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {customers.filter(c => c.vip_tier).length}
                </p>
              </div>
              <Crown className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className={`rounded-lg shadow-sm border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active</p>
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {customers.filter(c => c.status === 'active').length}
                </p>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-green-900/30' : 'bg-green-100'}`}>
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
              </div>
            </div>
          </div>
          <div className={`rounded-lg shadow-sm border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Blocked</p>
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {customers.filter(c => c.status === 'blocked').length}
                </p>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {showEmailModal && (
        <EmailModal
          customers={getSelectedCustomersData()}
          onClose={() => {
            setShowEmailModal(false);
            setSelectedCustomer(null);
          }}
        />
      )}

      {showWhatsAppModal && (
        <WhatsAppModal
          customers={getSelectedCustomersData()}
          onClose={() => {
            setShowWhatsAppModal(false);
            setSelectedCustomer(null);
          }}
        />
      )}
    </div>
  );
}

function EmailModal({ customers, onClose }: { customers: Customer[]; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      const emails = customers.map(c => c.email).filter(Boolean);

      console.log('Sending emails to:', emails);
      console.log('Subject:', subject);
      console.log('Message:', message);

      alert(`Email prepared for ${emails.length} customer(s). In production, this would integrate with your email service (SendGrid, AWS SES, etc.)`);

      onClose();
    } catch (error) {
      console.error('Error sending emails:', error);
      alert('Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Send Email</h2>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Sending to {customers.length} customer{customers.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
            <div className="flex flex-wrap gap-2">
              {customers.map(customer => (
                <span key={customer.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                  {customer.full_name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Email subject"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Type your message here..."
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This is a demo. In production, integrate with email services like SendGrid, AWS SES, or Mailgun.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
            >
              <Send className="w-5 h-5" />
              <span>{sending ? 'Sending...' : 'Send Email'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppModal({ customers, onClose }: { customers: Customer[]; onClose: () => void }) {
  const [message, setMessage] = useState('');

  const handleSendToAll = () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    const customersWithPhone = customers.filter(c => c.phone);
    const baseUrl = 'https://wa.me/';
    const encodedMessage = encodeURIComponent(message);

    customersWithPhone.forEach((customer, index) => {
      const phone = customer.phone!.replace(/[^0-9]/g, '');
      const url = `${baseUrl}${phone}?text=${encodedMessage}`;

      setTimeout(() => {
        window.open(url, '_blank');
      }, index * 1000);
    });

    alert(`Opening WhatsApp for ${customersWithPhone.length} customer(s)`);
  };

  const handleSendIndividual = (customer: Customer) => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    if (!customer.phone) {
      alert('This customer has no phone number');
      return;
    }

    const phone = customer.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Send WhatsApp Message</h2>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Sending to {customers.filter(c => c.phone).length} customer{customers.filter(c => c.phone).length > 1 ? 's' : ''} with phone numbers
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {customers.map(customer => (
                <div key={customer.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">{customer.full_name}</span>
                    {customer.phone ? (
                      <span className="text-sm text-gray-600">• {customer.phone}</span>
                    ) : (
                      <span className="text-sm text-red-600">• No phone</span>
                    )}
                  </div>
                  {customer.phone && (
                    <button
                      onClick={() => handleSendIndividual(customer)}
                      className="text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                      Send
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Type your WhatsApp message here..."
            />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>Note:</strong> This will open WhatsApp Web/App for each customer. Messages will be pre-filled but you need to press send manually.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendToAll}
              disabled={!message.trim() || customers.filter(c => c.phone).length === 0}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Open WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}