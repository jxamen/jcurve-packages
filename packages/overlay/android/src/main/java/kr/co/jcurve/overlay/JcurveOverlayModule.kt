package kr.co.jcurve.overlay

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class JcurveOverlayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("JcurveOverlay")

    Function("hasPermission") {
      hasOverlayPermission()
    }

    Function("requestPermission") {
      requestOverlayPermission()
    }

    AsyncFunction("show") { params: Map<String, Any> ->
      showFloatingPopup(params)
    }

    Function("hide") {
      hideFloatingPopup()
    }
  }

  private var floatingView: LinearLayout? = null
  private var windowManager: WindowManager? = null
  private var hideTimer: Handler? = null

  private fun hasOverlayPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
    return Settings.canDrawOverlays(appContext.reactContext ?: return false)
  }

  private fun requestOverlayPermission() {
    if (hasOverlayPermission()) return
    val context = appContext.reactContext ?: return
    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:${context.packageName}")
    )
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
    try {
      context.startActivity(intent)
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun showFloatingPopup(params: Map<String, Any>): Boolean {
    val context = appContext.reactContext ?: return false
    if (!hasOverlayPermission()) return false

    hideFloatingPopup() // 기존 팝업 제거

    val imageUrl = params["imageUrl"] as? String ?: return false
    val name = params["name"] as? String ?: return false
    val price = params["price"] as? String ?: return false
    val durationSec = when (val d = params["durationSec"]) {
      is Number -> maxOf(1, d.toInt().coerceAtLeast(1))
      else -> 300
    }

    windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    val params_ = WindowManager.LayoutParams().apply {
      type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        WindowManager.LayoutParams.TYPE_PHONE
      }
      format = PixelFormat.TRANSLUCENT
      flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
      width = 200
      height = 120
      x = 20
      y = 100
      gravity = Gravity.TOP or Gravity.LEFT
    }

    val container = LinearLayout(context).apply {
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.MATCH_PARENT
      )
      orientation = LinearLayout.HORIZONTAL
      setBackgroundColor(0xFFFFFFFF.toInt())
      elevation = 8f
    }

    // 이미지 (왼쪽)
    val imageView = ImageView(context).apply {
      layoutParams = LinearLayout.LayoutParams(60, 120)
      scaleType = ImageView.ScaleType.CENTER_CROP
      // 실제 로드는 백그라운드 스레드에서 — 지금은 빈 칸(실패 처리)
      setBackgroundColor(0xFFEEEEEE.toInt())
      loadImageFromUrl(imageUrl, this)
    }
    container.addView(imageView)

    // 텍스트 영역 (가운데)
    val textContainer = LinearLayout(context).apply {
      layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
      orientation = LinearLayout.VERTICAL
      setPadding(8, 8, 8, 8)
    }

    val nameText = TextView(context).apply {
      text = name
      textSize = 12f
      setTextColor(0xFF000000.toInt())
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
      maxLines = 2
    }
    textContainer.addView(nameText)

    val priceText = TextView(context).apply {
      text = price
      textSize = 11f
      setTextColor(0xFF666666.toInt())
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    }
    textContainer.addView(priceText)

    container.addView(textContainer)

    // 닫기 버튼 (오른쪽)
    val closeButton = TextView(context).apply {
      text = "✕"
      textSize = 16f
      setTextColor(0xFF999999.toInt())
      layoutParams = LinearLayout.LayoutParams(30, LinearLayout.LayoutParams.MATCH_PARENT)
      gravity = Gravity.CENTER
      setOnClickListener { hideFloatingPopup() }
    }
    container.addView(closeButton)

    floatingView = container
    windowManager?.addView(container, params_)

    // 자동 제거
    hideTimer = Handler(Looper.getMainLooper())
    hideTimer?.postDelayed({ hideFloatingPopup() }, (durationSec * 1000).toLong())

    return true
  }

  private fun hideFloatingPopup() {
    hideTimer?.removeCallbacksAndMessages(null)
    hideTimer = null
    floatingView?.let {
      try {
        windowManager?.removeView(it)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
    floatingView = null
  }

  private fun loadImageFromUrl(url: String, imageView: ImageView) {
    Thread {
      try {
        val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
        connection.doInput = true
        connection.connect()
        val bitmap = android.graphics.BitmapFactory.decodeStream(connection.inputStream)
        Handler(Looper.getMainLooper()).post {
          imageView.setImageBitmap(bitmap)
        }
      } catch (e: Exception) {
        e.printStackTrace()
        // 실패하면 빈 칸 유지
      }
    }.start()
  }
}
