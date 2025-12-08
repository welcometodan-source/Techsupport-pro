import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Package, AlertTriangle, Search, Edit2, TrendingDown } from 'lucide-react';

interface InventoryItem {
  id: string;
  part_number: string;
  part_name: string;
  description: string | null;
  category: string;
  manufacturer: string | null;
  quantity_in_stock: number;
  minimum_stock_level: number;
  unit_cost: number;
  selling_price: number;
  location: string | null;
  is_active: boolean;
}

interface LowStockAlert {
  id: string;
  alert_level: string;
  current_quantity: number;
  minimum_required: number;
  item: InventoryItem;
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadInventory();
    loadAlerts();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true)
        .order('part_name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('low_stock_alerts')
        .select(`
          *,
          item:item_id (*)
        `)
        .eq('is_resolved', false)
        .order('alert_level', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.part_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { value: 'engine_parts', label: 'Engine Parts' },
    { value: 'transmission', label: 'Transmission' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'brakes', label: 'Brakes' },
    { value: 'suspension', label: 'Suspension' },
    { value: 'cooling', label: 'Cooling' },
    { value: 'fuel_system', label: 'Fuel System' },
    { value: 'exhaust', label: 'Exhaust' },
    { value: 'body_parts', label: 'Body Parts' },
    { value: 'fluids', label: 'Fluids' },
    { value: 'filters', label: 'Filters' },
    { value: 'other', label: 'Other' }
  ];

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity_in_stock === 0) {
      return { color: 'red', label: 'Out of Stock', bgColor: 'bg-red-500/20', textColor: 'text-red-300 border border-red-400/30' };
    } else if (item.quantity_in_stock <= item.minimum_stock_level) {
      return { color: 'yellow', label: 'Low Stock', bgColor: 'bg-amber-500/20', textColor: 'text-amber-300 border border-amber-400/30' };
    } else {
      return { color: 'green', label: 'In Stock', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-300 border border-emerald-400/30' };
    }
  };

  if (profile?.role === 'customer') {
    navigate('/dashboard');
    return null;
  }

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
              <h1 className="text-sm sm:text-base font-bold text-white">Inventory Management</h1>
              <p className="text-[10px] text-slate-300">Track parts, stock levels, and alerts</p>
            </div>
          </div>
          {profile?.role === 'admin' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-2 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>
      </header>

      <div className="p-2 sm:p-3">
        {alerts.length > 0 && (
          <div className="mb-6 glass-card border border-red-400/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">Low Stock Alerts ({alerts.length})</h3>
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((alert: any) => (
                    <div key={alert.id} className="text-sm text-red-300">
                      <span className="font-medium">{alert.item.part_name}</span> -
                      Only {alert.current_quantity} left (Min: {alert.minimum_required})
                    </div>
                  ))}
                  {alerts.length > 3 && (
                    <p className="text-sm text-red-400">+ {alerts.length - 3} more items</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by part name or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 text-white placeholder-slate-400"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 text-white"
          >
            <option value="all" className="bg-[#050f24]">All Categories</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value} className="bg-[#050f24]">{cat.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="relative mx-auto w-12 h-12">
              <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
              <div className="relative w-full h-full border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-slate-300">Loading inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 glass-card">
            <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Items Found</h3>
            <p className="text-slate-300">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="glass-card border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Part Number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Part Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Unit Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Selling Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Location</th>
                    {profile?.role === 'admin' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredItems.map((item) => {
                    const status = getStockStatus(item);
                    return (
                      <tr key={item.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-sm font-mono text-white">{item.part_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-white">{item.part_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{item.category.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-white">
                          {item.quantity_in_stock}
                          <span className="text-slate-400 font-normal text-xs ml-1">
                            (min: {item.minimum_stock_level})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white">${item.unit_cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-white">${item.selling_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{item.location || '-'}</td>
                        {profile?.role === 'admin' && (
                          <td className="px-4 py-3">
                            <button className="text-orange-400 hover:text-orange-300">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Total Items</p>
                <p className="text-2xl font-bold text-white">{items.length}</p>
              </div>
              <Package className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          <div className="glass-card border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Low Stock Items</p>
                <p className="text-2xl font-bold text-amber-300">
                  {items.filter(i => i.quantity_in_stock > 0 && i.quantity_in_stock <= i.minimum_stock_level).length}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          <div className="glass-card border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Out of Stock</p>
                <p className="text-2xl font-bold text-red-300">
                  {items.filter(i => i.quantity_in_stock === 0).length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}