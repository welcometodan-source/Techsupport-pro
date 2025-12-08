import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Smartphone, ArrowLeft, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function AppDownloadPage() {
  const navigate = useNavigate();
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const android = /android/i.test(userAgent);
    const ios = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    
    setIsAndroid(android);
    setIsIOS(ios);

    // Set download URL - you'll need to update this with your actual APK URL
    // For now, using a placeholder that you can replace with your hosted APK URL
    const apkUrl = import.meta.env.VITE_APK_DOWNLOAD_URL || '/app-release.apk';
    setDownloadUrl(apkUrl);
  }, []);

  const handleDownload = () => {
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'AutoSupport-Pro.apk';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              <h1 className="text-sm sm:text-base font-bold text-white">Download App</h1>
              <p className="text-[10px] text-slate-300">Install AutoSupport Pro</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {/* App Info Card */}
        <div className="glass-card border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AutoSupport Pro</h2>
              <p className="text-sm text-slate-300">Expert Automotive Assistance</p>
            </div>
          </div>
        </div>

        {/* Download Instructions */}
        <div className="glass-card border border-white/10 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Installation Instructions</h3>
          
          {isAndroid ? (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white mb-1">Android Device Detected</p>
                    <p className="text-xs text-slate-300">Tap the download button below to install the app.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-orange-400">1</span>
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Download the APK</p>
                    <p className="text-xs text-slate-300">Tap the download button below</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-orange-400">2</span>
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Allow Installation</p>
                    <p className="text-xs text-slate-300">When prompted, allow "Install from Unknown Sources"</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-orange-400">3</span>
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Install & Launch</p>
                    <p className="text-xs text-slate-300">Tap "Install" and then "Open" to start using the app</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg"
              >
                <Download className="w-5 h-5" />
                <span>Download APK</span>
              </button>
            </div>
          ) : isIOS ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white mb-1">iOS Device Detected</p>
                  <p className="text-xs text-slate-300 mb-2">
                    iOS app installation requires App Store distribution or TestFlight. 
                    Please contact your administrator for iOS installation instructions.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Smartphone className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white mb-1">Desktop Browser Detected</p>
                    <p className="text-xs text-slate-300">
                      For the best experience, please scan the QR code on this page using your mobile device, 
                      or visit this page directly on your Android phone.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg"
              >
                <Download className="w-5 h-5" />
                <span>Download APK</span>
              </button>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="glass-card border border-amber-500/20 rounded-xl p-4 bg-amber-500/5">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white mb-1">Security Notice</p>
              <p className="text-xs text-slate-300">
                This app is distributed outside of the Google Play Store. Android may warn you about installing 
                from unknown sources. This is normal for direct APK installations. The app is safe to install.
              </p>
            </div>
          </div>
        </div>

        {/* Alternative Download Methods */}
        <div className="mt-6">
          <p className="text-xs text-slate-400 text-center mb-4">
            Having trouble? Try these alternatives:
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.open(downloadUrl, '_blank')}
              className="flex-1 glass-card border border-white/10 rounded-lg p-3 hover:border-sky-400/50 transition-all text-center"
            >
              <ExternalLink className="w-4 h-4 text-sky-400 mx-auto mb-1" />
              <p className="text-xs text-white font-medium">Open in New Tab</p>
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="flex-1 glass-card border border-white/10 rounded-lg p-3 hover:border-sky-400/50 transition-all text-center"
            >
              <CheckCircle className="w-4 h-4 text-sky-400 mx-auto mb-1" />
              <p className="text-xs text-white font-medium">Copy Link</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

