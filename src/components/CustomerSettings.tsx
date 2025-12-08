import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Upload, Palette, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface CustomerPreferences {
  id?: string;
  customer_id: string;
  background_type: 'color' | 'gradient' | 'image';
  background_value: string;
  background_image_url: string | null;
  primary_color: string;
  secondary_color: string;
  card_style: 'default' | 'rounded' | 'sharp' | 'glass';
  font_size: 'small' | 'medium' | 'large';
}

interface CustomerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: CustomerPreferences) => void;
  currentPreferences: CustomerPreferences | null;
  darkMode: boolean;
}

export default function CustomerSettings({ isOpen, onClose, onSave, currentPreferences, darkMode }: CustomerSettingsProps) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<CustomerPreferences>({
    customer_id: user?.id || '',
    background_type: 'color',
    background_value: '#f3f4f6',
    background_image_url: null,
    primary_color: '#f97316',
    secondary_color: '#fb923c',
    card_style: 'default',
    font_size: 'medium'
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
    }
  }, [currentPreferences]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('customer-backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('customer-backgrounds')
        .getPublicUrl(fileName);

      setPreferences({
        ...preferences,
        background_type: 'image',
        background_image_url: urlData.publicUrl
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('customer_preferences')
        .upsert({
          ...preferences,
          customer_id: user.id
        });

      if (error) throw error;

      onSave(preferences);
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const colorPresets = [
    { name: 'Gray', value: '#f3f4f6' },
    { name: 'Orange', value: '#fb923c' },
    { name: 'Blue', value: '#60a5fa' },
    { name: 'Green', value: '#4ade80' },
    { name: 'Purple', value: '#c084fc' },
    { name: 'Red', value: '#f87171' },
    { name: 'Dark', value: '#1f2937' },
    { name: 'Black', value: '#000000' }
  ];

  const gradientPresets = [
    { name: 'Sunset', value: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)' },
    { name: 'Ocean', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: 'Forest', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { name: 'Fire', value: 'linear-gradient(135deg, #f83600 0%, #f9d423 100%)' },
    { name: 'Sky', value: 'linear-gradient(135deg, #0575e6 0%, #00f260 100%)' }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className={`max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-lg shadow-xl ${darkMode ? 'bg-[#02122b] text-white border border-white/10' : 'bg-white text-gray-900'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-white/10 dark:border-gray-700 bg-inherit backdrop-blur-sm">
          <h2 className="text-base sm:text-lg md:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
            <Palette className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-orange-500" />
            <span className="hidden sm:inline">Customize Your Dashboard</span>
            <span className="sm:hidden">Customize</span>
          </h2>
          <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-white/10 dark:hover:bg-gray-700 rounded-full transition">
            <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Background Type Selection */}
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Background Style</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => setPreferences({ ...preferences, background_type: 'color' })}
                className={`p-2 sm:p-3 md:p-4 rounded-lg border-2 transition ${
                  preferences.background_type === 'color'
                    ? 'border-orange-500 bg-orange-500/20 dark:bg-orange-900/20'
                    : 'border-white/20 dark:border-gray-600'
                }`}
              >
                <Palette className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 mx-auto mb-1 sm:mb-2 text-orange-500" />
                <p className="text-[10px] sm:text-xs md:text-sm font-medium">Solid Color</p>
              </button>
              <button
                onClick={() => setPreferences({ ...preferences, background_type: 'gradient' })}
                className={`p-2 sm:p-3 md:p-4 rounded-lg border-2 transition ${
                  preferences.background_type === 'gradient'
                    ? 'border-orange-500 bg-orange-500/20 dark:bg-orange-900/20'
                    : 'border-white/20 dark:border-gray-600'
                }`}
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 mx-auto mb-1 sm:mb-2 rounded bg-gradient-to-r from-orange-500 to-pink-500" />
                <p className="text-[10px] sm:text-xs md:text-sm font-medium">Gradient</p>
              </button>
              <button
                onClick={() => setPreferences({ ...preferences, background_type: 'image' })}
                className={`p-2 sm:p-3 md:p-4 rounded-lg border-2 transition ${
                  preferences.background_type === 'image'
                    ? 'border-orange-500 bg-orange-500/20 dark:bg-orange-900/20'
                    : 'border-white/20 dark:border-gray-600'
                }`}
              >
                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 mx-auto mb-1 sm:mb-2 text-orange-500" />
                <p className="text-[10px] sm:text-xs md:text-sm font-medium">Custom Image</p>
              </button>
            </div>
          </div>

          {/* Solid Color Selection */}
          {preferences.background_type === 'color' && (
            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Choose Background Color</h3>
              <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setPreferences({ ...preferences, background_value: preset.value })}
                    className={`p-2 sm:p-3 md:p-4 rounded-lg border-2 transition ${
                      preferences.background_value === preset.value
                        ? 'border-orange-500 ring-2 ring-orange-500/20'
                        : 'border-white/20 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: preset.value }}
                  >
                    <p className="text-[9px] sm:text-[10px] md:text-xs font-medium text-white drop-shadow-lg">{preset.name}</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <label className="text-xs sm:text-sm font-medium">Custom Color:</label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="color"
                    value={preferences.background_value}
                    onChange={(e) => setPreferences({ ...preferences, background_value: e.target.value })}
                    className="w-16 h-8 sm:w-20 sm:h-10 rounded cursor-pointer"
                  />
                  <span className="text-[10px] sm:text-xs md:text-sm font-mono">{preferences.background_value}</span>
                </div>
              </div>
            </div>
          )}

          {/* Gradient Selection */}
          {preferences.background_type === 'gradient' && (
            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Choose Gradient</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {gradientPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setPreferences({ ...preferences, background_value: preset.value })}
                    className={`p-3 sm:p-4 md:p-6 rounded-lg border-2 transition ${
                      preferences.background_value === preset.value
                        ? 'border-orange-500 ring-2 ring-orange-500/20'
                        : 'border-white/20 dark:border-gray-600'
                    }`}
                    style={{ background: preset.value }}
                  >
                    <p className="text-[10px] sm:text-xs md:text-sm font-bold text-white drop-shadow-lg">{preset.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Upload */}
          {preferences.background_type === 'image' && (
            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Upload Background Image</h3>
              <div className={`border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 text-center ${darkMode ? 'border-white/20' : 'border-gray-300'}`}>
                {preferences.background_image_url ? (
                  <div className="space-y-2 sm:space-y-3">
                    <img
                      src={preferences.background_image_url}
                      alt="Background preview"
                      className="w-full h-32 sm:h-40 md:h-48 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => document.getElementById('image-upload')?.click()}
                      className="text-orange-500 hover:text-orange-600 font-medium text-xs sm:text-sm"
                    >
                      Change Image
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                    <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 mb-2 sm:mb-3">Upload a background image</p>
                    <button
                      onClick={() => document.getElementById('image-upload')?.click()}
                      disabled={uploading}
                      className="bg-orange-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 text-xs sm:text-sm"
                    >
                      {uploading ? 'Uploading...' : 'Choose Image'}
                    </button>
                  </div>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Card Style */}
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Card Style</h3>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {(['default', 'rounded', 'sharp', 'glass'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setPreferences({ ...preferences, card_style: style })}
                  className={`p-2 sm:p-3 md:p-4 rounded-lg border-2 transition capitalize text-[10px] sm:text-xs md:text-sm ${
                    preferences.card_style === style
                      ? 'border-orange-500 bg-orange-500/20 dark:bg-orange-900/20'
                      : 'border-white/20 dark:border-gray-600'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Font Size</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPreferences({ ...preferences, font_size: size })}
                  className={`p-2 sm:p-3 md:p-4 rounded-lg border-2 transition capitalize text-[10px] sm:text-xs md:text-sm ${
                    preferences.font_size === size
                      ? 'border-orange-500 bg-orange-500/20 dark:bg-orange-900/20'
                      : 'border-white/20 dark:border-gray-600'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Color */}
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Accent Color</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <input
                  type="color"
                  value={preferences.primary_color}
                  onChange={(e) => setPreferences({ ...preferences, primary_color: e.target.value })}
                  className="w-16 h-8 sm:w-20 sm:h-10 rounded cursor-pointer"
                />
                <span className="text-[10px] sm:text-xs md:text-sm font-mono">{preferences.primary_color}</span>
              </div>
              <span className="text-[10px] sm:text-xs md:text-sm text-gray-500">Used for buttons and highlights</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between p-3 sm:p-4 md:p-6 border-t border-white/10 dark:border-gray-700 bg-inherit backdrop-blur-sm">
          <button
            onClick={onClose}
            className={`px-4 py-1.5 sm:px-5 sm:py-2 md:px-6 md:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
              darkMode ? 'bg-white/10 hover:bg-white/20 border border-white/20' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-500 text-white px-4 py-1.5 sm:px-5 sm:py-2 md:px-6 md:py-2 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
          >
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
