package com.ooh.pos;

import android.Manifest;
import android.os.Bundle;
import android.os.Build;

import com.getcapacitor.BridgeActivity;
import com.ooh.pos.printing.BluetoothEscPosPrinter;
import com.ooh.pos.printing.OohPrinterBridge;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissions(new String[] { Manifest.permission.BLUETOOTH_CONNECT }, 1001);
        }

        bridge.getWebView().addJavascriptInterface(
            new OohPrinterBridge(new BluetoothEscPosPrinter(this)),
            "OohPrinter"
        );

        if (savedInstanceState == null) {
            bridge.getWebView().loadUrl(bridge.getLocalUrl() + "/pos.html");
        }
    }
}
