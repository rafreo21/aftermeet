const { AndroidConfig, withAndroidColors, withAndroidStyles } = require('@expo/config-plugins');

const CANVAS = '#F5F7F3';

/** Solid light system bars with dark icons on Android. */
function withAndroidSystemBars(config) {
  config = withAndroidColors(config, (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name: 'system_bar_background',
      value: CANVAS,
    });
    return config;
  });

  config = withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:statusBarColor',
      value: '@color/system_bar_background',
    });
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:navigationBarColor',
      value: '@color/system_bar_background',
    });
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:windowLightStatusBar',
      value: 'true',
    });
    return config;
  });

  return config;
}

module.exports = withAndroidSystemBars;
