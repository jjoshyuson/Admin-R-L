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

    @JavascriptInterface
    public String checkPrinterStatus() {
        BluetoothEscPosPrinter.PrinterStatusResult result = printer.checkPrinterStatus();
        try {
            JSONObject json = new JSONObject()
                .put("supported", result.supported)
                .put("state", result.state)
                .put("printer", result.printer)
                .put("message", result.message);
            if (result.rawStatus != null) json.put("rawStatus", result.rawStatus);
            return json.toString();
        } catch (Exception ignored) {
            return "{\"supported\":false,\"state\":\"ERROR\",\"message\":\"Printer status response failed.\"}";
        }
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
