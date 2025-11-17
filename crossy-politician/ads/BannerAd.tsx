import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getAdUnitId } from './adConfig';
import { analytics } from '../lib/analytics';

interface BannerAdComponentProps {
  size?: BannerAdSize;
}

export default function BannerAdComponent({ size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }: BannerAdComponentProps) {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={getAdUnitId('banner')}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          analytics.trackAdDisplayed('banner');
        }}
        onAdFailedToLoad={(error) => {
          analytics.trackAdError('banner', error.message);
        }}
        onAdOpened={() => {
          analytics.trackAdClicked('banner');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0b1220',
    paddingVertical: 4,
  },
});
