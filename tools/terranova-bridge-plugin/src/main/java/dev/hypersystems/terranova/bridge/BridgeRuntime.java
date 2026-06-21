package dev.hypersystems.terranova.bridge;

import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.annotation.Nullable;

/** Shared TerraNova Bridge plugin runtime state for polling and commands. */
final class BridgeRuntime {

    private final AtomicBoolean polling = new AtomicBoolean(false);
    private final AtomicBoolean paused = new AtomicBoolean(false);
    private final AtomicBoolean notificationsEnabled = new AtomicBoolean(true);
    private volatile long lastTickAtMs;
    private volatile int lastCommandsRan;
    private volatile @Nullable Path lastSaveRoot;
    private volatile @Nullable ActiveSaveResolver.SaveSource lastSaveSource;
    private volatile @Nullable String lastTickError;

    boolean isPolling() {
        return polling.get();
    }

    void setPolling(boolean value) {
        polling.set(value);
    }

    boolean isPaused() {
        return paused.get();
    }

    void setPaused(boolean value) {
        paused.set(value);
    }

    boolean isNotificationsEnabled() {
        return notificationsEnabled.get();
    }

    void setNotificationsEnabled(boolean value) {
        notificationsEnabled.set(value);
    }

    long lastTickAtMs() {
        return lastTickAtMs;
    }

    int lastCommandsRan() {
        return lastCommandsRan;
    }

    @Nullable
    Path lastSaveRoot() {
        return lastSaveRoot;
    }

    @Nullable
    ActiveSaveResolver.SaveSource lastSaveSource() {
        return lastSaveSource;
    }

    @Nullable
    String lastTickError() {
        return lastTickError;
    }

    void recordTick(@Nullable ActiveSaveResolver.ResolveResult save, int commandsRan) {
        lastTickAtMs = System.currentTimeMillis();
        lastCommandsRan = commandsRan;
        lastTickError = null;
        if (save != null) {
            lastSaveRoot = save.saveRoot();
            lastSaveSource = save.source();
        }
    }

    void recordTickError(String message) {
        lastTickAtMs = System.currentTimeMillis();
        lastCommandsRan = 0;
        lastTickError = message;
    }
}
