package dev.hypersystems.terranova.bridge;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import javax.annotation.Nullable;

/** Collects TerraNova Bridge health checks for /tnbridge doctor. */
final class BridgeDoctor {

    enum Level {
        OK,
        WARN,
        FAIL
    }

    record Finding(Level level, String message) {}

    private BridgeDoctor() {}

    static boolean isSidecarReachable() {
        return isSidecarPortOpen();
    }

    static List<Finding> run(BridgeRuntime runtime) {
        List<Finding> out = new ArrayList<>();
        ActiveSaveResolver.ResolveResult save = ActiveSaveResolver.resolveDetailed();

        if (save.saveRoot() == null) {
            out.add(
                    new Finding(
                            Level.FAIL,
                            "No active save resolved. Start Hytale with this save or run the TerraNova sidecar."));
            return out;
        }

        Path saveRoot = save.saveRoot();
        out.add(
                new Finding(
                        Level.OK,
                        "Save: "
                                + saveRoot
                                + " ("
                                + save.source().label()
                                + ")"));

        Path config = saveRoot.resolve("bridge").resolve("config.json");
        if (Files.isRegularFile(config)) {
            String token = BridgeFiles.readAuthToken(config);
            if (token != null && !token.isBlank()) {
                out.add(new Finding(Level.OK, "bridge/config.json token present."));
            } else {
                out.add(
                        new Finding(
                                Level.WARN,
                                "bridge/config.json exists but auth_token is missing. Run the sidecar once."));
            }
        } else {
            out.add(
                    new Finding(
                            Level.WARN,
                            "bridge/config.json missing. Run `pnpm bridge:run` for this save."));
        }

        Path pending = saveRoot.resolve("bridge").resolve("pending-commands.log");
        if (!Files.isRegularFile(pending)) {
            out.add(new Finding(Level.OK, "pending-commands.log not present (queue empty)."));
        } else if (!Files.isReadable(pending)) {
            out.add(new Finding(Level.FAIL, "pending-commands.log is not readable."));
        } else {
            int queued = PendingCommandExecutor.countActionableLines(pending);
            if (queued == 0) {
                out.add(new Finding(Level.OK, "pending-commands.log readable (queue empty)."));
            } else {
                out.add(
                        new Finding(
                                Level.WARN,
                                "pending-commands.log has "
                                        + queued
                                        + " queued command(s)."));
            }
        }

        if (runtime.isPolling()) {
            out.add(new Finding(Level.OK, "Plugin polling thread is active."));
        } else {
            out.add(new Finding(Level.FAIL, "Plugin polling thread is not running."));
        }

        if (runtime.isPaused()) {
            out.add(
                    new Finding(
                            Level.WARN,
                            "Polling is paused. Run /tnbridge resume to execute queued commands."));
        } else {
            out.add(new Finding(Level.OK, "Polling is not paused."));
        }

        out.add(
                new Finding(
                        Level.OK,
                        "In-game notifications: "
                                + (runtime.isNotificationsEnabled() ? "on" : "off")
                                + " (/tnbridge notify on|off)"));

        if (isSidecarPortOpen()) {
            out.add(new Finding(Level.OK, "Sidecar port 127.0.0.1:7854 is reachable."));
        } else {
            out.add(
                    new Finding(
                            Level.WARN,
                            "Sidecar port 127.0.0.1:7854 is closed. Start sidecar from TerraNova Bridge."));
        }

        Path pointer = ActiveSaveResolver.pointerFilePath();
        if (pointer != null && Files.isRegularFile(pointer)) {
            try {
                String raw = Files.readString(pointer, StandardCharsets.UTF_8).trim();
                if (!raw.isEmpty() && !saveRoot.toString().equals(raw)) {
                    out.add(
                            new Finding(
                                    Level.WARN,
                                    "bridge-active-save.txt points to a different save: " + raw));
                }
            } catch (IOException ignored) {
                out.add(new Finding(Level.WARN, "Could not read bridge-active-save.txt."));
            }
        }

        @Nullable String tickError = runtime.lastTickError();
        if (tickError != null && !tickError.isBlank()) {
            out.add(new Finding(Level.WARN, "Last poll error: " + tickError));
        }

        return out;
    }

    private static boolean isSidecarPortOpen() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", 7854), 400);
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}
