import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Download, Smartphone, Copy, CheckCircle, Share2 } from 'lucide-react';

export default function QRCodePage() {
  const navigate = useNavigate();
  const [downloadUrl, setDownloadUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Get the current URL and construct the download page URL
    const baseUrl = window.location.origin;
    const downloadPageUrl = `${baseUrl}/download-app`;
    setDownloadUrl(downloadPageUrl);
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AutoSupport Pro - Download App',
          text: 'Download and install AutoSupport Pro app',
          url: downloadUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to copy
      handleCopyLink();
    }
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
              <h1 className="text-sm sm:text-base font-bold text-white">Install App</h1>
              <p className="text-[10px] text-slate-300">Scan QR code to download</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {/* Instructions Card */}
        <div className="glass-card border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AutoSupport Pro</h2>
              <p className="text-sm text-slate-300">Scan to install on your device</p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-slate-300 mb-6">
            <p>1. Open your phone's camera app</p>
            <p>2. Point it at the QR code below</p>
            <p>3. Tap the notification to open the download page</p>
            <p>4. Follow the installation instructions</p>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="glass-card border border-white/10 rounded-xl p-8 mb-6">
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl mb-4 shadow-lg">
              <QRCodeSVG
                value={downloadUrl}
                size={256}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
            
            <p className="text-sm text-slate-300 text-center mb-4">
              Scan this QR code with your phone's camera
            </p>

            {/* Download URL Display */}
            <div className="w-full max-w-md">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-400 mb-1">Download Link:</p>
                <p className="text-xs text-white font-mono break-all">{downloadUrl}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => window.open(downloadUrl, '_blank')}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Open Download Page</span>
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className="flex-1 glass-card border border-white/10 hover:border-sky-400/50 text-white py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-all"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              {navigator.share && (
                <button
                  onClick={handleShare}
                  className="w-full mt-3 glass-card border border-white/10 hover:border-sky-400/50 text-white py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Link</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="glass-card border border-blue-500/20 rounded-xl p-4 bg-blue-500/5">
          <h3 className="text-sm font-semibold text-white mb-2">Need Help?</h3>
          <div className="space-y-2 text-xs text-slate-300">
            <p><strong>Can't scan the QR code?</strong></p>
            <p>• Tap "Open Download Page" button above</p>
            <p>• Or copy the link and open it on your phone</p>
            <p className="mt-3"><strong>Installation issues?</strong></p>
            <p>• Make sure "Install from Unknown Sources" is enabled</p>
            <p>• Check that you have enough storage space</p>
            <p>• Try downloading on a different network</p>
          </div>
        </div>
      </div>
    </div>
  );
}

