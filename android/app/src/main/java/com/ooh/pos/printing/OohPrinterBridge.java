package com.ooh.pos.printing;

import android.webkit.JavascriptInterface;

import org.json.JSONObject;

public class OohPrinterBridge {
    private final BluetoothEscPosPrinter printer;

    public OohPrinterBridge(BluetoothEscPosPrinter printer) {
        this.printer = printer;
    }

    @JavascriptInterface
    public String setPrinterAddress(String address) {
        printer.savePrinterAddress(address);
        return status(true, "Printer address saved.");
    }

    @JavascriptInterface
    public String printReceipt(String orderJson) {
        return status(printer.printReceipt(orderJson));
    }

    @JavascriptInterface
    public String printKitchenTicket(String orderJson) {
        return status(printer.printKitchenTicket(orderJson));
    }

    private String status(BluetoothEscPosPrinter.PrintResult result) {
        return status(result.success, result.message);
    }

    private String status(boolean success, String message) {
        try {
            return new JSONObject()
                .put("success", success)
                .put("message", message)
                .toString();
        } catch (Exception ignored) {
            return "{\"success\":false,\"message\":\"Printer status failed.\"}";
        }
    }
}
