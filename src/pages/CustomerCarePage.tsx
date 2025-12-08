import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Clock, Headphones, ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CustomerCarePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState({
    phone: '+971525277492',
    email: 'support@autosupportpro.com',
    country: 'United Arab Emirates',
    city: 'Dubai',
    hours: '24/7'
  });

  useEffect(() => {
    loadContactInfo();
  }, []);

  const loadContactInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['support_phone', 'support_email', 'support_country', 'support_city', 'support_hours']);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // Initialize with default values
      const newContactInfo = {
        phone: '+971525277492',
        email: 'support@autosupportpro.com',
        country: 'United Arab Emirates',
        city: 'Dubai',
        hours: '24/7'
      };

      // Update with data from database
      if (data && data.length > 0) {
        data.forEach(setting => {
          if (setting.setting_value) {
            switch (setting.setting_key) {
              case 'support_phone':
                newContactInfo.phone = setting.setting_value;
                break;
              case 'support_email':
                newContactInfo.email = setting.setting_value;
                break;
              case 'support_country':
                newContactInfo.country = setting.setting_value;
                break;
              case 'support_city':
                newContactInfo.city = setting.setting_value;
                break;
              case 'support_hours':
                newContactInfo.hours = setting.setting_value;
                break;
            }
          }
        });
      }
      
      setContactInfo(newContactInfo);
    } catch (error) {
      console.error('Error loading contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  const phoneNumber = contactInfo.phone;
  const whatsappNumber = contactInfo.phone.replace(/[^0-9]/g, '');

  return (
    <div className="page-shell theme-alt">
      <nav className="bg-white/5 border-b border-white/10 backdrop-blur-2xl shadow-[0_20px_60px_rgba(1,6,15,0.6)]">
        <div className="max-w-5xl mx-auto px-3">
          <div className="flex justify-between items-center h-10">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-sky-400/50 transition-all text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-1.5 text-white">
              <Headphones className="w-4 h-4 text-sky-300" />
              <span className="font-semibold text-sm">Support</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-3 pt-4 pb-4 relative z-10">
        <div className="text-center mb-3">
          <h1 className="text-base sm:text-lg font-bold text-white mb-1">Contact Support</h1>
          <p className="text-slate-300 text-[10px]">Available 24/7 for your automotive needs</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              <div className="absolute inset-0 bg-sky-500/30 blur-xl rounded-full"></div>
              <div className="relative w-10 h-10 border-3 border-sky-400/40 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-2 mb-3">
              <a
                href={`tel:${phoneNumber}`}
                className="glass-card p-2.5 border border-white/10 hover:border-sky-400/50 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-sky-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-sky-500/20 transition-colors">
                    <Phone className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-white mb-0.5">Phone</h3>
                    <p className="text-cyan-300 font-medium text-[10px] truncate">{phoneNumber}</p>
                  </div>
                </div>
              </a>

              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card p-2.5 border border-white/10 hover:border-emerald-400/50 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-green-500/20 transition-colors">
                    <MessageCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-white mb-0.5">WhatsApp</h3>
                    <p className="text-green-400 font-medium text-[10px] truncate">{phoneNumber}</p>
                  </div>
                </div>
              </a>

              <a
                href={`mailto:${contactInfo.email}`}
                className="glass-card p-2.5 border border-white/10 hover:border-purple-400/50 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-colors">
                    <Mail className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-white mb-0.5">Email</h3>
                    <p className="text-purple-300 font-medium text-[10px] truncate">{contactInfo.email}</p>
                  </div>
                </div>
              </a>
            </div>
          </>
        )}

        {!loading && (
          <div className="grid md:grid-cols-2 gap-2">
            <div className="glass-card p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-semibold text-white">Location</h2>
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-cyan-300/80">Country:</span>
                  <span className="text-white font-medium">{contactInfo.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyan-300/80">City:</span>
                  <span className="text-white font-medium">{contactInfo.city}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-semibold text-white">Hours</h2>
              </div>
              <div className="text-[10px]">
                <div className="flex justify-between">
                  <span className="text-cyan-300/80">Available:</span>
                  <span className="text-white font-medium">{contactInfo.hours}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
