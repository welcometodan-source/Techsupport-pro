import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, Trash2, CheckCircle, Users } from 'lucide-react';

/**
 * Admin-only page to delete ALL non-admin users from the system
 * Handles customers, technicians, and any other roles besides admin
 */
export default function DeleteAllCustomers() {
  const { profile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [technicianCount, setTechnicianCount] = useState<number | null>(null);
  const [otherUserCount, setOtherUserCount] = useState<number | null>(null);
  const [nonAdminCount, setNonAdminCount] = useState<number | null>(null);

  // Check if user is admin
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#02122b]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-300">Only admins can access this page.</p>
        </div>
      </div>
    );
  }

  const loadUserCounts = async () => {
    try {
      const [{ count: customers, error: customersError }, { count: technicians, error: techniciansError }, { count: nonAdmins, error: nonAdminError }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'technician'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'admin')
      ]);

      if (customersError) throw customersError;
      if (techniciansError) throw techniciansError;
      if (nonAdminError) throw nonAdminError;

      setCustomerCount(customers || 0);
      setTechnicianCount(technicians || 0);
      setNonAdminCount(nonAdmins || 0);
      const other = (nonAdmins || 0) - (customers || 0) - (technicians || 0);
      setOtherUserCount(other > 0 ? other : 0);
    } catch (err) {
      console.error('Error loading user counts:', err);
    }
  };

  // Load counts on mount
  useEffect(() => {
    loadUserCounts();
  }, []);

  const deleteAllUsers = async () => {
    const confirmMessage = `⚠️ WARNING: This will PERMANENTLY delete ALL users except admins!\n\n` +
      `This includes every technician, customer, and any other non-admin role.\n` +
      `All related data will be removed:\n` +
      `• Support tickets & chat history\n` +
      `• Subscriptions, visits, inspections\n` +
      `• Payments, invoices, uploaded media\n` +
      `• Vehicle folders, documents, preferences, etc.\n\n` +
      `This action CANNOT be undone.\n\n` +
      `Type "DELETE ALL USERS" to confirm:`;

    const userInput = prompt(confirmMessage);
    if (userInput !== 'DELETE ALL USERS') {
      setError('Deletion cancelled. You must type "DELETE ALL USERS" exactly.');
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(false);
    setProgress('Starting deletion process...');

    try {
      setProgress('Loading all non-admin users...');
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .neq('role', 'admin');

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        setProgress('No non-admin users found to delete.');
        setSuccess(true);
        setDeleting(false);
        return;
      }

      const totalUsers = users.length;
      setProgress(`Found ${totalUsers} non-admin users. Deleting...`);

      let deleted = 0;
      let failed = 0;

      for (const userRecord of users) {
        try {
          setProgress(`Deleting ${userRecord.full_name} (${userRecord.role}) ${deleted + 1}/${totalUsers}...`);

          const { error: deleteError } = await supabase.rpc('delete_user_completely', {
            target_user_id: userRecord.id
          });

          if (deleteError) {
            console.error(`Failed to delete ${userRecord.full_name}:`, deleteError);
            failed++;
          } else {
            deleted++;
          }
        } catch (err) {
          console.error(`Error deleting ${userRecord.full_name}:`, err);
          failed++;
        }
      }

      setProgress(`Deletion complete! Deleted: ${deleted}, Failed: ${failed}`);
      
      // Clean up any orphaned auth users (users in auth.users but not in profiles)
      setProgress('Cleaning up orphaned auth users...');
      try {
        const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_orphaned_auth_users');
        if (cleanupError) {
          console.warn('Cleanup warning:', cleanupError);
        } else if (cleanupResult && cleanupResult > 0) {
          setProgress(`Cleaned up ${cleanupResult} orphaned auth users.`);
        }
      } catch (cleanupErr) {
        console.warn('Cleanup error (non-critical):', cleanupErr);
      }
      
      setSuccess(true);
      setNonAdminCount(0);
      setCustomerCount(0);
      setTechnicianCount(0);
      setOtherUserCount(0);

      await loadUserCounts();
    } catch (err: any) {
      console.error('Error deleting users:', err);
      setError(err.message || 'Failed to delete users. Check console for details.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen page-shell theme-surface">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass-card border border-red-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Reset Application Data</h1>
              <p className="text-slate-300 text-sm">Delete every non-admin user (customers, technicians, etc.)</p>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-300 mb-2">⚠️ Critical Warning</h3>
                <p className="text-slate-300 text-sm mb-2">
                  This action will permanently delete <strong>ALL</strong> non-admin accounts and their data:
                </p>
                <ul className="text-slate-300 text-sm space-y-1 list-disc list-inside mb-2">
                  <li>All customer & technician profiles plus their authentication accounts</li>
                  <li>All support tickets and chat history</li>
                  <li>All subscriptions, visits, inspection reports</li>
                  <li>All payments, invoices, and transaction history</li>
                  <li>All vehicle folders and documents</li>
                  <li>All related data in both systems</li>
                </ul>
                <p className="text-red-300 font-semibold">
                  This action CANNOT be undone!
                </p>
              </div>
            </div>
          </div>

          {(customerCount !== null || technicianCount !== null || nonAdminCount !== null) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-slate-300 text-sm">
                  <strong className="text-white">Customers:</strong> {customerCount ?? '—'}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-slate-300 text-sm">
                  <strong className="text-white">Technicians:</strong> {technicianCount ?? '—'}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 sm:col-span-2">
                <p className="text-slate-300 text-sm">
                  <strong className="text-white">Other Non-Admin Roles:</strong> {otherUserCount ?? '—'}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 sm:col-span-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-200" />
                <p className="text-slate-300 text-sm">
                  <strong className="text-white">Total Non-Admin Users:</strong> {nonAdminCount ?? '—'}
                </p>
              </div>
            </div>
          )}

          {progress && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-300 text-sm">{progress}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-green-300 text-sm font-semibold">
                  All non-admin users deleted successfully!
                </p>
              </div>
            </div>
          )}

          <button
            onClick={deleteAllUsers}
            disabled={deleting || (nonAdminCount !== null && nonAdminCount === 0)}
            className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Deleting users...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                <span>Delete All Non-Admin Users</span>
              </>
            )}
          </button>

          {nonAdminCount === 0 && (
            <p className="text-center text-slate-400 text-sm mt-4">
              No non-admin users to delete. The system is clean.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

