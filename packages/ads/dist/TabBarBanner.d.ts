import React from 'react';
export type TabBarBannerProps = {
    unitId?: string;
    enabled: boolean;
    /** Match the existing unit's AdMob format. Never send a native unit to BannerAd. */
    format?: 'banner' | 'native';
};
/** Mount below the tabs, above the caller's safe-area inset. No fill means no space. */
export declare function TabBarBanner({ unitId, enabled, format }: TabBarBannerProps): React.FunctionComponentElement<any> | null;
