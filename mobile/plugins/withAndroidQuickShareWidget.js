const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RECEIVER = '.widget.QuickShareWidgetReceiver';
const PREFS_NAME = 'aftermeet_widget';
const PREFS_KEY_NAME = 'name';
const PREFS_KEY_ROLE = 'role';
const PREFS_KEY_COMPANY = 'company';
const PREFS_KEY_CARD_URL = 'cardUrl';

function withWidgetManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
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
            action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
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

    const usesPermission = mod.modResults.manifest['uses-permission'] || [];
    const nfcPermissions = [
      'android.permission.NFC',
    ];
    nfcPermissions.forEach((permission) => {
      if (!usesPermission.some((item) => item.$?.['android:name'] === permission)) {
        usesPermission.push({ $: { 'android:name': permission } });
      }
    });
    mod.modResults.manifest['uses-permission'] = usesPermission;

    const usesFeature = mod.modResults.manifest['uses-feature'] || [];
    if (!usesFeature.some((item) => item.$?.['android:name'] === 'android.hardware.nfc')) {
      usesFeature.push({
        $: {
          'android:name': 'android.hardware.nfc',
          'android:required': 'false',
        },
      });
    }
    mod.modResults.manifest['uses-feature'] = usesFeature;

    return mod;
  });
}

function addPackageToMainApplication(mainApplication, packageImport, packageInstance) {
  if (mainApplication.includes(packageImport)) {
    return mainApplication;
  }

  const importAnchor = 'import com.facebook.react.ReactApplication';
  let next = mainApplication.replace(
    importAnchor,
    `${importAnchor}\n${packageImport}`,
  );

  const applyAnchor = 'PackageList(this).packages.apply {';
  if (next.includes(applyAnchor)) {
    next = next.replace(
      applyAnchor,
      `${applyAnchor}\n          ${packageInstance.replace('packages.add', 'add')}`,
    );
    return next;
  }

  const packageAnchor = 'PackageList(this).packages';
  next = next.replace(
    packageAnchor,
    `${packageInstance.replace('packages.add', 'add')}\n        ${packageAnchor}`,
  );

  return next;
}

function withWidgetModule(config) {
  return withMainApplication(config, (mod) => {
    const packageName = config.android?.package || 'com.aftermeet.app';
    mod.modResults.contents = addPackageToMainApplication(
      mod.modResults.contents,
      `import ${packageName}.widget.QuickShareWidgetPackage`,
      `packages.add(QuickShareWidgetPackage())`,
    );
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
        path.join(kotlinDir, 'QuickShareWidgetBridge.kt'),
        `package ${packageName}.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class QuickShareWidgetBridge(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "QuickShareWidgetBridge"

  @ReactMethod
  fun updateWidget(payload: ReadableMap, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences("${PREFS_NAME}", Context.MODE_PRIVATE)
      prefs.edit()
        .putString("${PREFS_KEY_NAME}", payload.getString("name") ?: "My contact card")
        .putString("${PREFS_KEY_ROLE}", payload.getString("role") ?: "")
        .putString("${PREFS_KEY_COMPANY}", payload.getString("company") ?: "")
        .putString("${PREFS_KEY_CARD_URL}", payload.getString("cardUrl") ?: "")
        .apply()

      val manager = AppWidgetManager.getInstance(reactContext)
      val component = ComponentName(reactContext, QuickShareWidgetReceiver::class.java)
      val ids = manager.getAppWidgetIds(component)
      ids.forEach { id ->
        QuickShareWidgetReceiver.renderWidget(reactContext, manager, id)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_UPDATE_FAILED", error.message, error)
    }
  }
}
`,
      );

      fs.writeFileSync(
        path.join(kotlinDir, 'QuickShareWidgetPackage.kt'),
        `package ${packageName}.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class QuickShareWidgetPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(QuickShareWidgetBridge(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`,
      );

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
    ids.forEach { id -> renderWidget(context, manager, id) }
  }

  companion object {
    fun renderWidget(context: Context, manager: AppWidgetManager, id: Int) {
      val prefs = context.getSharedPreferences("${PREFS_NAME}", Context.MODE_PRIVATE)
      val name = prefs.getString("${PREFS_KEY_NAME}", "My contact card") ?: "My contact card"
      val role = prefs.getString("${PREFS_KEY_ROLE}", "") ?: ""
      val company = prefs.getString("${PREFS_KEY_COMPANY}", "") ?: ""
      val subtitle = listOf(role, company).filter { it.isNotBlank() }.joinToString(" · ")

      val cardUrl = prefs.getString("${PREFS_KEY_CARD_URL}", "") ?: ""
      val targetUrl = if (cardUrl.isNotBlank()) cardUrl else "aftermeet://share-card"
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl)).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val pendingIntent = PendingIntent.getActivity(
        context,
        id,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val views = RemoteViews(context.packageName, R.layout.aftermeet_quick_share_widget)
      views.setTextViewText(R.id.aftermeet_widget_name, name)
      views.setTextViewText(
        R.id.aftermeet_widget_subtitle,
        if (subtitle.isBlank()) "Tap to open your QR code" else subtitle
      )
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
    android:id="@+id/aftermeet_widget_name"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:text="My contact card"
    android:textColor="#163300"
    android:textSize="21sp"
    android:textStyle="bold" />
  <TextView
    android:id="@+id/aftermeet_widget_subtitle"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:text="Tap to open your QR code"
    android:textColor="#667363"
    android:textSize="12sp" />
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
  return withWidgetModule(withWidgetFiles(withWidgetManifest(config)));
};
