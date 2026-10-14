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

    // 창(WindowManager)은 메인 스레드에서만 — AsyncFunction 은 다른 스레드라 메인으로 넘겨 결과를 promise 로
    AsyncFunction("show") { params: Map<String, Any>, promise: expo.modules.kotlin.Promise ->
      Handler(Looper.getMainLooper()).post {
        promise.resolve(try { showFloatingPopup(params) } catch (e: Exception) { e.printStackTrace(); false })
      }
    }

    Function("hide") {
      Handler(Looper.getMainLooper()).post { hideFloatingPopup() }
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
      is Number -> d.toInt().coerceIn(1, 3600)
      else -> 300
    }
    val dp = context.resources.displayMetrics.density
    fun px(v: Int) = (v * dp).toInt()

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
      width = px(240)
      height = WindowManager.LayoutParams.WRAP_CONTENT
      x = px(12)
      y = px(80)
      gravity = Gravity.TOP or Gravity.START
    }

    val container = LinearLayout(context).apply {
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.MATCH_PARENT
      )
      orientation = LinearLayout.HORIZONTAL
      background = android.graphics.drawable.GradientDrawable().apply { setColor(0xFFFFFFFF.toInt()); cornerRadius = px(14).toFloat(); setStroke(px(1), 0xFFE5E5E5.toInt()) }
      elevation = 8f
      clipToOutline = true
    }
    // 손가락으로 끌어 옮기기 — 미션 중 쇼핑 화면을 가리면 치울 수 있게
    container.setOnTouchListener(object : android.view.View.OnTouchListener {
      var sx = 0; var sy = 0; var tx = 0f; var ty = 0f
      override fun onTouch(v: android.view.View, ev: android.view.MotionEvent): Boolean {
        when (ev.action) {
          android.view.MotionEvent.ACTION_DOWN -> { sx = params_.x; sy = params_.y; tx = ev.rawX; ty = ev.rawY; return false }
          android.view.MotionEvent.ACTION_MOVE -> {
            params_.x = sx + (ev.rawX - tx).toInt(); params_.y = sy + (ev.rawY - ty).toInt()
            try { windowManager?.updateViewLayout(container, params_) } catch (e: Exception) {}
            return true
          }
        }
        return false
      }
    })

    // 이미지 (왼쪽)
    val imageView = ImageView(context).apply {
      layoutParams = LinearLayout.LayoutParams(px(64), px(64))
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
      setPadding(px(8), px(8), px(4), px(8))
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
      layoutParams = LinearLayout.LayoutParams(px(32), LinearLayout.LayoutParams.MATCH_PARENT)
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
