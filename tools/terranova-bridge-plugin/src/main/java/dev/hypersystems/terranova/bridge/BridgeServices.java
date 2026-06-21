package dev.hypersystems.terranova.bridge;

/** Shared Bridge plugin services wired once during setup. */
final class BridgeServices {

    final BridgeRuntime runtime;
    final BridgePreferences preferences;
    final PendingCommandExecutor executor;
    final BridgePlayerNotifier notifier;

    BridgeServices(
            BridgeRuntime runtime,
            BridgePreferences preferences,
            PendingCommandExecutor executor,
            BridgePlayerNotifier notifier) {
        this.runtime = runtime;
        this.preferences = preferences;
        this.executor = executor;
        this.notifier = notifier;
    }

    void setNotificationsEnabled(boolean enabled) {
        runtime.setNotificationsEnabled(enabled);
        preferences.setNotificationsEnabled(enabled);
    }
}
