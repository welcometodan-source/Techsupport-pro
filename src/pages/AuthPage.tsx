import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Wrench, Mail, Lock, User, Phone, CheckCircle, X, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhoneNumber] = useState('');
  // All signups are customers - admins can convert to technicians later
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [showEmailConfirmedModal, setShowEmailConfirmedModal] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    console.log('Auth page loaded');
    console.log('Supabase URL configured:', import.meta.env.VITE_SUPABASE_URL);
    console.log('Supabase Key configured:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Yes' : 'No');

    // Check for email confirmation callback
    const checkEmailConfirmation = async () => {
      // Check URL hash (PKCE flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // Also check query params (fallback)
      const queryParams = new URLSearchParams(window.location.search);
      const queryType = queryParams.get('type');
      const queryToken = queryParams.get('access_token');

      if ((accessToken || queryToken) && (type === 'signup' || queryType === 'signup')) {
        // Email confirmed successfully
        setShowEmailConfirmedModal(true);
        // Clear URL hash and query params
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    checkEmailConfirmation();

    // Also listen for auth state changes (Supabase handles the confirmation)
    const setupAuthListener = async () => {
      const { supabase } = await import('../lib/supabase');
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Check if this is a new user (just confirmed email)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = hashParams.get('type');
          if (type === 'signup' || window.location.hash.includes('type=signup')) {
            setShowEmailConfirmedModal(true);
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanup = setupAuthListener();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone || phone.trim().length === 0) {
      return false;
    }
    
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Must have exactly 10 digits (standard phone number) or 11-15 digits (with country code)
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return false;
    }
    
    // Additional validation: Check for common invalid patterns
    // All same digits (e.g., 1111111111)
    if (/^(\d)\1{9,}$/.test(digitsOnly)) {
      return false;
    }
    
    // Must start with a valid digit (not 0 for most countries, but allow for international)
    // For now, we'll allow any starting digit as long as it's 10-15 digits
    
    return true;
  };

  const validateFullName = (name: string): boolean => {
    // Must have at least 2 words (first and last name)
    const words = name.trim().split(/\s+/);
    if (words.length < 2) return false;

    // Each word must be at least 2 characters and contain only letters
    return words.every(word => {
      return word.length >= 2 && /^[a-zA-Z]+$/.test(word);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate email format
      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      if (isLogin) {
        console.log('Login attempt starting...');
        const { error } = await signIn(email, password);
        if (error) {
          console.error('Login failed with error:', error);
          let errorMessage = 'Failed to sign in. Please try again.';

          if (error.message?.includes('Invalid login credentials')) {
            errorMessage = 'Invalid email or password. Please check your credentials.';
          } else if (error.message?.includes('Email not confirmed')) {
            errorMessage = 'Please confirm your email address before signing in.';
          } else if (error.message) {
            errorMessage = error.message;
          }

          setError(errorMessage);
        } else {
          console.log('Login successful, navigating to dashboard...');
          navigate('/dashboard');
        }
      } else {
        // Validate all signup fields
        if (!fullName || !phone) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }

        // Validate full name
        if (!validateFullName(fullName)) {
          setError('Please enter a valid full name (first and last name, letters only)');
          setLoading(false);
          return;
        }

        // Validate phone number (STRICT validation)
        if (!phone || phone.trim().length === 0) {
          setError('Phone number is required');
          setLoading(false);
          return;
        }
        
        if (!validatePhone(phone)) {
          const digitsOnly = phone.replace(/\D/g, '');
          if (digitsOnly.length < 10) {
            setError('Phone number must have at least 10 digits');
          } else if (digitsOnly.length > 15) {
            setError('Phone number cannot exceed 15 digits');
          } else {
            setError('Please enter a valid phone number (10-15 digits, numbers only)');
          }
          setLoading(false);
          return;
        }

        // Validate password strength
        if (password.length < 8) {
          setError('Password must be at least 8 characters long');
          setLoading(false);
          return;
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
          setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
          setLoading(false);
          return;
        }

        console.log('Starting signup process...');
        const { error } = await signUp(email, password, {
          full_name: fullName.trim(),
          phone: phone.replace(/\D/g, ''),
          role: 'customer' // All signups are customers - admins can convert to technicians later
        });

        if (error) {
          console.error('Signup failed:', error);
          setError(error.message || 'Failed to sign up');
        } else {
          console.log('Signup successful - email confirmation required');
          // Show email confirmation modal instead of redirecting
          setShowEmailConfirmationModal(true);
          // Clear form
          setFullName('');
          setPhoneNumber('');
          setPassword('');
        }
      }
    } catch (err: any) {
      console.error('Caught exception during auth:', err);
      const errorMessage = err.message || 'Network error. Please check your internet connection and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) throw error;

      setSuccess('Password reset email sent! Please check your inbox.');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const highlightStats = [
    { label: 'Vehicles diagnosed', value: '18K+', accent: 'text-orange-400' },
    { label: 'Avg. response time', value: '12m', accent: 'text-cyan-300' },
    { label: 'Technicians on-call', value: '320+', accent: 'text-emerald-300' }
  ];

  const reliabilityPoints = [
    'Secure PKCE authentication with Supabase',
    'Role-based dashboards for customers, techs & admins',
    'Real-time notifications, visits, and ticket updates'
  ];

  return (
    <div className="min-h-screen bg-[#02122b] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#031735] via-[#031027] to-[#020a18]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,118,255,0.18),transparent_45%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(5,211,252,0.14),transparent_55%)]"></div>
        <img
          src="/1681207234023.jpeg"
          alt="Automotive technology"
          className="w-full h-full object-cover opacity-[0.12] mix-blend-screen"
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-200/80">AutoSupport</p>
                <h1 className="text-white text-2xl font-bold">Professional automotive diagnostics platform</h1>
              </div>
            </div>
          </div>

          <div className="bg-[#071431]/95 border border-white/5 rounded-3xl p-6 shadow-[0_30px_60px_rgba(2,9,27,0.7)]">
            <div className="flex items-center justify-end mb-4 text-white">
              <LanguageSwitcher />
            </div>

            {!showForgotPassword && (
              <div className="flex gap-1 mb-4 p-1 bg-white/5 rounded-2xl border border-white/10">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isLogin
                      ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-blue-900/30'
                      : 'text-blue-100/70 hover:text-white'
                  }`}
                >
                  {t('auth.signIn')}
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    !isLogin
                      ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-blue-900/30'
                      : 'text-blue-100/70 hover:text-white'
                  }`}
                >
                  {t('auth.signUp')}
                </button>
              </div>
            )}

            {showForgotPassword && (
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white mb-1">Reset Password</h2>
                <p className="text-slate-300/80 text-xs">
                  Enter your account email and we’ll send you a secure reset link.
                </p>
              </div>
            )}

            <form onSubmit={showForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-3">
              {!isLogin && !showForgotPassword && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-blue-100/80 mb-1">{t('auth.fullName')}</label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 group-focus-within:text-white transition-colors" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-[#050f24] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 transition-all"
                        placeholder="John Doe"
                        required={!isLogin}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">First and last name required (letters only)</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-blue-100/80 mb-1">
                      {t('auth.phoneNumber')} <span className="text-red-400">*</span>
                    </label>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 group-focus-within:text-white transition-colors" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow digits, spaces, dashes, parentheses, and + for formatting
                          const cleaned = value.replace(/[^\d\s\-\(\)\+]/g, '');
                          setPhoneNumber(cleaned);
                        }}
                        onBlur={() => {
                          // Validate on blur
                          if (phone && !validatePhone(phone)) {
                            const digitsOnly = phone.replace(/\D/g, '');
                            if (digitsOnly.length < 10) {
                              setError('Phone number must have at least 10 digits');
                            } else if (digitsOnly.length > 15) {
                              setError('Phone number cannot exceed 15 digits');
                            }
                          }
                        }}
                        className={`w-full pl-9 pr-3 py-2 text-sm bg-[#050f24] border rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all ${
                          phone && !validatePhone(phone)
                            ? 'border-red-500/50 focus:ring-red-500/40 focus:border-red-400'
                            : phone && validatePhone(phone)
                            ? 'border-green-500/50 focus:ring-green-500/40 focus:border-green-400'
                            : 'border-white/10 focus:ring-sky-500/40 focus:border-sky-400'
                        }`}
                        placeholder="+1234567890 or 1234567890"
                        required={!isLogin}
                        minLength={10}
                        maxLength={20}
                      />
                      {phone && (
                        <div className="mt-1">
                          {validatePhone(phone) ? (
                            <p className="text-[10px] text-green-400 flex items-center gap-1">
                              <span>✓</span> Valid phone number ({phone.replace(/\D/g, '').length} digits)
                            </p>
                          ) : (
                            <p className="text-[10px] text-red-400">
                              {phone.replace(/\D/g, '').length < 10
                                ? 'Must have at least 10 digits'
                                : phone.replace(/\D/g, '').length > 15
                                ? 'Cannot exceed 15 digits'
                                : 'Invalid phone number format'}
                            </p>
                          )}
                        </div>
                      )}
                      {!phone && (
                        <p className="text-[10px] text-slate-400 mt-1">Required: 10-15 digits (numbers only)</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-blue-100/80 mb-1">{t('auth.email')}</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 group-focus-within:text-white transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[#050f24] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {!showForgotPassword && (
                <div>
                  <label className="block text-xs font-semibold text-blue-100/80 mb-1">{t('auth.password')}</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 group-focus-within:text-white transition-colors" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-[#050f24] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 transition-all"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                    {!isLogin && (
                      <p className="text-[10px] text-slate-400 mt-1">Min 8 chars, include uppercase, lowercase & number.</p>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-3 py-2 rounded-lg text-xs">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 px-3 py-2 rounded-lg text-xs">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-500 via-blue-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:from-slate-500 disabled:to-slate-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-900/40"
              >
                {loading
                  ? t('common.loading')
                  : showForgotPassword
                  ? 'Send Reset Link'
                  : isLogin
                  ? t('auth.signIn')
                  : t('auth.createAccount')}
              </button>

              {isLogin && !showForgotPassword && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sky-300 hover:text-white text-xs font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {showForgotPassword && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-sky-300 hover:text-white text-xs font-medium transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              )}
            </form>

            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              <button onClick={() => navigate('/')} className="text-sky-300 hover:text-white text-xs font-medium">
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Confirmation Modal - After Signup */}
      {showEmailConfirmationModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-orange-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Check Your Email</h2>
              </div>
              <button
                onClick={() => setShowEmailConfirmationModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-slate-300">
                We've sent a confirmation email to <span className="font-semibold text-white">{email}</span>
              </p>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-200">
                    <p className="font-semibold mb-1">Please confirm your email address:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-300/90">
                      <li>Check your inbox (and spam folder)</li>
                      <li>Click the confirmation link in the email</li>
                      <li>You'll be redirected back to the app</li>
                      <li>Then you can sign in to your dashboard</li>
                    </ol>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEmailConfirmationModal(false);
                  setIsLogin(true);
                  setEmail('');
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-lg font-semibold hover:from-sky-600 hover:to-blue-600 transition-all"
              >
                Got it, I'll check my email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Confirmed Success Modal */}
      {showEmailConfirmedModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-xl border border-white/10">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-white">Email Confirmed Successfully!</h2>
              <p className="text-slate-300">
                Your email address has been verified. You can now go back to the app and sign in to your dashboard.
              </p>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm text-green-200">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Your account is ready to use!
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEmailConfirmedModal(false);
                  setIsLogin(true);
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
