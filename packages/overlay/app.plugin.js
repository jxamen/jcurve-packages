const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function (config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;

    // Ensure uses-permission array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    // Check if permission already exists
    const permissionName = 'android.permission.SYSTEM_ALERT_WINDOW';
    const exists = manifest['uses-permission'].some(
      (p) => p.$['android:name'] === permissionName
    );

    // Add permission if not present
    if (!exists) {
      manifest['uses-permission'].push({
        $: { 'android:name': permissionName },
      });
    }

    return config;
  });
};
