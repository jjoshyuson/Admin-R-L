package com.ooh.pos.printing;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

public class BluetoothEscPosPrinter {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String KEY_PRINTER_ADDRESS = "printer-address";
    private static final int PAPER_COLUMNS_58MM = 32;
    private static final int PAPER_COLUMNS_80MM = 48;
    private static final String[] PRINTER_NAME_HINTS = { "printer", "pos", "receipt", "thermal", "esc" };

    private final Context context;
    private final SharedPreferences printerPreferences;
    private final Charset charset = Charset.forName("UTF-8");

    public BluetoothEscPosPrinter(Context context) {
        this.context = context.getApplicationContext();
        this.printerPreferences = this.context.getSharedPreferences("ooh-printer", Context.MODE_PRIVATE);
    }

    public void savePrinterAddress(String address) {
        printerPreferences.edit().putString(KEY_PRINTER_ADDRESS, address.trim()).apply();
    }

    public PrintResult printReceipt(String orderJson) {
        return print(orderJson, DocumentType.RECEIPT);
    }

    public PrintResult printKitchenTicket(String orderJson) {
        return print(orderJson, DocumentType.KITCHEN);
    }

    private PrintResult print(String orderJson, DocumentType type) {
        if (!hasBluetoothConnectPermission()) {
            return new PrintResult(false, "Bluetooth permission is required before printing.");
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            return new PrintResult(false, "This device does not support Bluetooth.");
        }
        if (!adapter.isEnabled()) {
            return new PrintResult(false, "Bluetooth is turned off.");
        }

        try {
            JSONObject order = new JSONObject(orderJson);
            BluetoothDevice printer = findPrinter(adapter);
            if (printer == null) {
                return new PrintResult(false, "No paired Bluetooth printer found.");
            }
            writeToPrinter(printer, buildEscPosDocument(order, type));
            return new PrintResult(true, type.label + " sent to " + printerLabel(printer) + ".");
        } catch (Exception error) {
            String message = error.getMessage();
            return new PrintResult(false, message == null || message.isEmpty() ? "Printing failed." : message);
        }
    }

    @SuppressLint("MissingPermission")
    private BluetoothDevice findPrinter(BluetoothAdapter adapter) {
        String savedAddress = printerPreferences.getString(KEY_PRINTER_ADDRESS, null);
        if (savedAddress != null && !savedAddress.trim().isEmpty()) {
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                if (device.getAddress().equalsIgnoreCase(savedAddress.trim())) {
                    return device;
                }
            }
        }

        for (BluetoothDevice device : adapter.getBondedDevices()) {
            String name = safeDeviceName(device).toLowerCase(Locale.US);
            for (String hint : PRINTER_NAME_HINTS) {
                if (name.contains(hint)) {
                    return device;
                }
            }
        }

        for (BluetoothDevice device : adapter.getBondedDevices()) {
            return device;
        }
        return null;
    }

    @SuppressLint("MissingPermission")
    private void writeToPrinter(BluetoothDevice device, byte[] payload) throws Exception {
        BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            socket.connect();
            socket.getOutputStream().write(payload);
            socket.getOutputStream().flush();
        } finally {
            try {
                socket.close();
            } catch (Exception ignored) {
            }
        }
    }

    private boolean hasBluetoothConnectPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private byte[] buildEscPosDocument(JSONObject order, DocumentType type) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int paperColumns = paperColumns(order);
        String separator = repeat("-", paperColumns);
        raw(out, 0x1B, 0x40);
        raw(out, 0x1B, 0x61, 0x01);
        raw(out, 0x1B, 0x45, 0x01);
        line(out, type == DocumentType.KITCHEN ? "KITCHEN TICKET" : "CUSTOMER RECEIPT");
        raw(out, 0x1B, 0x45, 0x00);
        line(out, "OOH POS");
        line(out, shortOrderId(order.optString("deviceOrderId")));
        line(out, formatTimestamp(order.optString("createdAt")));
        line(out, order.optString("serviceMode", "DINE IN") + " | " + order.optString("deviceId", "Tablet"));
        raw(out, 0x1B, 0x61, 0x00);
        line(out, separator);

        JSONArray items = order.optJSONArray("items");
        if (items == null) {
            items = new JSONArray();
        }
        for (int index = 0; index < items.length(); index += 1) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) {
                continue;
            }
            int quantity = Math.max(1, item.optInt("quantity", 1));
            String name = item.optString("name", "Item") + (item.optBoolean("isHalfOrder") ? " (Half)" : "");
            line(out, truncate(quantity + "x " + name, paperColumns));
            if (type == DocumentType.RECEIPT) {
                line(out, rightAlign(formatPhp(item.optDouble("lineTotal", 0.0)), paperColumns));
            }
        }

        line(out, separator);
        if (type == DocumentType.RECEIPT) {
            JSONObject totals = order.optJSONObject("totals");
            JSONObject payment = order.optJSONObject("payment");
            if (totals == null) {
                totals = new JSONObject();
            }
            if (payment == null) {
                payment = new JSONObject();
            }
            line(out, twoColumns("Subtotal", formatPhp(totals.optDouble("subtotal", 0.0)), paperColumns));
            line(out, twoColumns("Tax", formatPhp(totals.optDouble("tax", 0.0)), paperColumns));
            raw(out, 0x1B, 0x45, 0x01);
            line(out, twoColumns("TOTAL", formatPhp(totals.optDouble("total", 0.0)), paperColumns));
            raw(out, 0x1B, 0x45, 0x00);
            line(out, twoColumns("Payment", payment.optString("method", "CASH"), paperColumns));
            line(out, twoColumns("Change", formatPhp(payment.optDouble("changeAmount", 0.0)), paperColumns));
        }

        String note = order.optString("orderNote", "").trim();
        if (!note.isEmpty() && !"null".equals(note)) {
            line(out, separator);
            line(out, truncate(note, paperColumns));
        }

        line(out, "");
        line(out, "");
        raw(out, 0x1D, 0x56, 0x42, 0x00);
        return out.toByteArray();
    }

    private void raw(ByteArrayOutputStream out, int... bytes) {
        for (int value : bytes) {
            out.write(value);
        }
    }

    private void line(ByteArrayOutputStream out, String value) throws Exception {
        out.write(value.getBytes(charset));
        out.write('\n');
    }

    private int paperColumns(JSONObject order) {
        JSONObject printOptions = order.optJSONObject("printOptions");
        String paperWidth = printOptions == null ? "80mm" : printOptions.optString("paperWidth", "80mm");
        return "58mm".equals(paperWidth) ? PAPER_COLUMNS_58MM : PAPER_COLUMNS_80MM;
    }

    private String twoColumns(String label, String value, int paperColumns) {
        int spaceCount = Math.max(1, paperColumns - label.length() - value.length());
        return label + repeat(" ", spaceCount) + value;
    }

    private String rightAlign(String value, int paperColumns) {
        return repeat(" ", Math.max(0, paperColumns - value.length())) + value;
    }

    private String formatPhp(double value) {
        return NumberFormat.getCurrencyInstance(new Locale("en", "PH")).format(value);
    }

    private String formatTimestamp(String value) {
        try {
            SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            parser.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            SimpleDateFormat formatter = new SimpleDateFormat("MMM d, yyyy h:mm a", new Locale("en", "PH"));
            Date date = parser.parse(value);
            return formatter.format(date == null ? new Date() : date);
        } catch (Exception ignored) {
            return value;
        }
    }

    private String shortOrderId(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "ORDER";
        }
        String trimmed = value.trim();
        return trimmed.substring(Math.max(0, trimmed.length() - 18));
    }

    private String truncate(String value, int maxLength) {
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String repeat(String value, int count) {
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < count; index += 1) {
            builder.append(value);
        }
        return builder.toString();
    }

    @SuppressLint("MissingPermission")
    private String printerLabel(BluetoothDevice printer) {
        String name = safeDeviceName(printer);
        return name.isEmpty() ? printer.getAddress() : name;
    }

    @SuppressLint("MissingPermission")
    private String safeDeviceName(BluetoothDevice device) {
        String name = device.getName();
        return name == null ? "" : name;
    }

    private enum DocumentType {
        RECEIPT("Receipt"),
        KITCHEN("Kitchen ticket");

        private final String label;

        DocumentType(String label) {
            this.label = label;
        }
    }

    public static class PrintResult {
        public final boolean success;
        public final String message;

        public PrintResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }
    }
}
