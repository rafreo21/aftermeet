const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_SUFFIX = 'widget';
const PREFS_NAME = 'aftermeet_widget';
const PREFS = {
  name: 'name',
  role: 'role',
  company: 'company',
  cardUrl: 'cardUrl',
  shareDeepLink: 'shareDeepLink',
  connectionsDeepLink: 'connectionsDeepLink',
  initials: 'initials',
  qrImageBase64: 'qrImageBase64',
  photoImageBase64: 'photoImageBase64',
  recentConnectionsJson: 'recentConnectionsJson',
};

const WIDGETS = [
  {
    receiver: 'QrScanWidgetReceiver',
    label: 'AfterMeet QR Scan',
    layout: 'aftermeet_widget_qr_scan',
    info: 'aftermeet_widget_qr_scan_info',
    minWidth: '110dp',
    minHeight: '110dp',
  },
  {
    receiver: 'BusinessCardWidgetReceiver',
    label: 'AfterMeet Business Card',
    layout: 'aftermeet_widget_business_card',
    info: 'aftermeet_widget_business_card_info',
    minWidth: '250dp',
    minHeight: '110dp',
  },
  {
    receiver: 'RecentConnectionsWidgetReceiver',
    label: 'AfterMeet Recent Connections',
    layout: 'aftermeet_widget_connections',
    info: 'aftermeet_widget_connections_info',
    minWidth: '250dp',
    minHeight: '110dp',
  },
];

function widgetReceiverEntry(packageName, widget) {
  return {
    $: {
      'android:name': `${packageName}.${PACKAGE_SUFFIX}.${widget.receiver}`,
      'android:exported': 'true',
      'android:label': widget.label,
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
          'android:resource': `@xml/${widget.info}`,
        },
      },
    ],
  };
}

function withWidgetManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.receiver = application.receiver || [];

    WIDGETS.forEach((widget) => {
      const receiverName = `${config.android?.package || 'com.aftermeet.app'}.${PACKAGE_SUFFIX}.${widget.receiver}`;
      if (!application.receiver.some((item) => item.$?.['android:name'] === receiverName)) {
        application.receiver.push(widgetReceiverEntry(config.android?.package || 'com.aftermeet.app', widget));
      }
    });

    const usesPermission = mod.modResults.manifest['uses-permission'] || [];
    if (!usesPermission.some((item) => item.$?.['android:name'] === 'android.permission.NFC')) {
      usesPermission.push({ $: { 'android:name': 'android.permission.NFC' } });
    }
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
  if (mainApplication.includes(packageImport)) return mainApplication;

  const importAnchor = 'import com.facebook.react.ReactApplication';
  let next = mainApplication.replace(importAnchor, `${importAnchor}\n${packageImport}`);

  const applyAnchor = 'PackageList(this).packages.apply {';
  if (next.includes(applyAnchor)) {
    return next.replace(applyAnchor, `${applyAnchor}\n          ${packageInstance.replace('packages.add', 'add')}`);
  }

  const packageAnchor = 'PackageList(this).packages';
  return next.replace(packageAnchor, `${packageInstance.replace('packages.add', 'add')}\n        ${packageAnchor}`);
}

function withWidgetModule(config) {
  return withMainApplication(config, (mod) => {
    const packageName = config.android?.package || 'com.aftermeet.app';
    mod.modResults.contents = addPackageToMainApplication(
      mod.modResults.contents,
      `import ${packageName}.widget.QuickShareWidgetPackage`,
      'packages.add(QuickShareWidgetPackage())',
    );
    return mod;
  });
}

function kotlinBridge(packageName) {
  return `package ${packageName}.widget

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
      val editor = prefs.edit()
        .putString("${PREFS.name}", payload.getString("name") ?: "My contact card")
        .putString("${PREFS.role}", payload.getString("role") ?: "")
        .putString("${PREFS.company}", payload.getString("company") ?: "")
        .putString("${PREFS.cardUrl}", payload.getString("cardUrl") ?: "")
        .putString("${PREFS.shareDeepLink}", payload.getString("shareDeepLink") ?: "aftermeet://share-card")
        .putString("${PREFS.connectionsDeepLink}", payload.getString("connectionsDeepLink") ?: "aftermeet://connections")
        .putString("${PREFS.initials}", payload.getString("initials") ?: "AM")
        .putString("${PREFS.qrImageBase64}", payload.getString("qrImageBase64") ?: "")
        .putString("${PREFS.photoImageBase64}", payload.getString("photoImageBase64") ?: "")
        .putString("${PREFS.recentConnectionsJson}", payload.getString("recentConnectionsJson") ?: "[]")

      for (slot in 1..3) {
        editor.putString("connection\${slot}Name", payload.getString("connection\${slot}Name") ?: "")
        editor.putString("connection\${slot}Subtitle", payload.getString("connection\${slot}Subtitle") ?: "")
        editor.putString("connection\${slot}Phone", payload.getString("connection\${slot}Phone") ?: "")
        editor.putString("connection\${slot}Email", payload.getString("connection\${slot}Email") ?: "")
      }
      editor.apply()

      val manager = AppWidgetManager.getInstance(reactContext)
      listOf(
        QrScanWidgetReceiver::class.java,
        BusinessCardWidgetReceiver::class.java,
        RecentConnectionsWidgetReceiver::class.java,
      ).forEach { receiver ->
        val component = ComponentName(reactContext, receiver)
        manager.getAppWidgetIds(component).forEach { id ->
          WidgetRenderer.render(reactContext, manager, id, receiver)
        }
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_UPDATE_FAILED", error.message, error)
    }
  }
}
`;
}

function kotlinRenderer(packageName) {
  return `package ${packageName}.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.util.Base64
import android.view.View
import android.widget.RemoteViews
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import ${packageName}.R

object WidgetRenderer {
  private fun prefs(context: Context) =
    context.getSharedPreferences("${PREFS_NAME}", Context.MODE_PRIVATE)

  private fun decodeBitmap(base64: String?): Bitmap? {
    if (base64.isNullOrBlank()) return null
    return try {
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (_: Exception) {
      null
    }
  }

  private fun qrBitmap(store: android.content.SharedPreferences, cardUrl: String, size: Int, dark: String, light: String): Bitmap? {
    decodeBitmap(store.getString("${PREFS.qrImageBase64}", ""))?.let { return it }
    return generateQrBitmap(cardUrl, size, dark, light)
  }

  private fun generateQrBitmap(content: String, size: Int, dark: String, light: String): Bitmap? {
    if (content.isBlank()) return null
    return try {
      val hints = mapOf(
        EncodeHintType.MARGIN to 1,
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.H,
      )
      val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
      val darkColor = Color.parseColor(dark)
      val lightColor = Color.parseColor(light)
      for (x in 0 until size) {
        for (y in 0 until size) {
          bitmap.setPixel(x, y, if (matrix.get(x, y)) darkColor else lightColor)
        }
      }
      bitmap
    } catch (_: Exception) {
      null
    }
  }

  private fun openAppIntent(context: Context, widgetId: Int, deepLink: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    return PendingIntent.getActivity(
      context,
      widgetId,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun dialIntent(context: Context, widgetId: Int, phone: String): PendingIntent? {
    if (phone.isBlank()) return null
    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:\$phone"))
    return PendingIntent.getActivity(
      context,
      widgetId + 1000,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun messageIntent(context: Context, widgetId: Int, email: String, phone: String): PendingIntent? {
    val uri = when {
      phone.isNotBlank() -> Uri.parse("sms:\$phone")
      email.isNotBlank() -> Uri.parse("mailto:\$email")
      else -> return null
    }
    val intent = Intent(Intent.ACTION_VIEW, uri)
    return PendingIntent.getActivity(
      context,
      widgetId + 2000,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun render(context: Context, manager: AppWidgetManager, id: Int, receiver: Class<*>) {
    when (receiver) {
      QrScanWidgetReceiver::class.java -> renderQrScan(context, manager, id)
      BusinessCardWidgetReceiver::class.java -> renderBusinessCard(context, manager, id)
      RecentConnectionsWidgetReceiver::class.java -> renderConnections(context, manager, id)
    }
  }

  private fun renderQrScan(context: Context, manager: AppWidgetManager, id: Int) {
    val store = prefs(context)
    val cardUrl = store.getString("${PREFS.cardUrl}", "") ?: ""
    val deepLink = store.getString("${PREFS.shareDeepLink}", "aftermeet://share-card") ?: "aftermeet://share-card"
    val views = RemoteViews(context.packageName, R.layout.aftermeet_widget_qr_scan)
    qrBitmap(store, cardUrl, 280, "#163300", "#FFFFFF")?.let {
      views.setImageViewBitmap(R.id.aftermeet_qr_scan_image, it)
    }
    views.setOnClickPendingIntent(R.id.aftermeet_qr_scan_root, openAppIntent(context, id, deepLink))
    manager.updateAppWidget(id, views)
  }

  private fun renderBusinessCard(context: Context, manager: AppWidgetManager, id: Int) {
    val store = prefs(context)
    val name = store.getString("${PREFS.name}", "My contact card") ?: "My contact card"
    val role = store.getString("${PREFS.role}", "") ?: ""
    val company = store.getString("${PREFS.company}", "") ?: ""
    val cardUrl = store.getString("${PREFS.cardUrl}", "") ?: ""
    val deepLink = store.getString("${PREFS.shareDeepLink}", "aftermeet://share-card") ?: "aftermeet://share-card"
    val initials = store.getString("${PREFS.initials}", "AM") ?: "AM"
    val views = RemoteViews(context.packageName, R.layout.aftermeet_widget_business_card)
    views.setTextViewText(R.id.aftermeet_card_initials, initials)
    views.setTextViewText(R.id.aftermeet_card_name, name)
    views.setTextViewText(R.id.aftermeet_card_role, role)
    views.setTextViewText(R.id.aftermeet_card_company, company)
    qrBitmap(store, cardUrl, 240, "#163300", "#FFFFFF")?.let {
      views.setImageViewBitmap(R.id.aftermeet_card_qr, it)
    }
    decodeBitmap(store.getString("${PREFS.photoImageBase64}", ""))?.let {
      views.setViewVisibility(R.id.aftermeet_card_initials, View.GONE)
      views.setViewVisibility(R.id.aftermeet_card_photo, View.VISIBLE)
      views.setImageViewBitmap(R.id.aftermeet_card_photo, it)
    } ?: run {
      views.setViewVisibility(R.id.aftermeet_card_initials, View.VISIBLE)
      views.setViewVisibility(R.id.aftermeet_card_photo, View.GONE)
    }
    views.setOnClickPendingIntent(R.id.aftermeet_card_root, openAppIntent(context, id, deepLink))
    manager.updateAppWidget(id, views)
  }

  private fun renderConnections(context: Context, manager: AppWidgetManager, id: Int) {
    val store = prefs(context)
    val deepLink = store.getString("${PREFS.connectionsDeepLink}", "aftermeet://connections") ?: "aftermeet://connections"
    val views = RemoteViews(context.packageName, R.layout.aftermeet_widget_connections)
    var visibleRows = 0

    for (slot in 1..3) {
      val name = store.getString("connection\${slot}Name", "") ?: ""
      val subtitle = store.getString("connection\${slot}Subtitle", "") ?: ""
      val phone = store.getString("connection\${slot}Phone", "") ?: ""
      val email = store.getString("connection\${slot}Email", "") ?: ""
      val rowId = when (slot) {
        1 -> R.id.aftermeet_connection_row_1
        2 -> R.id.aftermeet_connection_row_2
        else -> R.id.aftermeet_connection_row_3
      }
      val nameId = when (slot) {
        1 -> R.id.aftermeet_connection_name_1
        2 -> R.id.aftermeet_connection_name_2
        else -> R.id.aftermeet_connection_name_3
      }
      val subtitleId = when (slot) {
        1 -> R.id.aftermeet_connection_subtitle_1
        2 -> R.id.aftermeet_connection_subtitle_2
        else -> R.id.aftermeet_connection_subtitle_3
      }
      val avatarId = when (slot) {
        1 -> R.id.aftermeet_connection_avatar_1
        2 -> R.id.aftermeet_connection_avatar_2
        else -> R.id.aftermeet_connection_avatar_3
      }
      val phoneId = when (slot) {
        1 -> R.id.aftermeet_connection_phone_1
        2 -> R.id.aftermeet_connection_phone_2
        else -> R.id.aftermeet_connection_phone_3
      }
      val messageId = when (slot) {
        1 -> R.id.aftermeet_connection_message_1
        2 -> R.id.aftermeet_connection_message_2
        else -> R.id.aftermeet_connection_message_3
      }

      if (name.isBlank()) {
        views.setViewVisibility(rowId, View.GONE)
        continue
      }

      visibleRows += 1
      views.setViewVisibility(rowId, View.VISIBLE)
      views.setTextViewText(nameId, name)
      views.setTextViewText(subtitleId, subtitle.ifBlank { "Shared via your card" })
      views.setTextViewText(avatarId, name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?")
      dialIntent(context, id + slot, phone)?.let { views.setOnClickPendingIntent(phoneId, it) }
      messageIntent(context, id + slot, email, phone)?.let { views.setOnClickPendingIntent(messageId, it) }
    }

    views.setViewVisibility(R.id.aftermeet_connections_empty, if (visibleRows == 0) View.VISIBLE else View.GONE)
    views.setViewVisibility(R.id.aftermeet_connections_list, if (visibleRows == 0) View.GONE else View.VISIBLE)
    views.setOnClickPendingIntent(R.id.aftermeet_connections_root, openAppIntent(context, id, deepLink))
    manager.updateAppWidget(id, views)
  }
}

class QrScanWidgetReceiver : android.appwidget.AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { WidgetRenderer.render(context, manager, it, QrScanWidgetReceiver::class.java) }
  }
}

class BusinessCardWidgetReceiver : android.appwidget.AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { WidgetRenderer.render(context, manager, it, BusinessCardWidgetReceiver::class.java) }
  }
}

class RecentConnectionsWidgetReceiver : android.appwidget.AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { WidgetRenderer.render(context, manager, it, RecentConnectionsWidgetReceiver::class.java) }
  }
}
`;
}

function layoutQrScan() {
  return `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/aftermeet_qr_scan_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/aftermeet_widget_dark_background"
  android:padding="12dp">
  <FrameLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/aftermeet_widget_accent_frame">
    <ImageView
      android:id="@+id/aftermeet_qr_scan_image"
      android:layout_width="match_parent"
      android:layout_height="match_parent"
      android:layout_gravity="center"
      android:contentDescription="Scan QR code"
      android:padding="10dp"
      android:scaleType="fitCenter" />
    <ImageView
      android:id="@+id/aftermeet_qr_scan_logo"
      android:layout_width="28dp"
      android:layout_height="28dp"
      android:layout_gravity="center"
      android:contentDescription="AfterMeet logo"
      android:src="@mipmap/ic_launcher"
      android:scaleType="fitCenter" />
  </FrameLayout>
</FrameLayout>`;
}

function layoutBusinessCard() {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/aftermeet_card_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/aftermeet_widget_dark_background"
  android:gravity="center_vertical"
  android:orientation="horizontal"
  android:padding="12dp">
  <FrameLayout
    android:layout_width="92dp"
    android:layout_height="92dp"
    android:background="@drawable/aftermeet_widget_qr_dark_panel">
    <ImageView
      android:id="@+id/aftermeet_card_qr"
      android:layout_width="80dp"
      android:layout_height="80dp"
      android:layout_gravity="center"
      android:contentDescription="Scan QR code"
      android:scaleType="fitCenter" />
    <ImageView
      android:id="@+id/aftermeet_card_qr_logo"
      android:layout_width="20dp"
      android:layout_height="20dp"
      android:layout_gravity="center"
      android:contentDescription="AfterMeet logo"
      android:src="@mipmap/ic_launcher"
      android:scaleType="fitCenter" />
  </FrameLayout>
  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_marginStart="12dp"
    android:layout_weight="1"
    android:orientation="vertical">
    <TextView
      android:id="@+id/aftermeet_card_initials"
      android:layout_width="30dp"
      android:layout_height="30dp"
      android:background="@drawable/aftermeet_widget_avatar_ring"
      android:gravity="center"
      android:text="AM"
      android:textColor="#9FE870"
      android:textSize="11sp"
      android:textStyle="bold" />
    <ImageView
      android:id="@+id/aftermeet_card_photo"
      android:layout_width="30dp"
      android:layout_height="30dp"
      android:layout_marginTop="0dp"
      android:contentDescription="Profile photo"
      android:scaleType="centerCrop"
      android:visibility="gone" />
    <TextView
      android:id="@+id/aftermeet_card_name"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:layout_marginTop="8dp"
      android:text="My contact card"
      android:textColor="#FFFFFF"
      android:textSize="15sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/aftermeet_card_role"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:layout_marginTop="2dp"
      android:textColor="#B8C4B3"
      android:textSize="11sp" />
    <TextView
      android:id="@+id/aftermeet_card_company"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:layout_marginTop="2dp"
      android:textColor="#8FA088"
      android:textSize="10sp" />
    <TextView
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:layout_marginTop="8dp"
      android:text="AFTERMEET"
      android:textColor="#9FE870"
      android:textSize="9sp"
      android:textStyle="bold" />
  </LinearLayout>
</LinearLayout>`;
}

function layoutConnections() {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/aftermeet_connections_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/aftermeet_widget_dark_background"
  android:orientation="vertical"
  android:padding="12dp">
  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="RECENT CONNECTIONS"
    android:textColor="#9FE870"
    android:textSize="9sp"
    android:textStyle="bold" />
  <TextView
    android:id="@+id/aftermeet_connections_empty"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="10dp"
    android:text="Share your card to see new connections here."
    android:textColor="#B8C4B3"
    android:textSize="11sp"
    android:visibility="gone" />
  <LinearLayout
    android:id="@+id/aftermeet_connections_list"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:orientation="vertical">
    ${[1, 2, 3].map((slot) => `
    <LinearLayout
      android:id="@+id/aftermeet_connection_row_${slot}"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:layout_marginTop="${slot === 1 ? '0' : '8'}dp"
      android:gravity="center_vertical"
      android:orientation="horizontal">
      <TextView
        android:id="@+id/aftermeet_connection_avatar_${slot}"
        android:layout_width="24dp"
        android:layout_height="24dp"
        android:background="@drawable/aftermeet_widget_avatar_ring"
        android:gravity="center"
        android:text="A"
        android:textColor="#FFFFFF"
        android:textSize="10sp"
        android:textStyle="bold" />
      <LinearLayout
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_marginStart="8dp"
        android:layout_weight="1"
        android:orientation="vertical">
        <TextView
          android:id="@+id/aftermeet_connection_name_${slot}"
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:textColor="#FFFFFF"
          android:textSize="12sp"
          android:textStyle="bold" />
        <TextView
          android:id="@+id/aftermeet_connection_subtitle_${slot}"
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:textColor="#8FA088"
          android:textSize="10sp" />
      </LinearLayout>
      <TextView
        android:id="@+id/aftermeet_connection_phone_${slot}"
        android:layout_width="28dp"
        android:layout_height="28dp"
        android:background="@drawable/aftermeet_widget_action_chip"
        android:gravity="center"
        android:text="☎"
        android:textColor="#FFFFFF"
        android:textSize="12sp" />
      <TextView
        android:id="@+id/aftermeet_connection_message_${slot}"
        android:layout_width="28dp"
        android:layout_height="28dp"
        android:layout_marginStart="6dp"
        android:background="@drawable/aftermeet_widget_action_chip"
        android:gravity="center"
        android:text="✉"
        android:textColor="#FFFFFF"
        android:textSize="12sp" />
    </LinearLayout>`).join('')}
  </LinearLayout>
</LinearLayout>`;
}

function widgetInfo(widget) {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/app_name"
  android:initialLayout="@layout/${widget.layout}"
  android:minWidth="${widget.minWidth}"
  android:minHeight="${widget.minHeight}"
  android:previewLayout="@layout/${widget.layout}"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen" />`;
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
      const drawableDir = path.join(androidRoot, 'res', 'drawable');
      fs.mkdirSync(kotlinDir, { recursive: true });
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(drawableDir, { recursive: true });

      fs.writeFileSync(path.join(kotlinDir, 'QuickShareWidgetBridge.kt'), kotlinBridge(packageName));
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
      fs.writeFileSync(path.join(kotlinDir, 'WidgetRenderer.kt'), kotlinRenderer(packageName));

      fs.writeFileSync(path.join(layoutDir, 'aftermeet_widget_qr_scan.xml'), layoutQrScan());
      fs.writeFileSync(path.join(layoutDir, 'aftermeet_widget_business_card.xml'), layoutBusinessCard());
      fs.writeFileSync(path.join(layoutDir, 'aftermeet_widget_connections.xml'), layoutConnections());

      WIDGETS.forEach((widget) => {
        fs.writeFileSync(path.join(xmlDir, `${widget.info}.xml`), widgetInfo(widget));
      });

      const drawables = {
        'aftermeet_widget_dark_background.xml': `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#141814" /><corners android:radius="24dp" /></shape>`,
        'aftermeet_widget_accent_frame.xml': `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#FFFFFF" /><stroke android:width="3dp" android:color="#9FE870" /><corners android:radius="18dp" /></shape>`,
        'aftermeet_widget_qr_dark_panel.xml': `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#000000" /><corners android:radius="14dp" /></shape>`,
        'aftermeet_widget_avatar_ring.xml': `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval"><solid android:color="#243024" /><stroke android:width="1dp" android:color="#9FE870" /></shape>`,
        'aftermeet_widget_action_chip.xml': `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval"><solid android:color="#243024" /></shape>`,
      };
      Object.entries(drawables).forEach(([name, contents]) => {
        fs.writeFileSync(path.join(drawableDir, name), `<?xml version="1.0" encoding="utf-8"?>\n${contents}`);
      });

      const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
      if (fs.existsSync(buildGradlePath)) {
        let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
        if (!buildGradle.includes('com.google.zxing:core')) {
          buildGradle = buildGradle.replace(
            /dependencies\s*\{/,
            "dependencies {\n    implementation 'com.google.zxing:core:3.5.3'",
          );
          fs.writeFileSync(buildGradlePath, buildGradle);
        }
      }

      return mod;
    },
  ]);
}

module.exports = function withAndroidQuickShareWidget(config) {
  return withWidgetModule(withWidgetFiles(withWidgetManifest(config)));
};
