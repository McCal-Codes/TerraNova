package dev.hypersystems.terranova.bridge;

import com.hypixel.hytale.server.core.plugin.JavaPlugin;
import com.hypixel.hytale.server.core.plugin.JavaPluginInit;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;

/**
 * TerraNova Bridge JVM companion — executes queued console commands written by the Rust sidecar.
 *
 * <p>HTTP preview still uses {@code pnpm bridge:run}; this plugin closes the reload/regen/teleport
 * loop in-game.
 */
public final class TerraNovaBridgePlugin extends JavaPlugin {

    private static final long POLL_MS = 500L;

    private final AtomicBoolean pollLoopRunning = new AtomicBoolean(false);
    private final BridgeRuntime runtime = new BridgeRuntime();
    private BridgeServices services;

    public TerraNovaBridgePlugin(@Nonnull JavaPluginInit init) {
        super(init);
    }

    @Override
    protected void setup() {
        BridgePreferences preferences =
                new BridgePreferences(
                        getDataDirectory(),
                        message -> getLogger().at(Level.WARNING).log(BridgeMessages.console(message)));
        runtime.setNotificationsEnabled(preferences.notificationsEnabled());

        PendingCommandExecutor executor =
                new PendingCommandExecutor(
                        new PendingCommandExecutor.Listener() {
                            @Override
                            public void info(String message) {
                                getLogger().at(Level.INFO).log(BridgeMessages.console(message));
                            }

                            @Override
                            public void warn(String message, @Nullable Throwable error) {
                                if (error != null) {
                                    getLogger()
                                            .at(Level.WARNING)
                                            .withCause(error)
                                            .log(BridgeMessages.console(message));
                                } else {
                                    getLogger()
                                            .at(Level.WARNING)
                                            .log(BridgeMessages.console(message));
                                }
                            }
                        });
        BridgePlayerNotifier notifier =
                new BridgePlayerNotifier(
                        message ->
                                getLogger()
                                        .at(Level.WARNING)
                                        .log(BridgeMessages.console(message)));
        services = new BridgeServices(runtime, preferences, executor, notifier);
        getCommandRegistry().registerCommand(new TnBridgeCommand(services));
        getLogger()
                .at(Level.INFO)
                .log(
                        BridgeMessages.console(
                                "setup complete (command executor v0.3.0, /tnbridge commands enabled)"));
    }

    @Override
    protected void start() {
        if (!pollLoopRunning.compareAndSet(false, true)) {
            return;
        }
        runtime.setPolling(true);
        runtime.setPaused(false);
        getTaskRegistry()
                .registerTask(
                        CompletableFuture.runAsync(
                                () -> {
                                    while (pollLoopRunning.get()) {
                                        try {
                                            ActiveSaveResolver.ResolveResult save =
                                                    ActiveSaveResolver.resolveDetailed();
                                            PendingCommandExecutor.TickResult tickResult =
                                                    services.executor.tick(
                                                            save.saveRoot(), runtime.isPaused());
                                            runtime.recordTick(save, tickResult.ranTotal());
                                            if (runtime.isNotificationsEnabled()) {
                                                services.notifier.onTickResult(tickResult);
                                            }
                                            Thread.sleep(POLL_MS);
                                        } catch (InterruptedException e) {
                                            Thread.currentThread().interrupt();
                                            break;
                                        } catch (Exception e) {
                                            runtime.recordTickError(e.getMessage());
                                            getLogger()
                                                    .at(Level.WARNING)
                                                    .log(
                                                            BridgeMessages.console(
                                                                    "poll error: "
                                                                            + e.getMessage()));
                                        }
                                    }
                                }));
        getLogger()
                .at(Level.INFO)
                .log(
                        BridgeMessages.console(
                                "started — polling bridge/pending-commands.log (sidecar writes bridge-active-save.txt)"));
    }

    @Override
    protected void shutdown() {
        pollLoopRunning.set(false);
        runtime.setPolling(false);
        getLogger().at(Level.INFO).log(BridgeMessages.console("shutdown"));
    }
}
