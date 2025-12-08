import { useNavigate } from 'react-router-dom';
import { Wrench, Phone, MessageSquare, Shield, Clock, Users, Headphones, Zap, CircleCheck as CheckCircle, ArrowRight, Star, TrendingUp, Award, Video, Calendar, FileText, DollarSign, Heart, Clipboard } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-navy-900" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <nav 
        className="fixed top-0 left-0 right-0 bg-navy-900/95 backdrop-blur-xl border-b border-navy-800 z-50 shadow-lg"
        style={{ 
          paddingTop: 'env(safe-area-inset-top, 0px)',
          top: 0
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 sm:h-16">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <div className="w-7 h-7 sm:w-10 sm:h-10 bg-gradient-to-br from-navy-600 to-navy-800 rounded-lg flex items-center justify-center shadow-md">
                <Wrench className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-xs sm:text-base lg:text-lg font-bold text-white">{t('landing.title')}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <LanguageSwitcher />
              <button
                onClick={() => navigate('/customer-care')}
                className="text-gray-300 hover:text-white px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-1 text-[10px] sm:text-sm hover:bg-navy-800"
              >
                <Headphones className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{t('common.support')}</span>
              </button>
              <button
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-r from-navy-600 to-navy-800 hover:from-navy-700 hover:to-navy-900 text-white px-2.5 py-1 sm:px-5 sm:py-2.5 rounded-lg font-semibold transition-all text-[10px] sm:text-sm shadow-md hover:shadow-lg"
              >
                {t('landing.getStarted')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section 
        className="pb-6 sm:pb-16 lg:pb-20 px-3 sm:px-6 lg:px-8 relative overflow-hidden min-h-[500px] sm:min-h-[700px] flex items-center" 
        style={{ 
          paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px) + 0.5rem)', 
          marginTop: 'calc(3rem + env(safe-area-inset-top, 0px))' 
        }}
      >
        <div className="absolute inset-0">
          <img
            src="/1681207234023.jpeg"
            alt="Automotive technology"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/95 via-navy-900/90 to-navy-900"></div>
        </div>

        <div className="max-w-5xl mx-auto relative z-10 w-full">
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 bg-navy-800/80 border border-navy-600 rounded-full px-2.5 py-1 sm:px-4 sm:py-1.5 mb-3 sm:mb-6">
              <Zap className="w-3 h-3 sm:w-5 sm:h-5 text-navy-300" />
              <span className="text-[10px] sm:text-sm font-semibold text-white">{t('landing.trustedBy')}</span>
            </div>
            <h1 className="text-xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 sm:mb-6 leading-tight">
              {t('landing.yourCarHealth')}
            </h1>
            <p className="text-xs sm:text-lg md:text-xl text-white/90 mb-4 sm:mb-8 leading-relaxed max-w-3xl mx-auto sm:mx-0">
              {t('landing.carDocDescription')}
            </p>
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-6 mb-4 sm:mb-8">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-navy-400 to-navy-600 border-2 border-white"></div>
                  <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-navy-400 to-navy-600 border-2 border-white"></div>
                  <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-white"></div>
                </div>
                <div>
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-white font-bold text-sm sm:text-lg">4.9/5</span>
                  </div>
                  <div className="text-white/80 text-[10px] sm:text-base">5,000+ {t('landing.reviews')}</div>
                </div>
              </div>
              <div className="h-10 w-px bg-navy-800/30 hidden sm:block"></div>
              <div>
                <div className="text-white font-bold text-lg sm:text-3xl">95%</div>
                <div className="text-white/80 text-[10px] sm:text-base">{t('landing.resolution')}</div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 mb-4">
              <button
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto bg-gradient-to-r from-navy-600 to-navy-800 hover:from-navy-700 hover:to-navy-900 text-white px-4 py-2 sm:px-8 sm:py-3.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg hover:shadow-xl text-xs sm:text-base"
              >
                <span>{t('landing.getStarted')}</span>
                <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={() => navigate('/customer-care')}
                className="w-full sm:w-auto bg-navy-800/20 hover:bg-navy-800/30 backdrop-blur-sm border-2 border-white/30 text-white px-4 py-2 sm:px-8 sm:py-3.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 text-xs sm:text-base hover:border-white/50"
              >
                <Phone className="w-4 h-4 sm:w-6 sm:h-6" />
                <span>{t('landing.talkToExpert')}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-6 text-[10px] sm:text-base text-navy-300">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-green-500" />
                <span>{t('landing.noCreditCard')}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-green-500" />
                <span>{t('landing.cancelAnytime')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-16 lg:py-20 px-3 sm:px-6 lg:px-8 bg-gradient-to-b from-sea-600 via-sea-500 to-sea-600">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 bg-sea-700 border border-sea-800 rounded-full px-2.5 py-1 sm:px-4 sm:py-2 mb-2 sm:mb-4">
              <Award className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-white" />
              <span className="text-[10px] sm:text-base font-semibold text-white">{t('landing.whyChooseUs')}</span>
            </div>
            <h2 className="text-lg sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">{t('landing.whyCarDocSaves')}</h2>
            <p className="text-white/90 text-xs sm:text-lg max-w-3xl mx-auto">{t('landing.preventativeMaintenance')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div className="bg-navy-800 border border-navy-700 rounded-lg sm:rounded-xl p-3 sm:p-6 hover:border-navy-600 hover:shadow-xl transition-all hover:transform hover:scale-105">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-sea-500 rounded-lg flex items-center justify-center mb-2 sm:mb-4 shadow-lg">
                <Calendar className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-sm sm:text-xl font-bold text-white mb-1 sm:mb-2">{t('landing.scheduledVisits')}</h3>
              <p className="text-white/80 text-xs sm:text-base mb-2 sm:mb-4">{t('landing.scheduledVisitsDesc')}</p>
              <div className="flex items-center gap-1.5 text-sea-400 text-xs sm:text-base font-semibold">
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
                <span>{t('landing.regularCheckups')}</span>
              </div>
            </div>

            <div className="bg-navy-800 border border-navy-700 rounded-lg sm:rounded-xl p-3 sm:p-6 hover:border-navy-600 hover:shadow-xl transition-all hover:transform hover:scale-105">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-sea-500 rounded-lg flex items-center justify-center mb-2 sm:mb-4 shadow-lg">
                <Clipboard className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-sm sm:text-xl font-bold text-white mb-1 sm:mb-2">{t('landing.completeDiagnostics')}</h3>
              <p className="text-white/80 text-xs sm:text-base mb-2 sm:mb-4">{t('landing.completeDiagnosticsDesc')}</p>
              <div className="flex items-center gap-1.5 text-sea-400 text-xs sm:text-base font-semibold">
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
                <span>{t('landing.fullInspection')}</span>
              </div>
            </div>

            <div className="bg-navy-800 border border-navy-700 rounded-lg sm:rounded-xl p-3 sm:p-6 hover:border-navy-600 hover:shadow-xl transition-all hover:transform hover:scale-105">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-sea-500 rounded-lg flex items-center justify-center mb-2 sm:mb-4 shadow-lg">
                <FileText className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-sm sm:text-xl font-bold text-white mb-1 sm:mb-2">{t('landing.detailedReportsTitle')}</h3>
              <p className="text-white/80 text-xs sm:text-base mb-2 sm:mb-4">{t('landing.detailedReportsDesc')}</p>
              <div className="flex items-center gap-1.5 text-sea-400 text-xs sm:text-base font-semibold">
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
                <span>{t('landing.completeHistory')}</span>
              </div>
            </div>

            <div className="bg-navy-800 border border-navy-700 rounded-lg sm:rounded-xl p-3 sm:p-6 hover:border-navy-600 hover:shadow-xl transition-all hover:transform hover:scale-105">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-sea-500 rounded-lg flex items-center justify-center mb-2 sm:mb-4 shadow-lg">
                <DollarSign className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-sm sm:text-xl font-bold text-white mb-1 sm:mb-2">{t('landing.saveThousands')}</h3>
              <p className="text-white/80 text-xs sm:text-base mb-2 sm:mb-4">{t('landing.saveThousandsDesc')}</p>
              <div className="flex items-center gap-1.5 text-sea-400 text-xs sm:text-base font-semibold">
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
                <span>{t('landing.costTracking')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-16 lg:py-20 px-3 sm:px-6 lg:px-8 bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 bg-navy-800/20 border border-orange-500/30 rounded-full px-2.5 py-1 sm:px-4 sm:py-2 mb-2 sm:mb-4">
              <Heart className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-orange-400" />
              <span className="text-[10px] sm:text-base font-medium text-orange-400">{t('subscription.plans')}</span>
            </div>
            <h2 className="text-lg sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">{t('subscription.chooseYourPlan')}</h2>
            <p className="text-navy-300 max-w-3xl mx-auto text-xs sm:text-lg px-2 sm:px-4">
              {t('subscription.subscribeToCarDoc')} <span className="text-navy-500 font-bold">{t('subscription.carDoc')}</span> {t('auth.or')} <span className="text-navy-500 font-bold">{t('subscription.autoDoc')}</span> {t('subscription.andLetExperts')}
            </p>
          </div>

          <div className="text-center mb-4 sm:mb-8">
            <div className="inline-flex items-center gap-2 bg-navy-900/50 border border-navy-700 rounded-lg px-3 py-1 sm:px-6 sm:py-2">
              <span className="text-white text-xs sm:text-base">{t('subscription.monthly')}</span>
              <span className="text-navy-500">|</span>
              <span className="text-white text-xs sm:text-base">{t('subscription.yearly')} <span className="text-green-500 font-bold">({t('subscription.save10')})</span></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-8 mb-4 sm:mb-8">
            <div className="bg-navy-950/50 border-2 border-navy-800 hover:border-orange-500/50 rounded-lg sm:rounded-xl p-3 sm:p-8 transition-all hover:shadow-xl">
              <div className="flex items-start justify-between mb-3 sm:mb-6">
                <div>
                  <div className="inline-block bg-blue-500/20 text-blue-400 text-[10px] sm:text-sm font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded mb-1 sm:mb-2">
                    {t('subscription.oneCar')}
                  </div>
                  <h3 className="text-base sm:text-2xl font-bold text-white">{t('subscription.carDoc')}</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl sm:text-4xl font-bold text-navy-500">$139</div>
                  <div className="text-xs sm:text-base text-navy-300">{t('subscription.xPerWeek')}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-6 text-xs sm:text-base">
                <div className="bg-navy-900/50 rounded-lg px-2 py-2 sm:px-4 sm:py-3 text-center">
                  <div className="text-orange-400 font-bold text-sm sm:text-xl">$139/mo</div>
                  <div className="text-navy-300 text-[10px] sm:text-sm">4 {t('subscription.visitsMo')}</div>
                </div>
                <div className="bg-navy-900/50 rounded-lg px-2 py-2 sm:px-4 sm:py-3 text-center">
                  <div className="text-orange-400 font-bold text-sm sm:text-xl">$280/mo</div>
                  <div className="text-navy-300 text-[10px] sm:text-sm">8 {t('subscription.visitsMo')}</div>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-6">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base">{t('subscription.oneVehicle')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base">{t('subscription.complete12System')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base">{t('subscription.reportsTracking')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base">{t('subscription.support24_7')}</span>
                </div>
              </div>
              <div className="text-center text-xs sm:text-base text-green-400 font-semibold mb-2 sm:mb-4">
                {t('subscription.yearlySave')}
              </div>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-navy-700 hover:bg-navy-600 text-white py-2 sm:py-3.5 rounded-lg text-xs sm:text-base font-semibold transition-all hover:shadow-lg"
              >
                {t('subscription.getCarDoc')}
              </button>
            </div>

            <div className="bg-gradient-to-br from-orange-500/10 to-red-600/10 border-2 border-orange-500 rounded-lg sm:rounded-xl p-3 sm:p-8 relative transition-all hover:shadow-xl">
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-orange-500 text-white text-[10px] sm:text-sm font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                {t('subscription.premium')}
              </div>
              <div className="flex items-start justify-between mb-3 sm:mb-6">
                <div>
                  <div className="inline-block bg-navy-800/20 text-orange-400 text-[10px] sm:text-sm font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded mb-1 sm:mb-2">
                    {t('subscription.twoCars')}
                  </div>
                  <h3 className="text-base sm:text-2xl font-bold text-white">{t('subscription.autoDoc')}</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl sm:text-4xl font-bold text-navy-500">$399</div>
                  <div className="text-xs sm:text-base text-navy-300">{t('subscription.xPerWeek')}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-6 text-xs sm:text-base">
                <div className="bg-navy-900/50 rounded-lg px-2 py-2 sm:px-4 sm:py-3 text-center">
                  <div className="text-orange-400 font-bold text-sm sm:text-xl">$399/mo</div>
                  <div className="text-navy-300 text-[10px] sm:text-sm">4 {t('subscription.visitsPerCar')}</div>
                </div>
                <div className="bg-navy-900/50 rounded-lg px-2 py-2 sm:px-4 sm:py-3 text-center">
                  <div className="text-orange-400 font-bold text-sm sm:text-xl">$699/mo</div>
                  <div className="text-navy-300 text-[10px] sm:text-sm">8 {t('subscription.visitsPerCar')}</div>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-6">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base font-semibold">{t('subscription.upTo3Vehicles')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base">{t('subscription.priorityScheduling')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base">{t('subscription.advancedDiagnostics')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                  <span className="text-white text-xs sm:text-base">{t('subscription.fleetDashboard')}</span>
                </div>
              </div>
              <div className="text-center text-xs sm:text-base text-green-400 font-semibold mb-2 sm:mb-4">
                {t('subscription.yearlySave')}
              </div>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-gradient-to-r from-sea-500 to-navy-600 hover:from-sea-600 hover:to-navy-700 text-white py-2 sm:py-3.5 rounded-lg text-xs sm:text-base font-semibold transition-all hover:shadow-lg"
              >
                {t('subscription.getAutoDoc')}
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-navy-800 rounded-lg sm:rounded-xl p-4 sm:p-8 lg:p-10 text-center">
            <h3 className="text-lg sm:text-3xl font-bold text-white mb-4 sm:mb-8">{t('subscription.howItWorks')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 mb-4 sm:mb-8">
              <div>
                <div className="w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-br from-sea-500 to-navy-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4 shadow-lg">
                  <span className="text-xl sm:text-3xl font-bold text-white">1</span>
                </div>
                <h4 className="text-white font-bold mb-1 sm:mb-2 text-sm sm:text-xl">{t('subscription.subscribeStep')}</h4>
                <p className="text-navy-300 text-xs sm:text-base">{t('subscription.subscribeStepDesc')}</p>
              </div>
              <div>
                <div className="w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-br from-sea-500 to-navy-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4 shadow-lg">
                  <span className="text-xl sm:text-3xl font-bold text-white">2</span>
                </div>
                <h4 className="text-white font-bold mb-1 sm:mb-2 text-sm sm:text-xl">{t('subscription.weVisitYou')}</h4>
                <p className="text-navy-300 text-xs sm:text-base">{t('subscription.weVisitYouDesc')}</p>
              </div>
              <div>
                <div className="w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-br from-sea-500 to-navy-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4 shadow-lg">
                  <span className="text-xl sm:text-3xl font-bold text-white">3</span>
                </div>
                <h4 className="text-white font-bold mb-1 sm:mb-2 text-sm sm:text-xl">{t('subscription.getReport')}</h4>
                <p className="text-navy-300 text-xs sm:text-base">{t('subscription.getReportDesc')}</p>
              </div>
            </div>
            <div className="mt-4 sm:mt-6 bg-navy-800/20 border border-orange-500/30 rounded-lg sm:rounded-xl p-3 sm:p-6">
              <p className="text-white text-sm sm:text-xl font-semibold mb-1 sm:mb-2">{t('landing.needUrgentSupport')}</p>
              <p className="text-white text-xs sm:text-base mb-3 sm:mb-4">
                {t('landing.urgentSupportDesc')}
              </p>
              <button
                onClick={() => navigate('/customer-care')}
                className="bg-navy-800 text-white hover:bg-navy-700 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold transition-all inline-flex items-center gap-1.5 text-xs sm:text-base shadow-lg hover:shadow-xl"
              >
                <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6" />
                <span>{t('landing.contactSupport')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-16 lg:py-20 px-3 sm:px-6 lg:px-8 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-sea-500 to-navy-600 rounded-lg sm:rounded-xl p-4 sm:p-10 lg:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 sm:w-96 sm:h-96 bg-navy-800/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-96 sm:h-96 bg-navy-900/20 rounded-full blur-3xl"></div>
            <div className="relative z-10 text-center">
              <h2 className="text-lg sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">{t('landing.readyToTransform')}</h2>
              <p className="text-white/90 mb-4 sm:mb-8 text-xs sm:text-lg max-w-3xl mx-auto">{t('landing.joinSatisfied')}</p>
              <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2 sm:gap-4 mb-4 sm:mb-6">
                <button
                  onClick={() => navigate('/auth')}
                  className="bg-white text-navy-800 hover:bg-gray-100 px-4 py-2 sm:px-8 sm:py-4 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl text-xs sm:text-base"
                >
                  {t('landing.startFreeToday')}
                </button>
                <button
                  onClick={() => navigate('/customer-care')}
                  className="bg-navy-900/30 hover:bg-navy-900/50 backdrop-blur-sm border-2 border-white/50 text-white px-4 py-2 sm:px-8 sm:py-4 rounded-lg font-bold transition-all text-xs sm:text-base hover:border-white/70"
                >
                  {t('landing.scheduleDemo')}
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-6 text-white/90 text-xs sm:text-base">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6" />
                  <span>{t('landing.noCreditCard')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6" />
                  <span>{t('landing.expertSupport24_7')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6" />
                  <span>{t('landing.cancelAnytime')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-16 lg:py-20 px-3 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-12">
            <div className="text-center p-4 sm:p-8 bg-navy-900/30 rounded-lg sm:rounded-xl border border-navy-800 hover:border-navy-700 transition-all">
              <div className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-1 sm:mb-2">10,000+</div>
              <div className="text-navy-300 text-xs sm:text-base">{t('landing.activeUsers')}</div>
            </div>
            <div className="text-center p-4 sm:p-8 bg-navy-900/30 rounded-lg sm:rounded-xl border border-navy-800 hover:border-navy-700 transition-all">
              <div className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-1 sm:mb-2">50,000+</div>
              <div className="text-navy-300 text-xs sm:text-base">{t('landing.issuesResolved')}</div>
            </div>
            <div className="text-center p-4 sm:p-8 bg-navy-900/30 rounded-lg sm:rounded-xl border border-navy-800 hover:border-navy-700 transition-all">
              <div className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-1 sm:mb-2">4.9/5</div>
              <div className="text-navy-300 text-xs sm:text-base">{t('landing.averageRating')}</div>
            </div>
          </div>

          <div className="bg-navy-900/30 rounded-lg sm:rounded-xl border border-navy-800 p-4 sm:p-8">
            <div className="text-center mb-4 sm:mb-8">
              <h3 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2">{t('landing.whatCustomersSay')}</h3>
              <p className="text-navy-300 text-xs sm:text-base">{t('landing.realFeedback')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
              <div className="bg-navy-950/50 rounded-lg sm:rounded-xl p-3 sm:p-6 border border-navy-800 hover:border-navy-700 transition-all">
                <div className="flex items-center gap-0.5 mb-2 sm:mb-3">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                </div>
                <p className="text-white text-xs sm:text-base mb-2 sm:mb-4 leading-relaxed">"CarDoc Weekly subscription saved me over $5,000! My garage wanted to replace 6 parts, but CarDoc found it was just one sensor. Game changer!"</p>
                <div className="text-white font-semibold text-xs sm:text-base">Ahmed Al-Mansouri</div>
                <div className="text-navy-500 text-[10px] sm:text-sm">CarDoc Weekly Subscriber</div>
              </div>
              <div className="bg-navy-950/50 rounded-lg sm:rounded-xl p-3 sm:p-6 border border-navy-800 hover:border-navy-700 transition-all">
                <div className="flex items-center gap-0.5 mb-2 sm:mb-3">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                </div>
                <p className="text-white text-xs sm:text-base mb-2 sm:mb-4 leading-relaxed">"AutoDoc Premium is worth every penny. Weekly inspections keep my car running perfectly, and I have a complete history of everything."</p>
                <div className="text-white font-semibold text-xs sm:text-base">Sarah Johnson</div>
                <div className="text-navy-500 text-[10px] sm:text-sm">AutoDoc Premium Subscriber</div>
              </div>
              <div className="bg-navy-950/50 rounded-lg sm:rounded-xl p-3 sm:p-6 border border-navy-800 hover:border-navy-700 transition-all">
                <div className="flex items-center gap-0.5 mb-2 sm:mb-3">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                </div>
                <p className="text-white text-xs sm:text-base mb-2 sm:mb-4 leading-relaxed">"The detailed reports after each visit are incredible. I know exactly what needs attention and when. No more surprise garage bills!"</p>
                <div className="text-white font-semibold text-xs sm:text-base">Mohammed Al-Rashid</div>
                <div className="text-navy-500 text-[10px] sm:text-sm">CarDoc Bi-Weekly Subscriber</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-navy-950 border-t border-navy-800 py-4 sm:py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 mb-4 sm:mb-8">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-sea-500 to-navy-600 rounded-lg flex items-center justify-center">
                  <Wrench className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <span className="text-sm sm:text-xl font-bold text-white">AutoSupport Pro</span>
              </div>
              <p className="text-navy-300 text-xs sm:text-base">Professional automotive support at your fingertips</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2 sm:mb-4 text-sm sm:text-lg">Services</h4>
              <ul className="space-y-1.5 text-navy-300 text-xs sm:text-base">
                <li className="hover:text-white transition-colors cursor-pointer">Video Diagnostics</li>
                <li className="hover:text-white transition-colors cursor-pointer">On-Site Repairs</li>
                <li className="hover:text-white transition-colors cursor-pointer">Emergency Support</li>
                <li className="hover:text-white transition-colors cursor-pointer">Maintenance Plans</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2 sm:mb-4 text-sm sm:text-lg">Company</h4>
              <ul className="space-y-1.5 text-navy-300 text-xs sm:text-base">
                <li className="hover:text-white transition-colors cursor-pointer">About Us</li>
                <li className="hover:text-white transition-colors cursor-pointer">Our Technicians</li>
                <li className="hover:text-white transition-colors cursor-pointer">Careers</li>
                <li className="hover:text-white transition-colors cursor-pointer">Press Kit</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2 sm:mb-4 text-sm sm:text-lg">Contact</h4>
              <ul className="space-y-1.5 text-navy-300 text-xs sm:text-base">
                <li className="hover:text-white transition-colors">24/7 Support</li>
                <li className="break-all hover:text-white transition-colors">help@autosupportpro.com</li>
                <li className="hover:text-white transition-colors">+971 50 123 4567</li>
                <li className="hover:text-white transition-colors">Dubai, UAE</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-navy-800 pt-3 sm:pt-8 text-center text-navy-500 text-xs sm:text-base">
            <p>&copy; 2024 AutoSupport Pro. Expert automotive assistance, anytime, anywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
