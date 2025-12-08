import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { CheckCircle, X, Car, Calendar, DollarSign, Zap } from 'lucide-react';

type SubscriptionPlan = {
  id: string;
  plan_name: string;
  plan_type: string;
  billing_cycle: string;
  plan_category: string;
  price_monthly: number;
  visits_per_month: number;
  max_vehicles: number;
  description: string;
  features: any;
  is_active: boolean;
};

interface SubscriptionPlansProps {
  customerId: string;
  onSubscribed?: (subscriptionId: string) => void;
  onClose?: () => void;
}

export default function SubscriptionPlans({ customerId, onSubscribed, onClose }: SubscriptionPlansProps) {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(1);
  const [vehicles, setVehicles] = useState<Array<{
    make: string;
    model: string;
    year: string;
    vin: string;
    license_plate: string;
  }>>([{ make: '', model: '', year: '', vin: '', license_plate: '' }]);
  const [subscribing, setSubscribing] = useState(false);
  const [vinErrors, setVinErrors] = useState<{ [key: number]: string }>({});

  // VIN validation: 17 alphanumeric characters, no special characters
  const validateVIN = (vin: string): string | null => {
    if (!vin) return null; // Optional field, no error if empty
    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length !== 17) {
      return 'VIN must be exactly 17 characters';
    }
    if (!/^[A-Z0-9]{17}$/.test(cleaned)) {
      return 'VIN must contain only letters and numbers (no special characters)';
    }
    return null;
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowVehicleForm(true);
    setVehicleCount(plan.max_vehicles === 1 ? 1 : 2);
    setVehicles(Array(plan.max_vehicles === 1 ? 1 : 2).fill({
      make: '', model: '', year: '', vin: '', license_plate: ''
    }));
  };

  const handleVehicleChange = (index: number, field: string, value: string) => {
    const updated = [...vehicles];
    
    // For VIN field: convert to uppercase and remove special characters as user types
    if (field === 'vin') {
      // Remove special characters and convert to uppercase
      const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      // Limit to 17 characters
      const limited = cleaned.slice(0, 17);
      updated[index] = { ...updated[index], [field]: limited };
      
      // Validate VIN
      const error = validateVIN(limited);
      if (error) {
        setVinErrors({ ...vinErrors, [index]: error });
      } else {
        const newErrors = { ...vinErrors };
        delete newErrors[index];
        setVinErrors(newErrors);
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setVehicles(updated);
  };

  const addVehicle = () => {
    if (selectedPlan && vehicles.length < selectedPlan.max_vehicles) {
      setVehicles([...vehicles, { make: '', model: '', year: '', vin: '', license_plate: '' }]);
      setVehicleCount(vehicles.length + 1);
    }
  };

  const removeVehicle = (index: number) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter((_, i) => i !== index));
      setVehicleCount(vehicles.length - 1);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    // Validate all VINs before submitting
    const vinValidationErrors: { [key: number]: string } = {};
    vehicles.forEach((vehicle, index) => {
      if (vehicle.vin) {
        const error = validateVIN(vehicle.vin);
        if (error) {
          vinValidationErrors[index] = error;
        }
      }
    });

    if (Object.keys(vinValidationErrors).length > 0) {
      setVinErrors(vinValidationErrors);
      alert('Please fix VIN errors before submitting. VIN must be exactly 17 alphanumeric characters.');
      return;
    }

    setSubscribing(true);
    try {
      const { data: existingSubs } = await supabase
        .from('customer_subscriptions')
        .select('id, status, payment_confirmed')
        .eq('user_id', customerId)
        .in('status', ['pending_payment', 'active']);

      if (existingSubs && existingSubs.length > 0) {
        const pending = existingSubs.find(s => s.status === 'pending_payment' && !s.payment_confirmed);
        if (pending) {
          alert('You already have a pending subscription. Please complete the payment for your existing subscription first.');
          setSubscribing(false);
          return;
        }
        const active = existingSubs.find(s => s.status === 'active' && s.payment_confirmed);
        if (active) {
          alert('You already have an active subscription. Please contact admin to upgrade or change your plan.');
          setSubscribing(false);
          return;
        }
      }

      const { data: subscriptionData, error: subError } = await supabase
        .from('customer_subscriptions')
        .insert({
          user_id: customerId,
          subscription_plan_id: selectedPlan.id,
          status: 'pending_payment',
          start_date: new Date().toISOString(),
          auto_renew: true,
          vehicle_count: vehicleCount
        })
        .select()
        .single();

      if (subError) throw subError;

      for (const vehicle of vehicles) {
        if (vehicle.make && vehicle.model) {
          const { error: vehicleError } = await supabase
            .from('customer_vehicle_folders')
            .insert({
              customer_id: customerId,
              vehicle_make: vehicle.make,
              vehicle_model: vehicle.model,
              vehicle_year: vehicle.year ? parseInt(vehicle.year) : null,
              vehicle_vin: vehicle.vin || null,
              license_plate: vehicle.license_plate || null,
              subscription_plan_id: selectedPlan.id,
              customer_subscription_id: subscriptionData.id,
              subscription_status: 'pending_payment',
              subscription_start_date: new Date().toISOString()
            });

          if (vehicleError) throw vehicleError;
        }
      }

      if (onSubscribed) onSubscribed(subscriptionData.id);
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Error subscribing:', error);
      alert('Error activating subscription: ' + error.message);
    } finally {
      setSubscribing(false);
    }
  };

  const carDocPlans = plans.filter(p => p.plan_category === 'cardoc');
  const autoDocPlans = plans.filter(p => p.plan_category === 'autodoc');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sea-500"></div>
      </div>
    );
  }

  if (showVehicleForm && selectedPlan) {
    return (
      <div className="bg-navy-900 rounded-lg shadow-lg p-3 max-w-3xl mx-auto border border-[#1E9BD7]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-white">{t('subscription.addVehicles')}{selectedPlan.max_vehicles > 1 ? '' : ''}</h2>
            <p className="text-[10px] text-white/80 mt-0.5">
              {t('subscription.selected')}: <span className="font-semibold text-[#1E9BD7]">{selectedPlan.plan_name}</span>
            </p>
          </div>
          <button
            onClick={() => setShowVehicleForm(false)}
            className="text-white/70 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-2">
          {vehicles.map((vehicle, index) => (
            <div key={index} className="border border-[#1E9BD7]/40 rounded-lg p-3 relative bg-navy-800">
              {vehicles.length > 1 && (
                <button
                  onClick={() => removeVehicle(index)}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2 text-xs">
                <Car className="w-4 h-4 text-[#1E9BD7]" />
                {t('subscription.vehicle')} {index + 1}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-white mb-1">
                    {t('vehicle.make')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vehicle.make}
                    onChange={(e) => handleVehicleChange(index, 'make', e.target.value)}
                    placeholder={t('subscription.makePlaceholder')}
                    className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:ring-2 focus:ring-[#1E9BD7] text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-white mb-1">
                    {t('vehicle.model')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vehicle.model}
                    onChange={(e) => handleVehicleChange(index, 'model', e.target.value)}
                    placeholder={t('subscription.modelPlaceholder')}
                    className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:ring-2 focus:ring-[#1E9BD7] text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-white mb-1">{t('vehicle.year')}</label>
                  <input
                    type="number"
                    value={vehicle.year}
                    onChange={(e) => handleVehicleChange(index, 'year', e.target.value)}
                    placeholder="2020"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:ring-2 focus:ring-[#1E9BD7] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-white mb-1">{t('vehicle.plateNumber')}</label>
                  <input
                    type="text"
                    value={vehicle.license_plate}
                    onChange={(e) => handleVehicleChange(index, 'license_plate', e.target.value)}
                    placeholder="ABC-1234"
                    className="w-full px-2 py-1.5 border border-[#1E9BD7]/40 bg-navy-800 text-white placeholder-white/60 rounded-lg focus:ring-2 focus:ring-[#1E9BD7] text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-white mb-1">{t('vehicle.vin')} ({t('subscription.optional')})</label>
                  <input
                    type="text"
                    value={vehicle.vin}
                    onChange={(e) => handleVehicleChange(index, 'vin', e.target.value)}
                    placeholder="1HGBH41JXMN109186"
                    maxLength={17}
                    className={`w-full px-2 py-1.5 border ${
                      vinErrors[index] 
                        ? 'border-red-500/60 bg-red-900/20' 
                        : 'border-[#1E9BD7]/40 bg-navy-800'
                    } text-white placeholder-white/60 rounded-lg focus:ring-2 focus:ring-[#1E9BD7] text-xs uppercase`}
                  />
                  {vinErrors[index] && (
                    <p className="text-[9px] text-red-400 mt-0.5">{vinErrors[index]}</p>
                  )}
                  {vehicle.vin && !vinErrors[index] && vehicle.vin.length === 17 && (
                    <p className="text-[9px] text-green-400 mt-0.5">✓ Valid VIN</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {selectedPlan.max_vehicles > 1 && vehicles.length < selectedPlan.max_vehicles && (
            <button
              onClick={addVehicle}
              className="w-full border-2 border-dashed border-[#1E9BD7]/40 rounded-lg py-2 text-white hover:border-[#1E9BD7] hover:text-[#1E9BD7] transition-all flex items-center justify-center gap-2 text-xs"
            >
              <Car className="w-4 h-4" />
              {t('subscription.addAnotherVehicle')} ({vehicles.length}/{selectedPlan.max_vehicles})
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowVehicleForm(false)}
            className="flex-1 px-3 py-1.5 border border-[#1E9BD7]/40 rounded-lg text-white font-semibold hover:bg-navy-800 transition-all text-xs"
          >
            {t('subscription.backToPlans')}
          </button>
          <button
            onClick={handleSubscribe}
            disabled={subscribing || vehicles.some(v => !v.make || !v.model) || Object.keys(vinErrors).length > 0}
            className="flex-1 px-3 py-1.5 bg-[#1E9BD7] hover:bg-[#1B8CC4] text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
          >
            {subscribing ? t('subscription.activating') : t('subscription.activateSubscription')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-3">
        <h2 className="text-base font-bold text-white mb-0.5">{t('subscription.chooseYourPlan')}</h2>
        <p className="text-[10px] text-white/80">{t('subscription.selectSubscription')}</p>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
            <Car className="w-4 h-4 text-[#1E9BD7]" />
            {t('subscription.carDocPlans')}
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {carDocPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-navy-800 border border-[#1E9BD7]/40 hover:border-[#1E9BD7] rounded-lg p-3 transition-all cursor-pointer"
                onClick={() => handlePlanSelect(plan)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="inline-block bg-[#1E9BD7]/20 text-[#1E9BD7] text-[9px] font-bold px-1.5 py-0.5 rounded mb-0.5">
                      {t('subscription.carOnly')}
                    </div>
                    <h4 className="text-xs font-bold text-white">{plan.plan_name}</h4>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-base font-bold text-orange-500">
                      ${plan.price_monthly}
                    </div>
                    <div className="text-[9px] text-white/70">
                      {plan.billing_cycle === 'monthly' ? t('subscription.perMonth') : t('subscription.perYear')}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-1 text-[10px]">
                    <Calendar className="w-3 h-3 text-orange-500" />
                    <span className="text-white">{plan.visits_per_month} {t('subscription.visits')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-white">{t('subscription.complete12System')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-gray-700">{t('subscription.support24_7Included')}</span>
                  </div>
                </div>
                <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg text-xs font-semibold transition-all">
                  {t('subscription.selectPlan')}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-orange-500" />
            {t('subscription.autoDocPlans')}
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {autoDocPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-navy-800 border border-orange-500/60 hover:border-orange-500 rounded-lg p-3 transition-all cursor-pointer relative"
                onClick={() => handlePlanSelect(plan)}
              >
                <div className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  {t('subscription.premium')}
                </div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="inline-block bg-orange-500/20 text-orange-400 text-[9px] font-bold px-1.5 py-0.5 rounded mb-0.5">
                      {t('subscription.twoCars')}
                    </div>
                    <h4 className="text-xs font-bold text-white">{plan.plan_name}</h4>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-base font-bold text-orange-500">
                      ${plan.price_monthly}
                    </div>
                    <div className="text-[9px] text-white/70">
                      {plan.billing_cycle === 'monthly' ? t('subscription.perMonth') : t('subscription.perYear')}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-1 text-[10px]">
                    <Calendar className="w-3 h-3 text-orange-500" />
                    <span className="text-white">{plan.visits_per_month} {t('subscription.visitsPerCar')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-white">{t('subscription.upTo3Vehicles')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-white">{t('subscription.priorityScheduling')}</span>
                  </div>
                </div>
                <button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-1.5 rounded-lg text-xs font-semibold transition-all">
                  {t('subscription.selectPremiumPlan')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
