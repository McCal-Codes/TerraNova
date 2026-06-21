package dev.hypersystems.terranova.bridge;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import java.util.function.Consumer;
import javax.annotation.Nullable;

/** Persists lightweight Bridge plugin preferences under the plugin data directory. */
final class BridgePreferences {

    private static final String FILE_NAME = "bridge-plugin.properties";
    private static final String KEY_NOTIFICATIONS = "notifications.enabled";

    private final Path file;
    private final Properties properties = new Properties();
    @Nullable private final Consumer<String> warnSink;

    BridgePreferences(Path dataDirectory, @Nullable Consumer<String> warnSink) {
        this.file = dataDirectory.resolve(FILE_NAME);
        this.warnSink = warnSink;
        load();
    }

    boolean notificationsEnabled() {
        return Boolean.parseBoolean(properties.getProperty(KEY_NOTIFICATIONS, "true"));
    }

    void setNotificationsEnabled(boolean enabled) {
        properties.setProperty(KEY_NOTIFICATIONS, Boolean.toString(enabled));
        save();
    }

    private void load() {
        if (!Files.isRegularFile(file)) {
            return;
        }
        try (InputStream in = Files.newInputStream(file)) {
            properties.load(in);
        } catch (IOException e) {
            logWarning("Could not read " + file + ": " + e.getMessage());
        }
    }

    private void save() {
        try {
            Files.createDirectories(file.getParent());
            try (OutputStream out = Files.newOutputStream(file)) {
                properties.store(out, "TerraNova Bridge plugin preferences");
            }
        } catch (IOException e) {
            logWarning("Could not save " + file + ": " + e.getMessage());
        }
    }

    private void logWarning(String message) {
        if (warnSink != null) {
            warnSink.accept(message);
        }
    }
}
