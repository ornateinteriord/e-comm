import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useQuery } from '@tanstack/react-query';
import type { DeliveryAppReleaseInfo } from '@ornate/types';
import api from '../api/client';

function resolveBackendDownloadUrl(release?: DeliveryAppReleaseInfo | null): string {
  const gatewayBase = (import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/+$/, '');
  if (release?.apkUrl) {
    return gatewayBase ? `${gatewayBase}/api/v1/delivery/app-download` : '/api/v1/delivery/app-download';
  }
  if (release?.playStoreUrl) {
    return release.playStoreUrl;
  }
  return '';
}

export function useAppReleaseUpdater() {
  const isNative = Capacitor.isNativePlatform();
  const [installedBuild, setInstalledBuild] = useState<number>(100);
  const [installedVersion, setInstalledVersion] = useState<string>('1.0.0');

  useEffect(() => {
    if (!isNative) return;
    App.getInfo()
      .then((info) => {
        setInstalledVersion(info.version || '1.0.0');
        const parsedBuild = Number(info.build);
        if (!Number.isNaN(parsedBuild) && parsedBuild > 0) {
          setInstalledBuild(parsedBuild);
        }
      })
      .catch(() => undefined);
  }, [isNative]);

  const { data: releaseInfo, isLoading, refetch } = useQuery<DeliveryAppReleaseInfo>({
    queryKey: ['delivery-app-release'],
    queryFn: async () => {
      const resp = await api.get('/delivery/app-release');
      return resp.data.data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const resolvedDownloadUrl = resolveBackendDownloadUrl(releaseInfo);
  const hasNativeUpdate = Boolean(
    isNative &&
      releaseInfo?.isConfigured &&
      releaseInfo.versionCode > installedBuild &&
      resolvedDownloadUrl,
  );
  const isForceUpdate = Boolean(
    hasNativeUpdate &&
      releaseInfo &&
      (releaseInfo.forceUpdate || installedBuild < releaseInfo.minSupportedVersionCode),
  );

  const openDownload = async () => {
    if (!resolvedDownloadUrl) return false;
    if (isNative) {
      await Browser.open({ url: resolvedDownloadUrl });
      return true;
    }
    window.open(resolvedDownloadUrl, '_blank', 'noopener,noreferrer');
    return true;
  };

  return {
    isNative,
    installedVersion,
    installedBuild,
    releaseInfo,
    isLoading,
    resolvedDownloadUrl,
    hasNativeUpdate,
    isForceUpdate,
    openDownload,
    refetch,
  };
}
