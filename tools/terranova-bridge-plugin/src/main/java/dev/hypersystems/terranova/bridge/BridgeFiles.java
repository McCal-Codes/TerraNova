package dev.hypersystems.terranova.bridge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.annotation.Nullable;

/** Small save-file helpers shared by commands and diagnostics. */
final class BridgeFiles {

    private BridgeFiles() {}

    @Nullable
    static String readAuthToken(Path configPath) {
        if (!Files.isRegularFile(configPath)) {
            return null;
        }
        try {
            String json = Files.readString(configPath, StandardCharsets.UTF_8);
            int key = json.indexOf("\"auth_token\"");
            if (key < 0) {
                return null;
            }
            int colon = json.indexOf(':', key);
            if (colon < 0) {
                return null;
            }
            int startQuote = json.indexOf('"', colon + 1);
            if (startQuote < 0) {
                return null;
            }
            int endQuote = json.indexOf('"', startQuote + 1);
            if (endQuote < 0) {
                return null;
            }
            return json.substring(startQuote + 1, endQuote);
        } catch (IOException e) {
            return null;
        }
    }
}
