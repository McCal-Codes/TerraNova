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

    private final AtomicBoolean polling = new AtomicBoolean(false);
    private PendingCommandExecutor executor;

    public TerraNovaBridgePlugin(@Nonnull JavaPluginInit init) {
        super(init);
    }

    @Override
    protected void setup() {
        executor =
                new PendingCommandExecutor(
                        new PendingCommandExecutor.Listener() {
                            @Override
                            public void info(String message) {
                                getLogger().at(Level.INFO).log("[TerraNova.Bridge] " + message);
                            }

                            @Override
                            public void warn(String message, @Nullable Throwable error) {
                                if (error != null) {
                                    getLogger()
                                            .at(Level.WARNING)
                                            .withCause(error)
                                            .log("[TerraNova.Bridge] " + message);
                                } else {
                                    getLogger().at(Level.WARNING).log("[TerraNova.Bridge] " + message);
                                }
                            }
                        });
        getLogger().at(Level.INFO).log("TerraNova.Bridge setup (command executor v0.3.0)");
    }

    @Override
    protected void start() {
        if (!polling.compareAndSet(false, true)) {
            return;
        }
        getTaskRegistry()
                .registerTask(
                        CompletableFuture.runAsync(
                                () -> {
                                    while (polling.get()) {
                                        try {
                                            executor.tick(ActiveSaveResolver.resolve());
                                            Thread.sleep(POLL_MS);
                                        } catch (InterruptedException e) {
                                            Thread.currentThread().interrupt();
                                            break;
                                        } catch (Exception e) {
                                            getLogger()
                                                    .at(Level.WARNING)
                                                    .log(
                                                            "TerraNova.Bridge poll error: "
                                                                    + e.getMessage());
                                        }
                                    }
                                }));
        getLogger()
                .at(Level.INFO)
                .log(
                        "TerraNova.Bridge started — polling bridge/pending-commands.log (sidecar writes bridge-active-save.txt)");
    }

    @Override
    protected void shutdown() {
        polling.set(false);
        getLogger().at(Level.INFO).log("TerraNova.Bridge shutdown");
    }
}
