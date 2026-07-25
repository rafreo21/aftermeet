const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RECEIVER = '.widget.QuickShareWidgetReceiver';

function withWidgetManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      mod.modResults,
    );
    application.receiver = application.receiver || [];

    if (!application.receiver.some((item) => item.$?.['android:name'] === RECEIVER)) {
      application.receiver.push({
        $: {
          'android:name': RECEIVER,
          'android:exported': 'true',
          'android:label': 'AfterMeet Quick Share',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/aftermeet_widget_info',
            },
          },
        ],
      });
    }
    return mod;
  });
}

function withWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const androidRoot = path.join(projectRoot, 'android', 'app', 'src', 'main');
      const packageName = config.android?.package || 'com.aftermeet.app';
      const packagePath = packageName.split('.').join(path.sep);
      const kotlinDir = path.join(androidRoot, 'java', packagePath, 'widget');
      const layoutDir = path.join(androidRoot, 'res', 'layout');
      const xmlDir = path.join(androidRoot, 'res', 'xml');
      fs.mkdirSync(kotlinDir, { recursive: true });
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });

      fs.writeFileSync(
        path.join(kotlinDir, 'QuickShareWidgetReceiver.kt'),
        `package ${packageName}.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import ${packageName}.R

class QuickShareWidgetReceiver : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { id ->
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("aftermeet://share-card")).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val pendingIntent = PendingIntent.getActivity(
        context,
        id,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val views = RemoteViews(context.packageName, R.layout.aftermeet_quick_share_widget)
      views.setOnClickPendingIntent(R.id.aftermeet_widget_root, pendingIntent)
      views.setOnClickPendingIntent(R.id.aftermeet_widget_button, pendingIntent)
      manager.updateAppWidget(id, views)
    }
  }
}
`,
      );

      fs.writeFileSync(
        path.join(layoutDir, 'aftermeet_quick_share_widget.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/aftermeet_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/aftermeet_widget_background"
  android:gravity="center_vertical"
  android:orientation="vertical"
  android:padding="18dp">
  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="AFTERMEET"
    android:textColor="#2F5711"
    android:textSize="11sp"
    android:textStyle="bold" />
  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:text="My contact card"
    android:textColor="#163300"
    android:textSize="21sp"
    android:textStyle="bold" />
  <TextView
    android:id="@+id/aftermeet_widget_button"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_marginTop="12dp"
    android:background="@drawable/aftermeet_widget_button"
    android:paddingHorizontal="14dp"
    android:paddingVertical="8dp"
    android:text="Open QR →"
    android:textColor="#FFFFFF"
    android:textSize="13sp"
    android:textStyle="bold" />
</LinearLayout>
`,
      );

      const drawableDir = path.join(androidRoot, 'res', 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, 'aftermeet_widget_background.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#E9F7DF" />
  <corners android:radius="24dp" />
</shape>
`,
      );
      fs.writeFileSync(
        path.join(drawableDir, 'aftermeet_widget_button.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#163300" />
  <corners android:radius="8dp" />
</shape>
`,
      );
      fs.writeFileSync(
        path.join(xmlDir, 'aftermeet_widget_info.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/app_name"
  android:initialLayout="@layout/aftermeet_quick_share_widget"
  android:minWidth="180dp"
  android:minHeight="110dp"
  android:previewLayout="@layout/aftermeet_quick_share_widget"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen" />
`,
      );
      return mod;
    },
  ]);
}

module.exports = function withAndroidQuickShareWidget(config) {
  return withWidgetFiles(withWidgetManifest(config));
};
