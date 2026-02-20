import React, { useState } from 'react';
import { useTranslation } from '../../locales';

interface FeatureMeta {
  id: string;
  icon: string;
  spotlightNumber: string;
  imageUrl?: string;
}

// Local images per section: SE Pattern (secover.jpg), RSI Divergence (rsi cover.jpg), ICT Bias (bias cover.jpg)
const featureMeta: FeatureMeta[] = [
  { id: 'pattern', icon: 'psychology', spotlightNumber: '01', imageUrl: '/secover.jpg' },
  { id: 'rsi', icon: 'analytics', spotlightNumber: '02', imageUrl: '/rsi%20cover.jpg' },
  { id: 'ict', icon: 'query_stats', spotlightNumber: '03', imageUrl: '/bias%20cover.jpg' },
];

const LiqScanFeatureSpotlight: React.FC = () => {
  const { t } = useTranslation();
  const [activeFeatureId, setActiveFeatureId] = useState<string>('pattern');
  const activeMeta = featureMeta.find(f => f.id === activeFeatureId) || featureMeta[0];
  const id = activeMeta.id;

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 mb-32">
      <div className="glass-panel rounded-[2rem] overflow-hidden border border-border">
        <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar border-b border-border bg-surfaceElevated">
          {featureMeta.map((meta) => (
            <div
              key={meta.id}
              onClick={() => setActiveFeatureId(meta.id)}
              className={`flex-1 min-w-[200px] sm:min-w-[280px] shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 cursor-pointer border-b-2 transition-colors ${activeFeatureId === meta.id ? 'border-primary bg-primary/5 text-primary' : 'border-transparent text-muted hover:text-foreground'}`}
            >
              <span className="material-symbols-outlined text-2xl">{meta.icon}</span>
              <div className="text-left">
                <h4 className="font-bold text-lg text-foreground">{t(`liqScan.featureSpotlight.${meta.id}.title`)}</h4>
                <p className="text-xs opacity-60">{t(`liqScan.featureSpotlight.${meta.id}.subtitle`)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 md:p-12 lg:p-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <span className="text-primary text-sm font-bold tracking-widest uppercase">
                  {t('liqScan.featureSpotlight.label')} {activeMeta.spotlightNumber}
                </span>
                <h2 className="text-4xl md:text-5xl font-extrabold text-foreground">{t(`liqScan.featureSpotlight.${id}.contentTitle`)}</h2>
                <p className="text-muted text-lg leading-relaxed">
                  {t(`liqScan.featureSpotlight.${id}.contentDescription`)}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    <div>
                      <p className="font-bold text-foreground">{t(`liqScan.featureSpotlight.${id}.p${i}Title`)}</p>
                      <p className="text-sm text-muted">{t(`liqScan.featureSpotlight.${id}.p${i}Desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-30 group-hover:opacity-50 transition-opacity"></div>
              <div className="relative glass-panel rounded-card overflow-hidden border-primary/20 aspect-video lg:aspect-square xl:aspect-video flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-all duration-500 transform group-hover:scale-105"
                  style={{ backgroundImage: activeMeta.imageUrl ? `url("${activeMeta.imageUrl}")` : undefined }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60"></div>
                <div className="absolute bottom-6 right-6">
                  <div className="px-3 py-1 bg-primary text-[#020617] text-[10px] font-black uppercase rounded tracking-tighter">
                    {t('liqScan.featureSpotlight.livePreview')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiqScanFeatureSpotlight;
