const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const AID_LIST = `<?xml version="1.0" encoding="utf-8"?>
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="false">
  <aid-group android:category="other" android:description="@string/app_name">
    <aid-filter android:name="D2760000850101" />
  </aid-group>
</host-apdu-service>`;

const HCE_SERVICE = 'com.reactnativehce.services.CardService';

function withAndroidNfcHce(config) {
  config = withDangerousMod(config, ['android', async (modConfig) => {
    const xmlDir = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, 'aid_list.xml'), AID_LIST);
    return modConfig;
  }]);

  return withAndroidManifest(config, (mod) => {
    const usesFeature = mod.modResults.manifest['uses-feature'] || [];
    if (!usesFeature.some((item) => item.$?.['android:name'] === 'android.hardware.nfc.hce')) {
      usesFeature.push({
        $: {
          'android:name': 'android.hardware.nfc.hce',
          'android:required': 'false',
        },
      });
    }
    mod.modResults.manifest['uses-feature'] = usesFeature;

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.service = application.service || [];
    if (!application.service.some((item) => item.$?.['android:name'] === HCE_SERVICE)) {
      application.service.push({
        $: {
          'android:name': HCE_SERVICE,
          'android:exported': 'true',
          'android:enabled': 'false',
          'android:permission': 'android.permission.BIND_NFC_SERVICE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.nfc.cardemulation.action.HOST_APDU_SERVICE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.nfc.cardemulation.host_apdu_service',
              'android:resource': '@xml/aid_list',
            },
          },
        ],
      });
    }

    return mod;
  });
}

module.exports = withAndroidNfcHce;
