package com.gwstudios.higher;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectGameplayHotfix(view);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void injectGameplayHotfix(WebView view) {
        String script =
            "(function(){" +
            "if(window.__higherHotfixV012)return;window.__higherHotfixV012=true;" +
            "var style=document.createElement('style');" +
            "style.id='higher-hotfix-v012';" +
            "style.textContent=" +
            "'.toolbadge{top:-15px!important;left:50%!important;min-width:0!important;width:auto!important;height:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;filter:drop-shadow(0 2px 1px rgba(0,0,0,.22))!important;font-size:25px!important;line-height:1!important;transform-origin:50% 120%!important;animation:toolOverhead 1.15s ease-in-out infinite!important;}'+" +
            "'.sitewrap:nth-child(2n) .toolbadge{animation-delay:-.57s!important;}'+" +
            "'@keyframes toolOverhead{0%,100%{transform:translateX(-50%) rotate(-58deg) translateY(2px)}48%,58%{transform:translateX(-50%) rotate(58deg) translateY(-3px)}}'+" +
            "'.arm{animation:armOverhead 1.15s ease-in-out infinite!important;}'+" +
            "'@keyframes armOverhead{0%,100%{transform:rotate(-52deg)}48%,58%{transform:rotate(38deg)}}';" +
            "document.head.appendChild(style);" +
            "var brand=document.querySelector('.brand span');if(brand)brand.textContent='v0.1.2 · absolutely permitted construction';" +
            "var units={k:1e3,M:1e6,B:1e9,T:1e12,Qa:1e15,Qi:1e18,Sx:1e21,Sp:1e24,Oc:1e27,No:1e30,Dc:1e33,Ud:1e36,Dd:1e39};" +
            "function num(text){if(!text)return NaN;var s=String(text).replace(/,/g,'').trim();var m=s.match(/([0-9]+(?:\\.[0-9]+)?)\\s*(Qa|Qi|Sx|Sp|Oc|No|Dc|Ud|Dd|[kMBT])?/);if(!m)return NaN;return parseFloat(m[1])*(units[m[2]]||1);}" +
            "function refresh(){var h=document.getElementById('height');var money=num(h&&h.textContent);if(!isFinite(money))return;" +
            "document.querySelectorAll('#crew .card').forEach(function(card){var p=card.querySelector('.price');var price=num(p&&p.textContent);if(!isFinite(price))return;var ok=money+Math.max(1,money)*1e-9>=price;card.disabled=!ok;card.classList.toggle('afford',ok);});" +
            "document.querySelectorAll('#upgrades .card').forEach(function(card){if(card.classList.contains('upgradeowned')){card.disabled=true;return;}var p=card.querySelector('.price');var price=num(p&&p.textContent);if(!isFinite(price))return;var ok=money+Math.max(1,money)*1e-9>=price;card.disabled=!ok;card.classList.toggle('afford',ok);});" +
            "var active=document.querySelector('.chip.active');if(active&&active.dataset.buy==='max'&&!document.hidden){var now=Date.now();if(!window.__higherLastMaxRefresh||now-window.__higherLastMaxRefresh>700){window.__higherLastMaxRefresh=now;active.click();}}" +
            "}" +
            "refresh();window.__higherAffordTimer=setInterval(refresh,250);" +
            "})();";
        view.evaluateJavascript(script, null);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
