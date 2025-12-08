import { Crown, Award, Star, Gem, Shield, Car } from 'lucide-react';

type VipTier = 'vip' | 'vvip' | 'gold' | 'diamond' | 'silver' | 'cardoc' | 'autodoc';

interface VipBadgeProps {
  tier: VipTier | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const tierConfig: Record<VipTier, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  textColor: string;
  borderColor: string;
  iconColor: string;
}> = {
  diamond: {
    label: 'DIAMOND',
    icon: Gem,
    bgColor: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    textColor: 'text-white',
    borderColor: 'border-cyan-400',
    iconColor: 'text-cyan-100',
  },
  gold: {
    label: 'GOLD',
    icon: Crown,
    bgColor: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    textColor: 'text-white',
    borderColor: 'border-yellow-400',
    iconColor: 'text-yellow-100',
  },
  silver: {
    label: 'SILVER',
    icon: Star,
    bgColor: 'bg-gradient-to-r from-gray-300 to-gray-500',
    textColor: 'text-white',
    borderColor: 'border-gray-400',
    iconColor: 'text-gray-100',
  },
  vvip: {
    label: 'VVIP',
    icon: Shield,
    bgColor: 'bg-gradient-to-r from-purple-600 to-pink-600',
    textColor: 'text-white',
    borderColor: 'border-purple-400',
    iconColor: 'text-purple-100',
  },
  vip: {
    label: 'VIP',
    icon: Award,
    bgColor: 'bg-gradient-to-r from-green-500 to-emerald-600',
    textColor: 'text-white',
    borderColor: 'border-green-400',
    iconColor: 'text-green-100',
  },
  cardoc: {
    label: 'CARDOC',
    icon: Car,
    bgColor: 'bg-gradient-to-r from-orange-500 to-red-500',
    textColor: 'text-white',
    borderColor: 'border-orange-400',
    iconColor: 'text-orange-100',
  },
  autodoc: {
    label: 'AUTODOC',
    icon: Car,
    bgColor: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    textColor: 'text-white',
    borderColor: 'border-blue-400',
    iconColor: 'text-blue-100',
  },
};

const sizeConfig = {
  sm: {
    container: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3',
    gap: 'gap-1',
  },
  md: {
    container: 'px-3 py-1 text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-1.5',
  },
  lg: {
    container: 'px-4 py-2 text-base',
    icon: 'h-5 w-5',
    gap: 'gap-2',
  },
};

export function VipBadge({ tier, size = 'md', showLabel = true }: VipBadgeProps) {
  if (!tier) return null;

  const config = tierConfig[tier];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center ${sizes.gap} ${sizes.container}
        ${config.bgColor} ${config.textColor}
        border-2 ${config.borderColor}
        rounded-full font-bold shadow-lg
        animate-pulse-subtle
      `}
    >
      <Icon className={`${sizes.icon} ${config.iconColor}`} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
