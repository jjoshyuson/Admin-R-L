package com.ooh.pos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (savedInstanceState == null) {
            bridge.getWebView().loadUrl(bridge.getLocalUrl() + "/pos.html");
        }
    }
}
